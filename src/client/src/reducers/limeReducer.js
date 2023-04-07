import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setLimeValues,
  } from "../actions";
  
  
  export default createReducer({
      [setLimeValues]: produce((draft, lime_values) => (draft = lime_values)),
    },
    []
  );