const express = require('express');

const router = express.Router();

const {
  readTextFile,
  isFileExist,
} = require('../utils/file-utils');
const {
  TRAINING_PATH,
  XAI_PATH,
  ATTACKS_PATH,
} = require('../constants');
const {
  getRetrainStatus,
  retrainModel,
} = require('../deep-learning/deep-learning-connector');

const fs = require('fs');
const path = require('path');

function extractAccuracy(modelId) {
  return new Promise((resolve, reject) => {
    fs.readFile(`${TRAINING_PATH}${modelId}/results/stats.csv`, 'utf8', (err, stats) => {
      if (err) {
        reject(err);
      } else {
        const rows = stats.split('\n');
        let accuracy = null;

        for (let row of rows) {
          const columns = row.split(',');
          if (columns[0] === 'accuracy') {
            accuracy = columns[1];
            break;
          }
        }

        if (accuracy) {
          resolve(accuracy);
        } else {
          reject(new Error('Accuracy not found'));
        }
      }
    });
  });
}

router.get('/:modelId/accuracy', async (req, res, next) => {
  const { modelId } = req.params;
  try {
    const accuracy = await extractAccuracy(modelId);
    console.log('Accuracy: ', accuracy);
    res.send({ accuracy });
  } catch (err) {
    console.error(err);
    res.status(400).send({ error: err.message });
  }
});

router.get('/:modelId/currentness', (req, res, next) => {
  const { modelId } = req.params;
  const fs = require('fs').promises;
  const files = [
    `${TRAINING_PATH}${modelId.replace('.h5', '')}/results/time_stats.txt`, 
    `${XAI_PATH}${modelId.replace('.h5', '')}/time_stats_shap.txt`,
    `${XAI_PATH}${modelId.replace('.h5', '')}/time_stats_lime.txt`  
  ];

  Promise.all(files.map(file => fs.readFile(file, 'utf8')))
    .then(data => {
      const time_predict = parseFloat(data[0]);
      const time_shap = parseFloat(data[1]);
      const time_lime = parseFloat(data[2]);
      console.log('Time taken for predictions in seconds: ', time_predict);
      console.log('Time taken for SHAP in seconds: ', time_shap);
      console.log('Time taken for LIME in seconds: ', time_lime);
      var shap_currentness = time_shap/time_predict;
      var lime_currentness = time_lime/time_predict;
      console.log("SHAP's currentness: " + shap_currentness);
      console.log("LIME's currentness: " + lime_currentness);
      const arr_currentness = [];
      arr_currentness.push(`SHAP: ${shap_currentness}`);
      arr_currentness.push(`LIME: ${lime_currentness}`);
      res.send({ 
        currentness: arr_currentness 
      });
    })
    .catch(err => {
      console.error(err);
    });  
});

router.get('/:typePoisoningAttack/:modelId/impact', (req, res, next) => {
  const {
    typePoisoningAttack,
    modelId,
  } = req.params;
  
  const poisonedDatasetPath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/${typePoisoningAttack}_poisoned_dataset.csv`;
  const testingSamplesFilePath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/datasets/Test_samples.csv`;

  isFileExist(poisonedDatasetPath, (ret) => {
    if (!ret) {
      res.status(401).send(`The poisoned dataset does not exist`);
    } else {
      const buildConfigPath = `${TRAINING_PATH}${modelId.replace('.h5', '')}/build-config.json`;
      const buildConfig = fs.readFileSync(buildConfigPath);
      const buildObj = JSON.parse(buildConfig);
      const retrainConfig = {
        "modelId": modelId, 
        "trainingDataset": poisonedDatasetPath,
        "testingDataset": testingSamplesFilePath,
        "training_parameters": buildObj.training_parameters,
      }
      
      const retrainStatus = getRetrainStatus();
      if (retrainStatus.isRunning) {
        res.status(401).send({
          error: 'A building process is running. Only one process is allowed at the time. Please try again later',
        });
      } else {
        var retrainId;
        const promise = new Promise((extractAccuracy, reject) => {
          retrainModel(retrainConfig, (results) => {
            console.log(results.retrainId);            
            retrainId = results.retrainId;
            if (results.error) {
              res.status(401).send({
                error: results.error,
              });
            } else {
              //resolve(results);
              extractAccuracy(results);
              //const processedResults = extractAccuracy(retrainId);
              //console.log(processedResults);

              
            }
          });
        });

        promise.then((results) => {
          const processedResults = extractAccuracy(results.retrainId);
          console.log(processedResults);
          res.json(processedResults);
        }).catch((err) => {
          console.error(err);
          res.status(500).send('An error occurred');
        });
        
      }      
    }
  }); 
});


module.exports = router;