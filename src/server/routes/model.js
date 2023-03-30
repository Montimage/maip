/* eslint-disable no-unused-vars */
const express = require('express');

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

router.get('/:modelId', (req, res, next) => {
  const { modelId } = req.params;
  readTextFile(`${TRAINING_PATH}${modelId.replace('.h5', '')}/results/stats.csv`, (err, stats) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ stats });
    }
  });
});

module.exports = router;
