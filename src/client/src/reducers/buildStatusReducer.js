import { createReducer } from 'redux-act';
import { setBuildStatus } from '../actions';

export default createReducer({
  [setBuildStatus] : (state, buildStatus) => buildStatus
}, false);
