import { createReducer } from 'redux-act';
import { setApp } from '../actions';

//const defaultApp = 'ad';

export default createReducer({
  [setApp] : (state, app) => app
}, '');