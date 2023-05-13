// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestPerformAttack,
} from '../api';
import {
  setNotification,
  setAttackStatus,
} from '../actions';


function* handleRequestPerformAttack(action) {
  try {
    const { modelId, selectedAttack, poisoningRate, targetClass } = action.payload;
    const attackStatus = yield call(() => requestPerformAttack(modelId, selectedAttack, poisoningRate, targetClass));
    console.log(attackStatus);
    yield put(setAttackStatus(attackStatus));
    yield put(setNotification({type: 'success', message: `Perform an attack!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDatasets() {
  yield takeEvery('REQUEST_PERFORM_ATTACK', handleRequestPerformAttack);
}

export default watchDatasets;