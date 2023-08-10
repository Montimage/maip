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
  AC_PATH, TRAINING_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');
const {
  replaceDelimiterInCsv
} = require('../utils/utils');
const {
  getBuildingStatusAC,
  startBuildingModelAC,
} = require('../activity-classification/ac-connector');

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

router.get('/build', (req, res) => {
  res.send({
    buildStatus: getBuildingStatusAC(),
  });
});

router.post('/build', async (req, res, next) => {
  const {
    buildConfig,
  } = req.body;
  if (!buildConfig) {
    res.status(401).send({
      error: 'Missing building configuration. Please read the docs',
    });
  } else { 
    const buildingStatus = getBuildingStatusAC();
    if (buildingStatus.isRunning) {
      res.status(401).send({
        error: 'A building process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      startBuildingModelAC(buildConfig, (buildStatus) => {
        if (buildStatus.error) {
          res.status(401).send({
            error: buildStatus.error,
          });
        } else {
          console.log(buildStatus);
          const modelId = `ac-${buildStatus.lastBuildId}`;
          const buildStatusFilePath = `${TRAINING_PATH}${modelId}/buildingStatus.json`;
          console.log(buildStatusFilePath);
          fs.writeFile(buildStatusFilePath, JSON.stringify(buildStatus), (err) => {
            if (err) {
              console.log(`Error saving buildStatus of model ${modelId} to file: ${err}`);
            } else {
              console.log(`BuildStatus of model ${modelId} saved to file: ${buildStatusFilePath}`);
            }
          });
          res.send(buildStatus);
        }
      });
    }
  }
});

module.exports = router;
