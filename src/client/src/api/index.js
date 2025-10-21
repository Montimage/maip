import {
  getLabelsListXAI,
} from "../utils";

const {
  SERVER_URL,
  ASSISTANT_URL,
} = require('../constants');


export const getSelectedApp = state => state.app;

export const requestApp = (state) => {
  const selectedApp = getSelectedApp(state);
  return selectedApp;
};

export const requestDatasetsAC = async () => {
  const url = `${SERVER_URL}/api/ac/datasets`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.datasets);
  return data.datasets;
};

export const requestBuildModelAC = async (modelType, dataset, featuresList, trainingRatio) => {
  const url = `${SERVER_URL}/api/ac/build`;
  const buildACConfig = { modelType, dataset, featuresList, trainingRatio };
  console.log(buildACConfig);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ buildACConfig }),
  });
  console.log(buildACConfig);
  const data = await response.json();
  console.log(`Build an AC model on server with config ${buildACConfig}`);
  return data;
};

export const requestBuildStatusAC = async () => {
  const url = `${SERVER_URL}/api/ac/build`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.buildStatus);
  return data.buildStatus;
};

export const requestRetrainStatusAC = async () => {
  const url = `${SERVER_URL}/api/ac/retrain`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.retrainStatus);
  return data.retrainStatus;
};

export const requestRetrainModelAC = async (modelId, trainingDataset, testingDataset) => {
  const url = `${SERVER_URL}/api/ac/retrain`;
  const retrainACConfig = {
    "modelId": modelId,
    "datasetsConfig": {
      "trainingDataset": trainingDataset,
      "testingDataset": testingDataset,
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retrainACConfig }),
  });
  console.log(retrainACConfig);
  const data = await response.json();
  console.log(`Retrain an AC model on server with config ${retrainACConfig}`);
  return data;
};

export const requestMMTStatus = async () => {
  const url = `${SERVER_URL}/api/mmt`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.mmtStatus);
  return data.mmtStatus;
};

export const requestMMTOffline = async (file) => {
  const url = `${SERVER_URL}/api/mmt/offline`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: file }),
  });
  const data = await response.json();
  console.log(`MMT offline analysis of pcap file ${file}`);
  return data;
};

export const requestAllReports = async () => {
  const url = `${SERVER_URL}/api/reports`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`All reports returned from server: ${data.reports}`);
  return data.reports;
};

export const requestCsvReports = async (reportId) => {
  const url = `${SERVER_URL}/api/reports/${reportId}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.csvFiles);
  return data.csvFiles;
};

export const requestAllModels = async () => {
  const url = `${SERVER_URL}/api/models`;
  const response = await fetch(url);
  const data = await response.json();
  //console.log(`All models returned from server: ${data.models}`);
  return data.models;
};

export const requestModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  //console.log(`Model information returned from server for ${modelId}`);
  //console.log(data);
  return data;
};

export const requestDeleteAllModels = async (app) => {
  const url = `${SERVER_URL}/api/models/app/${app}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ app }),
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(`Delete all ${app} models on server`);
  return data.result;
};

export const requestDeleteModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}`;
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(`Delete model ${modelId} on server`);
  return data.result;
};

export const requestUpdateModel = async (modelId, newModelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}`;
  const newId = { newModelId: newModelId };
  const response = await fetch(url, {
    method: "PUT",
    headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newId),
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(`Model ${modelId} has been updated`);
  return data.result;
};

export const requestStatsModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/stats`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Stats returned from server for model ${modelId}`);
  console.log(data.stats);
  return data.stats;
};

export const requestBuildConfigModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/build-config`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`build-config.json returned from server for model ${modelId}`);
  console.log(data.buildConfig);
  return data.buildConfig;
};

export const requestDownloadModel = async (modelId) => {
  try {
    const res = await fetch(`${SERVER_URL}/api/models/${modelId}/download`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    // Make sure to download the model in bin format
    link.setAttribute('download', `${modelId}.bin`);
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    console.error('Error downloading model:', error);
  }
};

export const requestViewModelDatasets = async (modelId, datasetType) => {
  const url = `${SERVER_URL}/api/models/${modelId}/datasets/${datasetType}/view`;
  const response = await fetch(url);
  const data = await response.text();
  if (data.error) {
    throw data.error;
  }
  return data;
};

export const requestDownloadDatasets = async (modelId, datasetType) => {
  try {
    const res = await fetch(`${SERVER_URL}/api/models/${modelId}/datasets/${datasetType}/download`);
    console.log(res);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    const datasetFileName = `${modelId}_${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}_samples.csv`;
    link.setAttribute('download', datasetFileName);
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    console.error('Error downloading dataset:', error);
  }
};

export const requestModelDatasets = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/datasets`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.datasets);
  return data.datasets;
}

export const requestAttacksDatasets = async (modelId) => {
  const url = `${SERVER_URL}/api/attacks/${modelId}/datasets`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.datasets);
  return data.datasets;
}

export const requestConfusionMatrixModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/confusion-matrix`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Confusion matrix returned from server for model ${modelId}`);
  console.log(data.matrix);
  return data.matrix;
};

export const requestPredictedProbsModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/probabilities`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Predicted probabilities returned from server for model ${modelId}`);
  console.log(data.probs);
  return data.probs;
};

export const requestXAIStatus = async () => {
  const url = `${SERVER_URL}/api/xai`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.xaiStatus;
};

export const requestRunShap = async (modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay, useQueue = true) => {
  const url = `${SERVER_URL}/api/xai/shap`;
  const shapConfig = {
    "modelId": modelId,
    "numberBackgroundSamples": numberBackgroundSamples,
    "numberExplainedSamples": numberExplainedSamples,
    "maxDisplay": maxDisplay,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shapConfig, useQueue }),
  });
  const data = await response.json();
  console.log(`Run SHAP on server with config`, shapConfig);
  return data;
};

export const requestShapValues = async (modelId, labelId) => {
  const labelsList = getLabelsListXAI(modelId);
  const url = `${SERVER_URL}/api/xai/shap/importance-values/${modelId}/${labelId}`;
  const response = await fetch(url);
  const shapValues = await response.json();
  console.log(`Get SHAP values of the model ${modelId} for the label ${labelsList[labelId]} from server`);
  console.log(JSON.stringify(shapValues));
  return shapValues;
};

export const requestRunLime = async (modelId, sampleId, numberFeature, useQueue = true) => {
  const url = `${SERVER_URL}/api/xai/lime`;
  const limeConfig = {
    "modelId": modelId,
    "sampleId": sampleId,
    "numberFeature": numberFeature,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limeConfig, useQueue }),
  });
  const data = await response.json();
  console.log(`Run LIME on server with config ${limeConfig}`);
  return data;
};

export const requestLimeValues = async (modelId, labelId) => {
  const labelsList = getLabelsListXAI(modelId);
  const url = `${SERVER_URL}/api/xai/lime/explanations/${modelId}/${labelId}`;
  const response = await fetch(url);
  const limeValues = await response.json();
  console.log(`Get LIME values of the model ${modelId} for the label ${labelsList[labelId]} from server`);
  console.log(JSON.stringify(limeValues));
  return limeValues;
};

export const requestBuildStatus = async () => {
  const url = `${SERVER_URL}/api/build`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.buildStatus);
  return data.buildStatus;
};

export const requestBuildModel = async (datasets, ratio, params) => {
  const url = `${SERVER_URL}/api/build`;
  const buildConfig = {
    "datasets": datasets,
    "training_ratio": ratio,
    "training_parameters": params,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ buildConfig }),
  });
  console.log(buildConfig);
  const data = await response.json();
  console.log(`Build a model on server with config ${buildConfig}`);
  return data;
};

export const requestRetrainStatus = async () => {
  const url = `${SERVER_URL}/api/retrain`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.retrainStatus);
  return data.retrainStatus;
};

export const requestRetrainModel = async (modelId, trainingDataset, testingDataset, params) => {
  const url = `${SERVER_URL}/api/retrain/${modelId}`;
  const retrainADConfig = {
    "trainingDataset": trainingDataset,
    "testingDataset": testingDataset,
    "training_parameters": params,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retrainADConfig }),
  });
  console.log(retrainADConfig);
  const data = await response.json();
  console.log(`Retrain a model on server with config ${retrainADConfig}`);
  return data;
};

export const requestRetrainOfflineQueued = async (modelId, trainingDataset, testingDataset, params, isACApp = false) => {
  const url = `${SERVER_URL}/api/retrain/offline`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      modelId, 
      trainingDataset, 
      testingDataset, 
      training_parameters: params,
      isACApp,
      useQueue: true 
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.message || errorData.error || errorText);
    } catch (e) {
      throw new Error(errorText);
    }
  }
  return response.json();
};

export const requestRetrainJobStatus = async (jobId) => {
  const url = `${SERVER_URL}/api/retrain/job/${jobId}`;
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    cache: 'no-store'  // Force fresh fetch, no cache
  });
  if (!response.ok) {
    throw new Error(`Failed to get retrain job status: ${response.statusText}`);
  }
  return response.json();
};

export const requestRetrainedPredictions = async (retrainId) => {
  const url = `${SERVER_URL}/api/retrain/predictions/${retrainId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get retrained predictions: ${response.statusText}`);
  }
  return response.text();
};

export const requestMetricCurrentness = async (modelId) => {
  const url = `${SERVER_URL}/api/metrics/${modelId}/currentness`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Metric currentness returned from server for model ${modelId}`);
  console.log(data.currentness);
  return data.currentness;
};

export const requestAttacksStatus = async () => {
  const url = `${SERVER_URL}/api/attacks`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.attacksStatus);
  return data.attacksStatus;
};

export const requestViewPoisonedDatasets = async (modelId, selectedAttack) => {
  const url = `${SERVER_URL}/api/attacks/poisoning/${selectedAttack}/${modelId}/view`;
  const response = await fetch(url);
  const data = await response.text();
  if (data.error) {
    throw data.error;
  }
  return data;
};

export const requestPerformAttack = async (modelId, selectedAttack, poisoningRate, targetClass) => {
  let url = null;
  let response = null;
  const poisoningAttacksConfig = {
    "modelId": modelId,
    "poisoningRate": poisoningRate,
  };
  if (selectedAttack === "rsl") {
    url = `${SERVER_URL}/api/attacks/poisoning/random-swapping-labels`;
    const randomSwappingLabelsConfig = {
      "poisoningAttacksConfig": poisoningAttacksConfig,
    };
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ randomSwappingLabelsConfig }),
    });
    console.log(randomSwappingLabelsConfig);
  } else if (selectedAttack === "tlf") {
    url = `${SERVER_URL}/api/attacks/poisoning/target-label-flipping`;
    const targetLabelFlippingConfig = {
      "poisoningAttacksConfig": poisoningAttacksConfig,
      "targetClass": targetClass,
    };
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetLabelFlippingConfig }),
    });
    console.log(targetLabelFlippingConfig);
  } else if (selectedAttack === "ctgan") {
    url = `${SERVER_URL}/api/attacks/poisoning/ctgan`;
    const ctganConfig = {
      "poisoningAttacksConfig": poisoningAttacksConfig,
    };
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ctganConfig }),
    });
    console.log(ctganConfig);
  } else {
    console.error("Wrong attack!")
  }
  const data = await response.json();
  console.log(`Perform attack ${selectedAttack} against the model ${modelId} on server`);
  return data;
};

// Queue-based attack API functions
export const requestQueueAttack = async (modelId, selectedAttack, poisoningRate, targetClass) => {
  const url = `${SERVER_URL}/api/queue/attack`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelId,
      selectedAttack,
      poisoningRate,
      targetClass,
      priority: 5, // Default priority
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to queue attack');
  }
  
  const data = await response.json();
  console.log(`Queued attack ${selectedAttack} for model ${modelId}, jobId: ${data.jobId}`);
  
  // Transform response to match expected format
  return {
    jobId: data.jobId,
    position: data.position,
    estimatedTime: data.estimatedWait?.seconds || 60,
  };
};

export const requestAttackJobStatus = async (jobId) => {
  const url = `${SERVER_URL}/api/queue/status/adversarial-attacks/${jobId}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch attack job status for ${jobId}`);
  }
  
  const data = await response.json();
  
  // Transform response to match expected format
  return {
    jobId: data.jobId,
    status: data.status || data.state,  // Backend returns 'status', fallback to 'state'
    progress: data.progress || 0,
    queuePosition: data.position,
    result: data.result,
    failedReason: data.failedReason,
  };
};

export const requestPredictStatus = async () => {
  const url = `${SERVER_URL}/api/predict`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.predictingStatus);
  return data.predictingStatus;
};

export const requestPredict = async (modelId, reportId, reportFileName, useQueue = true) => {
  // NEW: Use queue-based endpoint by default
  if (useQueue) {
    return requestPredictOfflineQueued(modelId, reportId, reportFileName);
  }
  
  // OLD: Legacy endpoint for backward compatibility
  const url = `${SERVER_URL}/api/predict`;

  const predictConfig = {
    modelId,
    inputTraffic: {
      type: "report",
      value: {
        reportId: reportId,
        reportFileName: reportFileName,
      }
    },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ predictConfig }),
  });
  console.log(predictConfig);
  const data = await response.json();
  console.log(`Prediction on server with config ${predictConfig}`);
  return data;
};

export const requestPredictOfflineQueued = async (modelId, reportId, reportFileName) => {
  const url = `${SERVER_URL}/api/predict/offline`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, reportId, reportFileName, useQueue: true })
  });
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.message || errorData.error || errorText);
    } catch (e) {
      throw new Error(errorText);
    }
  }
  return response.json();
};

export const requestPredictJobStatus = async (jobId) => {
  const url = `${SERVER_URL}/api/predict/job/${jobId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }
  return response.json();
};

export const requestPredictionsModel = async (modelId) => {
  const url = `${SERVER_URL}/api/models/${modelId}/predictions`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.predictions;
};

export const requestPredictStats = async (predictionId) => {
  const url = `${SERVER_URL}/api/predictions/${predictionId}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  console.log(data.prediction);
  return data.prediction;
};

export const requestPredictionAttack = async (predictionId) => {
  const url = `${SERVER_URL}/api/predictions/${predictionId}/attack`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch attack details for prediction ${predictionId}`);
  }
  const csvText = await response.text();
  return csvText;
};

// Assistant API: Explain a malicious flow using GPT
export const requestAssistantExplainFlow = async ({ flowRecord, modelId, predictionId, extra, userId, isAdmin }) => {
  const url = `${ASSISTANT_URL}/explain/flow`;
  const body = { flowRecord, modelId, predictionId, extra };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-user-id': userId || '',
      'x-is-admin': isAdmin ? 'true' : 'false',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// Rule-based detection (mmt_security)
export const requestRuleStatus = async ({ ownerToken, sessionId } = {}) => {
  let url = `${SERVER_URL}/api/security/rule-based/status`;
  const params = [];
  if (ownerToken) params.push(`ownerToken=${encodeURIComponent(ownerToken)}`);
  if (sessionId) params.push(`sessionId=${encodeURIComponent(sessionId)}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const requestRuleAlerts = async (limit = 500, sessionId) => {
  let url = `${SERVER_URL}/api/security/rule-based/alerts?limit=${encodeURIComponent(limit)}`;
  if (sessionId) {
    url += `&sessionId=${encodeURIComponent(sessionId)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { ok, file, count, alerts }
};

export const requestRuleOnlineStart = async ({ iface, intervalSec = 5, verbose = true, excludeRules, cores } = {}) => {
  const url = `${SERVER_URL}/api/security/rule-based/online/start`;
  const payload = { iface, intervalSec, verbose };
  if (excludeRules) payload.excludeRules = excludeRules;
  if (cores) payload.cores = cores;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    // Try to parse as JSON for better error handling (especially 409)
    try {
      const errorData = JSON.parse(errorText);
      // For 409, include the error data in the message so frontend can extract sessionId
      if (res.status === 409) {
        const error = new Error(errorData.message || errorData.error || 'Online detection already running');
        error.code = 409;
        error.data = errorData;
        throw error;
      }
      throw new Error(errorData.message || errorData.error || errorText);
    } catch (e) {
      if (e.code === 409) throw e; // Re-throw 409 errors
      throw new Error(errorText);
    }
  }
  return res.json();
};

export const requestRuleOnlineStop = async () => {
  const url = `${SERVER_URL}/api/security/rule-based/online/stop`;
  const res = await fetch(url, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const errorText = await res.text();
    // Try to parse as JSON for better error handling
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.message || errorData.error || errorText);
    } catch (e) {
      throw new Error(errorText);
    }
  }
  return res.json();
};

export const requestRuleOffline = async ({ pcapFile, filePath, verbose = false, excludeRules, cores } = {}) => {
  const url = `${SERVER_URL}/api/security/rule-based/offline`;
  const body = {};
  if (filePath) body.filePath = filePath;
  if (pcapFile) body.pcapFile = pcapFile;
  if (verbose) body.verbose = true;
  if (excludeRules) body.excludeRules = excludeRules;
  if (cores) body.cores = cores;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { ok, file, count, alerts }
};

// Feature extraction API: run end-to-end extraction on an uploaded PCAP
export const requestExtractFeatures = async ({ pcapFile, isMalicious }) => {
  const url = `${SERVER_URL}/api/features/extract`;
  const body = { pcapFile };
  if (typeof isMalicious === 'boolean') {
    body.isMalicious = isMalicious;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Feature extraction failed');
  }
  return response.json(); // { ok, id, csvFile, csvContent }
};

// Assistant API: Explain XAI output (LIME/SHAP) using GPT
export const requestAssistantExplainXAI = async ({ method, modelId, label, explanation, context, userId, isAdmin }) => {
  const url = `${ASSISTANT_URL}/explain/xai`;
  const body = { method, modelId, label, explanation, context };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-user-id': userId || '',
      'x-is-admin': isAdmin ? 'true' : 'false',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to get assistant explanation');
  }
  return response.json();
};

// Get token usage stats
export const requestTokenStats = async (userId, isAdmin) => {
  const url = `${ASSISTANT_URL}/tokens`;
  const response = await fetch(url, {
    headers: {
      'x-user-id': userId || '',
      'x-is-admin': isAdmin ? 'true' : 'false',
    },
  });
  return response.json();
};

/**
 * Request job status from queue
 */
export const requestJobStatus = async (jobId, queueName) => {
  const url = `${SERVER_URL}/api/queue/status/${queueName}/${jobId}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to get job status');
  }
  // Backend spreads status into response, so return the whole data object
  return data;
};