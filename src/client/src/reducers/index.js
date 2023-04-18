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
import reportsReducer from './reportsReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  models: allModelsReducer,
  model: modelReducer,
  shapValues: shapReducer,
  limeValues: limeReducer,
  xaiStatus: xaiStatusReducer,
//  dataset: datasetReducer,
  build: buildReducer,
  reports: reportsReducer,
});

export default rootReducer;
