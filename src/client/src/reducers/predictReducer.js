import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setPredictStatus,
} from "../actions";


export default createReducer({
    [setPredictStatus]: produce((draft, predictStatus) => (draft = predictStatus)),
  },
  []
);