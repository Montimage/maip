// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';
import { notification } from 'antd';

import {
  requestLimeValues,
  requestRunLime,
  requestXAIStatus,
  requestJobStatus,
} from '../api';
import {
  setNotification,
  setLimeValues,
  setXAIStatus,
} from '../actions';
import { delay } from 'redux-saga/effects';


function* handleRequestLimeValues(action) {
  try {
    const modelId = action.payload;
    const limeValues = yield call(() => requestLimeValues(modelId));
    //console.log(limeValues);
    yield put(setLimeValues(limeValues));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestRunLime(action) {
  try {
    const {modelId, sampleId, numberFeatures} = action.payload;
    const limeStatus = yield call(() => requestRunLime(modelId, sampleId, numberFeatures));
    console.log('[LIME] Response:', limeStatus);
    
    // Check if queue-based response
    if (limeStatus.useQueue && limeStatus.jobId) {
      console.log('[LIME] Using queue-based processing, jobId:', limeStatus.jobId);
      
      // Set initial status (running) with jobId to track uniqueness
      yield put(setXAIStatus({ 
        isRunning: true, 
        config: { modelId, sampleId, numberFeatures },
        jobId: limeStatus.jobId 
      }));
      
      // Poll job status until complete
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      
      while (!jobComplete && attempts < maxAttempts) {
        // First poll after 1 second (LIME is usually fast), then 5 seconds
        yield delay(attempts === 0 ? 1000 : 5000);
        attempts++;
        
        try {
          const jobStatus = yield call(() => requestJobStatus(limeStatus.jobId, limeStatus.queueName));
          console.log('[LIME] Job status:', jobStatus.status, 'attempt:', attempts);
          
          if (jobStatus.status === 'completed') {
            console.log('[LIME] Job completed successfully');
            jobComplete = true;
            
            // Force page refresh by setting isRunning to false
            // This triggers componentDidUpdate in XAILimePage
            yield put(setXAIStatus({ isRunning: false }));
            
            // Show completion notification using Ant Design directly
            notification.success({
              message: 'LIME completed',
              description: 'Explanation has been generated successfully',
              placement: 'topRight',
              key: `lime-completed-${limeStatus.jobId}`, // Ant Design handles deduplication with key
            });
            
            // Give the component a moment to detect the change
            yield delay(500);
            
          } else if (jobStatus.status === 'failed') {
            console.error('[LIME] Job failed:', jobStatus.failedReason);
            yield put(setXAIStatus({ isRunning: false }));
            yield put(setNotification({type: 'error', message: `LIME failed: ${jobStatus.failedReason || 'Unknown error'}`}));
            jobComplete = true;
          }
          // Otherwise, keep polling
        } catch (pollError) {
          console.error('[LIME] Polling error:', pollError);
          // Continue polling despite errors
        }
      }
      
      if (!jobComplete) {
        yield put(setXAIStatus({ isRunning: false }));
        yield put(setNotification({type: 'warning', message: 'LIME timeout - check results later'}));
      }
      
    } else {
      // Old direct processing (blocking mode)
      yield put(setXAIStatus(limeStatus));
      yield put(setNotification({type: 'success', message: `Run LIME!`}));
    }
    
  } catch (error) {
    // dispatch error
    console.error('[LIME] Error:', error);
    yield put(setXAIStatus({ isRunning: false }));
    yield put(setNotification({type: 'error', message: String(error)}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_LIME_VALUES', handleRequestLimeValues);
  yield takeEvery('REQUEST_RUN_LIME', handleRequestRunLime);
}

export default watchDatasets;