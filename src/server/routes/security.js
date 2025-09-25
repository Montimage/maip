const express = require('express');
const router = express.Router();
const { connect, StringCodec } = require('nats');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  NATS_URL,
  NATS_USER_INGESTOR,
  NATS_PASS_INGESTOR,
  NATS_SUBJECT,
  USE_SUDO,
} = process.env;

const { LOCAL_NATS_URL } = require('../constants');

// Default to sudo unless explicitly disabled
const SUDO = USE_SUDO === 'false' ? '' : 'sudo ';

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

router.post('/block-ip', async (req, res) => {
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

router.post('/block-port', async (req, res) => {
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

router.post('/block-ip-port', async (req, res) => {
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

router.post('/drop-session', async (req, res) => {
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

router.post('/rate-limit', async (req, res) => {
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