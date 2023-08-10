import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setDatasetsAC,
} from "../actions";


export default createReducer({
    [setDatasetsAC]: produce((draft, datasets) => (draft = datasets)),
  },
  []
);