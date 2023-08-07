import { createReducer } from 'redux-act';
import { setPredictStatus } from '../actions';

export default createReducer({
  [setPredictStatus] : (state, predictStatus) => predictStatus
}, false);
