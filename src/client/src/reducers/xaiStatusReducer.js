import { createReducer } from 'redux-act';
import { setXAIStatus } from '../actions';

export default createReducer({
  [setXAIStatus] : (state, xaiStatus) => xaiStatus
}, false);
