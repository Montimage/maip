/* eslint-disable no-unused-vars */
const express = require('express');

const router = express.Router();
const {
  PREDICTION_PATH,
} = require('../constants');
const {
  listFiles, readTextFile, isFileExist,
} = require('../utils/file-utils');

/** Download a prediction .csv file */
router.get('/:predictionId/download', (req, res, next) => {
  const { predictionId } = req.params;
  const predictionFilePath = `${PREDICTION_PATH}${predictionId}/predictions.csv`;
  isFileExist(predictionFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The prediction file of ${predictionId} does not exist`);
    } else {
      res.sendFile(predictionFilePath);
    }
  });
});

/**
 * Get a prediction result content
 */
router.get('/:predictionId/attack', (req, res, next) => {
  const { predictionId } = req.params;
  const predictionFilePath = `${PREDICTION_PATH}${predictionId}/attacks.csv`;
  isFileExist(predictionFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The prediction file for attack traffic of ${predictionId} does not exist`);
    } else {
      res.sendFile(predictionFilePath);
    }
  });
});

/**
 * Get a prediction result content
 */
router.get('/:predictionId/normal', (req, res, next) => {
  const { predictionId } = req.params;
  const predictionFilePath = `${PREDICTION_PATH}${predictionId}/normals.csv`;
  isFileExist(predictionFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The prediction file for normal traffic of ${predictionId} does not exist`);
    } else {
      res.sendFile(predictionFilePath);
    }
  });
});

// /**
//  * Get a prediction result content
//  */
// router.get('/:predictionId/all', (req, res, next) => {
//   const { predictionId } = req.params;
//   readTextFile(`${PREDICTION_PATH}${predictionId}/predictions.csv`, (err, content) => {
//     if (err) {
//       res.status(401).send({ error: 'Something went wrong!' });
//     } else {
//       res.send({ content });
//     }
//   });
// });

/**
 * Get a prediction result content
 */
router.get('/:predictionId', (req, res, next) => {
  const { predictionId } = req.params;
  readTextFile(`${PREDICTION_PATH}${predictionId}/stats.csv`, (err, prediction) => {
    if (err) {
      res.status(401).send({ error: 'Something went wrong!' });
    } else {
      res.send({ prediction });
    }
  });
});

/**
 * Get all prediction result list
 */
router.get('/', (req, res, next) => {
  listFiles(PREDICTION_PATH, '*', (files) => {
    res.send({
      predictions: files,
    });
  });
});


module.exports = router;
