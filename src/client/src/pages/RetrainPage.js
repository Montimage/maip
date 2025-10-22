import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { connect } from "react-redux";
import { Row, Col, Card, Divider, Spin, Tooltip, Button, InputNumber, Form, Select, Statistic, notification } from 'antd';
import { LockOutlined, RocketOutlined } from '@ant-design/icons';
import { useUserRole } from '../hooks/useUserRole';
import {
  requestApp,
  requestAllModels,
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainModelAC,
  requestRetrainStatusAC,
} from "../actions";
import {
  requestModelDatasets,
  requestAttacksDatasets,
} from "../api";

import {
  FORM_LAYOUT,
  FEATURES_OPTIONS,
} from "../constants";
import { 
  getLastPath,
  getFilteredModelsOptions,
  isACApp,
  isRunningApp,
} from "../utils";

let isModelIdPresent = getLastPath() !== "retrain";

class RetrainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      modelDatasets: [],
      attacksDatasets: [],
      trainingDataset: null,
      testingDataset: null,
      featureList: "Raw Features",
      trainingParameters: {
        nb_epoch_cnn: 2,
        nb_epoch_sae: 5,
        batch_size_cnn: 32,
        batch_size_sae: 16,
      },
      isRunning: isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus),
      currentJobId: null,  // For queue-based retraining
      retrainId: null,     // Result from completed retrain
      retrainResult: null, // Full result data from retrain job
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleButtonRetrain = this.handleButtonRetrain.bind(this);
  }

  async componentDidMount() {
    if (isModelIdPresent) {
      const modelId = getLastPath();
      this.setState({ modelId });
      try {
        const modelDatasets = await requestModelDatasets(modelId);
        this.setState({ modelDatasets });
        console.log(modelDatasets);
  
        const attacksDatasets = await requestAttacksDatasets(modelId);
        this.setState({ attacksDatasets });
        console.log(attacksDatasets);
      } catch (error) {
        console.error("Error fetching datasets:", error);
      }
    } 
    this.props.fetchAllModels(); 
    this.props.fetchApp();
  }

  async handleButtonRetrain() {
    const { modelId, trainingDataset, testingDataset, trainingParameters, isRunning } = this.state;

    if (!isRunning) {
      const fetchModelId = isModelIdPresent ? getLastPath() : modelId;
      
      // Clear previous results and start new retrain
      this.setState({ 
        isRunning: true,
        retrainResult: null,
        retrainId: null
      });

      try {
        const { requestRetrainOfflineQueued, requestRetrainJobStatus } = require('../api');
        
        // Queue the retrain job
        const queueResponse = await requestRetrainOfflineQueued(
          fetchModelId, 
          trainingDataset, 
          testingDataset, 
          trainingParameters,
          isACApp(this.props.app)
        );
        
        this.setState({ 
          currentJobId: queueResponse.jobId,
        });
        
        notification.success({
          message: 'Retrain Job Queued',
          description: 'Model retraining has been queued successfully. You will be notified when it completes.',
          placement: 'topRight',
          duration: 4,
        });
        
        // Poll job status
        this.intervalId = setInterval(async () => {
          try {
            const jobStatus = await requestRetrainJobStatus(this.state.currentJobId);
            
            if (jobStatus.status === 'completed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              this.setState({ 
                isRunning: false,
                retrainId: jobStatus.result?.retrainId,
                retrainResult: jobStatus.result
              });
              
              notification.success({
                message: 'Retrain Completed',
                description: `Model retrained successfully! View the results below.`,
                placement: 'topRight',
                duration: 6,
              });
              
            } else if (jobStatus.status === 'failed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              this.setState({ isRunning: false });
              
              notification.error({
                message: 'Retrain Failed',
                description: jobStatus.failedReason || 'Unknown error occurred',
                placement: 'topRight',
                duration: 6,
              });
            }
          } catch (error) {
            console.error('Error polling retrain job status:', error);
          }
        }, 5000); // Poll every 5 seconds
        
      } catch (error) {
        console.error('Error starting retrain:', error);
        this.setState({ isRunning: false });
        notification.error({
          message: 'Failed to Queue Retrain',
          description: error.message,
          placement: 'topRight',
          duration: 6,
        });
      }
    }
  }

  componentWillUnmount() {
    // Clean up polling interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  componentDidUpdate(prevProps) {
    // Clear state when app changes (e.g., switching between AD and AC)
    if (prevProps.app !== this.props.app) {
      clearInterval(this.intervalId);
      this.setState({ 
        modelId: null,
        modelDatasets: [],
        attacksDatasets: [],
        trainingDataset: null,
        testingDataset: null, 
        isRunning: false,
      });
    }
  }

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  render() {
    const { modelId, modelDatasets, attacksDatasets } = this.state;
    const { app, models, isAdmin, isSignedIn } = this.props;

    let trainingDatasetsOptions = [], testingDatasetsOptions = []; 
    let allDatasets = [...modelDatasets];
    if (attacksDatasets.length) {
      allDatasets = [...modelDatasets, ...attacksDatasets];
    }
    trainingDatasetsOptions = allDatasets ? allDatasets.map(dataset => ({
      value: dataset,
      label: dataset,
    })) : [];
    testingDatasetsOptions = modelDatasets ? modelDatasets.map(dataset => ({
      value: dataset,
      label: dataset,
    })) : [];

    const featureOptions = FEATURES_OPTIONS ? FEATURES_OPTIONS.map(feature => ({
      value: feature,
      label: feature,
    })) : [];

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ? 
      `Retrain the model ${modelId} using different datasets and hyperparameters` : 
      'Retrain models using different datasets and hyperparameters';

    // Use queue-based isRunning state
    const isRunningNow = this.state.isRunning;
    const isReady = this.state.modelId && this.state.trainingDataset && this.state.testingDataset;

    // Frozen overlay style for non-admin users
    const frozenOverlayStyle = {
      position: 'relative',
      pointerEvents: isAdmin ? 'auto' : 'none',
      opacity: isAdmin ? 1 : 0.5,
    };

    const overlayMessageStyle = {
      position: 'fixed',
      top: '50%',
      left: 'calc(50% + 125px)',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '24px 32px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      textAlign: 'center',
      border: '2px solid #ff4d4f',
      maxWidth: '500px',
    };

    return (
      <LayoutPage pageTitle="Models Retraining" pageSubTitle={subTitle}>
        {/* Overlay message for non-admin users */}
        {!isAdmin && (
          <div style={overlayMessageStyle}>
            <LockOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px', fontWeight: 600 }}>Administrator Access Required</h3>
            <p style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: 0 }}>
              {isSignedIn ? 'Only administrators can retrain models' : 'Please sign in with administrator privileges to retrain models'}
            </p>
          </div>
        )}
        
        <div style={frozenOverlayStyle}>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Row gutter={16}>
        <Col span={12}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Model & Dataset Selection</h3>
            <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
              Select the model to retrain and choose training/testing datasets
            </span>
          </div>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }} className="bold-labels">
          <Form.Item name="model" label={<strong><span style={{ color: 'red' }}>* </span>Model</strong>}
          > 
            <Tooltip title="Select a model to retrain.">
              <Select
                placeholder="Select a model ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent || isRunningNow}
                onClear={() => this.setState({ 
                  modelDatasets: [], attacksDatasets: [],
                  trainingDataset: null, testingDataset: null  
                })}
                onChange={async (value) => {
                  this.setState({ modelId: value }, async () => {
                    try {
                      if (value) {
                        const modelDatasets = await requestModelDatasets(value);
                        const attacksDatasets = await requestAttacksDatasets(value);
                        this.setState({ modelDatasets, attacksDatasets });
                      } 
                    } catch (error) {
                      console.error("Error loading datasets:", error);
                    }
                  });
                  console.log(`Select model ${value}`);
                }}
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            label={<strong><span style={{ color: 'red' }}>* </span>Training Dataset</strong>} name="trainingDataset"
          >
            <Tooltip title="Select a training dataset.">
              <Select
                placeholder="Select a training dataset ..."
                showSearch allowClear
                disabled={isRunningNow}
                value={this.state.trainingDataset}
                onChange={value => this.setState({ trainingDataset: value })}
                options={trainingDatasetsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            label={<strong><span style={{ color: 'red' }}>* </span>Testing Dataset</strong>} name="testingDataset"
          >
            <Tooltip title="Select a testing dataset.">
              <Select
                placeholder="Select a testing dataset ..."
                showSearch allowClear
                disabled={isRunningNow}
                value={this.state.testingDataset}
                onChange={value => this.setState({ testingDataset: value })}
                options={testingDatasetsOptions}
              />
            </Tooltip>
          </Form.Item>
        </Form>
        </Card>
        </Col>
        
        <Col span={12}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Training Configuration</h3>
            <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
              Configure feature selection and training parameters
            </span>
          </div>
        <Form {...FORM_LAYOUT} name="control-hooks-2" style={{ maxWidth: 700 }} className="bold-labels">
          <Form.Item label={<strong>Feature List</strong>} name="featureList">
            <Tooltip title="Select feature lists used to build models.">
              <Select
                disabled={isRunningNow}
                value={this.state.featureList}
                onChange={value => this.setState({ featureList: value })}
                options={featureOptions}
              />
            </Tooltip>
          </Form.Item>
          
          { this.props.app === 'ad' && (
            <>
              <Divider style={{ margin: '20px 0 16px 0' }}>Training Parameters</Divider>
              
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label={<strong>Epochs (CNN)</strong>} name="nb_epoch_cnn" style={{ marginBottom: '16px' }}>
                    <Tooltip title="In convolutional neural networks (CNN), the number of epochs determines how many times the model will iterate over the training data during the training process.">
                      <InputNumber
                        name="nb_epoch_cnn"
                        disabled={isRunningNow}
                        value={this.state.nb_epoch_cnn}
                        min={1} max={1000} defaultValue={2}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          this.setState({
                            trainingParameters: { ...this.state.trainingParameters, nb_epoch_cnn: v },
                          })
                        }
                      />
                    </Tooltip>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<strong>Batch Size</strong>} name="batch_size_cnn" style={{ marginBottom: '16px' }}>
                    <Tooltip title="Batch size in CNN refers to the number of samples that are processed together in a single forward and backward pass during each epoch of training.">
                      <InputNumber
                        name="batch_size_cnn"
                        disabled={isRunningNow}
                        value={this.state.batch_size_cnn}
                        min={1} max={1000} defaultValue={32}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          this.setState({
                            trainingParameters: { ...this.state.trainingParameters, batch_size_cnn: v },
                          })
                        }
                      />
                    </Tooltip>
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label={<strong>Epochs (SAE)</strong>} name="nb_epoch_sae" style={{ marginBottom: '8px' }}>
                    <Tooltip title="In Stacked Autoencoder (SAE), the number of epochs determines how many times this encoding-decoding process is repeated during training.">
                      <InputNumber
                        name="nb_epoch_sae"
                        disabled={isRunningNow}
                        value={this.state.nb_epoch_sae}
                        min={1} max={1000} defaultValue={5}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          this.setState({
                            trainingParameters: { ...this.state.trainingParameters, nb_epoch_sae: v },
                          })
                        }
                      />
                    </Tooltip>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<strong>Batch Size</strong>} name="batch_size_sae" style={{ marginBottom: '8px' }}>
                    <Tooltip title="Batch size in a SAE determines the number of samples processed together in each training iteration.">
                      <InputNumber
                        name="batch_size_sae"
                        disabled={isRunningNow}
                        value={this.state.batch_size_sae}
                        min={1} max={1000} defaultValue={16}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          this.setState({
                            trainingParameters: { ...this.state.trainingParameters, batch_size_sae: v },
                          })
                        }
                      />
                    </Tooltip>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: 24 }}>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              loading={isRunningNow}
              onClick={ this.handleButtonRetrain } 
              disabled={ isRunningNow || !isReady }
            >
              Retrain Model
            </Button>
            <Button
              type="primary"
              disabled={!this.state.retrainId}
              onClick={() => {
                const originalModelId = this.state.modelId;
                const retrainId = this.state.retrainId;
                window.location.href = `/models/comparison?model1=${originalModelId}&model2=${retrainId}`;
              }}
            >
              Compare with Original Model
            </Button>
          </div>
        </Form>
        </Card>
        </Col>
        </Row>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Retraining Results</h2>
        </Divider>
        
        <Card style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>Retraining Summary</strong>
          </div>
          <Row gutter={12}>
            <Col span={6}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Status"
                  value={
                    isRunningNow ? 'Retraining' : 
                    this.state.retrainId ? 'Completed' :
                    isReady ? 'Ready' : 'Waiting'
                  }
                  valueStyle={{ 
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: isRunningNow ? '#1890ff' : 
                           this.state.retrainId ? '#52c41a' :
                           isReady ? '#52c41a' : '#faad14'
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Model Type"
                  value={this.props.app === 'ad' ? 'Anomaly Detection' : 'Attack Classification'}
                  valueStyle={{ fontSize: 14, fontWeight: 'bold', color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Original Model"
                  value={this.state.modelId || 'Not Selected'}
                  valueStyle={{ fontSize: 14, fontWeight: 'bold', color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Retrain ID"
                  value={this.state.retrainId || 'N/A'}
                  valueStyle={{ 
                    fontSize: 13, 
                    fontWeight: 'bold',
                    color: this.state.retrainId ? '#52c41a' : '#d9d9d9',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                />
              </Card>
            </Col>
          </Row>
        </Card>
        </div>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, retrainStatus, retrainACStatus }) => ({
  app, models, retrainStatus, retrainACStatus
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchRetrainStatus: () => dispatch(requestRetrainStatus()),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
  fetchRetrainStatusAC: () => dispatch(requestRetrainStatusAC()),
  fetchRetrainModelAC: (modelId, trainingDataset, testingDataset) =>
    dispatch(requestRetrainModelAC({ modelId, trainingDataset, testingDataset })),
});

// Wrap with role check
const RetrainPageWithRole = (props) => {
  const userRole = useUserRole();
  return <RetrainPage {...props} isAdmin={userRole.isAdmin} isSignedIn={userRole.isSignedIn} />;
};

export default connect(mapPropsToStates, mapDispatchToProps)(RetrainPageWithRole);
