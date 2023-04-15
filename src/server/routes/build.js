const express = require('express');
const {
  getBuildingStatus,
  startBuildingModel,
} = require('../deep-learning/deep-learning-connector');

const {
  TRAINING_PATH
} = require('../constants');
const fs = require('fs');
const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.send({
    buildStatus: getBuildingStatus(),
  });
});

router.post('/', (req, res) => {
  const {
    buildConfig,
  } = req.body;
  if (!buildConfig) {
    res.status(401).send({
      error: 'Missing building configuration. Please read the docs',
    });
  } else { 
    const buildingStatus = getBuildingStatus();
    if (buildingStatus.isRunning) {
      res.status(401).send({
        error: 'A building process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      startBuildingModel(buildConfig, (buildStatus) => {
        if (buildStatus.error) {
          res.status(401).send({
            error: buildStatus.error,
          });
        } else {
          console.log(buildStatus);
          const modelId = buildStatus.lastBuildId;
          const buildStatusFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/buildingStatus.json`;
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
