import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Select, Col, Row, Button, Card, Statistic, Divider } from 'antd';
import { Heatmap } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainStatusAC,
  requestRetrainModelAC,
} from "../actions";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
  requestAttacksDatasets,
} from "../api";
import {
  ATTACK_DATASETS_MAPPING,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  calculateImpactMetric,
  isACApp,
  isRunningApp,
  updateConfusionMatrix,
  removeCsvPath,
} from "../utils";
import './styles.css';

let isModelIdPresent = getLastPath() !== "resilience";

class ResilienceMetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modelId: null,
      stats: [],
      predictions: [],
      confusionMatrix: null,
      classificationData: [],
      cutoffProb: 0.5,
      selectedAttack: null,
      buildConfig: null,
      attacksDatasets: [],
      attacksPredictions: [],
      attacksConfusionMatrix: null,
      isRunning: false,
    }
  }

  async componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
      this.props.fetchModel(modelId);
      this.loadPredictions();
      const buildConfig = requestBuildConfigModel(modelId);
      console.log(buildConfig);
      const attacksDatasets = await requestAttacksDatasets(modelId);
      console.log(attacksDatasets);
      this.setState({ buildConfig, attacksDatasets });
    }
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;
    const { app, retrainStatus, retrainACStatus  } = this.props;
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        selectedAttack: null,
        buildConfig: null,
        attacksPredictions: [],
        attacksConfusionMatrix: null,
      });
    }

    if (modelId && modelId !== prevState.modelId) {
      this.props.fetchModel(modelId);
      this.loadPredictions();
      const buildConfig = await requestBuildConfigModel(modelId);
      this.setState({ buildConfig });
      console.log(buildConfig);
    }

    // Check the retrainStatus or retrainACStatus based on the app type
    const currentIsRunning = isRunningApp(app, retrainACStatus, retrainStatus);
    const prevIsRunning = isRunningApp(prevProps.app, prevProps.retrainACStatus, prevProps.retrainStatus);

    if (prevIsRunning === true && currentIsRunning === false) {
      console.log('isRunning has been changed from true to false');
      this.setState({ isRunning: currentIsRunning });
      clearInterval(this.intervalId);
      const retrainId = isACApp(app) ?
                          retrainACStatus.lastRetrainId : retrainStatus.lastRetrainId;
      await this.loadAttacksPredictions(retrainId);
    }
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async loadAttacksPredictions(modelId) {
    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    //console.log(predictions);
    this.setState({ attacksPredictions: predictions });
    const attCM = updateConfusionMatrix(this.props.app, predictions, this.state.cutoffProb);
    this.setState({
      stats: attCM.stats,
      attacksConfusionMatrix: attCM.confusionMatrix,
      classificationData: attCM.classificationData
    });
  }

  async loadPredictions() {
    const { modelId, cutoffProb } = this.state;

    if (modelId) {
      const predictionsValues = await requestPredictionsModel(modelId);
      //console.log(predictionsValues);
      const predictions = predictionsValues.split('\n').map((d) => ({
        prediction: parseFloat(d.split(',')[0]),
        trueLabel: parseInt(d.split(',')[1]),
      }));
      //console.log(predictions);

      this.setState({ predictions }, () => {
        const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
        this.setState({
          stats: cm.stats,
          confusionMatrix: cm.confusionMatrix,
          classificationData: cm.classificationData
        });
      });
    }
  }

  async handleButtonComputeMetric(selectedAttack) {
    const { modelId, buildConfig, isRunning } = this.state;
    const { app } = this.props;
    const testingDataset = "Test_samples.csv";
    const trainingDataset = `${selectedAttack}`;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (!isRunning) {
      this.setState({ isRunning: true });
      console.log("update isRunning state!");

      if (isACApp(app)) {
        this.props.fetchRetrainModelAC(
          modelId, trainingDataset, testingDataset,
        );
      } else {
        const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfig));
        const { training_parameters } = transformedBuildConfig;
        console.log(training_parameters);
        this.props.fetchRetrainModel(
          modelId, trainingDataset, testingDataset, training_parameters,
        );
      }

      this.intervalId = setInterval(() => {
        isACApp(app) ? this.props.fetchRetrainStatusAC() : this.props.fetchRetrainStatus();
      }, 3000);
    }
  }

  render() {
    const { app, models } = this.props;
    const {
      isRunning,
      modelId,
      confusionMatrix,
      attacksDatasets,
      attacksConfusionMatrix,
    } = this.state;

    let configAttacksCM = null, impact = null;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const attacksDatasetsOptions = attacksDatasets ? attacksDatasets
      .filter(dataset => ATTACK_DATASETS_MAPPING.hasOwnProperty(dataset))
      .map(dataset => ({
        value: dataset,
        label: ATTACK_DATASETS_MAPPING[dataset] || dataset,
    })) : [];
    const configCM = confusionMatrix && getConfigConfusionMatrix(modelId, confusionMatrix);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";

    if (attacksConfusionMatrix) {
      configAttacksCM = getConfigConfusionMatrix(modelId, attacksConfusionMatrix);
      impact = calculateImpactMetric(this.props.app, confusionMatrix, attacksConfusionMatrix);
      console.log(impact);
    }

    const subTitle = isModelIdPresent ?
      `Resilience metrics for model ${modelId}` :
      'Analyze model resilience against adversarial attacks';

    return (
      <LayoutPage pageTitle="Resilience Metrics" pageSubTitle={subTitle}>
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
                style={{ width: 300 }}
                allowClear
                showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value }, async () => {
                    try {
                      if (value) {
                        const attacksDatasets = await requestAttacksDatasets(value);
                        this.setState({ attacksDatasets });
                      }
                    } catch (error) {
                      console.error("Error loading attacks datasets:", error);
                    }
                  });
                }}
                onClear={() => this.setState({
                                selectedAttack: null,
                                attacksConfusionMatrix: null,
                                attacksDatasets: null
                              })}
                options={modelsOptions}
              />
            </Col>

            <Col flex="none" style={{ marginLeft: 24 }}>
              <strong style={{ marginRight: 4 }}>Attack:</strong>
            </Col>
            <Col>
              <Select
                style={{ width: 280 }}
                value={this.state.selectedAttack}
                allowClear
                showSearch
                placeholder="Select an attack ..."
                onChange={value => {
                  if (value) {
                    this.setState({ selectedAttack: value });
                  }
                  this.setState({ attacksConfusionMatrix: null });
                }}
                onClear={() => this.setState({ selectedAttack: null, attacksConfusionMatrix: null })}
                options={attacksDatasetsOptions}
              />
            </Col>

            <Col style={{ marginLeft: 24 }}>
              <Button
                type="primary"
                loading={isRunning}
                disabled={!this.state.modelId || !this.state.selectedAttack}
                onClick={() => this.handleButtonComputeMetric(this.state.selectedAttack)}
              >
                Compute Impact
              </Button>
            </Col>
          </Row>
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Impact Metrics</h2>
        </Divider>

        <Row gutter={[24, 24]}>
          {attacksConfusionMatrix && (
            <Col span={24}>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <strong style={{ fontSize: 16 }}>Impact Metrics Summary</strong>
                </div>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                      <Statistic 
                        title="Δ Accuracy" 
                        value={impact} 
                        precision={2} 
                        suffix="%" 
                        valueStyle={{ 
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: impact > 10 ? '#f5222d' : impact > 5 ? '#faad14' : '#52c41a'
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                      <Statistic 
                        title="Resilience Level" 
                        value={impact > 10 ? 'Low' : impact > 5 ? 'Medium' : 'High'}
                        valueStyle={{ 
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: impact > 10 ? '#f5222d' : impact > 5 ? '#faad14' : '#52c41a'
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                      <Statistic 
                        title="Impact Category" 
                        value={impact > 10 ? 'Critical' : impact > 5 ? 'Moderate' : 'Minor'}
                        valueStyle={{ 
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: impact > 10 ? '#f5222d' : impact > 5 ? '#faad14' : '#52c41a'
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                      <Statistic 
                        title="Risk Assessment" 
                        value={impact > 10 ? 'High Risk' : impact > 5 ? 'Medium Risk' : 'Low Risk'}
                        valueStyle={{ 
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: impact > 10 ? '#f5222d' : impact > 5 ? '#faad14' : '#52c41a'
                        }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          )}

          <Col span={12}>
            <Card style={{ marginBottom: 16, height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Model Before Attack</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Original model confusion matrix on test data
                </span>
              </div>
              {attacksConfusionMatrix && (
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
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Model After Attack</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Compromised model confusion matrix after poisoning
                </span>
              </div>
              {attacksConfusionMatrix && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div className={cmStyle}>
                    <Heatmap {...configAttacksCM} />
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, model, metrics, retrainStatus, retrainACStatus }) => ({
  app, models, model, metrics, retrainStatus, retrainACStatus
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchRetrainStatus: () => dispatch(requestRetrainStatus()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
  fetchRetrainStatusAC: () => dispatch(requestRetrainStatusAC()),
  fetchRetrainModelAC: (modelId, trainingDataset, testingDataset) =>
    dispatch(requestRetrainModelAC({ modelId, trainingDataset, testingDataset })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ResilienceMetricsPage);