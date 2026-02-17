const express = require('express');
const router = express.Router();
const https = require('https');
const { checkTokenLimit, recordTokenUsage, getTokenStats, resetTokenUsage } = require('../middleware/tokenLimiter');
const { callOllamaChat, isOllamaAvailable } = require('../services/ollama');

/**
 * Determine which provider to use
 * Priority: OpenAI (if key exists) > Ollama (if available)
 */
function getProvider() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  if (hasOpenAIKey) {
    return 'openai';
  }
  return 'ollama'; // Fallback to Ollama when no OpenAI key
}

/**
 * Universal chat function that routes to appropriate provider
 */
async function callLLMChat({ model, messages, temperature = 0.2, max_tokens = 350, provider = null }) {
  const selectedProvider = provider || getProvider();
  
  if (selectedProvider === 'ollama') {
    return await callOllamaChat({ model, messages, temperature, max_tokens });
  } else {
    return await callOpenAIChat({ model, messages, temperature, max_tokens });
  }
}

// Helper to call OpenAI Chat Completions API
async function callOpenAIChat({ model, messages, temperature = 0.2, max_tokens = 350 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const payload = JSON.stringify({
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature,
    max_tokens,
    messages,
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = json.choices?.[0]?.message?.content || '';
            const usage = json.usage; // { prompt_tokens, completion_tokens, total_tokens }
            resolve({ raw: json, text, usage, provider: 'openai', model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini' });
          } else {
            reject(new Error(json.error?.message || `OpenAI API error: HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

function trimRecord(record, limit = 40) {
  if (!record || typeof record !== 'object') return {};
  const keys = Object.keys(record).filter(k => k !== 'key').slice(0, limit);
  const obj = {};
  for (const k of keys) {
    const v = record[k];
    obj[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}...` : v;
  }
  return obj;
}

function buildSystemPrompt({ includeMitigations = true } = {}) {
  const base = [
    'You are a cybersecurity XAI assistant integrated in a NDR platform.',
    '- Explain suspicious or malicious network flows in clear steps.',
    '- Use the provided features, probabilities, and XAI outputs (LIME/SHAP) to justify the reasoning.',
  ];
  if (includeMitigations) {
    base.push('- Propose actionable mitigations and, when relevant, suggest playbook-style steps (e.g., block IP, rate-limit, isolate host, collect forensics).');
  }
  base.push('- Keep answers concise, structured with bullet points, and avoid speculation beyond the provided data.');
  base.push('- Prefer short outputs (roughly 120–180 words) unless the user explicitly asks for more.');
  return base.join('\n');
}

/**
 * Conditional token limit middleware
 * Skip token limiting if using Ollama
 */
function conditionalTokenLimit(req, res, next) {
  const provider = getProvider();
  if (provider === 'ollama') {
    // Skip token limiting for Ollama - it's free and unlimited
    req.userId = req.userId || req.headers['x-user-id'] || 'anonymous';
    req.isAdmin = req.isAdmin || req.headers['x-is-admin'] === 'true';
    req.provider = 'ollama';
    return next();
  }
  // Use normal token limiting for OpenAI
  req.provider = 'openai';
  return checkTokenLimit(req, res, next);
}

// POST /api/assistant/explain/flow
// Body: { flowRecord, modelId, predictionId?, extra?: { probs?, shapValues?, limeValues? } }
router.post('/explain/flow', conditionalTokenLimit, async (req, res) => {
  try {
    const { flowRecord, modelId, predictionId, extra = {} } = req.body || {};
    if (!flowRecord || !modelId) {
      return res.status(400).send({ error: 'Missing required fields: flowRecord, modelId' });
    }
    const trimmed = trimRecord(flowRecord);
    const messages = [
      { role: 'system', content: buildSystemPrompt({ includeMitigations: true }) },
      { role: 'user', content: `Model: ${modelId}\nPrediction ID: ${predictionId || 'N/A'}\nFlow features (subset):\n${JSON.stringify(trimmed, null, 2)}\n\nAdditional context:\n${JSON.stringify(extra, null, 2)}\n\nTask:\n- Explain in 3 brief bullets why this flow may be malicious.\n- Summarize in 1 bullet which features likely contributed most.\n- Provide 3 concise mitigation bullets (playbook-style).\n- Keep under ~220 words, but ensure complete sentences (do not cut off mid-sentence).` },
    ];
    const result = await callLLMChat({ messages, max_tokens: 320 });
    
    // Record token usage only for OpenAI (Ollama is unlimited)
    const tokensUsed = result.usage?.total_tokens || 320;
    const isOllama = result.provider === 'ollama';
    
    if (!isOllama) {
      recordTokenUsage(req.userId, tokensUsed, req.isAdmin);
    }
    
    const newTotal = isOllama ? 0 : (req.tokenUsage?.totalTokens || 0) + tokensUsed;
    const limit = isOllama ? Infinity : (req.isAdmin ? Infinity : (parseInt(process.env.USER_TOKEN_LIMIT) || 50000));
    const remaining = isOllama ? Infinity : (req.isAdmin ? Infinity : Math.max(0, limit - newTotal));
    
    console.log(`[Assistant] User ${req.userId} used ${tokensUsed} tokens via ${result.provider} (total: ${newTotal}/${limit === Infinity ? '∞' : limit})`);
    
    res.send({ 
      text: result.text,
      provider: result.provider,
      model: result.model,
      tokenUsage: {
        thisRequest: tokensUsed,
        totalUsed: newTotal,
        limit: limit,
        remaining: remaining,
        percentUsed: isOllama ? 0 : (req.isAdmin ? 0 : Math.round((newTotal / limit) * 100)),
        unlimited: isOllama
      }
    });
  } catch (e) {
    console.error('[Assistant] Error in /explain/flow:', e);
    const errorMsg = e.message || String(e);
    // Provide helpful error message for Ollama connection issues
    if (errorMsg.includes('Ollama connection error')) {
      return res.status(500).send({ 
        error: 'Ollama is not running. Please start Ollama with: ollama serve'
      });
    }
    res.status(500).send({ error: errorMsg });
  }
});

// POST /api/assistant/explain/xai
// Body: { method: 'shap'|'lime', modelId, label?, explanation, context? }
router.post('/explain/xai', conditionalTokenLimit, async (req, res) => {
  try {
    const { method, modelId, label, explanation, context = {} } = req.body || {};
    if (!method || !modelId || !Array.isArray(explanation)) {
      return res.status(400).send({ error: 'Missing required fields: method, modelId, explanation[]' });
    }
    // Only keep top 30 items to limit prompt size
    const topItems = explanation.slice(0, 30);
    const messages = [
      { role: 'system', content: buildSystemPrompt({ includeMitigations: false }) },
      { role: 'user', content: `Model: ${modelId}\nMethod: ${method}\nLabel: ${label || 'N/A'}\nTop explanation items (truncated):\n${JSON.stringify(topItems, null, 2)}\n\nContext:\n${JSON.stringify(context, null, 2)}\n\nTask:\n- Explain the XAI output (what the features indicate) in simple, brief bullet points.\n- Do not include any mitigation steps or recommendations.\n- Keep under ~120 words.` },
    ];
    const result = await callLLMChat({ messages, max_tokens: 200 });
    
    // Record token usage only for OpenAI (Ollama is unlimited)
    const tokensUsed = result.usage?.total_tokens || 200;
    const isOllama = result.provider === 'ollama';
    
    if (!isOllama) {
      recordTokenUsage(req.userId, tokensUsed, req.isAdmin);
    }
    
    const newTotal = isOllama ? 0 : (req.tokenUsage?.totalTokens || 0) + tokensUsed;
    const limit = isOllama ? Infinity : (req.isAdmin ? Infinity : (parseInt(process.env.USER_TOKEN_LIMIT) || 50000));
    const remaining = isOllama ? Infinity : (req.isAdmin ? Infinity : Math.max(0, limit - newTotal));
    
    console.log(`[Assistant] User ${req.userId} used ${tokensUsed} tokens via ${result.provider} (total: ${newTotal}/${limit === Infinity ? '∞' : limit})`);
    
    res.send({ 
      text: result.text,
      provider: result.provider,
      model: result.model,
      tokenUsage: {
        thisRequest: tokensUsed,
        totalUsed: newTotal,
        limit: limit,
        remaining: remaining,
        percentUsed: isOllama ? 0 : (req.isAdmin ? 0 : Math.round((newTotal / limit) * 100)),
        unlimited: isOllama
      }
    });
  } catch (e) {
    console.error('[Assistant] Error in /explain/xai:', e);
    const errorMsg = e.message || String(e);
    // Provide helpful error message for Ollama connection issues
    if (errorMsg.includes('Ollama connection error')) {
      return res.status(500).send({ 
        error: 'Ollama is not running. Please start Ollama with: ollama serve'
      });
    }
    res.status(500).send({ error: errorMsg });
  }
});

// Get token usage stats
router.get('/tokens', getTokenStats);

// Reset token usage (admin only)
router.post('/tokens/reset', resetTokenUsage);

// Health check and provider info
router.get('/', async (req, res) => {
  const provider = getProvider();
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const ollamaAvailable = await isOllamaAvailable();
  
  res.send({ 
    ok: hasOpenAIKey || ollamaAvailable,
    provider: provider,
    model: provider === 'openai' 
      ? (process.env.OPENAI_MODEL || 'gpt-4o-mini')
      : (process.env.OLLAMA_MODEL || 'llama3.1'),
    providers: {
      openai: { available: hasOpenAIKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
      ollama: { available: ollamaAvailable, model: process.env.OLLAMA_MODEL || 'llama3.1', url: process.env.OLLAMA_URL || 'http://localhost:11434' }
    },
    unlimited: provider === 'ollama'
  });
});

module.exports = router;
