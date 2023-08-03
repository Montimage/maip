import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { connect } from "react-redux";
import { Collapse, Spin, Tooltip, Button, InputNumber, Form, Select } from 'antd';
import {
  requestRetrainModel,
  requestRetrainStatus,
} from "../actions";
import {
  FORM_LAYOUT,
  SERVER_URL,
  FEATURES_OPTIONS,
} from "../constants";
const { Panel } = Collapse;

let modelDatasets = [];
let attacksDatasets = [];

class RetrainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelDatasets: [],
      attacksDatasets: [],
      trainingDataset: "",
      testingDataset: "",
      featureList: "Raw Features",
      trainingParameters: {
        nb_epoch_cnn: 2,
        nb_epoch_sae: 5,
        batch_size_cnn: 32,
        batch_size_sae: 16,
      },
      isRunning: props.retrainStatus.isRunning,
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleButtonRetrain = this.handleButtonRetrain.bind(this);
  }

  componentDidMount() {
    this.fetchModelDatasets();
    this.fetchAttacksDatasets();
  }

  fetchModelDatasets = async () => {
    const modelId = getLastPath();
    try {
      const response = await fetch(`${SERVER_URL}/api/models/${modelId}/datasets`);
      const data = await response.json();
      modelDatasets = data.datasets;
      this.setState({ modelDatasets });
      console.log(modelDatasets);
    } catch (error) {
      console.error('Error fetching model datasets:', error);
    }
  };

  fetchAttacksDatasets = async () => {
    const modelId = getLastPath();
    try {
      const response = await fetch(`${SERVER_URL}/api/attacks/${modelId}/datasets`);
      const data = await response.json();
      attacksDatasets = data.datasets;
      this.setState({ attacksDatasets });
      console.log(attacksDatasets);
    } catch (error) {
      console.error('Error fetching attacks datasets:', error);
    }
  };

  handleButtonRetrain(values) {
    const modelId = getLastPath();
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
          modelId: modelId,
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
  }

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  render() {
    const modelId = getLastPath();
    //console.log(`retrainStatus: ${retrainStatus}`);
    const { modelDatasets, attacksDatasets, isRunning } = this.state;
    //console.log(`retrain isRunning: ${isRunning}`);
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

    return (
      <LayoutPage pageTitle="Retrain Page" pageSubTitle={`Retrain model ${modelId}`}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
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
                value={this.state.featureList}
                onChange={value => this.setState({ featureList: value })}
                options={featureOptions}
              />
            </Tooltip>
          </Form.Item>
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
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Button
              type="primary"
              onClick={this.handleButtonRetrain} 
              disabled={ isRunning || 
                !(this.state.trainingDataset && this.state.testingDataset)
              }
            >
              Retrain model
              {isRunning && 
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

const mapPropsToStates = ({ retrainStatus }) => ({
  retrainStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchRetrainStatus: () => dispatch(requestRetrainStatus()),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(RetrainPage);
