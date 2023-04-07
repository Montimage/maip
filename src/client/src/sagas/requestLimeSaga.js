// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestLimeValues,
  requestRunLime,
  requestXAIStatus,
} from '../api';
import {
  setNotification,
  setLimeValues,
  setXAIStatus,
} from '../actions';


function* handleRequestLimeValues(action) {
  try {
    const modelId = action.payload;
    const lime_values = yield call(() => requestLimeValues(modelId));
    //console.log(lime_values);
    yield put(setLimeValues(lime_values));
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
    console.log(limeStatus);
    yield put(setXAIStatus(limeStatus));
    yield put(setNotification({type: 'success', message: `Run LIME!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_LIME_VALUES', handleRequestLimeValues);
  yield takeEvery('REQUEST_RUN_LIME', handleRequestRunLime);
}

export default watchDatasets;