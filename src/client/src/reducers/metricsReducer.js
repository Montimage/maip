import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setMetrics,
} from "../actions";


export default createReducer({
    [setMetrics]: produce((draft, metrics) => (draft = metrics)),
  },
  []
);