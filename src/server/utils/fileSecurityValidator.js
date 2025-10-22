/**
 * File Security Validator
 * Validates uploaded files for security threats
 * Includes MIME type validation, size limits, and basic malware detection
 */

const fs = require('fs');
const path = require('path');
const { PCAP_EXTENSIONS } = require('../constants');

// Maximum file size: 10 MB (configurable via environment variable)
const MAX_FILE_SIZE = parseInt(process.env.MAX_PCAP_SIZE) || 10 * 1024 * 1024; // 10 MB in bytes

// PCAP magic numbers (file signatures)
const PCAP_MAGIC_NUMBERS = [
  Buffer.from([0xd4, 0xc3, 0xb2, 0xa1]), // pcap (little-endian)
  Buffer.from([0xa1, 0xb2, 0xc3, 0xd4]), // pcap (big-endian)
  Buffer.from([0x4d, 0x3c, 0xb2, 0xa1]), // pcap with nanosecond timestamps (little-endian)
  Buffer.from([0xa1, 0xb2, 0x3c, 0x4d]), // pcap with nanosecond timestamps (big-endian)
  Buffer.from([0x0a, 0x0d, 0x0d, 0x0a]), // pcapng
];

// Suspicious patterns that might indicate malware or scripts
const SUSPICIOUS_PATTERNS = [
  // Shell scripts
  /^#!\/bin\/(bash|sh|zsh|ksh|csh)/m,
  /<\?php/i,
  /<script[\s>]/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /shell_exec\s*\(/i,
  /passthru\s*\(/i,
  /base64_decode\s*\(/i,
  // Python
  /__import__\s*\(/i,
  /import\s+(os|subprocess|sys)\s*$/m,
  // Executable signatures
  /^MZ/,  // PE/DOS executable
  /^\x7fELF/,  // ELF executable
];

/**
 * Validate file extension
 * @param {string} filename - The filename to validate
 * @returns {boolean} - True if extension is valid
 */
function validateExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return PCAP_EXTENSIONS.includes(ext);
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @returns {object} - { valid: boolean, error: string|null, maxSize: number }
 */
function validateFileSize(size) {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)} MB`,
      maxSize: MAX_FILE_SIZE,
      actualSize: size,
    };
  }
  return { valid: true, error: null, maxSize: MAX_FILE_SIZE };
}

/**
 * Validate MIME type by checking file magic numbers
 * @param {Buffer} fileBuffer - First bytes of the file
 * @returns {boolean} - True if file has valid PCAP magic number
 */
function validateMimeType(fileBuffer) {
  if (!fileBuffer || fileBuffer.length < 4) {
    return false;
  }

  // Check for PCAP magic numbers
  for (const magic of PCAP_MAGIC_NUMBERS) {
    if (fileBuffer.slice(0, magic.length).equals(magic)) {
      return true;
    }
  }

  return false;
}

/**
 * Scan file content for suspicious patterns
 * @param {Buffer|string} content - File content to scan
 * @returns {object} - { safe: boolean, threats: string[] }
 */
function scanForMalware(content) {
  const threats = [];
  const textContent = Buffer.isBuffer(content) ? content.toString('utf8', 0, Math.min(content.length, 8192)) : content;

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(textContent)) {
      threats.push(`Suspicious pattern detected: ${pattern.toString()}`);
    }
  }

  // Check for null byte injection (common in malicious files)
  if (textContent.includes('\0') && textContent.indexOf('\0') < 100) {
    // Note: PCAP files are binary, so null bytes are expected deeper in the file
    // But suspicious if found very early (before the header)
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}

/**
 * Read file magic number (first bytes)
 * @param {string} filePath - Path to the file
 * @param {number} bytes - Number of bytes to read (default: 16)
 * @returns {Promise<Buffer>} - First bytes of the file
 */
async function readFileMagic(filePath, bytes = 16) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start: 0, end: bytes - 1 });
    const chunks = [];

    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Comprehensive file validation
 * @param {object} file - File object from express-fileupload
 * @param {string} filePath - Path where file is temporarily stored
 * @returns {Promise<object>} - { valid: boolean, errors: string[] }
 */
async function validatePcapFile(file, filePath = null) {
  const errors = [];

  // 1. Validate extension
  if (!validateExtension(file.name)) {
    errors.push('Invalid file extension. Only .pcap, .pcapng, and .cap files are allowed');
  }

  // 2. Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error);
  }

  // 3. Validate MIME type (magic numbers)
  try {
    let fileBuffer;
    
    if (filePath && fs.existsSync(filePath)) {
      // Read from file path
      fileBuffer = await readFileMagic(filePath);
    } else if (file.data) {
      // Read from file data buffer
      fileBuffer = file.data.slice(0, 16);
    } else {
      errors.push('Cannot read file content for validation');
      return { valid: false, errors };
    }

    if (!validateMimeType(fileBuffer)) {
      errors.push('Invalid file format. File does not appear to be a valid PCAP file');
    }

    // 4. Scan for malware/suspicious patterns (check first 8KB)
    const scanSize = Math.min(file.size, 8192);
    const scanBuffer = filePath && fs.existsSync(filePath)
      ? fs.readFileSync(filePath, { encoding: null }).slice(0, scanSize)
      : (file.data ? file.data.slice(0, scanSize) : null);

    if (scanBuffer) {
      const malwareScan = scanForMalware(scanBuffer);
      if (!malwareScan.safe) {
        errors.push(`Security threat detected: ${malwareScan.threats.join(', ')}`);
      }
    }
  } catch (err) {
    console.error('Error validating file:', err);
    errors.push('Failed to validate file content');
  }

  return {
    valid: errors.length === 0,
    errors,
    fileSize: file.size,
    maxSize: MAX_FILE_SIZE,
  };
}

/**
 * Sanitize filename to prevent directory traversal and other attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove directory traversal attempts
  let safe = path.basename(filename);
  
  // Remove any characters that aren't alphanumeric, dash, underscore, or dot
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Prevent multiple consecutive dots
  safe = safe.replace(/\.{2,}/g, '.');
  
  // Ensure it doesn't start with a dot
  if (safe.startsWith('.')) {
    safe = safe.substring(1);
  }
  
  // Limit length
  if (safe.length > 255) {
    const ext = path.extname(safe);
    const name = path.basename(safe, ext);
    safe = name.substring(0, 255 - ext.length) + ext;
  }
  
  return safe;
}

module.exports = {
  validatePcapFile,
  validateExtension,
  validateFileSize,
  validateMimeType,
  scanForMalware,
  sanitizeFilename,
  MAX_FILE_SIZE,
  PCAP_MAGIC_NUMBERS,
};
