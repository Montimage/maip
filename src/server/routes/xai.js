const express = require('express');

const router = express.Router();

const {
  getXAIStatus,
  runSHAP,
  runLIME,
} = require('../deep-learning/xai-connector');
const {
  listFiles,
} = require('../utils/file-utils');
const {
  XAI_PATH,
} = require('../constants');


router.get('/', (_, res) => {
  res.send({
    xaiStatus: getXAIStatus(),
  });
});

router.post('/shap', (req, res) => {
  const {
    shapConfig,
  } = req.body;
  if (!shapConfig) {
    res.status(401).send({
      error: 'Missing SHAP configuration. Please read the docs',
    });
  } else {
    const xaiStatus = getXAIStatus();
    if (xaiStatus.isRunning) {
      res.status(401).send({
        error: 'An explaining process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      runSHAP(shapConfig, (xaiStatus) => {
        if (xaiStatus.error) {
          res.status(401).send({
            error: xaiStatus.error,
          });
        } else {
          console.log(xaiStatus);
          res.send(xaiStatus);
        }
      });
    }
  }
});

router.post('/lime', (req, res) => {
  const {
    limeConfig,
  } = req.body;
  if (!limeConfig) {
    res.status(401).send({
      error: 'Missing LIME configuration. Please read the docs',
    });
  } else {
    const xaiStatus = getXAIStatus();
    if (xaiStatus.isRunning) {
      res.status(401).send({
        error: 'An explaining process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      runLIME(limeConfig, (xaiStatus) => {
        if (xaiStatus.error) {
          res.status(401).send({
            error: xaiStatus.error,
          });
        } else {
          console.log(xaiStatus);
          res.send(xaiStatus);
        }
      });
    }
  }
});

/**
 * Get a list of explanations of a specific model
 */
router.get('/explanations/:modelId', (req, res, next) => {
  const { modelId } = req.params;
  const xaiFilePath = `${XAI_PATH}${modelId.replace('.h5', '')}`;

  listFiles(xaiFilePath, '*', (files) => {
    res.send({
      explanations: files,
    });
  });
});


module.exports = router;