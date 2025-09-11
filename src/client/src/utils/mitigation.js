import { Modal, message, notification } from 'antd';
import { SERVER_URL } from '../constants';

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

export async function dropSession(sessionId) {
  if (!sessionId) {
    message.warning('No session id available');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/drop-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Action submitted',
      description: `Session ${sessionId} will be dropped`,
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

export async function addToWatchlist(ipAddress) {
  if (!ipAddress) {
    message.warning('No IP address found');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/security/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: String(ipAddress).trim() }),
    });
    if (!res.ok) throw new Error(await res.text());
    notification.success({
      message: 'Added to watchlist',
      description: `${ipAddress} has been added to the watchlist`,
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

export function openReputation(ipAddress) {
  if (!ipAddress) {
    message.warning('No IP address found');
    return;
  }
  const url = `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ipAddress)}`;
  window.open(url, '_blank', 'noopener');
}

// Mitigation dispatcher
export function handleMitigationAction({ actionKey, srcIp, dstIp, sessionId, dport, pktsRate, byteRate, isValidIPv4 }) {
  switch (actionKey) {
    case 'block-src-ip':
      if (isValidIPv4(srcIp)) {
        Modal.confirm({ title: `Block source IP ${srcIp}?`, onOk: () => blockIp(srcIp) });
      } else {
        message.warning('Source IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-ip':
      if (isValidIPv4(dstIp)) {
        Modal.confirm({ title: `Block destination IP ${dstIp}?`, onOk: () => blockIp(dstIp) });
      } else {
        message.warning('Destination IP missing or not valid IPv4');
      }
      break;
    case 'block-dst-port':
      if (dport) {
        blockPort(dport, 'tcp');
      } else {
        message.warning('No destination port available');
      }
      break;
    case 'block-ip-port-src':
      if (isValidIPv4(srcIp) && dport) {
        blockIpPort(srcIp, dport, 'tcp');
      } else {
        message.warning('Missing source IP or port');
      }
      break;
    case 'block-ip-port-dst':
      if (isValidIPv4(dstIp) && dport) {
        blockIpPort(dstIp, dport, 'tcp');
      } else {
        message.warning('Missing destination IP or port');
      }
      break;
    case 'drop-session':
      if (sessionId) {
        dropSession(sessionId);
      } else {
        message.warning('No session id available');
      }
      break;
    case 'rate-limit-src':
      if (isValidIPv4(srcIp) && (pktsRate || byteRate)) {
        rateLimitIp(srcIp, byteRate, pktsRate);
      } else {
        message.warning('Missing metrics or invalid source IP');
      }
      break;
    case 'add-watchlist-src':
      if (isValidIPv4(srcIp)) {
        addToWatchlist(srcIp);
      } else {
        message.warning('Invalid source IP');
      }
      break;
    case 'reputation-src':
      if (isValidIPv4(srcIp)) {
        openReputation(srcIp);
      } else {
        message.warning('Invalid source IP');
      }
      break;
    default:
      message.info('Action not recognized');
  }
}