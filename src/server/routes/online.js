const express = require('express');
const router = express.Router();
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PCAP_PATH } = require('../constants');

const { USE_SUDO } = process.env;
const SUDO = USE_SUDO === 'false' ? '' : 'sudo ';

let captureState = {
  pid: null,
  iface: null,
  windowSec: null,
  startedAt: null,
  cmd: null,
  totalDurationSec: null,
  stopTimer: null,
  sessionDir: null,
  outputSessionId: null,
};

const FILE_PREFIX = 'ndr_';

function isRunning() {
  return captureState.pid !== null;
}

function listNdrFiles() {
  try {
    const baseDir = captureState.sessionDir || PCAP_PATH;
    if (!fs.existsSync(baseDir)) return [];
    const entries = fs.readdirSync(baseDir)
      .filter(f => f.endsWith('.pcap') && f.startsWith(FILE_PREFIX))
      .map(f => {
        const full = path.join(baseDir, f);
        const st = fs.statSync(full);
        return { file: full, mtimeMs: st.mtimeMs, ageMs: Date.now() - st.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return entries;
  } catch (e) {
    return [];
  }
}

function getLatestNdrFileDetail() {
  const entries = listNdrFiles();
  if (entries.length === 0) return null;
  return entries[0];
}

router.get('/status', (req, res) => {
  const last = getLatestNdrFileDetail();
  const files = listNdrFiles();
  const prev = files.length > 1 ? files[1] : null;
  res.send({
    running: isRunning(),
    pid: captureState.pid,
    iface: captureState.iface,
    windowSec: captureState.windowSec,
    startedAt: captureState.startedAt,
    cmd: captureState.cmd,
    totalDurationSec: captureState.totalDurationSec,
    sessionDir: captureState.sessionDir,
    outputSessionId: captureState.outputSessionId,
    lastFile: last ? last.file : null,
    lastFileMtimeMs: last ? last.mtimeMs : null,
    lastFileAgeMs: last ? last.ageMs : null,
    prevFile: prev ? prev.file : null,
    prevFileMtimeMs: prev ? prev.mtimeMs : null,
    prevFileAgeMs: prev ? prev.ageMs : null,
  });
});

router.get('/files', (req, res) => {
  try {
    const files = listNdrFiles();
    // return ascending (oldest first)
    const asc = [...files].sort((a, b) => a.mtimeMs - b.mtimeMs);
    res.send({
      sessionDir: captureState.sessionDir,
      running: isRunning(),
      files: asc,
    });
  } catch (e) {
    res.status(500).send({ error: e.message || 'Failed to list files' });
  }
});

router.post('/start', (req, res) => {
  const { iface, windowSec = 10, totalDurationSec = null, filter } = req.body || {};
  if (!iface) return res.status(400).send('Missing iface');
  if (isRunning()) return res.status(409).send('Capture already running');

  // Ensure base PCAP_PATH exists
  try {
      fs.mkdirSync(PCAP_PATH, { recursive: true, mode: 0o777 });
      fs.chmodSync(PCAP_PATH, 0o777);
  } catch (e) {}

  // Create session directory
  const sessionIdTs = Date.now();
  const sessionDir = path.join(PCAP_PATH, `session_${sessionIdTs}`);
  try {
      fs.mkdirSync(sessionDir, { recursive: true, mode: 0o777 });
      fs.chmodSync(sessionDir, 0o777);
  } catch (e) {}

  const outPattern = path.join(sessionDir, `${FILE_PREFIX}%s.pcap`);

  // Build tcpdump command
  let tcpdumpCmd = `sudo tcpdump -i ${iface} -nn -G ${Number(windowSec)} -w ${outPattern} -U`;
  if (filter && String(filter).trim().length > 0) {
      tcpdumpCmd += ` ${String(filter)}`;
  }

  console.log('[ONLINE] Executing:', tcpdumpCmd);

  // Spawn bash so 'exec' replaces the shell → we get tcpdump's actual PID
  const child = spawn('bash', ['-lc', `exec ${tcpdumpCmd}`], {
      stdio: ['ignore', 'pipe', 'pipe']
  });

  captureState = {
      pid: child.pid,
      iface,
      windowSec: Number(windowSec),
      startedAt: new Date().toISOString(),
      cmd: tcpdumpCmd,
      totalDurationSec: totalDurationSec ? Number(totalDurationSec) : null,
      stopTimer: null,
      sessionDir,
      outputSessionId: `session_${sessionIdTs}`,
  };

  child.stdout.on('data', d => console.log('[ONLINE][stdout]', d.toString().trim()));
  child.stderr.on('data', d => console.log('[ONLINE][stderr]', d.toString().trim()));

  child.on('exit', (code, signal) => {
      console.log(`[ONLINE] tcpdump exited code=${code} signal=${signal}`);
      if (captureState.pid === child.pid) {
          if (captureState.stopTimer) {
              clearTimeout(captureState.stopTimer);
              captureState.stopTimer = null;
          }
          captureState.pid = null;
      }
  });

  // Auto-stop after totalDurationSec if provided
  if (totalDurationSec && Number(totalDurationSec) > 0) {
      captureState.stopTimer = setTimeout(() => {
          if (!isRunning()) return;
          console.log('[ONLINE] Auto-stopping tcpdump after totalDurationSec...');
          // use sudo pkill instead of process.kill to avoid EPERM
          exec(`sudo pkill -SIGINT -P ${child.pid}`, (err) => {
              if (err) {
                  console.warn('[ONLINE] pkill -P failed, trying pkill -f fallback');
                  exec(`sudo pkill -SIGINT -f "${sessionDir}"`, () => {});
              }
          });
      }, Number(totalDurationSec) * 1000);
  }

  res.send({
      ok: true,
      pid: child.pid,
      iface,
      windowSec: Number(windowSec),
      totalDurationSec: captureState.totalDurationSec,
      sessionDir,
      outputSessionId: captureState.outputSessionId,
      cmd: tcpdumpCmd
  });
});

router.post('/stop', (req, res) => {
  if (!isRunning()) {
    return res.send({ ok: true, stopped: false });
  }

  const stoppedPid = captureState.pid;

  try {
    console.log(`[ONLINE] Stopping tcpdump PID=${stoppedPid}`);
    process.kill(stoppedPid, 'SIGINT');
  } catch (e) {
    console.warn('[ONLINE] Failed to send SIGINT to tcpdump by PID:', e.message);
    // fallback: kill any tcpdump writing in this session dir
    try {
      const sessionDir = captureState.sessionDir;
      const { execSync } = require('child_process');
      execSync(`sudo pkill -f "${sessionDir}" || true`);
      console.log('[ONLINE] Fallback pkill executed');
    } catch (err) {
      console.warn('[ONLINE] Fallback pkill failed:', err.message);
    }
  }

  if (captureState.stopTimer) {
    clearTimeout(captureState.stopTimer);
    captureState.stopTimer = null;
  }

  const last = getLatestNdrFileDetail();
  captureState.pid = null;

  res.send({
    ok: true,
    stopped: true,
    pid: stoppedPid,
    lastFile: last ? last.file : null,
    lastFileMtimeMs: last ? last.mtimeMs : null,
    lastFileAgeMs: last ? last.ageMs : null,
    sessionDir: captureState.sessionDir,
    outputSessionId: captureState.outputSessionId
  });
});


module.exports = router;