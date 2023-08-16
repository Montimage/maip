import {
  combineReducers
} from 'redux';

import notificationReducer from './notificationReducer';
import allModelsReducer from './allModelsReducer';
import modelReducer from './modelReducer';
import xaiStatusReducer from './xaiStatusReducer';
import shapReducer from './shapReducer';
import limeReducer from './limeReducer';
import datasetsReducer from './datasetsReducer';
import buildReducer from './buildReducer';
import reportsReducer from './reportsReducer';
import metricsReducer from './metricsReducer';
import attacksReducer from './attacksReducer';
import attacksStatusReducer from './attacksStatusReducer';
import buildACStatusReducer from './buildACStatusReducer';
import buildStatusReducer from './buildStatusReducer';
import retrainStatusReducer from './retrainStatusReducer';
import mmtStatusReducer from './mmtStatusReducer';
import predictReducer from './predictReducer';
import predictStatusReducer from './predictStatusReducer';
import appReducer from './appReducer';

const rootReducer = combineReducers({
  notify: notificationReducer,
  models: allModelsReducer,
  model: modelReducer,
  shapValues: shapReducer,
  limeValues: limeReducer,
  xaiStatus: xaiStatusReducer,
  datasets: datasetsReducer,
  build: buildReducer,
  reports: reportsReducer,
  metrics: metricsReducer,
  attacks: attacksReducer,
  attacksStatus: attacksStatusReducer,
  buildStatus: buildStatusReducer,
  buildACStatus: buildACStatusReducer, 
  retrainStatus: retrainStatusReducer,
  mmtStatus: mmtStatusReducer,
  predict: predictReducer,
  predictStatus: predictStatusReducer,
  app: appReducer,
});

export default rootReducer;
