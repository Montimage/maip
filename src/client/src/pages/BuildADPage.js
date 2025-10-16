import React, { Component, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPage from './LayoutPage';
import { connect } from "react-redux";
import { Row, Col, Tooltip, message, notification, Upload, Spin, Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import { UploadOutlined, RocketOutlined } from "@ant-design/icons";
import { Collapse } from 'antd';
import {
  requestMMTStatus,
  requestBuildModel,
  requestBuildStatus,
  requestAllReports,
} from "../actions";
import {
  FORM_LAYOUT,
  SERVER_URL,
  FEATURES_OPTIONS,
} from "../constants";

const { Panel } = Collapse;

class BuildADPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attackDataset: null,
      attackPcapFile: null,
      normalDataset: null,
      normalPcapFile: null,
      featureList: "Raw Features",
      training_ratio: 0.7,
      training_parameters: {
        nb_epoch_cnn: 5,
        nb_epoch_sae: 3,
        batch_size_cnn: 16,
        batch_size_sae: 32,
      },
      isRunning: props.buildStatus.isRunning,
    };
    this.handleButtonBuild = this.handleButtonBuild.bind(this);
  }

  componentDidMount() {
    this.props.fetchAllReports();
  }

  async requestMMTStatus() {
    const url = `${SERVER_URL}/api/mmt`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw data.error;
    }
    console.log(data.mmtStatus);
    return data.mmtStatus;
  };

  async requestMMTOffline(file) {
    const url = `${SERVER_URL}/api/mmt/offline`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: file }),
    });
    const data = await response.json();
    console.log(`MMT offline analysis of pcap file ${file}`);
    return data;
  }

  async handleButtonBuild() {
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const {
      attackDataset,
      normalDataset,
      attackPcapFile,
      normalPcapFile,
      training_ratio,
      training_parameters,
      isRunning,
    } = this.state;
    const { mmtStatus } = this.props;
    console.log(`mmtStatus: ${mmtStatus.isRunning}`);
    let datasets = null;
    if (!isRunning) {
      console.log("update isRunning state!");
      
      // Disable button and show spinner immediately
      this.setState({ isRunning: true });
      
      try {

      if (attackDataset && normalDataset) {
        datasets = [
          { datasetId: attackDataset, isAttack: true },
          { datasetId: normalDataset, isAttack: false },
        ];
      } else if (attackPcapFile && normalPcapFile) {
        // Start MMT for attack pcap and wait until completion
        const startAttack = await this.requestMMTOffline(attackPcapFile);
        if (!startAttack || !startAttack.sessionId) {
          console.error('Failed to start MMT for attack pcap');
          return;
        }
        {
          const targetSessionId = startAttack.sessionId;
          const maxAttempts = 60; // ~2 minutes
          const intervalMs = 2000;
          let attempt = 0;
          while (attempt < maxAttempts) {
            const status = await this.requestMMTStatus();
            if (!status.isRunning && status.sessionId === targetSessionId) break;
            await delay(intervalMs);
            attempt += 1;
          }
          this.setState({ attackDataset: `report-${targetSessionId}` });
        }

        // Start MMT for normal pcap and wait until completion
        const startNormal = await this.requestMMTOffline(normalPcapFile);
        if (!startNormal || !startNormal.sessionId) {
          console.error('Failed to start MMT for normal pcap');
          return;
        }
        {
          const targetSessionId = startNormal.sessionId;
          const maxAttempts = 60; // ~2 minutes
          const intervalMs = 2000;
          let attempt = 0;
          while (attempt < maxAttempts) {
            const status = await this.requestMMTStatus();
            if (!status.isRunning && status.sessionId === targetSessionId) break;
            await delay(intervalMs);
            attempt += 1;
          }
          this.setState({ normalDataset: `report-${targetSessionId}` });
        }

        const { attackDataset, normalDataset } = this.state;
        console.log({ attackDataset, normalDataset });

        datasets = [
          { datasetId: attackDataset, isAttack: true },
          { datasetId: normalDataset, isAttack: false },
        ];
      }

        if (!datasets) {
          console.error('No valid datasets or pcap files provided');
          this.setState({ isRunning: false });
          return;
        }
        
        // Start polling for build status
        this.intervalId = setInterval(() => {
          this.props.fetchBuildStatus();
        }, 5000);
        
        const buildConfig = {
          buildConfig: {
            datasets,
            training_ratio,
            training_parameters,
          }
        };
        console.log(buildConfig);

        // Dispatch build model action
        this.props.fetchBuildModel(datasets, training_ratio, training_parameters);
        // isRunning is already set to true at the beginning
        
      } catch (error) {
        console.error('Error during model building:', error);
        notification.error({
          message: 'Build Failed',
          description: error.message || 'An error occurred while building the model.',
          placement: 'topRight',
        });
        this.setState({ isRunning: false });
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }
      }
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const { isRunning } = this.state;
    const { buildStatus } = this.props;
    console.log(`buildStatus: ${buildStatus.isRunning}`);
    console.log(`build isRunning: ${isRunning}`);
    if (prevProps.buildStatus.isRunning !== this.props.buildStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.buildStatus.isRunning });
      if (!this.props.buildStatus.isRunning) {
        let builtModelId = this.props.buildStatus.lastBuildId;
        console.log('isRunning changed from True to False');
        clearInterval(this.intervalId);
        notification.success({
          message: 'Success',
          description: `The model ${builtModelId} was built successfully!`,
          placement: 'topRight',
        });
        this.setState({
          attackDataset: null,
          normalDataset: null,
        });
        // Navigate to models page after successful build
        if (this.props.navigate) {
          this.props.navigate('/models/all');
        }
      }
    }
  }

  beforeUploadPcap = (file) => {
    const isPCAP = file.name.endsWith('.pcap');
    console.log(file.name.endsWith('.pcap'));
    if (!isPCAP) {
      message.error(`${file.name} is not a pcap file`);
    }
    return isPCAP ? true : Upload.LIST_IGNORE;
  }

  handleUploadPcap = async (info, typePcap) => {
    const { status, response, name } = info.file;
    console.log({ status, response, name });

    if (status === 'uploading') {
      console.log(`Uploading ${name}`);
    } else if (status === 'done') {
      const pcapTypeToFileState = {
        'attack': 'attackPcapFile',
        'normal': 'normalPcapFile'
      };

      if (pcapTypeToFileState[typePcap]) {
        // Use the filename returned by the server (e.g., { pcapFile: 'file.pcap' })
        const uploadedPcapName = (response && response.pcapFile) || (info.file.response && info.file.response.pcapFile) || null;
        this.setState({ [pcapTypeToFileState[typePcap]]: uploadedPcapName });
        console.log(`Uploaded successfully ${name}`);
      } else {
        console.error('Type of pcap file is invalid');
      }
    } else if (status === 'error') {
      console.error('Pcap file upload failed');
    }
  };

  processUploadPcap = async ({ file, onProgress, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('pcapFile', file);

    try {
      const response = await fetch(`${SERVER_URL}/api/pcaps`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data, response);
        console.log(`Uploaded successfully ${file.name}`);
      } else {
        const error = await response.text();
        onError(new Error(error));
        console.error(error);
      }
    } catch (error) {
      onError(error);
      console.error(error);
    }
  }

  render() {
    const { mmtStatus, buildStatus, reports } = this.props;
    //console.log(reports);
    const {
      attackPcapFile,
      normalPcapFile,
      isRunning
    } = this.state;

    console.log({ attackPcapFile, normalPcapFile, isRunning });

    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    const featureOptions = FEATURES_OPTIONS ? FEATURES_OPTIONS.map(feature => ({
      value: feature,
      label: feature,
    })) : [];

    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="Build a new AI model for anomaly detection">
        <Row>
        <Col span={12}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }} className="bold-labels">
          <Form.Item
            label={<strong>Malicious Dataset</strong>}
            name="attackDataset"
            rules={[
              {
                required: true,
                message: 'Please select an malicious dataset!',
              },
            ]}
          >
            <Tooltip title="Select MMT's analyzing reports of malicious traffic.">
              <Select
                placeholder="Select malicious MMT reports ..."
                value={this.state.attackDataset}
                showSearch allowClear
                onChange={v => this.setState({ attackDataset: v })}
                options={reportsOptions}
                disabled={this.state.attackPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/pcaps`}
              onChange={(info) => this.handleUploadPcap(info, "attack")}
              customRequest={this.processUploadPcap}
              onRemove={() => {
                this.setState({ attackPcapFile: null });
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }} disabled={!!this.state.attackDataset}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item label={<strong>Normal Dataset</strong>} name="normalDataset"
            rules={[
              {
                required: true,
                message: 'Please select a normal dataset!',
              },
            ]}
          >
            <Tooltip title="Select MMT's analyzing reports of normal traffic.">
              <Select
                placeholder="Select normal MMT reports ..."
                value={this.state.normalDataset}
                showSearch allowClear
                onChange={v => this.setState({ normalDataset: v })}
                options={reportsOptions}
                disabled={this.state.normalPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/pcaps`}
              onChange={(info) => this.handleUploadPcap(info, "normal")}
              customRequest={this.processUploadPcap}
              onRemove={() => {
                this.setState({ normalPcapFile: null });
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }} disabled={!!this.state.normalDataset}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item label={<strong>Feature List</strong>} name="featureList">
            <Tooltip title="Select feature lists used to build models.">
              <Select
                value={this.state.featureList}
                onChange={v => this.setState({ featureList: v })}
                options={featureOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item label={<strong>Training Ratio</strong>} name="training_ratio">
            <Tooltip title="The training ratio refers to the proportion of data used for training a machine learning model compared to the total dataset. The training ratio is 0.7, meaning 70% for training and 30% for testing/validation.">
              <InputNumber
                name="training_ratio"
                value={this.state.training_ratio}
                min={0} max={1} step={0.1} defaultValue={0.7}
                onChange={v => this.setState({ training_ratio: v })}
              />
            </Tooltip>
          </Form.Item>
          <Collapse>
            <Panel header="Training Parameters">
              <Form.Item label={<strong>Number of Epochs (CNN)</strong>} name="nb_epoch_cnn">
                <Tooltip title="In convolutional neural networks (CNN), the number of epochs determines how many times the model will iterate over the training data during the training process.">
                  <InputNumber
                    name="nb_epoch_cnn"
                    value={this.state.nb_epoch_cnn}
                    min={1} max={1000} defaultValue={5}
                    onChange={(v) =>
                      this.setState({
                        training_parameters: { ...this.state.training_parameters, nb_epoch_cnn: v },
                      })
                    }
                  />
                </Tooltip>
              </Form.Item>
              <Form.Item label={<strong>Number of Epochs (SAE)</strong>} name="nb_epoch_sae">
                <Tooltip title="In Stacked Autoencoder (SAE), the number of epochs determines how many times this encoding-decoding process is repeated during training.">
                  <InputNumber
                    name="nb_epoch_sae"
                    value={this.state.nb_epoch_sae}
                    min={1} max={1000} defaultValue={3}
                    onChange={(v) =>
                      this.setState({
                        training_parameters: { ...this.state.training_parameters, nb_epoch_sae: v },
                      })
                    }
                  />
                </Tooltip>
              </Form.Item>
              <Form.Item label={<strong>Batch Size (CNN)</strong>} name="batch_size_cnn">
                <Tooltip title="Batch size in CNN refers to the number of samples that are processed together in a single forward and backward pass during each epoch of training. The training dataset is divided into smaller batches, and the model's parameters are updated based on the average gradients computed from each batch.">
                  <InputNumber
                    name="batch_size_cnn"
                    value={this.state.batch_size_cnn}
                    min={1} max={1000} defaultValue={16}
                    onChange={(v) =>
                      this.setState({
                        training_parameters: { ...this.state.training_parameters, batch_size_cnn: v },
                      })
                    }
                  />
                </Tooltip>
              </Form.Item>
              <Form.Item label={<strong>Batch Size (SAE)</strong>} name="batch_size_sae">
                <Tooltip title="Batch size in a SAE determines the number of samples processed together in each training iteration.">
                  <InputNumber
                    name="batch_size_sae"
                    value={this.state.batch_size_sae}
                    min={1} max={1000} defaultValue={32}
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
              type="primary"
              icon={<RocketOutlined />}
              style={{ marginTop: '16px' }}
              loading={isRunning}
              disabled={ isRunning ||
                !((this.state.attackDataset && this.state.normalDataset) ||
                (this.state.attackPcapFile && this.state.normalPcapFile))
              }
              onClick={this.handleButtonBuild}
            >
              Build Model
            </Button>
          </div>
        </Form>
        </Col>
        <Col span={12} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Tooltip title="Model Training Architecture: Dataset preparation, feature extraction, model training, and evaluation pipeline">
            <img src="../../img/architecture.png" style={{ width: '40%', cursor: 'help' }} alt="Model Architecture Diagram" />
          </Tooltip>
        </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ mmtStatus, buildStatus, reports }) => ({
  mmtStatus, buildStatus, reports,
});

const mapDispatchToProps = (dispatch) => ({
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
  fetchBuildStatus: () => dispatch(requestBuildStatus()),
  fetchBuildModel: (datasets, ratio, params) =>
    dispatch(requestBuildModel({ datasets, ratio, params })),
  fetchAllReports: () => dispatch(requestAllReports()),
});

// React Router v6: inject navigate into class component via HOC
function withNavigation(ComponentWithNav) {
  return function WrappedComponent(props) {
    const navigate = useNavigate();
    return <ComponentWithNav {...props} navigate={navigate} />;
  };
}

export default connect(mapPropsToStates, mapDispatchToProps)(withNavigation(BuildADPage));
