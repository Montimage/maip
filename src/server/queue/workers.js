/**
 * Queue Workers - Process jobs from queues
 * 
 * This wraps your EXISTING code with minimal changes
 * Just import existing functions and call them from workers
 */

const { featureQueue, trainingQueue, predictionQueue, ruleBasedQueue, xaiQueue, attackQueue, retrainQueue } = require('./job-queue');
const path = require('path');
const fs = require('fs');

// Import existing functions and constants
const {
  PCAP_PATH,
  MMT_PROBE_CONFIG_PATH,
  REPORT_PATH,
  DEEP_LEARNING_PATH,
  PYTHON_CMD,
  MODEL_PATH,
  PREDICTION_PATH,
  LOG_PATH,
  TRAINING_PATH,
  ATTACKS_PATH,
} = require('../constants');
const { listFilesByTypeAsync, createFolderSync, writeTextFile, isFileExistSync } = require('../utils/file-utils');
const { spawnCommand, getUniqueId } = require('../utils/utils');
const { startMMTOffline, getMMTStatus } = require('../mmt/mmt-connector');
const {
  performPoisoningCTGAN,
  performPoisoningRSL,
  performPoisoningTLF,
} = require('../deep-learning/attacks-connector');

// Configuration
const CONCURRENCY = {
  featureExtraction: parseInt(process.env.FEATURE_WORKERS) || 3,
  modelTraining: parseInt(process.env.TRAINING_WORKERS) || 2,
  prediction: parseInt(process.env.PREDICTION_WORKERS) || 3,
  ruleBasedDetection: parseInt(process.env.RULEBASED_WORKERS) || 2,
  xaiExplanations: parseInt(process.env.XAI_WORKERS) || 1,  // XAI is CPU intensive
  adversarialAttacks: parseInt(process.env.ATTACK_WORKERS) || 2,  // Attacks are CPU/memory intensive
  modelRetraining: parseInt(process.env.RETRAIN_WORKERS) || 2  // Retraining is very resource intensive
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
        // skipLockCheck=true allows concurrent processing with online DPI
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
        }, sessionId, true);  // Pass custom sessionId and skipLockCheck=true
      });
    }

    // For feature extraction jobs, continue with full pipeline
    return new Promise((resolve, reject) => {
      // skipLockCheck=true allows concurrent processing with online DPI
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
      }, sessionId, true);  // Pass custom sessionId from feature extraction, skipLockCheck=true
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
 * Prediction Worker (Offline ML Prediction)
 * 
 * Wraps existing prediction code from deep-learning/deep-learning-connector.js
 */
predictionQueue.process('predict', CONCURRENCY.prediction, async (job) => {
  const { modelId, reportId, reportFileName, predictionId } = job.data;
  
  console.log(`[Worker] Processing prediction job ${job.id} for model ${modelId}, prediction ${predictionId}`);
  
  try {
    await job.progress(10);
    
    // Use imported constants from constants.js
    const modelPath = path.join(MODEL_PATH, modelId);
    const reportDir = path.join(REPORT_PATH, reportId);
    
    // For predictions, we need the FEATURES CSV, not the raw MMT CSV
    // Try to find .features.csv file, or use the provided filename as fallback
    let csvPath = path.join(reportDir, reportFileName);
    
    // If the provided file doesn't exist, try to find the features CSV
    if (!fs.existsSync(csvPath)) {
      // Look for .features.csv file (created by feature extraction)
      if (fs.existsSync(reportDir)) {
        const files = fs.readdirSync(reportDir);
        const featuresCsv = files.find(f => f.endsWith('.features.csv'));
        
        if (featuresCsv) {
          console.log(`[Worker] Using features CSV: ${featuresCsv} instead of ${reportFileName}`);
          csvPath = path.join(reportDir, featuresCsv);
        }
      }
    }
    
    const predictionPath = path.join(PREDICTION_PATH, predictionId, '/');
    const logFile = path.join(LOG_PATH, `predict_${predictionId}.log`);
    
    console.log(`[Worker] Prediction paths:
      - Report Dir: ${reportDir}
      - Model: ${modelPath}
      - CSV: ${csvPath}
      - Output: ${predictionPath}`);
    
    // Verify model exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model does not exist at path: ${modelPath}`);
    }
    
    // Verify CSV exists
    if (!fs.existsSync(csvPath)) {
      // List available files in the report directory to help debug
      if (fs.existsSync(reportDir)) {
        const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv'));
        throw new Error(`CSV file not found at: ${csvPath}\nAvailable CSV files in ${reportId}: ${files.join(', ') || 'none'}\nNote: Predictions require a .features.csv file from feature extraction`);
      } else {
        throw new Error(`Report directory does not exist: ${reportDir}`);
      }
    }
    
    // Create prediction directory
    fs.mkdirSync(predictionPath, { recursive: true });
    
    await job.progress(20);
    
    // Run prediction.py
    const { spawn } = require('child_process');
    const pythonCmd = process.env.PYTHON_CMD || 'python3';
    const predictionScript = path.join(__dirname, '../deep-learning/prediction.py');
    
    const pythonProcess = spawn(pythonCmd, [predictionScript, csvPath, modelPath, predictionPath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      // Try to parse progress from Python output
      const match = data.toString().match(/Progress[:\s]+(\d+)%/i);
      if (match) {
        const progress = Math.min(20 + parseInt(match[1]) * 0.75, 95);
        job.progress(progress);
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`[Worker] Prediction stderr: ${data}`);
    });
    
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prediction failed with code ${code}: ${stderr || 'No error details'}`));
        }
      });
      
      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to start prediction process: ${err.message}`));
      });
    });
    
    await job.progress(100);
    
    console.log(`[Worker] Prediction completed for job ${job.id}, prediction ${predictionId}`);
    
    return {
      success: true,
      predictionId,
      modelId,
      predictionPath,
      resultsFile: path.join(predictionPath, 'predictions.csv'),
      statsFile: path.join(predictionPath, 'stats.csv'),
      message: 'Prediction completed successfully'
    };
    
  } catch (error) {
    console.error(`[Worker] Prediction failed for job ${job.id}:`, error);
    throw error;
  }
});

/**
 * Rule-based Detection Worker (mmt_security offline)
 */
ruleBasedQueue.process('detect', CONCURRENCY.ruleBasedDetection, async (job) => {
  const { pcapFile, filePath, sessionId, verbose = false, excludeRules, cores } = job.data;
  
  console.log(`[Worker] Processing rule-based detection job ${job.id} for session ${sessionId}`);
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Resolve input path
    let inputPath = filePath || path.join(PCAP_PATH, pcapFile);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`PCAP not found: ${inputPath}`);
    }
    
    // Create output directory for this session
    const SECURITY_OUT_DIR = path.join(__dirname, '../mmt/outputs');
    const outDir = path.join(SECURITY_OUT_DIR, `offline-${sessionId}`);
    fs.mkdirSync(outDir, { recursive: true, mode: 0o777 });
    
    await job.progress(10);
    
    // Resolve mmt_security binary
    const resolveSecurityBin = () => {
      const candidates = [
        '/opt/mmt/security/bin/mmt_security',
        '/opt/mmt/security/bin/mmt-security',
        'mmt_security',
        'mmt-security',
      ];
      for (const p of candidates) {
        try {
          if (p.includes('/') && fs.existsSync(p)) return p;
        } catch (e) {}
      }
      return candidates[0];
    };
    
    const bin = resolveSecurityBin();
    const args = [];
    args.push('-t', inputPath);
    if (verbose) args.push('-v');
    if (excludeRules) args.push('-x', String(excludeRules));
    if (cores) args.push('-c', String(cores));
    args.push('-f', `${outDir}/`);
    
    const cmd = `${bin} ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    console.log(`[Worker] Executing rule-based detection: ${cmd}`);
    
    await job.progress(20);
    
    // Execute mmt_security
    const { stdout, stderr } = await execAsync(cmd);
    
    await job.progress(80);
    
    // Find latest CSV file
    const findLatestSecurityCsv = (dir) => {
      try {
        if (!dir || !fs.existsSync(dir)) return null;
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.csv'))
          .map(f => ({ f, full: path.join(dir, f), st: fs.statSync(path.join(dir, f)) }))
          .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
        return files.length > 0 ? files[0].full : null;
      } catch (e) {
        return null;
      }
    };
    
    const file = findLatestSecurityCsv(outDir);
    
    // Parse rule verdicts from stdout/stderr
    const parseRuleVerdictsFromText = (text) => {
      try {
        const map = new Map();
        String(text || '')
          .split(/\r?\n/)
          .forEach((line) => {
            const m = line.match(/-\s*rule\s+(\d+)\s+generated\s+(\d+)\s+verdicts/i);
            if (m) {
              const rule = Number(m[1]);
              const verdicts = Number(m[2]);
              map.set(rule, verdicts);
            }
          });
        return Array.from(map.entries()).map(([rule, verdicts]) => ({ rule, verdicts }));
      } catch {
        return [];
      }
    };
    
    const ruleVerdicts = parseRuleVerdictsFromText(`${stdout}\n${stderr}`);
    
    await job.progress(100);
    
    console.log(`[Worker] Rule-based detection job ${job.id} completed for session ${sessionId}`);
    
    return {
      success: true,
      sessionId,
      outputDir: outDir,
      outputFile: file,
      ruleVerdicts,
      message: 'Rule-based detection completed'
    };
    
  } catch (error) {
    console.error(`[Worker] Rule-based detection failed for job ${job.id}:`, error);
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

ruleBasedQueue.on('completed', (job, result) => {
  console.log(`[Queue] Rule-based detection job ${job.id} completed`);
});

ruleBasedQueue.on('failed', (job, err) => {
  console.error(`[Queue] Rule-based detection job ${job.id} failed:`, err.message);
});

/**
 * XAI Worker (SHAP/LIME Explanations)
 * 
 * Wraps existing XAI code from deep-learning/xai-connector.js
 */
xaiQueue.process('*', CONCURRENCY.xaiExplanations, async (job) => {
  const { xaiType, modelId, config } = job.data;
  
  console.log(`[Worker] Processing ${xaiType} job ${job.id} for model ${modelId}`);
  
  try {
    const modelPath = path.join(MODEL_PATH, modelId);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model does not exist: ${modelId}`);
    }
    
    await job.progress(10);
    
    const logFile = path.join(LOG_PATH, `xai_${xaiType}_${modelId}.log`);
    let scriptPath, args;
    
    // Determine script and arguments based on XAI type
    if (xaiType === 'shap') {
      const { numberBackgroundSamples, numberExplainedSamples, maxDisplay } = config;
      scriptPath = path.join(DEEP_LEARNING_PATH, 'xai-shap.py');
      args = [scriptPath, modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay];
      
    } else if (xaiType === 'lime') {
      const { sampleId, numberFeature } = config;
      scriptPath = path.join(DEEP_LEARNING_PATH, 'xai-lime.py');
      args = [scriptPath, modelId, sampleId, numberFeature];
      
    } else if (xaiType === 'shap-flow') {
      const { predictionId, sessionId, numberFeature } = config;
      const fsPromises = require('fs').promises;
      
      // Build instance vector from prediction
      const buildInstanceVector = async () => {
        const attackFile = path.join(PREDICTION_PATH, predictionId, 'attacks.csv');
        const allFile = path.join(PREDICTION_PATH, predictionId, 'predictions.csv');
        let csvPath = fs.existsSync(attackFile) ? attackFile : allFile;
        
        if (!fs.existsSync(csvPath)) {
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
            return featureMap;
          }
        }
        throw new Error(`Session ${sessionId} not found in prediction ${predictionId}`);
      };
      
      const featureMap = await buildInstanceVector();
      const tmpDir = path.join(DEEP_LEARNING_PATH, 'xai', 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      const instanceJsonPath = path.join(tmpDir, `${predictionId}_${sessionId}_shap.json`);
      fs.writeFileSync(instanceJsonPath, JSON.stringify(featureMap));
      
      scriptPath = path.join(DEEP_LEARNING_PATH, 'xai-shap-instance.py');
      args = [scriptPath, modelId, instanceJsonPath, numberFeature];
      
    } else if (xaiType === 'lime-flow') {
      const { predictionId, sessionId, numberFeature } = config;
      const fsPromises = require('fs').promises;
      
      // Build instance vector (same logic as shap-flow)
      const buildInstanceVector = async () => {
        const attackFile = path.join(PREDICTION_PATH, predictionId, 'attacks.csv');
        const allFile = path.join(PREDICTION_PATH, predictionId, 'predictions.csv');
        let csvPath = fs.existsSync(attackFile) ? attackFile : allFile;
        
        if (!fs.existsSync(csvPath)) {
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
            return featureMap;
          }
        }
        throw new Error(`Session ${sessionId} not found in prediction ${predictionId}`);
      };
      
      const featureMap = await buildInstanceVector();
      const tmpDir = path.join(DEEP_LEARNING_PATH, 'xai', 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      const instanceJsonPath = path.join(tmpDir, `${predictionId}_${sessionId}.json`);
      fs.writeFileSync(instanceJsonPath, JSON.stringify(featureMap));
      
      scriptPath = path.join(DEEP_LEARNING_PATH, 'xai-lime-instance.py');
      args = [scriptPath, modelId, instanceJsonPath, numberFeature];
      
    } else {
      throw new Error(`Unknown XAI type: ${xaiType}`);
    }
    
    await job.progress(30);
    
    // Execute Python script
    return new Promise((resolve, reject) => {
      spawnCommand(PYTHON_CMD, args, logFile, async (error) => {
        if (error) {
          return reject(new Error(`${xaiType.toUpperCase()} script failed: ${error.message}`));
        }
        
        await job.progress(100);
        
        console.log(`[Worker] ${xaiType.toUpperCase()} job ${job.id} completed for model ${modelId}`);
        
        resolve({
          success: true,
          xaiType,
          modelId,
          message: `${xaiType.toUpperCase()} explanations generated successfully`
        });
      });
      
      // Update progress periodically while running
      const progressInterval = setInterval(async () => {
        const currentProgress = await job.progress();
        if (currentProgress < 90) {
          await job.progress(currentProgress + 10);
        } else {
          clearInterval(progressInterval);
        }
      }, 5000);
    });
    
  } catch (error) {
    console.error(`[Worker] ${xaiType} job ${job.id} failed:`, error);
    throw error;
  }
});

xaiQueue.on('completed', (job, result) => {
  console.log(`[Queue] XAI job ${job.id} completed:`, result.xaiType);
});

xaiQueue.on('failed', (job, err) => {
  console.error(`[Queue] XAI job ${job.id} failed:`, err.message);
});

/**
 * Adversarial Attack Worker
 * 
 * Wraps existing attack code from deep-learning/attacks-connector.js
 */
attackQueue.process('*', CONCURRENCY.adversarialAttacks, async (job) => {
  const { modelId, selectedAttack, poisoningRate, targetClass } = job.data;
  
  console.log(`[Worker] Processing ${selectedAttack} attack job ${job.id} for model ${modelId}`);
  
  try {
    await job.progress(10);
    
    return new Promise((resolve, reject) => {
      const executeAttack = (callback) => {
        switch (selectedAttack) {
          case 'ctgan':
            const ctganConfig = {
              poisoningAttacksConfig: {
                modelId,
                poisoningRate,
              },
            };
            performPoisoningCTGAN(ctganConfig, callback);
            break;
          case 'rsl':
            const rslConfig = {
              poisoningAttacksConfig: {
                modelId,
                poisoningRate,
              },
            };
            performPoisoningRSL(rslConfig, callback);
            break;
          case 'tlf':
            const tlfConfig = {
              poisoningAttacksConfig: {
                modelId,
                poisoningRate,
              },
              targetClass,
            };
            performPoisoningTLF(tlfConfig, callback);
            break;
          default:
            callback({ error: `Unknown attack type: ${selectedAttack}` });
        }
      };
      
      executeAttack(async (result) => {
        if (result.error) {
          return reject(new Error(`Attack failed: ${result.error}`));
        }
        
        await job.progress(100);
        
        console.log(`[Worker] ${selectedAttack} attack job ${job.id} completed for model ${modelId}`);
        
        resolve({
          success: true,
          selectedAttack,
          modelId,
          poisoningRate,
          result,
          message: `${selectedAttack.toUpperCase()} attack completed successfully`
        });
      });
      
      // Update progress periodically while running
      const progressInterval = setInterval(async () => {
        const currentProgress = await job.progress();
        if (currentProgress < 90) {
          await job.progress(currentProgress + 10);
        } else {
          clearInterval(progressInterval);
        }
      }, 5000);
    });
    
  } catch (error) {
    console.error(`[Worker] ${selectedAttack} attack job ${job.id} failed:`, error);
    throw error;
  }
});

attackQueue.on('completed', (job, result) => {
  console.log(`[Queue] Attack job ${job.id} completed:`, result.selectedAttack);
});

attackQueue.on('failed', (job, err) => {
  console.error(`[Queue] Attack job ${job.id} failed:`, err.message);
});

/**
 * Model Retraining Worker (for Impact Metrics)
 * 
 * Wraps existing retraining code from deep-learning-connector.js
 */
retrainQueue.process('retrain', CONCURRENCY.modelRetraining, async (job) => {
  const { modelId, trainingDataset, testingDataset, training_parameters, isACApp } = job.data;
  
  console.log(`[Worker] Processing retrain job ${job.id} for model ${modelId}`);
  
  try {
    await job.progress(10);
    
    const retrainId = getUniqueId();
    const retrainPath = path.join(TRAINING_PATH, retrainId, '/');
    
    // Create retrain directory
    if (!fs.existsSync(retrainPath)) {
      fs.mkdirSync(retrainPath, { recursive: true });
    }
    
    // Save retrain config
    const retrainConfig = {
      modelId,
      trainingDataset,
      testingDataset,
      training_parameters
    };
    
    const retrainConfigPath = path.join(retrainPath, 'retrain-config.json');
    fs.writeFileSync(retrainConfigPath, JSON.stringify(retrainConfig, null, 2), 'utf8');
    
    await job.progress(20);
    
    // Locate training and testing datasets
    const attacksPath = path.join(ATTACKS_PATH, modelId.replace('.h5', ''), '/');
    const trainingPath = path.join(TRAINING_PATH, modelId.replace('.h5', ''), 'datasets', '/');
    
    let trainingDatasetFile = null;
    let testingDatasetFile = null;
    
    // Find training dataset (check attacks path first, then training path)
    if (fs.existsSync(path.join(attacksPath, trainingDataset))) {
      trainingDatasetFile = path.join(attacksPath, trainingDataset);
    } else if (fs.existsSync(path.join(trainingPath, trainingDataset))) {
      trainingDatasetFile = path.join(trainingPath, trainingDataset);
    } else {
      throw new Error(`Training dataset not found: ${trainingDataset}`);
    }
    
    // Find testing dataset
    if (fs.existsSync(path.join(trainingPath, testingDataset))) {
      testingDatasetFile = path.join(trainingPath, testingDataset);
    } else {
      throw new Error(`Testing dataset not found: ${testingDataset}`);
    }
    
    await job.progress(30);
    
    // Spawn Python retraining process
    const { spawn } = require('child_process');
    const logFile = path.join(retrainPath, `retrain_${retrainId}.log`);
    
    const retrainScript = path.join(DEEP_LEARNING_PATH, 'retrain.py');
    
    // Python script expects: train_data test_data result_path nb_epoch_cnn nb_epoch_sae batch_size_cnn batch_size_sae
    const args = [
      retrainScript,
      trainingDatasetFile,
      testingDatasetFile,
      retrainPath,  // result/output path (NOT model path!)
      training_parameters.nb_epoch_cnn || '50',
      training_parameters.nb_epoch_sae || '50',
      training_parameters.batch_size_cnn || '32',
      training_parameters.batch_size_sae || '32'
    ];
    
    await job.progress(40);
    
    const pythonProcess = spawn(PYTHON_CMD, args);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Parse progress from Python output
      const match = output.match(/Epoch\s+(\d+)\/(\d+)/i);
      if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);
        const progress = Math.min(40 + (current / total) * 55, 95);
        job.progress(Math.floor(progress));
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
          reject(new Error(`Retraining failed with code ${code}: ${stderr || 'No error details'}`));
        }
      });
      
      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to start retrain process: ${err.message}`));
      });
    });
    
    await job.progress(100);
    console.log(`[Worker] Retrain completed for job ${job.id}, retrain ID: ${retrainId}`);
    
    return {
      success: true,
      retrainId,
      modelId,
      retrainPath,
      confusionMatrixFile: path.join(retrainPath, 'confusion_matrix.csv'),
      metricsFile: path.join(retrainPath, 'metrics.json'),
      message: 'Model retraining completed successfully'
    };
    
  } catch (error) {
    console.error(`[Worker] Retrain failed for job ${job.id}:`, error);
    throw error;
  }
});

retrainQueue.on('completed', (job, result) => {
  console.log(`[Queue] Retrain job ${job.id} completed for model ${result.modelId}`);
});

retrainQueue.on('failed', (job, err) => {
  console.error(`[Queue] Retrain job ${job.id} failed:`, err.message);
});

console.log('[Workers] Started with concurrency:', CONCURRENCY);

module.exports = {
  // Workers are automatically started when this module is loaded
};
