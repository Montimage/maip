const express = require('express');
const path = require('path');
const {
  PCAP_PATH,
  allowExtensions,
  DEFAULT_LOG_PATH,
} = require('../constants');
const {
  listFiles,
  createFolder,
} = require('../utils/file-utils');
const { spawnCommand } = require('../utils/utils');

const router = express.Router();

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
        if (allowExtensions.includes(path.extname(uploadFile.name))) {
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

router.get('/:datasetName', (req, res) => {
  const {
    datasetName,
  } = req.params;
  const datasetPath = `${PCAP_PATH}${datasetName}`;
  listFiles(datasetPath, allowExtensions, (files) => {
    res.send({
      pcaps: files,
    });
  });
});

/* GET all pcap files */
router.get('/', (req, res) => {
  listFiles(PCAP_PATH, allowExtensions, (files) => {
    res.send({
      pcaps: files,
    });
  });
});

router.post('/', (req, res) => {
  if (!req.files) {
    return res.status(400).send('No files were uploaded');
  }

  const file = req.files.pcapFile;
  const extensionName = path.extname(file.name);
  if (!allowExtensions.includes(extensionName)) {
    return res.status(422).send('Invalid format');
  }

  const filePath = `${PCAP_PATH}${file.name}`;
  return file.mv(filePath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }
    return res.send({
      pcapFile: file.name,
    });
  });
});

module.exports = router;
