import { all } from "redux-saga/effects";

import requestModelSaga from "./requestModelSaga";
//import requestDatasetSaga from "./requestDatasetSaga";
import requestBuildSaga from "./requestBuildSaga";
import requestShapSaga from "./requestShapSaga";
import requestLimeSaga from "./requestLimeSaga";
import requestReportSaga from "./requestReportSaga";
import requestMetricsSaga from "./requestMetricsSaga";
import requestAttacksSaga from "./requestAttacksSaga";


function* rootSaga() {
  yield all([
    requestModelSaga(),
//    requestDatasetSaga(),
    requestBuildSaga(),
    requestShapSaga(),
    requestLimeSaga(),
    requestReportSaga(),
    requestMetricsSaga(),
    requestAttacksSaga(),
  ]);
}

export default rootSaga;
