import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setRetrainStatusAC,
  } from "../actions";
  
  
  export default createReducer({
      [setRetrainStatusAC]: produce((draft, retrainACStatus) => (draft = retrainACStatus)),
    },
    []
  );