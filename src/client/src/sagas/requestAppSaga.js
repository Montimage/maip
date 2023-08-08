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
  setApp,
} from '../actions';


function* handleRequestApp() {
  try {
    const app = yield call(() => requestApp());
    yield put(setApp(app));
  } catch (error) {
    // TODO: get error _store_index_js__WEBPACK_IMPORTED_MODULE_0__.default.getState is not a function
    //const errorMessage = error.message ? error.message : error;
    //yield put(setNotification({ type: "error", message: errorMessage }));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_APP', handleRequestApp);
}

export default watchDatasets;