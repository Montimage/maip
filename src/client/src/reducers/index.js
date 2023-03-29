import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';
import allModelsReducer from './allModelsReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  allModels: allModelsReducer,
});

export default rootReducer;
