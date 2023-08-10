// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestDatasetsAC,
} from '../api';
import {
  setNotification,
  setDatasetsAC,
} from '../actions';

function* handleRequestDatasetsAC(action) {
  try {
    console.log(action.payload);
    const datasets = yield call(() => requestDatasetsAC());
    yield put(setDatasetsAC(datasets));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_DATASETS_AC', handleRequestDatasetsAC);
}

export default watchDatasets;