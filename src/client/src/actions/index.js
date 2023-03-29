import {createAction } from 'redux-act';

// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

// All models
export const requestAllModels = createAction('REQUEST_ALL_MODELS');
export const setAllModels = createAction('SET_ALL_MODELS');

// Get model's details
export const requestModel = createAction('REQUEST_MODEL');
export const setModel = createAction('SET_MODEL');