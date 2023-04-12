import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';
import allModelsReducer from './allModelsReducer';
import modelReducer from './modelReducer';
import xaiStatusReducer from './xaiStatusReducer';
import shapReducer from './shapReducer';
import limeReducer from './limeReducer';
//import datasetReducer from './datasetReducer';
import buildReducer from './buildReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  allModels: allModelsReducer,
  model: modelReducer,
  shapValues: shapReducer,
  limeValues: limeReducer,
  xaiStatus: xaiStatusReducer,
//  dataset: datasetReducer,
  build: buildReducer,
});

export default rootReducer;
