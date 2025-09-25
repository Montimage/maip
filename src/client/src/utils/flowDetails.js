// Utilities to extract common flow details (IPs, ports, rates, sessionId)
// from a prediction attack CSV row object.

export function computeFlowDetails(record) {
  if (!record || typeof record !== 'object') return {};
  const keyList = Object.keys(record).filter(k => k !== 'key');
  const findKey = (patterns) => keyList.find(k => patterns.some(p => p.test(k)));

  const srcKey = findKey([
    /src.*ip/i, /source.*ip/i, /^ip[_-]?src$/i, /^src[_-]?ip$/i, /(src|source).*addr/i, /^saddr$/i
  ]);
  const dstKey = findKey([
    /dst.*ip/i, /dest.*ip/i, /destination.*ip/i, /^ip[_-]?dst$/i, /^dst[_-]?ip$/i, /(dst|dest|destination).*addr/i, /^daddr$/i
  ]);
  const combinedIpKey = (!srcKey && !dstKey) ? findKey([/^ip$/i, /ip.*pair/i, /ip.*addr/i, /address/i]) : null;

  const deriveIps = (rec) => {
    if (!combinedIpKey) return { srcIp: null, dstIp: null };
    const text = String(rec[combinedIpKey] || '');
    // Extract IPv4 addresses
    const ipv4s = text.match(/(?:\d{1,3}\.){3}\d{1,3}/g) || [];
    return { srcIp: ipv4s[0] || null, dstIp: ipv4s[1] || null };
  };

  const derived = deriveIps(record);
  const srcIp = srcKey ? record[srcKey] : (derived?.srcIp || null);
  const dstIp = dstKey ? record[dstKey] : (derived?.dstIp || null);
  const sessionId = record['ip.session_id'] || record['session_id'] || null;
  const dport = record['dport_g'] ?? record['dport_le'] ?? record['dport'] ?? null;
  const pktsRate = record['pkts_rate'] ?? null;
  const byteRate = record['byte_rate'] ?? null;

  return { srcIp, dstIp, sessionId, dport, pktsRate, byteRate };
}

// Strict IPv4 validation (each octet 0-255)
export function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every(o => {
    const n = Number(o);
    return n >= 0 && n <= 255 && String(n) === String(Number(o));
  });
}
