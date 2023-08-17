// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainModelAC,
  requestRetrainStatusAC,
} from '../api';
import {
  setNotification,
  setRetrainStatus,
  setRetrainStatusAC,
} from '../actions';


function* handleRequestRetrainStatus() {
  try {
    const status = yield call(() => requestRetrainStatus());
    // dispatch data
    yield put(setRetrainStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestRetrainModel(action) {
  try {
    const { modelId, trainingDataset, testingDataset, params } = action.payload;
    const retrainStatus = yield call(() => requestRetrainModel(
      modelId, trainingDataset, testingDataset, params));
    console.log(retrainStatus);
    yield put(setRetrainStatus(retrainStatus));
    //yield put(setNotification({type: 'success', message: `Retrain a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestRetrainStatusAC() {
  try {
    const status = yield call(() => requestRetrainStatusAC());
    // dispatch data
    yield put(setRetrainStatusAC(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestRetrainModelAC(action) {
  try {
    const { modelId, trainingDataset, testingDataset } = action.payload;
    const retrainStatus = yield call(() => requestRetrainModelAC(
      modelId, trainingDataset, testingDataset));
    console.log(retrainStatus);
    yield put(setRetrainStatusAC(retrainStatus));
    //yield put(setNotification({type: 'success', message: `Retrain a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_RETRAIN_MODEL', handleRequestRetrainModel);
  yield takeEvery('REQUEST_RETRAIN_STATUS', handleRequestRetrainStatus);
  yield takeEvery('REQUEST_RETRAIN_MODEL_AC', handleRequestRetrainModelAC);
  yield takeEvery('REQUEST_RETRAIN_STATUS_AC', handleRequestRetrainStatusAC);
}

export default watchDatasets;