#!/usr/bin/env node
/**
 * Comprehensive Stress Test: All Queue Functionalities
 *
 * Simulates 30+ concurrent users performing various queue-based operations:
 * - Feature Extraction (including DPI)
 * - Model Training
 * - Prediction
 * - Rule-based Detection
 * - XAI Explanations
 * - Adversarial Attacks
 * - Model Retraining
 *
 * Usage:
 *   node stress-test-multi-queue.js --all
 *   node stress-test-multi-queue.js --feature-extraction --users 20
 *   node stress-test-multi-queue.js --prediction --model model-1
 *   node stress-test-multi-queue.js --training --algorithm random_forest
 *
 * Environment Variables:
 *   NUM_USERS=30                    # Total users to simulate
 *   TEST_FUNCTIONALITY=all          # Which functionality to test (all, feature-extraction, training, prediction, attacks, xai, rule-based)
 *   PCAP_FILE=botnet_honeypot.pcap  # Default PCAP file
 *   MODEL_ID=model-1                # Default model for prediction/attacks
 *   ATTACK_TYPE=ctgan               # Default attack type
 *   ALGORITHM=random_forest         # Default training algorithm
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 31057;
const NUM_USERS = parseInt(process.env.NUM_USERS) || 30;
const TEST_FUNCTIONALITY = process.env.TEST_FUNCTIONALITY || 'all';
const PCAP_FILE = process.env.PCAP_FILE || 'botnet_honeypot.pcap';
const MODEL_ID = process.env.MODEL_ID || 'botnet_model';
const ATTACK_TYPE = process.env.ATTACK_TYPE || 'ctgan';
const ALGORITHM = process.env.ALGORITHM || 'random_forest';

// Test scenarios with their weights for realistic distribution
const TEST_SCENARIOS = {
  'feature-extraction': {
    weight: 0.35,
    endpoint: '/api/queue/feature-extraction',
    name: 'Feature Extraction',
    generatePayload: (userId) => ({
      pcapFile: PCAP_FILE,
      sessionId: `stress-test-fe-${userId}-${Date.now()}`,
      isMalicious: Math.random() > 0.5,
      priority: Math.floor(Math.random() * 5) + 1
    })
  },
  'dpi': {
    weight: 0.15,
    endpoint: '/api/queue/feature-extraction',
    name: 'DPI Analysis',
    generatePayload: (userId) => ({
      pcapFile: PCAP_FILE,
      sessionId: `stress-test-dpi-${userId}-${Date.now()}`,
      jobType: 'dpi',
      priority: Math.floor(Math.random() * 5) + 1
    })
  },
  'training': {
    weight: 0.15,
    endpoint: '/api/queue/model-training',
    name: 'Model Training',
    generatePayload: (userId) => ({
      sessionId: `stress-test-train-${userId}-${Date.now()}`,
      modelName: `test-model-${userId}`,
      datasetPath: '/data/datasets/training-set',
      algorithm: ALGORITHM,
      priority: Math.floor(Math.random() * 3) + 3 // Higher priority for training
    })
  },
  'prediction': {
    weight: 0.20,
    endpoint: '/api/queue/prediction',
    name: 'Prediction',
    generatePayload: (userId) => ({
      modelId: MODEL_ID,
      datasetId: `dataset-${userId}`,
      sessionId: `stress-test-pred-${userId}-${Date.now()}`,
      priority: Math.floor(Math.random() * 5) + 1
    })
  },
  'rule-based': {
    weight: 0.10,
    endpoint: '/api/queue/rule-based-detection',
    name: 'Rule-based Detection',
    generatePayload: (userId) => ({
      pcapFile: PCAP_FILE,
      sessionId: `stress-test-rb-${userId}-${Date.now()}`,
      verbose: false,
      priority: Math.floor(Math.random() * 5) + 1
    })
  },
  'xai': {
    weight: 0.03,
    endpoint: '/api/queue/xai-explanations',
    name: 'XAI Explanations',
    generatePayload: (userId) => ({
      xaiType: Math.random() > 0.5 ? 'shap' : 'lime',
      modelId: MODEL_ID,
      config: {
        samples: 100,
        background_samples: 50
      },
      priority: Math.floor(Math.random() * 3) + 3 // Higher priority for XAI
    })
  },
  'attacks': {
    weight: 0.02,
    endpoint: '/api/queue/attack',
    name: 'Adversarial Attacks',
    generatePayload: (userId) => ({
      modelId: MODEL_ID,
      selectedAttack: ATTACK_TYPE,
      poisoningRate: Math.random() * 0.3 + 0.1, // 10-40% poisoning rate
      targetClass: Math.random() > 0.5 ? 1 : 0,
      priority: Math.floor(Math.random() * 3) + 3 // Higher priority for attacks
    })
  }
};

// Results storage
const results = {
  users: [],
  startTime: null,
  endTime: null,
  submissionEndTime: null,
  scenarioBreakdown: {}
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15 * 60 * 1000 // 15 minute timeout for complex operations
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Poll job status until completion
 */
async function pollJobStatus(jobId, queueName, maxAttempts = 180, intervalMs = 5000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await makeRequest('GET', `/api/queue/status/${queueName}/${jobId}`);

      if (response.statusCode === 200 && response.data.success) {
        const status = response.data.status;

        if (status === 'completed') {
          return { success: true, result: response.data.result };
        } else if (status === 'failed') {
          return { success: false, error: response.data.failedReason || 'Job failed' };
        }
        // Still waiting or active, continue polling
      }
    } catch (error) {
      // Continue polling on error
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { success: false, error: 'Timeout waiting for job completion' };
}

/**
 * Select a random scenario based on weights
 */
function selectScenario() {
  const scenarios = Object.keys(TEST_SCENARIOS);
  const random = Math.random();
  let cumulative = 0;

  for (const scenario of scenarios) {
    cumulative += TEST_SCENARIOS[scenario].weight;
    if (random <= cumulative) {
      return scenario;
    }
  }

  return scenarios[0];
}

/**
 * Select scenario based on TEST_FUNCTIONALITY setting
 */
function selectScenarioByConfig() {
  if (TEST_FUNCTIONALITY === 'all') {
    return selectScenario();
  }

  // Check if the specified functionality exists
  if (TEST_SCENARIOS[TEST_FUNCTIONALITY]) {
    return TEST_FUNCTIONALITY;
  }

  // Fallback to feature extraction
  console.warn(`Unknown functionality: ${TEST_FUNCTIONALITY}, defaulting to feature-extraction`);
  return 'feature-extraction';
}

/**
 * Simulate a single user
 */
async function simulateUser(userId) {
  const userResult = {
    userId,
    scenario: null,
    submissionTime: null,
    submissionSuccess: false,
    jobId: null,
    queueName: null,
    queuePosition: null,
    estimatedWait: null,
    completionTime: null,
    totalTime: null,
    status: null,
    error: null
  };

  const userStartTime = Date.now();
  const scenario = selectScenarioByConfig();

  userResult.scenario = TEST_SCENARIOS[scenario].name;

  try {
    console.log(`[User ${userId}] Submitting ${userResult.scenario} job...`);

    const submitStart = Date.now();
    const payload = TEST_SCENARIOS[scenario].generatePayload(userId);
    const response = await makeRequest('POST', TEST_SCENARIOS[scenario].endpoint, payload);
    const submitEnd = Date.now();

    userResult.submissionTime = submitEnd - submitStart;

    if (response.statusCode === 200 && response.data.success) {
      userResult.submissionSuccess = true;
      userResult.jobId = response.data.jobId;
      userResult.queueName = response.data.queueName;
      userResult.queuePosition = response.data.position;
      userResult.estimatedWait = response.data.estimatedWait;

      console.log(`[User ${userId}] ✓ ${userResult.scenario} job queued: ${userResult.jobId} (Position: ${userResult.queuePosition})`);

      // Poll for completion
      console.log(`[User ${userId}] ⏳ Waiting for ${userResult.scenario} to complete...`);
      const pollResult = await pollJobStatus(userResult.jobId, userResult.queueName);

      const totalTime = Date.now() - userStartTime;
      userResult.totalTime = totalTime;

      if (pollResult.success) {
        userResult.completionTime = totalTime;
        userResult.status = 'completed';
        console.log(`[User ${userId}] ✓ ${userResult.scenario} completed in ${(totalTime / 1000).toFixed(2)}s`);
      } else {
        userResult.error = pollResult.error;
        userResult.status = 'failed';
        console.log(`[User ${userId}] ✗ ${userResult.scenario} failed: ${pollResult.error}`);
      }

    } else {
      userResult.error = response.data.message || response.data.error || 'Submission failed';
      userResult.status = 'failed';
      console.log(`[User ${userId}] ✗ ${userResult.scenario} submission failed: ${response.statusCode} - ${userResult.error}`);
    }

  } catch (error) {
    userResult.error = error.message;
    userResult.status = 'error';
    console.log(`[User ${userId}] ✗ ${userResult.scenario} error: ${error.message}`);
  }

  return userResult;
}

/**
 * Monitor queue statistics during test
 */
async function monitorQueue(intervalMs = 5000) {
  const snapshots = [];

  const monitor = setInterval(async () => {
    try {
      const response = await makeRequest('GET', '/api/queue/stats');
      if (response.statusCode === 200 && response.data.stats) {
        const stats = response.data.stats;
        const snapshot = {
          timestamp: new Date().toISOString(),
          total: {
            waiting: stats.total?.waiting || 0,
            active: stats.total?.active || 0,
            completed: stats.total?.completed || 0,
            failed: stats.total?.failed || 0
          },
          byQueue: {
            featureExtraction: {
              waiting: stats.featureExtraction?.waiting || 0,
              active: stats.featureExtraction?.active || 0,
              completed: stats.featureExtraction?.completed || 0,
              failed: stats.featureExtraction?.failed || 0
            },
            modelTraining: {
              waiting: stats.modelTraining?.waiting || 0,
              active: stats.modelTraining?.active || 0,
              completed: stats.modelTraining?.completed || 0,
              failed: stats.modelTraining?.failed || 0
            },
            prediction: {
              waiting: stats.prediction?.waiting || 0,
              active: stats.prediction?.active || 0,
              completed: stats.prediction?.completed || 0,
              failed: stats.prediction?.failed || 0
            },
            ruleBasedDetection: {
              waiting: stats.ruleBasedDetection?.waiting || 0,
              active: stats.ruleBasedDetection?.active || 0,
              completed: stats.ruleBasedDetection?.completed || 0,
              failed: stats.ruleBasedDetection?.failed || 0
            },
            xaiExplanations: {
              waiting: stats.xaiExplanations?.waiting || 0,
              active: stats.xaiExplanations?.active || 0,
              completed: stats.xaiExplanations?.completed || 0,
              failed: stats.xaiExplanations?.failed || 0
            },
            adversarialAttacks: {
              waiting: stats.adversarialAttacks?.waiting || 0,
              active: stats.adversarialAttacks?.active || 0,
              completed: stats.adversarialAttacks?.completed || 0,
              failed: stats.adversarialAttacks?.failed || 0
            },
            modelRetraining: {
              waiting: stats.modelRetraining?.waiting || 0,
              active: stats.modelRetraining?.active || 0,
              completed: stats.modelRetraining?.completed || 0,
              failed: stats.modelRetraining?.failed || 0
            }
          }
        };

        snapshots.push(snapshot);

        console.log(`[Queue Monitor] Total: ${snapshot.total.waiting} waiting, ${snapshot.total.active} active, ${snapshot.total.completed} completed`);
      }
    } catch (error) {
      // Ignore monitoring errors
    }
  }, intervalMs);

  return {
    stop: () => {
      clearInterval(monitor);
      return snapshots;
    }
  };
}

/**
 * Print detailed results
 */
function printResults(userResults, queueSnapshots) {
  console.log('\n' + '='.repeat(100));
  console.log('COMPREHENSIVE STRESS TEST RESULTS: ALL QUEUE FUNCTIONALITIES');
  console.log('='.repeat(100));

  // Overall timing
  const totalTime = (results.endTime - results.startTime) / 1000;
  const submissionTime = (results.submissionEndTime - results.startTime) / 1000;

  console.log('\n📊 Overall Timing:');
  console.log(`  Total test duration:     ${totalTime.toFixed(2)}s`);
  console.log(`  Job submission phase:    ${submissionTime.toFixed(2)}s`);
  console.log(`  Processing phase:        ${(totalTime - submissionTime).toFixed(2)}s`);

  // Submission metrics
  const successfulSubmissions = userResults.filter(r => r.submissionSuccess).length;
  const failedSubmissions = userResults.filter(r => !r.submissionSuccess).length;

  const submissionTimes = userResults
    .filter(r => r.submissionTime)
    .map(r => r.submissionTime);

  const avgSubmissionTime = submissionTimes.length > 0
    ? submissionTimes.reduce((a, b) => a + b, 0) / submissionTimes.length
    : 0;

  console.log('\n📤 Job Submission:');
  console.log(`  Successful:              ${successfulSubmissions}/${NUM_USERS}`);
  console.log(`  Failed:                  ${failedSubmissions}/${NUM_USERS}`);
  console.log(`  Avg submission time:     ${avgSubmissionTime.toFixed(0)}ms`);
  console.log(`  Submission rate:         ${(successfulSubmissions / submissionTime).toFixed(2)} jobs/second`);

  // Completion metrics
  const completedJobs = userResults.filter(r => r.status === 'completed').length;
  const failedJobs = userResults.filter(r => r.status === 'failed' || r.status === 'error').length;

  const completionTimes = userResults
    .filter(r => r.completionTime)
    .map(r => r.completionTime);

  const avgCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    : 0;

  console.log('\n✅ Job Completion:');
  console.log(`  Completed:               ${completedJobs}/${NUM_USERS}`);
  console.log(`  Failed:                  ${failedJobs}/${NUM_USERS}`);
  console.log(`  Success rate:            ${((completedJobs / NUM_USERS) * 100).toFixed(1)}%`);

  if (completionTimes.length > 0) {
    console.log(`  Avg completion time:     ${(avgCompletionTime / 1000).toFixed(2)}s`);
    console.log(`  Throughput:              ${(completedJobs / totalTime).toFixed(2)} jobs/second`);
  }

  // Scenario breakdown
  console.log('\n📋 Scenario Breakdown:');
  const scenarioStats = {};
  userResults.forEach(result => {
    if (!scenarioStats[result.scenario]) {
      scenarioStats[result.scenario] = { total: 0, completed: 0, avgTime: 0, times: [] };
    }
    scenarioStats[result.scenario].total++;
    if (result.status === 'completed') {
      scenarioStats[result.scenario].completed++;
      scenarioStats[result.scenario].times.push(result.completionTime);
    }
  });

  Object.entries(scenarioStats).forEach(([scenario, stats]) => {
    const avgTime = stats.times.length > 0
      ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length / 1000
      : 0;
    const successRate = ((stats.completed / stats.total) * 100).toFixed(1);
    console.log(`  ${scenario}: ${stats.completed}/${stats.total} (${successRate}%) - Avg: ${avgTime.toFixed(2)}s`);
  });

  // Fastest and slowest users
  console.log('\n⚡ Top 5 Fastest Users:');
  const sortedBySpeed = [...userResults]
    .filter(r => r.completionTime)
    .sort((a, b) => a.completionTime - b.completionTime);

  sortedBySpeed.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. User ${r.userId} (${r.scenario}): ${(r.completionTime / 1000).toFixed(2)}s`);
  });

  console.log('\n🐌 Top 5 Slowest Users:');
  sortedBySpeed.slice(-5).reverse().forEach((r, i) => {
    console.log(`  ${i + 1}. User ${r.userId} (${r.scenario}): ${(r.completionTime / 1000).toFixed(2)}s`);
  });

  // Queue activity
  if (queueSnapshots.length > 0) {
    console.log('\n📈 Queue Activity:');
    console.log(`  Peak waiting jobs:       ${Math.max(...queueSnapshots.map(s => s.total.waiting))}`);
    console.log(`  Peak active jobs:        ${Math.max(...queueSnapshots.map(s => s.total.active))}`);
    console.log(`  Total snapshots:         ${queueSnapshots.length}`);
  }

  // Performance summary
  console.log('\n' + '='.repeat(100));
  console.log('\n🎯 Performance Summary:');
  console.log(`  ✓ ${successfulSubmissions} users submitted jobs in ${submissionTime.toFixed(2)}s`);
  console.log(`  ✓ ${completedJobs} jobs completed successfully`);
  console.log(`  ✓ Average time per user: ${(avgCompletionTime / 1000).toFixed(2)}s`);
  console.log(`  ✓ System throughput: ${(completedJobs / totalTime).toFixed(2)} jobs/second`);

  if (completedJobs === NUM_USERS) {
    console.log('\n🎉 SUCCESS: All users completed successfully!');
  } else if (completedJobs >= NUM_USERS * 0.9) {
    console.log('\n✅ GOOD: 90%+ success rate');
  } else {
    console.log('\n⚠️  WARNING: Success rate below 90%');
  }

  console.log('\n' + '='.repeat(100));
}

/**
 * Save results to file
 */
function saveResults(userResults, queueSnapshots) {
  const outputDir = path.join(__dirname, 'stress-test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `stress-test-multi-queue-${NUM_USERS}users-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  const data = {
    config: {
      numUsers: NUM_USERS,
      testFunctionality: TEST_FUNCTIONALITY,
      pcapFile: PCAP_FILE,
      modelId: MODEL_ID,
      attackType: ATTACK_TYPE,
      algorithm: ALGORITHM,
      serverHost: SERVER_HOST,
      serverPort: SERVER_PORT
    },
    timing: {
      startTime: new Date(results.startTime).toISOString(),
      endTime: new Date(results.endTime).toISOString(),
      submissionEndTime: new Date(results.submissionEndTime).toISOString(),
      totalDuration: (results.endTime - results.startTime) / 1000,
      submissionDuration: (results.submissionEndTime - results.startTime) / 1000
    },
    results: userResults,
    queueSnapshots: queueSnapshots,
    scenarios: Object.keys(TEST_SCENARIOS)
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\n💾 Results saved to: ${filepath}`);
}

/**
 * Display usage information
 */
function displayUsage() {
  console.log(`
🔧 Comprehensive Queue Stress Test - Usage:

Basic Commands:
  node stress-test-multi-queue.js                    # Test all functionalities (30 users)
  NUM_USERS=20 node stress-test-multi-queue.js       # Test with 20 users

Specific Functionality Testing:
  TEST_FUNCTIONALITY=feature-extraction NUM_USERS=10 node stress-test-multi-queue.js
  TEST_FUNCTIONALITY=training NUM_USERS=5 node stress-test-multi-queue.js
  TEST_FUNCTIONALITY=prediction MODEL_ID=botnet_model NUM_USERS=15 node stress-test-multi-queue.js
  TEST_FUNCTIONALITY=attacks ATTACK_TYPE=ctgan NUM_USERS=5 node stress-test-multi-queue.js

Available Functionalities:
  - all                    # All functionalities (default)
  - feature-extraction     # PCAP feature extraction
  - dpi                    # DPI analysis (subset of feature extraction)
  - training               # Model training
  - prediction             # ML predictions
  - rule-based             # Rule-based detection
  - xai                    # XAI explanations (SHAP/LIME)
  - attacks                # Adversarial attacks

Configuration Options:
  NUM_USERS=30                    # Number of concurrent users
  PCAP_FILE=botnet_honeypot.pcap  # Default PCAP file
  MODEL_ID=botnet_model           # Default model for prediction/attacks
  ATTACK_TYPE=ctgan               # Attack type (ctgan, rsl, tlf)
  ALGORITHM=random_forest         # Training algorithm
  SERVER_HOST=localhost           # Server hostname
  SERVER_PORT=31057               # Server port

Examples:
  # Test feature extraction only
  TEST_FUNCTIONALITY=feature-extraction NUM_USERS=25 node stress-test-multi-queue.js

  # Test prediction workload
  TEST_FUNCTIONALITY=prediction MODEL_ID=botnet_model NUM_USERS=20 node stress-test-multi-queue.js

  # Test training only
  TEST_FUNCTIONALITY=training ALGORITHM=random_forest NUM_USERS=5 node stress-test-multi-queue.js

  # Mixed workload (all functionalities)
  NUM_USERS=30 node stress-test-multi-queue.js

Prerequisites:
  1. Redis server running: redis-cli ping
  2. MAIP server running: npm start
  3. Queue workers running: npm run workers
  4. PCAP files in src/server/mmt/pcaps/samples/
  5. Models in src/server/deep-learning/models/

Results are saved to: stress-test-results/stress-test-multi-queue-*.json
`);
}

/**
 * Main test function
 */
async function main() {
  // Check command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    displayUsage();
    return;
  }

  console.log('='.repeat(100));
  console.log('COMPREHENSIVE STRESS TEST: ALL QUEUE FUNCTIONALITIES');
  console.log('='.repeat(100));
  console.log(`Server:           http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`Users:            ${NUM_USERS}`);
  console.log(`Functionality:    ${TEST_FUNCTIONALITY}`);
  console.log(`PCAP File:        ${PCAP_FILE}`);
  console.log(`Model ID:         ${MODEL_ID}`);
  console.log(`Attack Type:      ${ATTACK_TYPE}`);
  console.log(`Algorithm:        ${ALGORITHM}`);
  console.log('='.repeat(100));

  // Check if server is running
  try {
    await makeRequest('GET', '/api/queue/health');
    console.log('✓ Server is running\n');
  } catch (error) {
    console.error('✗ Cannot connect to server:', error.message);
    console.error('\nPlease start the server first:');
    console.error('  npm start');
    process.exit(1);
  }

  // Start queue monitoring
  console.log('Starting comprehensive queue monitor...\n');
  const queueMonitor = await monitorQueue(5000);

  // Start test
  results.startTime = Date.now();

  console.log(`Submitting ${NUM_USERS} jobs across different functionalities...\n`);

  // Submit all jobs concurrently
  const userPromises = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    userPromises.push(simulateUser(i));
  }

  // Wait for all users to complete
  const userResults = await Promise.all(userPromises);
  results.submissionEndTime = Date.now();
  results.endTime = Date.now();

  console.log(`\n✓ All ${NUM_USERS} users completed!`);

  // Stop monitoring
  const queueSnapshots = queueMonitor.stop();

  // Print results
  printResults(userResults, queueSnapshots);

  // Save results
  saveResults(userResults, queueSnapshots);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(0);
});

// Run test
if (require.main === module) {
  main().catch(error => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { simulateUser, main, TEST_SCENARIOS };
