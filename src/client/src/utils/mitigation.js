import React from 'react';
import { Modal, message, notification, Radio, Button } from 'antd';
import { SERVER_URL } from '../constants';
import { computeFlowDetails } from './flowDetails';

// Show-only modal with copy button for command-based actions (top-level)
function ShowCommandsContent({ preview }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview || '');
      message.success('Commands copied to clipboard');
    } catch (_) {
      message.info('Copy failed. You can select and copy the commands manually.');
    }
  };
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Button size="small" onClick={handleCopy}>Copy to clipboard</Button>
      </div>
      <pre style={{ maxHeight: 280, overflowY: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview || ''}</pre>
    </div>
  );
}

function showCommandsModal({ title, preview }) {
  Modal.info({
    title,
    icon: null,
    content: (<ShowCommandsContent preview={preview} />),
    width: 700,
    okText: 'Close',
  });
}

// Security helpers
export async function blockIp(ipAddress) {
  if (!ipAddress) {
    message.warning('No IP address found for this row');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/block-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: String(ipAddress).trim() }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to block IP');
    }
    notification.success({
      message: 'Action submitted',
      description: `Block rule created for ${ipAddress}`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Action failed',
      description: e.message,
      placement: 'topRight',
    });
    throw e;
  }
}

// Bulk mitigation dispatcher for an array of rows (e.g., all malicious flows)
export async function handleBulkMitigationAction({ actionKey, rows, isValidIPv4, entityLabel = 'flows', titleOverride }) {
  const list = Array.isArray(rows) ? rows : [];
  const properEntity = (entityLabel && typeof entityLabel === 'string') ? entityLabel : 'flows';
  const noun = (n) => (n === 1 ? properEntity.replace(/s$/, '') : (properEntity.endsWith('s') ? properEntity : `${properEntity}s`));
  if (list.length === 0) {
    message.info(`No ${properEntity} available for bulk action`);
    return;
  }
  // Collect and deduplicate targets
  const srcIps = new Set();
  const dstIps = new Set();
  const dports = new Set();
  list.forEach((row) => {
    const { srcIp, dstIp, dport } = computeFlowDetails(row);
    if (isValidIPv4 && isValidIPv4(srcIp)) srcIps.add(String(srcIp).trim());
    if (isValidIPv4 && isValidIPv4(dstIp)) dstIps.add(String(dstIp).trim());
    if (dport !== undefined && dport !== null && dport !== '') dports.add(String(dport));
  });

  const perform = async () => {
    switch (actionKey) {
      case 'send-nats-bulk': {
        try {
          const res = await fetch(`${SERVER_URL}/api/security/nats-publish/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payloads: list.map((row) => { const copy = { ...row }; delete copy.key; return copy; }) }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          const ok = Number(data.published || 0);
          const fail = Number(data.failed || 0);
          if (fail === 0) {
            notification.success({ message: 'Sent to NATS', description: `Published ${ok} ${noun(ok)}` , placement: 'topRight' });
          } else if (ok === 0) {
            notification.error({ message: 'NATS publish failed', description: `All ${fail} ${noun(fail)} failed`, placement: 'topRight' });
          } else {
            notification.warning({ message: 'Partial NATS publish', description: `Published ${ok} ${noun(ok)}, failed ${fail}`, placement: 'topRight' });
          }
        } catch (e) {
          notification.error({ message: 'NATS bulk publish failed', description: e.message, placement: 'topRight' });
        }
        break;
      }
      default:
        message.info('Bulk action not recognized');
    }
  };

  const counts = {
    items: list.length,
    srcIps: srcIps.size,
    dstIps: dstIps.size,
    dports: dports.size,
  };
  const properEntityCap = properEntity.charAt(0).toUpperCase() + properEntity.slice(1);
  const titleMap = {
    'send-nats-bulk': `Confirm bulk: Send all ${properEntity} to NATS`,
    'block-src-ip-bulk': 'Bulk commands: Block all source IPs',
    'block-dst-ip-bulk': 'Bulk commands: Block all destination IPs',
  };
  const lines = [];
  lines.push(`${properEntityCap}: ${counts.items}`);
  if (actionKey !== 'send-nats-bulk') {
    if (actionKey === 'block-src-ip-bulk') lines.push(`Distinct src IPs: ${counts.srcIps}`);
    if (actionKey === 'block-dst-ip-bulk') lines.push(`Distinct dst IPs: ${counts.dstIps}`);
  }
  if (actionKey === 'block-src-ip-bulk' || actionKey === 'block-dst-ip-bulk') {
    const ips = actionKey === 'block-src-ip-bulk' ? Array.from(srcIps) : Array.from(dstIps);
    const cmdPreview = ips.map(ip => (
      `sudo iptables -I INPUT -s ${ip} -j DROP\nsudo iptables -I OUTPUT -d ${ip} -j DROP`
    )).join('\n\n');
    showCommandsModal({ title: titleOverride || titleMap[actionKey], preview: cmdPreview });
    return;
  }
  Modal.confirm({ title: titleOverride || titleMap[actionKey] || 'Confirm bulk action', content: lines.join('\n'), onOk: perform });
}

export async function blockPort(port, protocol = 'tcp') {
  if (!port) {
    message.warning('No destination port available');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/block-port`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: Number(port), protocol }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Action submitted',
      description: `Block rule created for ${protocol.toUpperCase()} port ${port}`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Action failed',
      description: e.message,
      placement: 'topRight',
    });
  }
}

export async function blockIpPort(ipAddress, port, protocol = 'tcp') {
  if (!ipAddress || !port) {
    message.warning('Missing IP or port');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/block-ip-port`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: String(ipAddress).trim(), port: Number(port), protocol }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Action submitted',
      description: `Block rule created for ${ipAddress}:${port}/${protocol}`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Action failed',
      description: e.message,
      placement: 'topRight',
    });
  }
}

export async function dropSession(ipAddress) {
  if (!ipAddress) {
    message.warning('Invalid IP to drop');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/drop-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: String(ipAddress).trim() }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Action submitted',
      description: `Session traffic dropped for ${ipAddress}`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Action failed',
      description: e.message,
      placement: 'topRight',
    });
  }
}

export async function rateLimitIp(ipAddress, byteRate, pktsRate) {
  if (!ipAddress) {
    message.warning('No IP address found');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/rate-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: String(ipAddress).trim(), byteRate, pktsRate }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Action submitted',
      description: `Rate limit applied to ${ipAddress}`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Action failed',
      description: e.message,
      placement: 'topRight',
    });
  }
}

export async function sendToNats({ payload }) {
  try {
    const res = await fetch(`${SERVER_URL}/api/security/nats-publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: (() => { const copy = { ...payload }; delete copy.key; return copy; })() }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Sent to NATS',
      description: `Published to server default subject (env NATS_SUBJECT)`,
      placement: 'topRight',
    });
  } catch (e) {
    notification.error({
      message: 'Publish failed',
      description: e.message,
      placement: 'topRight',
    });
  }
}

// UI: Confirm content with toggle and copy button
function ConfirmActionContent({ preview, defaultMode = 'show', onModeChange }) {
  const [mode, setMode] = React.useState(defaultMode);
  React.useEffect(() => { onModeChange && onModeChange(mode); }, [mode]);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview || '');
      message.success('Commands copied to clipboard');
    } catch (_) {
      message.info('Copy failed. You can select and copy the commands manually.');
    }
  };
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} buttonStyle="solid">
          <Radio.Button value="execute">Execute on server</Radio.Button>
          <Radio.Button value="show">Show commands only</Radio.Button>
        </Radio.Group>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Button size="small" onClick={handleCopy}>Copy to clipboard</Button>
      </div>
      <pre style={{ maxHeight: 240, overflowY: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview || ''}</pre>
    </div>
  );
}

function confirmWithToggle({ title, preview, onExecute }) {
  let mode = 'show';
  const setMode = (m) => { mode = m; };
  const handleModeChange = (val) => { setMode(val); };
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content: (
        <ConfirmActionContent
          preview={preview}
          defaultMode={mode}
          onModeChange={handleModeChange}
        />
      ),
      width: 1000,
      okText: 'Continue',
      onOk: async () => {
        if (mode === 'execute') {
          await onExecute();
        } else {
          try {
            await navigator.clipboard.writeText(preview || '');
            message.success('Commands copied to clipboard');
          } catch (_) {
            message.info('Copy the commands manually from the dialog.');
          }
        }
        resolve();
      },
    });
  });
}

function buildCommandPreview(actionKey, params) {
  const { srcIp, dstIp, dport, limit = '5/sec', burst = 10 } = params || {};
  switch (actionKey) {
    case 'block-src-ip':
      return `sudo iptables -I INPUT -s ${srcIp} -j DROP\nsudo iptables -I OUTPUT -d ${srcIp} -j DROP`;
    case 'block-dst-ip':
      return `sudo iptables -I INPUT -s ${dstIp} -j DROP\nsudo iptables -I OUTPUT -d ${dstIp} -j DROP`;
    case 'block-dst-port':
      return `sudo iptables -I INPUT -p tcp --dport ${dport} -j DROP\nsudo iptables -I OUTPUT -p tcp --sport ${dport} -j DROP`;
    case 'block-ip-port-src':
      return `sudo iptables -I INPUT -s ${srcIp} -p tcp --dport ${dport} -j DROP\nsudo iptables -I OUTPUT -d ${srcIp} -p tcp --sport ${dport} -j DROP`;
    case 'block-ip-port-dst':
      return `sudo iptables -I INPUT -s ${dstIp} -p tcp --dport ${dport} -j DROP\nsudo iptables -I OUTPUT -d ${dstIp} -p tcp --sport ${dport} -j DROP`;
    case 'drop-session': {
      const ip = (dstIp && dstIp) || srcIp;
      return `sudo iptables -I INPUT -s ${ip} -j DROP\nsudo iptables -I OUTPUT -d ${ip} -j DROP`;
    }
    case 'rate-limit-src':
      return `sudo iptables -I INPUT -s ${srcIp} -p tcp --dport ${dport} -m limit --limit ${limit} --limit-burst ${burst} -j ACCEPT\nsudo iptables -I INPUT -s ${srcIp} -p tcp --dport ${dport} -j DROP`;
    case 'send-nats':
      return `POST ${SERVER_URL}/api/security/nats-publish with server default subject (env NATS_SUBJECT)`;
    default:
      return '';
  }
}

// Mitigation dispatcher
export function handleMitigationAction({ actionKey, srcIp, dstIp, sessionId, dport, pktsRate, byteRate, isValidIPv4, flowRecord }) {
  const preview = buildCommandPreview(actionKey, { srcIp, dstIp, dport });
  switch (actionKey) {
    case 'block-src-ip':
      if (isValidIPv4(srcIp)) {
        showCommandsModal({
          title: `Commands: Block source IP ${srcIp}`,
          preview,
        });
      } else {
        message.warning('Source IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-ip':
      if (isValidIPv4(dstIp)) {
        showCommandsModal({
          title: `Commands: Block destination IP ${dstIp}`,
          preview,
        });
      } else {
        message.warning('Destination IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-port':
      if (dport) {
        showCommandsModal({
          title: `Commands: Block destination port ${dport}/tcp`,
          preview,
        });
      } else {
        message.warning('No destination port available');
      }
      break;
    case 'block-ip-port-src':
      if (isValidIPv4(srcIp) && dport) {
        showCommandsModal({
          title: `Commands: Block ${srcIp}:${dport}/tcp`,
          preview,
        });
      } else {
        message.warning('Missing source IP or port');
      }
      break;
    case 'block-ip-port-dst':
      if (isValidIPv4(dstIp) && dport) {
        showCommandsModal({
          title: `Commands: Block ${dstIp}:${dport}/tcp`,
          preview,
        });
      } else {
        message.warning('Missing destination IP or port');
      }
      break;
    case 'drop-session':
      if (isValidIPv4(dstIp || srcIp)) {
        const ipToDrop = isValidIPv4(dstIp) ? dstIp : srcIp;
        showCommandsModal({
          title: `Commands: Drop traffic for ${ipToDrop}`,
          preview,
        });
      } else {
        message.warning('Invalid IP to drop');
      }
      break;
    case 'rate-limit-src':
      if (isValidIPv4(srcIp) && dport) {
        showCommandsModal({
          title: `Commands: Rate limit ${srcIp}:${dport}/tcp`,
          preview,
        });
      } else {
        message.warning('Missing src IP or port for rate limit');
      }
      break;
    case 'send-nats':
      if (flowRecord) {
        Modal.confirm({
          title: 'Confirm action: Send flow to NATS',
          content: `Subject: "otics.ingest.>" (server default subject)`,
          onOk: () => sendToNats({ payload: flowRecord })
        });
      } else {
        message.warning('No flow data to send');
      }
      break;
    default:
      message.info('Action not recognized');
  }
}