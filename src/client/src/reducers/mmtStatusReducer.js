import { createReducer } from 'redux-act';
import { setMMTStatus } from '../actions';

export default createReducer({
  [setMMTStatus] : (state, mmtStatus) => mmtStatus
}, false);
