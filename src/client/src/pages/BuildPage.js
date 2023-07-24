import React, { Component, useState } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { connect } from "react-redux";
import { Row, Col, Tooltip, message, Upload, Spin, Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
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

const { Panel } = Collapse;

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

// TODO: if building a model is done, jump to ModelsPage -> seems to be difficult!

class BuildPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attackDataset: "",
      attackPcapFile: null,
      normalDataset: "",
      normalPcapFile: null,
      featureList: "Raw Features",
      training_ratio: 0.7,
      training_parameters: {
        nb_epoch_cnn: 2,
        nb_epoch_sae: 5,
        batch_size_cnn: 32,
        batch_size_sae: 16,
      },
      isRunning: props.buildStatus.isRunning,
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
      isRunning,
    } = this.state;

    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });        
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchBuildStatus();
      }, 5000);
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
      this.props.fetchBuildModel(datasets, training_ratio, training_parameters);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const modelId = getLastPath();
    const { isRunning } = this.state;
    const { buildStatus } = this.props;
    console.log(`buildStatus: ${buildStatus.isRunning}`);
    console.log(`build isRunning: ${isRunning}`);
    if (prevProps.buildStatus.isRunning !== this.props.buildStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.buildStatus.isRunning });
      if (!this.props.buildStatus.isRunning) {
        console.log('isRunning changed from True to False');  
        clearInterval(this.intervalId);
      }
    }
  }

  handleInputChange = (name, value) => {
    this.setState({
      [name]: value,
    });
  };

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
        this.setState({ [pcapTypeToFileState[typePcap]]: info.file.originFileObj });
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
      const response = await fetch(`${SERVER_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Trigger onSuccess function to indicate upload has finished
        onSuccess(data, response);
        console.log(`Uploaded successfully ${file.name}`);
      } else {
        const error = await response.text();
        // Trigger onError function to indicate upload failed
        onError(new Error(error));
        console.error(error);
      }
    } catch (error) {
      // Trigger onError function to indicate upload failed
      onError(error);
      console.error(error);
    }
  }

  render() {
    const { buildStatus, reports } = this.props;
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

    const features = [
      "Raw Features",
      "Top 10 Important Features",
      "Top 20 Important Features"
    ];

    const featureOptions = features ? features.map(feature => ({
      value: feature,
      label: feature,
    })) : [];

    // TODO: disable button Upload pcaps if users selected already datasets and vice versa
    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="Build a new deep learning model">
        <Row>
        <Col span={12}>
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
                onChange={(value) => {
                  this.setState({ attackDataset: value });
                }}
                options={reportsOptions}
                disabled={this.state.attackPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/upload`}
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
                showSearch allowClear
                onChange={value => this.setState({ normalDataset: value })}
                options={reportsOptions}
                disabled={this.state.normalPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/upload`}
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
          <Form.Item label="Feature List" name="featureList">
            <Tooltip title="Select feature lists used to build models.">
              <Select
                value={this.state.featureList}
                onChange={value => this.setState({ featureList: value })}
                options={featureOptions}
              />
            </Tooltip>
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
              type="primary"
              style={{ marginTop: '16px' }}
              disabled={isRunning || !this.state.attackDataset || !this.state.normalDataset}
              onClick={this.handleButtonBuild}
            >
              Build model
              {isRunning && 
                <Spin size="large" style={{ marginBottom: '8px' }}>
                  <div className="content" />
                </Spin>
              }
            </Button>
          </div>
        </Form>
        </Col>
        <Col span={12} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src="../../img/architecture.png" 
            style={{ width: '40%' }} />
        </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ buildStatus, reports }) => ({
  buildStatus, reports,
});

const mapDispatchToProps = (dispatch) => ({
  fetchBuildStatus: () => dispatch(requestBuildStatus()),
  fetchBuildModel: (datasets, ratio, params) =>
    dispatch(requestBuildModel({ datasets, ratio, params })),
  fetchAllReports: () => dispatch(requestAllReports()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildPage);
