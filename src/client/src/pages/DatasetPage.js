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
import { Heatmap, Bar, Scatter, Histogram, Mix } from '@ant-design/plots';

const {
  SERVER_URL,
  FEATURES_DESCRIPTIONS,
} = require('../constants');
const { Option } = Select;

const style = {
  padding: '10px 0',
  border: '1px solid black',
};

// TODO: scatter plot is a straight line if features on the x-axis and y-axis are similar ???

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

    const config = {
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
        style: {
          fill: '#FFFFFF',
        },
        formatter: (datum) => `${datum.count}`,
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
    //console.log(dataBar);

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
              <h2>&nbsp;&nbsp;&nbsp;Heatmap Plot (TODO)</h2>
            </div>
          </Col>
        </Row>
        
      </LayoutPage>
    );
  }
}

/**/

export default DatasetPage;
