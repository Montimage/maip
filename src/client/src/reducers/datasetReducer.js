import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setDataset,
} from "../actions";


export default createReducer({
    [setDataset]: produce((draft, dataset) => (draft = dataset)),
  },
  []
);