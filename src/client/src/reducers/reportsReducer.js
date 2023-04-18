import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setAllReports,
} from "../actions";

export default createReducer({
  [setAllReports]: produce((draft, reports) => (draft = reports)),
  },
  []
);