import {
  AC_FEATURES_DESCRIPTIONS, AD_FEATURES_DESCRIPTIONS,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
} from "./constants";

/**
 *
 * @param {Object} obj Object to be updated
 * @param {String} path Path to be updated
 * @param {Value} value the new value to be updated
 */
const updateObjectByPath = (obj, path, value) => {
  let stack = path.split(".");
  while (stack.length > 1) {
    // Not at the end of the path
    let key = stack.shift();
    if (key.indexOf("[") > 0) {
      // Contains array index
      const array = key.split("[");
      key = array[0];
      let index = array[1].replace("]", "");
      if (!obj[key]) {
        // Create a new array if it does not exist
        obj[key] = [];
      }
      if (obj[key].length === 0) {
        // Empty array
        index = 0;
      } else if (obj[key].length <= index || index < 0) {
        // index out of range
        index = obj[key].length;
      }
      if (!obj[key][index]) {
        obj[key].push({});
        // throw Error(`ERROR: Invalid data path: ${path} in object ${JSON.stringify(obj)}`);
      }
      obj = obj[key][index];
    } else {
      if (!obj[key]) {
        // Create a new path if it does not exist
        obj[key] = {};
      }
      obj = obj[key];
    }
  }
  let lastKey = stack.shift();
  // At the end of the path
  if (lastKey.indexOf("[") > 0) {
    // Contains array index
    const array = lastKey.split("[");
    lastKey = array[0];
    let index = array[1].replace("]", "");
    if (value === null) {
      // Remove an element
      if (obj[lastKey] && obj[lastKey][index]) {
        obj[lastKey].splice(index, 1);
      }
    } else {
      // Add an element
      if (!obj[lastKey]) {
        // Create a new array if it does not exist
        obj[lastKey] = [];
      }
      if (obj[lastKey].length === 0) {
        // Empty array
        index = 0;
      } else if (obj[lastKey].length <= index || index < 0) {
        // index out of range
        index = obj[lastKey].length;
      }
      if (!obj[lastKey][index]) {
        obj[lastKey].push(value);
        // throw Error(`ERROR: Invalid data path: ${path} in object ${JSON.stringify(obj)}`);
      } else {
        obj[lastKey][index] = value;
      }
    }
  } else {
    // Not contains array index
    obj[lastKey] = value;
  }
};

const deepCloneObject = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Add new element into array
 * @param {Array} array The array to be added
 * @param {Object} newElement New element to be updated or added
 */
const addNewElementToArray = (array, newElement) => {
  let found = false;
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === newElement.id) {
      // Found the element - update
      array[index] = { ...newElement };
      // array.splice(index, 1);
      // array.push(newElement);
      found = true;
      break;
    }
  }
  if (!found) {
    array.push(newElement);
  }
  return array;
};

const removeElementFromArray = (array, elmId) => {
  let isDeleted = false;
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === elmId) {
      array.splice(index, 1);
      isDeleted = true;
      break;
    }
  }
  if (!isDeleted) {
    console.log(`[ERROR] Cannot find the element: ${elmId}`);
    return null;
  }
  return array;
};

const getCreatedTimeFromFileName = (fileName) => {
  const array = fileName.split("_");
  let timeString = array[array.length - 1].replace(".log", "");
  return new Date(Number(timeString));
};

const getLastURLPath = (url) => {
  const array = url.split("/");
  return array[array.length - 1];
};

const isDataGenerator = () => {
  return window.location.pathname.indexOf("data-generator") === 1;
};

const getQuery = (qname) => {
  const query = new URLSearchParams(window.location.search);
  return query.get(qname);
};

/**
 * Get the last path in the URL /this-is-the-last-path?not-this-part
 */
const getLastPath = () => {
  const array = window.location.pathname.split('/');
  let lastPath = array[array.length - 1];
  if (lastPath) {
    lastPath = lastPath.split('?')[0]; // Remove query path
  }
  return lastPath;
}

// last-path (id = 1), right-before-last-path (id = 2)
 const getBeforeLastPath = (id) => {
  const array = window.location.pathname.split('/');
  return array[array.length - id];
}

const getFilteredModels = (app, models = []) => {
  let filteredModels = [];
  if (app === 'ac') {
    filteredModels = models.filter(model => model.modelId.startsWith('ac-'));
  } else if (app === 'ad') {
    filteredModels = models.filter(model => !model.modelId.startsWith('ac-'));
  }
  return filteredModels;
}

// TODO: Filter models based on selected applications
const getFilteredModelsOptions = (app, models = []) => {
  const filteredModels = getFilteredModels(app, models); 
  
  return filteredModels.map(model => ({
    value: model.modelId,
    label: model.modelId,
  }));
}

const getFilteredFeatures = (app) => {
  if (app === 'ac') {
    return AC_FEATURES_DESCRIPTIONS;
  } else if (app === 'ad') {
    return AD_FEATURES_DESCRIPTIONS;
  } else {
    return {};
  }
}

// TODO: remove the first two keys and the last one
const getFilteredFeaturesOptions = (app) => {
  let features = [];
  if (app === 'ac') {
    features = Object.keys(AC_FEATURES_DESCRIPTIONS).sort();
  } else if (app === 'ad') {
    features = Object.keys(AD_FEATURES_DESCRIPTIONS).sort();
  }
  
  return features.map((label, index) => ({
    value: label, label,
  }));  
}

const getNumberFeatures = (app) => {
  let numberFeatures = 0;
  if (app === 'ac') {
    numberFeatures = Object.keys(AC_FEATURES_DESCRIPTIONS).length - 1; // 21
  } else if (app === 'ad') {
    numberFeatures = Object.keys(AD_FEATURES_DESCRIPTIONS).length - 3; // 59
  }
  
  return numberFeatures;
}

const getLabelAndColorScatterPlot = (app, data) => {
  let dataLabel;
  if (app === 'ad') {
    dataLabel = data.malware;
  } else if (app === 'ac') {
    dataLabel = data.output;
  } else {
    return { label: "Unknown", color: '#000000' };
  }

  if (app === 'ad') {
    return {
      label: dataLabel === "0" ? "Normal traffic" : "Malware traffic",
      color: dataLabel === "0" ? '#0693e3' : '#EB144C',
    };
  } else if (app === 'ac') {
    switch(dataLabel) {
      case "1":
        return { label: "Web", color: '#0693e3' };
      case "2":
        return { label: "Interaction", color: '#EB144C' };
      case "3":
        // TODO: Video points are not gold
        return { label: "Video", color: '#ffd700' };
      default:
        return { label: "Unknown", color: '#000000' };
    }
  }
};

const isACModel = modelId => modelId && modelId.startsWith('ac-');

const getLabelsOptions = (modelId) => {
  return isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
}

const computeAccuracy = (confusionMatrix) => {
  const correctPredictions = confusionMatrix.reduce((sum, row, i) => sum + row[i], 0);
  const totalPredictions = confusionMatrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return (correctPredictions / totalPredictions).toFixed(6);
}

const calculateMetrics = (TP, FP, FN) => {
  const precision = Number((TP / (TP + FP)).toFixed(6));
  const recall = Number((TP / (TP + FN)).toFixed(6));
  const f1Score = Number((2 * precision * recall / (precision + recall)).toFixed(6));
  const support = TP + FN;
  return [precision, recall, f1Score, support];
}

const transformConfigStrToTableData = (configStr) => {
  let config;
  
  try {
    config = JSON.parse(configStr);
  } catch(e) {
    console.error('Failed to parse config as JSON:', e);
    return [];
  }
  
  return Object.entries(config).map(([key, value]) => ({
      parameter: key,
      value: value.toString()
  }));
}

// Remove dataset's path of the buildConfig for AD models
const removeCsvPath = (buildConfig) => {
  const updatedDatasets = buildConfig.datasets.map((dataset) => {
    const parts = dataset.csvPath.split('/');
    const newCsvPath = parts.slice(parts.indexOf('outputs') + 1).join('/');
    //console.log(newCsvPath);
    return {
      ...dataset,
      csvPath: newCsvPath,
    };
  });

  // remove "total_samples" for old buildConfig
  const { total_samples, ...newBuildConfig } = buildConfig;
  return {
    ...newBuildConfig,
    datasets: updatedDatasets,
  };
}

const convertBuildConfigStrToJson = (app, buildConfig) => {
  if (app === "ac") {
    return JSON.stringify(buildConfig, null, 2);
  }
  return JSON.stringify(removeCsvPath(buildConfig), null, 2);
};

export {
  getQuery,
  isDataGenerator,
  getLastURLPath,
  updateObjectByPath,
  addNewElementToArray,
  removeElementFromArray,
  getCreatedTimeFromFileName,
  deepCloneObject,
  getLastPath,
  getBeforeLastPath,
  getFilteredModels,
  getFilteredModelsOptions,
  getFilteredFeatures,
  getFilteredFeaturesOptions,
  getNumberFeatures,
  getLabelAndColorScatterPlot,
  getLabelsOptions,
  isACModel,
  computeAccuracy,
  calculateMetrics,
  transformConfigStrToTableData,
  removeCsvPath,
  convertBuildConfigStrToJson,
};
