import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Select, Col, Row, Button, Card, Statistic, Divider, message, notification } from 'antd';
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
      currentJobId: null,  // For queue-based retraining
      retrainId: null,     // Result from completed retrain
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
      
      // Check for attack_type parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const attackType = urlParams.get('attack_type');
      
      if (attackType) {
        const attackDatasetMap = {
          'rsl': 'rsl_poisoned_dataset.csv',
          'tlf': 'tlf_poisoned_dataset.csv',
          'ctgan': 'ctgan_poisoned_dataset.csv'
        };
        const dataset = attackDatasetMap[attackType];
        if (dataset && attacksDatasets && attacksDatasets.includes(dataset)) {
          this.setState({ buildConfig, attacksDatasets, selectedAttack: dataset }, () => {
            // Auto-trigger computation when navigating from Attack page
            notification.info({
              message: 'Auto-computing Impact',
              description: `Automatically computing resilience metrics for ${attackType.toUpperCase()} attack...`,
              placement: 'topRight',
            });
            // Trigger computation automatically after state is set
            setTimeout(() => this.handleButtonComputeMetric(dataset), 1000);
          });
        } else {
          this.setState({ buildConfig, attacksDatasets });
        }
      } else {
        this.setState({ buildConfig, attacksDatasets });
      }
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
      const attacksDatasets = await requestAttacksDatasets(modelId);
      
      // Check for attack_type parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const attackType = urlParams.get('attack_type');
      
      if (attackType) {
        const attackDatasetMap = {
          'rsl': 'rsl_poisoned_dataset.csv',
          'tlf': 'tlf_poisoned_dataset.csv',
          'ctgan': 'ctgan_poisoned_dataset.csv'
        };
        const dataset = attackDatasetMap[attackType];
        if (dataset && attacksDatasets && attacksDatasets.includes(dataset)) {
          this.setState({ buildConfig, attacksDatasets, selectedAttack: dataset });
        } else {
          this.setState({ buildConfig, attacksDatasets });
        }
      } else {
        this.setState({ buildConfig, attacksDatasets });
      }
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

  async loadRetrainedResults(retrainId, attackName) {
    try {
      const { requestRetrainedPredictions } = require('../api');
      const predictionsValues = await requestRetrainedPredictions(retrainId);
      
      if (!predictionsValues || predictionsValues.trim() === '') {
        throw new Error('No prediction data received');
      }
      
      const predictions = predictionsValues.split('\n')
        .filter(line => line.trim() !== '')
        .map((d) => ({
          prediction: parseFloat(d.split(',')[0]),
          trueLabel: parseInt(d.split(',')[1]),
        }));
      
      this.setState({ attacksPredictions: predictions });
      const attCM = updateConfusionMatrix(this.props.app, predictions, this.state.cutoffProb);
      
      this.setState({
        stats: attCM.stats,
        attacksConfusionMatrix: attCM.confusionMatrix,
        classificationData: attCM.classificationData,
        selectedAttack: attackName
      });
      
      message.success('Impact metrics computed successfully!');
      
    } catch (error) {
      console.error('Error loading retrained results:', error);
      message.error('Failed to load impact metrics: ' + error.message);
    }
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
      console.log("Starting queue-based retrain for impact metric computation");

      try {
        const { requestRetrainOfflineQueued, requestRetrainJobStatus } = require('../api');
        
        let params = {};
        if (!isACApp(app) && buildConfig) {
          try {
            const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfig));
            params = transformedBuildConfig.training_parameters || {};
          } catch (e) {
            params = {
              nb_epoch_cnn: 50,
              nb_epoch_sae: 50,
              batch_size_cnn: 32,
              batch_size_sae: 32
            };
          }
        }
        
        // Queue the retrain job
        const queueResponse = await requestRetrainOfflineQueued(
          modelId, 
          trainingDataset, 
          testingDataset, 
          params,
          isACApp(app)
        );
        this.setState({ 
          currentJobId: queueResponse.jobId,
        });
        
        // Poll job status
        this.intervalId = setInterval(async () => {
          try {
            const jobStatus = await requestRetrainJobStatus(this.state.currentJobId);
            
            if (jobStatus.status === 'completed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              const retrainId = jobStatus.result?.retrainId;
              
              this.setState({ 
                isRunning: false,
                retrainId 
              });
              
              message.success('Model retraining completed! Loading impact metrics...');
              
              // Load the confusion matrix from the retrained model
              if (retrainId) {
                this.loadRetrainedResults(retrainId, selectedAttack);
              } else {
                message.error('Failed to load retrain results: No retrainId found');
              }
              
            } else if (jobStatus.status === 'failed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              this.setState({ isRunning: false });
              console.error('Retrain failed:', jobStatus.failedReason);
              message.error('Retrain failed: ' + jobStatus.failedReason);
            }
          } catch (error) {
            console.error('Error polling retrain job status:', error);
          }
        }, 5000); // Poll every 5 seconds
        
      } catch (error) {
        console.error('Error starting retrain:', error);
        this.setState({ isRunning: false });
        message.error('Failed to start retrain: ' + error.message);
      }
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
              <strong style={{ marginRight: 4 }}><span style={{ color: 'red' }}>* </span>Model:</strong>
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
              <strong style={{ marginRight: 4 }}><span style={{ color: 'red' }}>* </span>Attack:</strong>
            </Col>
            <Col>
              <Select
                style={{ width: 280 }}
                value={this.state.selectedAttack}
                allowClear
                showSearch
                placeholder="Select an attack ..."
                disabled={new URLSearchParams(window.location.search).has('attack_type')}
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
                        title="Accuracy Drop" 
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