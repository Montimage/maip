import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setAllModels,
} from "../actions";


export default createReducer({
    [setAllModels]: produce((draft, models) => (draft = models)),
  },
  []
);