import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { Collapse } from 'antd';
import {
  requestRetrainModel,
  requestBuildStatus,
} from "../actions";

const { Panel } = Collapse;

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

class RetrainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
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
    this.props.fetchRetrainModel();
    this.props.fetchBuildStatus();
  }

  handleButtonRetrain(values) {
    const modelId = getLastPath();
    console.log(modelId);
    const { 
      trainingDataset, 
      testingDataset, 
      trainingParameters,
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
    return (
      <LayoutPage pageTitle="Retrain Page" pageSubTitle={`Retrain model ${modelId}`}>
        <Form
          {...layout}
          style={{
            maxWidth: 700,
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
            <Input
              name="trainingDataset"
              value={this.state.trainingDataset}
              onChange={this.handleInputChange}
            />
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
            <Input
              name="testingDataset"
              value={this.state.testingDataset}
              onChange={this.handleInputChange}
            />
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
          <div style={{ textAlign: 'center' }}>
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
