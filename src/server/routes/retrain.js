const express = require('express');
const {
  getRetrainStatus,
  retrainModel,
} = require('../deep-learning/deep-learning-connector');

const router = express.Router();

router.get('/', (req, res) => {
  res.send({
    retrainStatus: getRetrainStatus(),
  });
});

router.post('/', (req, res) => {
  const {
    retrainConfig,
  } = req.body;

  if (!retrainConfig) {
    res.status(401).send({
      error: 'Missing retrain configuration. Please read the docs',
    });
  } else {
    const retrainStatus = getRetrainStatus();
    if (retrainStatus.isRunning) {
      res.status(401).send({
        error: 'A building process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      retrainModel(retrainConfig, (retrainStatus) => {
        if (retrainStatus.error) {
          res.status(401).send({
            error: retrainStatus.error,
          });
        } else {
          console.log(retrainStatus);
          res.send(retrainStatus);
        }
      });
    }
  }
});


module.exports = router;