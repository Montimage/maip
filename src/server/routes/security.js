const express = require('express');
const router = express.Router();
const { connect, StringCodec } = require('nats');
const readline = require('readline');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  NATS_URL,
  NATS_USER_INGESTOR,
  NATS_PASS_INGESTOR,
  NATS_SUBJECT,
  USE_SUDO,
} = process.env;

const { LOCAL_NATS_URL, TRAINING_PATH, REPORT_PATH, PCAP_PATH } = require('../constants');
const { identifyUser, requireAdmin } = require('../middleware/userAuth');
const { resolvePcapPath } = require('../utils/pcapResolver');
// Output folder for mmt_security CSVs
const SECURITY_OUT_DIR = path.join(__dirname, '../mmt/outputs');
// Import unified session manager
const sessionManager = require('../utils/sessionManager');
// Import queue functions
const { queueRuleBasedDetection, getJobStatus } = require('../queue/job-queue');

// Default to sudo unless explicitly disabled; use non-interactive to avoid blocking
const SUDO = USE_SUDO === 'false' ? '' : 'sudo -n ';

async function getNatsConnection() {
  const servers = NATS_URL || LOCAL_NATS_URL;
  const userIngestor = NATS_USER_INGESTOR || undefined;
  const passIngestor = NATS_PASS_INGESTOR || undefined;
  const opts = userIngestor && passIngestor
    ? { servers, user: userIngestor, pass: passIngestor }
    : { servers };
  return connect(opts);
}

function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every(o => {
    const n = Number(o);
    return n >= 0 && n <= 255 && String(n) === String(Number(o));
  });
}

// ------------------------------
// Rule-based detection (mmt_security)
// ------------------------------

// Attach user identification to enable user-specific PCAP resolution
router.use(identifyUser);

// State for running mmt_security instance (online)
let secState = {
  running: false,
  mode: null, // 'online' | 'offline'
  pid: null,
  child: null,
  iface: null,
  pcapFile: null,
  outputDir: null,
  outputFile: null,
  startedAt: null,
  intervalSec: null,
  ruleVerdicts: [], // [{ rule: 56, verdicts: 8 }]
  sessionId: null,
  viewers: 0,
  startedBy: null,
  ownerToken: null,
};

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
    try { fs.chmodSync(dir, 0o777); } catch (e) {}
  } catch (e) {}
}

function resolveSecurityBin() {
  const candidates = [
    '/opt/mmt/security/bin/mmt_security',
    '/opt/mmt/security/bin/mmt-security',
    'mmt_security',
    'mmt-security',
  ];
  for (const p of candidates) {
    try {
      if (p.includes('/') && fs.existsSync(p)) return p;
    } catch (e) {}
  }
  // Fallback to first candidate; spawn will fail and we report error
  return candidates[0];
}

function findLatestSecurityCsv(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.csv'))
      .map(f => ({ f, full: path.join(dir, f), st: fs.statSync(path.join(dir, f)) }))
      .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
    return files.length > 0 ? files[0].full : null;
  } catch (e) {
    return null;
  }
}

function parseSecurityCsvLine(line) {
  // Example line:
  // 10,0,"",1758916808,56,"detected","attack","Probable SYN flooding attack (Half TCP handshake without TCP RST)",{"event_1":{...}}
  // We'll parse basic CSV fields until JSON blob, then parse JSON.
  if (!line || !line.trim()) return null;
  // Split by commas but preserve JSON at the end; do a naive split by first 8 commas
  const parts = [];
  let current = '';
  let inQuotes = false;
  let commas = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes && commas < 8) {
      parts.push(current);
      current = '';
      commas++;
    } else {
      current += ch;
    }
  }
  parts.push(current);

  if (parts.length < 9) return null;
  const [sev, unknown0, emptyQ, ts, code, status, category, desc, jsonStr] = parts;
  let details = null;
  try { details = JSON.parse(jsonStr); } catch (e) { details = null; }

  // Try to derive src/dst from details
  const attrs = [];
  function scanAttrs(obj) {
    try {
      const events = Object.values(obj || {});
      for (const ev of events) {
        const kv = ev && ev.attributes;
        if (Array.isArray(kv)) {
          for (const [k, v] of kv) {
            attrs.push({ k: String(k), v });
          }
        }
      }
    } catch (e) {}
  }
  if (details) scanAttrs(details);
  const attrMap = new Map(attrs.map(x => [x.k, x.v]));
  const srcIp = attrMap.get('ip.src') || null;
  const dstIp = attrMap.get('ip.dst') || null;

  return {
    probeId: Number(sev),
    timestamp: Number(ts),
    code: Number(code),
    status: (status || '').replace(/"/g, ''),
    category: (category || '').replace(/"/g, ''),
    description: (desc || '').replace(/"/g, ''),
    srcIp,
    dstIp,
    raw: line,
    details,
  };
}

function parseSecurityCsv(filePath, limit = 500) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const out = [];
    for (const line of lines.slice(-limit)) {
      const obj = parseSecurityCsvLine(line);
      if (obj) out.push(obj);
    }
    return out;
  } catch (e) {
    return [];
  }
}

function parseRuleVerdictsFromText(text) {
  try {
    const map = new Map();
    String(text || '')
      .split(/\r?\n/)
      .forEach((line) => {
        const m = line.match(/-\s*rule\s+(\d+)\s+generated\s+(\d+)\s+verdicts/i);
        if (m) {
          const rule = Number(m[1]);
          const verdicts = Number(m[2]);
          map.set(rule, verdicts);
        }
      });
    return Array.from(map.entries()).map(([rule, verdicts]) => ({ rule, verdicts }));
  } catch {
    return [];
  }
}

function dedupeAlerts(list) {
  try {
    const seen = new Set();
    const out = [];
    for (const a of list || []) {
      const code = a && typeof a.code !== 'undefined' ? String(a.code) : '';
      const category = String((a && a.category) || '').trim().toLowerCase();
      const desc = String((a && a.description) || '').trim().toLowerCase();
      const src = String((a && a.srcIp) || '').trim().toLowerCase();
      const dst = String((a && a.dstIp) || '').trim().toLowerCase();
      // Group by stable identity ignoring timestamp and probe
      const key = [code, category, desc, src, dst].join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(a);
      }
    }
    return out;
  } catch (_) {
    return Array.isArray(list) ? list : [];
  }
}

router.get('/rule-based/status', async (req, res) => {
  try {
    const { sessionId, ownerToken } = req.query;
    const isAdmin = req.isAdmin || false;
    
    if (sessionId) {
      // Get specific session status
      const session = sessionManager.getSession('attacks', sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found', sessionId });
      }
      const lastFile = session.outputFile || findLatestSecurityCsv(session.outputDir);
      if (lastFile && !session.outputFile) {
        sessionManager.updateSession('attacks', sessionId, { outputFile: lastFile });
      }
      // Check if requester is the owner
      const isOwner = session.ownerToken && ownerToken === session.ownerToken;
      return res.send({ 
        ok: true, 
        ...session, 
        isOwner, 
        isAdmin,
        canStartOnline: isAdmin,
        ownerToken: undefined 
      });
    }
    
    // Legacy: return global secState (for backward compatibility)
    const lastFile = secState.outputFile || findLatestSecurityCsv(secState.outputDir);
    if (lastFile) secState.outputFile = lastFile;
    // Check if requester is the owner
    const isOwner = secState.ownerToken && ownerToken === secState.ownerToken;
    res.send({ 
      ok: true, 
      ...secState, 
      isOwner, 
      isAdmin,
      canStartOnline: isAdmin,
      ownerToken: undefined 
    });
  } catch (e) {
    res.status(500).send(e.message || 'Failed to get status');
  }
});

router.get('/rule-based/alerts', async (req, res) => {
  try {
    const { sessionId, limit: limitParam } = req.query;
    const limit = limitParam ? Number(limitParam) : 500;
    
    let file, outputDir;
    if (sessionId) {
      // Get alerts for specific session
      const session = sessionManager.getSession('attacks', sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found', sessionId });
      }
      file = session.outputFile || findLatestSecurityCsv(session.outputDir);
      outputDir = session.outputDir;
    } else {
      // Legacy: use global secState
      file = secState.outputFile || findLatestSecurityCsv(secState.outputDir);
      outputDir = secState.outputDir;
    }
    
    if (!file) return res.send({ ok: true, alerts: [] });
    const alerts = parseSecurityCsv(file, limit);
    const uniqueAlerts = dedupeAlerts(alerts);
    res.send({ ok: true, file, count: uniqueAlerts.length, alerts: uniqueAlerts });
  } catch (e) {
    res.status(500).send(e.message || 'Failed to read alerts');
  }
});

router.post('/rule-based/online/start', async (req, res) => {
  try {
    const { iface, intervalSec = 5, verbose = true, excludeRules, cores } = req.body || {};
    if (!iface) return res.status(400).send('Missing iface');
    
    // Check if online rule-based detection is already running
    if (secState.running && secState.mode === 'online') {
      return res.status(409).json({ 
        error: 'Online rule-based detection already running',
        message: 'Rule-based detection is already running. Please stop the current session first.',
        currentSession: secState.sessionId,
        sessionId: secState.sessionId
      });
    }

    // If sudo is enabled, verify non-interactive sudo works; otherwise return guidance
    if (SUDO && SUDO.trim().length > 0) {
      try {
        await new Promise((resolve, reject) => {
          exec(`${SUDO.trim()} -v`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
      } catch (e) {
        return res.status(403).send(
          'sudo is configured but requires a password. Either set USE_SUDO=false and grant capabilities to mmt_security (setcap cap_net_raw,cap_net_admin+eip), or configure sudoers NOPASSWD for the binary.'
        );
      }
    }

    const outDirBase = SECURITY_OUT_DIR;
    // Use a unique folder per run to avoid reading previous alerts
    const runDir = path.join(outDirBase, `run-${Date.now()}`);
    ensureDir(runDir);
    const bin = resolveSecurityBin();

    const args = [];
    args.push('-i', iface);
    if (verbose) args.push('-v');
    if (excludeRules) args.push('-x', String(excludeRules));
    if (cores) args.push('-c', String(cores));
    // ensure trailing slash and include rotation interval so files are created under the run folder
    args.push('-f', `${runDir}/:${Number(intervalSec)}`);

    const cmd = `${SUDO}${bin} ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    console.log('[SECURITY][rule-based][online] Executing:', cmd);

    // Spawn via bash so sudo can prompt non-interactively (assume configured). We do not pipe stdin.
    const child = spawn('bash', ['-lc', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    const verdictMap = new Map();
    let combinedLog = '';
    const parseAndUpdate = (txt) => {
      const lines = String(txt || '').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/-\s*rule\s+(\d+)\s+generated\s+(\d+)\s+verdicts/i);
        if (m) {
          verdictMap.set(Number(m[1]), Number(m[2]));
        }
      }
      secState.ruleVerdicts = Array.from(verdictMap.entries()).map(([rule, verdicts]) => ({ rule, verdicts }));
    };
    child.stdout.on('data', d => {
      const raw = d.toString();
      combinedLog += raw;
      const txt = raw.trim();
      if (txt) console.log('[mmt_security][stdout]', txt);
      parseAndUpdate(raw);
    });
    child.stderr.on('data', d => {
      const raw = d.toString();
      combinedLog += raw;
      const txt = raw.trim();
      if (txt) console.log('[mmt_security][stderr]', txt);
      parseAndUpdate(raw);
    });
    child.on('exit', (code, signal) => {
      console.log(`[SECURITY][rule-based] mmt_security exited code=${code} signal=${signal}`);
      secState.running = false;
      secState.pid = null;
      secState.child = null;
      // finalize ruleVerdicts from combined logs on exit
      const finalVerdicts = parseRuleVerdictsFromText(combinedLog);
      secState.ruleVerdicts = finalVerdicts && finalVerdicts.length > 0
        ? finalVerdicts
        : Array.from(verdictMap.entries()).map(([rule, verdicts]) => ({ rule, verdicts }));
    });

    // Generate unique session ID
    const sessionId = `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    secState = {
      running: true,
      mode: 'online',
      pid: child.pid,
      child,
      iface,
      pcapFile: null,
      outputDir: runDir,
      outputFile: null,
      startedAt: new Date().toISOString(),
      intervalSec: Number(intervalSec),
      ruleVerdicts: [],
      sessionId,
      startedBy: req.ip || 'unknown',
    };

    // Create session in session manager
    sessionManager.createSession('attacks', sessionId, 'online', {
      pid: child.pid,
      iface,
      pcapFile: null,
      outputDir: runDir,
      outputFile: null,
      intervalSec: Number(intervalSec),
      ruleVerdicts: [],
      startedBy: req.ip || 'unknown',
    });

    res.send({ 
      ok: true, 
      sessionId,
      message: 'Online rule-based detection started',
      running: true,
      mode: 'online',
      iface,
      pid: child.pid,
      outputDir: runDir,
      startedAt: secState.startedAt,
      intervalSec: secState.intervalSec,
      ruleVerdicts: secState.ruleVerdicts
    });
  } catch (e) {
    console.error('rule-based online start error:', e);
    res.status(500).send(e.message || 'Failed to start mmt_security');
  }
});

router.post('/rule-based/online/stop', async (req, res) => {
  try {
    if (!secState.running) return res.send({ ok: true, stopped: false });
    
    const stoppedPid = secState.pid;
    const child = secState.child;
    try {
      process.kill(stoppedPid, 'SIGINT');
    } catch (e) {
      console.warn('[SECURITY] Failed SIGINT by PID, trying pkill');
      exec(`${SUDO}pkill -f mmt_security || ${SUDO}pkill -f mmt-security`, () => {});
    }
    // Wait briefly for the process to exit so ruleVerdicts can be finalized
    if (child && typeof child.once === 'function') {
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } else {
      // Fallback wait
      await new Promise((r) => setTimeout(r, 1000));
    }
    secState.running = false;
    secState.pid = null;
    const lastFile = findLatestSecurityCsv(secState.outputDir);
    if (lastFile) secState.outputFile = lastFile;
    
    // Update session manager
    if (secState.sessionId) {
      sessionManager.updateSession('attacks', secState.sessionId, {
        isRunning: false,
        outputFile: lastFile,
        pid: null
      });
    }
    
    res.send({ ok: true, stopped: true, ...secState });
  } catch (e) {
    res.status(500).send(e.message || 'Failed to stop mmt_security');
  }
});

router.post('/rule-based/offline', async (req, res) => {
  try {
    const { pcapFile, filePath, verbose = false, excludeRules, cores, useQueue } = req.body || {};
    const userId = req.userId;
    let inputPath = null;
    if (filePath) {
      inputPath = filePath;
    }
    if (!inputPath && pcapFile) {
      // Use unified resolver: checks user uploads -> samples -> legacy PCAP_PATH
      inputPath = resolvePcapPath(pcapFile, userId);
    }
    if (!inputPath) return res.status(400).send('Missing pcapFile or filePath');
    if (!fs.existsSync(inputPath)) return res.status(404).send(`PCAP not found: ${inputPath}`);

    // Generate unique session ID for this offline detection
    const sessionId = `security_offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Queue-based approach is ENABLED BY DEFAULT
    const useQueueDefault = process.env.USE_QUEUE_BY_DEFAULT !== 'false';
    const shouldUseQueue = useQueue !== undefined ? useQueue : useQueueDefault;
    
    if (shouldUseQueue) {
      console.log('[SECURITY][rule-based][offline] Using queue-based processing for session:', sessionId);
      
      // Queue the job
      const result = await queueRuleBasedDetection({
        pcapFile,
        filePath: inputPath,
        sessionId,
        verbose,
        excludeRules,
        cores,
        priority: 5
      });
      
      const jobId = result.jobId;
      console.log('[SECURITY] Job queued:', jobId, 'Waiting for completion...');
      
      // Create session in session manager
      sessionManager.createSession('attacks', sessionId, 'offline', {
        pcapFile,
        filePath: inputPath,
        outputDir: null, // Will be set by worker
        outputFile: null,
        excludeRules,
        cores,
        queued: true,
        jobId: jobId
      });
      
      // Poll for job completion
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes max
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const status = await getJobStatus(jobId, 'rule-based-detection');
        
        if (status.status === 'completed') {
          console.log('[SECURITY] Job completed:', jobId);
          
          // Update session with results
          sessionManager.updateSession('attacks', sessionId, {
            isRunning: false,
            outputDir: status.result?.outputDir,
            outputFile: status.result?.outputFile,
            ruleVerdicts: status.result?.ruleVerdicts
          });
          
          // Parse and return alerts
          const file = status.result?.outputFile;
          const alerts = file ? parseSecurityCsv(file, 2000) : [];
          const uniqueAlerts = dedupeAlerts(alerts);
          
          return res.send({ 
            ok: true, 
            sessionId, 
            file, 
            count: uniqueAlerts.length, 
            alerts: uniqueAlerts, 
            ruleVerdicts: status.result?.ruleVerdicts || [],
            queued: true,
            jobId: jobId
          });
        } else if (status.status === 'failed') {
          console.error('[SECURITY] Job failed:', jobId, status.failedReason);
          sessionManager.updateSession('attacks', sessionId, {
            isRunning: false,
            error: status.failedReason
          });
          return res.status(500).send(status.failedReason || 'Rule-based detection failed');
        }
        
        // Still processing, wait and check again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      // Timeout
      return res.status(408).send('Request timeout: Rule-based detection took too long');
    }
    
    // OLD: Direct processing (blocking) - only if useQueue=false
    console.log('[SECURITY][rule-based][offline] Using direct processing (blocking) for session:', sessionId);
    
    const outDir = path.join(SECURITY_OUT_DIR, `offline-${sessionId}`);
    ensureDir(outDir);
    const bin = resolveSecurityBin();

    const args = [];
    args.push('-t', inputPath);
    if (verbose) args.push('-v');
    if (excludeRules) args.push('-x', String(excludeRules));
    if (cores) args.push('-c', String(cores));
    args.push('-f', `${outDir}/`);

    const cmd = `${bin} ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    console.log('[SECURITY][rule-based][offline] Executing:', cmd);

    // Create session in session manager
    sessionManager.createSession('attacks', sessionId, 'offline', {
      pcapFile,
      filePath: inputPath,
      outputDir: outDir,
      outputFile: null,
      excludeRules,
      cores,
    });

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('mmt_security offline error:', stderr || error.message);
        sessionManager.updateSession('attacks', sessionId, {
          isRunning: false,
          error: stderr || error.message
        });
        return res.status(500).send(stderr || error.message);
      }
      const file = findLatestSecurityCsv(outDir);
      const alerts = parseSecurityCsv(file, 2000);
      const uniqueAlerts = dedupeAlerts(alerts);
      const ruleVerdicts = parseRuleVerdictsFromText(`${stdout}\n${stderr}`);
      
      sessionManager.updateSession('attacks', sessionId, {
        isRunning: false,
        outputFile: file,
        ruleVerdicts,
        alertCount: uniqueAlerts.length
      });
      
      res.send({ 
        ok: true, 
        sessionId, 
        file, 
        count: uniqueAlerts.length, 
        alerts: uniqueAlerts, 
        ruleVerdicts 
      });
    });
  } catch (e) {
    res.status(500).send(e.message || 'Failed to run offline rule-based detection');
  }
});

router.post('/block-ip', requireAdmin, async (req, res) => {
  try {
    const { ip, direction } = req.body || {};
    if (!isValidIPv4(ip)) {
      return res.status(400).send('Invalid IPv4 address');
    }

    const cmds = [];
    const quotedIp = ip.replace(/"/g, '');
    if (!direction || direction === 'in' || direction === 'both') {
      cmds.push(`${SUDO}iptables -I INPUT -s ${quotedIp} -j DROP`);
    }
    if (!direction || direction === 'out' || direction === 'both') {
      cmds.push(`${SUDO}iptables -I OUTPUT -d ${quotedIp} -j DROP`);
    }

    const fullCmd = cmds.join(' && ');
    console.log('[SECURITY] Executing:', fullCmd);
    exec(fullCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('iptables error:', stderr || error.message);
        return res.status(500).send(stderr || error.message);
      }
      res.send({ ok: true, command: fullCmd, stdout });
    });
  } catch (e) {
    console.error('block-ip error:', e);
    res.status(500).send(e.message || 'block-ip failed');
  }
});

// Stream extracted flows (features CSV) to NATS in chunks
// Body: { sessionId?: string, reportId?: string, fileName: string, chunkLines?: number, subject?: string }
router.post('/nats-publish/flows', async (req, res) => {
  try {
    const { sessionId, reportId, fileName, chunkLines = 1000, subject } = req.body || {};
    if (!fileName) return res.status(400).send('Missing fileName');
    const baseDir = reportId ? path.join(REPORT_PATH, reportId) : (sessionId ? path.join(REPORT_PATH, `report-${sessionId}`) : null);
    if (!baseDir) return res.status(400).send('Missing sessionId or reportId');
    let filePath = path.join(baseDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[NATS flows] File not found at expected path: ${filePath}. Attempting fallback search under ${REPORT_PATH}`);
      // Fallback: recursive search for fileName under REPORT_PATH
      const stack = [REPORT_PATH];
      let foundPath = null;
      while (stack.length) {
        const dir = stack.pop();
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
          continue;
        }
        for (const ent of entries) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            // Only descend a few levels to avoid huge scans
            if ((p.match(/\//g) || []).length - (REPORT_PATH.match(/\//g) || []).length <= 6) {
              stack.push(p);
            }
          } else if (ent.isFile() && ent.name === fileName) {
            foundPath = p;
            break;
          }
        }
        if (foundPath) break;
      }
      if (!foundPath) {
        return res.status(404).send(`Flows CSV file not found. Tried: ${path.join(baseDir, fileName)} and no fallback match under ${REPORT_PATH}`);
      }
      console.log(`[NATS flows] Using fallback match for flows file: ${foundPath}`);
      filePath = foundPath;
    }

    const nc = await getNatsConnection();
    const sc = StringCodec();
    const subj = (process.env.NATS_SUBJECT && process.env.NATS_SUBJECT.trim()) || subject;
    if (!subj) {
      await nc.close();
      return res.status(400).send('Missing NATS subject (set NATS_SUBJECT env or pass subject)');
    }

    let published = 0;
    let headerLine = null;
    let buffer = [];
    let seq = 0;
    let headerSent = false;

    const publishChunk = async (lines) => {
      if (!lines || lines.length === 0) return;
      const includeHeader = !headerSent && !!headerLine;
      const columns = includeHeader ? headerLine.split(',').map(s => String(s).trim()) : undefined;
      const payload = {
        type: 'flows',
        reportId: reportId || (sessionId ? `report-${sessionId}` : undefined),
        sessionId,
        fileName,
        seq,
        hasHeader: includeHeader,
        header: includeHeader ? headerLine : undefined,
        columns,
        lines,
      };
      const data = JSON.stringify(payload);
      await nc.publish(subj, sc.encode(data));
      published += 1;
      seq += 1;
      if (includeHeader) headerSent = true;
    };

    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    let lineIndex = 0;
    for await (const line of rl) {
      if (lineIndex === 0) {
        headerLine = line;
      } else {
        buffer.push(line);
        if (buffer.length >= Number(chunkLines)) {
          await publishChunk(buffer);
          buffer = [];
        }
      }
      lineIndex += 1;
    }
    if (buffer.length > 0) {
      await publishChunk(buffer);
    }
    await nc.flush();
    await nc.close();
    res.send({ ok: true, published, chunks: published, fileName });
  } catch (e) {
    console.error('NATS flows publish error:', e);
    res.status(500).send(e.message || 'NATS flows publish failed');
  }
});

// Stream a model dataset to NATS in chunks to avoid large HTTP payloads
// Body: { modelId: string, datasetType: 'train'|'test', chunkLines?: number, subject?: string }
router.post('/nats-publish/dataset', async (req, res) => {
  try {
    const { modelId, datasetType = 'train', chunkLines = 500, subject } = req.body || {};
    if (!modelId || !datasetType) return res.status(400).send('Missing modelId or datasetType');

    const datasetName = `${String(datasetType).charAt(0).toUpperCase() + String(datasetType).slice(1)}_samples.csv`;
    const datasetFilePath = path.join(TRAINING_PATH, modelId.replace('.h5', ''), 'datasets', datasetName);
    if (!fs.existsSync(datasetFilePath)) {
      return res.status(404).send(`Dataset file not found: ${datasetFilePath}`);
    }

    const nc = await getNatsConnection();
    const sc = StringCodec();
    const subj = (process.env.NATS_SUBJECT && process.env.NATS_SUBJECT.trim()) || subject;
    if (!subj) {
      await nc.close();
      return res.status(400).send('Missing NATS subject (set NATS_SUBJECT env or pass subject)');
    }

    let published = 0;
    let headerLine = null;
    let buffer = [];
    let seq = 0;
    let headerSent = false;

    const publishChunk = async (lines) => {
      if (!lines || lines.length === 0) return;
      const includeHeader = !headerSent && !!headerLine;
      const columns = includeHeader ? headerLine.split(',').map(s => String(s).trim()) : undefined;
      const payload = {
        type: 'dataset',
        modelId,
        datasetType,
        seq,
        hasHeader: includeHeader,
        header: includeHeader ? headerLine : undefined,
        columns,
        lines,
      };
      const data = JSON.stringify(payload);
      await nc.publish(subj, sc.encode(data));
      published += 1;
      seq += 1;
      if (includeHeader) headerSent = true;
    };

    const rl = readline.createInterface({ input: fs.createReadStream(datasetFilePath), crlfDelay: Infinity });
    let lineIndex = 0;
    for await (const line of rl) {
      if (lineIndex === 0) {
        headerLine = line;
      } else {
        buffer.push(line);
        if (buffer.length >= Number(chunkLines)) {
          await publishChunk(buffer);
          buffer = [];
        }
      }
      lineIndex += 1;
    }
    if (buffer.length > 0) {
      await publishChunk(buffer);
    }
    await nc.flush();
    await nc.close();
    res.send({ ok: true, published, chunks: published, modelId, datasetType });
  } catch (e) {
    console.error('NATS dataset publish error:', e);
    res.status(500).send(e.message || 'NATS dataset publish failed');
  }
});

router.post('/block-port', requireAdmin, async (req, res) => {
  try {
    const { port, protocol = 'tcp' } = req.body || {};
    const p = Number(port);
    if (!p || p < 1 || p > 65535) return res.status(400).send('Invalid port');
    const proto = ['tcp', 'udp'].includes(String(protocol).toLowerCase()) ? String(protocol).toLowerCase() : 'tcp';
    const cmd = `${SUDO}iptables -I INPUT -p ${proto} --dport ${p} -j DROP && ${SUDO}iptables -I OUTPUT -p ${proto} --sport ${p} -j DROP`;
    console.log('[SECURITY] Executing:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('iptables error:', stderr || error.message);
        return res.status(500).send(stderr || error.message);
      }
      res.send({ ok: true, command: cmd, stdout });
    });
  } catch (e) {
    console.error('block-port error:', e);
    res.status(500).send(e.message || 'block-port failed');
  }
});

router.post('/block-ip-port', requireAdmin, async (req, res) => {
  try {
    const { ip, port, protocol = 'tcp' } = req.body || {};
    const p = Number(port);
    if (!isValidIPv4(ip)) return res.status(400).send('Invalid IPv4 address');
    if (!p || p < 1 || p > 65535) return res.status(400).send('Invalid port');
    const proto = ['tcp', 'udp'].includes(String(protocol).toLowerCase()) ? String(protocol).toLowerCase() : 'tcp';
    const qip = ip.replace(/"/g, '');
    const cmd = `${SUDO}iptables -I INPUT -s ${qip} -p ${proto} --dport ${p} -j DROP && ${SUDO}iptables -I OUTPUT -d ${qip} -p ${proto} --sport ${p} -j DROP`;
    console.log('[SECURITY] Executing:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('iptables error:', stderr || error.message);
        return res.status(500).send(stderr || error.message);
      }
      res.send({ ok: true, command: cmd, stdout });
    });
  } catch (e) {
    console.error('block-ip-port error:', e);
    res.status(500).send(e.message || 'block-ip-port failed');
  }
});

router.post('/drop-session', requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body || {};
    if (!isValidIPv4(ip)) return res.status(400).send('Invalid IPv4 address');
    const cmd = `${SUDO}iptables -I INPUT -s ${ip} -j DROP && ${SUDO}iptables -I OUTPUT -d ${ip} -j DROP`;
    console.log('[SECURITY] Executing:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('iptables error:', stderr || error.message);
        return res.status(500).send(stderr || error.message);
      }
      res.send({ ok: true, command: cmd, stdout });
    });
  } catch (e) {
    res.status(500).send(e.message || 'drop-session failed');
  }
});

router.post('/rate-limit', requireAdmin, async (req, res) => {
  try {
    const { ip, port, protocol = 'tcp', limit = '5/sec', burst = 10, direction = 'in' } = req.body || {};
    if (!isValidIPv4(ip)) return res.status(400).send('Invalid IPv4 address');
    const p = Number(port);
    if (!p || p < 1 || p > 65535) return res.status(400).send('Invalid port');
    const proto = ['tcp', 'udp'].includes(String(protocol).toLowerCase()) ? String(protocol).toLowerCase() : 'tcp';

    const rules = [];
    if (direction === 'in' || direction === 'both') {
      rules.push(`${SUDO}iptables -I INPUT -s ${ip} -p ${proto} --dport ${p} -m limit --limit ${limit} --limit-burst ${burst} -j ACCEPT`);
      rules.push(`${SUDO}iptables -I INPUT -s ${ip} -p ${proto} --dport ${p} -j DROP`);
    }
    if (direction === 'out' || direction === 'both') {
      rules.push(`${SUDO}iptables -I OUTPUT -d ${ip} -p ${proto} --sport ${p} -m limit --limit ${limit} --limit-burst ${burst} -j ACCEPT`);
      rules.push(`${SUDO}iptables -I OUTPUT -d ${ip} -p ${proto} --sport ${p} -j DROP`);
    }
    const cmd = rules.join(' && ');
    console.log('[SECURITY] Executing:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('iptables error:', stderr || error.message);
        return res.status(500).send(stderr || error.message);
      }
      res.send({ ok: true, command: cmd, stdout });
    });
  } catch (e) {
    res.status(500).send(e.message || 'rate-limit failed');
  }
});

router.post('/nats-publish', async (req, res) => {
  try {
    const { subject, payload } = req.body || {};
    if (!payload) {
      return res.status(400).send('Missing payload');
    }
    const nc = await getNatsConnection();
    const sc = StringCodec();
    const subj = (NATS_SUBJECT && NATS_SUBJECT.trim()) || subject;
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    await nc.publish(subj, sc.encode(data));
    await nc.flush();
    await nc.close();
    res.send({ ok: true, subject: subj });
  } catch (e) {
    console.error('NATS publish error:', e);
    res.status(500).send(e.message || 'NATS publish failed');
  }
});

// Bulk publish to NATS: accepts an array of payloads and publishes them using a single connection
router.post('/nats-publish/bulk', async (req, res) => {
  try {
    const { subject, payloads } = req.body || {};
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return res.status(400).send('Missing payloads');
    }
    const nc = await getNatsConnection();
    const sc = StringCodec();
    const subj = (NATS_SUBJECT && NATS_SUBJECT.trim()) || subject;
    let ok = 0, fail = 0;
    for (const payload of payloads) {
      try {
        const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await nc.publish(subj, sc.encode(data));
        ok += 1;
      } catch (e) {
        console.error('NATS publish error (bulk item):', e.message || e);
        fail += 1;
      }
    }
    await nc.flush();
    await nc.close();
    res.send({ ok: true, subject: subj, published: ok, failed: fail });
  } catch (e) {
    console.error('NATS bulk publish error:', e);
    res.status(500).send(e.message || 'NATS bulk publish failed');
  }
});

module.exports = router;