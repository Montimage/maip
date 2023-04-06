import {createAction } from 'redux-act';

// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

// All models
export const requestAllModels = createAction('REQUEST_ALL_MODELS');
export const setAllModels = createAction('SET_ALL_MODELS');

// Get model's details
export const requestStatsModel = createAction('REQUEST_STATS_MODEL');
export const requestBuildConfigModel = createAction('REQUEST_BUILD_CONFIG_MODEL');
export const requestDownloadModel = createAction('REQUEST_DOWNLOAD_MODEL');
export const requestConfusionMatrixModel = createAction('REQUEST_CONFUSION_MATRIX_MODEL');
export const setModel = createAction('SET_MODEL');

export const requestDownloadDatasetModel = createAction('REQUEST_DOWNLOAD_DATASET_MODEL');
export const setDataset = createAction('SET_DATASET');

export const requestShapValues = createAction('REQUEST_SHAP_VALUES');
export const setShapValues = createAction('SET_SHAP_VALUES');

//export const requestBuildModel = createAction('REQUEST_BUILD_MODEL');
//export const requestRetrainModel = createAction('REQUEST_RETRAIN_MODEL');
//export const setBuild = createAction('SET_BUILD');