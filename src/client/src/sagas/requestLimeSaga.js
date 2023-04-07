// watcher saga -> actions -> worker saga
import {
    call,
    put,
    takeEvery,
  } from 'redux-saga/effects';
  
  import {
    requestLimeValues,
  } from '../api';
  import {
    setNotification,
    setLimeValues,
  } from '../actions';
  
  
  function* handleRequestLimeValues(action) {
    try {
      const modelId = action.payload;
      const lime_values = yield call(() => requestLimeValues(modelId));
      //console.log(lime_values);
      yield put(setLimeValues(lime_values));
      // dispatch data
    } catch (error) {
      // dispatch error
      yield put(setNotification({type: 'error', message: error}));
    }
  }
  
  function* watchDatasets() {
    yield takeEvery('REQUEST_LIME_VALUES', handleRequestLimeValues);
  }
  
  export default watchDatasets;