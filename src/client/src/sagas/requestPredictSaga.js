// watcher saga -> actions -> worker saga
import {
    call,
    put,
    takeEvery,
  } from 'redux-saga/effects';
  
  import {
    requestPredict,
    requestPredictStatus,
  } from '../api';
  import {
    setNotification,
    setPredictStatus,
  } from '../actions';
  
  
  function* handleRequestPredict(action) {
    try {
      const { modelId, reportId, reportFileName } = action.payload;
      const predictStatus = yield call(() => requestPredict(modelId, reportId, reportFileName));
      console.log(predictStatus);
      yield put(setPredictStatus(predictStatus));
      //yield put(setNotification({type: 'success', message: `Make predictions!`}));
      // dispatch data
    } catch (error) {
      // dispatch error
      yield put(setNotification({type: 'error', message: error}));
    }
  }
  
  function* handleRequestPredictStatus() {
    try {
      const status = yield call(() => requestPredictStatus());
      // dispatch data
      yield put(setPredictStatus(status));
    } catch (error) {
      // dispatch error
      yield put(setNotification({ type: "error", message: error }));
    }
  }
  
  function* watchDatasets() {
    yield takeEvery('REQUEST_PREDICT', handleRequestPredict);
    yield takeEvery('REQUEST_PREDICT_STATUS', handleRequestPredictStatus);
  }
  
  export default watchDatasets;