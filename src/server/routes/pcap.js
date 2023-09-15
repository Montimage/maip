const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  PCAP_PATH,
  PCAP_EXTENSIONS,
  DEFAULT_LOG_PATH,
} = require('../constants');
const {
  listFiles,
  listDirectories,
  createFolder,
} = require('../utils/file-utils');
const { spawnCommand } = require('../utils/utils');

const router = express.Router();

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

router.get('/', (req, res) => {
  listFiles(PCAP_PATH, PCAP_EXTENSIONS, (files) => {
    res.send({
      pcaps: files,
    });
  });
});

router.get('/datasets', (req, res) => {
  listDirectories(PCAP_PATH, (dirs) => {
    res.send({
      datasets: dirs,
    });
  });
});

router.post('/', (req, res) => {
  if (!req.files) {
    return res.status(400).send('No files were uploaded');
  }

  const file = req.files.pcapFile;
  const extensionName = path.extname(file.name);
  if (!PCAP_EXTENSIONS.includes(extensionName)) {
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
