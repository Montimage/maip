// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestAllModels,
  requestModel,
} from '../api';
import {
  setNotification,
  setAllModels,
  setModel, 
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

function* handleRequestModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestModel(modelId));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_ALL_MODELS', handleRequestAllModels);
  yield takeEvery('REQUEST_MODEL', handleRequestModel);
}

export default watchDatasets;