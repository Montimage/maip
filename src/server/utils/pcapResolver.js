/**
 * PCAP File Path Resolver
 * Resolves pcap file paths from samples or user-specific upload directories
 */

const fs = require('fs');
const path = require('path');
const {
  PCAP_PATH,
  PCAP_SAMPLES_PATH,
  PCAP_UPLOADS_PATH,
} = require('../constants');

/**
 * Resolve pcap file path
 * Checks in order: user uploads → samples → legacy root pcap directory
 * 
 * @param {string} pcapFileName - Name of the pcap file
 * @param {string} userId - User ID (from req.userId)
 * @returns {string|null} - Full path to pcap file, or null if not found
 */
function resolvePcapPath(pcapFileName, userId = null) {
  if (!pcapFileName) {
    return null;
  }

  // Priority 1: User-specific uploads (if userId provided)
  if (userId) {
    const userUploadPath = path.join(PCAP_UPLOADS_PATH, userId, pcapFileName);
    if (fs.existsSync(userUploadPath)) {
      return userUploadPath;
    }
  }

  // Priority 2: Sample files (shared across all users)
  const samplePath = path.join(PCAP_SAMPLES_PATH, pcapFileName);
  if (fs.existsSync(samplePath)) {
    return samplePath;
  }

  // Priority 3: Legacy root pcap directory (backward compatibility)
  const legacyPath = path.join(PCAP_PATH, pcapFileName);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return null;
}

/**
 * Resolve pcap file path with detailed info
 * 
 * @param {string} pcapFileName - Name of the pcap file
 * @param {string} userId - User ID (from req.userId)
 * @returns {object|null} - { path: string, type: 'user'|'sample'|'legacy', exists: boolean }
 */
function resolvePcapInfo(pcapFileName, userId = null) {
  if (!pcapFileName) {
    return null;
  }

  // Check user uploads
  if (userId) {
    const userUploadPath = path.join(PCAP_UPLOADS_PATH, userId, pcapFileName);
    if (fs.existsSync(userUploadPath)) {
      return {
        path: userUploadPath,
        type: 'user',
        exists: true,
        userId: userId,
      };
    }
  }

  // Check samples
  const samplePath = path.join(PCAP_SAMPLES_PATH, pcapFileName);
  if (fs.existsSync(samplePath)) {
    return {
      path: samplePath,
      type: 'sample',
      exists: true,
    };
  }

  // Check legacy
  const legacyPath = path.join(PCAP_PATH, pcapFileName);
  if (fs.existsSync(legacyPath)) {
    return {
      path: legacyPath,
      type: 'legacy',
      exists: true,
    };
  }

  // Not found
  return {
    path: null,
    type: null,
    exists: false,
  };
}

/**
 * Check if user has access to a pcap file
 * Users can access: their own uploads + all sample files
 * 
 * @param {string} pcapFileName - Name of the pcap file
 * @param {string} userId - User ID requesting access
 * @returns {boolean} - True if user has access
 */
function userHasAccess(pcapFileName, userId) {
  const info = resolvePcapInfo(pcapFileName, userId);
  
  if (!info || !info.exists) {
    return false;
  }

  // User can access their own files
  if (info.type === 'user' && info.userId === userId) {
    return true;
  }

  // Everyone can access sample files
  if (info.type === 'sample') {
    return true;
  }

  // Legacy files are accessible (backward compatibility)
  if (info.type === 'legacy') {
    return true;
  }

  return false;
}

module.exports = {
  resolvePcapPath,
  resolvePcapInfo,
  userHasAccess,
};
