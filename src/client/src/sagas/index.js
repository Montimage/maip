import { all } from "redux-saga/effects";

import requestModelSaga from "./requestModelSaga";
//import requestDatasetSaga from "./requestDatasetSaga";
import requestBuildSaga from "./requestBuildSaga";
import requestShapSaga from "./requestShapSaga";
import requestLimeSaga from "./requestLimeSaga";
import requestReportSaga from "./requestReportSaga";


function* rootSaga() {
  yield all([
    requestModelSaga(),
//    requestDatasetSaga(),
    requestBuildSaga(),
    requestShapSaga(),
    requestLimeSaga(),
    requestReportSaga(),
  ]);
}

export default rootSaga;
