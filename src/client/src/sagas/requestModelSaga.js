// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestAllModels,
} from '../api';
import {
  setNotification,
  setAllModels,  
} from '../actions';


function* handleRequestAllModels() {
  try {
    const models = yield call(() => requestAllModels());
    yield put(setAllModels(models));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}


function* watchDatasets() {
  yield takeEvery('REQUEST_ALL_MODELS', handleRequestAllModels);
}

export default watchDatasets;