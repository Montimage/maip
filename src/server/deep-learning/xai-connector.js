/* eslint-disable no-plusplus */
const {
  LOG_PATH,
  MODEL_PATH,
  DEEP_LEARNING_PATH, AC_PATH,
  PYTHON_CMD,
} = require('../constants');

const {
  spawnCommand,
} = require('../utils/utils');
  
const fs = require('fs');  

/**
 * The XAI status
 */
 const xaiStatus = {
  isRunning: false, // indicate if the XAI process is ongoing
  config: null, // the configuration of the last XAI process
  lastRunAt: null, // indicate the last time of the XAI process
}; 

const getXAIStatus = () => xaiStatus;

const runSHAP = (shapConfig, callback) => {
  const {
    modelId,
    numberSamples,
    maxDisplay,
  } = shapConfig;
  console.log(xaiStatus);
  if (xaiStatus.isRunning) {
    console.warn('An explaining process is on going. Only one process can be run at a time');
    return callback({
      error: 'An explaining process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  xaiStatus.isRunning = true;
  xaiStatus.config = shapConfig;
  xaiStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}xai_${modelId}.log`;
  let scriptPath = `${DEEP_LEARNING_PATH}/xai-shap.py`;  // default path
  if(modelId.startsWith("ac-")) {
    scriptPath = `${AC_PATH}/ac_xai_shap.py`;
  }

  spawnCommand(PYTHON_CMD, [scriptPath, modelId, numberSamples, maxDisplay], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing SHAP feature importance explanations');
  });
  
  return callback(xaiStatus);
};

const runLIME = (limeConfig, callback) => {
  const {
    modelId,
    sampleId,
    numberFeature,
  } = limeConfig;
  console.log(xaiStatus);
  if (xaiStatus.isRunning) {
    console.warn('An explaining process is on going. Only one process can be run at a time');
    return callback({
      error: 'An explaining process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  xaiStatus.isRunning = true;
  xaiStatus.config = limeConfig;
  xaiStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}xai_${modelId}.log`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/xai-lime.py`, modelId, sampleId, numberFeature], logFile, () => {
    xaiStatus.isRunning = false;
    console.log('Finish producing LIME explanations for a particular instance');
  });
  
  return callback(xaiStatus);
};

module.exports = {
  getXAIStatus,
  runSHAP,
  runLIME,
};