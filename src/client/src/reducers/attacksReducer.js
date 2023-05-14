import {
    createReducer
  } from "redux-act";
  import produce from "immer";
  
  import {
    setAttacksStatus,
  } from "../actions";
  
  
  export default createReducer({
      [setAttacksStatus]: produce((draft, attacksStatus) => (draft = attacksStatus)),
    },
    []
  );