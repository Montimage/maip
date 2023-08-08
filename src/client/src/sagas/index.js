import { all } from "redux-saga/effects";

import requestMMTSaga from "./requestMMTSaga";
import requestModelSaga from "./requestModelSaga";
//import requestDatasetSaga from "./requestDatasetSaga";
import requestBuildSaga from "./requestBuildSaga";
import requestRetrainSaga from "./requestRetrainSaga";
import requestShapSaga from "./requestShapSaga";
import requestLimeSaga from "./requestLimeSaga";
import requestReportSaga from "./requestReportSaga";
import requestMetricsSaga from "./requestMetricsSaga";
import requestAttacksSaga from "./requestAttacksSaga";
import requestPredictSaga from "./requestPredictSaga";
import requestAppSaga from "./requestAppSaga";

function* rootSaga() {
  yield all([
    requestMMTSaga(),
    requestModelSaga(),
//    requestDatasetSaga(),
    requestBuildSaga(),
    requestRetrainSaga(),
    requestShapSaga(),
    requestLimeSaga(),
    requestReportSaga(),
    requestMetricsSaga(),
    requestAttacksSaga(),
    requestPredictSaga(),
    requestAppSaga(),
  ]);
}

export default rootSaga;
