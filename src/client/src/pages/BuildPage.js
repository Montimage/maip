import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { Collapse } from 'antd';
import {
  requestBuildModel,
  requestBuildStatus,
  requestAllReports,
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
      total_samples: 10000,
      training_ratio: 0.7,
      training_parameters: {
        nb_epoch_cnn: 2,
        nb_epoch_sae: 5,
        batch_size_cnn: 32,
        batch_size_sae: 16,
      },
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleButtonBuild = this.handleButtonBuild.bind(this);
  }

  componentDidMount() {
    this.props.fetchBuildModel();
    this.props.fetchAllReports();
    this.props.fetchBuildStatus();
  }

  handleButtonBuild(values) {
    const { 
      attackDataset, 
      normalDataset, 
      total_samples, 
      training_ratio, 
      training_parameters,
    } = this.state;

    const datasets = [
      { datasetId: attackDataset, isAttack: true },
      { datasetId: normalDataset, isAttack: false },
    ];

    const buildConfig = {
      buildConfig: {
        datasets,
        total_samples,
        training_ratio,
        training_parameters,
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
    const { reports } = this.props;
    console.log(reports);

    const reportsOptions = reports.map(report => ({
      value: report,
      label: report,
    }));

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
                message: 'Please select an attack dataset!',
              },
            ]}
          >
            <Select
              placeholder="Select an attack dataset"
              value={this.state.attackDataset}
              onChange={value => this.setState({ attackDataset: value })}
              options={reportsOptions}
            />
          </Form.Item>
          <Form.Item
            label="Normal Dataset"
            name="normalDataset"
            rules={[
              {
                required: true,
                message: 'Please select a normal dataset!',
              },
            ]}
          >
            <Select
              placeholder="Select a normal dataset"
              value={this.state.normalDataset}
              onChange={value => this.setState({ normalDataset: value })}
              options={reportsOptions}
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
              value={this.state.total_samples}
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
              value={this.state.training_ratio}
              min={0} max={1} step={0.1} defaultValue={0.7}
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
                      training_parameters: { ...this.state.training_parameters, nb_epoch_cnn: v },
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
                      training_parameters: { ...this.state.training_parameters, nb_epoch_sae: v },
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
                      training_parameters: { ...this.state.training_parameters, batch_size_cnn: v },
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
                      training_parameters: { ...this.state.training_parameters, batch_size_sae: v },
                    })
                  }
                />
              </Form.Item>
            </Panel>
          </Collapse>
          <div style={{ textAlign: 'center' }}>
            <Button
              style={{ marginTop: '16px' }}
              onClick={() => {
                this.handleButtonBuild(this.state);
                const { 
                  attackDataset, 
                  normalDataset, 
                  total_samples, 
                  training_ratio, 
                  training_parameters,
                } = this.state;
            
                const datasets = [
                  { datasetId: attackDataset, isAttack: true },
                  { datasetId: normalDataset, isAttack: false },
                ];
                this.props.fetchBuildModel(datasets, total_samples, training_ratio, training_parameters);
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

const mapPropsToStates = ({ build, reports }) => ({
  build, reports,
});

const mapDispatchToProps = (dispatch) => ({
  fetchBuildStatus: () => dispatch(requestBuildStatus()),
  fetchBuildModel: (datasets, totalSamples, ratio, params) =>
    dispatch(requestBuildModel({ datasets, totalSamples, ratio, params })),
  fetchAllReports: () => dispatch(requestAllReports()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildPage);
