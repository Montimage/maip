// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestShapValues,
  requestRunShap,
  requestXAIStatus,
} from '../api';
import {
  setNotification,
  setShapValues,
  setXAIStatus,
} from '../actions';


function* handleRequestShapValues(action) {
  try {
    const modelId = action.payload;
    const shap_values = yield call(() => requestShapValues(modelId));
    //console.log(shap_values);
    yield put(setShapValues(shap_values));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestXAIStatus() {
  try {
    const status = yield call(() => requestXAIStatus());
    // dispatch data
    yield put(setXAIStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestRunShap(action) {
  try {
    const {modelId, numberSamples, maxDisplay} = action.payload;
    const shapStatus = yield call(() => requestRunShap(modelId, numberSamples, maxDisplay));
    console.log(shapStatus);
    yield put(setXAIStatus(shapStatus));
    yield put(setNotification({type: 'success', message: `Run SHAP!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_SHAP_VALUES', handleRequestShapValues);
  yield takeEvery('REQUEST_RUN_SHAP', handleRequestRunShap);
  yield takeEvery('REQUEST_XAI_STATUS', handleRequestXAIStatus);
}

export default watchDatasets;