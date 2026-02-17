/* eslint-disable no-plusplus */
const {
  REPORT_PATH,
  LOG_PATH,
  MODEL_PATH,
  PREDICTION_PATH,
  TRAINING_PATH,
  DEEP_LEARNING_PATH,
  DATASETS_PATH,
  ATTACKS_PATH,
  PYTHON_CMD,
} = require('../constants');
const { startMMTOnline, stopMMT } = require('../mmt/mmt-connector');
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
  spawnCommandAsync,
} = require('../utils/utils');

const fs = require('fs');
const path = require('path');
const sessionManager = require('../utils/sessionManager');

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
 * DEPRECATED: The prediction status - kept for backward compatibility
 * Use predictionSessionManager instead for multi-user support
 */
const predictingStatus = {
  isRunning: false, // indicate if the predicting process is ongoing
  lastPredictedAt: null, // indicate the time started time of the last prediction
  lastPredictedId: null, // indicate the last prediction id -> to get the result
  config: null, // the configuration of the last prediction
};

/**
 * The retrain status
 */
const retrainStatus = {
  isRunning: false, // indicate if the retraining process is ongoing
  lastRetrainAt: null, // indicate the time started time of the last retraining model
  config: null, // the configuration of the last retraining model
};

// Get the building status
const getBuildingStatus = () => buildingStatus;

const prepareTraining = (buildConfig, callback) => {
  const {
    datasets,
  } = buildConfig;
  if (!datasets || datasets.length < 2) {
    return callback({
      error: 'Invalid dataset. Please check the document and the example',
    });
  }

  const buildDatasets = [];
  for (let index = 0; index < datasets.length; index++) {
    const {
      isAttack,
      datasetId,
    } = datasets[index];
    const datasetDataPath = `${REPORT_PATH}${datasetId}/`;
    if (!isFileExistSync(datasetDataPath)) {
      return callback({
        error: `Invalid dataset. Dataset ${datasetId} does not exist`,
      });
    }
    const csvFiles = listFilesAsync(datasetDataPath, '.csv');
    for (let index2 = 0; index2 < csvFiles.length; index2++) {
      if (csvFiles[index2] !== 'security-reports.csv') {
        buildDatasets.push({
          csvPath: `${datasetDataPath}${csvFiles[index2]}`,
          isAttack,
        });
      }
    }
  }

  const newBuildConfig = {
    ...buildConfig,
    datasets: buildDatasets,
  };
  const buildId = getUniqueId();
  const trainingPath = `${TRAINING_PATH}${buildId}/`;
  createFolderSync(trainingPath);
  const buildConfigPath = `${trainingPath}build-config.json`;
  return writeTextFile(buildConfigPath, JSON.stringify(newBuildConfig), (error) => {
    if (error) {
      console.log('Failed to create buildConfig file');
      return callback({
        error: 'Failed to prepare the training location',
      });
    }
    return callback({
      buildConfig: buildConfigPath,
      buildId,
    });
  });
};

/**
 *  Start building a model
 * - Verify if all the dataset exist
 * -
 * @param {Object} buildConfig information needed for building a model
 * Example of buildConfig
 * {
 *  datasets: [
 *    {
 *      datasetId: 'my-dataset-01',
 *      isAttack: true
 *    },
 *    {
 *      datasetId: 'my-dataset-02',
 *      isAttack: false
 *    },
 *  ],
 *  total_sample: '4567',
 *  train_ratio: 0.7,
 *  train_parameters: {
 *    nb_epoch_cnn: 5,
 *    nb_epoch_sae: 2,
 *    batch_size_cnn: 16,
 *    batch_size_sae: 32
 *  }
 * }
 * @param {Function} callback callback function after setting up the building process
 */
const startBuildingModel = (buildConfig, callback) => {
  // Generate an Id for the build
  // Create the location of the build
  // Generate the build-configuration file. build-config.json
  // - convert the datasetId to dataPath
  // - Create the build-config.json file
  // - execute the command to build the model

  prepareTraining(buildConfig, (ret) => {
    if (ret.error) {
      callback({
        error: 'Failed to prepare the training location',
      });
    } else {
      console.log(ret);
      console.log('Start building the model');
      buildingStatus.isRunning = true;
      buildingStatus.config = buildConfig;
      buildingStatus.lastBuildAt = Date.now();
      buildingStatus.lastBuildId = ret.buildId;
      const logFilePath = `${LOG_PATH}training_${ret.buildId}.log`;
      spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/deep_learning.py`, ret.buildId, ret.buildConfig], logFilePath, () => {
        buildingStatus.isRunning = false;
      });
      callback(buildingStatus);
    }
  });
};

const getRetrainStatus = () => retrainStatus;

const retrainModel = (retrainConfig, callback) => {
  const {
    modelId,
    trainingDataset,
    testingDataset,
    training_parameters,
  } = retrainConfig;
  console.log(retrainConfig);
  const {
    nb_epoch_cnn,
    nb_epoch_sae,
    batch_size_cnn,
    batch_size_sae,
  } = training_parameters;

  if (retrainStatus.isRunning) {
    console.warn('An building process is on going. Only one process can be run at a time');
    return callback({
      error: 'An building process is on going',
    });
  }

  const retrainId = getUniqueId();
  const retrainPath = `${TRAINING_PATH}${retrainId}/`;
  createFolderSync(retrainPath);
  console.log(retrainPath);
  const retrainConfigPath = `${retrainPath}retrain-config.json`;
  writeTextFile(retrainConfigPath, JSON.stringify(retrainConfig), (error) => {
    if (error) {
      console.log('Failed to create retrainConfig file');
      return callback({
        error: 'Failed to create retrainConfig file',
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
  retrainStatus.config = retrainConfig;
  retrainStatus.lastRetrainId = retrainId;
  retrainStatus.lastRetrainAt = Date.now();

  const logFile = `${LOG_PATH}retraining_${retrainId.replace('.h5', '')}.log`;
  const resultsPath = `${TRAINING_PATH}${retrainId.replace('.h5', '')}/results`;
  createFolderSync(resultsPath);
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/retrain.py`, trainingDatasetFile, testingDatasetFile, resultsPath, nb_epoch_cnn, nb_epoch_sae, batch_size_cnn, batch_size_sae,], logFile, () => {
    retrainStatus.isRunning = false;
    console.log('Finish retraining the model');
  });

  return callback({
    retrainConfig: retrainConfigPath,
    retrainId,
  });
};

/**
 * Stop an online prediction
 */
const stopOnlinePrediction = (callback) => {
  console.log('Going to stop online prediction');
  stopMMT(() => {
    predictingStatus.isRunning = false;
    return callback(predictingStatus);
  });
};

/**
 * Start online prediction process
 * - Read the list of completed report file (which has both .csv and .sem files)
 * - Execute the prediction process for the one that has not been processed (not in the list of processedReports)
 * - Recursive until there is no report to process.
 * @param {String} reportPath Path to the folder where reports are being generated
 * @param {String} modelPath Path to the model which is being used for prediction
 * @param {String} predictionPath Path to the location where the prediction output will be stored
 * @param {String} logPath Path to the log of what's going on with the prediction process
 * @param {Number} currentIndex The index of the report is going to be processed
 */
const startOnlinePrediction = (reportPath, modelPath, predictionPath, logPath, currentIndex) => {
  if (!predictingStatus.isRunning) {
    console.log('The online prediction process has been terminated');
    return;
  }
  console.log(`startOnlinePrediction: ${currentIndex}`);
  let allCSVFiles = listFilesByTypeAsync(reportPath, '.csv');
  let allSEMFiles = listFilesByTypeAsync(reportPath, '.sem');
  let currentReport = allCSVFiles[currentIndex];
  while (!currentReport && predictingStatus.isRunning) {
    // waiting for the report to be generated
    console.log(`Waiting for ${currentIndex}`);
    // Should put some sleep?
    allCSVFiles = listFilesAsync(reportPath, 'csv');
    currentReport = allCSVFiles[currentIndex];
  }

  console.log(`Got the report: ${currentReport}`);
  // The report exist
  const currentSemFile = `${currentReport}.sem`;
  console.log(`Sem files: ${allSEMFiles.length}`);
  while (allSEMFiles.indexOf(currentSemFile) === -1 && predictingStatus.isRunning) {
    // wait until there is a .sem file - which means the report has been completed
    console.log(`Waiting for ${currentSemFile}`);
    // Should put some sleep?
    allSEMFiles = listFilesAsync(reportPath, 'sem');
    console.log(`Sem files: ${allSEMFiles.length}`);
  }
  // We have the .sem file, going to process the report
  console.log(`Got the sem file: ${currentSemFile}`);
  const csvPath = `${reportPath}/${currentReport}`;
  spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/prediction.py`, csvPath, modelPath, `${predictionPath}/${currentReport}/`], logPath, () => {
    startOnlinePrediction(reportPath, modelPath, predictionPath, logPath, currentIndex + 1);
  });
};

/**
 * Start a predicting process
 * - verify if the model exist
 * - verify if the input traffic exist
 * - Execute the MMT to analyze the traffic
 * - on the callback, execute the prediction to get the result
 *
 * @param {Object} predictConfig configuration relates to the predicting process
 * Example of a predictConfig
 * - Analyze a pcap file
 * {
 *  modelId: 'model-001',
 *  inputTraffic: {
 *    type: 'pcapFile',
 *    value: 'my-pcap-file.pcap'
 *  }
 * }
 * - Analyze a dataset
 * {
 *  modelId: 'model-001',
 *  inputTraffic: {
 *    type: 'dataset',
 *    value: 'my-dataset-01'
 *  }
 * }
 * - Analyze a live traffic
 * {
 *  modelId: 'model-001',
 *  inputTraffic: {
 *    type: 'net',
 *    value: 'eth0'
 *  }
 * }
 *
 * - Analyze a report
 * {
 *  modelId: 'model-01',
 *  inputTraffic:{
 *    type: 'report',
 *    value: {
 *      reportId: 'report-tcp_segmented_fpm.pcap-40f5e3ce-d0a7-4cd7-8f98-d9016bbbfd79',
 *      reportFileName: '1675545880.212144_0_tcp_segmented_fpm.pcap.csv'
 *    }
 *  }
 * }
 * @param {Function} callback callback function after setting up the predicting process
 */
const startPredicting = async (predictConfig, callback) => {
  const {
    modelId,
    inputTraffic,
  } = predictConfig;
  const modelPath = `${MODEL_PATH}${modelId}`;
  const logFilePath = `${LOG_PATH}predict_`;
  const predictionId = getUniqueId();
  const predictionPath = `${PREDICTION_PATH}${predictionId}/`;
  const logFile = `${logFilePath}${predictionId}.log`;
  isFileExist(modelPath, async (exist) => {
    if (!exist) {
      callback({
        error: `Model ${modelId} doest not exist`,
      });
    } else {
      const {
        type,
        value,
      } = inputTraffic;
      switch (type) {
        case 'report':
          // eslint-disable-next-line no-case-declarations
          const csvPath = `${REPORT_PATH}/${value.reportId}/${value.reportFileName}`;
          isFileExist(csvPath, async (report) => {
            if (!report) {
              callback({
                error: `The input traffic ${JSON.stringify(value)} doest not exist`,
              });
            } else {
              // Create session in session manager
              const session = sessionManager.createSession('prediction', predictionId, 'offline', { config: predictConfig });
              
              spawnCommand(PYTHON_CMD, [`${DEEP_LEARNING_PATH}/prediction.py`, csvPath, modelPath, predictionPath], logFile, () => {
                // Mark session as completed
                sessionManager.completeSession('prediction', predictionId);
              });
              
              // Return session data in legacy format
              callback({
                isRunning: session.isRunning,
                lastPredictedAt: session.createdAt,
                lastPredictedId: session.sessionId,
                config: session.config
              });
            }
          });
          break;
        case 'online':
          // Start MMTOnline
          // eslint-disable-next-line no-case-declarations
          startMMTOnline(value, (mmtStatus) => {
            console.log('MMTStatus:');
            // isRunning: true,
            // sessionId,
            // isOnlineMode: true,
            // startedAt: Date.now(),
            console.log(mmtStatus);
            if (mmtStatus && mmtStatus.isRunning) {
              // MMT has been started, start processing the report
              // Create session in session manager
              const session = sessionManager.createSession('prediction', predictionId, 'online', { config: predictConfig });
              
              const { sessionId } = mmtStatus;
              const csvRootPath = `${REPORT_PATH}/report-${sessionId}`;
              
              // Return session data in legacy format
              callback({
                isRunning: session.isRunning,
                lastPredictedAt: session.createdAt,
                lastPredictedId: session.sessionId,
                config: session.config
              });
              
              startOnlinePrediction(csvRootPath, modelPath, predictionPath, logFile, 0);
            }
          });
          break;
        case 'pcap':
          // get the pcap file
          // move the pcap file to the pcaps/ folder
          // execute startMMTOffline
          // analysing based on the result of startMMTOffline
          break;
        default:
          callback({
            error: `Unsupported input traffic type: ${type}`,
          });
          break;
      }
    }
  });

  // callback(predictingStatus);
};
/**
 * Get status of the current prediction
 * Returns legacy format for backward compatibility
 */
const getPredictingStatus = () => {
  // Return legacy status format from session manager
  return sessionManager.getLegacyStatus('prediction');
};


module.exports = {
  getBuildingStatus,
  startBuildingModel,
  getRetrainStatus,
  retrainModel,
  getPredictingStatus,
  startPredicting,
  stopOnlinePrediction,
};
