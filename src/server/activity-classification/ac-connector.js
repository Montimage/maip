/* eslint-disable no-plusplus */
const {
  TRAINING_PATH, MODEL_PATH,
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

// Get the building status
const getBuildingStatusAC = () => buildingStatus;

const startBuildingModelAC = (buildConfig) => {
  console.log('Start building the AC model');
  const buildId = getUniqueId();
  const modelId = `ac-${buildId}`;
  const buildPath = `${TRAINING_PATH}${modelId}/`;
  createFolderSync(buildPath);
  console.log(buildPath);

  buildingStatus.isRunning = true;
  buildingStatus.config = buildConfig;
  buildingStatus.lastBuildAt = Date.now();
  buildingStatus.lastBuildId = buildId;

  const buildConfigPath = `${buildPath}build-config.json`;
  writeTextFile(buildConfigPath, JSON.stringify(buildConfig), (error) => {
    if (error) {
      console.log('Failed to create buildConfig file');
      return callback({
        error: 'Failed to create buildConfig file',
      });
    }
  });

  const buildStatusFilePath = `${TRAINING_PATH}${modelId}/buildingStatus.json`;
  console.log(buildStatusFilePath);
  fs.writeFile(buildStatusFilePath, JSON.stringify(buildingStatus), (error) => {
    if (error) {
      console.log(`Error saving buildStatus of model ${modelId} to file: ${error}`);
    } else {
      console.log(`BuildStatus of model ${modelId} saved to file: ${buildStatusFilePath}`);
    }
  });

  // AC model is actually buildConfig :D
  const modelFilePath = `${MODEL_PATH}ac-${buildId}`;
  writeTextFile(modelFilePath, JSON.stringify(buildConfig), (error) => {
    if (error) {
      console.log('Failed to create model file');
      return callback({
        error: 'Failed to create model file',
      });
    }
  });
};

module.exports = {
  getBuildingStatusAC,
  startBuildingModelAC
};
  