// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestMetricCurrentness,
} from '../api';
import {
  setNotification,
  setMetrics,
} from '../actions';

function* handleRequestMetricCurrentness(action) {
  try {
    const modelId = action.payload;
    const metrics = yield call(() => requestMetricCurrentness(modelId));
    yield put(setMetrics(metrics));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_METRIC_CURRENTNESS', handleRequestMetricCurrentness);
}

export default watchDatasets;