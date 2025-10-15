const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { REPORT_PATH, PCAP_PATH } = require('../constants');
const { startMMTOffline, startMMTOnline, stopMMT, getMMTStatus } = require('../mmt/mmt-connector');
const { listFilesByTypeAsync } = require('../utils/file-utils');
const { interfaceExist } = require('../utils/utils');
const { queueFeatureExtraction } = require('../queue/job-queue');
const sessionManager = require('../utils/sessionManager');

// DEPRECATED: Old global state - kept for backward compatibility with online mode
// Offline mode now uses sessionManager
let dpiState = {
  isRunning: false,
  sessionId: null,
  mode: null,
  pcapFile: null,
  interface: null,
  hierarchyData: null,
  trafficData: [],
  lastUpdate: null,
  lastProcessedLine: 0,
  cumulativeProtocols: {},
  cumulativeConversations: {},
  cumulativePacketSizes: [],
  cumulativeStatistics: null,
  viewers: 0,
  startedBy: null,
};

/**
 * Parse protocol hierarchy from mmt-probe CSV output
{{ ... }}
{{ ... }}
 * MMT-Probe format: event-based CSV with lines starting with report type ID
 * - Lines starting with "1000," are event reports (ipv4-event, tcp-event, etc.)
 * Format: 1000,probe_id,source,timestamp,event_type,...attributes
 */
function parseProtocolHierarchy(csvFilePath, startLine = 0, session = null) {
  return new Promise((resolve, reject) => {
    // Determine if this is online mode from session
    const isOnlineMode = session && session.mode === 'online';
    
    // Use session's cumulative data if provided, otherwise start fresh
    const protocols = session && session.cumulativeProtocols ? { ...session.cumulativeProtocols } : {};
    const trafficTimeSeries = [];
    const sessionProtocols = {}; // Track protocol hierarchy per session
    const conversations = session && session.cumulativeConversations ? { ...session.cumulativeConversations } : {};
    const timestampIPMap = {}; // Map timestamp+ports to IP addresses
    const packetSizes = session && session.cumulativePacketSizes ? [...session.cumulativePacketSizes] : [];
    
    fs.readFile(csvFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('[DPI Parse] Error reading file:', err);
        return reject(err);
      }
      
      const lines = data.split('\n');
      console.log('[DPI Parse] Total lines:', lines.length, 'Starting from:', startLine);
      
      let eventCount = 0;
      lines.forEach((line, index) => {
        // In online mode, skip already processed lines
        if (isOnlineMode && index < startLine) {
          return;
        }
        
        if (!line.startsWith('1000,')) {
          return; // Skip non-event lines
        }
        eventCount++;
        
        const parts = line.split(',');
        if (parts.length < 5) {
          return;
        }
        
        const timestamp = parseFloat(parts[3]);
        const eventType = parts[4].replace(/"/g, ''); // Remove quotes
        
        // Extract protocol and data based on event type
        let protocol = null;
        let dataVolume = 0;
        let sessionId = null;
        
        if (eventType === 'ipv4-event' || eventType === 'ipv6-event') {
          // IPv4/IPv6 event format: session_id, direction, last_packet_direction, first_time, last_time, header_len, tot_len, src, dst
          // Fields: [0-4]=header, [5]=session_id, [6]=direction, [7]=last_packet_direction, [8]=first_time, [9]=last_time, [10]=header_len, [11]=tot_len, [12]=src, [13]=dst
          protocol = eventType === 'ipv4-event' ? 'IPv4' : 'IPv6';
          sessionId = parts[5];
          dataVolume = parseInt(parts[11]) || 0; // tot_len is at index 11
          const srcIP = parts[12];
          const dstIP = parts[13];
          
          // Track packet size
          if (dataVolume > 0) {
            packetSizes.push(dataVolume);
          }
          
          // Initialize session protocol stack
          if (!sessionProtocols[sessionId]) {
            sessionProtocols[sessionId] = ['ETHERNET', protocol];
          }
          
          // Store IP addresses by timestamp for correlation with TCP/UDP events
          if (timestamp && srcIP && dstIP) {
            const timestampKey = timestamp.toFixed(6); // Use microsecond precision
            if (!timestampIPMap[timestampKey]) {
              timestampIPMap[timestampKey] = [];
            }
            timestampIPMap[timestampKey].push({
              srcIP: srcIP.replace(/"/g, ''),
              dstIP: dstIP.replace(/"/g, ''),
            });
          }
        } else if (eventType === 'tcp-event') {
          // TCP event format: src_port, dest_port, payload_len, fin, syn, rst, psh, ack, urg, payload_up, payload_down, session_id, direction
          // Fields: [0-4]=header, [5]=src_port, [6]=dest_port, [7]=payload_len, ..., [16]=ip.session_id, [17]=direction
          protocol = 'TCP';
          const srcPort = parseInt(parts[5]);
          const destPort = parseInt(parts[6]);
          dataVolume = parseInt(parts[7]) || 0; // payload_len
          sessionId = parts[16]; // ip.session_id is at index 16
          
          // Track packet size (payload only for TCP/UDP)
          if (dataVolume > 0) {
            packetSizes.push(dataVolume);
          }
          
          // Initialize session if it doesn't exist (TCP without prior IP event)
          if (sessionId && !sessionProtocols[sessionId]) {
            sessionProtocols[sessionId] = ['ETHERNET', 'IPv4'];
          }
          
          // Look up IP addresses by timestamp
          if (timestamp) {
            const timestampKey = timestamp.toFixed(6);
            const ipList = timestampIPMap[timestampKey];
            
            if (ipList && ipList.length > 0) {
              // Match based on typical client-server pattern (high port = client, low port = server)
              let clientIP = null, serverIP = null, clientPort = null, serverPort = null;
              
              // Determine which is client (ephemeral port) vs server (well-known port)
              if (srcPort > 1024 && destPort <= 1024) {
                // srcPort is client, destPort is server
                clientPort = srcPort;
                serverPort = destPort;
                // Find matching IPs
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.srcIP;
                  serverIP = ipInfo.dstIP;
                  break;
                }
              } else if (destPort > 1024 && srcPort <= 1024) {
                // destPort is client, srcPort is server (reversed)
                clientPort = destPort;
                serverPort = srcPort;
                // IPs are reversed
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.dstIP;
                  serverIP = ipInfo.srcIP;
                  break;
                }
              } else {
                // Can't determine, use as-is
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.srcIP;
                  serverIP = ipInfo.dstIP;
                  clientPort = srcPort;
                  serverPort = destPort;
                  break;
                }
              }
              
              if (clientIP && serverIP) {
                // Always use client -> server direction for consistency
                const convKey = `${clientIP}:${clientPort}-${serverIP}:${serverPort}`;
                
                if (!conversations[convKey]) {
                  conversations[convKey] = {
                    srcIP: clientIP,
                    dstIP: serverIP,
                    srcPort: clientPort,
                    dstPort: serverPort,
                    protocol: 'TCP',
                    packets: 0,
                    bytes: 0,
                  };
                }
                conversations[convKey].packets += 1;
                conversations[convKey].bytes += dataVolume;
              }
            }
          }
          
          // Determine application protocol based on port
          const appProtocol = identifyApplicationProtocol(srcPort, destPort);
          
          if (sessionId && sessionProtocols[sessionId]) {
            // Only add TCP if not already in stack
            if (!sessionProtocols[sessionId].includes(protocol)) {
              sessionProtocols[sessionId].push(protocol);
            }
            if (appProtocol && !sessionProtocols[sessionId].includes(appProtocol)) {
              sessionProtocols[sessionId].push(appProtocol);
            }
          }
        } else if (eventType === 'udp-event') {
          // UDP event format: similar to TCP
          // Fields: [0-4]=header, [5]=src_port, [6]=dest_port, [7]=payload_len, ..., [16]=ip.session_id
          protocol = 'UDP';
          const srcPort = parseInt(parts[5]);
          const destPort = parseInt(parts[6]);
          dataVolume = parseInt(parts[7]) || 0;
          sessionId = parts[16]; // ip.session_id
          
          // Track packet size (payload only for TCP/UDP)
          if (dataVolume > 0) {
            packetSizes.push(dataVolume);
          }
          
          // Initialize session if it doesn't exist
          if (sessionId && !sessionProtocols[sessionId]) {
            sessionProtocols[sessionId] = ['ETHERNET', 'IPv4'];
          }
          
          // Look up IP addresses by timestamp
          if (timestamp) {
            const timestampKey = timestamp.toFixed(6);
            const ipList = timestampIPMap[timestampKey];
            
            if (ipList && ipList.length > 0) {
              // Match based on typical client-server pattern
              let clientIP = null, serverIP = null, clientPort = null, serverPort = null;
              
              // Determine which is client (ephemeral port) vs server (well-known port)
              if (srcPort > 1024 && destPort <= 1024) {
                clientPort = srcPort;
                serverPort = destPort;
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.srcIP;
                  serverIP = ipInfo.dstIP;
                  break;
                }
              } else if (destPort > 1024 && srcPort <= 1024) {
                clientPort = destPort;
                serverPort = srcPort;
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.dstIP;
                  serverIP = ipInfo.srcIP;
                  break;
                }
              } else {
                for (const ipInfo of ipList) {
                  clientIP = ipInfo.srcIP;
                  serverIP = ipInfo.dstIP;
                  clientPort = srcPort;
                  serverPort = destPort;
                  break;
                }
              }
              
              if (clientIP && serverIP) {
                const convKey = `${clientIP}:${clientPort}-${serverIP}:${serverPort}`;
                
                if (!conversations[convKey]) {
                  conversations[convKey] = {
                    srcIP: clientIP,
                    dstIP: serverIP,
                    srcPort: clientPort,
                    dstPort: serverPort,
                    protocol: 'UDP',
                    packets: 0,
                    bytes: 0,
                  };
                }
                conversations[convKey].packets += 1;
                conversations[convKey].bytes += dataVolume;
              }
            }
          }
          
          // Determine application protocol based on port
          const appProtocol = identifyApplicationProtocol(srcPort, destPort);
          
          if (sessionId && sessionProtocols[sessionId]) {
            if (!sessionProtocols[sessionId].includes(protocol)) {
              sessionProtocols[sessionId].push(protocol);
            }
            if (appProtocol && !sessionProtocols[sessionId].includes(appProtocol)) {
              sessionProtocols[sessionId].push(appProtocol);
            }
          }
        } else if (eventType === 'tls-event') {
          // TLS event format: tls_content_type, tls_length, ssl_handshake_type, ip.session_id, meta.direction
          // Fields: [0-4]=header, [5]=content_type, [6]=length, [7]=handshake_type, [8]=session_id, [9]=direction
          protocol = 'TLS/SSL';
          sessionId = parts[8]; // ip.session_id is at index 8
          
          if (sessionId && sessionProtocols[sessionId]) {
            if (!sessionProtocols[sessionId].includes(protocol)) {
              sessionProtocols[sessionId].push(protocol);
            }
          }
        }
        
        // Build protocol hierarchy
        if (sessionId && sessionProtocols[sessionId]) {
          const protoStack = sessionProtocols[sessionId];
          
          protoStack.forEach((proto, index) => {
            if (!protocols[proto]) {
              protocols[proto] = {
                name: proto,
                packets: 0,
                dataVolume: 0,
                parent: index > 0 ? protoStack[index - 1] : null,
              };
            }
            protocols[proto].packets += 1;
            protocols[proto].dataVolume += dataVolume;
          });
          
          // Store time series data
          if (timestamp && !isNaN(timestamp)) {
            trafficTimeSeries.push({
              timestamp,
              protocol: protoStack.join('/'),
              dataVolume,
              packetCount: 1,
            });
          }
        }
      });
      
      console.log('[DPI Parse] Processed', eventCount, 'events');
      console.log('[DPI Parse] Unique protocols:', Object.keys(protocols).length);
      console.log('[DPI Parse] Protocol names:', Object.keys(protocols).join(', '));
      console.log('[DPI Parse] Traffic time series entries:', trafficTimeSeries.length);
      console.log('[DPI Parse] Conversations tracked:', Object.keys(conversations).length);
      
      // Debug: Show conversation details
      const convsWithIPs = Object.values(conversations).filter(c => c.srcIP && c.dstIP).length;
      console.log('[DPI Parse] Conversations with complete IPs:', convsWithIPs);
      console.log('[DPI Parse] Timestamp IP Map size:', Object.keys(timestampIPMap).length);
      
      const debugConvs = Object.entries(conversations).slice(0, 5);
      console.log('[DPI Parse] Debug - Sample conversations:');
      debugConvs.forEach(([convKey, conv]) => {
        console.log(`  ${conv.srcIP}:${conv.srcPort} -> ${conv.dstIP}:${conv.dstPort} [${conv.protocol}] ${conv.packets} pkts, ${conv.bytes} bytes`);
      });
      
      // Build hierarchy tree structure
      const hierarchy = buildHierarchyTree(protocols);
      console.log('[DPI Parse] Built hierarchy with', hierarchy.length, 'root nodes');
      
      // Update cumulative data in session (for both online and offline modes)
      if (session) {
        session.cumulativeProtocols = protocols;
        session.cumulativeConversations = conversations;
        session.cumulativePacketSizes = packetSizes;
        console.log('[DPI Parse] Updated session cumulative state - packet sizes:', packetSizes.length);
      }
      
      // Convert conversations to array and sort by bytes
      const conversationArray = Object.values(conversations)
        .filter(c => c.packets > 0) // Include all conversations with packets
        .sort((a, b) => b.bytes - a.bytes);
      
      console.log('[DPI Parse] Total conversations:', conversationArray.length);
      console.log('[DPI Parse] Sample conversations:', conversationArray.slice(0, 3).map(c => 
        `${c.srcIP}:${c.srcPort} -> ${c.dstIP}:${c.dstPort} [${c.protocol}] ${c.packets} pkts, ${c.bytes} bytes`
      ));
      
      resolve({ 
        hierarchy, 
        trafficTimeSeries, 
        conversations: conversationArray,
        packetSizes,
        totalLines: lines.length,
        processedEvents: eventCount 
      });
    });
  });
}

/**
 * Identify application protocol based on port numbers
 */
function identifyApplicationProtocol(srcPort, destPort) {
  const wellKnownPorts = {
    20: 'FTP-DATA',
    21: 'FTP',
    22: 'SSH',
    23: 'TELNET',
    25: 'SMTP',
    53: 'DNS',
    67: 'DHCP',
    68: 'DHCP',
    69: 'TFTP',
    80: 'HTTP',
    110: 'POP3',
    123: 'NTP',
    143: 'IMAP',
    161: 'SNMP',
    162: 'SNMP',
    389: 'LDAP',
    443: 'HTTPS',
    445: 'SMB',
    465: 'SMTPS',
    514: 'SYSLOG',
    587: 'SMTP',
    636: 'LDAPS',
    993: 'IMAPS',
    995: 'POP3S',
    1433: 'MSSQL',
    1521: 'ORACLE',
    3306: 'MYSQL',
    3389: 'RDP',
    5432: 'POSTGRESQL',
    5900: 'VNC',
    6379: 'REDIS',
    8080: 'HTTP-ALT',
    8443: 'HTTPS-ALT',
    9200: 'ELASTICSEARCH',
    27017: 'MONGODB',
  };
  
  return wellKnownPorts[destPort] || wellKnownPorts[srcPort] || null;
}

/**
 * Build a tree structure from flat protocol data
 */
function buildHierarchyTree(protocols) {
  const tree = [];
  const protocolMap = {};
  
  // Create nodes
  Object.keys(protocols).forEach(protoName => {
    const proto = protocols[protoName];
    protocolMap[protoName] = {
      name: protoName,
      packets: proto.packets,
      dataVolume: proto.dataVolume,
      children: [],
    };
  });
  
  // Build parent-child relationships
  Object.keys(protocols).forEach(protoName => {
    const proto = protocols[protoName];
    if (proto.parent && protocolMap[proto.parent]) {
      protocolMap[proto.parent].children.push(protocolMap[protoName]);
    } else {
      tree.push(protocolMap[protoName]);
    }
  });
  
  return tree;
}

/**
 * Calculate traffic statistics from hierarchy and time series data
 * For online mode, use cumulative values from all processed data
 */
function calculateTrafficStatistics(hierarchy, trafficTimeSeries, isOnlineMode = false) {
  const stats = {
    totalPackets: 0,
    totalBytes: 0,
    avgPacketSize: 0,
    duration: 0,
    packetsPerSecond: 0,
    bitsPerSecond: 0,
    bytesPerSecond: 0,
    distinctProtocols: 0,
    startTime: null,
    endTime: null,
  };
  
  // Calculate totals from hierarchy (top-level only to avoid double counting)
  // In online mode, the hierarchy already contains accumulated values
  if (hierarchy && hierarchy.length > 0) {
    console.log('[DPI Stats] Calculating from hierarchy, top-level count:', hierarchy.length);
    hierarchy.forEach(proto => {
      console.log(`[DPI Stats] Adding protocol ${proto.name}: ${proto.packets} packets, ${proto.dataVolume} bytes`);
      stats.totalPackets += proto.packets || 0;
      stats.totalBytes += proto.dataVolume || 0;
    });
    console.log(`[DPI Stats] Total after summing: ${stats.totalPackets} packets, ${stats.totalBytes} bytes`);
  }
  
  // Calculate duration from traffic time series
  // For online mode, we need to consider all accumulated traffic data
  if (trafficTimeSeries && trafficTimeSeries.length > 0) {
    const timestamps = trafficTimeSeries.map(t => t.timestamp).filter(t => t && !isNaN(t));
    if (timestamps.length > 0) {
      const currentStartTime = Math.min(...timestamps);
      const currentEndTime = Math.max(...timestamps);
      
      if (isOnlineMode && dpiState.cumulativeStatistics) {
        // Keep the earliest start time and latest end time
        stats.startTime = Math.min(dpiState.cumulativeStatistics.startTime || currentStartTime, currentStartTime);
        stats.endTime = Math.max(dpiState.cumulativeStatistics.endTime || currentEndTime, currentEndTime);
      } else {
        // For offline mode or first online capture
        stats.startTime = currentStartTime;
        stats.endTime = currentEndTime;
      }
    }
  } else if (isOnlineMode && dpiState.cumulativeStatistics) {
    // No new data but we have previous stats
    stats.startTime = dpiState.cumulativeStatistics.startTime;
    stats.endTime = dpiState.cumulativeStatistics.endTime;
  }
  
  // Calculate duration based on mode and available data
  if (isOnlineMode) {
    // For online mode, calculate duration only when we have NEW data (endTime present)
    // This keeps duration stable between batch updates
    if (stats.endTime && stats.startTime) {
      // We have new data - calculate duration from packet timestamps
      stats.duration = stats.endTime - stats.startTime;
      console.log(`[DPI Stats] Online mode - Updated duration: ${stats.duration.toFixed(2)}s (from packet timestamps)`);
    } else if (dpiState.cumulativeStatistics) {
      // No new data - reuse ALL previous timing stats
      if (dpiState.cumulativeStatistics.duration) {
        stats.duration = dpiState.cumulativeStatistics.duration;
      }
      if (dpiState.cumulativeStatistics.startTime) {
        stats.startTime = dpiState.cumulativeStatistics.startTime;
      }
      if (dpiState.cumulativeStatistics.endTime) {
        stats.endTime = dpiState.cumulativeStatistics.endTime;
      }
      console.log(`[DPI Stats] Online mode - Keeping previous duration: ${stats.duration}s (no new traffic data)`);
    } else {
      console.log(`[DPI Stats] Online mode - No timestamps available yet (first request)`);
    }
  } else {
    // For offline mode, use timestamp span from packets
    if (stats.startTime && stats.endTime) {
      stats.duration = stats.endTime - stats.startTime;
      console.log(`[DPI Stats] Offline mode - Duration: ${stats.duration.toFixed(2)}s (from packet timestamps)`);
    } else {
      console.log(`[DPI Stats] Offline mode - No timestamps available`);
    }
  }
  
  // Calculate derived metrics
  if (stats.totalPackets > 0) {
    stats.avgPacketSize = stats.totalBytes / stats.totalPackets;
  }
  
  // For rate calculations, use minimum duration of 1 second if duration is 0 or very small
  // This happens when all packets have the same timestamp or are within milliseconds
  const durationForRates = stats.duration > 0 ? stats.duration : 1;
  if (stats.totalPackets > 0) {
    stats.packetsPerSecond = stats.totalPackets / durationForRates;
    stats.bytesPerSecond = stats.totalBytes / durationForRates;
    stats.bitsPerSecond = (stats.totalBytes * 8) / durationForRates;
  }
  
  // Count distinct protocols (recursively)
  const countProtocols = (nodes) => {
    let count = 0;
    nodes.forEach(node => {
      count += 1;
      if (node.children && node.children.length > 0) {
        count += countProtocols(node.children);
      }
    });
    return count;
  };
  stats.distinctProtocols = hierarchy ? countProtocols(hierarchy) : 0;
  
  return stats;
}

/**
 * Aggregate traffic data by time windows (1 second by default for better granularity)
 * For online mode, use current time; for offline mode, use relative timestamps from first packet
 */
function aggregateTrafficData(trafficTimeSeries, windowSize = 1, isOnlineMode = false, csvTimestamp = null) {
  if (!trafficTimeSeries || trafficTimeSeries.length === 0) {
    return [];
  }
  
  console.log('[DPI Aggregate] Input entries:', trafficTimeSeries.length);
  console.log('[DPI Aggregate] Sample timestamps:', 
    trafficTimeSeries.slice(0, 5).map(e => e.timestamp));
  console.log('[DPI Aggregate] Mode:', isOnlineMode ? 'online' : 'offline');
  console.log('[DPI Aggregate] CSV timestamp:', csvTimestamp);
  
  const aggregated = {};
  
  // Get the first packet timestamp as reference
  const firstPacketTime = trafficTimeSeries[0].timestamp;
  
  // For online mode: use current request time to ensure timestamps don't go into the future
  // For offline mode: use actual PCAP timestamps
  const currentTime = Math.floor(Date.now() / 1000);
  const baseTime = isOnlineMode ? currentTime : Math.floor(Date.now() / 1000);
  
  // Log first few entries for debugging
  if (trafficTimeSeries.length > 0) {
    console.log('[DPI Aggregate] First packet timestamp:', firstPacketTime);
    console.log('[DPI Aggregate] Base time:', baseTime, new Date(baseTime * 1000).toISOString());
    console.log('[DPI Aggregate] Current time:', currentTime, new Date(currentTime * 1000).toISOString());
  }
  
  trafficTimeSeries.forEach((entry, index) => {
    let timeWindow;
    
    if (isOnlineMode) {
      // For online mode: use current request time as base
      // Map packet timestamps relative to now, ensuring we don't create future timestamps
      const relativeTime = baseTime - (trafficTimeSeries[trafficTimeSeries.length - 1].timestamp - entry.timestamp);
      timeWindow = Math.floor(relativeTime / windowSize) * windowSize;
      
      // Cap at current time to prevent future timestamps
      if (timeWindow > currentTime) {
        timeWindow = Math.floor(currentTime / windowSize) * windowSize;
      }
      
      if (index < 3) {
        console.log(`[DPI Aggregate] Entry ${index}: packet=${entry.timestamp}, relativeTime=${relativeTime}, window=${timeWindow}, date=${new Date(timeWindow * 1000).toISOString()}`);
      }
    } else {
      // For offline mode: use actual PCAP timestamps (preserve original capture time)
      // This shows when the traffic was actually captured, not current time
      timeWindow = Math.floor(entry.timestamp / windowSize) * windowSize;
      
      if (index < 3) {
        console.log(`[DPI Aggregate] Entry ${index}: packet=${entry.timestamp}, window=${timeWindow}, date=${new Date(timeWindow * 1000).toISOString()}`);
      }
    }
    
    const key = `${timeWindow}_${entry.protocol}`;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        time: timeWindow,
        timestamp: timeWindow,
        protocol: entry.protocol,
        dataVolume: 0,
        packetCount: 0,
      };
    }
    
    aggregated[key].dataVolume += entry.dataVolume;
    aggregated[key].packetCount += entry.packetCount;
  });
  
  // Get all unique protocols
  const allProtocols = new Set();
  Object.values(aggregated).forEach(entry => {
    allProtocols.add(entry.protocol);
  });
  
  // Create continuous timeline: fill ALL time windows from first to last packet
  // This eliminates white gaps in the chart
  const times = Object.values(aggregated).map(e => e.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`[DPI Aggregate] Creating continuous timeline from ${new Date(minTime * 1000).toISOString()} to ${new Date(maxTime * 1000).toISOString()}`);
  
  const filledData = {};
  // Generate all time windows between min and max
  for (let timeWindow = minTime; timeWindow <= maxTime; timeWindow += windowSize) {
    allProtocols.forEach(protocol => {
      const key = `${timeWindow}_${protocol}`;
      if (aggregated[key]) {
        filledData[key] = aggregated[key];
      } else {
        // Create zero-value entry for missing time window
        filledData[key] = {
          time: timeWindow,
          timestamp: timeWindow,
          protocol: protocol,
          dataVolume: 0,
          packetCount: 0,
        };
      }
    });
  }
  
  // Sort by time
  const result = Object.values(filledData);
  result.sort((a, b) => a.time - b.time || a.protocol.localeCompare(b.protocol));
  
  console.log('[DPI Aggregate] Output entries:', result.length);
  const numTimeWindows = Math.floor((maxTime - minTime) / windowSize) + 1;
  console.log('[DPI Aggregate] Time windows:', numTimeWindows, 'Protocols:', allProtocols.size);
  if (result.length > 0) {
    const startTime = new Date(result[0].time * 1000);
    const endTime = new Date(result[result.length-1].time * 1000);
    console.log('[DPI Aggregate] Time range:', 
      `${startTime.toISOString()} to ${endTime.toISOString()}`);
    console.log('[DPI Aggregate] Sample data points:');
    result.slice(0, Math.min(5, result.length)).forEach((entry, idx) => {
      const entryTime = new Date(entry.time * 1000);
      console.log(`  [${idx}] ${entryTime.toISOString()} - ${entry.protocol}: ${entry.packetCount} packets, ${entry.dataVolume} bytes`);
    });
  }
  
  return result;
}

// GET /api/dpi/status - Get current DPI analysis status
router.get('/status', (req, res) => {
  const mmtStatus = getMMTStatus();
  
  res.json({
    ...dpiState,
    mmtRunning: mmtStatus.isRunning,
  });
});

// POST /api/dpi/start/offline - Start DPI analysis on a PCAP file
router.post('/start/offline', async (req, res) => {
  try {
    const { pcapFile, useQueue } = req.body;
    
    if (!pcapFile) {
      return res.status(400).json({ error: 'Missing pcapFile parameter' });
    }
    
    const inputPcap = path.join(PCAP_PATH, pcapFile);
    if (!fs.existsSync(inputPcap)) {
      return res.status(404).json({ error: `PCAP file not found: ${pcapFile}` });
    }
    
    // Queue-based approach is ENABLED BY DEFAULT for better performance with 30+ users
    // Can be disabled via: USE_QUEUE_BY_DEFAULT=false in .env or useQueue:false in request
    const useQueueDefault = process.env.USE_QUEUE_BY_DEFAULT !== 'false'; // Default: true
    const shouldUseQueue = useQueue !== undefined ? useQueue : useQueueDefault;
    
    if (shouldUseQueue) {
      console.log('[DPI] Using queue-based processing for:', pcapFile);
      
      const sessionId = `dpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Queue the DPI job (reuse feature extraction queue for now)
      const result = await queueFeatureExtraction({
        pcapFile,
        sessionId,
        isMalicious: null,
        priority: 5,
        jobType: 'dpi' // Mark as DPI job
      });
      
      const jobId = result.jobId;
      console.log('[DPI] Job queued:', jobId, 'Session:', sessionId);
      
      // Create session in session manager
      sessionManager.createSession('dpi', sessionId, 'offline', {
        pcapFile,
        interface: null,
        hierarchyData: null,
        trafficData: [],
        queued: true,
        jobId: jobId
      });
      
      // Return immediately with session ID (non-blocking)
      return res.json({ 
        success: true, 
        sessionId: sessionId,
        queued: true,
        jobId: jobId,
        message: 'DPI analysis queued. Use /api/dpi/data?sessionId=' + sessionId + ' to get results when ready.'
      });
    }
    
    // OLD: Direct processing (blocking) - only if useQueue=false
    console.log('[DPI] Using direct processing (blocking) for:', pcapFile);
    startMMTOffline(pcapFile, async (status) => {
      if (status.error) {
        return res.status(500).json({ error: status.error });
      }
      
      // Create session in session manager
      sessionManager.createSession('dpi', status.sessionId, 'offline', {
        pcapFile,
        interface: null,
        hierarchyData: null,
        trafficData: [],
      });
      
      res.json({ success: true, sessionId: status.sessionId });
    });
  } catch (error) {
    console.error('[DPI] Error starting offline analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/dpi/start/online - Start DPI analysis on a network interface
router.post('/start/online', async (req, res) => {
  try {
    const { interface: netInterface } = req.body;
    
    if (!netInterface) {
      return res.status(400).json({ error: 'Missing interface parameter' });
    }
    
    if (!interfaceExist(netInterface)) {
      return res.status(404).json({ error: `Network interface not found: ${netInterface}` });
    }
    
    // Check if online DPI is already running (only one session allowed)
    if (dpiState.isRunning && dpiState.mode === 'online') {
      return res.status(409).json({ 
        error: 'Online DPI session already running',
        message: 'Online DPI is already running. You can view the live data, but cannot start a new session.',
        currentSession: dpiState.sessionId,
        startedBy: dpiState.startedBy,
        viewers: dpiState.viewers,
        hint: 'Use GET /api/dpi/data to view live capture data'
      });
    }
    
    // Start MMT online analysis
    startMMTOnline(netInterface, async (status) => {
      if (status.error) {
        return res.status(500).json({ error: status.error });
      }
      
      dpiState = {
        isRunning: true,
        sessionId: status.sessionId,
        mode: 'online',
        pcapFile: null,
        interface: netInterface,
        hierarchyData: null,
        trafficData: [],
        lastUpdate: new Date().toISOString(),
        lastProcessedLine: 0,
        cumulativeProtocols: {},
        cumulativeConversations: {},
        cumulativePacketSizes: [],
        cumulativeStatistics: null,
        viewers: 1,
        startedBy: req.ip || 'unknown',
      };
      
      // Create session in session manager (for online mode)
      sessionManager.createSession('dpi', status.sessionId, 'online', {
        interface: netInterface,
        pcapFile: null,
        hierarchyData: null,
        trafficData: [],
        viewers: 1,
        startedBy: req.ip || 'unknown',
      });
      
      res.json({ 
        success: true, 
        sessionId: status.sessionId,
        message: 'Online DPI started',
      });
    });
  } catch (error) {
    console.error('[DPI] Error starting online analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/dpi/stop - Stop the running DPI analysis
router.post('/stop', async (req, res) => {
  try {
    console.log('[DPI] Stop request received');
    console.log('[DPI] Stopping analysis...');
    
    stopMMT((status) => {
      if (status) {
        console.log('[DPI] Analysis stopped successfully');
        
        // Update session manager
        if (dpiState.sessionId) {
          sessionManager.updateSession('dpi', dpiState.sessionId, {
            isRunning: false
          });
        }
        
        dpiState.isRunning = false;
        res.json({ success: true, message: 'DPI analysis stopped' });
      } else {
        console.log('[DPI] No analysis was running');
        res.json({ success: true, message: 'No analysis was running' });
      }
    });
  } catch (error) {
    console.error('[DPI] Error stopping analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dpi/data - Get protocol hierarchy and traffic data
// Supports both session-based (offline) and global (online) modes
router.get('/data', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    // Get MMT status to check if analysis is still running
    const mmtStatus = getMMTStatus();
    
    // Determine which session to use
    let session;
    if (sessionId) {
      // Explicit sessionId provided - use session manager (offline mode)
      session = sessionManager.getSession('dpi', sessionId);
      if (!session) {
        console.log('[DPI] Session not found:', sessionId);
        return res.status(404).json({ 
          error: 'Session not found',
          message: `DPI session ${sessionId} not found. It may have expired or been deleted.`
        });
      }
      console.log('[DPI] Using session from session manager:', sessionId);
    } else {
      // No sessionId - check for online session (backward compatibility)
      const onlineSession = sessionManager.getOnlineSession('dpi');
      if (onlineSession) {
        session = onlineSession;
        console.log('[DPI] Using online session:', session.sessionId);
      } else if (dpiState.sessionId && dpiState.mode === 'online') {
        // Fallback to old global state for online mode
        session = dpiState;
        console.log('[DPI] Using legacy online session from dpiState:', dpiState.sessionId);
      } else {
        console.log('[DPI] No active session');
        return res.status(404).json({ 
          error: 'No DPI session active',
          message: 'No DPI analysis is currently running. Start one first, or provide sessionId parameter.'
        });
      }
    }
    
    // Increment viewer count for online sessions
    if (session.mode === 'online') {
      session.viewers = Math.max(session.viewers || 1, 1);
    }
    
    const outputDir = path.join(REPORT_PATH, `report-${session.sessionId}`);
    console.log('[DPI] Looking for data in:', outputDir, 'for session:', session.sessionId);
    
    if (!fs.existsSync(outputDir)) {
      console.log('[DPI] Output directory not found:', outputDir);
      return res.status(404).json({ error: 'Output directory not found' });
    }
    
    // Find the CSV file generated by mmt-probe
    const csvFiles = listFilesByTypeAsync(outputDir, '.csv') || [];
    console.log('[DPI] Found CSV files:', csvFiles);
    
    if (csvFiles.length === 0) {
      console.log('[DPI] No CSV files found yet');
      return res.status(404).json({ error: 'No CSV data available yet' });
    }
    
    // For online mode, use the most recent CSV file (sample files are timestamped)
    // For offline mode, use the main report file
    let csvFile;
    if (session.mode === 'online') {
      // Sort by modification time and get files with content
      const filesWithStats = csvFiles.map(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        return { file, mtime: stats.mtime, size: stats.size };
      });
      
      // Sort by modification time (newest first)
      filesWithStats.sort((a, b) => b.mtime - a.mtime);
      
      console.log('[DPI] Files sorted by time:', filesWithStats.map(f => 
        `${f.file} (${f.size} bytes)`).join(', '));
      
      // Find the most recent completed file (has content and is not the very latest)
      // The very latest file might still be being written to
      let selectedFile = null;
      
      // If we have multiple files, skip the newest and use the second newest with content
      if (filesWithStats.length > 1) {
        for (let i = 1; i < filesWithStats.length; i++) {
          if (filesWithStats[i].size > 0) {
            selectedFile = filesWithStats[i];
            break;
          }
        }
      }
      
      // If only one file or no second file with content, use the newest
      if (!selectedFile && filesWithStats.length > 0 && filesWithStats[0].size > 0) {
        selectedFile = filesWithStats[0];
      }
      
      if (!selectedFile) {
        console.log('[DPI] No files with content found');
        return res.status(404).json({ error: 'CSV files are empty, waiting for data...' });
      }
      
      csvFile = selectedFile.file;
      console.log('[DPI] Selected file for online mode:', csvFile, `(${selectedFile.size} bytes)`);
    } else {
      // For offline mode, prefer the main report file
      csvFile = csvFiles.find(f => !f.startsWith('security-reports')) || csvFiles[0];
      console.log('[DPI] Using file for offline mode:', csvFile);
    }
    
    const csvPath = path.join(outputDir, csvFile);
    
    // Check if file has content
    const stats = fs.statSync(csvPath);
    if (stats.size === 0) {
      console.log('[DPI] CSV file is empty:', csvFile);
      return res.status(404).json({ error: 'CSV file is empty, waiting for data...' });
    }
    
    console.log('[DPI] Parsing CSV file:', csvFile, 'Size:', stats.size, 'bytes');
    
    // Extract timestamp from CSV filename (format: timestamp_probe_id_filename.csv)
    // Example: 1760022937.621963_0_gmail.pcap.csv
    let csvTimestamp = null;
    const timestampMatch = csvFile.match(/^(\d+\.\d+)_/);
    if (timestampMatch) {
      csvTimestamp = parseFloat(timestampMatch[1]);
      console.log('[DPI] CSV file timestamp:', csvTimestamp, new Date(csvTimestamp * 1000).toISOString());
    }
    
    // Parse protocol hierarchy and traffic data
    // In online mode, only parse new lines since last request
    const isOnlineMode = session.mode === 'online';
    const startLine = isOnlineMode ? session.lastProcessedLine : 0;
    const { hierarchy, trafficTimeSeries, conversations, packetSizes, totalLines, processedEvents } = await parseProtocolHierarchy(csvPath, startLine, session);
    console.log('[DPI] Parsed hierarchy:', hierarchy ? hierarchy.length : 0, 'root nodes');
    console.log('[DPI] Traffic time series entries:', trafficTimeSeries.length);
    console.log('[DPI] Top conversations:', conversations.length);
    console.log('[DPI] Processed events:', processedEvents, '(new lines from', startLine, 'to', totalLines, ')');
    
    // Update last processed line for online mode
    if (isOnlineMode) {
      session.lastProcessedLine = totalLines;
      // Also update in session manager if it's a managed session
      if (sessionId) {
        sessionManager.updateSession('dpi', sessionId, { lastProcessedLine: totalLines });
      }
    }
    
    // Determine appropriate window size based on mode and traffic duration
    let windowSize = 5; // default 5 seconds
    
    if (trafficTimeSeries.length > 0) {
      const firstTime = trafficTimeSeries[0].timestamp;
      const lastTime = trafficTimeSeries[trafficTimeSeries.length - 1].timestamp;
      const duration = lastTime - firstTime;
      
      // Use only two window sizes for consistency:
      // - 100ms for very short captures (< 2 seconds)
      // - 5 seconds for all other captures (both online and offline)
      if (duration < 2) {
        windowSize = 0.1; // 100ms for sub-2-second captures - shows milliseconds
        console.log('[DPI] Short capture - duration:', duration.toFixed(3), 'seconds, using window size:', windowSize, 'seconds (100ms)');
      } else {
        windowSize = 5; // 5 seconds for all normal captures
        console.log('[DPI] Normal capture - duration:', duration.toFixed(2), 'seconds, using window size:', windowSize, 'seconds');
      }
    } else {
      console.log('[DPI] Using default window size:', windowSize, 'seconds');
    }
    
    const aggregatedTraffic = aggregateTrafficData(trafficTimeSeries, windowSize, isOnlineMode, csvTimestamp);
    console.log('[DPI] Aggregated traffic entries:', aggregatedTraffic.length);
    
    // Calculate statistics
    const statistics = calculateTrafficStatistics(hierarchy, trafficTimeSeries, isOnlineMode);
    console.log('[DPI] Statistics:', statistics);
    console.log('[DPI] Hierarchy top-level protocols:', hierarchy.map(p => `${p.name}: ${p.packets} packets, ${p.dataVolume} bytes`));
    
    // Store cumulative statistics
    if (isOnlineMode) {
      session.cumulativeStatistics = statistics;
      dpiState.cumulativeStatistics = statistics; // Also update global state for duration preservation
    }
    
    // Update session with latest data
    session.hierarchyData = hierarchy;
    session.trafficData = aggregatedTraffic;
    session.lastUpdate = new Date().toISOString();
    session.isRunning = mmtStatus.isRunning;
    
    // Update in session manager if it's a managed session
    if (sessionId) {
      sessionManager.updateSession('dpi', sessionId, {
        hierarchyData: hierarchy,
        trafficData: aggregatedTraffic,
        cumulativeStatistics: statistics,
        isRunning: mmtStatus.isRunning
      });
    }
    
    res.json({
      hierarchy,
      trafficData: aggregatedTraffic,
      statistics,
      conversations,
      packetSizes,
      sessionId: session.sessionId,
      isRunning: session.isRunning,
      lastUpdate: session.lastUpdate,
      mode: session.mode,
      csvFile: csvFile,
    });
  } catch (error) {
    console.error('[DPI] Error fetching data:', error);
    console.error('[DPI] Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /api/dpi/pcaps - List available PCAP files
router.get('/pcaps', (req, res) => {
  try {
    const pcapFiles = listFilesByTypeAsync(PCAP_PATH, '.pcap') || [];
    const pcapngFiles = listFilesByTypeAsync(PCAP_PATH, '.pcapng') || [];
    const allFiles = [...pcapFiles, ...pcapngFiles];
    
    res.json({ pcaps: allFiles });
  } catch (error) {
    console.error('[DPI] Error listing PCAP files:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dpi/interfaces - List available network interfaces
router.get('/interfaces', (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('ip -o link show | awk \'{print $2}\' | sed \'s/:$//\'', (error, stdout, stderr) => {
      if (error) {
        console.error('[DPI] Error listing interfaces:', error);
        return res.status(500).json({ error: 'Failed to list network interfaces' });
      }
      
      const interfaces = stdout.trim().split('\n').filter(i => i && i !== 'lo');
      res.json({ interfaces });
    });
  } catch (error) {
    console.error('[DPI] Error listing interfaces:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
