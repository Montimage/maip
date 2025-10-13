/**
 * Queue Workers - Process jobs from queues
 * 
 * This wraps your EXISTING code with minimal changes
 * Just import existing functions and call them from workers
 */

const { featureQueue, trainingQueue, predictionQueue } = require('./job-queue');
const path = require('path');
const fs = require('fs');

// Import existing functions and constants
const {
  PCAP_PATH,
  MMT_PROBE_CONFIG_PATH,
  REPORT_PATH,
  DEEP_LEARNING_PATH,
  PYTHON_CMD,
} = require('../constants');
const { listFilesByTypeAsync } = require('../utils/file-utils');
const { spawnCommand } = require('../utils/utils');
const { startMMTOffline, getMMTStatus } = require('../mmt/mmt-connector');

// Configuration
const CONCURRENCY = {
  featureExtraction: parseInt(process.env.FEATURE_WORKERS) || 3,
  modelTraining: parseInt(process.env.TRAINING_WORKERS) || 2,
  prediction: parseInt(process.env.PREDICTION_WORKERS) || 3
};

/**
 * Feature Extraction Worker
 * 
 * Wraps your existing feature extraction code from routes/features.js
 */
featureQueue.process('extract', CONCURRENCY.featureExtraction, async (job) => {
  const { pcapFile, sessionId, isMalicious, jobType } = job.data;
  
  // Check if this is a DPI job or feature extraction job
  const isDPIJob = jobType === 'dpi';
  const jobTypeLabel = isDPIJob ? 'DPI analysis' : 'feature extraction';
  
  console.log(`[Worker] Processing ${jobTypeLabel} job ${job.id} for session ${sessionId}`);
  
  try {
    const inputPcap = path.join(PCAP_PATH, pcapFile);
    if (!fs.existsSync(inputPcap)) {
      throw new Error(`PCAP not found: ${pcapFile}`);
    }

    await job.progress(5);

    // For DPI jobs, just run MMT and return session info (no feature extraction)
    if (isDPIJob) {
      return new Promise((resolve, reject) => {
        // Pass custom sessionId to MMT so it uses our DPI session ID
        startMMTOffline(pcapFile, async (status) => {
          if (status && status.error) {
            return reject(new Error(status.error));
          }
          
          // Use the custom sessionId from DPI request
          const mmtSessionId = status.sessionId;
          if (!mmtSessionId) {
            return reject(new Error('Failed to start MMT offline'));
          }

          console.log(`[Worker] DPI job ${job.id} - MMT started with session: ${mmtSessionId}`);
          await job.progress(50);
          
          const outputDir = path.join(REPORT_PATH, `report-${mmtSessionId}`);
          
          // Poll for MMT completion
          const intervalMs = 2000;
          const maxAttempts = 150;
          let attempts = 0;
          
          const poll = setInterval(async () => {
            const s = getMMTStatus();
            const done = !s.isRunning;
            attempts += 1;
            
            const progress = Math.min(50 + (attempts / maxAttempts) * 50, 100);
            await job.progress(progress);
            
            if (done || attempts >= maxAttempts) {
              clearInterval(poll);
              
              if (!fs.existsSync(outputDir)) {
                console.log(`[Worker] Waiting for output directory: ${outputDir}`);
                // Give it a bit more time
                setTimeout(() => {
                  if (fs.existsSync(outputDir)) {
                    console.log(`[Worker] DPI job ${job.id} completed for session ${mmtSessionId}`);
                    resolve({
                      success: true,
                      sessionId: mmtSessionId,
                      outputDir: outputDir,
                      message: 'DPI analysis completed'
                    });
                  } else {
                    reject(new Error('Output directory not found after MMT completion'));
                  }
                }, 2000);
                return;
              }
              
              console.log(`[Worker] DPI job ${job.id} completed for session ${mmtSessionId}`);
              resolve({
                success: true,
                sessionId: mmtSessionId,
                outputDir: outputDir,
                message: 'DPI analysis completed'
              });
            }
          }, intervalMs);
        }, sessionId);  // Pass custom sessionId to MMT
      });
    }

    // For feature extraction jobs, continue with full pipeline
    return new Promise((resolve, reject) => {
      startMMTOffline(pcapFile, async (status) => {
        if (status && status.error) {
          return reject(new Error(status.error));
        }
        
        const { sessionId: mmtSessionId } = status;
        if (!mmtSessionId) {
          return reject(new Error('Failed to start MMT offline'));
        }

        await job.progress(20);
        
        const outputDir = path.join(REPORT_PATH, `report-${mmtSessionId}`);
        const logFile = path.join(outputDir, `features_${mmtSessionId}.log`);
        
        // Poll for MMT completion
        const intervalMs = 2000;
        const maxAttempts = 150;
        let attempts = 0;
        
        const poll = setInterval(async () => {
          const s = getMMTStatus();
          const done = !s.isRunning && s.sessionId === mmtSessionId;
          attempts += 1;
          
          // Update progress during MMT processing
          const progress = Math.min(20 + (attempts / maxAttempts) * 40, 60);
          await job.progress(progress);
          
          if (done || attempts >= maxAttempts) {
            clearInterval(poll);
            
            if (!fs.existsSync(outputDir)) {
              return reject(new Error('Output directory not found'));
            }
            
            try {
              await job.progress(65);
              
              // Find CSV file
              const csvFiles = listFilesByTypeAsync(outputDir, '.csv') || [];
              const picked = csvFiles.find(f => f !== 'security-reports.csv') || csvFiles[0];
              
              if (!picked) {
                return reject(new Error('No CSV generated by mmt-probe'));
              }
              
              const finalReportCsv = path.join(outputDir, picked);
              const baseName = path.parse(picked).name;
              const outPkl = path.join(outputDir, `${baseName}.pkl`);
              const outCsv = path.join(outputDir, `${baseName}.features.csv`);

              await job.progress(70);
              
              // Run trafficToFeature.py
              const hasLabel = (isMalicious === true || isMalicious === false);
              const featParams = [
                path.join(DEEP_LEARNING_PATH, 'trafficToFeature.py'),
                finalReportCsv,
                outPkl,
                String(Boolean(isMalicious)),
              ];
              
              spawnCommand(PYTHON_CMD, featParams, logFile, async (err2) => {
                if (err2) {
                  return reject(new Error(`trafficToFeature.py failed: ${err2.message}`));
                }

                await job.progress(85);
                
                // Convert PKL to CSV
                const pyInline = [
                  '-c',
                  [
                    'import pandas as pd, numpy as np, sys; ',
                    'inp=sys.argv[1]; out=sys.argv[2]; drop=(len(sys.argv)>3 and sys.argv[3]=="1"); ',
                    'df=pd.read_pickle(inp); ',
                    'df=df[df.notnull().all(axis=1)]; ',
                    'df=df.replace([np.inf, -np.inf], 0)\n',
                    'if drop:\n',
                    '    cols=list(df.columns)\n',
                    '    norm=[str(c).strip().lower() for c in cols]\n',
                    '    to_drop=[cols[i] for i,n in enumerate(norm) if n=="malware"]\n',
                    '    if to_drop: df=df.drop(columns=to_drop)\n',
                    'df.to_csv(out, index=False)'
                  ].join(''),
                  outPkl,
                  outCsv,
                  hasLabel ? '0' : '1',
                ];
                
                spawnCommand(PYTHON_CMD, pyInline, logFile, async (err3) => {
                  if (err3) {
                    return reject(new Error(`PKL->CSV conversion failed: ${err3.message}`));
                  }
                  
                  try {
                    await job.progress(95);
                    
                    const csvContent = fs.readFileSync(outCsv, 'utf8');
                    const lines = csvContent.split('\n').filter(l => l.trim());
                    const featureCount = lines.length - 1; // Exclude header
                    
                    await job.progress(100);
                    
                    console.log(`[Worker] Feature extraction completed for job ${job.id}: ${featureCount} features`);
                    
                    resolve({
                      success: true,
                      sessionId: mmtSessionId,
                      reportDir: outputDir,
                      csvFile: path.basename(outCsv),
                      csvContent,
                      featureCount,
                      message: 'Feature extraction completed'
                    });
                  } catch (e) {
                    reject(new Error(`Failed to read CSV: ${e.message}`));
                  }
                });
              });
            } catch (e) {
              reject(new Error(`Post-processing error: ${e.message}`));
            }
          }
        }, intervalMs);
      });
    });
    
  } catch (error) {
    console.error(`[Worker] Feature extraction failed for job ${job.id}:`, error);
    throw error;
  }
});

/**
 * Model Training Worker
 * 
 * Wraps your existing model training code
 */
trainingQueue.process('train', CONCURRENCY.modelTraining, async (job) => {
  const { sessionId, modelName, datasetPath, algorithm } = job.data;
  
  console.log(`[Worker] Processing training job ${job.id} for model ${modelName}`);
  
  try {
    await job.progress(10);
    
    // Call your existing training function
    // This is just a wrapper - use YOUR actual training code
    const { spawn } = require('child_process');
    
    const modelDir = path.join('/data/models', sessionId);
    fs.mkdirSync(modelDir, { recursive: true });
    
    await job.progress(20);
    
    // Example: Call your Python training script
    const pythonProcess = spawn('python3', [
      path.join(__dirname, '../deep-learning/train.py'),
      '--dataset', datasetPath,
      '--output', modelDir,
      '--model-name', modelName,
      '--algorithm', algorithm || 'random_forest'
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      // Parse progress from Python output if available
      const match = data.toString().match(/Progress: (\d+)%/);
      if (match) {
        job.progress(parseInt(match[1]));
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Wait for process to complete
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Training failed with code ${code}: ${stderr}`));
        }
      });
    });
    
    await job.progress(100);
    
    console.log(`[Worker] Training completed for job ${job.id}`);
    
    return {
      success: true,
      sessionId,
      modelName,
      modelDir,
      modelFile: path.join(modelDir, `${modelName}.h5`),
      message: 'Model training completed'
    };
    
  } catch (error) {
    console.error(`[Worker] Training failed for job ${job.id}:`, error);
    throw error;
  }
});

/**
 * Prediction Worker
 * 
 * Wraps your existing prediction code
 */
predictionQueue.process('predict', CONCURRENCY.prediction, async (job) => {
  const { modelId, datasetId, sessionId } = job.data;
  
  console.log(`[Worker] Processing prediction job ${job.id} for session ${sessionId}`);
  
  try {
    await job.progress(20);
    
    // Call your existing prediction function
    const predictionDir = path.join('/data/predictions', sessionId);
    fs.mkdirSync(predictionDir, { recursive: true });
    
    await job.progress(40);
    
    // Example: Call your Python prediction script
    const { spawn } = require('child_process');
    
    const pythonProcess = spawn('python3', [
      path.join(__dirname, '../deep-learning/predict.py'),
      '--model', path.join('/data/models', modelId),
      '--dataset', path.join('/data/reports', datasetId),
      '--output', predictionDir
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      const match = data.toString().match(/Progress: (\d+)%/);
      if (match) {
        job.progress(parseInt(match[1]));
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prediction failed with code ${code}: ${stderr}`));
        }
      });
    });
    
    await job.progress(100);
    
    console.log(`[Worker] Prediction completed for job ${job.id}`);
    
    return {
      success: true,
      sessionId,
      predictionDir,
      resultsFile: path.join(predictionDir, 'predictions.csv'),
      message: 'Prediction completed'
    };
    
  } catch (error) {
    console.error(`[Worker] Prediction failed for job ${job.id}:`, error);
    throw error;
  }
});

// Event listeners for monitoring
featureQueue.on('completed', (job, result) => {
  console.log(`[Queue] Feature extraction job ${job.id} completed`);
});

featureQueue.on('failed', (job, err) => {
  console.error(`[Queue] Feature extraction job ${job.id} failed:`, err.message);
});

trainingQueue.on('completed', (job, result) => {
  console.log(`[Queue] Training job ${job.id} completed`);
});

trainingQueue.on('failed', (job, err) => {
  console.error(`[Queue] Training job ${job.id} failed:`, err.message);
});

predictionQueue.on('completed', (job, result) => {
  console.log(`[Queue] Prediction job ${job.id} completed`);
});

predictionQueue.on('failed', (job, err) => {
  console.error(`[Queue] Prediction job ${job.id} failed:`, err.message);
});

console.log('[Workers] Started with concurrency:', CONCURRENCY);

module.exports = {
  // Workers are automatically started when this module is loaded
};
