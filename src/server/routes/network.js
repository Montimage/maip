const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { REPORT_PATH } = require('../constants');
const { identifyUser } = require('../middleware/userAuth');
const { listFilesByTypeAsync } = require('../utils/file-utils');

// Apply user identification middleware to all routes
router.use(identifyUser);

/**
 * GET /api/network/analysis
 * Get network analysis data from DPI results
 */
router.get('/analysis', async (req, res) => {
  try {
    const { pcap } = req.query;

    if (!pcap) {
      return res.status(400).json({ error: 'PCAP file parameter is required' });
    }

    console.log('[Network API] Analyzing PCAP:', pcap);
    console.log('[Network API] REPORT_PATH:', REPORT_PATH);

    // Find the most recent report directory for this PCAP
    let csvFilePath = null;
    
    // List all report directories
    const reportDirs = fs.readdirSync(REPORT_PATH)
      .filter(item => {
        const fullPath = path.join(REPORT_PATH, item);
        return fs.statSync(fullPath).isDirectory() && item.startsWith('report-');
      })
      .sort((a, b) => {
        // Sort by modification time (newest first)
        const statA = fs.statSync(path.join(REPORT_PATH, a));
        const statB = fs.statSync(path.join(REPORT_PATH, b));
        return statB.mtimeMs - statA.mtimeMs;
      });

    console.log('[Network API] Found report directories:', reportDirs.length);

    // Search for CSV file matching the PCAP name
    for (const dir of reportDirs) {
      const dirPath = path.join(REPORT_PATH, dir);
      const csvFiles = listFilesByTypeAsync(dirPath, '.csv') || [];
      
      // Look for CSV file that contains the PCAP name
      const matchingCsv = csvFiles.find(csv => {
        // CSV format: timestamp_probe_id_filename.csv
        // Extract the original filename from the CSV name
        const parts = csv.split('_');
        if (parts.length >= 3) {
          const originalName = parts.slice(2).join('_').replace('.csv', '');
          return originalName === pcap || originalName === pcap.replace(/\.pcapng?$/, '.pcap');
        }
        return false;
      });

      if (matchingCsv) {
        csvFilePath = path.join(dirPath, matchingCsv);
        console.log('[Network API] Found CSV file:', csvFilePath);
        break;
      }
    }

    if (!csvFilePath || !fs.existsSync(csvFilePath)) {
      console.log('[Network API] CSV file not found for:', pcap);
      return res.status(404).json({ 
        error: 'DPI results not found for this PCAP file. Please run DPI analysis first.',
        pcap: pcap
      });
    }

    // Parse the CSV file to extract network data
    const networkData = await parseNetworkData(csvFilePath);

    res.json(networkData);
  } catch (error) {
    console.error('[Network API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Parse network data from CSV file
 */
async function parseNetworkData(csvFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(csvFilePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }

      const lines = data.split('\n');
      const ipMap = {}; // Track per-IP statistics
      const linkMap = {}; // Track IP pair statistics
      const timestampIPMap = {}; // Map timestamp to IP addresses (for correlation)

      console.log('[Network Parse] Processing', lines.length, 'lines');

      // Parse events
      lines.forEach((line) => {
        if (!line.startsWith('1000,')) return; // Only process event lines

        const parts = line.split(',');
        if (parts.length < 5) return;

        const timestamp = parseFloat(parts[3]);
        const eventType = parts[4].replace(/"/g, '');

        // First, collect IP addresses from IPv4/IPv6 events
        if (eventType === 'ipv4-event' || eventType === 'ipv6-event') {
          // IPv4/IPv6 event format: [5]=session_id, [11]=tot_len, [12]=src, [13]=dst
          const dataVolume = parseInt(parts[11]) || 0;
          const srcIP = parts[12]?.replace(/"/g, '');
          const dstIP = parts[13]?.replace(/"/g, '');

          if (timestamp && srcIP && dstIP) {
            const timestampKey = timestamp.toFixed(6);
            if (!timestampIPMap[timestampKey]) {
              timestampIPMap[timestampKey] = [];
            }
            timestampIPMap[timestampKey].push({ srcIP, dstIP, dataVolume });

            // Track per-IP statistics
            updateIPStats(ipMap, srcIP, 'sent', dataVolume);
            updateIPStats(ipMap, dstIP, 'received', dataVolume);
          }
        }
        // Then, process TCP/UDP events and correlate with IPs
        else if (eventType === 'tcp-event' || eventType === 'udp-event') {
          const srcPort = parseInt(parts[5]);
          const destPort = parseInt(parts[6]);
          const payloadLen = parseInt(parts[7]) || 0;

          // Look up IP addresses by timestamp
          if (timestamp) {
            const timestampKey = timestamp.toFixed(6);
            const ipList = timestampIPMap[timestampKey];

            if (ipList && ipList.length > 0) {
              // Use the first matching IP pair
              const { srcIP, dstIP } = ipList[0];

              if (srcIP && dstIP) {
                // Track IP pair (link) statistics
                updateLinkStats(linkMap, srcIP, dstIP, eventType === 'tcp-event' ? 'TCP' : 'UDP', payloadLen, srcPort, destPort);
              }
            }
          }
        }
      });

      console.log('[Network Parse] Unique IPs:', Object.keys(ipMap).length);
      console.log('[Network Parse] Unique links:', Object.keys(linkMap).length);

      // Convert maps to arrays and sort
      const topUsers = Object.entries(ipMap)
        .map(([ip, stats]) => ({
          ip,
          sent: stats.sent,
          received: stats.received,
          totalPackets: stats.sent.packets + stats.received.packets,
          totalBytes: stats.sent.bytes + stats.received.bytes,
          sessions: stats.sessions,
          location: getIPLocation(ip), // Placeholder for geo-location
        }))
        .sort((a, b) => b.totalBytes - a.totalBytes)
        .slice(0, 50); // Top 50 users

      const topLinks = Object.entries(linkMap)
        .map(([key, stats]) => ({
          srcIP: stats.srcIP,
          dstIP: stats.dstIP,
          protocols: Array.from(stats.protocols),
          flowCount: stats.flowCount,
          forward: stats.forward,
          backward: stats.backward,
          totalBytes: stats.forward.bytes + stats.backward.bytes,
        }))
        .sort((a, b) => b.totalBytes - a.totalBytes)
        .slice(0, 50); // Top 50 links

      // Aggregate geographic data
      const geoLocations = topUsers
        .filter(user => user.location && user.location.country)
        .map(user => ({
          country: user.location.country,
          city: user.location.city,
          packets: user.totalPackets,
          bytes: user.totalBytes,
        }));

      // Generate topology data (nodes and edges)
      const topologyNodes = topUsers.slice(0, 30).map(user => ({
        id: user.ip,
        label: user.ip,
        value: user.totalBytes, // Node size based on traffic
        title: `${user.ip}\nBytes: ${formatBytes(user.totalBytes)}`,
      }));

      const topologyEdges = topLinks.slice(0, 50).map((link, index) => ({
        id: index,
        from: link.srcIP,
        to: link.dstIP,
        value: link.totalBytes, // Edge thickness based on traffic
        title: `${link.srcIP} → ${link.dstIP}\nBytes: ${formatBytes(link.totalBytes)}`,
      }));

      resolve({
        topUsers,
        geoLocations,
        topology: {
          nodes: topologyNodes,
          edges: topologyEdges,
        },
        topLinks,
      });
    });
  });
}

/**
 * Update IP statistics
 */
function updateIPStats(ipMap, ip, direction, bytes) {
  if (!ipMap[ip]) {
    ipMap[ip] = {
      sent: { packets: 0, bytes: 0 },
      received: { packets: 0, bytes: 0 },
      sessions: 0,
    };
  }

  ipMap[ip][direction].packets += 1;
  ipMap[ip][direction].bytes += bytes;
}

/**
 * Update link statistics
 */
function updateLinkStats(linkMap, srcIP, dstIP, protocol, bytes, srcPort, destPort) {
  // Create bidirectional key (always src -> dst)
  const linkKey = `${srcIP}->${dstIP}`;
  const reverseLinkKey = `${dstIP}->${srcIP}`;

  // Check if reverse link exists
  if (linkMap[reverseLinkKey]) {
    // Update backward direction of existing link
    linkMap[reverseLinkKey].backward.packets += 1;
    linkMap[reverseLinkKey].backward.bytes += bytes;
    linkMap[reverseLinkKey].protocols.add(protocol);
    linkMap[reverseLinkKey].flowCount += 1;
  } else {
    // Create new link or update forward direction
    if (!linkMap[linkKey]) {
      linkMap[linkKey] = {
        srcIP,
        dstIP,
        protocols: new Set(),
        flowCount: 0,
        forward: { packets: 0, bytes: 0 },
        backward: { packets: 0, bytes: 0 },
      };
    }

    linkMap[linkKey].forward.packets += 1;
    linkMap[linkKey].forward.bytes += bytes;
    linkMap[linkKey].protocols.add(protocol);
    linkMap[linkKey].flowCount += 1;
  }
}

/**
 * Get IP geolocation (placeholder)
 * In production, use geoip-lite or MaxMind GeoIP2
 */
function getIPLocation(ip) {
  // Check if private IP
  if (isPrivateIP(ip)) {
    return {
      country: 'Local Network',
      city: null,
      latitude: null,
      longitude: null,
    };
  }

  // Placeholder: Return null for now
  // TODO: Implement actual geo-location using geoip-lite
  // const geo = geoip.lookup(ip);
  // return geo ? { country: geo.country, city: geo.city, ... } : null;

  return {
    country: 'Unknown',
    city: null,
    latitude: null,
    longitude: null,
  };
}

/**
 * Check if IP is private
 */
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127 ||
    ip === '::1' ||
    ip.startsWith('fe80:')
  );
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
