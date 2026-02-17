/**
 * XAI Worker - Processes SHAP and LIME explanation jobs from the queue
 * 
 * This worker handles CPU-intensive XAI tasks asynchronously
 */

const { xaiQueue } = require('../job-queue');
const {  
  MODEL_PATH,
  DEEP_LEARNING_PATH,
  LOG_PATH,
  PYTHON_CMD
} = require('../../constants');
const { spawnCommand } = require('../../utils/utils');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// Track active jobs
let activeJobs = 0;
const MAX_CONCURRENT = parseInt(process.env.XAI_WORKERS) || 1;

/**
 * Process XAI job (SHAP or LIME)
 */
const processXAIJob = async (job) => {
  const { xaiType, modelId, config } = job.data;
  
  console.log(`[XAI Worker] Processing ${xaiType} job for model: ${modelId}`);
  
  activeJobs++;
  job.progress(10);
  
  try {
    const inputModelFilePath = MODEL_PATH + modelId;
    if (!fs.existsSync(inputModelFilePath)) {
      throw new Error(`Model file ${modelId} does not exist`);
    }
    
    job.progress(20);
    
    // Execute the appropriate XAI script based on type
    let scriptPath, args;
    
    if (xaiType === 'shap') {
      // SHAP explanation
      const { numberBackgroundSamples, numberExplainedSamples, maxDisplay } = config;
      scriptPath = `${DEEP_LEARNING_PATH}/xai-shap.py`;
      args = [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay];
      
    } else if (xaiType === 'lime') {
      // LIME explanation
      const { sampleId, numberFeatures } = config;
      scriptPath = `${DEEP_LEARNING_PATH}/xai-lime.py`;
      args = [scriptPath, modelId, sampleId, numberFeatures];
      
    } else if (xaiType === 'shap-flow') {
      // SHAP for flow instance
      const { predictionId, sessionId, numberFeature } = config;
      const { featureMap } = await buildInstanceVectorFromPrediction(predictionId, sessionId);
      const tmpDir = path.join(DEEP_LEARNING_PATH, 'xai', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const instanceJsonPath = path.join(tmpDir, `${predictionId}_${sessionId}_shap.json`);
      await fsPromises.writeFile(instanceJsonPath, JSON.stringify(featureMap));
      
      scriptPath = `${DEEP_LEARNING_PATH}/xai-shap-instance.py`;
      args = [scriptPath, modelId, instanceJsonPath, numberFeature];
      
    } else if (xaiType === 'lime-flow') {
      // LIME for flow instance
      const { predictionId, sessionId, numberFeature } = config;
      const { featureMap } = await buildInstanceVectorFromPrediction(predictionId, sessionId);
      const tmpDir = path.join(DEEP_LEARNING_PATH, 'xai', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const instanceJsonPath = path.join(tmpDir, `${predictionId}_${sessionId}.json`);
      await fsPromises.writeFile(instanceJsonPath, JSON.stringify(featureMap));
      
      scriptPath = `${DEEP_LEARNING_PATH}/xai-lime-instance.py`;
      args = [scriptPath, modelId, instanceJsonPath, numberFeature];
      
    } else {
      throw new Error(`Unknown XAI type: ${xaiType}`);
    }
    
    job.progress(30);
    
    // Execute Python script asynchronously
    const logFile = `${LOG_PATH}xai_${xaiType}_${modelId}.log`;
    
    await new Promise((resolve, reject) => {
      spawnCommand(PYTHON_CMD, args, logFile, (error) => {
        if (error) {
          reject(new Error(`XAI script failed: ${error}`));
        } else {
          resolve();
        }
      });
      
      // Update progress periodically
      const progressInterval = setInterval(() => {
        const currentProgress = job.progress();
        if (currentProgress < 90) {
          job.progress(currentProgress + 10);
        } else {
          clearInterval(progressInterval);
        }
      }, 5000);
    });
    
    job.progress(100);
    activeJobs--;
    
    console.log(`[XAI Worker] Completed ${xaiType} for model: ${modelId}`);
    
    return {
      success: true,
      xaiType,
      modelId,
      message: `${xaiType.toUpperCase()} explanations generated successfully`
    };
    
  } catch (error) {
    activeJobs--;
    console.error(`[XAI Worker] Error processing ${xaiType}:`, error);
    throw error;
  }
};

/**
 * Helper function to build instance vector from prediction outputs
 */
const buildInstanceVectorFromPrediction = async (predictionId, sessionId) => {
  const PREDICTION_PATH = require('../../constants').PREDICTION_PATH;
  const attackFile = path.join(PREDICTION_PATH, predictionId, 'attacks.csv');
  const allFile = path.join(PREDICTION_PATH, predictionId, 'predictions.csv');
  let csvPath = null;
  
  if (fs.existsSync(attackFile)) {
    csvPath = attackFile;
  } else if (fs.existsSync(allFile)) {
    csvPath = allFile;
  } else {
    throw new Error(`No prediction CSV found for ${predictionId}`);
  }

  const content = await fsPromises.readFile(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Empty prediction CSV');
  
  const header = lines[0].split(',');
  const featureHeaders = header.slice(3, header.length - 1);
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    if (String(cols[0]).trim() === String(sessionId).trim()) {
      const featureVals = cols.slice(3, cols.length - 1);
      const featureMap = {};
      for (let j = 0; j < featureHeaders.length; j++) {
        const key = featureHeaders[j];
        const num = Number(featureVals[j]);
        featureMap[key] = Number.isNaN(num) ? 0 : num;
      }
      return { featureMap, featureHeaders };
    }
  }
  throw new Error(`Session ${sessionId} not found in prediction ${predictionId}`);
};

// Process jobs from the queue
xaiQueue.process('*', MAX_CONCURRENT, processXAIJob);

// Event handlers
xaiQueue.on('completed', (job, result) => {
  console.log(`[XAI Queue] Job ${job.id} completed:`, result);
});

xaiQueue.on('failed', (job, err) => {
  console.error(`[XAI Queue] Job ${job.id} failed:`, err.message);
});

xaiQueue.on('stalled', (job) => {
  console.warn(`[XAI Queue] Job ${job.id} stalled`);
});

console.log(`[XAI Worker] Started with ${MAX_CONCURRENT} concurrent workers`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[XAI Worker] Shutting down gracefully...');
  await xaiQueue.close();
  process.exit(0);
});

module.exports = { processXAIJob };
