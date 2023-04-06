import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';
import allModelsReducer from './allModelsReducer';
import modelReducer from './modelReducer';
import shapReducer from './shapReducer';
//import datasetReducer from './datasetReducer';
//import buildReducer from './buildReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  allModels: allModelsReducer,
  model: modelReducer,
  shap: shapReducer,
//  dataset: datasetReducer,
//  build: buildReducer,
});

export default rootReducer;
