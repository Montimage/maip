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
import metricsReducer from './metricsReducer';
import attacksReducer from './attacksReducer';
import attacksStatusReducer from './attacksStatusReducer';

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
  metrics: metricsReducer,
  attacks: attacksReducer,
  attacksStatus: attacksStatusReducer,
});

export default rootReducer;
