import { createReducer } from 'redux-act';
import { setRetrainStatus } from '../actions';

export default createReducer({
  [setRetrainStatus] : (state, retrainStatus) => retrainStatus
}, false);
