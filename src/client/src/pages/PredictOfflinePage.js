import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Table, Tooltip, message, notification, Upload, Spin, Button, Form, Select, Dropdown, Menu, Modal, Divider } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import Papa from 'papaparse';
import { Pie, RingProgress } from '@ant-design/plots';
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
import { requestRunLime } from "../actions";
import {
  requestMMTStatus,
  requestMMTOffline,
  requestCsvReports,
  requestPredictStats,
  requestPredictionAttack,
  requestXAIStatus,
  requestLimeValues,
} from "../api";
import {
  getFilteredModelsOptions,
  getLastPath,
} from "../utils";
import { handleMitigationAction, handleBulkMitigationAction } from '../utils/mitigation';
import { buildAttackTable } from '../utils/attacksTable';

let isModelIdPresent = getLastPath() !== "offline";

class PredictOfflinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      testingPcapFile: null,
      testingDataset: null,
      isRunning: (props.predictStatus && props.predictStatus.isRunning) ? props.predictStatus.isRunning : false,
      isMMTRunning: (props.mmtStatus && props.mmtStatus.isRunning) ? props.mmtStatus.isRunning : false,
      predictStats: null,
      attackCsv: null,
      attackRows: [],
      attackColumns: [],
      attackFlowColumns: [],
      mitigationColumns: [],
      attackPagination: { current: 1, pageSize: 10 },
      limeModalVisible: false,
      limeValues: [],
    };
    // No binds needed; methods are arrow functions
  }

  // Extract flow details (IPs, ports, rates, sessionId) from a record
  computeFlowDetails = (record) => {
    const keyList = Object.keys(record).filter(k => k !== 'key');
    const findKey = (patterns) => keyList.find(k => patterns.some(p => p.test(k)));
    const srcKey = findKey([
      /src.*ip/i, /source.*ip/i, /^ip[_-]?src$/i, /^src[_-]?ip$/i, /(src|source).*addr/i, /^saddr$/i
    ]);
    const dstKey = findKey([
      /dst.*ip/i, /dest.*ip/i, /destination.*ip/i, /^ip[_-]?dst$/i, /^dst[_-]?ip$/i, /(dst|dest|destination).*addr/i, /^daddr$/i
    ]);
    const combinedIpKey = (!srcKey && !dstKey) ? findKey([/^ip$/i, /ip.*pair/i, /ip.*addr/i, /address/i]) : null;
    const deriveIps = (rec) => {
      if (!combinedIpKey) return { srcIp: null, dstIp: null };
      const text = String(rec[combinedIpKey] || '');
      const ipv4s = text.match(/(?:\d{1,3}\.){3}\d{1,3}/g) || [];
      return { srcIp: ipv4s[0] || null, dstIp: ipv4s[1] || null };
    };
    const derived = deriveIps(record);
    const srcIp = srcKey ? record[srcKey] : (derived?.srcIp || null);
    const dstIp = dstKey ? record[dstKey] : (derived?.dstIp || null);
    const sessionId = record['ip.session_id'] || record['session_id'] || null;
    const dport = record['dport_g'] ?? record['dport_le'] ?? record['dport'] ?? null;
    const pktsRate = record['pkts_rate'] ?? null;
    const byteRate = record['byte_rate'] ?? null;
    return { srcIp, dstIp, sessionId, dport, pktsRate, byteRate };
  }

  // Strict IPv4 validation (each octet 0-255)
  isValidIPv4(ip) {
    if (typeof ip !== 'string') return false;
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    return m.slice(1).every(o => {
      const n = Number(o);
      return n >= 0 && n <= 255 && String(n) === String(Number(o));
    });
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
      // Use the filename returned by the server (e.g., { pcapFile: 'file.pcap' })
      const uploadedPcapName = (response && response.pcapFile) || (info.file.response && info.file.response.pcapFile) || null;
      this.setState({ testingPcapFile: uploadedPcapName });
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

  handlePredictOffline = async () => {
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
        // Start offline analysis and get the sessionId immediately
        const startStatus = await requestMMTOffline(testingPcapFile);
        if (startStatus && startStatus.sessionId) {
          const targetSessionId = startStatus.sessionId;
          // Poll MMT status until analysis completes (isRunning becomes false)
          const maxAttempts = 60; // ~2 minutes
          const intervalMs = 2000;
          let attempt = 0;
          while (attempt < maxAttempts) {
            const status = await requestMMTStatus();
            if (!status.isRunning && status.sessionId === targetSessionId) {
              break;
            }
            await delay(intervalMs);
            attempt += 1;
          }
          updatedTestingDataset = `report-${targetSessionId}`;
          this.setState({ testingDataset: updatedTestingDataset });
        } else {
          console.error('Failed to start MMT offline analysis or missing sessionId');
          return;
        }
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

  handleTablePredictStats = (csvData) => {
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

    const prevPS = prevProps && prevProps.predictStatus ? prevProps.predictStatus : {};
    const currPS = this.props && this.props.predictStatus ? this.props.predictStatus : {};
    if ((prevPS.isRunning || false) !== (currPS.isRunning || false)) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: !!currPS.isRunning });
      if (!currPS.isRunning) {
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
        const lastPredictId = currPS.lastPredictedId || '';
        if (lastPredictId) {
          // Fetch stats and attacks
          const predictStats = await requestPredictStats(lastPredictId);
          let attackCsv = null;
          try {
            attackCsv = await requestPredictionAttack(lastPredictId);
          } catch (e) {
            console.warn('No attack CSV available:', e.message);
          }
          let attackRows = [];
          let attackFlowColumns = [];
          let mitigationColumns = [];
          if (attackCsv) {
            const built = buildAttackTable({
              csvString: attackCsv,
              onAction: (key, record) => this.onMitigationAction(key, record),
              buildMenu: (record, onAction) => {
                const { srcIp, dstIp, dport } = this.computeFlowDetails(record);
                const validSrc = this.isValidIPv4(srcIp);
                const validDst = this.isValidIPv4(dstIp);
                return (
                  <Menu onClick={({ key }) => onAction && onAction(key, record)}>
                    <Menu.Item key="explain-shap">Explain (XAI SHAP)</Menu.Item>
                    <Menu.Item key="explain-lime">Explain (XAI LIME)</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="block-src-ip" disabled={!validSrc}>
                      {`Block source IP${validSrc ? ` ${srcIp}` : ''}`}
                    </Menu.Item>
                    <Menu.Item key="block-dst-ip" disabled={!validDst}>
                      {`Block destination IP${validDst ? ` ${dstIp}` : ''}`}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="block-dst-port" disabled={!dport}>
                      {`Block destination port${dport ? ` ${dport}/tcp` : ''}`}
                    </Menu.Item>
                    <Menu.Item key="block-ip-port-src" disabled={!(validSrc && dport)}>
                      {`Block${validSrc && dport ? ` ${srcIp}:${dport}/tcp` : ' srcIP:dstPort/tcp'}`}
                    </Menu.Item>
                    <Menu.Item key="block-ip-port-dst" disabled={!(validDst && dport)}>
                      {`Block${validDst && dport ? ` ${dstIp}:${dport}/tcp` : ' dstIP:dstPort/tcp'}`}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="drop-session" disabled={!(validSrc || validDst)}>
                      {`Drop session${validDst ? ` ${dstIp}` : validSrc ? ` ${srcIp}` : ''}`}
                    </Menu.Item>
                    <Menu.Item key="rate-limit-src" disabled={!(validSrc && dport)}>
                      {`Rate-limit source${validSrc && dport ? ` ${srcIp}:${dport}/tcp` : ''}`}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="send-nats">Send flow to NATS</Menu.Item>
                  </Menu>
                );
              }
            });
            attackRows = built.rows;
            attackFlowColumns = built.flowColumns;
            mitigationColumns = built.mitigationColumns;
          }
          this.setState({ predictStats, attackCsv, attackRows, attackFlowColumns, mitigationColumns });
        }
      }
    }
  }

  onMitigationAction = (key, record) => {
    // Derive common fields similar to PredictOnlinePage
    const { srcIp, dstIp, sessionId, dport, pktsRate, byteRate } = this.computeFlowDetails(record);

    if (key === 'explain-lime' || key === 'explain-shap') {
      const modelId = this.state.modelId;
      const predictionId = this.props.predictStatus?.lastPredictedId || '';
      if (modelId && sessionId) {
        const qp = new URLSearchParams({ sampleId: String(sessionId) });
        if (predictionId) qp.set('predictionId', predictionId);
        const base = key === 'explain-lime' ? '/xai/lime/' : '/xai/shap/';
        const target = `${base}${encodeURIComponent(modelId)}?${qp.toString()}`;
        window.location.href = target;
      }
      return;
    }

    handleMitigationAction({
      actionKey: key,
      srcIp,
      dstIp,
      sessionId,
      dport,
      pktsRate,
      byteRate,
      isValidIPv4: this.isValidIPv4,
      flowRecord: record,
      natsSubject: 'ndr.malicious.flow'
    });
  }

  render() {
    const { app, models, reports } = this.props;
    const { modelId, isRunning, predictStats, attackCsv } = this.state;

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
    let normalFlows = 0;
    let totalFlows = 0;
    if (predictStats) {
      const predictResult = this.handleTablePredictStats(predictStats);
      tableConfig = predictResult.tableConfig;
      maliciousFlows = predictResult.maliciousFlows;
      normalFlows = predictResult.normalFlows;
      totalFlows = normalFlows + maliciousFlows;
      if (maliciousFlows > 0) {
        predictOutput = "The model predicts that the given network traffic contains Malicious activity";
      } else {
        predictOutput = "The model predicts that the given network traffic is Normal";
      }
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
        content: {
          content: totalFlows ? `${totalFlows}` : '',
          style: { fontSize: 16 },
        },
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
        title: {
          formatter: () => 'Malicious',
          style: { fontSize: 12 },
        },
        content: {
          formatter: () => `${(maliciousRate * 100).toFixed(1)}%`,
          style: { fontSize: 16 },
        },
      },
    };

    const onSyncPaginate = (pagination) => {
      this.setState({ attackPagination: { current: pagination.current, pageSize: pagination.pageSize } });
    };

    return (
      <LayoutPage pageTitle="Predict Offline" pageSubTitle={subTitle}>
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

        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Prediction Results</h1>
        </Divider>
        { predictStats && modelId && (
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
            {this.state.attackRows && this.state.attackRows.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h3 style={{ fontSize: '20px' }}>Malicious Flows</h3>
                {/* Bulk actions for all malicious flows */}
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    onClick={() => handleBulkMitigationAction({ actionKey: 'send-nats-bulk', rows: this.state.attackRows, isValidIPv4: this.isValidIPv4 })}
                    disabled={!(this.state.attackRows && this.state.attackRows.length > 0)}
                  >
                    Send ALL to NATS
                  </Button>
                </div>
                <Table
                  dataSource={this.state.attackRows}
                  columns={[...this.state.attackFlowColumns, ...this.state.mitigationColumns]}
                  size="small"
                  bordered
                  style={{ width: '100%' }}
                  scroll={{ x: 'max-content' }}
                  pagination={{ ...this.state.attackPagination, showSizeChanger: true }}
                  onChange={(pagination) => onSyncPaginate(pagination)}
                />
              </div>
            )}
            <Modal
              title="LIME Explanation"
              open={this.state.limeModalVisible}
              onCancel={() => this.setState({ limeModalVisible: false })}
              footer={<Button onClick={() => this.setState({ limeModalVisible: false })}>Close</Button>}
              width={700}
            >
              <Table
                dataSource={(this.state.limeValues || []).map((row, idx) => ({ key: idx + 1, ...row }))}
                columns={[
                  { title: 'Feature', dataIndex: 'feature' },
                  { title: 'Value', dataIndex: 'value' },
                ]}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Modal>
          </>
        )}

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
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictOfflinePage);