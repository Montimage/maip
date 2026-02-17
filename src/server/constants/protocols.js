/**
 * Protocol ID to Name mapping from MMT-Operator
 * This matches the comprehensive protocol list used in MMT-Probe and MMT-Operator
 * Source: mmt-operator/www/public/js/mmt_drop.js - ProtocolsIDName
 */

const PROTOCOL_ID_TO_NAME = {
  "-1": "_other",
  0: '_unknown',
  1: "_unknown",
  // Network Layer Protocols
  7: 'VLAN',
  30: 'ARP',
  48: 'BGP',
  81: 'DHCP',
  82: 'DHCPV6',
  85: 'DNS',
  93: 'EGP',
  99: 'ETH',
  137: 'GRE',
  163: 'ICMP',
  164: 'ICMPV6',
  166: 'IGMP',
  178: 'IP',
  179: 'IP_IN_IP',
  182: 'IP6',
  196: 'L2TP',
  218: 'MDNS',
  241: 'NETBIOS',
  243: 'NETFLOW',
  251: 'NTP',
  260: 'OSPF',
  278: 'PPP',
  279: 'PPPOE',
  281: 'PPTP',
  304: 'SCTP',
  310: 'SFLOW',
  339: 'SSDP',
  354: 'TCP',
  376: 'UDP',
  377: 'UDPLITE',
  
  // Transport & Security
  15: 'AH',
  97: 'ESP',
  141: 'GTP',
  181: 'IPSEC',
  191: 'KERBEROS',
  288: 'RADIUS',
  314: 'SIP',
  341: 'SSL',
  347: 'STUN',
  624: 'SLL',
  627: 'QUIC',
  660: 'DTLS',
  661: 'QUIC_IETF',
  700: 'HTTP2',
  
  // Application Protocols - Web
  153: 'HTTP',
  443: 'HTTPS',
  155: 'HTTP_PROXY',
  156: 'HTTP_APPLICATION_ACTIVESYNC',
  382: 'HTTP_APPLICATION_VEOHTV',
  
  // Application Protocols - Mail
  169: 'IMAP',
  170: 'IMAPS',
  272: 'POP',
  273: 'POPS',
  323: 'SMTP',
  324: 'SMTPS',
  
  // Application Protocols - File Transfer
  14: 'AFP',
  117: 'FTP',
  247: 'NFS',
  322: 'SMB',
  358: 'TFTP',
  
  // Application Protocols - Database
  233: 'MSSQL',
  237: 'MYSQL',
  276: 'POSTGRES',
  628: 'ORACLE',
  629: 'REDIS',
  
  // Application Protocols - Remote Access
  198: 'LDAP',
  290: 'RDP',
  340: 'SSH',
  356: 'TEAMVIEWER',
  357: 'TELNET',
  388: 'VNC',
  
  // Application Protocols - Network Management
  325: 'SNMP',
  349: 'SYSLOG',
  
  // Application Protocols - Messaging & Communication
  16: 'AIM',
  104: 'FACETIME',
  140: 'GTALK',
  186: 'UNENCRYPED_JABBER',
  317: 'SKYPE',
  384: 'VIBER',
  397: 'WHATSAPP',
  594: 'TANGO',
  595: 'WECHAT',
  596: 'LINE',
  600: 'YAHOOMSG',
  622: 'FBMSG',
  
  // Application Protocols - Streaming & Media
  161: 'ICECAST',
  298: 'RTP',
  299: 'RTSP',
  312: 'SHOUTCAST',
  330: 'SOPCAST',
  371: 'TVANTS',
  372: 'TVUPLAYER',
  429: 'ZATTOO',
  
  // Application Protocols - P2P
  52: 'BITTORRENT',
  84: 'DIRECTCONNECT',
  92: 'EDONKEY',
  105: 'FASTTRACK',
  129: 'GNUTELLA',
  172: 'IMESH',
  195: 'KONTIKI',
  215: 'MANOLITO',
  257: 'OPENFT',
  258: 'ORANGEDONKEY',
  263: 'PANDO',
  332: 'SOULSEEK',
  344: 'STEALTHNET',
  360: 'THE_PIRATE_BAY',
  361: 'THUNDER',
  365: 'TORRENTZ',
  405: 'WINMX',
  
  // Application Protocols - Gaming
  24: 'ANGRYBIRDS',
  29: 'ARMAGETRON',
  42: 'BATTLEFIELD',
  43: 'BATTLENET',
  63: 'CHESS',
  75: 'CROSSFIRE',
  86: 'DOFUS',
  96: 'ELECTRONICSARTS',
  108: 'FIESTA',
  113: 'FLORENSIA',
  144: 'GUILDWARS',
  149: 'HALFLIFE2',
  199: 'LEAGUEOFLEGENDS',
  216: 'MAPLESTORY',
  224: 'MINECRAFT',
  225: 'MINICLIP',
  229: 'MOVE',
  285: 'QUAKE',
  296: 'ROBLOX',
  308: 'SECONDLIFE',
  345: 'STEAM',
  407: 'WORLD_OF_KUNG_FU',
  409: 'WARCRAFT3',
  410: 'WORLDOFWARCRAFT',
  413: 'XBOX',
  432: 'ZYNGA',
  617: 'GAMEFORGE',
  618: 'METIN2',
  619: 'OGAME',
  620: 'BATTLEKNIGHT',
  621: '4STORY',
  
  // Social Networks & Web Services
  21: 'AMAZON',
  27: 'APPLE',
  35: 'AWS',
  37: 'BADOO',
  38: 'BAIDU',
  51: 'BING',
  55: 'BLOGGER',
  56: 'BLOGSPOT',
  68: 'CNN',
  74: 'CRAIGSLIST',
  77: 'DAILYMOTION',
  80: 'DEVIANTART',
  83: 'DIGG',
  88: 'DOUBAN',
  89: 'DOUBLECLICK',
  90: 'DROPBOX',
  91: 'EBAY',
  98: 'ESPN',
  103: 'FACEBOOK',
  112: 'FLICKR',
  114: 'FOURSQUARE',
  125: 'GITHUB',
  128: 'GMAIL',
  130: 'GOOGLE_MAPS',
  134: 'GOOGLE',
  135: 'GOOGLE_USER_CONTENT',
  148: 'HI5',
  152: 'HOTMAIL',
  162: 'APPLE_ICLOUD',
  177: 'INSTAGRAM',
  185: 'APPLE_ITUNES',
  197: 'LASTFM',
  202: 'LINKEDIN',
  203: 'LIVE',
  208: 'LIVEJOURNAL',
  213: 'MAIL_RU',
  219: 'MEDIAFIRE',
  232: 'MSN',
  236: 'MYSPACE',
  242: 'NETFLIX',
  252: 'NYTIMES',
  253: 'ODNOKLASSNIKI',
  264: 'PAYPAL',
  268: 'PHOTOBUCKET',
  269: 'PINTEREST',
  275: 'PORNHUB',
  283: 'QQ',
  292: 'REDDIT',
  293: 'REDTUBE',
  295: 'RENREN',
  313: 'SINA',
  318: 'SKYROCK',
  321: 'SLIDESHARE',
  328: 'SOGOU',
  329: 'SOHU',
  331: 'SOSO',
  333: 'SOUNDCLOUD',
  337: 'SPOTIFY',
  342: 'STACK_OVERFLOW',
  346: 'STUMBLEUPON',
  350: 'TAGGED',
  351: 'TAOBAO',
  362: 'TIANYA',
  364: 'TMALL',
  370: 'TUMBLR',
  373: 'TWITTER',
  385: 'VIMEO',
  386: 'VK',
  387: 'VKONTAKTE',
  395: 'WEIBO',
  399: 'WIKIA',
  400: 'WIKIMEDIA',
  401: 'WIKIPEDIA',
  403: 'WINDOWSLIVE',
  408: 'WORDPRESS_ORG',
  420: 'YAHOO',
  422: 'YAHOOMAIL',
  423: 'YANDEX',
  424: 'YELP',
  425: 'YOUKU',
  426: 'YOUPORN',
  427: 'YOUTUBE',
  
  // CDN Providers
  599: 'AKAMAI',
  593: 'CLOUDFRONT',
  601: 'BITGRAVITY',
  602: 'CACHEFLY',
  603: 'CDN77',
  604: 'CDNETWORKS',
  605: 'CHINACACHE',
  607: 'EDGECAST',
  608: 'FASTLY',
  609: 'HIGHWINDS',
  610: 'INTERNAP',
  611: 'LEVEL3',
  612: 'LIMELIGHT',
  613: 'MAXCDN',
  614: 'NETDNA',
  615: 'VOXEL',
  616: 'RACKSPACE',
  
  // Cloud Storage
  590: 'BOX',
  591: 'SKYDRIVE',
  
  // Telecom & 5G
  800: 'IEEE802154',
  801: 'LOWPAN',
  900: 'S1AP',
  901: 'DIAMETER',
  902: 'GTPv2',
  903: 'NGAP',
  904: 'NAS-5G',
  
  // IoT & Industrial
  625: 'NDN',
  626: 'NDN_HTTP',
  630: 'VMWARE',
  634: 'LLMNR',
  635: 'ECLIPSE_TCF',
  636: 'LOOPBACK',
  637: 'TPKT',
  638: 'COTP',
  639: 'S7COMM',
  640: 'CTP',
  641: 'LLC',
  642: 'XID',
  643: 'CDP',
  644: 'DTP',
  656: '8021AD',
  657: 'MQTT',
  658: 'INBAND_NETWORK_TELEMETRY',
  659: 'INT_REPORT',
};

/**
 * Well-known port to protocol mapping
 * Extended from MMT-Operator's port-based protocol identification
 */
const PORT_TO_PROTOCOL = {
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
  1883: 'MQTT',
  3306: 'MYSQL',
  3389: 'RDP',
  5060: 'SIP',
  5061: 'SIPS',
  5432: 'POSTGRESQL',
  5900: 'VNC',
  6379: 'REDIS',
  8080: 'HTTP-ALT',
  8443: 'HTTPS-ALT',
  9200: 'ELASTICSEARCH',
  27017: 'MONGODB',
};

/**
 * Protocol categories matching MMT-Operator
 */
const PROTOCOL_CATEGORIES = {
  0: 'All',
  1: 'Web',
  2: 'P2P',
  3: 'Gaming',
  4: 'Streaming',
  5: 'Conversational',
  6: 'Mail',
  7: 'FileTransfer',
  8: 'CloudStorage',
  9: 'DirectDownloadLink',
  10: 'Network',
  12: 'DataBase',
  15: 'CDN',
  16: 'SocialNetwork',
};

/**
 * Get protocol name from protocol ID
 * @param {number|string} protocolId - Protocol ID
 * @returns {string} Protocol name
 */
function getProtocolNameFromID(protocolId) {
  const id = String(protocolId);
  return PROTOCOL_ID_TO_NAME[id] || `proto_${protocolId}`;
}

/**
 * Get protocol ID from protocol name
 * @param {string} protocolName - Protocol name
 * @returns {number|null} Protocol ID or null if not found
 */
function getProtocolIDFromName(protocolName) {
  for (const [id, name] of Object.entries(PROTOCOL_ID_TO_NAME)) {
    if (name.toUpperCase() === protocolName.toUpperCase()) {
      return parseInt(id);
    }
  }
  return null;
}

/**
 * Identify application protocol based on port numbers
 * @param {number} srcPort - Source port
 * @param {number} destPort - Destination port
 * @returns {string|null} Protocol name or null
 */
function identifyProtocolByPort(srcPort, destPort) {
  return PORT_TO_PROTOCOL[destPort] || PORT_TO_PROTOCOL[srcPort] || null;
}

/**
 * Get friendly path name from protocol path (e.g., "99.178.354.153" -> "ETH/IP/TCP/HTTP")
 * @param {string} path - Protocol path with IDs separated by dots
 * @returns {string} Friendly protocol path
 */
function getPathFriendlyName(path, separator = '/') {
  if (!path) return '';
  
  const ids = path.split('.');
  const names = ids.map(id => {
    if (id === '0') return '_unk';
    const name = getProtocolNameFromID(id);
    // Handle port-based protocols (e.g., "HTTP:80")
    if (name.indexOf(':') !== -1) {
      return ':' + name.split(':')[1];
    }
    return name;
  });
  
  return names.join(separator);
}

/**
 * Get application ID from protocol path (last element)
 * @param {string} path - Protocol path
 * @returns {number} Application ID
 */
function getAppIdFromPath(path) {
  const n = path.toString().lastIndexOf('.');
  const id = path.toString().substring(n + 1);
  return parseInt(id);
}

/**
 * Get parent path from protocol path
 * @param {string} path - Protocol path
 * @returns {string} Parent path
 */
function getParentPath(path) {
  const n = path.lastIndexOf('.');
  if (n === -1) return '.';
  return path.substring(0, n);
}

module.exports = {
  PROTOCOL_ID_TO_NAME,
  PORT_TO_PROTOCOL,
  PROTOCOL_CATEGORIES,
  getProtocolNameFromID,
  getProtocolIDFromName,
  identifyProtocolByPort,
  getPathFriendlyName,
  getAppIdFromPath,
  getParentPath,
};
