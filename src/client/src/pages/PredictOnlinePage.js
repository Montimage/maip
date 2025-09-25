import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Tooltip, message, Upload, Spin, Button, Form, Select, Checkbox, InputNumber, Table, Divider, Dropdown, Menu } from 'antd';
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
import { requestPredictStats, requestPredictionAttack } from "../api";
import { Pie, RingProgress } from '@ant-design/plots';
import {
  getFilteredModelsOptions,
  getLastPath,
} from "../utils";
import { handleMitigationAction } from '../utils/mitigation';
import { buildAttackTable } from '../utils/attacksTable';
import { computeFlowDetails, isValidIPv4 } from '../utils/flowDetails';

let isModelIdPresent = getLastPath() !== "online";

class PredictOnlinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      interface: null,
      interfacesOptions: [],
      windowSec: 10,
      totalDurationSec: null,
      isCapturing: false,
      status: null,
      lastProcessedFile: null,
      processedFiles: [],
      isProcessingSlice: false,
      isRunning: props.predictStatus ? props.predictStatus.isRunning : false,
      predictStats: null,
      aggregateNormal: 0,
      aggregateMalicious: 0,
      lastSliceStats: null,
      processedCsvs: [],
      attackCsv: null,
      attackRows: [],
      attackFlowColumns: [],
      mitigationColumns: [],
      attackPagination: { current: 1, pageSize: 10 },
      hasResultsShown: false,
      lastShownPredictionId: null,
      lastStatsSignature: null,
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
    if (prevProps.predictStatus && prevProps.predictStatus.isRunning !== this.props.predictStatus.isRunning) {
      this.setState({ isRunning: this.props.predictStatus.isRunning });
      if (!this.props.predictStatus.isRunning) {
        if (this.predictTimer) clearInterval(this.predictTimer);
        message.success('Online window prediction completed');
        const lastPredictId = this.props.predictStatus.lastPredictedId;
        // Only proceed if this finished prediction is new (avoid redundant chart updates)
        if (!lastPredictId || lastPredictId === this.state.lastShownPredictionId) {
          return;
        }
        try {
          const predictStats = await requestPredictStats(lastPredictId);
          // Parse counts and update aggregates
          const values = predictStats.trim().split('\n')[1].split(',');
          const normal = parseInt(values[0], 10) || 0;
          const malicious = parseInt(values[1], 10) || 0;
          const nextSignature = String(predictStats || '').trim();
          // Avoid re-updating charts if stats content hasn't changed
          if (nextSignature === this.state.lastStatsSignature) {
            return;
          }
          // Load attacks CSV for table/actions
          let attackCsv = null;
          try {
            attackCsv = await requestPredictionAttack(lastPredictId);
          } catch (e) {
            // ignore
          }
          let built = null;
          if (attackCsv) {
            built = buildAttackTable({
              csvString: attackCsv,
              onAction: (key, record) => this.onMitigationAction(key, record),
              buildMenu: (record, onAction) => {
                const { srcIp, dstIp, dport } = computeFlowDetails(record);
                const validSrc = isValidIPv4(srcIp);
                const validDst = isValidIPv4(dstIp);
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
          }
          this.setState(prev => {
            const newRows = built?.rows || [];
            const nextAttackRows = newRows.length > 0 ? [...prev.attackRows, ...newRows] : prev.attackRows;
            const attackFlowColumns = (prev.attackFlowColumns && prev.attackFlowColumns.length > 0) ? prev.attackFlowColumns : (built?.flowColumns || []);
            const mitigationColumns = (prev.mitigationColumns && prev.mitigationColumns.length > 0) ? prev.mitigationColumns : (built?.mitigationColumns || []);
            return {
            predictStats,
            lastSliceStats: predictStats,
            aggregateNormal: prev.aggregateNormal + normal,
            aggregateMalicious: prev.aggregateMalicious + malicious,
            attackCsv,
            attackRows: nextAttackRows,
            attackFlowColumns,
            mitigationColumns,
            hasResultsShown: prev.hasResultsShown || (nextAttackRows && nextAttackRows.length > 0) || !!predictStats,
            lastShownPredictionId: lastPredictId,
            lastStatsSignature: nextSignature,
          };});
        } catch (e) {
          console.error('Failed to load prediction stats:', e);
        }
      }
    }
  }

  onMitigationAction = (key, record) => {
    // Derive common fields using shared helper
    const { srcIp, dstIp, sessionId, dport, pktsRate, byteRate } = computeFlowDetails(record);

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
      isValidIPv4,
      flowRecord: record,
      natsSubject: 'ndr.malicious.flow'
    });
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

  async requestMMTOfflineByPath(filePath, outputSessionId) {
    const url = `${SERVER_URL}/api/mmt/offline`;
    const response = await fetch(url, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, outputSessionId })
    });
    const data = await response.json();
    return data;
  }

  async pollStatus() {
    try {
      const res = await fetch(`${SERVER_URL}/api/online/status`);
      const status = await res.json();
      const prev = this.state.status || {};
      const hasChanged = (
        prev.running !== status.running ||
        prev.pid !== status.pid ||
        prev.lastFile !== status.lastFile ||
        prev.prevFile !== status.prevFile
      );
      if (hasChanged) {
        this.setState({ status, isCapturing: status.running, sessionDir: status.sessionDir || this.state.sessionDir });
      }
      const { isRunning, modelId, isProcessingSlice, processedFiles } = this.state;
      // Fetch ordered file list and process the oldest unprocessed stable file
      const filesRes = await fetch(`${SERVER_URL}/api/online/files`);
      const filesData = await filesRes.json();
      const filesAsc = Array.isArray(filesData.files) ? filesData.files : [];
      if (!isRunning && !isProcessingSlice && modelId && filesAsc.length > 0) {
        const next = filesAsc.find(f => {
          const base = String(f.file).split('/').pop();
          return processedFiles.indexOf(base) === -1 && (f.ageMs === null || f.ageMs >= 1500);
        });
        if (next) {
          const base = String(next.file).split('/').pop();
          this.setState({ lastProcessedFile: next.file, processedFiles: [...processedFiles, base], isProcessingSlice: true });
          await this.processSlice(next.file);
        }
      }
      // Stop polling only when capture stopped and there are no more unprocessed files
      const remaining = filesAsc.some(f => processedFiles.indexOf(String(f.file).split('/').pop()) === -1);
      if (!status.running && !remaining && this.statusTimer) {
        clearInterval(this.statusTimer);
        this.statusTimer = null;
      }
    } catch (e) {
      console.warn('Failed to poll online status:', e.message);
    }
  }

  async processSlice(filePath) {
    try {
      const outputSessionId = this.state.status && this.state.status.outputSessionId ? this.state.status.outputSessionId : null;
      await this.requestMMTOfflineByPath(filePath, outputSessionId);
      // Use the shared reportId if provided, else fallback to session-based id
      const groupedReportId = outputSessionId ? `report-${outputSessionId}` : null;
      // Fetch CSV list using same endpoint as offline
      let csvList = [];
      for (let i = 0; i < 10; i++) { // up to ~10s
        const res = await fetch(`${SERVER_URL}/api/reports/${groupedReportId || ''}`);
        const data = await res.json();
        csvList = (data && data.csvFiles) ? data.csvFiles : [];
        if (Array.isArray(csvList) && csvList.length > 0) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!Array.isArray(csvList) || csvList.length === 0) {
        console.error('No CSV reports found for', groupedReportId || 'latest');
        this.setState({ isProcessingSlice: false });
        return;
      }
      // Choose the next unprocessed CSV (lexicographic order is chronological)
      const sortedCsv = [...csvList].sort();
      const nextCsv = sortedCsv.find(name => this.state.processedCsvs.indexOf(name) === -1);
      if (!nextCsv) {
        this.setState({ isProcessingSlice: false });
        return;
      }
      // Dispatch predict using same flow as offline
      this.props.fetchPredict(this.state.modelId, groupedReportId, nextCsv);
      this.setState(prev => ({ processedCsvs: [...prev.processedCsvs, nextCsv] }));
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
    const { modelId, interface: iface, windowSec, totalDurationSec } = this.state;
    if (!modelId || !iface) return;
    try {
      const payload = { iface, windowSec };
      if (totalDurationSec !== null && totalDurationSec !== undefined) {
        payload.totalDurationSec = totalDurationSec;
      }
      const res = await fetch(`${SERVER_URL}/api/online/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      message.success(`Started capture on ${iface} (pid ${data.pid})`);
      this.setState({ isCapturing: true, status: data, sessionDir: data.sessionDir, lastProcessedFile: null, processedFiles: [], processedCsvs: [], predictStats: null, aggregateNormal: 0, aggregateMalicious: 0, lastSliceStats: null, attackCsv: null, attackRows: [], attackFlowColumns: [], mitigationColumns: [], hasResultsShown: false, lastShownPredictionId: null });
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
      this.setState({ isCapturing: false, status: { ...(this.state.status || {}), running: false }, hasResultsShown: true });
      // Keep polling so we can finish processing remaining files; pollStatus will stop itself when done
      if (!this.statusTimer) {
        this.statusTimer = setInterval(this.pollStatus, 2000);
      }
      // Kick an immediate poll to start post-stop processing
      this.pollStatus();
      message.success('Stopped capture. Finishing remaining files...');
    } catch (e) {
      message.error(`Failed to stop capture: ${e.message}`);
    }
  }

  render() {
    const { app, models } = this.props;
    const { modelId, interfacesOptions, isCapturing, windowSec, totalDurationSec, status, predictStats, aggregateNormal, aggregateMalicious, lastSliceStats } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ?
      `Online prediction using the model ${modelId}` :
      'Online prediction using models';

    // Prefer aggregated results when available, otherwise show last slice
    let tableConfig, maliciousFlows, predictOutput;
    let normalFlows = 0;
    let totalFlows = 0;
    if (aggregateNormal > 0 || aggregateMalicious > 0) {
      normalFlows = aggregateNormal;
      maliciousFlows = aggregateMalicious;
      totalFlows = normalFlows + maliciousFlows;
      const dataSource = [{ key: 'agg', "Normal flows": String(normalFlows), "Malicious flows": String(maliciousFlows), "Total flows": String(totalFlows) }];
      const columns = [
        { title: 'Normal flows', dataIndex: 'Normal flows', align: 'center' },
        { title: 'Malicious flows', dataIndex: 'Malicious flows', align: 'center' },
        { title: 'Total flows', dataIndex: 'Total flows', align: 'center' },
      ];
      tableConfig = { dataSource, columns, pagination: false };
    } else if (lastSliceStats) {
      const values = lastSliceStats.trim().split('\n')[1].split(',');
      const n = parseInt(values[0], 10) || 0;
      const m = parseInt(values[1], 10) || 0;
      normalFlows = n; maliciousFlows = m; totalFlows = n + m;
      const dataSource = [{ key: 'last', "Normal flows": values[0], "Malicious flows": values[1], "Total flows": values[2] }];
      const columns = [
        { title: 'Normal flows', dataIndex: 'Normal flows', align: 'center' },
        { title: 'Malicious flows', dataIndex: 'Malicious flows', align: 'center' },
        { title: 'Total flows', dataIndex: 'Total flows', align: 'center' },
      ];
      tableConfig = { dataSource, columns, pagination: false };
    }
    predictOutput = maliciousFlows > 0
      ? 'The model predicts that the given network traffic contains Malicious activity'
      : 'The model predicts that the given network traffic is Normal';

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
            <InputNumber min={3} max={60} value={windowSec} defaultValue={10} onChange={(v) => this.setState({ windowSec: v || 10 })} />
          </Form.Item>
          <Form.Item name="totalDurationSec" label="Total Duration (s)" style={{ flex: 'none', marginBottom: 10 }}>
            <InputNumber
              min={windowSec}
              max={3600}
              value={totalDurationSec}
              placeholder={`Until Stop`}
              onChange={(v) => this.setState({ totalDurationSec: (v === undefined || v === null) ? null : v })}
            />
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
        {(modelId && (this.state.hasResultsShown || aggregateNormal > 0 || aggregateMalicious > 0 || lastSliceStats || (this.state.attackRows && this.state.attackRows.length > 0))) && (
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

        {this.state.attackRows && this.state.attackRows.length > 0 && (
          <>
            <Divider orientation="left">
              <h1 style={{ fontSize: '24px' }}>Malicious Flows</h1>
            </Divider>
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Table
                    dataSource={this.state.attackRows}
                    columns={[...this.state.attackFlowColumns, ...this.state.mitigationColumns]}
                    size="small"
                    style={{ width: '100%' }}
                    scroll={{ x: 'max-content' }}
                    pagination={{ ...this.state.attackPagination, showSizeChanger: true }}
                    onChange={(pagination) => this.setState({ attackPagination: { current: pagination.current, pageSize: pagination.pageSize } })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {status && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
            <div>Running: {String(status.running)}</div>
            <div>PID: {status.pid || '-'}</div>
            <div>Session dir: {status.sessionDir || '-'}</div>
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