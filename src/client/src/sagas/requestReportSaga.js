// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestAllReports,
} from '../api';
import {
  setNotification,
  setAllReports,
} from '../actions';


function* handleRequestAllReports() {
  try {
    const allReports = yield call(() => requestAllReports());
    yield put(setAllReports(allReports));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_ALL_REPORTS', handleRequestAllReports);
}

export default watchDatasets;