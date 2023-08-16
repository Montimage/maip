import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setBuildStatusAC,
} from "../actions";


export default createReducer({
    [setBuildStatusAC]: produce((draft, buildACStatus) => (draft = buildACStatus)),
  },
  []
);