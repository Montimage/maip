import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setShapValues,
} from "../actions";


export default createReducer({
    [setShapValues]: produce((draft, shapValues) => (draft = shapValues)),
  },
  []
);