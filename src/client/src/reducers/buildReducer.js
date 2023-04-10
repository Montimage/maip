import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setBuildModel,
  } from "../actions";
  
  
  export default createReducer({
      [setBuildModel]: produce((draft, buildModel) => (draft = buildModel)),
    },
    []
  );