/* eslint-disable no-unused-vars */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const csv = require('csv-parser');
const fsex = require('fs-extra'); // Use fs-extra
const router = express.Router();
const {
  OUTPUT_DIRS,
  MODEL_PATH, TRAINING_PATH, PREDICTION_PATH, XAI_PATH, ATTACKS_PATH,
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
    // Check if MODEL_PATH exists and create it if it does not
    if (!fs.existsSync(MODEL_PATH)) {
      fs.mkdirSync(MODEL_PATH, { recursive: true });
    }

    const files = await readdirAsync(MODEL_PATH);
    // As users can change model's name, should return all files in this dir
    const allModels = files; //.filter(file => path.extname(file) === '.h5');
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
    console.error(err.stack);
    res.status(500).send(`Server Error: ${err.message}`);
  }
});

router.delete('/app/:app', async (req, res, next) => {
  const { app } = req.params;

  try {
    // For 'models' directory
    const filesInModelDir = await fsex.readdir(MODEL_PATH);
    let filesToDelete = [];
    if (app === "ac") {
      filesToDelete = filesInModelDir.filter(name => name.startsWith('ac-'));
    } else if (app === "ad") {
      filesToDelete = filesInModelDir.filter(name => !name.startsWith('ac-'));
    }
    
    for (let file of filesToDelete) {
      await fsex.unlink(`${MODEL_PATH}/${file}`);
      //console.log(`Model file ${file} has been deleted from ${filesInModelDir}`);
    }
    
    for (let dir of OUTPUT_DIRS) {
      const filesAndDirsInCurrentDir = await fsex.readdir(dir);
      // For other directories, remove all folders
      let dirsToDelete = [];
      if (app === "ac") {
        dirsToDelete = filesAndDirsInCurrentDir.filter(name => name.startsWith('ac-'));
      } else if (app === "ad") {
        dirsToDelete = filesAndDirsInCurrentDir.filter(name => !name.startsWith('ac-'));
      }

      for (let folder of dirsToDelete) {
        await fsex.remove(`${dir}/${folder}`);
        //console.log(`Model directory ${folder} has been deleted from ${dir}`);
      }
    }

    res.send({
      result: `Deletion of all ${app} models successful`
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: `Error deleting all ${app} models`,
    });
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
  const basePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;
  
  // Check which config file exists first to avoid error logs
  const buildConfigPath = `${basePath}/build-config.json`;
  const retrainConfigPath = `${basePath}/retrain-config.json`;
  
  if (fs.existsSync(buildConfigPath)) {
    // Regular built model
    readTextFile(buildConfigPath, (err, buildConfig) => {
      if (err) {
        res.status(401).send({ error: 'Something went wrong!' });
      } else {
        res.send({ buildConfig });
      }
    });
  } else if (fs.existsSync(retrainConfigPath)) {
    // Retrained model
    readTextFile(retrainConfigPath, (err, retrainConfig) => {
      if (err) {
        res.status(401).send({ error: 'Something went wrong!' });
      } else {
        res.send({ buildConfig: retrainConfig });
      }
    });
  } else {
    res.status(401).send({ error: 'Something went wrong!' });
  }
});

router.get('/:modelId/confusion-matrix', (req, res, next) => {
  const { modelId } = req.params;
  const basePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;
  
  // Check which file exists first to avoid error logs
  const retrainedPath = `${basePath}/confusion_matrix.csv`;
  const regularPath = `${basePath}/results/confusion_matrix.csv`;
  
  if (fs.existsSync(retrainedPath)) {
    // Retrained model (no results/ subdirectory)
    readTextFile(retrainedPath, (err, matrix) => {
      if (err) {
        res.status(401).send({ error: 'Something went wrong!' });
      } else {
        res.send({ matrix });
      }
    });
  } else if (fs.existsSync(regularPath)) {
    // Regular model (with results/ subdirectory)
    readTextFile(regularPath, (err, matrix) => {
      if (err) {
        res.status(401).send({ error: 'Something went wrong!' });
      } else {
        res.send({ matrix });
      }
    });
  } else {
    res.status(401).send({ error: 'Something went wrong!' });
  }
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
  const basePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;
  
  // Try retrained model location first (no results/ subdirectory)
  readTextFile(`${basePath}/stats.csv`, (err, stats) => {
    if (err) {
      // Fall back to regular model location (with results/ subdirectory)
      readTextFile(`${basePath}/results/stats.csv`, (err2, stats2) => {
        if (err2) {
          res.status(401).send({ error: 'Something went wrong!' });
        } else {
          res.send({ stats: stats2 });
        }
      });
    } else {
      res.send({ stats });
    }
  });
});

router.get('/:modelId', (req, res, next) => {
  const { modelId } = req.params;
  const basePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;

  // Try retrained model location first (no results/ subdirectory)
  readTextFile(`${basePath}/stats.csv`, (err, stats) => {
    if (!err) {
      // This is a retrained model - return simplified response
      readTextFile(`${basePath}/confusion_matrix.csv`, (err2, matrix) => {
        res.send({
          stats: stats,
          confusionMatrix: matrix || '',
          lastBuildAt: new Date().toISOString(),
          buildConfig: '{}',
          isRetrainedModel: true
        });
      });
      return;
    }
    
    // Fall back to regular model location (with results/ subdirectory)
    readTextFile(`${basePath}/results/stats.csv`, (err, stats) => {
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
        readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/confusion_matrix.csv`, (err, matrix) => {
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
              });
            });
          });
        });
      });
    });
    });
  });
});

router.get('/:modelId/probabilities', (req, res, next) => {
  const { modelId } = req.params;
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/predicted_probabilities.csv`, (err, predictedProbs) => {
    if (err) {
      res.status(401).send(`The predicted probabilities file of model ${modelId} does not exist`);
      return;
    } else {
      res.send({
        probs: predictedProbs,
      });  
    }
  });
});

// TODO: combine 'predictions.csv' and 'predicted_probabilities.csv' into 1 csv file ???
router.get('/:modelId/predictions', (req, res, next) => {
  const { modelId } = req.params;
  const basePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}`;
  
  // Check which file exists first to avoid error logs
  const retrainedPath = `${basePath}/predictions.csv`;
  const regularPath = `${basePath}/results/predictions.csv`;
  
  if (fs.existsSync(retrainedPath)) {
    // Retrained model (no results/ subdirectory)
    readTextFile(retrainedPath, (err, predictions) => {
      if (err) {
        res.status(401).send(`The predictions file of model ${modelId} does not exist`);
      } else {
        res.send({ predictions });
      }
    });
  } else if (fs.existsSync(regularPath)) {
    // Regular model (with results/ subdirectory)
    readTextFile(regularPath, (err, predictions) => {
      if (err) {
        res.status(401).send(`The predictions file of model ${modelId} does not exist`);
      } else {
        res.send({ predictions });
      }
    });
  } else {
    res.status(401).send(`The predictions file of model ${modelId} does not exist`);
  }
});

router.put('/:modelId', async (req, res, next) => {
  const { modelId } = req.params;
  const { newModelId } = req.body;
  const modelFilePath = `${MODEL_PATH}${modelId}`;
  const newModelFilePath = `${MODEL_PATH}${newModelId}`;

  // Check if new model directory already exists
  if (fs.existsSync(newModelFilePath)) {
    return res.status(400).send({
      error: `Model ${newModelId} already exists`,
    });
  }

  try {
    // Rename the main model file
    await fsex.rename(modelFilePath, newModelFilePath);
    console.log(`Model file ${modelId} has been renamed to ${newModelId}`);

    // Loop through the directories and rename the model folder inside each
    for (let dir of OUTPUT_DIRS) {
      const modelDirPath = `${dir}/${modelId.replace('.h5', '')}`;
      const newModelDirPath = `${dir}/${newModelId}`;

      if (fsex.existsSync(modelDirPath)) {
        await fsex.rename(modelDirPath, newModelDirPath);
        console.log(`Model directory ${modelDirPath} has been renamed to ${newModelDirPath}`);
      }
    }

    res.send({
      result: `Model ${modelId} has been renamed to ${newModelId}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: `Error renaming model from ${modelId} to ${newModelId}`,
    });
  }
});

router.delete('/:modelId', async (req, res, next) => {
  const { modelId } = req.params;
  const modelFilePath = `${MODEL_PATH}${modelId}`;
  console.log(modelFilePath);

  try {
    // Delete the main model file
    await fsex.unlink(modelFilePath);
    console.log(`Model file ${modelId} has been deleted`);

    // Loop through the directories and delete the model folder inside each
    for (let dir of OUTPUT_DIRS) {
      const modelDirPath = `${dir}/${modelId}`;
      if (await fsex.pathExists(modelDirPath)) {
        await fsex.remove(modelDirPath);
        console.log(`Model directory ${modelDirPath} has been deleted`);
      }
    }

    res.send({
      result: `Model ${modelId} has been deleted successfully`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: `Error deleting model ${modelId}`,
    });
  }
});

router.get('/:modelId/datasets/', async (req, res, next) => {
  const { modelId } = req.params;
  try {
    const datasetsPath = path.join(TRAINING_PATH, modelId.replace('.h5', ''), 'datasets')
    const files = await readdirAsync(datasetsPath);
    const allDatasets = files.filter(file => {
      const fileName = path.basename(file, '.csv');
      return path.extname(file) === '.csv' && !fileName.includes('_view');
    });
    res.send({ datasets: allDatasets });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
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
