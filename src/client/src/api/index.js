// read and pass the environment variables into reactjs application
export const URL = `http://localhost:31057`;
//export const URL = "";

export const requestAllReports = async () => {
  const url = `${URL}/api/reports`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`All reports returned from server: ${data.reports}`);
  return data.reports;
};

export const requestAllModels = async () => {
  const url = `${URL}/api/models`;
  const response = await fetch(url);
  const data = await response.json();
  //console.log(`All models returned from server: ${data.models}`);
  return data.models;
};

export const requestModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Model information returned from server for ${modelId}`);
  console.log(data);
  return data;
};

export const requestDeleteModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}`;
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

export const requestStatsModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}/stats`;
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
  const url = `${URL}/api/models/${modelId}/build-config`;
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
  const url = `${URL}/api/models/${modelId}/download`;
  const response = await fetch(url);
  const blob = await response.blob();
  const a = document.createElement('a');
  a.href = url;
  a.download = response;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log(`Download the model ${modelId} from server`);
  return response.modelFilePath;
};

export const requestConfusionMatrixModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}/confusion-matrix`;
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

export const requestXAIStatus = async () => {
  const url = `${URL}/api/xai`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.xaiStatus;
};

export const requestRunShap = async (modelId, numberSamples, maxDisplay) => {
  const url = `${URL}/api/xai/shap`;
  const shapConfig = {
    "modelId": modelId,
    "numberSamples": numberSamples,
    "maxDisplay": maxDisplay,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shapConfig }),
  });
  const data = await response.json();
  console.log(`Run SHAP on server with config ${shapConfig}`);
  return data;
};

export const requestShapValues = async (modelId) => {
  const url = `${URL}/api/xai/shap/importance-values/${modelId}`;
  const response = await fetch(url);
  const shapValues = await response.json();
  console.log(`Get SHAP values of the model ${modelId} from server`);
  console.log(JSON.stringify(shapValues));
  return shapValues;
};

export const requestRunLime = async (modelId, sampleId, numberFeature) => {
  const url = `${URL}/api/xai/lime`;
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
    body: JSON.stringify({ limeConfig }),
  });
  const data = await response.json();
  console.log(`Run LIME on server with config ${limeConfig}`);
  return data;
};

export const requestLimeValues = async (modelId) => {
  //const url = `${URL}/api/xai/lime/importance-values/${modelId}`;
  const url = `${URL}/api/xai/lime/explanations/${modelId}`;
  const response = await fetch(url);
  const limeValues = await response.json();
  console.log(`Get LIME values of the model ${modelId} from server`);
  console.log(JSON.stringify(limeValues));
  return limeValues;
};

export const requestBuildStatus = async () => {
  const url = `${URL}/api/build`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.buildStatus;
};

export const requestBuildModel = async (datasets, ratio, params) => {
  const url = `${URL}/api/build`;
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

export const requestRetrainModel = async (modelId, trainingDataset, testingDataset, params) => {
  const url = `${URL}/api/retrain/${modelId}`;
  const retrainConfig1 = {
    "trainingDataset": trainingDataset,
    "testingDataset": testingDataset,
    "training_parameters": params,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retrainConfig1 }),
  });
  console.log(retrainConfig1);
  const data = await response.json();
  console.log(`Retrain a model on server with config ${retrainConfig1}`);
  return data;
};