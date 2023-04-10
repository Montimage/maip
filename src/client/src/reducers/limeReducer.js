import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setLimeValues,
} from "../actions";


export default createReducer({
    [setLimeValues]: produce((draft, limeValues) => (draft = limeValues)),
  },
  []
);