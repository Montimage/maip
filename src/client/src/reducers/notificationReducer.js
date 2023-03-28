import { createReducer } from "redux-act";
import {
  setNotification,
  resetNotification,
  addThing,
  deleteThing,
  addSimulationSensor,
  addSimulationActuator,
  deleteSimulationSensor,
  deleteSimulationActuator,
} from "../actions";

export default createReducer(
  {
    [setNotification]: (state, { type, message }) => {
      if (message !== {}) {
        return { type, message };
      } else {
        return null;
      }
    },
    [resetNotification]: state => null,
  },
  null
);
