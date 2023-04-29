import {
  createReducer
} from "redux-act";
import produce from "immer";

import {
  setAllModels,
  deleteModelOK,
} from "../actions";

import { addNewElementToArray, removeElementFromArray } from "../utils";

export default createReducer({
  [setAllModels]: produce((draft, models) => (draft = models)),
  [deleteModelOK]: produce((draft, modelId) => {
    const index = draft.indexOf(modelId);
    if (index > - 1) {
      draft = draft.splice(index, 1);
    }
  }),
  },
  []
);