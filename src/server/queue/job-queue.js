/**
 * Job Queue Manager for NDR Training Environment
 * 
 * Handles 30+ concurrent users by queuing resource-intensive tasks
 * Minimal changes to existing code - just wrap existing functions
 */

const Queue = require('bull');
const path = require('path');

// Redis connection (default: localhost:6379)
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Create queues for different job types
const featureQueue = new Queue('feature-extraction', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50       // Keep last 50 failed jobs
  }
});

const trainingQueue = new Queue('model-training', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 50,
    removeOnFail: 25
  }
});

const predictionQueue = new Queue('prediction', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

const ruleBasedQueue = new Queue('rule-based-detection', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

const xaiQueue = new Queue('xai-explanations', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: 100,
    removeOnFail: 50,
    timeout: 10 * 60 * 1000 // 10 minutes timeout for XAI (can be slow)
  }
});

const attackQueue = new Queue('adversarial-attacks', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 50,
    removeOnFail: 25,
    timeout: 15 * 60 * 1000 // 15 minutes timeout for attacks (dataset poisoning can be slow)
  }
});

const retrainQueue = new Queue('model-retraining', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 50,
    removeOnFail: 25,
    timeout: 30 * 60 * 1000 // 30 minutes timeout for retraining
  },
  settings: {
    lockDuration: 30 * 60 * 1000, // 30 minutes - job lock duration
    stalledInterval: 5 * 60 * 1000, // Check for stalled jobs every 5 minutes
    maxStalledCount: 2 // Allow 2 stalled checks before failing
  }
});

// Configure concurrency (number of parallel workers)
const CONCURRENCY = {
  featureExtraction: parseInt(process.env.FEATURE_WORKERS) || 3,
  modelTraining: parseInt(process.env.TRAINING_WORKERS) || 2,
  prediction: parseInt(process.env.PREDICTION_WORKERS) || 3,
  ruleBasedDetection: parseInt(process.env.RULEBASED_WORKERS) || 2,
  xaiExplanations: parseInt(process.env.XAI_WORKERS) || 1,  // XAI is CPU intensive, keep it low
  adversarialAttacks: parseInt(process.env.ATTACK_WORKERS) || 2,  // Attacks are CPU/memory intensive
  modelRetraining: parseInt(process.env.RETRAIN_WORKERS) || 2  // Retraining is very resource intensive
};

/**
 * Add job to feature extraction queue
 */
const queueFeatureExtraction = async (data) => {
  const job = await featureQueue.add('extract', data, {
    priority: data.priority || 5,
    timeout: 5 * 60 * 1000 // 5 minutes timeout
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'feature-extraction',
    position: position,
    estimatedWait: await estimateWaitTime(featureQueue, job)
  };
};

/**
 * Add job to model training queue
 */
const queueModelTraining = async (data) => {
  const job = await trainingQueue.add('train', data, {
    priority: data.priority || 5,
    timeout: 15 * 60 * 1000 // 15 minutes timeout
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'model-training',
    position: position,
    estimatedWait: await estimateWaitTime(trainingQueue, job)
  };
};

/**
 * Add job to prediction queue
 */
const queuePrediction = async (data) => {
  const job = await predictionQueue.add('predict', data, {
    priority: data.priority || 5,
    timeout: 5 * 60 * 1000 // 5 minutes timeout
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'prediction',
    position: position,
    estimatedWait: await estimateWaitTime(predictionQueue, job)
  };
};

/**
 * Add job to rule-based detection queue
 */
const queueRuleBasedDetection = async (data) => {
  const job = await ruleBasedQueue.add('detect', data, {
    priority: data.priority || 5,
    timeout: 5 * 60 * 1000 // 5 minutes timeout
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'rule-based-detection',
    position: position,
    estimatedWait: await estimateWaitTime(ruleBasedQueue, job)
  };
};

/**
 * Add job to XAI explanations queue (SHAP/LIME)
 */
const queueXAI = async (data) => {
  const { xaiType, modelId } = data;
  const jobName = `${xaiType}-${modelId}`;
  
  const job = await xaiQueue.add(jobName, data, {
    priority: data.priority || 5,
    timeout: 10 * 60 * 1000 // 10 minutes timeout for XAI
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'xai-explanations',
    position: position,
    estimatedWait: await estimateWaitTime(xaiQueue, job)
  };
};

/**
 * Add job to adversarial attack queue
 */
const queueAttack = async (data) => {
  const { selectedAttack, modelId } = data;
  const jobName = `${selectedAttack}-${modelId}`;
  
  const job = await attackQueue.add(jobName, data, {
    priority: data.priority || 5,
    timeout: 15 * 60 * 1000 // 15 minutes timeout for attacks
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'adversarial-attacks',
    position: position,
    estimatedWait: await estimateWaitTime(attackQueue, job)
  };
};

/**
 * Add job to model retraining queue (for impact metrics)
 */
const queueRetrain = async (data) => {
  const { modelId, trainingDataset, testingDataset } = data;
  
  // Make jobId unique by adding timestamp to avoid reusing old jobs
  const jobName = `retrain-${modelId}-${trainingDataset}-${Date.now()}`;
  
  // First parameter is job TYPE (must match worker), not job name
  const job = await retrainQueue.add('retrain', data, {
    jobId: jobName, // Unique ID for easier identification
    priority: data.priority || 5,
    timeout: 20 * 60 * 1000 // 20 minutes timeout for retraining
  });
  
  // Get position - handle both Bull v3 and v4 API
  let position = 0;
  try {
    position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
  } catch (e) {
    position = 0;
  }
  
  return {
    jobId: job.id,
    queueName: 'model-retraining',
    position: position,
    estimatedWait: await estimateWaitTime(retrainQueue, job)
  };
};

/**
 * Estimate wait time based on queue position and average job duration
 */
const estimateWaitTime = async (queue, job) => {
  try {
    // Get position - handle both Bull v3 and v4 API
    let position = 0;
    try {
      position = typeof job.getPosition === 'function' ? await job.getPosition() : 0;
    } catch (e) {
      position = 0;
    }
    
    const metrics = await queue.getJobCounts();
    
    // Average job duration (in seconds) - can be configured per queue
    const avgDuration = {
      'feature-extraction': 60,  // 1 minute
      'model-training': 300,     // 5 minutes
      'prediction': 30,          // 30 seconds
      'rule-based-detection': 45 // 45 seconds
    }[queue.name] || 60;
    
    // Calculate estimated wait
    const activeJobs = metrics.active || 0;
    const waitingJobs = position || metrics.waiting || 0;
    const workers = CONCURRENCY[queue.name.replace('-', '')] || 1;
    
    const estimatedSeconds = Math.ceil((waitingJobs / workers) * avgDuration);
    
    return {
      seconds: estimatedSeconds,
      minutes: Math.ceil(estimatedSeconds / 60),
      formatted: formatDuration(estimatedSeconds)
    };
  } catch (error) {
    return { seconds: 0, minutes: 0, formatted: 'Unknown' };
  }
};

/**
 * Format duration in human-readable format
 */
const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Get job status
 */
const getJobStatus = async (jobId, queueName) => {
  const queue = {
    'feature-extraction': featureQueue,
    'model-training': trainingQueue,
    'prediction': predictionQueue,
    'rule-based-detection': ruleBasedQueue,
    'xai-explanations': xaiQueue,
    'adversarial-attacks': attackQueue,
    'model-retraining': retrainQueue
  }[queueName];
  
  if (!queue) {
    throw new Error(`Unknown queue: ${queueName}`);
  }
  
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return { status: 'not-found', message: 'Job not found' };
  }
  
  const state = await job.getState();
  const progress = job.progress();
  
  // Get position - handle both Bull v3 and v4 API
  let position = null;
  if (state === 'waiting') {
    try {
      position = typeof job.getPosition === 'function' ? await job.getPosition() : null;
    } catch (e) {
      position = null;
    }
  }
  
  return {
    jobId: job.id,
    status: state, // 'waiting', 'active', 'completed', 'failed'
    progress: progress,
    position: position,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    estimatedWait: position !== null ? await estimateWaitTime(queue, job) : null
  };
};

/**
 * Get queue statistics
 */
const getQueueStats = async () => {
  const [featureStats, trainingStats, predictionStats, ruleBasedStats, xaiStats, attackStats, retrainStats] = await Promise.all([
    featureQueue.getJobCounts(),
    trainingQueue.getJobCounts(),
    predictionQueue.getJobCounts(),
    ruleBasedQueue.getJobCounts(),
    xaiQueue.getJobCounts(),
    attackQueue.getJobCounts(),
    retrainQueue.getJobCounts()
  ]);
  
  return {
    featureExtraction: {
      ...featureStats,
      workers: CONCURRENCY.featureExtraction
    },
    modelTraining: {
      ...trainingStats,
      workers: CONCURRENCY.modelTraining
    },
    prediction: {
      ...predictionStats,
      workers: CONCURRENCY.prediction
    },
    ruleBasedDetection: {
      ...ruleBasedStats,
      workers: CONCURRENCY.ruleBasedDetection
    },
    xaiExplanations: {
      ...xaiStats,
      workers: CONCURRENCY.xaiExplanations
    },
    adversarialAttacks: {
      ...attackStats,
      workers: CONCURRENCY.adversarialAttacks
    },
    modelRetraining: {
      ...retrainStats,
      workers: CONCURRENCY.modelRetraining
    },
    total: {
      waiting: (featureStats.waiting || 0) + (trainingStats.waiting || 0) + (predictionStats.waiting || 0) + (ruleBasedStats.waiting || 0) + (xaiStats.waiting || 0) + (attackStats.waiting || 0) + (retrainStats.waiting || 0),
      active: (featureStats.active || 0) + (trainingStats.active || 0) + (predictionStats.active || 0) + (ruleBasedStats.active || 0) + (xaiStats.active || 0) + (attackStats.active || 0) + (retrainStats.active || 0),
      completed: (featureStats.completed || 0) + (trainingStats.completed || 0) + (predictionStats.completed || 0) + (ruleBasedStats.completed || 0) + (xaiStats.completed || 0) + (attackStats.completed || 0) + (retrainStats.completed || 0),
      failed: (featureStats.failed || 0) + (trainingStats.failed || 0) + (predictionStats.failed || 0) + (ruleBasedStats.failed || 0) + (xaiStats.failed || 0) + (attackStats.failed || 0) + (retrainStats.failed || 0)
    }
  };
};

/**
 * Cancel a job
 */
const cancelJob = async (jobId, queueName) => {
  const queue = {
    'feature-extraction': featureQueue,
    'model-training': trainingQueue,
    'prediction': predictionQueue,
    'rule-based-detection': ruleBasedQueue,
    'xai-explanations': xaiQueue,
    'adversarial-attacks': attackQueue,
    'model-retraining': retrainQueue
  }[queueName];
  
  if (!queue) {
    throw new Error(`Unknown queue: ${queueName}`);
  }
  
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    return { success: true, message: 'Job cancelled' };
  }
  
  return { success: false, message: 'Job not found' };
};

/**
 * Clean up old completed/failed jobs
 */
const cleanupOldJobs = async (olderThanHours = 24) => {
  const timestamp = Date.now() - (olderThanHours * 60 * 60 * 1000);
  
  await Promise.all([
    featureQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    featureQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    trainingQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    trainingQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    predictionQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    predictionQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    ruleBasedQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    ruleBasedQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    xaiQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    xaiQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    attackQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    attackQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed'),
    retrainQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed'),
    retrainQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed')
  ]);
  
  console.log(`[Queue] Cleaned up jobs older than ${olderThanHours} hours`);
};

// Auto-cleanup every 6 hours
setInterval(() => {
  cleanupOldJobs(24);
}, 6 * 60 * 60 * 1000);

module.exports = {
  // Queues
  featureQueue,
  trainingQueue,
  predictionQueue,
  ruleBasedQueue,
  xaiQueue,
  attackQueue,
  retrainQueue,
  
  // Queue operations
  queueFeatureExtraction,
  queueModelTraining,
  queuePrediction,
  queueRuleBasedDetection,
  queueXAI,
  queueAttack,
  queueRetrain,
  
  // Job operations
  getJobStatus,
  cancelJob,
  
  // Statistics
  getQueueStats,
  
  // Cleanup
  cleanupOldJobs
};
