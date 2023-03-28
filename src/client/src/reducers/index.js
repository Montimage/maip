import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
});

export default rootReducer;
