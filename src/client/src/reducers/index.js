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
import buildStatusReducer from './buildStatusReducer';
import retrainStatusReducer from './retrainStatusReducer';
import mmtStatusReducer from './mmtStatusReducer';
import predictReducer from './predictReducer';
import predictStatusReducer from './predictStatusReducer';

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
  buildStatus: buildStatusReducer,
  retrainStatus: retrainStatusReducer,
  mmtStatus: mmtStatusReducer,
  predict: predictReducer,
  predictStatus: predictStatusReducer,
});

export default rootReducer;
