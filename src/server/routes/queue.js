/**
 * Queue Management API Routes
 * 
 * Endpoints for managing job queues for 30+ concurrent users
 */

const express = require('express');
const router = express.Router();

const {
  queueFeatureExtraction,
  queueModelTraining,
  queuePrediction,
  queueAttack,
  getJobStatus,
  cancelJob,
  getQueueStats
} = require('../queue/job-queue');
const { identifyUser, requireAuth } = require('../middleware/userAuth');

// Apply user identification middleware to all routes
router.use(identifyUser);

/**
 * @route POST /api/queue/feature-extraction
 * @desc Queue a feature extraction job
 * @body { pcapFile, sessionId, isMalicious, priority }
 */
router.post('/feature-extraction', async (req, res) => {
  try {
    const { pcapFile, sessionId, isMalicious, priority } = req.body;
    
    if (!pcapFile || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: pcapFile, sessionId'
      });
    }
    
    const result = await queueFeatureExtraction({
      pcapFile,
      sessionId,
      isMalicious: isMalicious !== undefined ? isMalicious : null,
      priority: priority || 5
    });
    
    res.json({
      success: true,
      message: 'Feature extraction job queued',
      ...result
    });
    
  } catch (error) {
    console.error('[Queue API] Feature extraction error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/queue/model-training
 * @desc Queue a model training job
 * @body { sessionId, modelName, datasetPath, algorithm, priority }
 */
router.post('/model-training', async (req, res) => {
  try {
    const { sessionId, modelName, datasetPath, algorithm, priority } = req.body;
    
    if (!sessionId || !modelName || !datasetPath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId, modelName, datasetPath'
      });
    }
    
    const result = await queueModelTraining({
      sessionId,
      modelName,
      datasetPath,
      algorithm: algorithm || 'random_forest',
      priority: priority || 5
    });
    
    res.json({
      success: true,
      message: 'Model training job queued',
      ...result
    });
    
  } catch (error) {
    console.error('[Queue API] Model training error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/queue/prediction
 * @desc Queue a prediction job
 * @body { modelId, datasetId, sessionId, priority }
 */
router.post('/prediction', async (req, res) => {
  try {
    const { modelId, datasetId, sessionId, priority } = req.body;
    
    if (!modelId || !datasetId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: modelId, datasetId, sessionId'
      });
    }
    
    const result = await queuePrediction({
      modelId,
      datasetId,
      sessionId,
      priority: priority || 5
    });
    
    res.json({
      success: true,
      message: 'Prediction job queued',
      ...result
    });
    
  } catch (error) {
    console.error('[Queue API] Prediction error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/queue/attack
 * @desc Queue an adversarial attack job
 * @body { modelId, selectedAttack, poisoningRate, targetClass, priority }
 */
router.post('/attack', async (req, res) => {
  try {
    const { modelId, selectedAttack, poisoningRate, targetClass, priority } = req.body;
    
    if (!modelId || !selectedAttack || poisoningRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: modelId, selectedAttack, poisoningRate'
      });
    }
    
    const result = await queueAttack({
      modelId,
      selectedAttack,
      poisoningRate,
      targetClass,
      priority: priority || 5
    });
    
    res.json({
      success: true,
      message: 'Attack job queued',
      ...result
    });
    
  } catch (error) {
    console.error('[Queue API] Attack queueing error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/queue/status/:queueName/:jobId
 * @desc Get status of a specific job
 */
router.get('/status/:queueName/:jobId', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    
    const status = await getJobStatus(jobId, queueName);
    
    res.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    console.error('[Queue API] Status check error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/queue/cancel/:queueName/:jobId
 * @desc Cancel a queued job
 */
router.delete('/cancel/:queueName/:jobId', requireAuth, async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    
    const result = await cancelJob(jobId, queueName);
    
    res.json(result);
    
  } catch (error) {
    console.error('[Queue API] Cancel error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/queue/stats
 * @desc Get statistics for all queues
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Queue API] Stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/queue/health
 * @desc Health check for queue system
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await getQueueStats();
    
    const isHealthy = stats.total.failed < 10; // Arbitrary threshold
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      queues: {
        featureExtraction: {
          active: stats.featureExtraction.active,
          waiting: stats.featureExtraction.waiting,
          workers: stats.featureExtraction.workers
        },
        modelTraining: {
          active: stats.modelTraining.active,
          waiting: stats.modelTraining.waiting,
          workers: stats.modelTraining.workers
        },
        prediction: {
          active: stats.prediction.active,
          waiting: stats.prediction.waiting,
          workers: stats.prediction.workers
        }
      },
      total: stats.total,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Queue API] Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: error.message
    });
  }
});

module.exports = router;
