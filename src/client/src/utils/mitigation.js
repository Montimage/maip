import { Modal, message, notification } from 'antd';
import { SERVER_URL } from '../constants';
import { computeFlowDetails } from './flowDetails';

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
      case 'block-src-ip-bulk':
        for (const ip of srcIps) await blockIp(ip);
        break;
      case 'block-dst-ip-bulk':
        for (const ip of dstIps) await blockIp(ip);
        break;
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
    'block-src-ip-bulk': 'Confirm bulk: Block all source IPs',
    'block-dst-ip-bulk': 'Confirm bulk: Block all destination IPs',
  };
  const lines = [];
  lines.push(`${properEntityCap}: ${counts.items}`);
  if (actionKey !== 'send-nats-bulk') {
    if (actionKey === 'block-src-ip-bulk') lines.push(`Distinct src IPs: ${counts.srcIps}`);
    if (actionKey === 'block-dst-ip-bulk') lines.push(`Distinct dst IPs: ${counts.dstIps}`);
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
        Modal.confirm({
          title: `Confirm action: Block source IP ${srcIp}`,
          content: preview,
          onOk: () => blockIp(srcIp)
        });
      } else {
        message.warning('Source IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-ip':
      if (isValidIPv4(dstIp)) {
        Modal.confirm({
          title: `Confirm action: Block destination IP ${dstIp}`,
          content: preview,
          onOk: () => blockIp(dstIp)
        });
      } else {
        message.warning('Destination IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-port':
      if (dport) {
        Modal.confirm({
          title: `Confirm action: Block destination port ${dport}/tcp`,
          content: preview,
          onOk: () => blockPort(dport, 'tcp')
        });
      } else {
        message.warning('No destination port available');
      }
      break;
    case 'block-ip-port-src':
      if (isValidIPv4(srcIp) && dport) {
        Modal.confirm({
          title: `Confirm action: Block ${srcIp}:${dport}/tcp`,
          content: preview,
          onOk: () => blockIpPort(srcIp, dport, 'tcp')
        });
      } else {
        message.warning('Missing source IP or port');
      }
      break;
    case 'block-ip-port-dst':
      if (isValidIPv4(dstIp) && dport) {
        Modal.confirm({
          title: `Confirm action: Block ${dstIp}:${dport}/tcp`,
          content: preview,
          onOk: () => blockIpPort(dstIp, dport, 'tcp')
        });
      } else {
        message.warning('Missing destination IP or port');
      }
      break;
    case 'drop-session':
      if (isValidIPv4(dstIp || srcIp)) {
        const ipToDrop = isValidIPv4(dstIp) ? dstIp : srcIp;
        Modal.confirm({
          title: `Confirm action: Drop traffic for ${ipToDrop}`,
          content: preview,
          onOk: () => dropSession(ipToDrop)
        });
      } else {
        message.warning('Invalid IP to drop');
      }
      break;
    case 'rate-limit-src':
      if (isValidIPv4(srcIp) && dport) {
        Modal.confirm({
          title: `Confirm action: Rate limit ${srcIp}:${dport}/tcp`,
          content: preview,
          onOk: () => fetch(`${SERVER_URL}/api/security/rate-limit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: srcIp, port: dport, protocol: 'tcp', limit: '5/sec', burst: 10, direction: 'in' }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
            notification.success({ message: 'Action submitted', description: `Rate limit applied to ${srcIp}:${dport}/tcp`, placement: 'topRight' });
          }).catch((e) => {
            notification.error({ message: 'Action failed', description: e.message, placement: 'topRight' });
          })
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