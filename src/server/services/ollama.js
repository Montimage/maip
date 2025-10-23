/**
 * Ollama Service
 * Provides local LLM inference using Ollama
 * OpenAI-compatible interface for easy integration
 */

const http = require('http');

/**
 * Call Ollama Chat API
 * @param {Object} options - Chat options
 * @param {string} options.model - Model name (e.g., 'llama3.1', 'mistral')
 * @param {Array} options.messages - Chat messages in OpenAI format
 * @param {number} options.temperature - Temperature (0-1)
 * @param {number} options.max_tokens - Max tokens to generate
 * @returns {Promise<Object>} Response with text and usage stats
 */
async function callOllamaChat({ model, messages, temperature = 0.2, max_tokens = 350 }) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = model || process.env.OLLAMA_MODEL || 'llama3.1';
  
  // Parse URL
  const url = new URL(ollamaUrl);
  
  // Convert OpenAI-style messages to Ollama format
  // Ollama expects a single prompt, so we'll concatenate messages
  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `System: ${msg.content}\n\n`;
    } else if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }
  prompt += 'Assistant:';

  const payload = JSON.stringify({
    model: ollamaModel,
    prompt: prompt,
    stream: false,
    options: {
      temperature: temperature,
      num_predict: max_tokens, // Ollama uses num_predict instead of max_tokens
    }
  });

  const options = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = json.response || '';
            
            // Estimate token usage (Ollama doesn't provide exact counts like OpenAI)
            // We'll use approximate counts for compatibility
            const promptTokens = Math.ceil(prompt.length / 4); // ~4 chars per token
            const completionTokens = Math.ceil(text.length / 4);
            
            resolve({
              raw: json,
              text: text.trim(),
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
              },
              provider: 'ollama',
              model: ollamaModel
            });
          } else {
            reject(new Error(`Ollama API error: HTTP ${res.statusCode} - ${json.error || data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`Ollama connection error: ${e.message}. Make sure Ollama is running at ${ollamaUrl}`));
    });
    
    req.write(payload);
    req.end();
  });
}

/**
 * Check if Ollama is available
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const url = new URL(ollamaUrl);
  
  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 2000, // 2 second timeout
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * List available Ollama models
 * @returns {Promise<Array>}
 */
async function listOllamaModels() {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const url = new URL(ollamaUrl);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: '/api/tags',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const models = json.models || [];
          resolve(models.map(m => m.name));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.end();
  });
}

module.exports = {
  callOllamaChat,
  isOllamaAvailable,
  listOllamaModels
};
