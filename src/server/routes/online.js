const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { USE_SUDO } = process.env;
const SUDO = USE_SUDO === 'false' ? '' : 'sudo ';

let captureState = {
  pid: null,
  iface: null,
  windowSec: null,
  startedAt: null,
  cmd: null,
};

const TMP_DIR = '/tmp';
const FILE_PREFIX = 'ndr_';

function isRunning() {
  return captureState.pid !== null;
}

function getLatestNdrFileDetail() {
  try {
    const entries = fs.readdirSync(TMP_DIR)
      .filter(f => f.startsWith(FILE_PREFIX) && f.endsWith('.pcap'))
      .map(f => {
        const full = path.join(TMP_DIR, f);
        const st = fs.statSync(full);
        return { f: full, t: st.mtimeMs };
      });
    if (entries.length === 0) return null;
    entries.sort((a, b) => b.t - a.t);
    const top = entries[0];
    return { file: top.f, mtimeMs: top.t, ageMs: Date.now() - top.t };
  } catch (e) {
    return null;
  }
}

router.get('/status', (req, res) => {
  const last = getLatestNdrFileDetail();
  res.send({
    running: isRunning(),
    pid: captureState.pid,
    iface: captureState.iface,
    windowSec: captureState.windowSec,
    startedAt: captureState.startedAt,
    cmd: captureState.cmd,
    lastFile: last ? last.file : null,
    lastFileMtimeMs: last ? last.mtimeMs : null,
    lastFileAgeMs: last ? last.ageMs : null,
  });
});

router.post('/start', (req, res) => {
  const { iface, windowSec = 10, filter } = req.body || {};
  if (!iface) return res.status(400).send('Missing iface');
  if (isRunning()) return res.status(409).send('Capture already running');

  const outPattern = path.join(TMP_DIR, `${FILE_PREFIX}%s.pcap`);
  const args = ['-i', String(iface), '-nn', '-G', String(Number(windowSec)), '-W', '1', '-w', outPattern, '-U'];
  if (filter && String(filter).trim().length > 0) {
    args.push(String(filter));
  }
  const cmdPreview = `${SUDO}tcpdump ${args.join(' ')}`;
  const child = spawn(`${SUDO}tcpdump`, args, { shell: true });

  captureState = {
    pid: child.pid,
    iface,
    windowSec: Number(windowSec),
    startedAt: new Date().toISOString(),
    cmd: cmdPreview,
  };

  console.log('[ONLINE] Executing:', cmdPreview);
  child.stdout.on('data', (d) => console.log('[ONLINE][stdout]', d.toString().trim()));
  child.stderr.on('data', (d) => console.log('[ONLINE][stderr]', d.toString().trim()));
  child.on('exit', (code, signal) => {
    console.log(`[ONLINE] tcpdump exited code=${code} signal=${signal}`);
    if (captureState.pid === child.pid) {
      captureState.pid = null;
    }
  });

  res.send({ ok: true, pid: child.pid, iface, windowSec: Number(windowSec), cmd: cmdPreview });
});

router.post('/stop', (req, res) => {
  if (!isRunning()) return res.send({ ok: true, stopped: false });
  try {
    process.kill(captureState.pid, 'SIGINT');
  } catch (e) {
    console.warn('[ONLINE] Failed to send SIGINT to tcpdump:', e.message);
  }
  const last = getLatestNdrFileDetail();
  const stoppedPid = captureState.pid;
  captureState.pid = null;
  res.send({ ok: true, stopped: true, pid: stoppedPid, lastFile: last ? last.file : null, lastFileMtimeMs: last ? last.mtimeMs : null, lastFileAgeMs: last ? last.ageMs : null });
});

module.exports = router;