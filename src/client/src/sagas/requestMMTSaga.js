// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestMMTStatus,
} from '../api';
import {
  setNotification,
  setMMTStatus,
} from '../actions';


function* handleRequestMMTStatus() {
  try {
    const status = yield call(() => requestMMTStatus());
    // dispatch data
    yield put(setMMTStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_MMT_STATUS', handleRequestMMTStatus);
}

export default watchDatasets;