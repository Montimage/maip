// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestShapValues,
} from '../api';
import {
  setNotification,
  setShapValues,
} from '../actions';


function* handleRequestShapValues(action) {
  try {
    const modelId = action.payload;
    const shap_values = yield call(() => requestShapValues(modelId));
    //console.log(shap_values);
    yield put(setShapValues(shap_values));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_SHAP_VALUES', handleRequestShapValues);
}

export default watchDatasets;