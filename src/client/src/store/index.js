import { createStore, applyMiddleware, compose } from 'redux';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

import rootReducer from '../reducers';
//import rootSaga from '../sagas';

const configStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: rootReducer,
  });
  //sagaMiddleware.run(rootSaga);
  return store;
};

export default configStore;
