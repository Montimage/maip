// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestBuildModel,
  requestBuildStatus,
} from '../api';
import {
  setNotification,
  setBuildStatus,
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

function* watchDatasets() {
  yield takeEvery('REQUEST_BUILD_MODEL', handleRequestBuildModel);
  yield takeEvery('REQUEST_BUILD_STATUS', handleRequestBuildStatus);
}

export default watchDatasets;