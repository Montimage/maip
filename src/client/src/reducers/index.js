import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';
import allModelsReducer from './allModelsReducer';
import modelReducer from './modelReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  allModels: allModelsReducer,
  model: modelReducer,
});

export default rootReducer;
