// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestAllModels,
  requestModel,
  requestDeleteModel,
  requestUpdateModel,
  requestBuildConfigModel,
  requestDownloadModel,
  requestDownloadDatasets,
  requestStatsModel,
  requestConfusionMatrixModel,
  requestPredictedProbsModel,
} from '../api';
import {
  setNotification,
  setAllModels,
  deleteModelOK,
  setModel,
} from '../actions';


function* handleRequestAllModels() {
  try {
    const allModels = yield call(() => requestAllModels());
    yield put(setAllModels(allModels));
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

function* handleRequestPredictedProbsModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestPredictedProbsModel(modelId));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDeleteModel(action) {
  try {
    const modelId = action.payload;
    yield call(() => requestDeleteModel(modelId));
    yield put(deleteModelOK(modelId));
    // Fetch the updated list of models
    const models = yield call(requestAllModels);
    yield put(setAllModels(models));
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateModel(action) {
  try {
    const { modelId, newModelId } = action.payload;
    yield call(() => requestUpdateModel(modelId, newModelId));
    yield put(setNotification({
      type: 'success',
      message: `Model ${modelId} name has been updated`
    }));
    // Fetch the updated list of models
    const models = yield call(requestAllModels);
    yield put(setAllModels(models));
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestStatsModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestStatsModel(modelId));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDownloadModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestDownloadModel(modelId));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDownloadDatasets(action) {
  try {
    const { modelId, datasetType } = action.payload;
    const model = yield call(() => requestDownloadDatasets(modelId, datasetType));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestBuildConfigModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestBuildConfigModel(modelId));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestConfusionMatrixModel(action) {
  try {
    const modelId = action.payload;
    const model = yield call(() => requestConfusionMatrixModel(modelId));
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
  yield takeEvery('REQUEST_DELETE_MODEL', handleRequestDeleteModel);
  yield takeEvery('REQUEST_UPDATE_MODEL', handleRequestUpdateModel);
  yield takeEvery('REQUEST_STATS_MODEL', handleRequestStatsModel);
  yield takeEvery('REQUEST_BUILD_CONFIG_MODEL', handleRequestBuildConfigModel);
  yield takeEvery('REQUEST_DOWNLOAD_MODEL', handleRequestDownloadModel);
  yield takeEvery('REQUEST_DOWNLOAD_DATASETS', handleRequestDownloadDatasets);
  yield takeEvery('REQUEST_CONFUSION_MATRIX_MODEL', handleRequestConfusionMatrixModel);
  yield takeEvery('REQUEST_PREDICTED_PROBS_MODEL', handleRequestPredictedProbsModel);
}

export default watchDatasets;