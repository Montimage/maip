import { all } from "redux-saga/effects";

import requestModelSaga from "./requestModelSaga";
//import requestDatasetSaga from "./requestDatasetSaga";
//import requestBuildSaga from "./requestBuildSaga";
import requestShapSaga from "./requestShapSaga";
import requestLimeSaga from "./requestLimeSaga";


function* rootSaga() {
  yield all([
    requestModelSaga(),
//    requestDatasetSaga(),
//    requestBuildSaga(),
    requestShapSaga(),
    requestLimeSaga(),
  ]);
}

export default rootSaga;
