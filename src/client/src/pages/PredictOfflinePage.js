import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Table, Tooltip, message, notification, Upload, Spin, Button, Form, Select } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import {
  FORM_LAYOUT,
  SERVER_URL,
} from "../constants";
import {
  requestApp,
  requestBuildConfigModel,
  requestAllReports,
  requestAllModels,
  requestPredict,
  requestPredictStatus,
} from "../actions";
import {
  requestMMTStatus,
  requestMMTOffline,
  requestCsvReports,
  requestPredictStats,
} from "../api";
import {
  getFilteredModelsOptions,
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
      predictStats: null,
    };
    this.handlePredictOffline = this.handlePredictOffline.bind(this);
    this.handleTablePredictStats = this.handleTablePredictStats.bind(this);
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
        await requestMMTOffline(testingPcapFile);
        const pcapFileStatus = await requestMMTStatus();

        await delay(10000); // TODO: improve?
        updatedTestingDataset = `report-${pcapFileStatus.sessionId}`;
        this.setState({ testingDataset: updatedTestingDataset });
      }

      if (updatedTestingDataset) {
        try {
          csvReports = await requestCsvReports(updatedTestingDataset);
          if (csvReports.length === 0) {
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

  handleTablePredictStats(csvData) {
    const values = csvData.trim().split('\n')[1].split(',');
    const normalFlows = parseInt(values[0], 10);
    const maliciousFlows = parseInt(values[1], 10);
    const dataSource = [
      {
        key: 'data',
        "Normal flows": values[0],
        "Malicious flows": values[1],
        "Total flows": values[2]
      }
    ];
    const columns = [
      {
        title: 'Normal flows',
        dataIndex: 'Normal flows',
        align: 'center',
      },
      {
        title: 'Malicious flows',
        dataIndex: 'Malicious flows',
        align: 'center',
      },
      {
        title: 'Total flows',
        dataIndex: 'Total flows',
        align: 'center',
      }
    ];
    const tableConfig = {
      dataSource: dataSource,
      columns: columns,
      pagination: false
    };

    return { tableConfig, normalFlows, maliciousFlows };
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ modelId: null });
    }

    if (prevProps.predictStatus.isRunning !== this.props.predictStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.predictStatus.isRunning });
      if (!this.props.predictStatus.isRunning) {
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
        const lastPredictId = this.props.predictStatus.lastPredictedId;
        console.log(lastPredictId);
        const predictStats = await requestPredictStats(lastPredictId);
        console.log(predictStats);
        this.setState({ predictStats });
      }
    }
  }

  render() {
    const { app, models, reports } = this.props;
    const { modelId, isRunning, predictStats } = this.state;

    // TODO: need to filter mmt reports ?
    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ?
      `Offline prediction using the model ${modelId}` :
      'Offline prediction using models';

    let tableConfig, maliciousFlows, predictOutput;
    if (predictStats) {
      const predictResult = this.handleTablePredictStats(predictStats);
      tableConfig = predictResult.tableConfig;
      maliciousFlows = predictResult.maliciousFlows;
      if (maliciousFlows > 0) {
        predictOutput = "The model predicts that the given network traffic contains Malicious activity";
      } else {
        predictOutput = "The model predicts that the given network traffic is Normal";
      }
    }

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
                  this.setState({ modelId: value, predictStats: null });
                  console.log(`Select model ${value}`);
                }}
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
                  this.setState({ testingDataset: value, predictStats: null });
                }}
                options={reportsOptions}
                disabled={this.state.testingPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/pcaps`}
              onChange={(info) => this.handleUploadPcap(info)}
              customRequest={this.processUploadPcap}
              onRemove={() => {
                this.setState({ testingPcapFile: null, predictStats: null });
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

        { predictStats && modelId &&
          (
            <>
              <div style={{ marginTop: '50px' }}>
                <h3>{predictOutput}</h3>
                <Table {...tableConfig} style={{ width: '500px' }} />
            </div>
            </>
          )
        }

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