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
  FORM_LAYOUT,
  SERVER_URL,
  FEATURES_OPTIONS,
} from "../constants";
import { 
  getLastPath,
  getFilteredModelsOptions,
  isACModel,
} from "../utils";
const { Panel } = Collapse;

let modelDatasets = [];
let attacksDatasets = [];
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
      isRunning: props.retrainStatus.isRunning,
      isRunningAC: props.retrainACStatus.isRunning,
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleButtonRetrain = this.handleButtonRetrain.bind(this);
    this.handleButtonRetrainAC = this.handleButtonRetrainAC.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.fetchModelDatasets();
    this.fetchAttacksDatasets();
    this.props.fetchAllModels(); 
    this.props.fetchApp();
  }

  fetchModelDatasets = async () => {
    const { modelId } = this.state;
    let fetchModelId = isModelIdPresent ? getLastPath() : modelId;
    try {
      const response = await fetch(`${SERVER_URL}/api/models/${fetchModelId}/datasets`);
      const data = await response.json();
      modelDatasets = data.datasets;
      this.setState({ modelDatasets });
      console.log(modelDatasets);
    } catch (error) {
      console.error('Error fetching model datasets:', error);
    }
  };

  fetchAttacksDatasets = async () => {
    const { modelId } = this.state; 
    let fetchModelId = isModelIdPresent ? getLastPath() : modelId;
    try {
      const response = await fetch(`${SERVER_URL}/api/attacks/${fetchModelId}/datasets`);
      const data = await response.json();
      attacksDatasets = data.datasets;
      this.setState({ attacksDatasets });
      console.log(attacksDatasets);
    } catch (error) {
      console.error('Error fetching attacks datasets:', error);
    }
  };

  handleButtonRetrain() {
    const { modelId } = this.state;
    let fetchModelId = isModelIdPresent ? getLastPath() : modelId;
    console.log(modelId);
    const { 
      trainingDataset, 
      testingDataset, 
      trainingParameters,
      isRunning,
    } = this.state;
    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });        
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchRetrainStatus();
      }, 2000);
      const retrainConfig = {
        retrainConfig: {
          modelId: fetchModelId,
          trainingDataset,
          testingDataset,
          training_parameters: trainingParameters,
        }
      };
      console.log(retrainConfig);
      this.props.fetchRetrainModel(
        modelId, trainingDataset, testingDataset, trainingParameters,
      );
    }    
  }

  handleButtonRetrainAC() {
    const { modelId } = this.state;
    let fetchModelId = isModelIdPresent ? getLastPath() : modelId;
    console.log(modelId);
    const { 
      trainingDataset, 
      testingDataset, 
      isRunningAC,
    } = this.state;
    if (!isRunningAC) {
      console.log("update isRunningAC state!");
      this.setState({ isRunningAC: true });        
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchRetrainStatusAC();
      }, 2000);
      const retrainConfig = {
        retrainConfig: {
          modelId: fetchModelId,
          trainingDataset,
          testingDataset,
        }
      };
      console.log(retrainConfig);
      this.props.fetchRetrainModelAC(
        modelId, trainingDataset, testingDataset,
      );
    }    
  }

  componentDidUpdate(prevProps, prevState) {
    //console.log(`retrainStatus: ${retrainStatus.isRunning}`);
    //console.log(`retrain isRunning: ${isRunning}`);
    if (prevProps.retrainStatus.isRunning !== this.props.retrainStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.retrainStatus.isRunning });
      if (!this.props.retrainStatus.isRunning) {
        //console.log('isRunning changed from True to False');  
        clearInterval(this.intervalId);
      }
    }

    if (prevProps.retrainACStatus.isRunning !== this.props.retrainACStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunningAC: this.props.retrainACStatus.isRunning });
      if (!this.props.retrainACStatus.isRunning) {
        //console.log('isRunning changed from True to False');  
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
    const { modelId, modelDatasets, attacksDatasets, isRunning, isRunningAC } = this.state;
    const { app, models, retrainStatus } = this.props;
    const allDatasets = [...modelDatasets, ...attacksDatasets];

    const trainingDatasetsOptions = allDatasets ? allDatasets.map(dataset => ({
      value: dataset,
      label: dataset,
    })) : [];
    const testingDatasetsOptions = modelDatasets ? modelDatasets.map(dataset => ({
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
                onChange={(value) => {
                  this.setState({ modelId: value }, () => {
                    this.fetchModelDatasets();
                    this.fetchAttacksDatasets();
                  });
                  console.log(`Select model ${value}`);
                }}
                //optionLabelProp="label"
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
              onClick={ this.props.app === 'ac'? this.handleButtonRetrainAC : this.handleButtonRetrain } 
              disabled={ (this.props.app === 'ac'? isRunningAC : isRunning) || !this.state.modelId || 
                !(this.state.trainingDataset && this.state.testingDataset)
              }
            >
              Retrain model
              {((this.props.app === 'ac'? isRunningAC : isRunning)) && 
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
