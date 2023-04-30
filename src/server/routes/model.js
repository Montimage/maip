/* eslint-disable no-unused-vars */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const csv = require('csv-parser');
const router = express.Router();
const {
  MODEL_PATH, TRAINING_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');
const {
  replaceDelimiterInCsv
} = require('../utils/utils');

/* GET built models with lastBuildAt */
router.get('/', async (req, res, next) => {
  try {
    const files = await readdirAsync(MODEL_PATH);
    const allModels = files.filter(file => path.extname(file) === '.h5');
    const modelList = [];

    for (const modelId of allModels) {
      const buildingStatusPath = path.join(TRAINING_PATH, modelId.replace('.h5', ''), 'buildingStatus.json');
      const buildingStatus = await readFileAsync(buildingStatusPath);
      const lastBuildAt = JSON.parse(buildingStatus).lastBuildAt;
      const buildConfigPath = path.join(TRAINING_PATH, modelId.replace('.h5', ''), 'build-config.json');
      const buildConfig = await readFileAsync(buildConfigPath);
      const config = JSON.parse(buildConfig);
      modelList.push({ modelId: modelId, lastBuildAt, buildConfig: config });
    }
    res.send({ models: modelList });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

/** Download a model file */
router.get('/:modelId/download', (req, res, next) => {
  const { modelId } = req.params;
  const modelFilePath = `${MODEL_PATH}${modelId}`;
  isFileExist(modelFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The model file ${modelId} does not exist`);
    } else {
      res.sendFile(modelFilePath);
    }
  });
});

/**
 * Get the information of a model
 */
router.get('/:modelId/build-config', (req, res, next) => {
  const { modelId } = req.params;
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/build-config.json`, (err, buildConfig) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ buildConfig });
    }
  });
});

router.get('/:modelId/confusion-matrix', (req, res, next) => {
  const { modelId } = req.params;
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/conf_matrix_sae_test-cnn.csv`, (err, matrix) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ matrix });
    }
  });
});

router.get('/:modelId/datasets/training', (req, res, next) => {
  const { modelId } = req.params;
  const trainingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Train_samples.csv`;
  isFileExist(trainingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The training samples file ${modelId} does not exist`);
    } else {
      res.sendFile(trainingSamplesFilePath);
    }
  });
});

router.get('/:modelId/datasets/testing', (req, res, next) => {
  const { modelId } = req.params;
  const testingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;
  isFileExist(testingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The testing samples file ${modelId} does not exist`);
    } else {
      res.sendFile(testingSamplesFilePath);
    }
  });
});

router.get('/:modelId/stats', (req, res, next) => {
  const { modelId } = req.params;
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/stats.csv`, (err, stats) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ stats });
    }
  });
});

router.get('/:modelId', (req, res, next) => {
  const { modelId } = req.params;

  // Get the stats for the model
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/stats.csv`, (err, stats) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
      return;
    }

    // Get the last build time for the model
    readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/buildingStatus.json`, (err, buildingStatus) => {
      if (err) {
        res.status(401).send({ error: 'Something went wrong!' });
        return;
      }

      // Get the build config for the model
      readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/build-config.json`, (err, buildConfig) => {
        if (err) {
          res.status(401).send({ error: 'Something went wrong!' });
          return;
        }

        // Get the confusion matrix for the model
        readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/conf_matrix_sae_test-cnn.csv`, (err, matrix) => {
          if (err) {
            res.status(401).send({ error: 'Something went wrong!' });
            return;
          }

          // Get the training samples for the model
          const trainingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Train_samples.csv`;
          isFileExist(trainingSamplesFilePath, (ret) => {
            if (!ret) {
              res.status(401).send(`The training samples file of model ${modelId} does not exist`);
              return;
            }

            // Get the testing samples for the model
            const testingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;
            isFileExist(testingSamplesFilePath, (ret) => {
              if (!ret) {
                res.status(401).send(`The testing samples file of model ${modelId} does not exist`);
                return;
              }

              // Get the testing samples for the model
              readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/predicted_probabilities.csv`, (err, predictedProbs) => {
                if (!ret) {
                  res.status(401).send(`The predicted probabilities file of model ${modelId} does not exist`);
                  return;
                }
              
                const status = JSON.parse(buildingStatus);
                console.log(status.lastBuildAt);

                // Send the response with all the data for the model
                res.send({
                  stats: stats,
                  lastBuildAt: status.lastBuildAt,
                  buildConfig: buildConfig,
                  confusionMatrix: matrix,
                  trainingSamples: trainingSamplesFilePath,
                  testingSamples: testingSamplesFilePath,
                  predictedProbs: predictedProbs,
                });
              });
            });
          });
        });
      });
    });
  });
});

router.put('/:modelId', (req, res, next) => {
  const { modelId } = req.params;
  const { newModelId } = req.body;
  const modelFilePath = `${MODEL_PATH}${modelId}`;
  const newModelFilePath = `${MODEL_PATH}${newModelId}`;
  const trainingModelDirPath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;
  const newTrainingModelDirPath = `${TRAINING_PATH}${newModelId.replace('.h5', '')}`;

  // Check if new model directory already exists
  if (fs.existsSync(newModelFilePath)) {
    return res.status(400).send({
      error: `Model ${newModelId} already exists`,
    });
  }

  // Rename model's name
  fs.rename(modelFilePath, newModelFilePath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send({
        error: `Error renaming model's name from ${modelId} to ${newModelId}`,
      });
    }
    // Rename model's training directory
    fs.rename(trainingModelDirPath, newTrainingModelDirPath, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send({
          error: `Error renaming model's training directory from ${modelId} to ${newModelId}`,
        });
      }
          
      console.log(`Model ${modelId} has been renamed to ${newModelId}`);
      res.send({
        result: `Model ${modelId} has been renamed to ${newModelId}`,
      });
    });
  });
});

router.delete('/:modelId', (req, res, next) => {
  const { modelId } = req.params;
  const modelFilePath = `${MODEL_PATH}${modelId}`;
  
  fs.unlink(modelFilePath, (err, ret) => {
    if (err) {
      console.error(err);
      res.send({
        error: `Error deleting model ${modelId}`,
      });
    } else {
      console.log(`Model ${modelId} has been deleted`);
      res.send({
        result: ret,
      });
    }
  });
});

router.get('/:modelId/datasets/:datasetType/download', (req, res, next) => {
  const { modelId, datasetType } = req.params;
  const datasetName = `${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}_samples.csv`;
  const datasetFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/${datasetName}`;
  isFileExist(datasetFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The ${datasetType} samples of model ${modelId} does not exist`);
    } else {
      res.setHeader('Content-Type', 'text/csv'); 
      res.setHeader('Content-Disposition', `attachment; filename="${datasetName}"`);
      const fileStream = fs.createReadStream(datasetFilePath);
      fileStream.pipe(res);
    }
  });
});

router.get('/:modelId/datasets/:datasetType/view', (req, res, next) => {
  const { modelId, datasetType } = req.params;
  const datasetName = `${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}_samples.csv`;
  const datasetFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/${datasetName}`;
  const datasetToView = `${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}_samples_view.csv`;
  const datasetToViewPath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/${datasetToView}`; 
  replaceDelimiterInCsv(datasetFilePath, datasetToViewPath);
  console.log(datasetToViewPath);

  isFileExist(datasetToViewPath, (ret) => {
    if (!ret) {
      res.status(401).send(`The ${datasetType} samples of model ${modelId} does not exist`);
    } else {
      res.setHeader('Content-Type', 'text/csv'); 
      res.setHeader('Content-Disposition', `attachment; filename="${datasetName}"`);
      const fileStream = fs.createReadStream(datasetToViewPath);
      fileStream.pipe(res);
    }
  });
});

module.exports = router;
