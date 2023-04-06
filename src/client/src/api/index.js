// read and pass the environment variables into reactjs application
export const URL = `http://localhost:31057`;
//export const URL = "";

export const requestAllModels = async () => {
  const url = `${URL}/api/models`;
  const response = await fetch(url);
  const data = await response.json();
  //console.log(`All models returned from server: ${data.models}`);
  return data.models;
};

export const requestStatsModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}`;
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

export const requestDownloadDatasetModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}/datasets/testing`;
  const response = await fetch(url);
  const blob = await response.blob();
  //const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response;
  document.body.appendChild(a);
  a.click();
  a.remove();
  //const data = await response.json();
  console.log(`Download dataset of the model ${modelId} from server`);
  console.log(response);
  return response;
};

export const requestDownloadDatasetModel2 = async (modelId, typeDataset) => {
  const url = `${URL}/api/models/${modelId}/datasets/${typeDataset}`;
  const response = await fetch(url);
  const blob = await response.blob();
  //const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response;
  document.body.appendChild(a);
  a.click();
  a.remove();
  //const data = await response.json();
  console.log(`Download dataset of the model ${modelId} from server`);
  console.log(response);
  return response;
};

export const requestDownloadTestingModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}/datasets/testing`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`Download testing dataset of the model ${modelId} from server`);
  console.log(data);
  return data;
};

export const requestShapValues = async (modelId) => {
  const url = `${URL}/api/xai/shap/explanations/${modelId}`;
  const response = await fetch(url);
  const shap_values = await response.json();
  console.log(`Get SHAP values of the model ${modelId} from server`);
  console.log(shap_values);
  return shap_values;
};