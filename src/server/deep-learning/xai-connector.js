/* eslint-disable no-plusplus */
const {
  LOG_PATH, MODEL_PATH, TRAINING_PATH,
  DEEP_LEARNING_PATH, AC_PATH,
  PYTHON_CMD,
} = require('../constants');
const {
  readTextFile,
} = require('../utils/file-utils');
const {
  spawnCommand,
  spawnCommandAsync,
} = require('../utils/utils');

const fs = require('fs');
const fsPromises = require('fs').promises;

/**
 * The XAI status
 */
 const xaiStatus = {
  isRunning: false, // indicate if the XAI process is ongoing
  config: null, // the configuration of the last XAI process
  lastRunAt: null, // indicate the last time of the XAI process
};

const getXAIStatus = () => xaiStatus;

const getModelType = async (modelId) => {
  if (!modelId.startsWith("ac-")) return null;  // Return null for non "ac-" models

  const buildConfigFilePath = `${TRAINING_PATH}${modelId}/build-config.json`;
  try {
    const buildConfig = await fsPromises.readFile(buildConfigFilePath, 'utf-8');
    const configData = JSON.parse(buildConfig);
    return configData.modelType;
  } catch (err) {
    console.error("Error reading the file:", err);
    return null;
  }
}

const runSHAP = async (shapConfig, callback) => {
  const {
    modelId,
    numberBackgroundSamples,
    numberExplainedSamples,
    maxDisplay,
  } = shapConfig;
  //console.log(xaiStatus);
  /*if (xaiStatus.isRunning) {
    console.warn('An explaining process is on going. Only one process can be run at a time');
    return callback({
      error: 'An explaining process is on going',
    });
  }*/
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
  const modelType = await getModelType(modelId);
  if (modelId.startsWith("ac-")) {
    scriptPath = `${AC_PATH}/ac_xai_shap.py`;
    await spawnCommandAsync(PYTHON_CMD, [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay, modelType], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing SHAP feature importance explanations');
    });
  } else {
    await spawnCommandAsync(PYTHON_CMD, [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing LIME explanations for a particular instance');
    });
  }

  return callback(xaiStatus);
};

const runLIME = async (limeConfig, callback) => {
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
  let scriptPath = `${DEEP_LEARNING_PATH}/xai-lime.py`;  // default path
  const modelType = await getModelType(modelId);

  if (modelId.startsWith("ac-")) {
    scriptPath = `${AC_PATH}/ac_xai_lime.py`;
    spawnCommand(PYTHON_CMD, [scriptPath, modelId, sampleId, numberFeature, modelType], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing LIME explanations for a particular instance');
    });
  } else {
    spawnCommand(PYTHON_CMD, [scriptPath, modelId, sampleId, numberFeature], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing LIME explanations for a particular instance');
    });
  }


  return callback(xaiStatus);
};

module.exports = {
  getXAIStatus,
  runSHAP,
  runLIME,
};