import { createReducer } from 'redux-act';
import { setRetrainStatus, setRetrainStatusAC } from '../actions';

export default createReducer({
  [setRetrainStatus] : (state, retrainStatus) => retrainStatus,
  [setRetrainStatusAC] : (state, retrainStatusAC) => retrainStatusAC
}, false);
