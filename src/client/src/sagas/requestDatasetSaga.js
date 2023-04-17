// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestDownloadDatasetModel,
} from '../api';
import {
  setNotification,
  setDataset,
} from '../actions';

function* handleRequestDownloadDatasetModel(action) {
  try {
    console.log(action.payload);
    const {modelId, typeDataset} = action.payload;
    const model = yield call(() => requestDownloadDatasetModel(modelId, typeDataset));
    yield put(setDataset(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}


function* watchDatasets() {
  yield takeEvery('REQUEST_DOWNLOAD_DATASET_MODEL', handleRequestDownloadDatasetModel);
}

export default watchDatasets;