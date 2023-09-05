/* eslint-disable no-plusplus */
const {
  TRAINING_PATH, MODEL_PATH, LOG_PATH,
  PYTHON_CMD, AC_PATH, ATTACKS_PATH,
} = require('../constants');
const {
  isFileExist,
  isFileExistSync,
  listFilesAsync,
  createFolderSync,
  writeTextFile,
  listFilesByTypeAsync,
} = require('../utils/file-utils');
const {
  spawnCommand,
  getUniqueId,
} = require('../utils/utils');

const fs = require('fs');
const path = require('path');

/**
 * The building status
 */
const buildingStatus = {
  isRunning: false, // indicates if the building process is on going
  lastBuildAt: null, // indicates the started time of the last build
  lastBuildId: null, // indicates the id of the last build
  config: null, // the configuration of the last build
};

/**
 * The retrain status
 */
 const retrainStatus = {
  isRunning: false, // indicate if the retraining process is ongoing
  lastRetrainAt: null, // indicate the time started time of the last retraining model
  config: null, // the configuration of the last retraining model
};

const getRetrainStatusAC = () => retrainStatus;

const startRetrainModelAC = (retrainACConfig, callback) => {
  const {
    modelId,
    datasetsConfig,
  } = retrainACConfig;
  const {
    trainingDataset,
    testingDataset,
  } = datasetsConfig;
  console.log(retrainACConfig);
  
  if (retrainStatus.isRunning) {
    console.warn('An retrain process is on going. Only one process can be run at a time');
    return callback({
      error: 'An retrain process is on going',
    });
  }

  const retrainId = getUniqueId();
  const retrainPath = `${TRAINING_PATH}${retrainId}/`;
  createFolderSync(retrainPath);
  console.log(retrainPath);
  const retrainACConfigPath = `${retrainPath}retrain-config.json`;
  writeTextFile(retrainACConfigPath, JSON.stringify(retrainACConfig), (error) => {
    if (error) {
      console.log('Failed to create retrainACConfig file');
      return callback({
        error: 'Failed to create retrainACConfig file',
      });
    }
  });

  const attacksPath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/`;
  const trainingPath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/`;

  let trainingDatasetFile = null;
  let testingDatasetFile = null;
  
  if (isFileExistSync(path.join(attacksPath, trainingDataset))) {
    trainingDatasetFile = path.join(attacksPath, trainingDataset);
  } else if (isFileExistSync(path.join(trainingPath, trainingDataset))) {
    trainingDatasetFile = path.join(trainingPath, trainingDataset);
  } else {
    return callback({
      error: `Invalid training dataset`,
    });
  }
  console.log(path.join(trainingPath, testingDataset));
  if (isFileExistSync(path.join(trainingPath, testingDataset))) {
    testingDatasetFile = path.join(trainingPath, testingDataset);
  } else {
    return callback({
      error: `Invalid testing dataset`,
    });
  }

  console.log(trainingDatasetFile);
  console.log(testingDatasetFile);

  const datasetsPath = `${TRAINING_PATH}${retrainId.replace('.h5', '')}/datasets`;
  createFolderSync(datasetsPath);
  fs.copyFile(trainingDatasetFile, path.join(datasetsPath, 'Train_samples.csv'), (err) => {
    if (err) {
      callback(err);
    }
  });
  fs.copyFile(testingDatasetFile, path.join(datasetsPath, 'Test_samples.csv'), (err) => {
    if (err) {
      callback(err);
    }
  });

  const inputModelFilePath = `${MODEL_PATH}${modelId}`;
  if (!fs.existsSync(inputModelFilePath)) {
    return callback({
      error: `The given model file ${modelId} does not exist`,
    });
  }

  retrainStatus.isRunning = true;
  retrainStatus.config = retrainACConfig;
  retrainStatus.lastRetrainId = retrainId;
  retrainStatus.lastRetrainAt = Date.now();

  const logFile = `${LOG_PATH}retraining_${retrainId.replace('.h5', '')}.log`;
  const resultsPath = `${TRAINING_PATH}${retrainId.replace('.h5', '')}/results`;
  createFolderSync(resultsPath);
  spawnCommand(PYTHON_CMD, [`${AC_PATH}/ac_retrain_models.py`, modelId, trainingDatasetFile, testingDatasetFile, resultsPath], logFile, () => {
    retrainStatus.isRunning = false;
    console.log('Finish retraining the model');
  });
  
  return callback({
    retrainACConfig: retrainACConfigPath,
    retrainId,
  });

}

const getBuildingStatusAC = () => buildingStatus;

const startBuildingModelAC = (buildACConfig, callback) => {
  console.log('Start building the AC model');
  const buildId = getUniqueId();
  const modelId = `ac-${buildId}`;
  const buildPath = `${TRAINING_PATH}${modelId}/`;
  createFolderSync(buildPath);
  console.log(buildPath);

  buildingStatus.isRunning = true;
  buildingStatus.config = buildACConfig;
  buildingStatus.lastBuildAt = Date.now();
  buildingStatus.lastBuildId = buildId;

  const buildConfigPath = `${buildPath}build-config.json`;
  writeTextFile(buildConfigPath, JSON.stringify(buildACConfig), (error) => {
    if (error) {
      console.log('Failed to create buildConfig file');
      return callback({
        error: 'Failed to create buildConfig file',
      });
    }
  });

  // AC model is actually buildACConfig :D
  // const modelFilePath = `${MODEL_PATH}${modelId}`;
  // writeTextFile(modelFilePath, JSON.stringify(buildACConfig), (error) => {
  //   if (error) {
  //     console.log('Failed to create model file');
  //     return callback({
  //       error: 'Failed to create model file',
  //     });
  //   }
  // });

  const logFilePath = `${LOG_PATH}training_${modelId}.log`;
  const resultsPath = `${TRAINING_PATH}${modelId}/results`;
  createFolderSync(resultsPath);
  spawnCommand(PYTHON_CMD, [`${AC_PATH}/ac_build_models.py`, modelId, buildConfigPath, resultsPath], logFilePath, () => {
    buildingStatus.isRunning = false;
  });
  callback(buildingStatus);
}

module.exports = {
  getBuildingStatusAC,
  startBuildingModelAC,
  getRetrainStatusAC,
  startRetrainModelAC,
};
  