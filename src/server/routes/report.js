const express = require('express');

const router = express.Router();
const {
  REPORT_PATH,
} = require('../constants');
const {
  listFiles,
  readTextFile,
  isFileExist,
} = require('../utils/file-utils');
/* GET all pcap files */
router.get('/', (req, res) => {
  listFiles(REPORT_PATH, 'report-', (files) => {
    res.send({
      reports: files,
    });
  });
});

router.get('/:reportId', (req, res) => {
  const {
    reportId,
  } = req.params;
  listFiles(`${REPORT_PATH}${reportId}`, '.csv', (files) => {
    res.send({
      csvFiles: files,
    });
  });
});

router.get('/:reportId/:fileName/download', (req, res) => {
  const {
    fileName,
    reportId,
  } = req.params;
  const reportFilePath = `${REPORT_PATH}${reportId}/${fileName}`;
  isFileExist(reportFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The report file ${reportId}/${fileName} does not exist`);
    } else {
      res.sendFile(reportFilePath);
    }
  });
});

router.get('/:reportId/:fileName', (req, res) => {
  const {
    fileName,
    reportId,
  } = req.params;
  readTextFile(`${REPORT_PATH}${reportId}/${fileName}`, (err, content) => {
    if (err) {
      res.status(401).send({
        error: 'Something went wrong!',
      });
    } else {
      res.send({
        content,
      });
    }
  });
});

module.exports = router;
