import { createReducer } from 'redux-act';
import { setBuildStatus, setBuildStatusAC } from '../actions';

export default createReducer({
  [setBuildStatus] : (state, buildStatus) => buildStatus,
  [setBuildStatusAC] : (state, buildStatus) => buildStatus,
}, false);
