import {createAction } from 'redux-act';

// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

export const requestBuildModel = createAction('REQUEST_BUILD_MODEL');
export const requestRetrainModel = createAction('REQUEST_RETRAIN_MODEL');
export const setBuildModel = createAction('SET_BUILD_MODEL');
export const requestBuildStatus = createAction('REQUEST_BUILD_STATUS');
export const setBuildStatus = createAction('SET_BUILD_STATUS');

// All models
export const requestAllModels = createAction('REQUEST_ALL_MODELS');
export const setAllModels = createAction('SET_ALL_MODELS');

// Get model's details
export const requestModel = createAction('REQUEST_MODEL');
export const requestDeleteModel = createAction('REQUEST_DELETE_MODEL');
export const requestUpdateModel = createAction('REQUEST_UPDATE_MODEL');
export const deleteModelOK = createAction('DELETE_MODEL_OK');
export const requestStatsModel = createAction('REQUEST_STATS_MODEL');
export const requestBuildConfigModel = createAction('REQUEST_BUILD_CONFIG_MODEL');
export const requestDownloadModel = createAction('REQUEST_DOWNLOAD_MODEL');
export const requestConfusionMatrixModel = createAction('REQUEST_CONFUSION_MATRIX_MODEL');
export const requestPredictedProbsModel = createAction('REQUEST_PREDICTED_PROBS_MODEL');
export const setModel = createAction('SET_MODEL');

export const requestDownloadDatasets = createAction('REQUEST_DOWNLOAD_DATASETS');
export const setDataset = createAction('SET_DATASET');

export const requestXAIStatus = createAction('REQUEST_XAI_STATUS');
export const setXAIStatus = createAction('SET_XAI_STATUS');

export const requestRunShap = createAction('REQUEST_RUN_SHAP');
export const requestShapValues = createAction('REQUEST_SHAP_VALUES');
export const setShapValues = createAction('SET_SHAP_VALUES');

export const requestRunLime = createAction('REQUEST_RUN_LIME');
export const requestLimeValues = createAction('REQUEST_LIME_VALUES');
export const setLimeValues = createAction('SET_LIME_VALUES');

// All reports
export const requestAllReports = createAction('REQUEST_ALL_REPORTS');
export const setAllReports = createAction('SET_ALL_REPORTS');

export const requestMetricCurrentness = createAction('REQUEST_METRIC_CURRENTNESS');
export const setMetrics = createAction('SET_METRICS');

export const requestPerformAttack = createAction('REQUEST_PERFORM_ATTACK');
export const setAttackStatus = createAction('SET_ATTACK_STATUS');