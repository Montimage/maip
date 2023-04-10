// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestBuildModel,
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

function* watchDatasets() {
  yield takeEvery('REQUEST_BUILD_MODEL', handleRequestBuildModel);
}

export default watchDatasets;