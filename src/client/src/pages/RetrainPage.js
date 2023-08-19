import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { connect } from "react-redux";
import { Collapse, Spin, Tooltip, Button, InputNumber, Form, Select } from 'antd';
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
const { Panel } = Collapse;

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

  handleButtonRetrain() {
    const { modelId, trainingDataset, testingDataset, trainingParameters, isRunning } = this.state;
    
    if (!isRunning) {
      const fetchModelId = isModelIdPresent ? getLastPath() : modelId;
      
      this.setState({ isRunning: true });        
      this.intervalId = setInterval(() => { 
        isACApp(this.props.app) ? this.props.fetchRetrainStatusAC() : this.props.fetchRetrainStatus();
      }, 2000);
      
      const retrainConfig = isACApp(this.props.app) ? 
        { retrainConfig: { modelId: fetchModelId, trainingDataset, testingDataset } } :
        { retrainConfig: { modelId: fetchModelId, trainingDataset, testingDataset, training_parameters: trainingParameters } };
      console.log(retrainConfig);
      
      isACApp(this.props.app) ? 
        this.props.fetchRetrainModelAC(modelId, trainingDataset, testingDataset) :
        this.props.fetchRetrainModel(modelId, trainingDataset, testingDataset, trainingParameters);
    }
  }

  componentDidUpdate(prevProps) {
    const isRunningProp = isACApp(this.props.app) ? 
                            this.props.retrainACStatus.isRunning : 
                            this.props.retrainStatus.isRunning;
    
    if (prevProps.retrainStatus.isRunning !== isRunningProp || 
        prevProps.retrainACStatus.isRunning !== isRunningProp) {
      this.setState({ isRunning: isRunningProp });
      if (!isRunningProp) {
        clearInterval(this.intervalId);
      }
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
    const { app, models } = this.props;
    let allDatasets = [];
    let trainingDatasetsOptions = [], testingDatasetsOptions = []; 
    if (modelDatasets.length && attacksDatasets.length) {
      allDatasets = [...modelDatasets, ...attacksDatasets];
      trainingDatasetsOptions = allDatasets ? allDatasets.map(dataset => ({
        value: dataset,
        label: dataset,
      })) : [];
      testingDatasetsOptions = modelDatasets ? modelDatasets.map(dataset => ({
        value: dataset,
        label: dataset,
      })) : [];
    }

    const featureOptions = FEATURES_OPTIONS ? FEATURES_OPTIONS.map(feature => ({
      value: feature,
      label: feature,
    })) : [];

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ? 
      `Retrain the model ${modelId} using different datasets and hyperparameters` : 
      'Retrain models using different datasets and hyperparameters';

    return (
      <LayoutPage pageTitle="Models Retraining" pageSubTitle={subTitle}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
          <Form.Item name="model" label="Model" 
            rules={[
              {
                required: true,
                message: 'Please select a model!',
              },
            ]}
          > 
            <Tooltip title="Select a model to retrain.">
              <Select
                placeholder="Select a model ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={async (value) => {
                  this.setState({ modelId: value }, async () => {
                    try {
                      const modelDatasets = await requestModelDatasets(value);
                      const attacksDatasets = await requestAttacksDatasets(value);
                      this.setState({
                        modelDatasets,
                        attacksDatasets
                      });
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
            label="Training Dataset" name="trainingDataset"
            rules={[
              {
                required: true,
                message: 'Please enter a training dataset!',
              },
            ]}
          >
            <Tooltip title="Select a training dataset.">
              <Select
                placeholder="Select a training dataset ..."
                showSearch allowClear
                value={this.state.trainingDataset}
                onChange={value => this.setState({ trainingDataset: value })}
                options={trainingDatasetsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            label="Testing Dataset" name="testingDataset"
            rules={[
              {
                required: true,
                message: 'Please enter a testing dataset!',
              },
            ]}
          >
            <Tooltip title="Select a testing dataset.">
              <Select
                placeholder="Select a testing dataset ..."
                showSearch allowClear
                value={this.state.testingDataset}
                onChange={value => this.setState({ testingDataset: value })}
                options={testingDatasetsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item label="Feature List" name="featureList">
            <Tooltip title="Select feature lists used to build models.">
              <Select
                //showSearch allowClear
                //placeholder="Select features ..."
                value={this.state.featureList}
                onChange={value => this.setState({ featureList: value })}
                options={featureOptions}
              />
            </Tooltip>
          </Form.Item>
          { this.props.app === 'ad' && (
            <Collapse>
              <Panel header="Training Parameters">
                <Form.Item
                  label="Number of Epochs (CNN)"
                  name="nb_epoch_cnn"
                >
                  <InputNumber
                    name="nb_epoch_cnn"
                    value={this.state.nb_epoch_cnn}
                    min={1} max={1000} defaultValue={2}
                    onChange={(v) =>
                      this.setState({
                        trainingParameters: { ...this.state.trainingParameters, nb_epoch_cnn: v },
                      })
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="Number of Epochs (SAE)"
                  name="nb_epoch_sae"
                >
                  <InputNumber
                    name="nb_epoch_sae"
                    value={this.state.nb_epoch_sae}
                    min={1} max={1000} defaultValue={5}
                    onChange={(v) =>
                      this.setState({
                        trainingParameters: { ...this.state.trainingParameters, nb_epoch_sae: v },
                      })
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="Batch Size (CNN)"
                  name="batch_size_cnn"
                >
                  <InputNumber
                    name="batch_size_cnn"
                    value={this.state.batch_size_cnn}
                    min={1} max={1000} defaultValue={32}
                    onChange={(v) =>
                      this.setState({
                        trainingParameters: { ...this.state.trainingParameters, batch_size_cnn: v },
                      })
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="Batch Size (SAE)"
                  name="batch_size_sae"
                >
                  <InputNumber
                    name="batch_size_sae"
                    value={this.state.batch_size_sae}
                    min={1} max={1000} defaultValue={16}
                    onChange={(v) =>
                      this.setState({
                        trainingParameters: { ...this.state.trainingParameters, batch_size_sae: v },
                      })
                    }
                  />
                </Form.Item>
              </Panel>
            </Collapse>
          )}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Button
              type="primary"
              onClick={ this.handleButtonRetrain } 
              disabled={ isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus) || 
                !this.state.modelId || !(this.state.trainingDataset && this.state.testingDataset)
              }
            >
              Retrain model
              {isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus) && 
                <Spin size="large" style={{ marginBottom: '8px' }}>
                  <div className="content" />
                </Spin>
              }
            </Button>
          </div>
        </Form>
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

export default connect(mapPropsToStates, mapDispatchToProps)(RetrainPage);
