const express = require('express');
const {
  getBuildingStatus,
  startBuildingModel,
} = require('../deep-learning/deep-learning-connector');

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
          res.send(buildStatus);
        }
      });
    }
  }
});

module.exports = router;
