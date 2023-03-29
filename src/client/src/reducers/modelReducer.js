import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setModel,
  } from "../actions";
  
  
  export default createReducer({
      [setModel]: produce((draft, model) => (draft = model)),
    },
    []
  );