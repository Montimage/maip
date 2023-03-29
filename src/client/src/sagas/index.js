import { all } from "redux-saga/effects";

import requestModelSaga from "./requestModelSaga";


function* rootSaga() {
  yield all([
    requestModelSaga(),
  ]);
}

export default rootSaga;
