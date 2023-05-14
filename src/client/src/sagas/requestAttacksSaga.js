// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestPerformAttack,
  requestAttacksStatus,
} from '../api';
import {
  setNotification,
  setAttacksStatus,
} from '../actions';


function* handleRequestPerformAttack(action) {
  try {
    const { modelId, selectedAttack, poisoningRate, targetClass } = action.payload;
    const attacksStatus = yield call(() => requestPerformAttack(modelId, selectedAttack, poisoningRate, targetClass));
    console.log(attacksStatus);
    yield put(setAttacksStatus(attacksStatus));
    //yield put(setNotification({type: 'success', message: `Perform an attack!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestAttacksStatus() {
  try {
    const status = yield call(() => requestAttacksStatus());
    // dispatch data
    yield put(setAttacksStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_PERFORM_ATTACK', handleRequestPerformAttack);
  yield takeEvery('REQUEST_ATTACKS_STATUS', handleRequestAttacksStatus);
}

export default watchDatasets;