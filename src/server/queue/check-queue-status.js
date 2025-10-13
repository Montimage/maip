#!/usr/bin/env node
/**
 * Quick Queue Status Checker
 * Shows current state of all queues
 */

const { getQueueStats } = require('./job-queue');

async function checkStatus() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('QUEUE STATUS');
    console.log('='.repeat(70));
    console.log(`Time: ${new Date().toISOString()}\n`);
    
    const stats = await getQueueStats();
    
    // Feature Extraction Queue
    console.log('📦 Feature Extraction Queue:');
    console.log(`   Workers:   ${stats.featureExtraction.workers}`);
    console.log(`   Waiting:   ${stats.featureExtraction.waiting || 0}`);
    console.log(`   Active:    ${stats.featureExtraction.active || 0}`);
    console.log(`   Completed: ${stats.featureExtraction.completed || 0}`);
    console.log(`   Failed:    ${stats.featureExtraction.failed || 0}`);
    
    // Model Training Queue
    console.log('\n🎓 Model Training Queue:');
    console.log(`   Workers:   ${stats.modelTraining.workers}`);
    console.log(`   Waiting:   ${stats.modelTraining.waiting || 0}`);
    console.log(`   Active:    ${stats.modelTraining.active || 0}`);
    console.log(`   Completed: ${stats.modelTraining.completed || 0}`);
    console.log(`   Failed:    ${stats.modelTraining.failed || 0}`);
    
    // Prediction Queue
    console.log('\n🔮 Prediction Queue:');
    console.log(`   Workers:   ${stats.prediction.workers}`);
    console.log(`   Waiting:   ${stats.prediction.waiting || 0}`);
    console.log(`   Active:    ${stats.prediction.active || 0}`);
    console.log(`   Completed: ${stats.prediction.completed || 0}`);
    console.log(`   Failed:    ${stats.prediction.failed || 0}`);
    
    // Total
    console.log('\n📊 Total Across All Queues:');
    console.log(`   Waiting:   ${stats.total.waiting || 0}`);
    console.log(`   Active:    ${stats.total.active || 0}`);
    console.log(`   Completed: ${stats.total.completed || 0}`);
    console.log(`   Failed:    ${stats.total.failed || 0}`);
    
    // Health status
    const totalJobs = (stats.total.waiting || 0) + (stats.total.active || 0);
    const failRate = stats.total.failed / (stats.total.completed + stats.total.failed + 1);
    
    console.log('\n🏥 Health Status:');
    if (totalJobs > 50) {
      console.log(`   ⚠️  HIGH LOAD: ${totalJobs} jobs in queue`);
    } else if (totalJobs > 20) {
      console.log(`   ⚡ MODERATE LOAD: ${totalJobs} jobs in queue`);
    } else {
      console.log(`   ✅ NORMAL: ${totalJobs} jobs in queue`);
    }
    
    if (failRate > 0.1) {
      console.log(`   ⚠️  HIGH FAILURE RATE: ${(failRate * 100).toFixed(1)}%`);
    } else {
      console.log(`   ✅ HEALTHY: ${(failRate * 100).toFixed(1)}% failure rate`);
    }
    
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking queue status:', error.message);
    console.error('\nMake sure Redis is running: redis-server');
    process.exit(1);
  }
}

checkStatus();
