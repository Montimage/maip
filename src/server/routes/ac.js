/* eslint-disable no-unused-vars */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const csv = require('csv-parser');
const router = express.Router();
const {
  AC_PATH
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');
const {
  replaceDelimiterInCsv
} = require('../utils/utils');

router.get('/datasets', async (req, res, next) => {
  try {
    const datasetsPath = path.join(AC_PATH, 'datasets')
    const files = await readdirAsync(datasetsPath);
    const allDatasets = files.filter(file => {
      return path.extname(file) === '.csv';
    });
    res.send({ datasets: allDatasets });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
