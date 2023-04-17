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

/* GET built models name */
/* router.get('/', (req, res, next) => {
  listFiles(MODEL_PATH, '.h5', (files) => {
    res.send({
      models: files,
    });
  });
}); */

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
              res.status(401).send(`The training samples file ${modelId} does not exist`);
              return;
            }

            // Get the testing samples for the model
            const testingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;
            isFileExist(testingSamplesFilePath, (ret) => {
              if (!ret) {
                res.status(401).send(`The testing samples file ${modelId} does not exist`);
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

router.get('/:modelId/datasets/:datasetType/view', (req, res, next) => {
  const { modelId, datasetType } = req.params;
  const datasetName = `${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}ing_samples.csv`;
  const samplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/${datasetName}`;
  //console.log(samplesFilePath);
  const rows = [];
  isFileExist(samplesFilePath, (ret) => {
    fs.createReadStream(samplesFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        res.send(rows);
      })
      .on('error', (err) => {
        res.status(500).send(`Error reading CSV file: ${err.message}`);
      });
    });
});

    /* if (!ret) {
      res.status(401).send(`The training samples file ${modelId} does not exist`);
    } else {
      res.setHeader('Content-Disposition', 'inline; filename=Train_samples.csv');
      res.setHeader('Content-Type', 'text/csv');
      res.sendFile(trainingSamplesFilePath); */
      /* // Read the CSV file content
      const csvData = fs.readFileSync(trainingSamplesFilePath, { encoding: 'utf-8' });

      // Parse the CSV file content into a 2D array
      const rows = csvData.split('\n').map((row) => row.split(','));

      // Send the CSV file content as an HTML table
      res.send(`
        <table>
          <thead>
            <tr>
              ${rows[0].map((header) => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.slice(1).map((row) => `
              <tr>
                ${row.map((cell) => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `); */
    //}
  //});
//});

router.get('/:modelId/datasets/testing/view', (req, res, next) => {
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

router.get('/:modelId/datasets/training/csv', (req, res, next) => {
  const { modelId } = req.params;
  const trainingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Train_samples.csv`;
  isFileExist(trainingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The training samples file ${modelId} does not exist`);
    } else {
      const csvData = fs.readFileSync(trainingSamplesFilePath, 'utf-8');
      res.setHeader('Content-Type', 'text/csv');
      res.send(csvData);
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

module.exports = router;
