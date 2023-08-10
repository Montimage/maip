import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setBuildModel,
  setBuildModelAC,
} from "../actions";


export default createReducer({
    [setBuildModel]: produce((draft, buildModel) => (draft = buildModel)),
    [setBuildModelAC]: produce((draft, buildModel) => (draft = buildModel)),
  },
  []
);