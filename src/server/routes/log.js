/* eslint-disable no-unused-vars */
const express = require('express');

const router = express.Router();
const {
  LOG_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');
/* GET all pcap files */
router.get('/', (req, res, next) => {
  listFiles(LOG_PATH, '.log', (files) => {
    res.send({
      logs: files,
    });
  });
});

router.get('/:fileName/download', (req, res, next) => {
  const { fileName } = req.params;
  const logFilePath = `${LOG_PATH}${fileName}`;
  isFileExist(logFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The log file ${fileName} does not exist`);
    } else {
      res.sendFile(logFilePath);
    }
  });
});

router.get('/:fileName', (req, res, next) => {
  const { fileName } = req.params;
  readTextFile(`${LOG_PATH}${fileName}`, (err, content) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ content });
    }
  });
});

module.exports = router;
