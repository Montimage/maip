import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Select, Slider, Table, Col, Row, Card, Divider, Statistic, Alert, Spin } from 'antd';
import { Heatmap, Column } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestMetricCurrentness,
} from "../actions";
import {
  COLUMNS_CURRENTNESS_METRICS,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  updateConfusionMatrix,
  getColumnsPerfStats,
  getTablePerformanceStats,
  getConfigClassification,
  computeCutoff,
  getDataPrecision,
  getConfigPrecisionPlot,
  isACApp,
} from "../utils";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";
import './styles.css';

// TODO: recheck cutOff, get errors when update Cutoff percentile of samples for AD models

let isModelIdPresent = getLastPath() !== "accountability";

class AccountabilityMetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modelId: null,
      stats: [],
      predictions: [],
      confusionMatrix: [],
      classificationData: [],
      cutoffProb: 0.5,
      cutoffPercentile: 0.5,
      dataPrecision: null,
      loading: false,
      error: null,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;
    // reset states once app is changed
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        cutoffPercentile: 0.5,
        dataPrecision: null,
        loading: false,
        error: null,
      });
    }
    if (modelId !== prevState.modelId) {
      if (modelId) {
        this.setState({ loading: true, error: null });
        try {
          this.props.fetchModel(modelId);
          await this.loadPredictions(modelId);
          this.props.fetchMetricCurrentness(modelId);
          const buildConfig = await requestBuildConfigModel(modelId);
          console.log(buildConfig);
          this.setState({ loading: false });
        } catch (error) {
          console.error('Error loading model data:', error);
          this.setState({ loading: false, error: 'Failed to load model data' });
        }
      } else {
        // reset states once modelId is cleared
        this.setState({
          modelId: null,
          stats: [],
          predictions: [],
          confusionMatrix: [],
          classificationData: [],
          cutoffProb: 0.5,
          cutoffPercentile: 0.5,
          dataPrecision: null,
          loading: false,
          error: null,
        });
      }
    }
  }

  async loadPredictions(modelId) {
    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    this.setState({ predictions }, this.updateConfusionMatrix);
    this.updatePrecisionPlot();
  }

  updateConfusionMatrix() {
    const { predictions, cutoffProb } = this.state;
    const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
    const confusionMatrix = cm.confusionMatrix;
    const stats = cm.stats;
    this.setState({
      predictions,
      stats,
      confusionMatrix,
      classificationData: cm.classificationData
    });
  }

  // TODO: recheck the precision plot
  updatePrecisionPlot() {
    const { predictions } = this.state;
    const dataPrecision = getDataPrecision(predictions);
    console.log(dataPrecision);
    this.setState({ dataPrecision });
  }

  handleCutoffProbChange(value) {
    this.setState({ cutoffProb: value }, () => {
      this.updateConfusionMatrix();
      this.updatePrecisionPlot();
    });
  }

  handleCutoffPercentileChange(value) {
    const { predictions } = this.state;
    const cutoffProb = computeCutoff(predictions, value);
    this.setState({ cutoffPercentile: value, cutoffProb: cutoffProb });
    this.handleCutoffProbChange(cutoffProb);
  }

  renderMetricsCards() {
    const { app, metrics } = this.props;
    const {
      modelId,
      confusionMatrix,
      stats,
      classificationData,
      dataPrecision,
      loading,
      error
    } = this.state;

    const columnsPerfStats = getColumnsPerfStats(app);
    const dataStats = getTablePerformanceStats(modelId, stats, confusionMatrix);
    const configCM = getConfigConfusionMatrix(modelId, confusionMatrix);
    const configClassification = getConfigClassification(classificationData);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";
    const configPrecision = getConfigPrecisionPlot(dataPrecision);

    const dataCurrentnessMetric = metrics.map((item) => {
      const [method, score] = item.split(': ');
      return { method: method, score: parseFloat(score).toFixed(2) };
    });

    if (error) {
      return (
        <Alert
          message="Error Loading Data"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      );
    }

    return (
      <Spin spinning={loading} tip="Loading model data...">
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <Card style={{ marginBottom: 16, height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Model Performance</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Performance metrics per class for the selected model
                </span>
              </div>
              {modelId && dataStats && dataStats.length > 0 && (
                <Table 
                  columns={columnsPerfStats} 
                  dataSource={dataStats} 
                  pagination={false}
                  size="small"
                />
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ marginBottom: 16, height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Confusion Matrix</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  True/False Positives/Negatives for the current threshold
                </span>
              </div>
              {modelId && configCM && configCM.data && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div className={cmStyle}>
                    <Heatmap {...configCM} />
                  </div>
                </div>
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ marginBottom: 16, height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Classification Distribution</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Fraction of each class above and below the current cutoff
                </span>
              </div>
              {modelId && configClassification && configClassification.data && configClassification.data.length > 0 && (
                <div style={{ height: 300 }}>
                  <Column {...configClassification} />
                </div>
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ marginBottom: 16, height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Currentness Metrics</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  XAI method execution time compared to base model inference
                </span>
              </div>
              {modelId && dataCurrentnessMetric && dataCurrentnessMetric.length > 0 && (
                <Table 
                  columns={COLUMNS_CURRENTNESS_METRICS} 
                  dataSource={dataCurrentnessMetric}
                  pagination={false} 
                  size="small"
                />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    );
  }

  render() {
    const { modelId } = this.state;

    const subTitle = isModelIdPresent ?
      `Accountability metrics for model ${modelId}` :
      'Analyze model accountability and performance metrics';

    return (
      <LayoutPage 
        pageTitle="Accountability Metrics" 
        pageSubTitle={subTitle}
      >
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>

        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle" justify="center">
            <Col flex="none">
              <strong style={{ marginRight: 4 }}>Model:</strong>
            </Col>
            <Col>
              <Select
                placeholder="Select a model ..."
                style={{ width: 400 }}
                allowClear
                showSearch
                loading={this.state.loading}
                value={modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value });
                  console.log(`Select model ${value}`);
                }}
                options={getFilteredModelsOptions(this.props.app, this.props.models)}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 24 }}>
            <Row gutter={24} style={{ marginBottom: 20 }}>
              <Col span={12}>
                <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                  <Statistic
                    title="Probability Threshold"
                    value={this.state.cutoffProb}
                    precision={2}
                    valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                  <Statistic
                    title="Percentile Threshold"
                    value={this.state.cutoffPercentile * 100}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={24} style={{ marginTop: 24 }}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Prediction Probability Cutoff</strong>
                </div>
                <Slider
                  marks={{
                    0.01: '0.01',
                    0.25: '0.25',
                    0.50: '0.50',
                    0.75: '0.75',
                    0.99: '0.99',
                  }}
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={this.state.cutoffProb}
                  onChange={(value) => this.handleCutoffProbChange(value)}
                  tooltip={{ formatter: (value) => `${value.toFixed(2)}` }}
                  disabled={this.state.loading}
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Sample Percentile Cutoff</strong>
                </div>
                <Slider
                  marks={{
                    0.01: '0.01',
                    0.25: '0.25',
                    0.50: '0.50',
                    0.75: '0.75',
                    0.99: '0.99',
                  }}
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={this.state.cutoffPercentile}
                  onChange={(value) => this.handleCutoffPercentileChange(value)}
                  tooltip={{ formatter: (value) => `${(value * 100).toFixed(1)}%` }}
                  disabled={this.state.loading}
                />
              </Col>
            </Row>
          </div>
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Accountability Metrics</h2>
        </Divider>
        
        {this.renderMetricsCards()}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, model, metrics, }) => ({
  app, models, model, metrics,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchMetricCurrentness: (modelId) => dispatch(requestMetricCurrentness(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(AccountabilityMetricsPage);
