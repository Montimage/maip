const express = require('express');
const {
  getRetrainStatus,
  retrainModel,
} = require('../deep-learning/deep-learning-connector');
const { queueRetrain, getJobStatus } = require('../queue/job-queue');

const router = express.Router();

router.get('/', (req, res) => {
  res.send({
    retrainStatus: getRetrainStatus(),
  });
});

router.post('/', (req, res) => {
  const {
    retrainConfig,
  } = req.body;

  if (!retrainConfig) {
    res.status(401).send({
      error: 'Missing retrain configuration. Please read the docs',
    });
  } else {
    const retrainStatus = getRetrainStatus();
    if (retrainStatus.isRunning) {
      res.status(401).send({
        error: 'A building process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      retrainModel(retrainConfig, (retrainStatus) => {
        if (retrainStatus.error) {
          res.status(401).send({
            error: retrainStatus.error,
          });
        } else {
          console.log(retrainStatus);
          res.send(retrainStatus);
        }
      });
    }
  }
});

/**
 * POST /api/retrain/offline
 * Queue-based model retraining (non-blocking)
 * Body: { modelId, trainingDataset, testingDataset, training_parameters, isACApp?, useQueue? }
 * IMPORTANT: Must be BEFORE /:modelId route to avoid matching "offline" as modelId
 */
router.post('/offline', async (req, res) => {
  try {
    const { modelId, trainingDataset, testingDataset, training_parameters, isACApp, useQueue } = req.body || {};
    
    if (!modelId || !trainingDataset || !testingDataset) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'modelId, trainingDataset, and testingDataset are required'
      });
    }
    
    // training_parameters is optional (AC apps may not need it)
    const params = training_parameters || {};
    
    // Queue-based approach is ENABLED BY DEFAULT
    const useQueueDefault = process.env.USE_QUEUE_BY_DEFAULT !== 'false';
    const shouldUseQueue = useQueue !== undefined ? useQueue : useQueueDefault;
    
    if (shouldUseQueue) {
      // Queue the retrain job
      const jobInfo = await queueRetrain({
        modelId,
        trainingDataset,
        testingDataset,
        training_parameters: params,
        isACApp: isACApp || false,
        priority: 5
      });
      
      return res.json({
        success: true,
        useQueue: true,
        jobId: jobInfo.jobId,
        queueName: jobInfo.queueName,
        position: jobInfo.position,
        estimatedWait: jobInfo.estimatedWait,
        message: 'Retrain job queued successfully'
      });
    }
    
    // Direct processing (blocking) - only if useQueue=false
    
    const retrainConfig = {
      modelId,
      trainingDataset,
      testingDataset,
      training_parameters: params
    };
    
    retrainModel(retrainConfig, (retrainStatus) => {
      if (retrainStatus.error) {
        return res.status(500).json({
          success: false,
          error: retrainStatus.error
        });
      }
      
      res.json({
        success: true,
        useQueue: false,
        retrainId: retrainStatus.retrainId,
        ...retrainStatus,
        message: 'Retrain started (blocking mode)'
      });
    });
    
  } catch (error) {
    console.error('[Retrain] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/retrain/predictions/:retrainId
 * Get predictions from a completed retrain job
 */
router.get('/predictions/:retrainId', async (req, res) => {
  try {
    const { retrainId } = req.params;
    const path = require('path');
    const fs = require('fs');
    const { TRAINING_PATH } = require('../constants');
    
    const predictionsFile = path.join(TRAINING_PATH, retrainId, 'predictions.csv');
    
    if (!fs.existsSync(predictionsFile)) {
      return res.status(404).json({
        error: 'Predictions file not found',
        message: `No predictions file for retrain ID: ${retrainId}`
      });
    }
    
    const predictionsData = fs.readFileSync(predictionsFile, 'utf8');
    res.type('text/plain').send(predictionsData);
  } catch (error) {
    console.error('[Retrain] Error loading predictions:', error);
    res.status(500).json({
      error: 'Failed to load predictions',
      message: error.message
    });
  }
});

/**
 * GET /api/retrain/job/:jobId
 * Get status of a queued retrain job
 * IMPORTANT: Must be BEFORE /:modelId route
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    // Disable caching for job status to get real-time updates
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    const { jobId } = req.params;
    const status = await getJobStatus(jobId, 'model-retraining');
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message
    });
  }
});

/**
 * POST /api/retrain/:modelId
 * Legacy endpoint for backward compatibility
 * Body: { retrainADConfig }
 */
router.post('/:modelId', (req, res) => {
  const { modelId } = req.params;
  const {
    retrainADConfig,
  } = req.body;
  console.log(modelId);
  console.log(retrainADConfig);
  if (!retrainADConfig) {
    res.status(401).send({
      error: 'Missing retrain configuration. Please read the docs',
    });
  } else {
    const retrainStatus = getRetrainStatus();
    if (retrainStatus.isRunning) {
      res.status(401).send({
        error: 'A building process is running. Only one process is allowed at the time. Please try again later',
      });
    } else {
      const retrainConfig = { "modelId": modelId, ...retrainADConfig };
      console.log(retrainConfig);
      retrainModel(retrainConfig, (retrainStatus) => {
        if (retrainStatus.error) {
          res.status(401).send({
            error: retrainStatus.error,
          });
        } else {
          console.log(retrainStatus);
          res.send(retrainStatus);
        }
      });
    }
  }
});

module.exports = router;