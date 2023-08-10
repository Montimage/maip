// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestBuildStatus,
  requestBuildModel,
  requestBuildStatusAC,
  requestBuildModelAC,
} from '../api';
import {
  setNotification,
  setBuildStatus,
  setBuildStatusAC,
} from '../actions';


function* handleRequestBuildStatus() {
  try {
    const status = yield call(() => requestBuildStatus());
    // dispatch data
    yield put(setBuildStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestBuildModel(action) {
  try {
    const { datasets, ratio, params } = action.payload;
    const buildStatus = yield call(() => requestBuildModel(datasets, ratio, params));
    console.log(buildStatus);
    yield put(setBuildStatus(buildStatus));
    yield put(setNotification({type: 'success', message: `Build a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestBuildStatusAC() {
  try {
    const status = yield call(() => requestBuildStatusAC());
    // dispatch data
    yield put(setBuildStatusAC(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestBuildModelAC(action) {
  try {
    const { modelType, dataset, featuresList ,trainingRatio } = action.payload;
    const buildStatus = yield call(() => 
      requestBuildModelAC(modelType, dataset, featuresList ,trainingRatio));
    console.log(buildStatus);
    yield put(setNotification({type: 'success', message: `Build a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_BUILD_STATUS', handleRequestBuildStatus);
  yield takeEvery('REQUEST_BUILD_MODEL', handleRequestBuildModel);
  yield takeEvery('REQUEST_BUILD_STATUS_AC', handleRequestBuildStatusAC);
  yield takeEvery('REQUEST_BUILD_MODEL_AC', handleRequestBuildModelAC);
}

export default watchDatasets;