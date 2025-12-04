/* eslint-disable no-unused-vars */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const {
  LOG_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');
const { identifyUser, requireAuth, requireAdmin } = require('../middleware/userAuth');

// Apply user identification middleware to all routes
router.use(identifyUser);

router.get('/', (req, res, next) => {
  listFiles(LOG_PATH, '.log', (files) => {
    res.send({
      logs: files,
    });
  });
});

router.delete('/', requireAdmin, (req, res, next) => {
  try {
    listFiles(LOG_PATH, '.log', (files) => {
      files.forEach(file => {
        const filePath = path.join(LOG_PATH, file);
        fs.unlinkSync(filePath);
      });

      res.send({
        message: 'All .log files deleted successfully'
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
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
