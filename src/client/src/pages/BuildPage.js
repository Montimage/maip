import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { Collapse } from 'antd';
import {
  requestBuildModel,
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

class BuildPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attackDataset: "",
      normalDataset: "",
      totalSamples: 10000,
      trainingRatio: 0.7,
      trainingParameters: {
        nbEpochCnn: 2,
        nbEpochSae: 5,
        batchSizeCnn: 32,
        batchSizeSae: 16,
      },
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleButtonBuild = this.handleButtonBuild.bind(this);
  }

  componentDidMount() {
    this.props.fetchBuildModel();
    this.props.fetchBuildStatus();
  }

  handleButtonBuild(values) {
    const { 
      attackDataset, 
      normalDataset, 
      totalSamples, 
      trainingRatio, 
      trainingParameters,
    } = this.state;

    const datasets = [
      { datasetId: attackDataset, isAttack: true },
      { datasetId: normalDataset, isAttack: false },
    ];

    const buildConfig = {
      buildConfig: {
        datasets,
        total_samples: totalSamples,
        training_ratio: trainingRatio,
        training_parameters: trainingParameters,
      }
    };
    //console.log(this.state);
    console.log(buildConfig);
  }

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  render() {
    return (
      <LayoutPage pageTitle="Build Page" pageSubTitle="">
        <Form
          {...layout}
          style={{
            maxWidth: 700,
          }}>
          <Form.Item
            label="Attack Dataset"
            name="attackDataset"
            rules={[
              {
                required: true,
                message: 'Please enter an attack dataset!',
              },
            ]}
          >
            <Input
              name="attackDataset"
              value={this.state.attackDataset}
              onChange={this.handleInputChange}
            />
          </Form.Item>
          <Form.Item
            label="Normal Dataset"
            name="normalDataset"
            rules={[
              {
                required: true,
                message: 'Please enter a normal dataset!',
              },
            ]}
          >
            <Input
              name="normalDataset"
              value={this.state.normalDataset}
              onChange={this.handleInputChange}
            />
          </Form.Item>
          <Form.Item
            label="Total Samples"
            name="total_samples"
            /* TODO: message is still appeared even with defaultValue */
            /* rules={[
              {
                required: true,
                message: 'Please enter total samples!',
              },
            ]} */
          >
            <InputNumber
              name="total_samples"
              value={this.state.totalSamples}
              min={1} defaultValue={10000}
              onChange={this.handleInputChange}
            />
          </Form.Item>
          <Form.Item
            label="Training Ratio"
            name="training_ratio"
            /* rules={[
              {
                required: true,
                message: 'Please enter training ratio!',
              },
            ]} */
          >
            <InputNumber
              name="training_ratio"
              value={this.state.trainingRatio}
              min={0} max={1} step={0.1} defaultValue={0.7}
              onChange={(v) => this.setState({ trainingRatio: v })}
            />
          </Form.Item>
          <Collapse>
            <Panel header="Training Parameters">
              <Form.Item
                label="Number of Epochs (CNN)"
                name="nbEpochCnn"
              >
                <InputNumber
                  name="nbEpochCnn"
                  value={this.state.nbEpochCnn}
                  min={1} max={1000} defaultValue={2}
                  onChange={(v) =>
                    this.setState({
                      trainingParameters: { ...this.state.trainingParameters, nbEpochCnn: v },
                    })
                  }
                />
              </Form.Item>
              <Form.Item
                label="Number of Epochs (SAE)"
                name="nbEpochSae"
              >
                <InputNumber
                  name="nbEpochSae"
                  value={this.state.nbEpochSae}
                  min={1} max={1000} defaultValue={5}
                  onChange={(v) =>
                    this.setState({
                      trainingParameters: { ...this.state.trainingParameters, nbEpochSae: v },
                    })
                  }
                />
              </Form.Item>
              <Form.Item
                label="Batch Size (CNN)"
                name="batch_size_cnn"
              >
                <InputNumber
                  name="batchSizeCnn"
                  value={this.state.batchSizeCnn}
                  min={1} max={1000} defaultValue={32}
                  onChange={(v) =>
                    this.setState({
                      trainingParameters: { ...this.state.trainingParameters, batchSizeCnn: v },
                    })
                  }
                />
              </Form.Item>
              <Form.Item
                label="Batch Size (SAE)"
                name="batchSizeSae"
              >
                <InputNumber
                  name="batchSizeSae"
                  value={this.state.batchSizeSae}
                  min={1} max={1000} defaultValue={16}
                  onChange={(v) =>
                    this.setState({
                      trainingParameters: { ...this.state.trainingParameters, batchSizeSae: v },
                    })
                  }
                />
              </Form.Item>
            </Panel>
          </Collapse>
          <div style={{ textAlign: 'center' }}>
            <Button
              onClick={() => {
                this.handleButtonBuild(this.state);
                const { 
                  attackDataset, 
                  normalDataset, 
                  totalSamples, 
                  trainingRatio, 
                  trainingParameters,
                } = this.state;
            
                const datasets = [
                  { datasetId: attackDataset, isAttack: true },
                  { datasetId: normalDataset, isAttack: false },
                ];
                this.props.fetchBuildModel(datasets, totalSamples, trainingRatio, trainingParameters);
              }}
            >
              Build model
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
  fetchBuildModel: (datasets, totalSamples, ratio, params) =>
    dispatch(requestBuildModel({ datasets, totalSamples, ratio, params })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildPage);
