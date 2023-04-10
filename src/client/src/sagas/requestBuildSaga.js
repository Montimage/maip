// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestBuildModel,
  requestRetrainModel,
} from '../api';
import {
  setNotification,
  setBuildStatus,
} from '../actions';


function* handleRequestBuildModel(action) {
  try {
    const { datasets, totalSamples, ratio, params } = action.payload;
    const buildStatus = yield call(() => requestBuildModel(datasets, totalSamples, ratio, params));
    console.log(buildStatus);
    yield put(setBuildStatus(buildStatus));
    yield put(setNotification({type: 'success', message: `Build a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestRetrainModel(action) {
  try {
    const { modelId, trainingDataset, testingDataset, params } = action.payload;
    const retrainStatus = yield call(() => requestRetrainModel(
      modelId, trainingDataset, testingDataset, params));
    console.log(retrainStatus);
    yield put(setBuildStatus(retrainStatus));
    yield put(setNotification({type: 'success', message: `Retrain a model!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_BUILD_MODEL', handleRequestBuildModel);
  yield takeEvery('REQUEST_RETRAIN_MODEL', handleRequestRetrainModel);
}

export default watchDatasets;