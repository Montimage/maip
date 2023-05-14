import { createReducer } from 'redux-act';
import { setAttacksStatus } from '../actions';

// Important for obtaining attacksStatus on Attacks Page
export default createReducer({
  [setAttacksStatus] : (state, attacksStatus) => attacksStatus
}, false);
