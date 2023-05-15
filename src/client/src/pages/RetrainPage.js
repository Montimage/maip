import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Tooltip, Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { Collapse } from 'antd';
import {
  requestRetrainModel,
  requestBuildStatus,
} from "../actions";
import {
  SERVER_URL,
} from "../constants";
const { Panel } = Collapse;

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

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
      trainingParameters: {
        nb_epoch_cnn: 2,
        nb_epoch_sae: 5,
        batch_size_cnn: 32,
        batch_size_sae: 16,
      },
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
      modelDatasets,
      attacksDatasets,
    } = this.state;

    const retrainConfig = {
      retrainConfig: {
        modelId: modelId,
        trainingDataset,
        testingDataset,
        training_parameters: trainingParameters,
      }
    };
    console.log(retrainConfig);
  }

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  render() {
    const modelId = getLastPath();

    const { modelDatasets, attacksDatasets } = this.state;
    const allDatasets = [...modelDatasets, ...attacksDatasets];

    const trainingDatasetsOptions = allDatasets ? allDatasets.map(dataset => ({
      value: dataset,
      label: dataset,
    })) : [];
    const testingDatasetsOptions = modelDatasets ? modelDatasets.map(dataset => ({
      value: dataset,
      label: dataset,
    })) : [];

    return (
      <LayoutPage pageTitle="Retrain Page" pageSubTitle={`Retrain model ${modelId}`}>
        <Form
          {...layout}
          style={{
            maxWidth: 600,
          }}>
          <Form.Item
            label="Training Dataset"
            name="trainingDataset"
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
                onChange={(value) => {
                  this.setState({ trainingDataset: value });
                }}
                options={trainingDatasetsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            label="Testing Dataset"
            name="testingDataset"
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
                onChange={(value) => {
                  this.setState({ testingDataset: value });
                }}
                options={testingDatasetsOptions}
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
              onClick={() => {
                this.handleButtonRetrain(this.state);
                const {
                  trainingDataset, 
                  testingDataset, 
                  trainingParameters,
                } = this.state;
                this.props.fetchRetrainModel(
                  modelId, trainingDataset, testingDataset, trainingParameters,
                );
              }}
            >
              Retrain model
            </Button>
          </div>
        </Form>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ build }) => ({
  build,
});

const mapDispatchToProps = (dispatch) => ({
  fetchBuildStatus: () => dispatch(requestBuildStatus()),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(RetrainPage);
