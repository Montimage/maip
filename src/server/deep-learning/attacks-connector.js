/* eslint-disable no-plusplus */
const {
  LOG_PATH,
  MODEL_PATH,
  DEEP_LEARNING_PATH,
  PYTHON_CMD,
} = require('../constants');

const {
  spawnCommand,
} = require('../utils/utils');
  
const fs = require('fs');  

/**
 * The attack injection process status
 */
const attacksStatus = {
  isRunning: false, // indicate if the attack injection process is ongoing
  config: null, // the configuration of the last attack injection process
  lastRunAt: null, // indicate the last time of the attack injection process
}; 

const getAttacksStatus = () => attacksStatus;

const performCTGAN = (ctganConfig, callback) => {
  const {
    modelId,
    numberEpochs,
    numberSyntheticSamples,
  } = ctganConfig;
  console.log(attacksStatus);
  if (attacksStatus.isRunning) {
    console.warn('An attack injection process is on going. Only one process can be run at a time');
    return callback({
      error: 'An attack injection process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  attacksStatus.isRunning = true;
  attacksStatus.config = ctganConfig;
  attacksStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}ctgan_${modelId}.log`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/ctgan.py`, modelId, numberEpochs, numberSyntheticSamples], logFile, () => {
    attacksStatus.isRunning = false;
    console.log('Finish producing tabular synthetic samples using CTGAN');
  });
  
  return callback(attacksStatus);
};

const performPoisoningCTGAN = (poisoningAttacksConfig, callback) => {
  const {
    modelId,
    poisoningRate
  } = poisoningAttacksConfig;
  console.log(attacksStatus);
  if (attacksStatus.isRunning) {
    console.warn('An attack injection process is on going. Only one process can be run at a time');
    return callback({
      error: 'An attack injection process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  attacksStatus.isRunning = true;
  attacksStatus.config = poisoningAttacksConfig;
  attacksStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}attacks_ctgan_${modelId}.log`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/attacks.py`, modelId, 'ctgan', poisoningRate, ''], logFile, () => {
    attacksStatus.isRunning = false;
    console.log('Finish performing poisoning attack using CTGAN');
  });
  
  return callback(attacksStatus);
};

const performPoisoningRSL = (poisoningAttacksConfig, callback) => {
  const {
    modelId,
    poisoningRate
  } = poisoningAttacksConfig;
  console.log(attacksStatus);
  if (attacksStatus.isRunning) {
    console.warn('An attack injection process is on going. Only one process can be run at a time');
    return callback({
      error: 'An attack injection process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  attacksStatus.isRunning = true;
  attacksStatus.config = poisoningAttacksConfig;
  attacksStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}attacks_rsl_${modelId}.log`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/attacks.py`, modelId, 'rsl', poisoningRate, ''], logFile, () => {
    attacksStatus.isRunning = false;
    console.log('Finish performing poisoning random swapping labels attack');
  });
  
  return callback(attacksStatus);
};

const performPoisoningTLF = (targetLabelFlippingConfig, callback) => {
  const {
    poisoningAttacksConfig,
    targetClass,
  } = targetLabelFlippingConfig;
  const {
    modelId,
    poisoningRate,
  } = poisoningAttacksConfig;
  console.log(attacksStatus);
  if (attacksStatus.isRunning) {
    console.warn('An attack injection process is on going. Only one process can be run at a time');
    return callback({
      error: 'An attack injection process is on going',
    });
  }
  const inputModelFilePath = MODEL_PATH + modelId;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  attacksStatus.isRunning = true;
  attacksStatus.config = targetLabelFlippingConfig;
  attacksStatus.lastRunAt = Date.now();

  const logFile = `${LOG_PATH}attacks_rsl_${modelId}.log`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/attacks.py`, modelId, 'tlf', poisoningRate, targetClass], logFile, () => {
    attacksStatus.isRunning = false;
    console.log('Finish performing poisoning target label flipping attack');
  });
  
  return callback(attacksStatus);
};


module.exports = {
  getAttacksStatus,
  performCTGAN,
  performPoisoningCTGAN,
  performPoisoningRSL,
  performPoisoningTLF
};