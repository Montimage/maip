import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Tooltip, message, notification, Upload, Spin, Button, Form, Select, Checkbox } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import {
  FORM_LAYOUT,
  SERVER_URL,
} from "../constants";
import {
  requestApp,
  requestBuildConfigModel,
  requestMMTStatus,
  requestAllReports,
  requestAllModels,
  requestPredict,
  requestPredictStatus,
} from "../actions";
import {
  filteredModelsOptions,
  getLastPath,
} from "../utils";

let isModelIdPresent = getLastPath() !== "offline";

class PredictOfflinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      testingPcapFile: null,
      testingDataset: null,
      isRunning: props.predictStatus.isRunning,
      isMMTRunning: props.mmtStatus.isRunning,
    };
    this.handlePredictOffline = this.handlePredictOffline.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllReports();
    this.props.fetchAllModels(); 
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

  async requestCsvReports(reportId) {
    const url = `${SERVER_URL}/api/reports/${reportId}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw data.error;
    }
    console.log(data.csvFiles);
    return data.csvFiles;  
  }

  async requestMMTOffline(file) {
    console.log(`Uploaded file ${file.name}`);
    const url = `${SERVER_URL}/api/mmt/offline`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: file.name }),
    });
    const data = await response.json();
    console.log(`MMT offline analysis of pcap file ${file.name}`);
    return data;
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
      this.setState({ testingPcapFile: info.file.originFileObj });
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

  async handlePredictOffline() {
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const { 
      modelId,
      testingPcapFile,
      testingDataset,
      isRunning,
    } = this.state;

    let fetchModelId = isModelIdPresent ? getLastPath() : modelId;
    let csvReports = [];
    let updatedTestingDataset = null;

    if (!isRunning) {
      
        
      if (testingDataset) {
        updatedTestingDataset = testingDataset;
      } else if (testingPcapFile) {
        await this.requestMMTOffline(testingPcapFile);
        const pcapFileStatus = await this.requestMMTStatus();
        
        await delay(10000); // TODO: improve?
        updatedTestingDataset = `report-${pcapFileStatus.sessionId}`;
        this.setState({ testingDataset: updatedTestingDataset });
      }

      if (updatedTestingDataset) {
        try {
          csvReports = await this.requestCsvReports(updatedTestingDataset);
          if (csvReports.length == 0) {
            console.error(`Testing dataset is not valid!`);
          } else {
            // Suppose that there is at most one csv report in each report folder
            console.log(csvReports[0]);
            console.log(fetchModelId);
            console.log(updatedTestingDataset);
            this.props.fetchPredict(fetchModelId, updatedTestingDataset, csvReports[0]);
            console.log("update isRunning state!");
            this.setState({ isRunning: true });        
            this.intervalId = setInterval(() => { // start interval when button is clicked
              this.props.fetchPredictStatus();
            }, 2000);
          }
        } catch (error) {
          console.error('Error in requestCsvReports:', error);
        }
      }
    }  
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ modelId: null });
    }

    if (prevProps.predictStatus.isRunning !== this.props.predictStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.predictStatus.isRunning });
      if (!this.props.predictStatus.isRunning) {
        //console.log('isRunning changed from True to False');  
        clearInterval(this.intervalId);
        notification.success({
          message: 'Success',
          description: 'Make predictions successfully!',
          placement: 'topRight',
        });
        this.setState({
          testingDataset: null, 
          testingPcapFile: null,
        });
      }
    }
  }

  render() {
    const { app, models, mmtStatus, reports } = this.props;
    const { modelId, testingDataset, testingPcapFile, isRunning } = this.state;

    // TODO: need to filter mmt reports ?
    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    const modelsOptions = filteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ? 
      `Offline prediction using the model ${modelId}` : 
      'Offline prediction using models';

    return (
      <LayoutPage pageTitle="Predict Offline" pageSubTitle={subTitle}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }}>
          <Form.Item name="model" label="Model" 
            style={{ flex: 'none', marginBottom: 10 }}
            rules={[
              {
                required: true,
                message: 'Please select a model!',
              },
            ]}
          > 
            <Tooltip title="Select a model to perform offline predictions.">
              <Select placeholder="Select a model ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value });
                  console.log(`Select model ${value}`);
                }}
                //optionLabelProp="label"
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            label="Testing Dataset"
            name="testingDataset"
            rules={[
              {
                required: true,
                message: 'Please select a testing dataset!',
              },
            ]}
          >
            <Tooltip title="Select MMT's analyzing reports of testing traffic.">
              <Select
                placeholder="Select testing MMT reports ..."
                showSearch allowClear
                onChange={(value) => {
                  this.setState({ testingDataset: value });
                }}
                options={reportsOptions}
                disabled={this.state.testingPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/upload`}
              onChange={(info) => this.handleUploadPcap(info)} 
              customRequest={this.processUploadPcap}
              onRemove={() => {
                this.setState({ testingPcapFile: null });
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }} 
                disabled={!!this.state.testingDataset}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'center', }}>
            <Button type="primary"
              onClick={this.handlePredictOffline}
              disabled={ isRunning || !this.state.modelId || !(this.state.testingDataset || this.state.testingPcapFile) }
            >
              Predict
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

const mapPropsToStates = ({ app, models, mmtStatus, reports, predictStatus }) => ({
  app, models, mmtStatus, reports, predictStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchBuildConfigModel: (modelId) => dispatch(requestBuildConfigModel(modelId)),
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
  fetchAllReports: () => dispatch(requestAllReports()),
  fetchPredict: (modelId, reportId, reportFileName) =>
    dispatch(requestPredict({modelId, reportId, reportFileName})), 
  fetchPredictStatus: () => dispatch(requestPredictStatus()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictOfflinePage);