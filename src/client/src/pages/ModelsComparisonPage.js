import React, { Component } from "react";
import { connect } from "react-redux";
import { Row, Col, Tooltip, Table, Select, Card, Divider, Tag } from "antd";
import LayoutPage from "./LayoutPage";
import { Heatmap, Column } from '@ant-design/plots';
import { SwapOutlined } from '@ant-design/icons';
import {
  requestApp,
  requestAllModels,
} from "../actions";
import {
  transformConfigStrToTableData,
  removeCsvPath,
  updateConfusionMatrix,
  getTablePerformanceStats,
  getConfigConfusionMatrix,
  getFilteredModels,
  getColumnsPerfStats,
  isACApp,
} from "../utils";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";
import './styles.css';

const {
  CRITERIA_LIST, 
  TABLE_BUILD_CONFIGS,
} = require('../constants');
const { Option } = Select;

// Extended criteria list with new comparison options
const EXTENDED_CRITERIA_LIST = [
  "Model Configuration", // Merged: Build Config + Metadata
  "Model Performance",
  "Confusion Matrix",
  "Performance Summary",
  "Visual Metrics"
];

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
    };
  }

  componentDidMount() {
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  componentDidUpdate(prevProps) {
    const { app } = this.props;
    if (prevProps.app !== app) {
      this.setState({
        selectedModelLeft: null,
        selectedModelRight: null,
      });
    }
  }

  async loadPredictions(modelId, isLeft) {
    const cutoffProb = 0.5; // default value
    const buildConfig = await requestBuildConfigModel(modelId);
    console.log(buildConfig);

    let dataBuildConfig;
    if (this.props.app === 'ad') {
      const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfig));
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
    } else {
      dataBuildConfig = transformConfigStrToTableData(buildConfig);
    }
    console.log(dataBuildConfig);

    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
    const confusionMatrix = cm.confusionMatrix;
    const stats = cm.stats;
    this.setState({
      predictions,
      stats,
      confusionMatrix,
      classificationData: cm.classificationData
    });

    const dataStats = getTablePerformanceStats(modelId, stats, confusionMatrix);
    const configCM = confusionMatrix && getConfigConfusionMatrix(modelId, confusionMatrix);

    if (isLeft) {
      this.setState({
        selectedModelLeft: modelId,
        dataBuildConfigLeft: dataBuildConfig,
        dataStatsLeft: dataStats,
        cmConfigLeft: configCM,
      });
    } else {
      this.setState({
        selectedModelRight: modelId,
        dataBuildConfigRight: dataBuildConfig,
        dataStatsRight: dataStats,
        cmConfigRight: configCM,
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

    const filteredModels = getFilteredModels(app, models);
    const columnsPerfStats = getColumnsPerfStats(app);
    const modelIds = filteredModels.map((model) => model.modelId);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";

    return (
      <LayoutPage pageTitle="Models Comparison" pageSubTitle="Comparing models based on performance metrics">
        
        {/* Configuration Section */}
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 8 }}>
                <strong>Model 1</strong>
              </div>
              <Tooltip title="Select the first model to compare">
                <Select
                  showSearch 
                  allowClear
                  value={this.state.selectedModelLeft}
                  placeholder="Select first model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, true)}
                  onClear={() => this.setState({ selectedModelLeft: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%' }}
                >
                  {modelIds.map((modelId) => (
                    <Option key={modelId} value={modelId}>
                      {modelId}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 8 }}>
                <strong>Model 2</strong>
              </div>
              <Tooltip title="Select the second model to compare">
                <Select
                  showSearch 
                  allowClear
                  value={this.state.selectedModelRight}
                  placeholder="Select second model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, false)}
                  onClear={() => this.setState({ selectedModelRight: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%' }}
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
        </Card>
        
        {/* Results Section */}
        {selectedModelLeft && selectedModelRight && (
          <>
            <Divider orientation="left">
              <h2 style={{ fontSize: '20px' }}>Comparison Results</h2>
            </Divider>
            
            {/* Model Configuration Comparison */}
            {dataBuildConfigLeft && dataBuildConfigRight && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Model Configuration Comparison</h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Compare all model configurations including training parameters, datasets, algorithms, features, and scalers
            </div>
            <Row gutter={16}>
              <Col span={12}>
                {selectedModelLeft && dataBuildConfigLeft ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', fontWeight: 600, color: '#595959' }}>
                      <Tag color="blue">{selectedModelLeft}</Tag>
                    </div>
                    <Table 
                      columns={TABLE_BUILD_CONFIGS} 
                      dataSource={dataBuildConfigLeft} 
                      pagination={false}
                      size="small"
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 1 to view configuration
                  </div>
                )}
              </Col>
              <Col span={12}>
                {selectedModelRight && dataBuildConfigRight ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', fontWeight: 600, color: '#595959' }}>
                      <Tag color="green">{selectedModelRight}</Tag>
                    </div>
                    <Table 
                      columns={TABLE_BUILD_CONFIGS} 
                      dataSource={dataBuildConfigRight} 
                      pagination={false}
                      size="small"
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 2 to view configuration
                  </div>
                )}
              </Col>
            </Row>
          </Card>
            )}
            
            {/* Model Performance Comparison */}
            {dataStatsLeft && dataStatsRight && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Performance Metrics Comparison</h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Detailed performance statistics including precision, recall, and F1-score for each class
            </div>
            <Row gutter={16}>
              <Col span={12}>
                {selectedModelLeft && dataStatsLeft ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
                      Performance for <Tag color="blue">{selectedModelLeft}</Tag>
                    </div>
                    <Table 
                      columns={columnsPerfStats} 
                      dataSource={dataStatsLeft} 
                      pagination={false}
                      size="small"
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 1 to view performance
                  </div>
                )}
              </Col>
              <Col span={12}>
                {selectedModelRight && dataStatsRight ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
                      Performance for <Tag color="green">{selectedModelRight}</Tag>
                    </div>
                    <Table 
                      columns={columnsPerfStats} 
                      dataSource={dataStatsRight} 
                      pagination={false}
                      size="small"
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 2 to view performance
                  </div>
                )}
              </Col>
            </Row>
          </Card>
            )}
            
            {/* Confusion Matrix Comparison */}
            {cmConfigLeft && cmConfigRight && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Confusion Matrix Comparison</h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Visual heatmap comparison showing true vs predicted classifications for each model
            </div>
            <Row gutter={16}>
              <Col span={12}>
                {selectedModelLeft && cmConfigLeft ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c', textAlign: 'center' }}>
                      Confusion Matrix for <Tag color="blue">{selectedModelLeft}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <div className={cmStyle}>
                        <Heatmap {...cmConfigLeft}/>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 1 to view confusion matrix
                  </div>
                )}
              </Col>
              <Col span={12}>
                {selectedModelRight && cmConfigRight ? (
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c', textAlign: 'center' }}>
                      Confusion Matrix for <Tag color="green">{selectedModelRight}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <div className={cmStyle}>
                        <Heatmap {...cmConfigRight}/>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    Select Model 2 to view confusion matrix
                  </div>
                )}
              </Col>
            </Row>
          </Card>
            )}
            
            {/* Performance Summary & Visual Metrics - Side by Side */}
            {dataStatsLeft && dataStatsRight && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card style={{ height: '100%' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Performance Summary</h3>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
                      Head-to-head comparison showing which model wins in each key performance metric
                    </div>
            {selectedModelLeft && selectedModelRight && dataStatsLeft && dataStatsRight ? (
              <>
                <Table
                  dataSource={(() => {
                    // Extract key metrics from dataStatsLeft and dataStatsRight
                    // Data structure: { key, metric, class0, class1, ... }
                    const getMetricValue = (stats, metricName) => {
                      const row = stats.find(s => 
                        s.metric && s.metric.toLowerCase() === metricName.toLowerCase()
                      );
                      if (!row) return 0;
                      
                      // Average across all classes
                      const classKeys = Object.keys(row).filter(k => k.startsWith('class'));
                      if (classKeys.length === 0) return 0;
                      
                      const sum = classKeys.reduce((acc, key) => acc + (parseFloat(row[key]) || 0), 0);
                      return sum / classKeys.length;
                    };
                    
                    const metrics = ['Accuracy', 'Precision', 'Recall', 'F1-Score'];
                    return metrics.map((metric, index) => {
                      const leftVal = getMetricValue(dataStatsLeft, metric);
                      const rightVal = getMetricValue(dataStatsRight, metric);
                      let winner = 'Tie';
                      let winnerColor = 'default';
                      
                      const threshold = 0.001; // Consider values within 0.1% as tie
                      if (leftVal - rightVal > threshold) {
                        winner = selectedModelLeft;
                        winnerColor = 'blue';
                      } else if (rightVal - leftVal > threshold) {
                        winner = selectedModelRight;
                        winnerColor = 'green';
                      }
                      
                      return {
                        key: index,
                        metric,
                        model1: leftVal.toFixed(4),
                        model2: rightVal.toFixed(4),
                        winner,
                        winnerColor,
                        diff: Math.abs(leftVal - rightVal).toFixed(4)
                      };
                    });
                  })()}
                  columns={[
                    {
                      title: 'Metric',
                      dataIndex: 'metric',
                      key: 'metric',
                      render: (text) => <strong>{text}</strong>
                    },
                    {
                      title: <Tag color="blue">{selectedModelLeft}</Tag>,
                      dataIndex: 'model1',
                      key: 'model1',
                      align: 'center',
                    },
                    {
                      title: <Tag color="green">{selectedModelRight}</Tag>,
                      dataIndex: 'model2',
                      key: 'model2',
                      align: 'center',
                    },
                    {
                      title: 'Difference',
                      dataIndex: 'diff',
                      key: 'diff',
                      align: 'center',
                      render: (text) => <span style={{ color: '#8c8c8c' }}>±{text}</span>
                    },
                    {
                      title: 'Winner',
                      dataIndex: 'winner',
                      key: 'winner',
                      align: 'center',
                      render: (text, record) => (
                        record.winner === 'Tie' ? (
                          <Tag color="default">🤝 Tie</Tag>
                        ) : (
                          <Tag color={record.winnerColor}>
                            🏆 {text}
                          </Tag>
                        )
                      )
                    },
                  ]}
                  pagination={false}
                  size="small"
                />
                
                {/* Overall Winner Summary */}
                <Card size="small" style={{ marginTop: 16, backgroundColor: '#f0f5ff', border: '1px solid #adc6ff' }}>
                  {(() => {
                    const metrics = ['Accuracy', 'Precision', 'Recall', 'F1-Score'];
                    let leftWins = 0;
                    let rightWins = 0;
                    let ties = 0;
                    
                    metrics.forEach(metric => {
                      const getMetricValue = (stats, metricName) => {
                        const row = stats.find(s => 
                          s.metric && s.metric.toLowerCase() === metricName.toLowerCase()
                        );
                        if (!row) return 0;
                        const classKeys = Object.keys(row).filter(k => k.startsWith('class'));
                        if (classKeys.length === 0) return 0;
                        const sum = classKeys.reduce((acc, key) => acc + (parseFloat(row[key]) || 0), 0);
                        return sum / classKeys.length;
                      };
                      
                      const leftVal = getMetricValue(dataStatsLeft, metric);
                      const rightVal = getMetricValue(dataStatsRight, metric);
                      const threshold = 0.001;
                      
                      if (leftVal - rightVal > threshold) {
                        leftWins++;
                      } else if (rightVal - leftVal > threshold) {
                        rightWins++;
                      } else {
                        ties++;
                      }
                    });
                    
                    let summaryText = '';
                    let summaryIcon = '';
                    let summaryColor = '#1890ff';
                    
                    if (leftWins > rightWins) {
                      summaryText = `${selectedModelLeft} performs better overall, winning ${leftWins} out of ${metrics.length} metrics`;
                      summaryIcon = '🏆';
                      summaryColor = '#1890ff';
                    } else if (rightWins > leftWins) {
                      summaryText = `${selectedModelRight} performs better overall, winning ${rightWins} out of ${metrics.length} metrics`;
                      summaryIcon = '🏆';
                      summaryColor = '#52c41a';
                    } else {
                      summaryText = `Both models perform equally well with ${leftWins} wins each${ties > 0 ? ` and ${ties} tie(s)` : ''}`;
                      summaryIcon = '🤝';
                      summaryColor = '#8c8c8c';
                    }
                    
                    return (
                      <div style={{ fontSize: '13px', color: summaryColor, textAlign: 'center' }}>
                        <strong>{summaryIcon} {summaryText}</strong>
                      </div>
                    );
                  })()}
                </Card>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                Select both models to see performance summary
              </div>
            )}
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card style={{ height: '100%' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Visual Performance Comparison</h3>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
                      Side-by-side bar chart visualization of accuracy, precision, recall, and F1-score
                    </div>
            {selectedModelLeft && selectedModelRight && dataStatsLeft && dataStatsRight ? (
              <>
                <Column
                  data={(() => {
                    // Data structure: { key, metric, class0, class1, ... }
                    const getMetricValue = (stats, metricName) => {
                      const row = stats.find(s => 
                        s.metric && s.metric.toLowerCase() === metricName.toLowerCase()
                      );
                      if (!row) return 0;
                      
                      // Average across all classes
                      const classKeys = Object.keys(row).filter(k => k.startsWith('class'));
                      if (classKeys.length === 0) return 0;
                      
                      const sum = classKeys.reduce((acc, key) => acc + (parseFloat(row[key]) || 0), 0);
                      return sum / classKeys.length;
                    };
                    
                    const metrics = ['Accuracy', 'Precision', 'Recall', 'F1-Score'];
                    const chartData = [];
                    
                    metrics.forEach(metric => {
                      chartData.push({
                        metric,
                        value: getMetricValue(dataStatsLeft, metric),
                        model: selectedModelLeft,
                        modelGroup: 'Model 1'
                      });
                      chartData.push({
                        metric,
                        value: getMetricValue(dataStatsRight, metric),
                        model: selectedModelRight,
                        modelGroup: 'Model 2'
                      });
                    });
                    
                    return chartData;
                  })()}
                  xField="metric"
                  yField="value"
                  seriesField="modelGroup"
                  isGroup={true}
                  columnStyle={{
                    radius: [8, 8, 0, 0],
                  }}
                  color={['#1890ff', '#52c41a']}
                  legend={{
                    position: 'top-right',
                  }}
                  label={{
                    position: 'top',
                    style: {
                      fill: '#000000',
                      opacity: 0.6,
                      fontSize: 12,
                    },
                    formatter: (datum) => datum.value.toFixed(3),
                  }}
                  yAxis={{
                    max: 1,
                    label: {
                      formatter: (v) => `${(v * 100).toFixed(0)}%`,
                    },
                  }}
                  tooltip={{
                    formatter: (datum) => {
                      return {
                        name: datum.model,
                        value: (datum.value * 100).toFixed(2) + '%',
                      };
                    },
                  }}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                Select both models to see visual comparison
              </div>
            )}
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}
        
        {(!selectedModelLeft || !selectedModelRight) && (
          <Card style={{ marginBottom: 16, marginTop: 16 }}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8c8c8c' }}>
              <SwapOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 400 }}>Select two models to view comparison results</h3>
            </div>
          </Card>
        )}
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
