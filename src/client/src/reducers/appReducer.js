import { createReducer } from 'redux-act';
import { setApp } from '../actions';

export default createReducer({
  [setApp] : (state, app) => app
}, false);
