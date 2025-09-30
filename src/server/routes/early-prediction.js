const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to early-prediction scripts
const EARLY_PRED_DIR = path.join(__dirname, '../early-prediction');
const DETECT_SCRIPT = path.join(EARLY_PRED_DIR, 'detect.py');
const FORECAST_SCRIPT = path.join(EARLY_PRED_DIR, 'forecast.py');

console.log('[EARLY-PREDICTION] Route module loaded');
console.log('[EARLY-PREDICTION] Scripts directory:', EARLY_PRED_DIR);
console.log('[EARLY-PREDICTION] detect.py exists:', fs.existsSync(DETECT_SCRIPT));
console.log('[EARLY-PREDICTION] forecast.py exists:', fs.existsSync(FORECAST_SCRIPT));

// State to track if scripts are currently running
let runState = {
  running: false,
  lastRun: null,
  lastError: null,
};

/**
 * POST /api/early-prediction/run
 * Executes detect.py followed by forecast.py sequentially
 * Returns status and any errors
 */
router.post('/run', async (req, res) => {
  if (runState.running) {
    return res.status(409).send({ ok: false, message: 'Scripts are already running' });
  }

  runState.running = true;
  runState.lastError = null;

  try {
    // Check if scripts exist
    if (!fs.existsSync(DETECT_SCRIPT)) {
      throw new Error(`detect.py not found at ${DETECT_SCRIPT}`);
    }
    if (!fs.existsSync(FORECAST_SCRIPT)) {
      throw new Error(`forecast.py not found at ${FORECAST_SCRIPT}`);
    }

    console.log('[EARLY-PREDICTION] Starting detect.py...');
    await runPythonScript(DETECT_SCRIPT, EARLY_PRED_DIR);
    console.log('[EARLY-PREDICTION] detect.py completed successfully');

    console.log('[EARLY-PREDICTION] Starting forecast.py...');
    await runPythonScript(FORECAST_SCRIPT, EARLY_PRED_DIR);
    console.log('[EARLY-PREDICTION] forecast.py completed successfully');

    runState.lastRun = new Date().toISOString();
    runState.running = false;

    res.send({
      ok: true,
      message: 'Early prediction scripts executed successfully',
      lastRun: runState.lastRun,
    });
  } catch (error) {
    console.error('[EARLY-PREDICTION] Error:', error.message || error);
    runState.lastError = error.message || String(error);
    runState.running = false;
    res.status(500).send({
      ok: false,
      message: 'Failed to execute early prediction scripts',
      error: runState.lastError,
    });
  }
});

/**
 * POST /api/early-prediction/run-detect
 * Executes only detect.py
 */
router.post('/run-detect', async (req, res) => {
  if (runState.running) {
    return res.status(409).send({ ok: false, message: 'Scripts are already running' });
  }

  runState.running = true;
  runState.lastError = null;

  try {
    if (!fs.existsSync(DETECT_SCRIPT)) {
      throw new Error(`detect.py not found at ${DETECT_SCRIPT}`);
    }

    console.log('[EARLY-PREDICTION] Starting detect.py...');
    await runPythonScript(DETECT_SCRIPT, EARLY_PRED_DIR);
    console.log('[EARLY-PREDICTION] detect.py completed successfully');

    runState.lastRun = new Date().toISOString();
    runState.running = false;

    res.send({
      ok: true,
      message: 'Anomaly detection completed successfully',
      lastRun: runState.lastRun,
    });
  } catch (error) {
    console.error('[EARLY-PREDICTION] Error:', error.message || error);
    runState.lastError = error.message || String(error);
    runState.running = false;
    res.status(500).send({
      ok: false,
      message: 'Failed to execute anomaly detection',
      error: runState.lastError,
    });
  }
});

/**
 * POST /api/early-prediction/run-forecast
 * Executes only forecast.py
 */
router.post('/run-forecast', async (req, res) => {
  if (runState.running) {
    return res.status(409).send({ ok: false, message: 'Scripts are already running' });
  }

  runState.running = true;
  runState.lastError = null;

  try {
    if (!fs.existsSync(FORECAST_SCRIPT)) {
      throw new Error(`forecast.py not found at ${FORECAST_SCRIPT}`);
    }

    console.log('[EARLY-PREDICTION] Starting forecast.py...');
    await runPythonScript(FORECAST_SCRIPT, EARLY_PRED_DIR);
    console.log('[EARLY-PREDICTION] forecast.py completed successfully');

    runState.lastRun = new Date().toISOString();
    runState.running = false;

    res.send({
      ok: true,
      message: 'Forecast completed successfully',
      lastRun: runState.lastRun,
    });
  } catch (error) {
    console.error('[EARLY-PREDICTION] Error:', error.message || error);
    runState.lastError = error.message || String(error);
    runState.running = false;
    res.status(500).send({
      ok: false,
      message: 'Failed to execute forecast',
      error: runState.lastError,
    });
  }
});

/**
 * GET /api/early-prediction/status
 * Returns current run state
 */
router.get('/status', (req, res) => {
  res.send({
    ok: true,
    running: runState.running,
    lastRun: runState.lastRun,
    lastError: runState.lastError,
  });
});

/**
 * GET /api/early-prediction/data/detected
 * Returns the detected anomalies CSV as JSON
 */
router.get('/data/detected', (req, res) => {
  try {
    const csvPath = path.join(EARLY_PRED_DIR, 'synthetic_flows_detected.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).send({ ok: false, message: 'Detected data not found. Run detection first.' });
    }

    const csv = require('csv-parser');
    const results = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        res.send({ ok: true, data: results });
      })
      .on('error', (err) => {
        res.status(500).send({ ok: false, message: err.message });
      });
  } catch (error) {
    res.status(500).send({ ok: false, message: error.message || 'Failed to read detected data' });
  }
});

/**
 * GET /api/early-prediction/data/forecast
 * Returns forecast data including contributions
 */
router.get('/data/forecast', (req, res) => {
  try {
    const contribPath = path.join(EARLY_PRED_DIR, 'figures', 'forecast_top_contributions.json');
    if (!fs.existsSync(contribPath)) {
      return res.status(404).send({ ok: false, message: 'Forecast data not found. Run forecast first.' });
    }

    const data = JSON.parse(fs.readFileSync(contribPath, 'utf8'));
    res.send({ ok: true, data });
  } catch (error) {
    res.status(500).send({ ok: false, message: error.message || 'Failed to read forecast data' });
  }
});

/**
 * GET /api/early-prediction/data/forecast-chart
 * Returns forecast chart data (historical + predictions + bands)
 */
router.get('/data/forecast-chart', (req, res) => {
  try {
    const forecastDataPath = path.join(EARLY_PRED_DIR, 'figures', 'forecast_data.json');
    if (!fs.existsSync(forecastDataPath)) {
      return res.status(404).send({ ok: false, message: 'Forecast chart data not found. Run forecast first.' });
    }

    const data = JSON.parse(fs.readFileSync(forecastDataPath, 'utf8'));
    res.send({ ok: true, data });
  } catch (error) {
    res.status(500).send({ ok: false, message: error.message || 'Failed to read forecast chart data' });
  }
});

/**
 * Helper function to run a Python script and return a promise
 * @param {string} scriptPath - Full path to the Python script
 * @param {string} cwd - Working directory for the script
 * @returns {Promise<void>}
 */
function runPythonScript(scriptPath, cwd) {
  return new Promise((resolve, reject) => {
    // Use python3 by default; adjust if your environment uses 'python'
    const pythonCmd = process.env.PYTHON_CMD || 'python3';
    const child = spawn(pythonCmd, [scriptPath], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      console.log(`[EARLY-PREDICTION][stdout] ${text.trim()}`);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.error(`[EARLY-PREDICTION][stderr] ${text.trim()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}. stderr: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

module.exports = router;
