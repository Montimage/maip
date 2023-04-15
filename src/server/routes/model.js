/* eslint-disable no-unused-vars */
const express = require('express');
const fs = require('fs');
const router = express.Router();
const {
  MODEL_PATH, TRAINING_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');

/* GET built models name */
router.get('/', (req, res, next) => {
  listFiles(MODEL_PATH, '.h5', (files) => {
    res.send({
      models: files,
    });
  });
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

            // Send the response with all the data for the model
            res.send({
              stats: stats,
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

 router.get('/:modelId/datasets/training/view', (req, res, next) => {
  const { modelId } = req.params;
  const trainingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Train_samples.csv`;
  isFileExist(trainingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The training samples file ${modelId} does not exist`);
    } else {
      res.sendFile(trainingSamplesFilePath);
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
    }
  });
});

router.get('/:modelId/datasets/training/download', (req, res, next) => {
  const { modelId } = req.params;
  const trainingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Train_samples.csv`;
  isFileExist(trainingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The training samples file ${modelId} does not exist`);
    } else {
      /* TODO: the downloaded file's name is still download, even clear browser or change file's name */
      const timestamp = Date.now();
      res.setHeader('Content-Disposition', `attachment; filename="Train_samples_${timestamp}.csv"`);
      res.download(trainingSamplesFilePath);
    }
  });
});

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

router.get('/models/:modelId/datasets/:datasetId/abc', (req, res, next) => {
  const { modelId, datasetId } = req.params;
  console.log(req.params); // Debug statement
  //const datasetId = req.params.datasetId;
  const datasetFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;
  isFileExist(datasetFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The dataset file ${datasetId} does not exist`);
    } else {
      res.sendFile(datasetFilePath);
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

router.get('/:modelId/datasets/testing/download', (req, res, next) => {
  const { modelId } = req.params;
  const testingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;
  isFileExist(testingSamplesFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The testing samples file ${modelId} does not exist`);
    } else {
      res.download(testingSamplesFilePath);
    }
  });
});

module.exports = router;
