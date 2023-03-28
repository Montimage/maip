import {createAction } from 'redux-act';

export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');
export const requestAllModels = createAction('REQUEST_ALL_MODELS');