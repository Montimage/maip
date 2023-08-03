import React, { Component } from "react";
import { connect } from "react-redux";
import { Row, Col, Tooltip, Table, Select } from "antd";
import LayoutPage from "./LayoutPage";
import { Heatmap } from '@ant-design/plots';
import {
  requestAllModels,
} from "../actions";
const {
  SERVER_URL,
} = require('../constants');
const { Option } = Select;

const style = {
  //background: '#0092ff',
  padding: '10px 0',
  border: '1px solid black',
};

const criteriaList = [
  "Build Configuration",
  "Model Performance",
  "Confusion Matrix",
];

const columnsTableBuildConfigs = [
  {
    title: 'Parameter',
    dataIndex: 'parameter',
    key: 'parameter',
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
  },
];


const columnsTableStats = [
  {
    title: 'Metric',
    dataIndex: 'metric',
    key: 'metric',
  },
  {
    title: 'Normal traffic',
    dataIndex: 'class0',
    key: 'class0',
  },
  {
    title: 'Malware traffic',
    dataIndex: 'class1',
    key: 'class1',
  },
];

function removeCsvPath(buildConfig) {
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
    this.props.fetchAllModels();
  }

  loadPredictions = async (modelId, isLeft) => {
    console.log(modelId);    
    const predictionsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/predictions`, {
      method: 'GET',
    });
    const predictionsData = await predictionsResponse.json();
    const predictionsValues = predictionsData.predictions;
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    const cutoffProb = 0.5;
    //const { predictions } = this.state;
    const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
    const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
    const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
    const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;
    const confusionMatrix = [
      [TP, FP],
      [FN, TN],
    ];

    const accuracy = (TP + TN) / (TP + TN + FP + FN);
    const precision = TP / (TP + FP);
    const recall = TP / (TP + FN);
    const f1Score = (2 * precision * recall) / (precision + recall);

    const precisionPositive = TP / (TP + FP);
    const recallPositive = TP / (TP + FN);
    const f1ScorePositive = (2 * precisionPositive * recallPositive) / (precisionPositive + recallPositive);
    const supportPositive = TP + FN;

    const precisionNegative = TN / (TN + FN);
    const recallNegative = TN / (TN + FP);
    const f1ScoreNegative = (2 * precisionNegative * recallNegative) / (precisionNegative + recallNegative);
    const supportNegative = TN + FP;

    //console.log({accuracy, precision, recall, f1Score});
    //console.log({precisionPositive, recallPositive, f1ScorePositive, supportPositive});
    //console.log({precisionNegative, recallNegative, f1ScoreNegative, supportNegative});

    const stats = [
      [precisionPositive, recallPositive, f1ScorePositive, supportPositive],
      [precisionNegative, recallNegative, f1ScoreNegative, supportNegative],
      [accuracy],
    ];

    const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rowsStats = statsStr.split('\n').map(row => row.split(','));
    const headerStats = ["precision", "recall", "f1score", "support"];
    let dataStats = [];
    if(rowsStats.length === 3) {
      const accuracy = parseFloat(rowsStats[2][1]);
      dataStats = headerStats.map((metric, i) => ({
        key: (i).toString(),
        metric,
        class0: +rowsStats[0][i+1],
        class1: +rowsStats[1][i+1],
      }));
      dataStats.push({
        key: '5',
        metric: 'accuracy',
        class0: accuracy,
        class1: accuracy,
      });
    }

    if (isLeft) {
      this.setState({ dataStatsLeft: dataStats }); 
    } else {
      this.setState({ dataStatsRight: dataStats });
    }

    const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const headers = ["Normal traffic", "Malware traffic"];
    const rows = cmStr.trim().split('\n');
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      return cols.slice(1).map((val, j) => ({
        actual: headers[i],
        predicted: headers[j],
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

    const { models } = this.props;
    const model = models.find((modelId) => modelId === modelId);
    const modelBuildConfig = removeCsvPath(model.buildConfig);
    //console.log(modelBuildConfig);

    const { datasets, training_ratio, training_parameters } = modelBuildConfig;

    const dataBuildConfig = [
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
    //console.log(dataBuildConfig);

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
    const modelIds = models.map((model) => model.modelId);
    console.log(modelIds);

    return (
      <LayoutPage pageTitle="Models Comparison" pageSubTitle="Comparing models based on performance metrics">
        <div style={style}>
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
                  placeholder="Select a model"
                  onChange={(modelId) => this.loadPredictions(modelId, true)}
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
                  placeholder="Select a comparison criteria"
                  onChange={(criteria) => this.setState({ selectedCriteria: criteria })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {criteriaList.map((criteria) => (
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
                  placeholder="Select a model"
                  onChange={(modelId) => this.loadPredictions(modelId, false)}
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
                  <Table columns={columnsTableBuildConfigs} dataSource={dataBuildConfigLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && dataBuildConfigRight && (selectedCriteria === "Build Configuration") &&
                <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                  <Table columns={columnsTableBuildConfigs} dataSource={dataBuildConfigRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && dataStatsLeft && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsTableStats} dataSource={dataStatsLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && dataStatsRight && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsTableStats} dataSource={dataStatsRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && cmConfigLeft && (selectedCriteria === "Confusion Matrix") &&
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '40px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative', height: '320px', width: '100%', maxWidth: '390px' }}>
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
                    <div style={{ position: 'relative', height: '320px', width: '100%', maxWidth: '390px' }}>
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

const mapPropsToStates = ({ models }) => ({
  models
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
