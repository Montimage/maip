const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  PCAP_PATH,
  PCAP_SAMPLES_PATH,
  PCAP_UPLOADS_PATH,
  PCAP_EXTENSIONS,
  DEFAULT_LOG_PATH,
} = require('../constants');
const {
  listFiles,
  listDirectories,
  createFolder,
  createFolderSync,
} = require('../utils/file-utils');
const { spawnCommand } = require('../utils/utils');
const { identifyUser } = require('../middleware/userAuth');
const {
  validatePcapFile,
  sanitizeFilename,
  MAX_FILE_SIZE,
} = require('../utils/fileSecurityValidator');

const router = express.Router();

// Apply user identification middleware to all routes
router.use(identifyUser);

// Ensure samples and uploads directories exist
if (!fs.existsSync(PCAP_SAMPLES_PATH)) {
  createFolderSync(PCAP_SAMPLES_PATH);
  console.log(`[PCAP] Created samples directory: ${PCAP_SAMPLES_PATH}`);
}
if (!fs.existsSync(PCAP_UPLOADS_PATH)) {
  createFolderSync(PCAP_UPLOADS_PATH);
  console.log(`[PCAP] Created uploads directory: ${PCAP_UPLOADS_PATH}`);
}

// Compute SHA-256 of a file via streaming
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch (e) {
      reject(e);
    }
  });
}

function readUserIndex(dir) {
  try {
    const p = path.join(dir, 'pcap_index.json');
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    return (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
  } catch (e) {
    return {};
  }
}

function writeUserIndex(dir, idx) {
  try {
    const p = path.join(dir, 'pcap_index.json');
    fs.writeFileSync(p, JSON.stringify(idx));
  } catch (e) {
    // ignore
  }
}

// TODO: retest
router.post('/:datasetName', (req, res) => {
  const {
    datasetName,
  } = req.params;
  if (!req.files) {
    return res.status(400).send('No files were uploaded');
  }

  const datasetPath = `${PCAP_PATH}${datasetName}`;
  return createFolder(datasetPath, (ret) => {
    if (ret) {
      // Upload a single file
      const files = Object.values(req.files)[0];
      console.log('Uploaded files: ', files);
      if (!files || files.length === 0) {
        return res.status(400).send('There is no uploaded file');
      }

      const pcapFiles = [];
      // eslint-disable-next-line no-plusplus
      for (let index2 = 0; index2 < files.length; index2++) {
        const uploadFile = files[index2];
        console.log(uploadFile);
        if (PCAP_EXTENSIONS.includes(path.extname(uploadFile.name))) {
          pcapFiles.push(uploadFile);
        }
      }

      if (pcapFiles.length === 0) {
        return res.status(400).send('There is no valid trace file');
      }
      // eslint-disable-next-line no-plusplus
      for (let index = 0; index < pcapFiles.length; index++) {
        const file = pcapFiles[index];

        const filePath = `${datasetPath}/${file.name}`;
        file.mv(filePath, (err) => {
          if (err) {
            console.error(err);
          }
          console.log(`File ${file.name} has been stored successfully`);
        });
      }

      // TODO: merge pcap files into a single pcap files?
      const newPcapFileName = `${datasetName}.pcap`;
      const newPcapFileNamePath = `${PCAP_PATH}${newPcapFileName}`;
      return spawnCommand('mergecap', ['-w', newPcapFileNamePath, pcapFiles.map((f) => `${datasetPath}/${f.name}`).join(' ')], DEFAULT_LOG_PATH, () => res.send({
        pcapFileName: newPcapFileName,
      }));
    }
    return res.status(500).send('Failed to create dataset location');
  });
});

router.get('/dataset/:datasetName', (req, res) => {
  const {
    datasetName,
  } = req.params;
  const datasetPath = `${PCAP_PATH}${datasetName}`;
  listFiles(datasetPath, PCAP_EXTENSIONS, (files) => {
    res.send({
      pcaps: files,
    });
  });
});

router.delete('/dataset/:datasetName', (req, res, next) => {
  const { datasetName } = req.params;
  const datasetPath = `${PCAP_PATH}${datasetName}`;
  try {
    if (fs.existsSync(datasetPath)) {
      fs.rmSync(datasetPath, { recursive: true });
      res.send({
        message: 'The dataset folder and its pcap files have been deleted successfully'
      });
    } else {
      res.status(404).send({
        message: 'Dataset not found'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Get all available pcap files for current user (samples + user's own uploads)
router.get('/', (req, res) => {
  try {
    const userId = req.userId;
    const userUploadPath = path.join(PCAP_UPLOADS_PATH, userId);
    
    console.log('[PCAP API] GET / - userId:', userId);
    console.log('[PCAP API] GET / - userUploadPath:', userUploadPath);
    console.log('[PCAP API] GET / - path exists:', fs.existsSync(userUploadPath));
    
    // Get sample files
    const sampleFiles = fs.existsSync(PCAP_SAMPLES_PATH)
      ? fs.readdirSync(PCAP_SAMPLES_PATH)
          .filter(f => PCAP_EXTENSIONS.some(ext => f.endsWith(ext)))
          .map(f => ({ name: f, type: 'sample', path: 'samples' }))
      : [];
    
    // Get user's uploaded files
    const userFiles = fs.existsSync(userUploadPath)
      ? fs.readdirSync(userUploadPath)
          .filter(f => PCAP_EXTENSIONS.some(ext => f.endsWith(ext)))
          .map(f => ({ name: f, type: 'user', path: `uploads/${userId}` }))
      : [];
    
    // IMPORTANT: Put user files FIRST, then samples
    console.log('[PCAP API] GET / - userFiles count:', userFiles.length);
    console.log('[PCAP API] GET / - sampleFiles count:', sampleFiles.length);
    if (userFiles.length > 0) {
      console.log('[PCAP API] GET / - userFiles names:', userFiles.map(f => f.name));
    }
    
    res.send({
      pcaps: [...userFiles, ...sampleFiles],
      samples: sampleFiles.map(f => f.name),
      userUploads: userFiles.map(f => f.name),
    });
  } catch (err) {
    console.error('[PCAP] Error listing files:', err);
    res.status(500).send({ error: 'Failed to list PCAP files' });
  }
});

router.get('/datasets', (req, res) => {
  listDirectories(PCAP_PATH, (dirs) => {
    res.send({
      datasets: dirs,
    });
  });
});

// Upload pcap file with security validation
router.post('/', async (req, res) => {
  try {
    if (!req.files || !req.files.pcapFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.pcapFile;
    const userId = req.userId;
    const isAnonymous = req.isAnonymous;

    // Block anonymous users from uploading
    if (isAnonymous) {
      console.warn(`[PCAP] Upload rejected: Anonymous users cannot upload files`);
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to upload PCAP files',
      });
    }

    // Log upload attempt
    console.log(`[PCAP] Upload attempt by user ${userId}: ${file.name} (${file.size} bytes)`);

    // Validate file size before processing
    if (file.size > MAX_FILE_SIZE) {
      return res.status(413).json({
        error: 'File too large',
        message: `File size exceeds maximum limit of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)} MB`,
        maxSize: MAX_FILE_SIZE,
        actualSize: file.size,
      });
    }

    // Comprehensive security validation
    const validation = await validatePcapFile(file);
    if (!validation.valid) {
      console.warn(`[PCAP] Upload rejected for user ${userId}:`, validation.errors);
      return res.status(422).json({
        error: 'File validation failed',
        details: validation.errors,
      });
    }

    // Sanitize filename to prevent attacks
    const sanitizedName = sanitizeFilename(file.name);
    
    // Create user-specific upload directory
    const userUploadPath = path.join(PCAP_UPLOADS_PATH, userId);
    if (!fs.existsSync(userUploadPath)) {
      fs.mkdirSync(userUploadPath, { recursive: true });
      console.log(`[PCAP] Created user directory: ${userUploadPath}`);
    }

    // Generate a unique filename if necessary (rare race conditions)
    const tmpPath = path.join(userUploadPath, `.upload-${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`);
    await new Promise((resolve, reject) => {
      file.mv(tmpPath, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    let hash;
    try {
      hash = await computeFileHash(tmpPath);
      console.log(`[PCAP] Computed hash for ${sanitizedName}: ${hash.substring(0, 16)}...`);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw e;
    }

    const index = readUserIndex(userUploadPath);
    console.log(`[PCAP] Index has ${Object.keys(index).length} entries for user ${userId}`);
    
    if (index && index[hash]) {
      // Duplicate content found in index
      let existingFile = index[hash];
      
      // Validate that the indexed file still exists
      const indexedPath = path.join(userUploadPath, existingFile);
      if (!fs.existsSync(indexedPath)) {
        console.log(`[PCAP] Indexed file ${existingFile} no longer exists, searching for alternative...`);
        existingFile = null;
      }
      
      // Prefer non-suffixed version if it exists (e.g., prefer 'infiltration.pcap' over 'infiltration_2.pcap')
      const baseName = sanitizedName;
      const baseNamePath = path.join(userUploadPath, baseName);
      if (baseName !== existingFile && fs.existsSync(baseNamePath)) {
        try {
          const baseHash = await computeFileHash(baseNamePath);
          if (baseHash === hash) {
            existingFile = baseName;
            index[hash] = baseName;
            writeUserIndex(userUploadPath, index);
            console.log(`[PCAP] Updated index to prefer non-suffixed file: ${baseName}`);
          }
        } catch (e) {
          // ignore and continue searching
        }
      }
      
      // If indexed file was deleted and no non-suffixed version exists, search directory
      if (!existingFile) {
        console.log(`[PCAP] Searching directory for file with matching hash...`);
        try {
          const entries = fs.readdirSync(userUploadPath, { withFileTypes: true });
          for (const ent of entries) {
            if (!ent.isFile()) continue;
            const name = ent.name;
            if (name.startsWith('.upload-') || name === 'pcap_index.json') continue;
            if (!PCAP_EXTENSIONS.some(ext => name.endsWith(ext))) continue;
            const full = path.join(userUploadPath, name);
            try {
              const h = await computeFileHash(full);
              if (h === hash) {
                existingFile = name;
                index[hash] = name;
                writeUserIndex(userUploadPath, index);
                console.log(`[PCAP] Found and updated index with existing file: ${name}`);
                break;
              }
            } catch (_) { /* ignore single file hash errors */ }
          }
        } catch (_) { /* ignore dir read errors */ }
      }
      
      if (existingFile) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        console.log(`[PCAP] ✓ Content-duplicate (index hit) for user ${userId}, reusing: ${existingFile}`);
        return res.status(200).json({
          success: true,
          pcapFile: existingFile,
          fileSize: file.size,
          userId: userId,
          isAnonymous: req.isAnonymous || false,
          alreadyExisted: true,
          dedupBy: 'hash'
        });
      }
      
      // If we reach here, indexed file was deleted and no match found, continue to save as new
      console.log(`[PCAP] Index entry exists but no matching file found, will save as new`);
    }

    // Legacy migration: if a same-named file exists from pre-index era, compare hashes and dedup to it
    const sameNamedPath = path.join(userUploadPath, sanitizedName);
    if (fs.existsSync(sameNamedPath)) {
      console.log(`[PCAP] Same-named file exists, checking hash: ${sanitizedName}`);
      try {
        const existingHash = await computeFileHash(sameNamedPath);
        console.log(`[PCAP] Existing file hash: ${existingHash.substring(0, 16)}...`);
        if (existingHash === hash) {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          index[hash] = sanitizedName;
          writeUserIndex(userUploadPath, index);
          console.log(`[PCAP] ✓ Dedup via legacy same-name match for user ${userId}: ${sanitizedName}`);
          return res.status(200).json({
            success: true,
            pcapFile: sanitizedName,
            fileSize: file.size,
            userId: userId,
            isAnonymous: req.isAnonymous || false,
            alreadyExisted: true,
            dedupBy: 'hash'
          });
        }
        console.log(`[PCAP] Same-named file has different content, will create suffix`);
      } catch (e) {
        console.warn(`[PCAP] Error checking same-named file hash:`, e.message);
      }
    }

    // Otherwise, scan existing user files for a content match and dedup to it
    console.log(`[PCAP] Scanning directory for content match...`);
    try {
      const entries = fs.readdirSync(userUploadPath, { withFileTypes: true });
      let scannedCount = 0;
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const name = ent.name;
        if (name.startsWith('.upload-') || name === 'pcap_index.json') continue;
        if (!PCAP_EXTENSIONS.some(ext => name.endsWith(ext))) continue;
        const full = path.join(userUploadPath, name);
        scannedCount++;
        try {
          const h = await computeFileHash(full);
          if (h === hash) {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
            index[hash] = name;
            writeUserIndex(userUploadPath, index);
            console.log(`[PCAP] ✓ Dedup via directory scan for user ${userId}: ${name}`);
            return res.status(200).json({
              success: true,
              pcapFile: name,
              fileSize: file.size,
              userId: userId,
              isAnonymous: req.isAnonymous || false,
              alreadyExisted: true,
              dedupBy: 'hash'
            });
          }
        } catch (_) { /* ignore single file hash errors */ }
      }
      console.log(`[PCAP] Scanned ${scannedCount} files, no content match found`);
    } catch (_) { /* ignore dir read errors and proceed */ }

    // Otherwise place the file under a unique, user-friendly name
    console.log(`[PCAP] No duplicate found, saving as new file: ${sanitizedName}`);
    let finalFilename = sanitizedName;
    let filePath = path.join(userUploadPath, finalFilename);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      const ext = path.extname(sanitizedName);
      const nameWithoutExt = path.basename(sanitizedName, ext);
      finalFilename = `${nameWithoutExt}_${counter}${ext}`;
      filePath = path.join(userUploadPath, finalFilename);
      counter++;
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw e;
    }

    // Update user's content hash index
    index[hash] = finalFilename;
    writeUserIndex(userUploadPath, index);

    console.log(`[PCAP] Upload successful for user ${userId}: ${finalFilename}`);

    return res.status(200).json({
      success: true,
      pcapFile: finalFilename,
      fileSize: file.size,
      userId: userId,
      isAnonymous: req.isAnonymous || false,
      dedupBy: 'none'
    });
  } catch (err) {
    console.error('[PCAP] Upload error:', err);
    return res.status(500).json({
      error: 'Upload failed',
      message: err.message || 'Internal server error',
    });
  }
});

router.delete('/', (req, res, next) => {
  try {
    listFiles(PCAP_PATH, '.pcap', (files) => {
      files.forEach(file => {
        const filePath = path.join(PCAP_PATH, file);
        fs.unlinkSync(filePath);
      });

      res.send({
        message: 'All pcaps files deleted successfully'
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
