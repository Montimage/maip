import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setAttackStatus,
  } from "../actions";
  
  
  export default createReducer({
      [setAttackStatus]: produce((draft, attack) => (draft = attack)),
    },
    []
  );