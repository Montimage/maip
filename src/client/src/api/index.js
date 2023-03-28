// read and pass the environment variables into reactjs application
// export const URL = `http://localhost:31057`;
export const URL = "";

export const requestModel = () => {
  const url = `${URL}/api/models/`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.model;
};