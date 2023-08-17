import React, { Component } from "react";
import { connect } from "react-redux";
import { Row, Col, Tooltip, Table, Select } from "antd";
import LayoutPage from "./LayoutPage";
import { Heatmap } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
} from "../actions";
import {
  isACModel,
  computeAccuracy,
  calculateMetrics,
  transformConfigStrToTableData,
  removeCsvPath,
} from "../utils";
const {
  BOX_STYLE,
  SERVER_URL,
  CRITERIA_LIST, TABLE_BUILD_CONFIGS, AC_COLUMNS_PERF_STATS, AD_COLUMNS_PERF_STATS,
  HEADER_ACCURACY_STATS,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
} = require('../constants');
const { Option } = Select;

// TODO: add Grouped Column plot to compare model performance of 2 models?

class ModelListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      dataStatsLeft: [],
      dataStatsRight: [],
      selectedModelLeft: null,
      selectedModelRight: null,
      buildConfigLeft: null,
      buildConfigRight: null,
      cmConfigLeft: null,
      cmConfigRight: null,
      selectedOption: null,
      selectedCriteria: null,
    };
  }

  componentDidMount() {
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  componentDidUpdate(prevProps, prevState) {
    const { app } = this.props;
    if (prevProps.app !== app) {
      this.setState({
        selectedModelLeft: null, 
        selectedModelRight: null,
        selectedCriteria: null,
      });
    }
  }

  async loadPredictions(modelId, isLeft) {
    const buildConfigResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/build-config`, {
      method: 'GET',
    });
    const buildConfig = await buildConfigResponse.json();
    const buildConfigStr = buildConfig.buildConfig;
    //console.log(buildConfigStr);
    let dataBuildConfig;
    if (this.props.app === 'ad') {
      const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfigStr));
      //console.log(transformedBuildConfig);

      const { datasets, training_ratio, training_parameters } = transformedBuildConfig;

      dataBuildConfig = [
        ...datasets.map(({ csvPath, isAttack }) => ({
          parameter: isAttack ? 'attack dataset' : 'normal dataset',
          value: csvPath,
        })),
        { parameter: 'training ratio', value: training_ratio },
        ...Object.entries(training_parameters).map(([parameter, value]) => ({
          parameter: parameter,
          value: value,
        })),
      ];
      console.log(dataBuildConfig);
    } else {
      dataBuildConfig = transformConfigStrToTableData(buildConfigStr); 
    }
    console.log(dataBuildConfig);

    const predictionsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/predictions`, {
      method: 'GET',
    });
    const predictionsData = await predictionsResponse.json();
    const predictionsValues = predictionsData.predictions;
    console.log(predictionsData);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    console.log(predictions);
  //  this.setState({ predictions }, this.updateConfusionMatrix(predictions, isLeft));
  //}

  //updateConfusionMatrix(predictions, isLeft) {
    const { cutoffProb } = this.state;

    // TODO: add another cutoff Slider
    let highCutoff = cutoffProb;
    let lowCutoff = 0.33; 

    // Initialize confusion matrix
    const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const numClasses = classificationLabels.length; 
    let confusionMatrix = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
    let stats = [];

    if (!predictions) {
      console.warn('Predictions are null or undefined');
      return;
    }

    predictions.forEach((d) => {
      if (isNaN(d.prediction) || isNaN(d.trueLabel)) return; // Skip NaN values
      let predictedClass;
      if (isACModel(modelId)) {
        predictedClass = Math.round(d.prediction) - 1;
      } else {
        predictedClass = d.prediction >= cutoffProb ? 1 : 0;
      }
      //confusionMatrix[d.trueLabel - 1][predictedClass]++;
      if (confusionMatrix[d.trueLabel - 1] && 
          (confusionMatrix[d.trueLabel - 1][predictedClass] !== undefined)) {
        confusionMatrix[d.trueLabel - 1][predictedClass]++;
      } else {
          console.warn(`Unexpected index encountered: ${d.trueLabel - 1}, ${predictedClass}`);
      }
    });

    for (let i = 0; i < numClasses; i++) {
      const TP = confusionMatrix[i][i];
      const FP = confusionMatrix.map(row => row[i]).reduce((a, b) => a + b) - TP;
      const FN = confusionMatrix[i].reduce((a, b) => a + b) - TP;
      stats.push(calculateMetrics(TP, FP, FN));
    }
    console.log(confusionMatrix);

    this.setState({ stats, confusionMatrix });

    const classificationData = classificationLabels.map((label, index) => {
      return {
        "cutoffProb": "Below cutoff",
        "class": label,
        "value": confusionMatrix[index][index] // Diagonal of confusion matrix gives correct predictions
      }
    }).concat(classificationLabels.map((label, index) => {
      return {
        "cutoffProb": "Above cutoff",
        "class": label,
        "value": confusionMatrix.reduce((acc, row) => acc + row[index], 0) - confusionMatrix[index][index]  // Sum of column minus correct prediction
      }
    }));

    this.setState({ stats, classificationData });

    const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rowsStats = statsStr.split('\n').map(row => row.split(','));
    let dataStats = [];
    const accuracy = computeAccuracy(confusionMatrix);

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
    console.log(dataStats);
    if (isLeft) {
      this.setState({ dataStatsLeft: dataStats }); 
    } else {
      this.setState({ dataStatsRight: dataStats });
    }

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

    const config = {
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

    if (isLeft) {
      this.setState({
        selectedModelLeft: modelId,
        dataBuildConfigLeft: dataBuildConfig,
        dataStatsLeft: dataStats,
        cmConfigLeft: config,
      });
    } else {
      this.setState({
        selectedModelRight: modelId,
        dataBuildConfigRight: dataBuildConfig,
        dataStatsRight: dataStats,
        cmConfigRight: config,
      });
    }
  }

  render() {
    const { 
      app,
      models, 
    } = this.props;
    const { 
      selectedCriteria,
      selectedModelLeft,
      selectedModelRight,
      dataBuildConfigLeft,
      dataBuildConfigRight,
      dataStatsLeft,
      dataStatsRight,
      cmConfigLeft,
      cmConfigRight,
    } = this.state;
    //console.log(models);

    if (!models) {
      console.error("No models")
      return null;
    }

    let filteredModels, columnsPerfStats;
    // Suppose models of the activity classification app start with "ac-"
    if (app === 'ac') {
      filteredModels = models.filter(model => model.modelId.startsWith('ac-'));
      columnsPerfStats = AC_COLUMNS_PERF_STATS;
    } else if (app === 'ad') {
      filteredModels = models.filter(model => !model.modelId.startsWith('ac-'));
      columnsPerfStats = AD_COLUMNS_PERF_STATS;
    } else {
      filteredModels = [];
    }
    const modelIds = filteredModels.map((model) => model.modelId);
    //console.log(modelIds);

    return (
      <LayoutPage pageTitle="Models Comparison" pageSubTitle="Comparing models based on performance metrics">
        <div style={BOX_STYLE}>
          <Row gutter={24}>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Model 1:</h3></div>
            </Col>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Comparison Criteria:</h3></div>
            </Col>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Model 2:</h3></div>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a model to compare.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedModelLeft}
                  placeholder="Select a model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, true)}
                  onClear={() => this.setState({ selectedModelLeft: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {modelIds.map((modelId) => (
                    <Option key={modelId} value={modelId}>
                      {modelId}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a criteria for comparing the two selected models.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedCriteria}
                  placeholder="Select a criteria ..."
                  onChange={(criteria) => this.setState({ selectedCriteria: criteria })}
                  onClear={() => this.setState({ selectedCriteria: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {CRITERIA_LIST.map((criteria) => (
                    <Option key={criteria} value={criteria}>
                      {criteria}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a model to compare.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedModelRight}
                  placeholder="Select a model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, false)}
                  onClear={() => this.setState({ selectedModelRight: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {modelIds.map((modelId) => (
                    <Option key={modelId} value={modelId}>
                      {modelId}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && dataBuildConfigLeft && (selectedCriteria === "Build Configuration") &&
                <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                  <Table columns={TABLE_BUILD_CONFIGS} dataSource={dataBuildConfigLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight &&dataBuildConfigRight && (selectedCriteria === "Build Configuration") &&
                <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                  <Table columns={TABLE_BUILD_CONFIGS} dataSource={dataBuildConfigRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && dataStatsLeft && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsPerfStats} dataSource={dataStatsLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && dataStatsRight && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsPerfStats} dataSource={dataStatsRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && cmConfigLeft && (selectedCriteria === "Confusion Matrix") &&
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '40px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative', height: '300px', width: '100%', maxWidth: '340px' }}>
                      <Heatmap {...cmConfigLeft}/>
                    </div>
                  </div>
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && cmConfigRight && (selectedCriteria === "Confusion Matrix") &&
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '40px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative', height: '300px', width: '100%', maxWidth: '340px' }}>
                      <Heatmap {...cmConfigRight}/>
                    </div>
                  </div>
                </div>
              }
            </Col>
          </Row>
        </div>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models }) => ({
  app, models,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
