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

export const requestModel = async (modelId) => {
  const url = `${URL}/api/models/${modelId}/build-config`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`build-config.json returned from server for model ${modelId}`);
  console.log(data.buildConfig);
  return data.buildConfig;
};