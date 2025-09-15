import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Tooltip, message, Upload, Spin, Button, Form, Select, Checkbox, InputNumber, Table, Divider } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import {
  FORM_LAYOUT,
  SERVER_URL,
} from "../constants";
import {
  requestApp,
  requestMMTStatus,
  requestAllModels,
  requestPredict,
  requestPredictStatus,
} from "../actions";
import { requestPredictStats } from "../api";
import { Pie, RingProgress } from '@ant-design/plots';
import {
  getFilteredModelsOptions,
  getLastPath,
} from "../utils";

let isModelIdPresent = getLastPath() !== "online";

class PredictOnlinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      interface: null,
      interfacesOptions: [],
      windowSec: 10,
      isCapturing: false,
      status: null,
      lastProcessedFile: null,
      processedFiles: [],
      isProcessingSlice: false,
      isRunning: props.predictStatus ? props.predictStatus.isRunning : false,
      predictStats: null,
    };
    this.handleButtonStart = this.handleButtonStart.bind(this);
    this.handleButtonStop = this.handleButtonStop.bind(this);
    this.pollStatus = this.pollStatus.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
    this.fetchInterfacesAndSetOptions();
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ modelId: null });
    }

    if (prevProps.predictStatus && prevProps.predictStatus.isRunning !== this.props.predictStatus.isRunning) {
      this.setState({ isRunning: this.props.predictStatus.isRunning });
      if (!this.props.predictStatus.isRunning) {
        if (this.predictTimer) clearInterval(this.predictTimer);
        message.success('Online window prediction completed');
        const lastPredictId = this.props.predictStatus.lastPredictedId;
        try {
          const predictStats = await requestPredictStats(lastPredictId);
          this.setState({ predictStats });
        } catch (e) {
          console.error('Failed to load prediction stats:', e);
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    if (this.predictTimer) clearInterval(this.predictTimer);
  }

  async requestMMTStatusLocal() {
    const url = `${SERVER_URL}/api/mmt`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw data.error;
    return data.mmtStatus;
  };

  async requestNetworkInterfaces() {
    const url = `${SERVER_URL}/api/predict/interfaces`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw data.error;
    return data.interfaces;
  }

  async fetchInterfacesAndSetOptions() {
    let interfacesOptions = [];
    try {
      const interfaces = await this.requestNetworkInterfaces();
      interfacesOptions = interfaces.map(i => {
        const dev = String(i).split(/\s*-\s*/)[0];
        return { label: i, value: dev };
      });
    } catch (error) {
      console.error('Error:', error);
    }
    this.setState({ interfacesOptions });
  }

  async requestMMTOfflineByPath(filePath) {
    const url = `${SERVER_URL}/api/mmt/offline`;
    const response = await fetch(url, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    const data = await response.json();
    return data;
  }

  async pollStatus() {
    try {
      const res = await fetch(`${SERVER_URL}/api/online/status`);
      const status = await res.json();
      this.setState({ status, isCapturing: status.running });
      const { lastFile, lastFileAgeMs } = status;
      const { lastProcessedFile, processedFiles, isRunning, modelId, isProcessingSlice } = this.state;
      const base = lastFile ? String(lastFile).split('/').pop() : null;
      // Only process exactly one slice AFTER capture stops
      if (
        lastFile &&
        base &&
        status.running === false &&
        processedFiles.indexOf(base) === -1 &&
        !isRunning &&
        !isProcessingSlice &&
        modelId &&
        (lastFileAgeMs === null || lastFileAgeMs >= 1500)
      ) {
        // Mark as processed immediately to avoid races
        this.setState({ lastProcessedFile: lastFile, processedFiles: [...processedFiles, base], isProcessingSlice: true });
        await this.processSlice(lastFile);
      }
    } catch (e) {
      console.warn('Failed to poll online status:', e.message);
    }
  }

  async processSlice(filePath) {
    try {
      await this.requestMMTOfflineByPath(filePath);
      // Mirror PredictOffline: wait for MMT status to expose a sessionId
      let sessionId = null;
      for (let i = 0; i < 20; i++) { // up to ~10s @ 500ms
        const mmtStatus = await this.requestMMTStatusLocal();
        if (mmtStatus && mmtStatus.sessionId) {
          sessionId = mmtStatus.sessionId;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      if (!sessionId) {
        console.error('MMT sessionId not available after offline start');
        this.setState({ isProcessingSlice: false });
        return;
      }
      const reportId = `report-${sessionId}`;
      // Fetch CSV list using same endpoint as offline
      let csvList = [];
      for (let i = 0; i < 10; i++) { // up to ~10s
        const res = await fetch(`${SERVER_URL}/api/reports/${reportId}`);
        const data = await res.json();
        csvList = (data && data.csvFiles) ? data.csvFiles : [];
        if (Array.isArray(csvList) && csvList.length > 0) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!Array.isArray(csvList) || csvList.length === 0) {
        console.error('No CSV reports found for', reportId);
        this.setState({ isProcessingSlice: false });
        return;
      }
      const csvFileName = csvList[0];
      // Dispatch predict using same flow as offline
      this.props.fetchPredict(this.state.modelId, reportId, csvFileName);
      if (!this.state.isRunning) {
        this.setState({ isRunning: true });
        if (this.predictTimer) clearInterval(this.predictTimer);
        this.predictTimer = setInterval(() => {
          this.props.fetchPredictStatus();
        }, 2000);
      }
    } catch (e) {
      console.error('processSlice error:', e);
    } finally {
      this.setState({ isProcessingSlice: false });
    }
  }

  async handleButtonStart() {
    const { modelId, interface: iface, windowSec } = this.state;
    if (!modelId || !iface) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/online/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iface, windowSec }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      message.success(`Started capture on ${iface} (pid ${data.pid})`);
      this.setState({ isCapturing: true, status: data, lastProcessedFile: null, processedFiles: [] });
      if (this.statusTimer) clearInterval(this.statusTimer);
      this.statusTimer = setInterval(this.pollStatus, 2000);
    } catch (e) {
      message.error(`Failed to start capture: ${e.message}`);
    }
  }

  async handleButtonStop() {
    try {
      const res = await fetch(`${SERVER_URL}/api/online/stop`, { method: 'POST' });
      const data = await res.json();
      this.setState({ isCapturing: false });
      if (this.statusTimer) clearInterval(this.statusTimer);
      message.success('Stopped capture');
    } catch (e) {
      message.error(`Failed to stop capture: ${e.message}`);
    }
  }

  render() {
    const { app, models } = this.props;
    const { modelId, interfacesOptions, isCapturing, windowSec, status, predictStats } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ?
      `Online prediction using the model ${modelId}` :
      'Online prediction using models';

    let tableConfig, maliciousFlows, predictOutput;
    let normalFlows = 0;
    let totalFlows = 0;
    if (predictStats) {
      const values = predictStats.trim().split('\n')[1].split(',');
      const n = parseInt(values[0], 10);
      const m = parseInt(values[1], 10);
      normalFlows = n;
      maliciousFlows = m;
      totalFlows = n + m;
      const dataSource = [{ key: 'data', "Normal flows": values[0], "Malicious flows": values[1], "Total flows": values[2] }];
      const columns = [
        { title: 'Normal flows', dataIndex: 'Normal flows', align: 'center' },
        { title: 'Malicious flows', dataIndex: 'Malicious flows', align: 'center' },
        { title: 'Total flows', dataIndex: 'Total flows', align: 'center' },
      ];
      tableConfig = { dataSource, columns, pagination: false };
      predictOutput = maliciousFlows > 0
        ? 'The model predicts that the given network traffic contains Malicious activity'
        : 'The model predicts that the given network traffic is Normal';
    }

    const donutData = [
      { type: 'Normal', value: normalFlows },
      { type: 'Malicious', value: maliciousFlows || 0 },
    ];
    const donutConfig = {
      data: donutData,
      angleField: 'value',
      colorField: 'type',
      radius: 1,
      innerRadius: 0.64,
      legend: { position: 'right' },
      label: {
        type: 'inner',
        offset: '-50%',
        content: ({ percent }) => `${(percent * 100).toFixed(0)}%`,
        style: { fontSize: 14, textAlign: 'center' },
      },
      color: ['#5B8FF9', '#F4664A'],
      interactions: [{ type: 'element-active' }],
      statistic: {
        title: false,
        content: { content: totalFlows ? `${totalFlows}` : '', style: { fontSize: 16 } },
      },
    };

    const maliciousRate = totalFlows > 0 ? maliciousFlows / totalFlows : 0;
    const ringConfig = {
      height: 140,
      width: 140,
      autoFit: false,
      percent: maliciousRate,
      color: ['#F4664A', '#E8EDF3'],
      statistic: {
        title: { formatter: () => 'Malicious', style: { fontSize: 12 } },
        content: { formatter: () => `${(maliciousRate * 100).toFixed(1)}%`, style: { fontSize: 16 } },
      },
    };

    return (
      <LayoutPage pageTitle="Predict Online" pageSubTitle={subTitle}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Prediction Parameters</h1>
        </Divider>
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
            <Tooltip title="Select a model to perform online predictions.">
              <Select placeholder="Select a model ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value });
                  console.log(`Select model ${value}`);
                }}
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="interface" label="Network interface"
            style={{ flex: 'none', marginBottom: 10 }}
            rules={[
              {
                required: true,
                message: 'Please select a network interface!',
              },
            ]}
          >
            <Tooltip title="Select a network interface to perform online predictions.">
              <Select placeholder="Select a network interface ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.interface}
                onChange={v => this.setState({ interface: v })}
                options={interfacesOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="windowSec" label="Window (s)" style={{ flex: 'none', marginBottom: 10 }}>
            <InputNumber min={3} max={60} value={windowSec} onChange={(v) => this.setState({ windowSec: v || 10 })} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button
              type="primary"
              onClick={this.handleButtonStart}
              disabled={ isCapturing || !this.state.modelId || !this.state.interface }
            >
              Start
            </Button>
            <Button
              onClick={this.handleButtonStop}
              disabled={!isCapturing}
            >
              Stop
            </Button>
          </div>
        </Form>

        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Prediction Results</h1>
        </Divider>
        {predictStats && modelId && (
          <>
            <div style={{ marginTop: '10px' }}>
              <h3 style={{ fontSize: '22px' }}>{predictOutput}</h3>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <Pie {...donutConfig} style={{ width: 320, height: 220 }} />
                </div>
                <div>
                  <RingProgress {...ringConfig} />
                </div>
                <div>
                  <Table {...tableConfig} style={{ width: '500px' }} />
                </div>
              </div>
            </div>
          </>
        )}

        {status && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
            <div>Running: {String(status.running)}</div>
            <div>PID: {status.pid || '-'}</div>
            <div>Last file: {status.lastFile || '-'}</div>
          </div>
        )}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, mmtStatus, predictStatus }) => ({
  app, models, mmtStatus, predictStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
  fetchPredict: (modelId, reportId, reportFileName) =>
    dispatch(requestPredict({modelId, reportId, reportFileName})),
  fetchPredictStatus: () => dispatch(requestPredictStatus()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictOnlinePage);