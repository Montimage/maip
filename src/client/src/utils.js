import { G2 } from '@ant-design/plots';
import {
  AC_FEATURES_DESCRIPTIONS, AD_FEATURES_DESCRIPTIONS,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
  AC_COLUMNS_PERF_STATS, AD_COLUMNS_PERF_STATS,
  HEADER_ACCURACY_STATS, LABEL_COLORS_AC, LABEL_COLORS_AD,
  LABEL_MAPPING_AC, LABEL_MAPPING_AD,
  AD_OUTPUT_LABELS_XAI,
  AC_CLASS_MAPPING, AD_CLASS_MAPPING
} from "./constants";

G2.registerInteraction('element-link', {
  start: [
    {
      trigger: 'interval:mouseenter',
      action: 'element-link-by-color:link',
    },
  ],
  end: [
    {
      trigger: 'interval:mouseleave',
      action: 'element-link-by-color:unlink',
    },
  ],
});

/**
 *
 * @param {Object} obj Object to be updated
 * @param {String} path Path to be updated
 * @param {Value} value the new value to be updated
 */
export const updateObjectByPath = (obj, path, value) => {
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

export const deepCloneObject = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Add new element into array
 * @param {Array} array The array to be added
 * @param {Object} newElement New element to be updated or added
 */
export const addNewElementToArray = (array, newElement) => {
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

export const removeElementFromArray = (array, elmId) => {
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

export const getCreatedTimeFromFileName = (fileName) => {
  const array = fileName.split("_");
  let timeString = array[array.length - 1].replace(".log", "");
  return new Date(Number(timeString));
};

export const getLastURLPath = (url) => {
  const array = url.split("/");
  return array[array.length - 1];
};

export const isDataGenerator = () => {
  return window.location.pathname.indexOf("data-generator") === 1;
};

export const getQuery = (qname) => {
  const query = new URLSearchParams(window.location.search);
  return query.get(qname);
};

/**
 * Get the last path in the URL /this-is-the-last-path?not-this-part
 */
export const getLastPath = () => {
  const array = window.location.pathname.split('/');
  let lastPath = array[array.length - 1];
  if (lastPath) {
    lastPath = lastPath.split('?')[0]; // Remove query path
  }
  return lastPath;
}

// last-path (id = 1), right-before-last-path (id = 2)
export const getBeforeLastPath = (id) => {
  const array = window.location.pathname.split('/');
  return array[array.length - id];
}

export const getFilteredModels = (app, models = []) => {
  if (!Array.isArray(models)) {
    return [];
 }
  return isACApp(app) ?
            models.filter(model => model.modelId.startsWith('ac-')) :
            models.filter(model => !model.modelId.startsWith('ac-'));
}

export const getFilteredModelsOptions = (app, models = []) => {
  const filteredModels = getFilteredModels(app, models);

  if (!filteredModels.length) {
    return [];
  }

  return filteredModels.map(model => ({
    value: model.modelId,
    label: model.modelId,
  }));
}

export const isACModel = modelId => modelId && modelId.startsWith('ac-');

export const getColumnsPerfStats = (app) => {
  return isACApp(app) ? AC_COLUMNS_PERF_STATS : AD_COLUMNS_PERF_STATS;
}

export const getFilteredFeatures = (app) => {
  return isACApp(app) ? AC_FEATURES_DESCRIPTIONS : AD_FEATURES_DESCRIPTIONS;
}

export const getFilteredFeaturesModel = (modelId) => {
  return isACModel(modelId) ? AC_FEATURES_DESCRIPTIONS : AD_FEATURES_DESCRIPTIONS;
}

// TODO: remove the first two keys and the last one
export const getFilteredFeaturesOptions = (app) => {
  const features =  isACApp(app) ?
            Object.keys(AC_FEATURES_DESCRIPTIONS).sort() :
            Object.keys(AD_FEATURES_DESCRIPTIONS).sort();
  return features.map((label, index) => ({
    value: label, label,
  }));
}

export const getNumberFeatures = (app) => {
  return isACApp(app) ?
            Object.keys(AC_FEATURES_DESCRIPTIONS).length - 1 : // 21
            Object.keys(AD_FEATURES_DESCRIPTIONS).length - 3; // 59
}

export const getNumberFeaturesModel = (modelId) => {
  return isACModel(modelId) ?
            Object.keys(AC_FEATURES_DESCRIPTIONS).length - 1 : // 21
            Object.keys(AD_FEATURES_DESCRIPTIONS).length - 3; // 59
}

export const getLabelScatterPlot = (modelId, data) => {
  const dataLabel = isACModel(modelId) ? data.output : data.malware;
  return isACModel(modelId) ? LABEL_MAPPING_AC[dataLabel] : LABEL_MAPPING_AD[dataLabel];
};

export const getConfigScatterPlot = (modelId, csvData, xScatterFeature, yScatterFeature) => {
  const labelCsvData = csvData.map((data) => {
    const { label } = getLabelScatterPlot(modelId, data);
    return { ...data, label };
  });
  //console.log(labelCsvData);

  const configScatter = {
    appendPadding: 10,
    data: labelCsvData,
    xField: xScatterFeature,
    yField: yScatterFeature,
    shape: 'circle',
    colorField: 'label',
    // Specify points' color based on label
    color: ({ label }) => {
      return isACModel(modelId) ? LABEL_COLORS_AC[label] : LABEL_COLORS_AD[label];
    },
    size: 4,
    yAxis: {
      title: {
        text: yScatterFeature,
        style: {
          fontSize: 16,
        },
      },
      nice: true,
      line: {
        style: {
          stroke: '#aaa',
        },
      },
    },
    xAxis: {
      title: {
        text: xScatterFeature,
        style: {
          fontSize: 16,
        },
      },
      grid: {
        line: {
          style: {
            stroke: '#eee',
          },
        },
      },
      nice: true,
      line: {
        style: {
          stroke: '#aaa',
        },
      },
    },
    // regressionLine: {
    //   type: 'linear', // linear, exp, loess, log, poly, pow, quad
    // },
  };

  return configScatter;
}

export const getLabelsList = (modelId) => {
  return isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
}

export const getLabelsListApp = (app) => {
  return isACApp(app) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
}

export const getLabelsListXAI = (modelId) => {
  return isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS_XAI;
}

export const getLabelsListAppXAI = (app) => {
  return isACApp(app) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS_XAI;
}

export const computeAccuracy = (confusionMatrix) => {
  const correctPredictions = confusionMatrix.reduce((sum, row, i) => sum + row[i], 0);
  const totalPredictions = confusionMatrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return (correctPredictions / totalPredictions).toFixed(6);
}

export const calculateMetrics = (TP, FP, FN) => {
  const precision = Number((TP / (TP + FP)).toFixed(6));
  const recall = Number((TP / (TP + FN)).toFixed(6));
  const f1Score = Number((2 * precision * recall / (precision + recall)).toFixed(6));
  const support = TP + FN;
  return [precision, recall, f1Score, support];
}

export const transformConfigStrToTableData = (configStr) => {
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
export const removeCsvPath = (buildConfig) => {
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

export const convertBuildConfigStrToJson = (app, buildConfig) => {
  if (app === "ac") {
    return JSON.stringify(buildConfig, null, 2);
  }
  return JSON.stringify(removeCsvPath(buildConfig), null, 2);
};

export const getConfigConfusionMatrix = (modelId, confusionMatrix) => {
  const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
  const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
  const rows = cmStr.trim().split('\n');
  const data = rows.flatMap((row, i) => {
    const cols = row.split(',');
    const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
    return cols.slice(1).map((val, j) => ({
      actual: classificationLabels[i],
      predicted: classificationLabels[j],
      count: Number(val),
      percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
    }));
  });

  const configCM = {
    data: data,
    forceFit: true,
    xField: 'predicted',
    yField: 'actual',
    colorField: 'count',
    shape: 'square',
    tooltip: false,
    xAxis: { title: { style: { fontSize: 20 }, text: 'Predicted', } },
    yAxis: { title: { style: { fontSize: 20 }, text: 'Observed', } },
    label: {
      visible: true,
      position: 'middle',
      style: {
        fontSize: '18',
      },
      formatter: (datum) => {
        return `${datum.count}\n(${datum.percentage})`;
      },
    },
    heatmapStyle: {
      padding: 0,
      stroke: '#fff',
      lineWidth: 1,
    },
  };

  return configCM;
}

export const getTablePerformanceStats = (modelId, stats, confusionMatrix) => {
  let dataStats = [];

  // Determine the number of classes based on model type
  const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
  console.log(classificationLabels);
  console.log(classificationLabels.length);
  const numClasses = modelId && classificationLabels.length;
  console.log(confusionMatrix);
  const accuracy = computeAccuracy(confusionMatrix);
  console.log(accuracy);

  const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
  console.log(statsStr);
  const rowsStats = statsStr.split('\n').map(row => row.split(','));
  console.log(rowsStats);

  // Loop over the rows in rowsStats excluding the accuracy row
  for (let rowIndex = 0; rowIndex < numClasses; rowIndex++) {
    const row = rowsStats[rowIndex];
    HEADER_ACCURACY_STATS.forEach((metric, metricIndex) => {
      if (!dataStats[metricIndex]) {
        dataStats[metricIndex] = {
          key: metricIndex.toString(),
          metric,
        };
      }
      if (row && row[metricIndex + 1]) {
        dataStats[metricIndex]['class' + rowIndex] = +row[metricIndex + 1];
      }
    });
  }

  // Append the accuracy metric to the stats
  const accuracyRow = {
    key: dataStats.length.toString(),
    metric: 'accuracy',
  };
  for (let i = 0; i < numClasses; i++) {
    accuracyRow['class' + i] = accuracy;
  }
  dataStats.push(accuracyRow);
  return dataStats;
}

export const calculateImpactMetric = (app, confusionMatrix, attacksConfusionMatrix) => {
  let impact = 0;
  if (confusionMatrix && attacksConfusionMatrix) {
    let errors = 0;
    let errorsAttack = 0;

    if (app === 'ad') {
      errors = confusionMatrix[0][1] + confusionMatrix[1][0];
      errorsAttack = attacksConfusionMatrix[0][1] + attacksConfusionMatrix[1][0];
    } else if (app === 'ac' && confusionMatrix.length > 2 && attacksConfusionMatrix.length > 2) { // Check length before accessing
      errors = confusionMatrix[0][1] + confusionMatrix[0][2] +
               confusionMatrix[1][0] + confusionMatrix[1][2] +
               confusionMatrix[2][0] + confusionMatrix[2][1];

      errorsAttack = attacksConfusionMatrix[0][1] + attacksConfusionMatrix[0][2] +
                     attacksConfusionMatrix[1][0] + attacksConfusionMatrix[1][2] +
                     attacksConfusionMatrix[2][0] + attacksConfusionMatrix[2][1];
    }

    //console.log(errors);
    //console.log(errorsAttack);
    impact = errors !== 0 ? (errorsAttack - errors) / errors : 0;
  }
  return impact;
}

export const isACApp = (app) => app === 'ac';

export const isRunningApp = (app, retrainACStatus, retrainStatus) => {
  return isACApp(app) ? retrainACStatus.isRunning : retrainStatus.isRunning;
}

export const updateConfusionMatrix = (app, predictions, cutoffProb) => {
  // TODO: use highCutoff and lowCutoff
  // let highCutoff = cutoffProb;
  // let lowCutoff = 0.33;
  const isAC = isACApp(app);
  const classificationLabels = isAC ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
  const numClasses = classificationLabels.length;
  let confusionMatrix = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
  let stats = [];

  predictions.forEach((d) => {
    if (isNaN(d.prediction) || isNaN(d.trueLabel)) return;
    let predictedClass;
    if (isACApp(app)) {
      predictedClass = Math.round(d.prediction) - 1;
    } else {
      predictedClass = d.prediction >= cutoffProb ? 1 : 0;
    }
    if (isAC) {
      if (confusionMatrix[d.trueLabel - 1] &&
        (confusionMatrix[d.trueLabel - 1][predictedClass] !== undefined)) {
        confusionMatrix[d.trueLabel - 1][predictedClass]++;
      } else {
        console.warn(`Unexpected index encountered: ${d.trueLabel - 1}, ${predictedClass}`);
      }
    } else {
      if (confusionMatrix[d.trueLabel] &&
        (confusionMatrix[d.trueLabel][predictedClass] !== undefined)) {
        confusionMatrix[d.trueLabel][predictedClass]++;
      } else {
        console.warn(`Unexpected index encountered: ${d.trueLabel}, ${predictedClass}`);
      }
    }
  });

  for (let i = 0; i < numClasses; i++) {
    const TP = confusionMatrix[i][i];
    const FP = confusionMatrix.map(row => row[i]).reduce((a, b) => a + b) - TP;
    const FN = confusionMatrix[i].reduce((a, b) => a + b) - TP;
    stats.push(calculateMetrics(TP, FP, FN));
  }

  const classificationData = classificationLabels.map((label, index) => {
    return {
      "cutoffProb": "Below cutoff",
      "class": label,
      "value": confusionMatrix[index][index]
    }
  }).concat(classificationLabels.map((label, index) => {
    return {
      "cutoffProb": "Above cutoff",
      "class": label,
      "value": confusionMatrix.reduce((acc, row) => acc + row[index], 0) - confusionMatrix[index][index]
    }
  }));

  return {
    confusionMatrix,
    stats,
    classificationData
  };
}

export const getConfigClassification = (classificationData) => {
  const configClassification = {
    data: classificationData,
    xField: 'cutoffProb',
    yField: 'value',
    seriesField: 'class',
    isPercent: true,
    isStack: true,
    meta: {
      value: {
        min: 0,
        max: 1,
        alias: 'Fraction',
      },
      cutoffProb: {
        alias: 'Cutoff Probability',
      },
    },
    xAxis: {
      title: {
        text: 'Cutoff Probability',
        style: {
          fontSize: 13,
          fontWeight: 600,
        },
      },
      label: {
        style: {
          fontSize: 11,
        },
      },
    },
    yAxis: {
      title: {
        text: 'Fraction of Samples',
        style: {
          fontSize: 13,
          fontWeight: 600,
        },
      },
      label: {
        formatter: (v) => `${(parseFloat(v) * 100).toFixed(0)}%`,
        style: {
          fontSize: 11,
        },
      },
    },
    label: {
      position: 'middle',
      content: (item) => {
        const percentage = (item.value * 100).toFixed(1);
        return percentage > 5 ? `${percentage}%` : '';
      },
      style: {
        fill: '#fff',
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center',
      },
    },
    tooltip: {
      shared: true,
      showTitle: true,
      formatter: (datum) => {
        return {
          name: datum.class,
          value: `${(datum.value * 100).toFixed(2)}%`,
        };
      },
    },
    legend: {
      position: 'top-right',
      itemName: {
        style: {
          fontSize: 12,
        },
      },
    },
    color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
    columnStyle: {
      radius: [2, 2, 0, 0],
    },
    interactions: [
      {
        type: 'element-highlight-by-color',
      },
      {
        type: 'element-link',
      },
    ],
    animation: {
      appear: {
        animation: 'scale-in-y',
        duration: 500,
      },
    },
  };

  return configClassification;
}

export const computeCutoff = (predictions, cutoffPercentile) => {
  // Sort the predictions array based on the prediction values in ascending order
  predictions.sort((a, b) => a.prediction - b.prediction);

  // Determine the index corresponding to the cutoff percentile
  const cutoffIndex = Math.floor(predictions.length * cutoffPercentile);

  // Retrieve the prediction value at the cutoff index
  const cutoffProb = predictions[cutoffIndex].prediction;

  //console.log('Cutoff Percentile of samples:', cutoffPercentile);
  //console.log('Cutoff Prediction Probability:', cutoffProb);

  return cutoffProb;
}

export const getDataPrecision = (predictions) => {
  let labelCounts = {}, correctCounts = {}, precisionArray = [];

  for (let i = 1; i <= 3; i++) {
    labelCounts[i] = 0;
    correctCounts[i] = 0;
  }

  for (const predObj of Object.values(predictions)) {
    const { prediction, trueLabel } = predObj;
    labelCounts[prediction]++;
    if (prediction === trueLabel) {
      correctCounts[prediction]++;
    }
  }

  for (let i = 1; i <= 3; i++) {
    const precision = (labelCounts[i] === 0)
                        ? 0
                        : correctCounts[i] / labelCounts[i];
    precisionArray.push(precision);
  }

  const dataPrecision = precisionArray.map((precision, index) => ({
    label: (index + 1).toString(),
    precision: precision
  }));

  return dataPrecision;
}

export const getConfigPrecisionPlot = (dataPrecision) => {
  const configPrecision = dataPrecision ?
    {
      data: dataPrecision,
      xField: 'label',
      yField: 'precision',
      smooth: true,
      lineStyle: {
        lineWidth: 2,
      },
      point: {
        size: 3,
        shape: 'circle',
        style: {
          fill: '#ffffff',
          stroke: '#1890ff',
          lineWidth: 2,
        },
      },
    }
  : null;

  return configPrecision;
}

export const getConfigBarPlot = (csvData, barFeature) => {
  const countByFeature = csvData.reduce((acc, row) => {
    const category = row[barFeature];
    return { ...acc, [category]: (acc[category] || 0) + 1 };
  }, {});
  const totalCount = Object.values(countByFeature).reduce((acc, count) => acc + count, 0);
  const dataBar = Object.entries(countByFeature).map(([category, count]) => ({
    feature: category,
    count,
    percentage: (count / totalCount) * 100,
  }));

  const configBar = {
    data: dataBar,
    xField: 'count',
    yField: 'feature',
    seriesField: 'feature',
    legend: {
      position: 'top-right',
    },
    label: {
      position: 'middle',
      /*content: ({ percentage }) => `${percentage.toFixed(2)}%`,*/
      formatter: (datum) => `${datum.count} (${datum.percentage.toFixed(2)}%)`,
      style: {
        fill: '#FFFFFF',
        fontSize: 16,
      },
    },
    xAxis: {
      title: {
        text: barFeature,
        style: {
          fontSize: 16,
        },
      },
    },
    yAxis: {
      title: {
        text: 'frequency',
        style: {
          fontSize: 16,
        },
      },
    },
    interactions: [{ type: 'element-highlight' }],
  };

  return configBar;
}

function median(data) {
  const sortedData = data.slice().sort((a, b) => a - b);
  const mid = Math.floor(sortedData.length / 2);
  return sortedData.length % 2 === 0 ? (sortedData[mid - 1] + sortedData[mid]) / 2 : sortedData[mid];
}

function quartiles(data) {
  const sortedData = data.slice().sort((a, b) => a - b);
  const mid = Math.floor(data.length / 2);
  const q1 = median(sortedData.slice(0, mid));
  const q3 = median(sortedData.slice(mid + (data.length % 2 === 0 ? 0 : 1)));
  return [q1, q3];
}

function selectBinWidth(data, option) {
  const n = data.length;
  let binWidth;

  switch (option) {
    case 'square-root':
      binWidth = Math.ceil(Math.sqrt(n));
      break;
    case 'sturges':
      binWidth = Math.ceil(1 + Math.log2(n));
      break;
    case 'scott':
      const sum = data.reduce((acc, d) => acc + d, 0);
      const mean = sum / n;
      const s = Math.sqrt(data.reduce((acc, d) => acc + (d - mean) ** 2, 0) / n);
      binWidth = Math.ceil(3.5 * s / Math.pow(n, 1/3));
      break;
    case 'freedman-diaconis':
      const [q1, q3] = quartiles(data);
      const iqr = q3 - q1;
      binWidth = Math.ceil(2 * iqr / Math.pow(n, 1/3));
      break;
    default:
      throw new Error(`Invalid option: ${option}`);
  }

  return binWidth;
}

function computeFeatureStatistics(values) {
  const n = values.length;
  const nonMissingValues = values.filter((value) => !isNaN(value));
  const numMissingValues = n - nonMissingValues.length;
  const mean = nonMissingValues.reduce((sum, value) => sum + value, 0) / nonMissingValues.length;
  const variance = nonMissingValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const medianValue = median(nonMissingValues);
  const min = Math.min(...nonMissingValues);
  const max = Math.max(...nonMissingValues);
  const uniqueValues = new Set(values.filter((value) => !isNaN(value)));
  const numUniqueValues = uniqueValues.size;

  return {
    numUniqueValues, numMissingValues, mean, stdDev, medianValue, min, max,
  };
}

export const getTableDatasetsStats = (csvData, selectedFeature) => {
  const featureValues = csvData.map((d) => d[selectedFeature]);
  const featureValuesFloat = featureValues.map((value) => parseFloat(value));

  const {
    numUniqueValues,
    numMissingValues,
    mean,
    stdDev,
    medianValue,
    min,
    max,
  } = computeFeatureStatistics(featureValuesFloat);

  const dataStats = [
    {
      feature: selectedFeature,
      unique: numUniqueValues,
      missing: numMissingValues,
      mean: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      median: parseFloat(medianValue).toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
    },
  ];

  return dataStats;
}

export const getConfigHistogram = (csvData, selectedFeature, binWidthChoice) => {
  const featureValues = csvData.map((d) => d[selectedFeature]);
  const histogramData = featureValues.map((value) => ({ value: parseFloat(value) }));
  //console.log(histogramData);
  const data = histogramData.map((d) => ({ value: d.value }));
  const binWidth = selectBinWidth(histogramData, binWidthChoice);

  // WIP: compute average values of histogram bins
  const minValue = histogramData.reduce((min, d) => d.value < min ? d.value : min, Number.MAX_VALUE);
  const maxValue = histogramData.reduce((max, d) => d.value > max ? d.value : max, Number.MIN_VALUE);
  const numBins = Math.ceil((maxValue - minValue) / binWidth);
  // Create bins
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const bin = {
      values: [],
      average: 0,
    };
    bin.start = minValue + i * binWidth;
    bin.end = bin.start + binWidth;
    bins.push(bin);
  }

  // Assign data points to bins
  histogramData.forEach((d) => {
    const value = d.value;
    for (let i = 0; i < numBins; i++) {
      const bin = bins[i];
      if (value >= bin.start && value < bin.end) {
        bin.values.push(value);
        break;
      }
    }
  });

  // Compute average value of each bin
  bins.forEach((bin) => {
    const sum = bin.values.reduce((a, b) => a + b, 0);
    bin.average = sum / bin.values.length;

  });
  const binAverages = bins.map((bin) => bin.average);
  console.log(binAverages);

  const configHistogram = {
    data,
    binField: 'value',
    binWidth,
    xAxis: {
      title: {
        text: `histogram bins`,
        style: { fontSize: 16 }
      },
    },
    yAxis: {
      title: {
        text: 'count',
        style: { fontSize: 16 }
      },
    },
    interactions: [
      {
        type: 'element-highlight',
      },
    ],
    // TODO: how to display average of bins on the plot ?
    // TODO: update color of bars width small values to make them visible ?
  };

  return configHistogram;
}

export const getConfigLabelsColumn = (dataLabelsColumn) => {
  const configLabelsColumn = {
    data: dataLabelsColumn,
    xField: 'datasetType',
    yField: 'value',
    seriesField: 'class',
    isPercent: true,
    isStack: true,
    color: ({ class: className }) => {
      // Malware/attack classes in red, normal/benign in blue
      const classLower = String(className).toLowerCase();
      const isMalware = classLower.includes('malware') || 
                       classLower.includes('attack') || 
                       classLower.includes('ddos') ||
                       classLower.includes('malicious') ||
                       className === '1';
      return isMalware ? '#ff4d4f' : '#1890ff';
    },
    xAxis: {
      title: {
        text: 'Dataset Type',
        style: {
          fontSize: 14,
          fontWeight: 600,
        },
      },
    },
    yAxis: {
      title: {
        text: 'Percentage (%)',
        style: {
          fontSize: 14,
          fontWeight: 600,
        },
      },
    },
    meta: {
      value: {
        min: 0,
        max: 1,
      },
    },
    label: {
      position: 'middle',
      content: (item) => {
        return `${item.count} (${(item.value * 100).toFixed(2)}%)`;
      },
      style: {
        fill: '#fff',
        fontSize: 16,
      },
    },
    tooltip: false,
    interactions: [
      {
        type: 'element-highlight-by-color',
      },
      {
        type: 'element-link',
      },
    ],
  };

  return configLabelsColumn;
}

export const getTrueLabel = (modelId, predictions, index) => {
  const labelMapping = isACModel(modelId) ? AC_CLASS_MAPPING : AD_CLASS_MAPPING;
  const lines = predictions.split('\n');
  const line = lines[index];
  const [_, trueLabel] = line.split(',');
  return labelMapping[parseInt(trueLabel)];
}