import React, { Component } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import {
  requestDownloadDatasetModel,
} from "../actions";
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { 
  getBeforeLastPath,
  getLastPath,
} from "../utils";
import { Button, Tooltip, Select, Col, Row, Table } from 'antd';
import Papa from "papaparse";
import { Heatmap, Bar, Scatter, Histogram } from '@ant-design/plots';
//import { Heatmap } from '@ant-design/charts';

const {
  SERVER_URL,
  FEATURES_DESCRIPTIONS,
} = require('../constants');
const { Option } = Select;

const style = {
  padding: '10px 0',
  border: '1px solid black',
};

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

class DatasetPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      csvData: [],
      headers: [],
      selectedFeature: '',
      chartData: [],
      binWidthChoice: 'square-root',
      xScatterFeature: '',
      yScatterFeature: '',
      barFeature: '',
    };
  }

  componentDidMount() {
    const modelId = getBeforeLastPath(2);
    const datasetType = getLastPath();
    fetch(`${SERVER_URL}/api/models/${modelId}/datasets/${datasetType}/view`)
      .then(response => response.text())
      .then(data => {
        Papa.parse(data, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          complete: (results) => {
            const csvData = results.data;
            const headers = Object.keys(csvData[0]);
            this.setState({
              csvData: csvData,
              headers: headers,
            });
          },
          error: () => {
            console.log('Error parsing CSV file');
          },
        });
      });
  }

  getChartData(feature) {
    const { csvData } = this.state;
    
    let chartData = [];

    if (csvData.length > 0) {
      chartData = csvData.map(row => ({ value: parseFloat(row[feature]) }));
      //console.log(JSON.stringify(chartData));
    }
    return chartData;
  }

  render() {
    const modelId = getBeforeLastPath(2);
    const datasetType = getLastPath();
    const { 
      csvData, 
      headers, 
      selectedFeature, 
      chartData,
      binWidthChoice,
      xScatterFeature,
      yScatterFeature,
      barFeature,
    } = this.state;
    //console.log({selectedFeature, binWidthChoice});
    //const displayedCsvData = csvData.slice(0, 100);
    //console.log(JSON.stringify(csvData));
    const columns = csvData.length > 0 ? Object.keys(csvData[0]).map(key => ({
      title: key,
      dataIndex: key,
      sorter: (a, b) => {
        const aVal = parseFloat(a[key]);
        const bVal = parseFloat(b[key]);
        if (!isNaN(aVal) && !isNaN(bVal)) {
          return aVal - bVal;
        } else {
          return a[key].localeCompare(b[key]);
        }
      },
    })) : [];
    //console.log(columns);

    const featureValues = csvData.map((d) => d[selectedFeature]);
    const featureValuesFloat = featureValues.map((value) => parseFloat(value));
    const histogramData = featureValues.map((value) => ({ value: parseFloat(value) }));
    //console.log(histogramData);
    const data = histogramData.map((d) => ({ value: d.value }));
    const binWidth = selectBinWidth(histogramData, binWidthChoice);
    
    const config = {
      data,
      binField: 'value',
      binWidth,
      xAxis: {
        title: {
          text: `Histogram bins`,
          style: { fontSize: 16 }
        },
      },
      yAxis: {
        title: {
          text: 'Count',
          style: { fontSize: 16 }
        },
      },
      interactions: [
        {
          type: 'element-highlight',
        },
      ],
      // TODO: update color of bars width small values to make them visible ?
    };

    const binChoices = ['square-root', 'sturges', 'scott', 'freedman-diaconis']; 
    const binWidthOptions = binChoices.map(choice => ({
      value: choice,
      label: choice,
    }));

    //console.log(computeFeatureStatistics(featureValuesFloat));

    const {
      numUniqueValues,
      numMissingValues,
      mean,
      stdDev,
      medianValue,
      min,
      max,
    } = computeFeatureStatistics(featureValuesFloat);

    const columnsTableStats = [
      {
        title: 'Feature',
        dataIndex: 'feature',
        key: 'feature',
      },
      {
        title: 'Unique Values',
        dataIndex: 'unique',
        key: 'unique',
      },
      {
        title: 'Missing Values',
        dataIndex: 'missing',
        key: 'missing',
      },
      {
        title: 'Mean',
        dataIndex: 'mean',
        key: 'mean',
      },
      {
        title: 'Standard Deviation',
        dataIndex: 'stdDev',
        key: 'stdDev',
      },
      {
        title: 'Median',
        dataIndex: 'median',
        key: 'median',
      },
      {
        title: 'Min',
        dataIndex: 'min',
        key: 'min',
      },
      {
        title: 'Max',
        dataIndex: 'max',
        key: 'max',
      },
    ];
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

    const allFeatures = Object.keys(FEATURES_DESCRIPTIONS).map((feature, index) => {
      return {
        key: index + 1,
        name: feature,
        description: FEATURES_DESCRIPTIONS[feature].description,
        type: FEATURES_DESCRIPTIONS[feature].type,
      };
    });
    const categoricalFeatures = Object.entries(FEATURES_DESCRIPTIONS)
      .filter(([key, value]) => value.type === 'categorical')
      .map(([key, value]) => key);
    //console.log(categoricalFeatures);
    
    const columnsAllFeatures = [
      {
        title: 'ID',
        dataIndex: 'key',
        key: 'key',
        sorter: (a, b) => a.key - b.key,
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
      },
    ];

    const newCsvData = csvData.map((data) => {
      const malware = data.malware === "0" ? "Normal traffic" : "Malware traffic";
      return { ...data, malware };
    });

    const configScatter = {
      appendPadding: 10,
      data: newCsvData,
      xField: xScatterFeature,
      yField: yScatterFeature,
      shape: 'circle',
      colorField: 'malware',
      color: ['#0693e3', '#EB144C'],
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
      /*regressionLine: {
        type: 'linear', // linear, exp, loess, log, poly, pow, quad
      },*/
    };

    const countByFeature = csvData.reduce((acc, row) => {
      const category = row[barFeature];
      return { ...acc, [category]: (acc[category] || 0) + 1 };
    }, {});

    const dataBar = Object.entries(countByFeature).map(([category, count]) => ({
      feature: category,
      count,
    }));

    const configBar = {
      data: dataBar,
      xField: 'count',
      yField: 'feature',
      seriesField: 'feature',
      legend: {
        position: 'top-left',
      },
      label: {
        position: 'middle',
        style: {
          fill: '#FFFFFF',
        },
        formatter: (datum) => `${datum.count}`,
      },
      xAxis: {
        title: {
          text: barFeature,
        },
      },
      yAxis: {
        title: {
          text: 'Frequency',
        },
      },
      interactions: [{ type: 'element-highlight' }],
    };
    //console.log(dataBar);

  const abc = [
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.341
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.266
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.446
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.425
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.415
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.379
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": "NULL"
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.022
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.32
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.05
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.95
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.164
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": "NULL"
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.975
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.507
  },
  {
    "malware": 201601,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.591
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.472
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.256
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.721
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.47
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.555
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.418
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": "NULL"
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.192
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.407
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.048
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.054
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.225
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.281
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.185
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.776
  },
  {
    "malware": 201602,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.707
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.867
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.883
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.965
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.92
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.964
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.797
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.839
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.405
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.815
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.556
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.32
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.557
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.442
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.356
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.99
  },
  {
    "malware": 201603,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.039
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.247
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.804
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.471
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.377
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.616
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.441
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.187
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.919
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.476
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.997
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.961
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.119
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.972
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.845
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.493
  },
  {
    "malware": 201604,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.565
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.084
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.916
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.559
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.305
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.373
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.321
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.333
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.996
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.208
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.169
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.034
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.155
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.286
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.686
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.592
  },
  {
    "malware": 201605,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.563
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.316
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.704
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 2.877
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.449
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.708
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.467
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.312
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.332
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.417
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.252
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.117
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.155
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.167
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.081
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.728
  },
  {
    "malware": 201606,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 2.624
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.485
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.721
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.2
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.68
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.926
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.661
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.554
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.674
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.683
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.538
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.468
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.461
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.51
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.257
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.885
  },
  {
    "malware": 201607,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 2.959
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.16
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.395
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.64
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.354
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.477
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.292
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.095
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.354
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.428
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.996
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.039
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.907
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.025
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.819
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.418
  },
  {
    "malware": 201608,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.441
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.792
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.636
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.008
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.739
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.748
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.599
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.519
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.743
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.031
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.441
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.324
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.281
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.522
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.391
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.853
  },
  {
    "malware": 201609,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.733
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.116
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.186
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.204
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.175
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.13
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.045
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.972
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.186
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.312
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.717
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.791
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.835
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.978
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.409
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.216
  },
  {
    "malware": 201610,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.206
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.492
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.577
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.627
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.517
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.411
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.387
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.363
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.477
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.605
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.136
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.104
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.155
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.364
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.924
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.724
  },
  {
    "malware": 201611,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.583
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.262
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.376
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.351
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 4.226
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.181
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 4.24
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 4.112
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 4.485
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.575
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 4.027
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.926
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.946
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 4.102
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.652
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.71
  },
  {
    "malware": 201612,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.31
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.898
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.032
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.832
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.874
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.834
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.857
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.73
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.815
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.818
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.453
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.693
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.671
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.641
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.355
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.181
  },
  {
    "malware": 201701,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.034
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.867
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.057
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.891
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.924
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.859
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.864
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.84
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.761
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.694
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.33
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.746
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.58
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.836
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.356
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.217
  },
  {
    "malware": 201702,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.03
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.324
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.532
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.123
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 4.163
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.139
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 4.221
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 4.316
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.877
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.823
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.801
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 4.163
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.945
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 4.095
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.796
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.512
  },
  {
    "malware": 201703,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.443
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.696
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.964
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.657
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.609
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.591
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.579
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.654
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.362
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.371
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.362
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.566
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.442
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.459
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.279
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.84
  },
  {
    "malware": 201704,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.831
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.059
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.134
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.821
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.935
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.884
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.839
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.928
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.761
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.983
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.992
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.788
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.702
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.643
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.467
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.183
  },
  {
    "malware": 201705,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.132
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.173
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.42
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 2.444
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.177
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.565
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.224
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.223
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.025
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.136
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.116
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.091
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.089
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 1.929
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.143
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.485
  },
  {
    "malware": 201706,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 2.508
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.346
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.502
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 2.413
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.332
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.401
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.333
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.368
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.25
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.385
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.222
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.328
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.217
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.178
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.009
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.524
  },
  {
    "malware": 201707,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 2.706
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.653
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.759
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 2.889
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.574
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.889
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.665
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.614
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.662
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.826
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.45
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.73
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.546
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.321
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.403
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.854
  },
  {
    "malware": 201708,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.013
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.593
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.707
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.618
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.503
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.711
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.435
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.495
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.303
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.68
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.175
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.545
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.361
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.158
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.316
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.707
  },
  {
    "malware": 201709,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.951
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.021
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.055
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.961
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.885
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.026
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.914
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 4.012
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.988
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.223
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.668
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.919
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.845
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 4.16
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.417
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.026
  },
  {
    "malware": 201710,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.116
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.872
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.017
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.792
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.701
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.78
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.759
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.867
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.889
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.123
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.636
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.827
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.672
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.715
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.348
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.989
  },
  {
    "malware": 201711,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.027
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.413
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.535
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.408
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 4.25
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.511
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 4.472
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 4.312
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 4.546
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.814
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 4.277
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 4.49
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 4.391
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 4.388
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 5.046
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.732
  },
  {
    "malware": 201712,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.646
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.748
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.886
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.863
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.552
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.772
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.862
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.724
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.686
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.959
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.455
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.752
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.659
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.635
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.348
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.053
  },
  {
    "malware": 201801,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.063
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.926
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.177
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.137
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.626
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.84
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.896
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.709
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.664
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.923
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.303
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.836
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.813
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.72
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.461
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.207
  },
  {
    "malware": 201802,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.194
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.155
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.33
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.156
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.987
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.034
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.86
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.991
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.649
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.826
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.296
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.897
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.767
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.618
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.669
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.257
  },
  {
    "malware": 201803,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.336
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.673
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.037
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.911
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.684
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.844
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.571
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.851
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.497
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.8
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.144
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.341
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.691
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.716
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.289
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.383
  },
  {
    "malware": 201804,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.992
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.772
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.032
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.15
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.839
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.125
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.681
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.935
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.905
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.979
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.653
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.386
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.884
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.804
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.423
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.902
  },
  {
    "malware": 201805,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.222
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.049
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.388
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.224
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.072
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.235
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.82
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.104
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.04
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.209
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.963
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.509
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.105
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.954
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.559
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.424
  },
  {
    "malware": 201806,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.264
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 2.237
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 2.467
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 2.507
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 2.337
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 2.446
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 2.139
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 2.308
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 2.244
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 2.403
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.214
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 2.259
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 2.419
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.169
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 2.834
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 2.524
  },
  {
    "malware": 201807,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 2.599
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.154
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.271
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.301
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.209
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.249
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.043
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.143
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.163
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.323
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.072
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.147
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.133
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.967
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.728
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.559
  },
  {
    "malware": 201808,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.595
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.423
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.483
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.361
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.385
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.4
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.155
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.385
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.407
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.677
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.243
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.273
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.38
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.952
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.873
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.725
  },
  {
    "malware": 201809,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.727
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.788
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 4.826
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.568
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 4.751
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 4.631
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 4.47
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 4.73
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 4.488
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 4.956
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 4.392
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 4.476
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 4.658
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 4.595
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.947
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 5.003
  },
  {
    "malware": 201810,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.917
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.865
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.767
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.78
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.717
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.733
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.676
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.872
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.721
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.945
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.461
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.701
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.825
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.653
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.003
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.089
  },
  {
    "malware": 201811,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.003
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.355
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.329
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.333
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.213
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.152
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.164
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.234
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.222
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.403
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.092
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.101
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.148
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 2.935
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.659
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.681
  },
  {
    "malware": 201812,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.495
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 4.134
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.959
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 4.015
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 4.005
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.986
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 4.099
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.964
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 4.04
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.937
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 4.066
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.942
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.837
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.565
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 4.375
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 4.505
  },
  {
    "malware": 201901,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 4.324
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.241
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.196
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.227
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.196
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.16
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.177
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.269
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.07
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.08
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 2.95
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.137
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.1
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.05
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.547
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.496
  },
  {
    "malware": 201902,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.407
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.539
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.608
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.635
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.45
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.579
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.524
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.654
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.481
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.486
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.255
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.461
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.455
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.344
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.832
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.867
  },
  {
    "malware": 201903,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.729
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Central/Western",
    "ip.payload_len": 3.403
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Eastern",
    "ip.payload_len": 3.459
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Kwun Tong",
    "ip.payload_len": 3.601
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Sham Shui Po",
    "ip.payload_len": 3.297
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Kwai Chung",
    "ip.payload_len": 3.416
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tsuen Wan",
    "ip.payload_len": 3.222
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tseung Kwan O",
    "ip.payload_len": 3.506
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Yuen Long",
    "ip.payload_len": 3.369
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tuen Mun",
    "ip.payload_len": 3.248
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tung Chung",
    "ip.payload_len": 3.195
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tai Po",
    "ip.payload_len": 3.38
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Sha Tin",
    "ip.payload_len": 3.341
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Tap Mun",
    "ip.payload_len": 3.306
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Causeway Bay",
    "ip.payload_len": 3.73
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Central",
    "ip.payload_len": 3.607
  },
  {
    "malware": 201904,
    "tcp_bytes_per_flow": "Mong Kok",
    "ip.payload_len": 3.62
  }
];

  const parsedData = csvData.map(row => ({
    'ip.payload_len': Number(row['ip.payload_len']),
    'malware': Number(row.malware), // === '0' ? 'Normal traffic' : 'Malware traffic',
    'tcp_bytes_per_flow': Number(row['tcp_bytes_per_flow'])
  }));

  console.log(parsedData);

  // TODO: Heatmap plot is empty, probably due to values of selected features ???

    const configHeatmap = {
      width: 650,
      height: 500,
      autoFit: false,
      data: abc,
      xField: 'malware',
      yField: 'tcp_bytes_per_flow',
      colorField: 'ip.payload_len',
      //color: ['#174c83', '#7eb6d4', '#efefeb', '#efa759', '#9b4d16'],
      /*xField: 'duration',
      yField: 'time_between_pkts_sum',
      colorField: 'malware',*/
      //color: ['#5B8FF9', '#C5DEFD'],
      //shape: 'circle',
      /*tooltip: {
        fields: ['duration', 'pkts_per_flow', 'malware'],
        formatter: ({ duration, pkts_per_flow, malware }) => ({
          name: 'Counts',
          value: `${duration} seconds, ${pkts_per_flow} packets per flow, ${malware}`,
        }),
      },*/
      color: ['#174c83', '#7eb6d4', '#efefeb', '#efa759', '#9b4d16'],
      meta: {
        'malware': {
          type: 'cat',
        },
      },
    };

    return (
      <LayoutPage pageTitle="Dataset" 
        pageSubTitle={`${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}ing dataset of the model ${modelId}`}>
        {/* TODO: Fix "ResizeObserver loop limit exceeded", fixed header ? */}
        <h4>
          Total number of samples: {csvData.length};
          Total number of features: {Object.keys(FEATURES_DESCRIPTIONS).length - 3}
        </h4>
        <div style={{ maxWidth: '100vw', overflowX: 'auto', marginTop: '10px', marginBottom: '30px', height: 490 }}>
          <Table columns={columns} 
            dataSource={csvData} 
            size="small" bordered
            scroll={{ x: 'max-content', /* y: 400 */ }}
            pagination={{ pageSize: 10 }}
          />
        </div>

        <Row gutter={24} style={{ marginTop: '20px' }}>
          <Col className="gutter-row" span={24}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Descriptions</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={`Displays all features with detailed description.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table dataSource={allFeatures} columns={columnsAllFeatures} 
                size="small" style={{ marginTop: '10px' }}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }}>
          <Col className="gutter-row" span={24}>
            {headers.length > 0 && (
              <div style={style}>
                <h2>&nbsp;&nbsp;&nbsp;Histogram Plot</h2>
                <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <Tooltip title="A table contains different statistics of the feature, such as the number of unique values, number of missing values, mean, standard deviation, median, minimum, and maximum value. A histogram plot for each feature of the database shows the distribution of values in that feature.">
                      <Button type="link" icon={<QuestionOutlined />} />
                    </Tooltip>
                  </div>
                  &nbsp;&nbsp;&nbsp;
                  <Tooltip title="Select the feature to plot on the histogram">
                    <Select
                      showSearch allowClear
                      placeholder="Select a feature"
                      onChange={value => this.setState({ selectedFeature: value })}
                      optionFilterProp="children"
                      filterOption={(input, option) => (option?.value ?? '').includes(input)}
                      style={{ width: 300, marginTop: '10px' }}
                    >
                      {headers.map((header) => (
                        <Option key={header} value={header}>
                          {header}
                        </Option>
                      ))}
                    </Select>
                  </Tooltip>
                  &nbsp;&nbsp;&nbsp;
                  <Tooltip title="Select the bin selection algorithm">
                    <Select
                      showSearch allowClear
                      placeholder="Select bin width"
                      options={binWidthOptions}
                      defaultValue="square-root"
                      onChange={value => this.setState({ binWidthChoice: value })}
                      optionFilterProp="children"
                      filterOption={(input, option) => (option?.value ?? '').includes(input)}
                      style={{ width: 250 }}
                    >
                      {headers.map((header) => (
                        <Option key={header} value={header}>
                          {header}
                        </Option>
                      ))}
                    </Select>
                  </Tooltip>
                </div>
                {selectedFeature && (
                  <Table columns={columnsTableStats} dataSource={dataStats} pagination={false}
                    style={{marginTop: '10px'}}
                  />
                )}
                {selectedFeature && binWidthChoice && (
                  <Histogram {...config} style={{ margin: '20px' }}/>
                )}
              </div>
            )}
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }}>
          <Col className="gutter-row" span={24}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Scatter Plot</h2>
              <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <Tooltip title="The scatter plot represents the relationship between two features of a dataset, each data point as a circle on a two-dimensional coordinate system. The color of each circle represents whether the traffic was Malware or Normal. Malware traffic is denoted with the color blue, while Normal traffic is denoted with the color red.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a feature displayed on x-axis">
                  <Select
                    showSearch allowClear
                    placeholder="Select a feature"
                    onChange={value => this.setState({ xScatterFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {headers.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a feature displayed on y-axis">
                  <Select
                    showSearch allowClear
                    placeholder="Select a feature"
                    onChange={value => this.setState({ yScatterFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {headers.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              {xScatterFeature && yScatterFeature &&
                <Scatter {...configScatter} style={{ margin: '20px' }}/>
              }
            </div>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Bar Plot</h2>
              <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <Tooltip title="The bar plot displays the frequency or proportion of a categorical feature.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a categorical feature">
                  <Select
                    showSearch allowClear
                    placeholder="Select a feature"
                    onChange={value => this.setState({ barFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {categoricalFeatures.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              {barFeature && <Bar {...configBar} style={{ margin: '10px' }} />}
            </div>
          </Col>


          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Heatmap Plot</h2>
              
            </div>
          </Col>
        </Row>
        <Heatmap {...configHeatmap} style={{ margin: '20px' }}/>
      </LayoutPage>
    );
  }
}

/**/

export default DatasetPage;
