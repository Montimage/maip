// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestApp,
} from '../api';
import {
  setNotification,
  setApp,
} from '../actions';


function* handleRequestApp() {
  try {
    const app = yield call(() => requestApp());
    // dispatch data
    yield put(setApp(app));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_APP', handleRequestApp);
}

export default watchDatasets;