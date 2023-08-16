import { createReducer } from 'redux-act';
import { setApp } from '../actions';

const defaultApp = 'ac';

export default createReducer({
  [setApp] : (state, app) => app
}, defaultApp);