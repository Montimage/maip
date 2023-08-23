const express = require('express');

const router = express.Router();

const {
  getXAIStatus,
  runSHAP,
  runLIME,
} = require('../deep-learning/xai-connector');
const {
  listFiles,
  isFileExist,
} = require('../utils/file-utils');

const {
  XAI_PATH,
} = require('../constants');
const { 
  AD_OUTPUT_LABELS, AC_OUTPUT_LABELS, AD_OUTPUT_LABELS_XAI,
} = require('../../client/src/constants');

const isACModel = modelId => modelId && modelId.startsWith('ac-');

const getLabelsListXAI = (modelId) => {
  return isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS_XAI;
}

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

/**
 * Get SHAP feature importance values of a specific model
 */
router.get('/shap/explanations/:modelId/:labelId', (req, res, next) => {
  const { modelId, labelId } = req.params;
  let label;
  if (modelId.startsWith('ac-')) {
    label = AC_OUTPUT_LABELS[parseInt(labelId)];
  } else {
    label = AD_OUTPUT_LABELS[parseInt(labelId)];
  }

  if (!label) {
    return res.status(400).send(`Invalid labelId: ${labelId}`);
  }

  const xaiFilePath = `${XAI_PATH}${modelId.replace('.h5', '')}`;
  const shapValuesFile = `${xaiFilePath}/${label}_importance_values.json`;
  console.log(shapValuesFile);

  isFileExist(shapValuesFile, (ret) => {
    if (!ret) {
      res.status(401).send(`The SHAP values file ${shapValuesFile} does not exist`);
    } else {
      res.sendFile(shapValuesFile);
    }
  });
});

/**
 * Get LIME explanations of a specific model
 */
 router.get('/lime/explanations/:modelId/:labelId', (req, res, next) => {
  const { modelId, labelId } = req.params;
  let label = null;

  const labelsList = getLabelsListXAI(modelId);

  // Check if labelId is within bounds of labelsList
  if (labelId < 0 || labelId >= labelsList.length) {
    console.error(`Invalid labelId ${labelId}. It should be between 0 and ${labelsList.length - 1}`);
    return { error: "Invalid labelId provided" };
  } else {
    label = labelsList[labelId]; 
  }

  if (!label) {
    return res.status(400).send(`Invalid labelId: ${labelId}`);
  }

  const xaiFilePath = `${XAI_PATH}${modelId.replace('.h5', '')}`;
  const limeExpsFile = `${xaiFilePath}/${label}_lime_explanations.json`; 
  console.log(limeExpsFile);

  isFileExist(limeExpsFile, (ret) => {
    if (!ret) {
      res.status(401).send(`The LIME explanations file ${limeExpsFile} does not exist`);
    } else {
      res.sendFile(limeExpsFile);
    }
  });
});

/**
 * Get LIME feature importance values of a specific model
 */
 router.get('/lime/importance-values/:modelId/:labelId', (req, res, next) => {
  const { modelId, labelId } = req.params;
  let label = null;

  const labelsList = getLabelsListXAI(modelId);

  // Check if labelId is within bounds of labelsList
  if (labelId < 0 || labelId >= labelsList.length) {
    console.error(`Invalid labelId ${labelId}. It should be between 0 and ${labelsList.length - 1}`);
    return { error: "Invalid labelId provided" };
  } else {
    label = labelsList[labelId]; 
  }

  if (!label) {
    return res.status(400).send(`Invalid labelId: ${labelId}`);
  }

  const xaiFilePath = `${XAI_PATH}${modelId.replace('.h5', '')}`;
  const limeValuesFile = `${xaiFilePath}/${label}_lime_values.json`; 
  console.log(limeValuesFile);

  isFileExist(limeValuesFile, (ret) => {
    if (!ret) {
      res.status(401).send(`The LIME values file ${limeValuesFile} does not exist`);
    } else {
      res.sendFile(limeValuesFile);
    }
  });
});

module.exports = router;