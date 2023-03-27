const express = require('express');
const {
  startMMTOnline,
  getMMTStatus,
  stopMMT,
  startMMTOffline,
  startMMTForDataset,
} = require('../mmt/mmt-connector');

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
  } = req.body;
  startMMTOffline(fileName, (mmtStatus) => {
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
