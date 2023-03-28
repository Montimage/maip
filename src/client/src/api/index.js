// read and pass the environment variables into reactjs application
// export const URL = `http://localhost:31057`;
export const URL = "";

export const requestModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.model;
};