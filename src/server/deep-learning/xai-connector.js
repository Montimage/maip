/* eslint-disable no-plusplus */
const {
  LOG_PATH, MODEL_PATH, TRAINING_PATH,
  DEEP_LEARNING_PATH, AC_PATH,
  PREDICTION_PATH,
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
const path = require('path');

/**
 * The XAI status
 */
 const xaiStatus = {
  isRunning: false, // indicate if the XAI process is ongoing
  config: null, // the configuration of the last XAI process
  lastRunAt: null, // indicate the last time of the XAI process
};

/**
 * Extract a single instance feature vector for LIME from prediction outputs
 * The CSVs (attacks.csv or predictions.csv) use the header order of AD_FEATURES_OUTPUT,
 * where the first 3 columns are ['ip.session_id', 'meta.direction', 'ip'] and the last is 'malware'.
 * We therefore slice columns [3, len-1) to construct the feature vector.
 */
const buildInstanceVectorFromPrediction = async (predictionId, sessionId) => {
  const attackFile = path.join(PREDICTION_PATH, predictionId, 'attacks.csv');
  const allFile = path.join(PREDICTION_PATH, predictionId, 'predictions.csv');
  let csvPath = null;
  if (fs.existsSync(attackFile)) {
    csvPath = attackFile;
  } else if (fs.existsSync(allFile)) {
    csvPath = allFile;
  } else {
    throw new Error(`No prediction CSV found for ${predictionId}`);
  }

  const content = await fsPromises.readFile(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Empty prediction CSV');
  const header = lines[0].split(',');
  const featureHeaders = header.slice(3, header.length - 1); // between ip and malware
  // iterate rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue; // too short
    if (String(cols[0]).trim() === String(sessionId).trim()) {
      // build name->value map for features, based on header
      const featureVals = cols.slice(3, cols.length - 1);
      const featureMap = {};
      for (let j = 0; j < featureHeaders.length; j++) {
        const key = featureHeaders[j];
        const num = Number(featureVals[j]);
        featureMap[key] = Number.isNaN(num) ? 0 : num;
      }
      return { featureMap, featureHeaders };
    }
  }
  throw new Error(`Session ${sessionId} not found in prediction ${predictionId}`);
}

/**
 * Run LIME for a specific flow instance based on prediction outputs
 */
const runLIMEForFlow = async (limeFlowConfig, callback) => {
  const { modelId, predictionId, sessionId, numberFeature } = limeFlowConfig;

  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({ error: `The given model file ${modelId} does not exist` });
  }

  xaiStatus.isRunning = true;
  xaiStatus.config = limeFlowConfig;
  xaiStatus.lastRunAt = Date.now();

  try {
    const { featureMap } = await buildInstanceVectorFromPrediction(predictionId, sessionId);
    // write vector to temp JSON
    const tmpDir = path.join(DEEP_LEARNING_PATH, 'xai', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const instanceJsonPath = path.join(tmpDir, `${predictionId}_${sessionId}.json`);
    await fsPromises.writeFile(instanceJsonPath, JSON.stringify(featureMap));

    const logFile = `${LOG_PATH}xai_${modelId}.log`;
    const scriptPath = `${DEEP_LEARNING_PATH}/xai-lime-instance.py`;
    spawnCommand(PYTHON_CMD, [scriptPath, modelId, instanceJsonPath, numberFeature], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing LIME explanations for a specific flow instance');
    });
    return callback(xaiStatus);
  } catch (e) {
    xaiStatus.isRunning = false;
    return callback({ error: e.message || String(e) });
  }
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
    spawnCommand(PYTHON_CMD, [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay, modelType], logFile, () => {
      xaiStatus.isRunning = false;
      console.log('Finish producing SHAP feature importance explanations');
    });
  } else {
    spawnCommand(PYTHON_CMD, [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay], logFile, () => {
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
  runLIMEForFlow,
};