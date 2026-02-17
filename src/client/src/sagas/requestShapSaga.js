// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';
import { delay } from 'redux-saga/effects';
import { notification } from 'antd';

import {
  requestShapValues,
  requestRunShap,
  requestXAIStatus,
  requestJobStatus,
} from '../api';
import {
  setNotification,
  setShapValues,
  setXAIStatus,
} from '../actions';


function* handleRequestShapValues(action) {
  try {
    const {modelId, labelId} = action.payload;
    const shapValues = yield call(() => requestShapValues(modelId, labelId));
    yield put(setShapValues(shapValues));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestXAIStatus() {
  try {
    const xaiStatus = yield call(() => requestXAIStatus());
    //console.log(xaiStatus);
    yield put(setXAIStatus(xaiStatus));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}


function* handleRequestRunShap(action) {
  try {
    const {modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay} = action.payload;
    const shapStatus = yield call(() => requestRunShap(modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay));
    console.log('[SHAP] Response:', shapStatus);
    
    // Check if queue-based response
    if (shapStatus.useQueue && shapStatus.jobId) {
      console.log('[SHAP] Using queue-based processing, jobId:', shapStatus.jobId);
      
      // Set initial status (running) with jobId to track uniqueness
      yield put(setXAIStatus({ 
        isRunning: true, 
        config: { modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay },
        jobId: shapStatus.jobId 
      }));
      
      // Poll job status until complete
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      
      while (!jobComplete && attempts < maxAttempts) {
        // First poll after 2 seconds, then 5 seconds
        yield delay(attempts === 0 ? 2000 : 5000);
        attempts++;
        
        try {
          const jobStatus = yield call(() => requestJobStatus(shapStatus.jobId, shapStatus.queueName));
          console.log('[SHAP] Job status:', jobStatus.status, 'attempt:', attempts);
          
          if (jobStatus.status === 'completed') {
            console.log('[SHAP] Job completed successfully');
            jobComplete = true;
            
            // Force page refresh by setting isRunning to false
            // This triggers componentDidUpdate in XAIShapPage
            yield put(setXAIStatus({ isRunning: false }));
            
            // Show completion notification using Ant Design directly
            notification.success({
              message: 'SHAP completed',
              description: 'Explanation has been generated successfully',
              placement: 'topRight',
              key: `shap-completed-${shapStatus.jobId}`, // Ant Design handles deduplication with key
            });
            
            // Give the component a moment to detect the change
            yield delay(500);
            
          } else if (jobStatus.status === 'failed') {
            console.error('[SHAP] Job failed:', jobStatus.failedReason);
            yield put(setXAIStatus({ isRunning: false }));
            yield put(setNotification({type: 'error', message: `SHAP failed: ${jobStatus.failedReason || 'Unknown error'}`}));
            jobComplete = true;
          }
          // Otherwise, keep polling
        } catch (pollError) {
          console.error('[SHAP] Polling error:', pollError);
          // Continue polling despite errors
        }
      }
      
      if (!jobComplete) {
        yield put(setXAIStatus({ isRunning: false }));
        yield put(setNotification({type: 'warning', message: 'SHAP timeout - check results later'}));
      }
      
    } else {
      // Old direct processing (blocking mode)
      yield put(setXAIStatus(shapStatus));
      yield put(setNotification({type: 'success', message: `Run SHAP!`}));
    }
    
  } catch (error) {
    // dispatch error
    console.error('[SHAP] Error:', error);
    yield put(setXAIStatus({ isRunning: false }));
    yield put(setNotification({type: 'error', message: String(error)}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_SHAP_VALUES', handleRequestShapValues);
  yield takeEvery('REQUEST_RUN_SHAP', handleRequestRunShap);
  yield takeEvery('REQUEST_XAI_STATUS', handleRequestXAIStatus);
}

export default watchDatasets;