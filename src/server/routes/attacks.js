const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { promisify } = require('util');
const readdirAsync = promisify(fs.readdir);
const {
  getAttacksStatus,
  performCTGAN,
  performPoisoningCTGAN,
  performPoisoningRSL,
  performPoisoningTLF,
} = require('../deep-learning/attacks-connector');
const {
  ATTACKS_PATH
} = require('../constants');
const {
  isFileExist,
  listFiles,
} = require('../utils/file-utils');
const {
  replaceDelimiterInCsv
} = require('../utils/utils');

router.get('/', (_, res) => {
  res.send({
    attacksStatus: getAttacksStatus(),
  });
});

router.get('/:modelId/datasets', async (req, res, next) => {
  const { modelId } = req.params;
  try {
    const datasetsPath = path.join(ATTACKS_PATH, modelId.replace('.h5', ''));
    if (!fs.existsSync(datasetsPath)) {
      return res.send({ datasets: [] });
    }
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

router.delete('/:modelId/datasets', async (req, res, next) => {
  const { modelId } = req.params;
  const poisonedDatasetsPath = path.join(ATTACKS_PATH, modelId.replace('.h5', ''));
  try {
    listFiles(poisonedDatasetsPath, '.csv', (files) => {
      files.forEach(file => {
        const filePath = path.join(poisonedDatasetsPath, file);
        fs.unlinkSync(filePath);
      });

      res.send({
        message: 'All poisoned training datasets deleted successfully'
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/ctgan', (req, res) => {
  const {
    ctganConfig,
  } = req.body;
  if (!ctganConfig) {
    res.status(401).send({
      error: 'Missing CTGAN configuration. Please read the docs',
    });
  } else {
    const attacksStatus = getAttacksStatus();
    if (attacksStatus.isRunning) {
      res.status(401).send({
        error: 'An attack injection process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      performCTGAN(ctganConfig, (attacksStatus) => {
        if (attacksStatus.error) {
          res.status(401).send({
            error: attacksStatus.error,
          });
        } else {
          console.log(attacksStatus);
          res.send(attacksStatus);
        }
      });
    }
  }
});

router.get('/ctgan/:modelId/download', (req, res, next) => {
  const { modelId } = req.params;
  const ctganFilePath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/ctgan_samples.csv`;
  isFileExist(ctganFilePath, (ret) => {
    if (!ret) {
      res.status(401).send(`The CTGAN dataset ${ctganFilePath} does not exist`);
    } else {
      res.sendFile(ctganFilePath);
    }
  });
});

router.post('/poisoning/ctgan', (req, res) => {
  const {
    poisoningAttacksConfig,
  } = req.body;
  if (!poisoningAttacksConfig) {
    res.status(401).send({
      error: 'Missing CTGAN poisoning attack configuration. Please read the docs',
    });
  } else {
    const attacksStatus = getAttacksStatus();
    if (attacksStatus.isRunning) {
      res.status(401).send({
        error: 'An attack injection process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      performPoisoningCTGAN(poisoningAttacksConfig, (attacksStatus) => {
        if (attacksStatus.error) {
          res.status(401).send({
            error: attacksStatus.error,
          });
        } else {
          console.log(attacksStatus);
          res.send(attacksStatus);
        }
      });
    }
  }
});

router.post('/poisoning/random-swapping-labels', async (req, res) => {
  const {
    randomSwappingLabelsConfig,
  } = req.body;
  if (!randomSwappingLabelsConfig) {
    res.status(401).send({
      error: 'Missing poisoning RSL attack configuration. Please read the docs',
    });
  } else {
    performPoisoningRSL(randomSwappingLabelsConfig, (attacksStatus) => {
      res.send(attacksStatus);
    });
  }
});

router.post('/poisoning/target-label-flipping', (req, res) => {
  const {
    targetLabelFlippingConfig,
  } = req.body;
  console.log(targetLabelFlippingConfig);
  if (!targetLabelFlippingConfig) {
    res.status(401).send({
      error: 'Missing poisoning TLF attack configuration. Please read the docs',
    });
  } else {
    const attacksStatus = getAttacksStatus();
    if (attacksStatus.isRunning) {
      res.status(401).send({
        error: 'An attack injection process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      performPoisoningTLF(targetLabelFlippingConfig, (attacksStatus) => {
        if (attacksStatus.error) {
          res.status(401).send({
            error: attacksStatus.error,
          });
        } else {
          console.log(attacksStatus);
          res.send(attacksStatus);
        }
      });
    }
  }
});

router.get('/poisoning/:typeAttack/:modelId/download', (req, res, next) => {
  const {
    typeAttack,
    modelId,
  } = req.params;

  const poisonedDatasetPath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/${typeAttack}_poisoned_dataset.csv`;

  isFileExist(poisonedDatasetPath, (ret) => {
    if (!ret) {
      res.status(401).send(`The poisoned dataset does not exist`);
    } else {
      res.sendFile(poisonedDatasetPath);
    }
  });
});

router.get('/poisoning/:typeAttack/:modelId/view', (req, res, next) => {
  const { typeAttack, modelId } = req.params;

  const poisonedDatasetPath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/${typeAttack}_poisoned_dataset.csv`;
  const poisonedDatasetToViewPath = `${ATTACKS_PATH}${modelId.replace('.h5', '')}/${typeAttack}_poisoned_dataset_view.csv`;
  replaceDelimiterInCsv(poisonedDatasetPath, poisonedDatasetToViewPath);
  console.log(poisonedDatasetPath);

  isFileExist(poisonedDatasetToViewPath, (ret) => {
    if (!ret) {
      res.status(401).send(`The poisoned training dataset of model ${modelId} does not exist`);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${poisonedDatasetToViewPath}"`);
      const fileStream = fs.createReadStream(poisonedDatasetToViewPath);
      fileStream.pipe(res);
    }
  });
});


module.exports = router;