import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Tooltip, message, Upload, Spin, Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { Collapse } from 'antd';
import {
  requestBuildModel,
  requestBuildStatus,
  requestAllReports,
} from "../actions";
import {
  SERVER_URL,
} from "../constants";
import { useNavigate } from "react-router";

const { Panel } = Collapse;

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

// TODO: add Spin, continuously check buildingStatus, if done, jump to ModelsPage

class BuildPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attackDataset: "",
      attackPcap: "",
      normalDataset: "",
      normalPcap: "",
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
    //this.props.fetchBuildModel();
    this.props.fetchAllReports();
    //this.props.fetchBuildStatus();
  }

  handleButtonBuild(values) {
    const { 
      attackDataset, 
      normalDataset, 
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
        training_ratio,
        training_parameters,
      }
    };
    //console.log(this.state);
    console.log(buildConfig);
  }

  handleInputChange = (name, value) => {
    this.setState({
      [name]: value,
    });
  };

  render() {
    const { reports } = this.props;
    //console.log(reports);

    const props = {
      beforeUpload: (file) => {
        const isPCAP = file.name.endsWith('.pcap');
        console.log(file.name.endsWith('.pcap'));
        if (!isPCAP) {
          message.error(`${file.name} is not a pcap file`);
        }
        return isPCAP ? true : Upload.LIST_IGNORE;
      },
      // TODO: fix bugs ?
      onChange: async (info) => {
        const { status, response, name } = info.file;
        console.log({ status, response, name });

        if (status === 'done') {
          const formData = new FormData();
          formData.append('fileName', name);
          formData.append('file', info.file.originFileObj);

          try {
            const response = await fetch(`{SERVER_URL}/api/mmt/upload`, {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const data = await response.json();
              console.log(data);
            } else {
              const error = await response.text();
              console.error(error);
            }
          } catch (error) {
            console.error(error);
          }
        } else if (status === 'error') {
          console.error('File upload failed');
        }
      },
    };

    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    // TODO: disable button Upload pcaps if users selected already datasets and vice versa
    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="">
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
            <Tooltip title="Select MMT's analyzing reports of malware traffic.">
              <Select
                /*placeholder="Select an attack dataset"*/
                showSearch allowClear
                value={this.state.attackDataset}
                onChange={(value) => {
                  this.setState({ attackDataset: value });
                }}
                options={reportsOptions}
              />
            </Tooltip>
            <Upload {...props}>
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item label="Normal Dataset" name="normalDataset"
            rules={[
              {
                required: true,
                message: 'Please select a normal dataset!',
              },
            ]}
          >
            <Tooltip title="Select MMT's analyzing reports of normal traffic.">
              <Select
                /*placeholder="Select a normal dataset"*/
                value={this.state.normalDataset}
                onChange={value => this.setState({ normalDataset: value })}
                options={reportsOptions}
              />
            </Tooltip>
            <Upload {...props}>
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item label="Training Ratio" name="training_ratio">
            <Tooltip title="The training ratio refers to the proportion of data used for training a machine learning model compared to the total dataset. The training ratio is 0.7, meaning 70% for training and 30% for testing/validation.">
              <InputNumber
                name="training_ratio"
                value={this.state.training_ratio}
                min={0} max={1} step={0.1} defaultValue={0.7}
                onChange={(v) => this.setState({ training_ratio: v })}
              />
            </Tooltip>
          </Form.Item>
          <Collapse>
            <Panel header="Training Parameters">
              <Form.Item label="Number of Epochs (CNN)" name="nb_epoch_cnn">
                <Tooltip title="In convolutional neural networks (CNN), the number of epochs determines how many times the model will iterate over the training data during the training process.">
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
                </Tooltip>
              </Form.Item>
              <Form.Item label="Number of Epochs (SAE)" name="nb_epoch_sae">
                <Tooltip title="In Stacked Autoencoder (SAE), the number of epochs determines how many times this encoding-decoding process is repeated during training.">
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
                </Tooltip>
              </Form.Item>
              <Form.Item label="Batch Size (CNN)" name="batch_size_cnn">
                <Tooltip title="Batch size in CNN refers to the number of samples that are processed together in a single forward and backward pass during each epoch of training. The training dataset is divided into smaller batches, and the model's parameters are updated based on the average gradients computed from each batch.">
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
                </Tooltip>
              </Form.Item>
              <Form.Item label="Batch Size (SAE)" name="batch_size_sae">
                <Tooltip title="Batch size in a SAE determines the number of samples processed together in each training iteration.">
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
                </Tooltip>
              </Form.Item>
            </Panel>
          </Collapse>
          <div style={{ textAlign: 'center' }}>
            <Button
              style={{ marginTop: '16px' }}
              disabled={!this.state.attackDataset || !this.state.normalDataset}
              onClick={() => {
                this.handleButtonBuild(this.state);
                const { 
                  attackDataset, 
                  normalDataset, 
                  training_ratio, 
                  training_parameters,
                } = this.state;
            
                const datasets = [
                  { datasetId: attackDataset, isAttack: true },
                  { datasetId: normalDataset, isAttack: false },
                ];
                this.props.fetchBuildModel(datasets, training_ratio, training_parameters);
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
  fetchBuildModel: (datasets, ratio, params) =>
    dispatch(requestBuildModel({ datasets, ratio, params })),
  fetchAllReports: () => dispatch(requestAllReports()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildPage);
