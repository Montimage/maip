const express = require('express');
const {
  startMMTOnline,
  getMMTStatus,
  stopMMT,
  startMMTOffline,
  startMMTForDataset,
} = require('../mmt/mmt-connector');
const fs = require('fs');
const path = require('path');
const { PCAP_PATH } = require('../constants');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.send({
    mmtStatus: getMMTStatus(),
  });
});

router.post('/online', (req, res) => {
  const {
    netInf,
  } = req.body;
  startMMTOnline(netInf, (mmtStatus) => {
    if (mmtStatus.error) {
      res.status(401).send({
        error: mmtStatus.error,
      });
    } else {
      console.log(mmtStatus);
      res.send(mmtStatus);
    }
  });
});

router.post('/offline', (req, res) => {
  const {
    fileName,
    filePath,
    outputSessionId,
  } = req.body;

  // If filePath is provided (e.g., /tmp/ndr_xxx.pcap), copy it into PCAP_PATH and use its basename
  if (filePath && !fileName) {
    try {
      const basename = path.basename(filePath);
      const dest = path.join(PCAP_PATH, basename);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(filePath, dest);
      }
      return startMMTOffline(basename, (mmtStatus) => {
        if (mmtStatus.error) {
          res.status(401).send({ error: mmtStatus.error });
        } else {
          console.log(mmtStatus);
          res.send(mmtStatus);
        }
      }, outputSessionId || null);
    } catch (e) {
      return res.status(401).send({ error: e.message || 'Failed to copy pcap' });
    }
  }

  startMMTOffline(fileName, (mmtStatus) => {
    if (mmtStatus.error) {
      res.status(401).send({
        error: mmtStatus.error,
      });
    } else {
      console.log(mmtStatus);
      res.send(mmtStatus);
    }
  }, outputSessionId || null);
});

router.get('/stop', (req, res) => {
  stopMMT((mmtStatus) => {
    if (!mmtStatus) {
      res.send({
        error: 'No mmt-probe is running',
      });
    } else {
      res.send(mmtStatus);
    }
  });
});

router.post('/dataset', (req, res) => {
  const {
    datasetName,
  } = req.body;
  startMMTForDataset(datasetName, (mmtStatus) => {
    if (mmtStatus.error) {
      res.status(401).send({
        error: mmtStatus.error,
      });
    } else {
      console.log(mmtStatus);
      res.send(mmtStatus);
    }
  });
});

module.exports = router;
