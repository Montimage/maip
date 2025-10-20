import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayoutPage from './LayoutPage';
import { Table, Tooltip, message, notification, Upload, Spin, Button, Form, Select, Menu, Modal, Divider, Card, Row, Col, Statistic, Tag, Space, InputNumber, Alert, Typography } from 'antd';
import { UploadOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, PlayCircleOutlined, StopOutlined, LockOutlined, FileTextOutlined, SendOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import { useUserRole } from '../hooks/useUserRole';
import { Pie, RingProgress, Bar } from '@ant-design/plots';
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
  requestRunLime,
} from "../actions";
import {
  requestMMTStatus,
  requestMMTOffline,
  requestCsvReports,
  requestPredictStats,
  requestPredictionAttack,
  requestAssistantExplainFlow,
  requestPredictStatus as apiRequestPredictStatus,
} from "../api";
import {
  getFilteredModelsOptions,
  getLastPath,
} from "../utils";
import { handleMitigationAction, handleBulkMitigationAction } from '../utils/mitigation';
import { buildAttackTable } from '../utils/attacksTable';

let isModelIdPresent = getLastPath() !== "offline" && getLastPath() !== "online" && getLastPath() !== "predict";

class PredictPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Mode selection
      mode: 'offline', // 'offline' or 'online'
      
      // Offline mode
      modelId: null,
      testingPcapFile: null,
      testingDataset: null,
      
      // Online mode
      interface: null,
      interfacesOptions: [],
      windowSec: 10,
      totalDurationSec: null,
      isCapturing: false,
      status: null,
      lastProcessedFile: null,
      processedFiles: [],
      isProcessingSlice: false,
      sessionDir: null,
      processedCsvs: [],
      
      // Shared state
      isRunning: (props.predictStatus && props.predictStatus.isRunning) ? props.predictStatus.isRunning : false,
      isMMTRunning: (props.mmtStatus && props.mmtStatus.isRunning) ? props.mmtStatus.isRunning : false,
      currentJobId: null, // Job ID for queued predictions
      currentPredictionId: null, // Prediction ID for results
      predictStats: null,
      attackCsv: null,
      attackRows: [],
      attackColumns: [],
      attackFlowColumns: [],
      mitigationColumns: [],
      attackPagination: { current: 1, pageSize: 10 },
      
      // Online aggregation
      aggregateNormal: 0,
      aggregateMalicious: 0,
      lastSliceStats: null,
      hasResultsShown: false,
      lastShownPredictionId: null,
      lastStatsSignature: null,
      loadedPredictionIds: [],
      
      // Modals
      limeModalVisible: false,
      limeValues: [],
      assistantModalVisible: false,
      assistantText: '',
      assistantLoading: false,
      assistantTokenInfo: null,
    };
    this.handleButtonStart = this.handleButtonStart.bind(this);
    this.handleButtonStop = this.handleButtonStop.bind(this);
    this.pollStatus = this.pollStatus.bind(this);
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
    const path = getLastPath();
    
    // Determine initial mode from URL (with permission check)
    if (path === 'online') {
      // Only allow online mode if user has permission
      if (this.props.canPerformOnlineActions) {
        this.setState({ mode: 'online' });
      } else {
        this.setState({ mode: 'offline' });
        message.warning('Administrator privileges required for online predictions. Switched to offline mode.');
      }
    } else if (path === 'offline') {
      this.setState({ mode: 'offline' });
    }
    
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllReports();
    this.props.fetchAllModels();
    this.fetchInterfacesAndSetOptions();
    
    // Load previously uploaded PCAPs for reuse
    try {
      const raw = localStorage.getItem('uploadedPcaps');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        this.setState({ uploadedPcaps: list });
      }
    } catch (e) {
      // ignore storage errors
    }
    // If navigated from Feature Extraction with a pending PCAP/report, pre-select it and avoid re-running analysis
    try {
      const pending = localStorage.getItem('pendingPredictOfflinePcap');
      const pendingReportId = localStorage.getItem('pendingPredictOfflineReportId');
      if (pending) {
        this.setState({ mode: 'offline', testingPcapFile: pending, testingDataset: pendingReportId || null, predictStats: null }, async () => {
          if (pendingReportId) {
            // Also cache mapping for future reuse
            try {
              const raw = localStorage.getItem('pcapToReport');
              let map = raw ? JSON.parse(raw) : {};
              if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
              map[pending] = pendingReportId;
              localStorage.setItem('pcapToReport', JSON.stringify(map));
            } catch (_) {}
          } else {
            const cached = this.getCachedReportForPcap(pending);
            if (cached) {
              this.setState({ testingDataset: cached });
            } else {
              await this.startAnalysisForPcap(pending);
            }
          }
        });
        localStorage.removeItem('pendingPredictOfflinePcap');
        if (pendingReportId) localStorage.removeItem('pendingPredictOfflineReportId');
      }
    } catch (e) {
      // ignore storage errors
    }
  }
  
  componentWillUnmount() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    if (this.predictTimer) clearInterval(this.predictTimer);
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.chartRefreshTimer) clearInterval(this.chartRefreshTimer);
  }
  
  async fetchInterfacesAndSetOptions() {
    let interfacesOptions = [];
    try {
      const url = `${SERVER_URL}/api/predict/interfaces`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) throw data.error;
      const interfaces = data.interfaces;
      interfacesOptions = interfaces.map(i => {
        const dev = String(i).split(/\s*-\s*/)[0];
        return { label: i, value: dev };
      });
    } catch (error) {
      console.error('Error:', error);
    }
    this.setState({ interfacesOptions });
  }

  // Retrieve cached report id mapped to a given PCAP filename from localStorage
  getCachedReportForPcap = (pcapName) => {
    try {
      const raw = localStorage.getItem('pcapToReport');
      const map = raw ? JSON.parse(raw) : {};
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        return map[pcapName] || null;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  // Start MMT offline analysis for a given PCAP and set testingDataset to the resulting report id
  startAnalysisForPcap = async (pcapName) => {
    if (!pcapName) return null;
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    try {
      const startStatus = await requestMMTOffline(pcapName);
      if (startStatus && startStatus.sessionId) {
        const targetSessionId = startStatus.sessionId;
        const maxAttempts = 60; // ~2 minutes
        const intervalMs = 2000;
        let attempt = 0;
        while (attempt < maxAttempts) {
          const status = await requestMMTStatus();
          if (!status.isRunning && status.sessionId === targetSessionId) break;
          await delay(intervalMs);
          attempt += 1;
        }
        const reportId = `report-${targetSessionId}`;
        this.setState({ testingDataset: reportId });
        // Cache mapping for reuse later
        try {
          const raw = localStorage.getItem('pcapToReport');
          let map = raw ? JSON.parse(raw) : {};
          if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
          map[pcapName] = reportId;
          localStorage.setItem('pcapToReport', JSON.stringify(map));
        } catch (e) {
          // ignore storage errors
        }
        // Refresh reports list so the dataset appears in options
        this.props.fetchAllReports && this.props.fetchAllReports();
        notification.success({ message: 'Report ready', description: `Generated ${reportId} for ${pcapName}`, placement: 'topRight' });
        return reportId;
      }
    } catch (e) {
      console.error('Failed to start offline analysis:', e);
      notification.error({ message: 'Analysis failed', description: e.message || String(e), placement: 'topRight' });
    }
    return null;
  }

  beforeUploadPcap = (file) => {
    const isPCAP = file.name.endsWith('.pcap') || file.name.endsWith('.pcapng') || file.name.endsWith('.cap');
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
      console.log(`Uploaded successfully ${name}`);
    } else if (status === 'error') {
      message.error(`${name} upload failed.`);
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
        // Prefer existing mapping to avoid re-running analysis
        const cached = this.getCachedReportForPcap(testingPcapFile);
        if (cached) {
          updatedTestingDataset = cached;
          this.setState({ testingDataset: updatedTestingDataset });
        } else {
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
            // Cache mapping for future use
            try {
              const raw = localStorage.getItem('pcapToReport');
              let map = raw ? JSON.parse(raw) : {};
              if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
              map[testingPcapFile] = updatedTestingDataset;
              localStorage.setItem('pcapToReport', JSON.stringify(map));
            } catch (_) {}
          } else {
            console.error('Failed to start MMT offline analysis or missing sessionId');
            return;
          }
        }
      }

      if (updatedTestingDataset) {
        try {
          csvReports = await requestCsvReports(updatedTestingDataset);
          if (csvReports.length === 0) {
            console.error(`Testing dataset is not valid!`);
          } else {
            // Queue-based prediction
            console.log('Starting queued prediction:', csvReports[0], fetchModelId, updatedTestingDataset);
            
            // Call new queue-based API
            const { requestPredictOfflineQueued, requestPredictJobStatus } = require('../api');
            const queueResponse = await requestPredictOfflineQueued(fetchModelId, updatedTestingDataset, csvReports[0]);
            
            console.log('Prediction queued:', queueResponse);
            this.setState({ 
              isRunning: true,
              currentJobId: queueResponse.jobId,
              currentPredictionId: queueResponse.predictionId
            });
            
            // Poll job status instead of old predict status
            this.intervalId = setInterval(async () => {
              try {
                const jobStatus = await requestPredictJobStatus(this.state.currentJobId);
                console.log('Job status:', jobStatus.status, 'Progress:', jobStatus.progress);
                
                if (jobStatus.status === 'completed') {
                  clearInterval(this.intervalId);
                  this.intervalId = null;
                  this.setState({ isRunning: false });
                  
                  // Load prediction results manually
                  const predictionId = this.state.currentPredictionId;
                  console.log('Prediction completed, loading results for:', predictionId);
                  
                  try {
                    const { requestPredictStats, requestPredictionAttack } = require('../api');
                    const predictStats = await requestPredictStats(predictionId);
                    console.log('Fetched predictStats:', predictStats);
                    
                    let attackCsv = null;
                    try {
                      attackCsv = await requestPredictionAttack(predictionId);
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
                          const { userRole } = this.props;
                          const assistantDisabled = !userRole?.isSignedIn || userRole?.tokenLimitReached;
                          return (
                            <Menu onClick={({ key }) => onAction && onAction(key, record)}>
                              <Tooltip title={!userRole?.isSignedIn ? "Sign in required" : userRole?.tokenLimitReached ? "Token limit reached" : ""} placement="left">
                                <Menu.Item key="explain-gpt" disabled={assistantDisabled}>
                                  Ask Assistant
                                  {assistantDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                                </Menu.Item>
                              </Tooltip>
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
                              <Menu.Divider />
                              <Menu.Item key="drop-session" disabled={!(validSrc || validDst)}>
                                {`Drop session${validDst ? ` ${dstIp}` : validSrc ? ` ${srcIp}` : ''}`}
                              </Menu.Item>
                              <Menu.Divider />
                              <Tooltip title={!userRole?.isAdmin ? "Admin access required" : ""} placement="left">
                                <Menu.Item key="send-nats" disabled={!userRole?.isAdmin}>
                                  Send flow to NATS
                                  {!userRole?.isAdmin && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                                </Menu.Item>
                              </Tooltip>
                            </Menu>
                          );
                        }
                      });
                      attackRows = built.rows;
                      attackFlowColumns = built.flowColumns;
                      mitigationColumns = built.mitigationColumns;
                    }
                    
                    this.setState({ 
                      predictStats, 
                      attackCsv, 
                      attackRows, 
                      attackFlowColumns, 
                      mitigationColumns 
                    });
                    
                    notification.success({
                      message: 'Success',
                      description: 'Prediction completed successfully!',
                      placement: 'topRight',
                    });
                  } catch (error) {
                    console.error('Error loading prediction results:', error);
                    message.error('Failed to load prediction results: ' + error.message);
                  }
                } else if (jobStatus.status === 'failed') {
                  clearInterval(this.intervalId);
                  this.intervalId = null;
                  this.setState({ isRunning: false });
                  console.error('Prediction failed:', jobStatus.failedReason);
                  message.error('Prediction failed: ' + jobStatus.failedReason);
                }
              } catch (error) {
                console.error('Error polling job status:', error);
              }
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
        // Clear all prediction polling timers
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        if (this.predictTimer) {
          clearInterval(this.predictTimer);
          this.predictTimer = null;
        }
        
        const { mode } = this.state;
        if (mode === 'offline') {
          notification.success({
            message: 'Success',
            description: 'Make predictions successfully!',
            placement: 'topRight',
          });
          // Don't clear dataset/pcap - keep them to show results
          // User can manually clear them if they want to run another prediction
        } else {
          message.success('Online window prediction completed');
        }
        
        const lastPredictId = currPS.lastPredictedId || '';
        if (lastPredictId) {
          if (mode === 'online') {
            await this.appendAttackRowsFromPredictionId(lastPredictId);
          } else {
            // Offline mode: Fetch stats and attacks
            const predictStats = await requestPredictStats(lastPredictId);
            console.log('[componentDidUpdate] Fetched predictStats:', predictStats);
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
                  const { userRole } = this.props;
                  const assistantDisabled = !userRole?.isSignedIn || userRole?.tokenLimitReached;
                  const natsDisabled = !userRole?.isAdmin;
                  return (
                    <Menu onClick={({ key }) => onAction && onAction(key, record)}>
                      <Tooltip title={!userRole?.isSignedIn ? "Sign in required" : userRole?.tokenLimitReached ? "Token limit reached" : ""} placement="left">
                        <Menu.Item key="explain-gpt" disabled={assistantDisabled}>
                          Ask Assistant
                          {assistantDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                        </Menu.Item>
                      </Tooltip>
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
                      <Tooltip title={natsDisabled ? "Admin access required" : ""} placement="left">
                        <Menu.Item key="send-nats" disabled={natsDisabled}>
                          Send flow to NATS
                          {natsDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                        </Menu.Item>
                      </Tooltip>
                    </Menu>
                  );
                }
              });
              attackRows = built.rows;
              attackFlowColumns = built.flowColumns;
              mitigationColumns = built.mitigationColumns;
            }
            console.log('[componentDidUpdate] Setting state with predictStats:', predictStats);
            this.setState({ predictStats, attackCsv, attackRows, attackFlowColumns, mitigationColumns });
          }
        }
      }
    }
    
    // Online mode: append rows whenever a new prediction id is produced
    if (this.state.mode === 'online') {
      const prevLastId = prevProps.predictStatus && prevProps.predictStatus.lastPredictedId;
      const currLastId = this.props.predictStatus && this.props.predictStatus.lastPredictedId;
      if (currLastId && currLastId !== prevLastId) {
        await this.appendAttackRowsFromPredictionId(currLastId);
      }
    }
  }
  
  // Online mode: Append malicious rows for a finished prediction id
  appendAttackRowsFromPredictionId = async (predictionId) => {
    if (!predictionId) return;
    // Avoid duplicate loads
    if ((this.state.loadedPredictionIds || []).includes(predictionId)) return;
    try {
      const predictStats = await requestPredictStats(predictionId);
      const values = predictStats.trim().split('\n')[1].split(',');
      const normal = parseInt(values[0], 10) || 0;
      const malicious = parseInt(values[1], 10) || 0;
      const nextSignature = String(predictStats || '').trim();
      let attackCsv = null;
      try {
        attackCsv = await requestPredictionAttack(predictionId);
      } catch (e) {
        // ignore
      }
      let built = null;
      if (attackCsv) {
        built = buildAttackTable({
          csvString: attackCsv,
          onAction: (key, record) => this.onMitigationAction(key, record),
          buildMenu: (record, onAction) => {
            const { srcIp, dstIp, dport } = this.computeFlowDetails(record);
            const validSrc = this.isValidIPv4(srcIp);
            const validDst = this.isValidIPv4(dstIp);
            const { userRole } = this.props;
            const assistantDisabled = !userRole?.isSignedIn || userRole?.tokenLimitReached;
            return (
              <Menu onClick={({ key }) => onAction && onAction(key, record)}>
                <Tooltip title={!userRole?.isSignedIn ? "Sign in required" : userRole?.tokenLimitReached ? "Token limit reached" : ""} placement="left">
                  <Menu.Item key="explain-gpt" disabled={assistantDisabled}>
                    Ask Assistant
                    {assistantDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                  </Menu.Item>
                </Tooltip>
                <Menu.Item key="explain-shap" disabled>Explain (XAI SHAP)</Menu.Item>
                <Menu.Item key="explain-lime" disabled>Explain (XAI LIME)</Menu.Item>
                <Menu.Divider />
                <Menu.Item key="block-src-ip" disabled={!validSrc}>{`Block source IP${validSrc ? ` ${srcIp}` : ''}`}</Menu.Item>
                <Menu.Item key="block-dst-ip" disabled={!validDst}>{`Block destination IP${validDst ? ` ${dstIp}` : ''}`}</Menu.Item>
                <Menu.Divider />
                <Menu.Item key="block-dst-port" disabled={!dport}>{`Block destination port${dport ? ` ${dport}/tcp` : ''}`}</Menu.Item>
                <Menu.Item key="block-ip-port-src" disabled={!(validSrc && dport)}>{`Block${validSrc && dport ? ` ${srcIp}:${dport}/tcp` : ' srcIP:dstPort/tcp'}`}</Menu.Item>
                <Menu.Item key="block-ip-port-dst" disabled={!(validDst && dport)}>{`Block${validDst && dport ? ` ${dstIp}:${dport}/tcp` : ' dstIP:dstPort/tcp'}`}</Menu.Item>
                <Menu.Divider />
                <Menu.Item key="drop-session" disabled={!(validSrc || validDst)}>{`Drop session${validDst ? ` ${dstIp}` : validSrc ? ` ${srcIp}` : ''}`}</Menu.Item>
                <Menu.Item key="rate-limit-src" disabled={!(validSrc && dport)}>{`Rate-limit source${validSrc && dport ? ` ${srcIp}:${dport}/tcp` : ''}`}</Menu.Item>
                <Menu.Divider />
                <Tooltip title={!userRole?.isAdmin ? "Admin access required" : ""} placement="left">
                  <Menu.Item key="send-nats" disabled={!userRole?.isAdmin}>
                    Send flow to NATS
                    {!userRole?.isAdmin && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
                  </Menu.Item>
                </Tooltip>
              </Menu>
            );
          }
        });
        if (built && Array.isArray(built.rows)) {
          built.rows = built.rows.map((r, idx) => ({
            ...r,
            __predictionId: predictionId,
            __rowUid: `${predictionId}-${r.key || (idx + 1)}`,
          }));
        }
        if (built && Array.isArray(built.flowColumns)) {
          built.flowColumns = built.flowColumns.filter(col => {
            const di = String(col.dataIndex || '').toLowerCase();
            const isSessionCol = (di === 'ip.session_id' || di === 'session_id' || di.endsWith('session_id'));
            const isInternal = di.startsWith('__');
            const isMalwareCol = di.includes('malware') || di.includes('malicious');
            return !(isSessionCol || isInternal || isMalwareCol);
          });
        }
      }
      this.setState(prev => {
        const newRows = built?.rows || [];
        const nextAttackRows = newRows.length > 0 ? [...prev.attackRows, ...newRows] : prev.attackRows;
        const attackFlowColumns = (prev.attackFlowColumns && prev.attackFlowColumns.length > 0) ? prev.attackFlowColumns : (built?.flowColumns || []);
        const mitigationColumns = (prev.mitigationColumns && prev.mitigationColumns.length > 0) ? prev.mitigationColumns : (built?.mitigationColumns || []);
        const canUpdateCharts = (predictionId !== prev.lastShownPredictionId) && (nextSignature !== prev.lastStatsSignature);
        return {
          predictStats: canUpdateCharts ? predictStats : prev.predictStats,
          lastSliceStats: canUpdateCharts ? predictStats : prev.lastSliceStats,
          aggregateNormal: canUpdateCharts ? (prev.aggregateNormal + normal) : prev.aggregateNormal,
          aggregateMalicious: canUpdateCharts ? (prev.aggregateMalicious + malicious) : prev.aggregateMalicious,
          attackCsv,
          attackRows: nextAttackRows,
          attackFlowColumns,
          mitigationColumns,
          hasResultsShown: prev.hasResultsShown || (!!predictStats),
          lastShownPredictionId: canUpdateCharts ? predictionId : prev.lastShownPredictionId,
          lastStatsSignature: canUpdateCharts ? nextSignature : prev.lastStatsSignature,
          loadedPredictionIds: [...(prev.loadedPredictionIds || []), predictionId],
        };
      });
    } catch (e) {
      console.error('Failed to append rows for prediction:', predictionId, e);
    }
  }

  onMitigationAction = (key, record) => {
    // Derive common fields similar to PredictOnlinePage
    const { srcIp, dstIp, sessionId, dport, pktsRate, byteRate } = this.computeFlowDetails(record);

    if (key === 'explain-gpt') {
      const modelId = this.state.modelId;
      const predictionId = this.props.predictStatus?.lastPredictedId || '';
      const { userRole } = this.props;
      if (!modelId) return;
      this.setState({ assistantModalVisible: true, assistantLoading: true, assistantText: '', assistantTokenInfo: null });
      requestAssistantExplainFlow({
        flowRecord: record,
        modelId,
        predictionId,
        extra: { srcIp, dstIp, sessionId, dport, pktsRate, byteRate },
        userId: userRole?.userId,
        isAdmin: userRole?.isAdmin,
      }).then((resp) => {
        this.setState({ assistantText: resp.text || '', assistantLoading: false, assistantTokenInfo: resp.tokenUsage });
        
        // Show token usage notification
        if (resp.tokenUsage) {
          const { thisRequest, remaining, limit, percentUsed } = resp.tokenUsage;
          if (limit === Infinity) {
            notification.success({
              message: 'AI Explanation Generated',
              description: `Tokens used: ${thisRequest} - Unlimited (Admin)`,
              placement: 'topRight',
              duration: 4,
            });
          } else {
            const color = percentUsed >= 90 ? 'warning' : 'success';
            notification[color]({
              message: 'AI Explanation Generated',
              description: `Tokens used: ${thisRequest} - Remaining: ${remaining.toLocaleString()}/${limit.toLocaleString()} (${percentUsed}% used)`,
              placement: 'topRight',
              duration: 5,
            });
          }
        }
      }).catch((e) => {
        this.setState({ assistantText: `Error: ${e.message || String(e)}`, assistantLoading: false });
        notification.error({
          message: 'AI Assistant Error',
          description: e.message || String(e),
          placement: 'topRight',
        });
      });
      return;
    }

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

  // Online mode: Poll status and process slices
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
      const remaining = filesAsc.some(f => processedFiles.indexOf(String(f.file).split('/').pop()) === -1);
      if (!status.running && !remaining && this.statusTimer) {
        console.log('[PollStatus] Capture complete - stopping status polling');
        clearInterval(this.statusTimer);
        this.statusTimer = null;
        
        // Also clear chart refresh timer
        if (this.chartRefreshTimer) {
          clearInterval(this.chartRefreshTimer);
          this.chartRefreshTimer = null;
        }
      }
    } catch (e) {
      console.warn('Failed to poll online status:', e.message);
    }
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

  async processSlice(filePath) {
    try {
      const outputSessionId = this.state.status && this.state.status.outputSessionId ? this.state.status.outputSessionId : null;
      await this.requestMMTOfflineByPath(filePath, outputSessionId);
      const groupedReportId = outputSessionId ? `report-${outputSessionId}` : null;
      let csvList = [];
      for (let i = 0; i < 10; i++) {
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
      const sortedCsv = [...csvList].sort();
      const nextCsv = sortedCsv.find(name => this.state.processedCsvs.indexOf(name) === -1);
      if (!nextCsv) {
        this.setState({ isProcessingSlice: false });
        return;
      }
      this.props.fetchPredict(this.state.modelId, groupedReportId, nextCsv);
      this.setState(prev => ({ processedCsvs: [...prev.processedCsvs, nextCsv] }));
      if (!this.state.isRunning) {
        this.setState({ isRunning: true });
        if (this.predictTimer) clearInterval(this.predictTimer);
        this.predictTimer = setInterval(() => {
          this.props.fetchPredictStatus();
        }, 2000);
      }
      for (let i = 0; i < 20; i++) {
        try {
          const st = await apiRequestPredictStatus();
          if (st && !st.isRunning && st.lastPredictedId) {
            await this.appendAttackRowsFromPredictionId(st.lastPredictedId);
            break;
          }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      console.error('processSlice error:', e);
    } finally {
      this.setState({ isProcessingSlice: false });
    }
  }

  async handleButtonStart() {
    const { modelId, interface: iface, windowSec, totalDurationSec } = this.state;
    
    // Security check: Prevent online predictions for non-admin users
    if (!this.props.canPerformOnlineActions) {
      message.error('Administrator privileges required for online predictions');
      this.setState({ mode: 'offline' });
      return;
    }
    
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
      
      // Start chart refresh timer for online mode (force re-render every 5 seconds)
      if (this.chartRefreshTimer) clearInterval(this.chartRefreshTimer);
      this.chartRefreshTimer = setInterval(() => {
        // Force component update to refresh charts
        this.forceUpdate();
      }, 5000);
    } catch (e) {
      message.error(`Failed to start capture: ${e.message}`);
    }
  }

  async handleButtonStop() {
    try {
      const res = await fetch(`${SERVER_URL}/api/online/stop`, { method: 'POST' });
      const data = await res.json();
      
      // Stop all timers immediately
      if (this.predictTimer) {
        clearInterval(this.predictTimer);
        this.predictTimer = null;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.chartRefreshTimer) {
        clearInterval(this.chartRefreshTimer);
        this.chartRefreshTimer = null;
      }
      
      this.setState({ 
        isCapturing: false, 
        isRunning: false,
        status: { ...(this.state.status || {}), running: false }, 
        hasResultsShown: true 
      });
      
      // Keep status timer only to finish remaining files, then it will auto-stop
      if (!this.statusTimer) {
        this.statusTimer = setInterval(this.pollStatus, 2000);
      }
      this.pollStatus();
      message.success('Stopped capture. Processing remaining files...');
    } catch (e) {
      message.error(`Failed to stop capture: ${e.message}`);
    }
  }

  _relPath(path, base) {
    if (!path) return '-';
    const p = String(path);
    const b = base ? String(base) : null;
    if (b && p.startsWith(b)) return p.slice(b.length).replace(/^\//, '') || '.';
    const idx = p.indexOf('/src/');
    if (idx >= 0) return p.slice(idx + 1);
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 4) return parts.join('/');
    return '…/' + parts.slice(parts.length - 4).join('/');
  }

  render() {
    const { app, models, reports } = this.props;
    const { mode, modelId, isRunning, predictStats, isCapturing, aggregateNormal, aggregateMalicious, lastSliceStats } = this.state;

    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = 'Offline and online prediction using models';

    let tableConfig, maliciousFlows, predictOutput;
    let normalFlows = 0;
    let totalFlows = 0;
    
    // Handle both offline and online modes
    if (mode === 'online' && (aggregateNormal > 0 || aggregateMalicious > 0)) {
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
    } else if (mode === 'online' && lastSliceStats) {
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
    } else if (mode === 'offline' && predictStats) {
      const predictResult = this.handleTablePredictStats(predictStats);
      tableConfig = predictResult.tableConfig;
      maliciousFlows = predictResult.maliciousFlows;
      normalFlows = predictResult.normalFlows;
      totalFlows = normalFlows + maliciousFlows;
    }
    
    if (maliciousFlows > 0) {
      predictOutput = "The model predicts that the given network traffic contains Malicious activity";
    } else if (totalFlows > 0) {
      predictOutput = "The model predicts that the given network traffic is Normal";
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
      height: 200,
      width: 200,
      autoFit: false,
      percent: maliciousRate,
      color: ['#F4664A', '#E8EDF3'],
      statistic: {
        title: {
          formatter: () => 'Malicious',
          style: { fontSize: 14 },
        },
        content: {
          formatter: () => `${(maliciousRate * 100).toFixed(1)}%`,
          style: { fontSize: 20 },
        },
      },
    };

    const onSyncPaginate = (pagination) => {
      this.setState({ attackPagination: { current: pagination.current, pageSize: pagination.pageSize } });
    };

    // Analyze malicious flows for top sources
    const analyzeTopSources = () => {
      const { attackRows } = this.state;
      if (!attackRows || attackRows.length === 0) return null;

      const srcIpCounts = {};
      const dstIpCounts = {};
      const dstPortCounts = {};
      const protocolCounts = {};

      console.log('[Top Sources] Analyzing', attackRows.length, 'malicious flows');
      
      // Log first row to see structure
      if (attackRows.length > 0) {
        console.log('[Top Sources] First row columns:', Object.keys(attackRows[0]));
        console.log('[Top Sources] First row sample:', attackRows[0]);
      }
      
      attackRows.forEach((row, idx) => {
        // Extract IPs from ip.pkts_per_flow column which has format: "['ip1', 'ip2']"
        const pktsPerFlow = row['ip.pkts_per_flow'];
        let srcIp = null;
        let dstIp = null;
        
        if (pktsPerFlow && typeof pktsPerFlow === 'string') {
          // Parse the Python list string format: "['222.25.140.255', '222.25.140.74']"
          const matches = pktsPerFlow.match(/\['([^']+)',\s*'([^']+)'\]/);
          if (matches && matches.length === 3) {
            srcIp = matches[1];
            dstIp = matches[2];
          }
        }
        
        // Extract ports from feature columns (dport_g, dport_le are part of the 83 features)
        // Note: For online mode, port extraction may not be meaningful as features are aggregated
        const dportG = row['dport_g'];
        const dportLe = row['dport_le'];
        const sportG = row['sport_g'];
        const sportLe = row['sport_le'];
        
        // Log first few extractions
        if (idx < 3) {
          console.log(`[Top Sources] Row ${idx}:`, { srcIp, dstIp, dportG, dportLe, sportG, sportLe });
        }
        
        // Count source IPs
        if (srcIp && this.isValidIPv4(srcIp)) {
          srcIpCounts[srcIp] = (srcIpCounts[srcIp] || 0) + 1;
        }
        
        // Count destination IPs
        if (dstIp && this.isValidIPv4(dstIp)) {
          dstIpCounts[dstIp] = (dstIpCounts[dstIp] || 0) + 1;
        }
        
        // Count destination ports - try both columns
        [dportG, dportLe].forEach(dport => {
          if (dport) {
            const portNum = parseFloat(dport);
            if (!isNaN(portNum) && portNum > 0 && portNum <= 65535 && portNum === Math.floor(portNum)) {
              const portStr = String(Math.floor(portNum));
              dstPortCounts[portStr] = (dstPortCounts[portStr] || 0) + 1;
            }
          }
        });
        
        // Extract protocols from multiple possible columns
        Object.keys(row).forEach(key => {
          const keyLower = key.toLowerCase();
          // Look for protocol-related columns
          if ((keyLower.includes('proto') || keyLower.includes('protocol') || 
               keyLower === 'l4' || keyLower === 'l7') && 
              !key.startsWith('_')) {
            const proto = row[key];
            if (proto && String(proto).trim() !== '' && String(proto).trim() !== '0') {
              const protoStr = String(proto).trim();
              protocolCounts[protoStr] = (protocolCounts[protoStr] || 0) + 1;
            }
          }
        });
      });

      console.log('[Top Sources] Found:', {
        srcIPs: Object.keys(srcIpCounts).length,
        dstIPs: Object.keys(dstIpCounts).length,
        ports: Object.keys(dstPortCounts).length,
        protocols: Object.keys(protocolCounts).length
      });
      console.log('[Top Sources] srcIpCounts:', srcIpCounts);
      console.log('[Top Sources] dstPortCounts:', dstPortCounts);
      console.log('[Top Sources] protocolCounts:', protocolCounts);

      // Convert to sorted arrays (top 10)
      const topSrcIPs = Object.entries(srcIpCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ name: ip, value: count }));

      // Use destination IPs if no source IPs found
      const topDstIPs = topSrcIPs.length === 0 
        ? Object.entries(dstIpCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ip, count]) => ({ name: ip, value: count }))
        : [];

      const topDstPorts = Object.entries(dstPortCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([port, count]) => ({ name: `Port ${port}`, value: count }));

      const topProtocols = Object.entries(protocolCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([proto, count]) => ({ name: proto, value: count }));

      const result = { 
        topSrcIPs: topSrcIPs.length > 0 ? topSrcIPs : topDstIPs, 
        topDstPorts, 
        topProtocols 
      };
      
      console.log('[Top Sources] Final result:', result);
      return result;
    };

    const topSourcesData = this.state.attackRows && this.state.attackRows.length > 0 ? analyzeTopSources() : null;
    
    console.log('[Render] attackRows count:', this.state.attackRows ? this.state.attackRows.length : 0);
    console.log('[Render] topSourcesData:', topSourcesData);
    console.log('[Render] State check:', {
      mode,
      predictStats,
      modelId,
      testingDataset: this.state.testingDataset,
      testingPcapFile: this.state.testingPcapFile,
      shouldShowResults: ((mode === 'offline' && predictStats && modelId && (this.state.testingDataset || this.state.testingPcapFile)))
    });

    return (
      <LayoutPage pageTitle="Anomaly Prediction" pageSubTitle={subTitle}>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
            <Col flex="none">
              <strong style={{ marginRight: 8 }}>Mode:</strong>
            </Col>
            <Col flex="none">
              <Select
                value={mode}
                onChange={(value) => {
                  // Prevent switching to online if user doesn't have permission
                  if (value === 'online' && !this.props.canPerformOnlineActions) {
                    message.warning('Administrator privileges required for online predictions');
                    return;
                  }
                  this.setState({ 
                    mode: value,
                    predictStats: null,
                    attackRows: [],
                    aggregateNormal: 0,
                    aggregateMalicious: 0,
                    lastSliceStats: null,
                    hasResultsShown: false,
                  });
                }}
                style={{ width: 200 }}
                disabled={isRunning || isCapturing}
              >
                <Select.Option value="offline">Offline (PCAP)</Select.Option>
                <Select.Option value="online" disabled={!this.props.canPerformOnlineActions}>
                  <Tooltip title={!this.props.canPerformOnlineActions ? "Admin access required" : ""}>
                    Online (Interface) {!this.props.canPerformOnlineActions && <LockOutlined />}
                  </Tooltip>
                </Select.Option>
              </Select>
            </Col>
          </Row>
          
          <Divider style={{ margin: '16px 0' }} />
        
        {mode === 'offline' ? (
          <>
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong><span style={{ color: 'red' }}>* </span>Model:</strong>
              </Col>
              <Col span={18}>
                <Select placeholder="Select a model ..."
                  style={{ width: '100%', maxWidth: 500 }}
                  allowClear showSearch
                  value={this.state.modelId}
                  disabled={isModelIdPresent}
                  onChange={(value) => {
                    this.setState({ modelId: value, predictStats: null });
                    console.log(`Select model ${value}`);
                  }}
                  options={modelsOptions}
                />
              </Col>
            </Row>
            
            <Row gutter={16} align="top" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong><span style={{ color: 'red' }}>* </span>Dataset:</strong>
              </Col>
              <Col span={18}>
                <Select
                  placeholder="Select testing MMT reports ..."
                  showSearch allowClear
                  style={{ width: '100%', maxWidth: 500, display: 'block' }}
                  value={this.state.testingDataset}
                  onChange={(value) => {
                    // Clear all results when dataset is cleared
                    if (!value) {
                      this.setState({ 
                        testingDataset: null, 
                        predictStats: null,
                        attackRows: [],
                        attackFlowColumns: [],
                        mitigationColumns: [],
                        attackCsv: null
                      });
                    } else {
                      this.setState({ testingDataset: value, predictStats: null });
                    }
                  }}
                  options={reportsOptions}
                  disabled={this.state.testingPcapFile !== null}
                />
                <div style={{ maxWidth: '500px' }}>
                  <Upload
                    beforeUpload={this.beforeUploadPcap}
                    action={`${SERVER_URL}/api/pcaps`}
                    onChange={(info) => this.handleUploadPcap(info)}
                    customRequest={this.processUploadPcap}
                    onRemove={() => {
                      this.setState({ testingPcapFile: null });
                    }}
                  >
                    <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }}
                      disabled={!!this.state.testingPcapFile || !!this.state.testingDataset}>
                      Upload pcaps only
                    </Button>
                  </Upload>
                </div>
              </Col>
            </Row>
            
            <Row gutter={16} align="middle" style={{ marginTop: 24 }}>
              <Col span={6}></Col>
              <Col span={18}>
                <Button type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={this.handlePredictOffline}
                  disabled={ isRunning || !this.state.modelId || !(this.state.testingDataset || this.state.testingPcapFile) }
                  loading={isRunning}
                >
                  Predict
                </Button>
              </Col>
            </Row>
          </>
        ) : (
          <>
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong><span style={{ color: 'red' }}>* </span>Model:</strong>
              </Col>
              <Col span={18}>
                <Select placeholder="Select a model ..."
                  style={{ width: '100%', maxWidth: 500 }}
                  allowClear showSearch
                  value={this.state.modelId}
                  disabled={isModelIdPresent}
                  onChange={(value) => {
                    this.setState({ modelId: value });
                    console.log(`Select model ${value}`);
                  }}
                  options={modelsOptions}
                />
              </Col>
            </Row>
            
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong><span style={{ color: 'red' }}>* </span>Interface:</strong>
              </Col>
              <Col span={18}>
                <Select placeholder="Select a network interface ..."
                  style={{ width: '100%', maxWidth: 500 }}
                  allowClear showSearch
                  value={this.state.interface}
                  onChange={v => this.setState({ interface: v })}
                  options={this.state.interfacesOptions}
                />
              </Col>
            </Row>
            
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong>Window (s):</strong>
              </Col>
              <Col span={18}>
                <InputNumber 
                  min={3} 
                  max={60} 
                  value={this.state.windowSec} 
                  defaultValue={10} 
                  onChange={(v) => this.setState({ windowSec: v || 10 })}
                  style={{ width: 100 }}
                />
              </Col>
            </Row>
            
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col span={6} style={{ textAlign: 'right', paddingRight: 16 }}>
                <strong>Duration (s):</strong>
              </Col>
              <Col span={18}>
                <InputNumber
                  min={this.state.windowSec}
                  max={3600}
                  value={this.state.totalDurationSec}
                  placeholder="Until Stop"
                  onChange={(v) => this.setState({ totalDurationSec: (v === undefined || v === null) ? null : v })}
                  style={{ width: 150 }}
                />
              </Col>
            </Row>
            
            <Row gutter={16} align="middle" style={{ marginTop: 24 }}>
              <Col span={6}></Col>
              <Col span={18}>
                <Space size="small">
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={this.handleButtonStart}
                    disabled={ isCapturing || !this.state.modelId || !this.state.interface }
                  >
                    Start
                  </Button>
                  <Button
                    icon={<StopOutlined />}
                    onClick={this.handleButtonStop}
                    disabled={!isCapturing}
                  >
                    Stop
                  </Button>
                </Space>
              </Col>
            </Row>
          </>
        )}
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Prediction Results</h2>
        </Divider>
        
        { ((mode === 'offline' && predictStats && modelId && (this.state.testingDataset || this.state.testingPcapFile)) || (mode === 'online' && (this.state.hasResultsShown || aggregateNormal > 0 || aggregateMalicious > 0 || lastSliceStats || (this.state.attackRows && this.state.attackRows.length > 0)))) ? (
          <>
            {/* Flow Statistics - DPI Style */}
            <Card style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <strong style={{ fontSize: 16 }}>Prediction Summary</strong>
              </div>
              <Row gutter={8}>
                <Col xs={24} sm={8} md={4}>
                  <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff', minHeight: '92px' }}>
                    <Statistic
                      title={mode === 'offline' ? (this.state.testingPcapFile ? 'PCAP File' : 'Report') : 'Interface'}
                      value={mode === 'offline' ? (this.state.testingPcapFile || this.state.testingDataset || 'N/A') : (this.state.interface || 'N/A')}
                      valueStyle={{ fontSize: 11, fontWeight: 'bold', color: '#722ed1', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.3' }}
                      prefix={<FileTextOutlined style={{ color: '#722ed1', fontSize: '14px' }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8} md={5}>
                  <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                    <Statistic
                      title="Total Flows"
                      value={totalFlows}
                      valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8} md={5}>
                  <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                    <Statistic
                      title="Normal Flows"
                      value={normalFlows}
                      valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8} md={5}>
                  <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                    <Statistic
                      title="Malicious Flows"
                      value={maliciousFlows}
                      valueStyle={{ fontSize: 20, fontWeight: 'bold', color: maliciousFlows > 0 ? '#ff4d4f' : '#52c41a' }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8} md={5}>
                  <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                    <Statistic
                      title="Malicious Rate"
                      value={(maliciousRate * 100).toFixed(1)}
                      suffix="%"
                      valueStyle={{ fontSize: 20, fontWeight: 'bold', color: maliciousRate > 0 ? '#ff4d4f' : '#52c41a' }}
                    />
                  </Card>
                </Col>
              </Row>
              
              {/* Prediction Status Banner - Centered below the boxes, inside card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                <span style={{ fontSize: 16, fontWeight: 'bold' }}>{predictOutput}</span>
                {maliciousFlows > 0 ? (
                  <Tag color="error" icon={<WarningOutlined />}>MALICIOUS DETECTED</Tag>
                ) : (
                  <Tag color="success" icon={<CheckCircleOutlined />}>NORMAL TRAFFIC</Tag>
                )}
              </div>
            </Card>
            
            {/* Visualizations */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} lg={12}>
                <Card style={{ height: '100%' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Flow Distribution</h3>
                    <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                      Proportion of normal vs malicious flows detected by the model
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                    <Pie {...donutConfig} style={{ height: 280 }} />
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card style={{ height: '100%' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Top IP Addresses</h3>
                    <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                      IP addresses most frequently involved in malicious flows
                    </span>
                  </div>
                  {topSourcesData && topSourcesData.topSrcIPs && topSourcesData.topSrcIPs.length > 0 ? (
                    <Bar
                      data={topSourcesData.topSrcIPs}
                      xField="value"
                      yField="name"
                      seriesField="name"
                      legend={false}
                      color="#ff4d4f"
                      label={{
                        position: 'right',
                        formatter: (datum) => datum.value,
                      }}
                      height={Math.max(topSourcesData.topSrcIPs.length * 40, 280)}
                    />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#8c8c8c' }}>
                      No malicious flows detected yet
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
            
            {this.state.attackRows && this.state.attackRows.length > 0 && (
              <>
                <Divider orientation="left">
                  <h2 style={{ fontSize: '20px' }}>Malicious Flows</h2>
                </Divider>
                <Card>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Detected Malicious Flows</h3>
                    <Tooltip title={!this.props.userRole?.isAdmin ? "Admin access required" : ""}>
                      <Button
                        icon={!this.props.userRole?.isAdmin ? <LockOutlined /> : <SendOutlined />}
                        onClick={() => handleBulkMitigationAction({ actionKey: 'send-nats-bulk', rows: this.state.attackRows, isValidIPv4: this.isValidIPv4, entityLabel: 'flows', titleOverride: 'Confirm bulk: Send all to NATS' })}
                        disabled={!(this.state.attackRows && this.state.attackRows.length > 0) || !this.props.userRole?.isAdmin}
                      >
                        Send all to NATS
                      </Button>
                    </Tooltip>
                  </div>
                  <Table
                    dataSource={this.state.attackRows}
                    columns={[...this.state.attackFlowColumns, ...this.state.mitigationColumns]}
                    size="small"
                    style={{ width: '100%' }}
                    scroll={{ x: 'max-content' }}
                    pagination={{ ...this.state.attackPagination, showSizeChanger: true, showTotal: (total) => `Total ${total} flows` }}
                    onChange={(pagination) => onSyncPaginate(pagination)}
                  />
                </Card>
              </>
            )}
            
            {/* Additional Attack Analysis */}
            {topSourcesData && (topSourcesData.topDstPorts.length > 0 || topSourcesData.topProtocols.length > 0) && (
              <>
                <Divider orientation="left">
                  <h2 style={{ fontSize: '20px' }}>Attack Pattern Analysis</h2>
                </Divider>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  {topSourcesData.topDstPorts.length > 0 && (
                    <Col xs={24} lg={topSourcesData.topProtocols.length > 0 ? 12 : 24}>
                      <Card>
                        <div style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Top Destination Ports</h3>
                          <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                            Most frequently targeted ports in malicious flows
                          </span>
                        </div>
                        <Bar
                          data={topSourcesData.topDstPorts}
                          xField="value"
                          yField="name"
                          seriesField="name"
                          legend={false}
                          color="#fa8c16"
                          label={{
                            position: 'right',
                            formatter: (datum) => datum.value,
                          }}
                          height={Math.max(topSourcesData.topDstPorts.length * 40, 280)}
                        />
                      </Card>
                    </Col>
                  )}
                  
                  {topSourcesData.topProtocols.length > 0 && (
                    <Col xs={24} lg={topSourcesData.topDstPorts.length > 0 ? 12 : 24}>
                      <Card>
                        <div style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Top Protocols</h3>
                          <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                            Protocols most frequently exploited in attacks
                          </span>
                        </div>
                        <Bar
                          data={topSourcesData.topProtocols}
                          xField="value"
                          yField="name"
                          seriesField="name"
                          legend={false}
                          color="#722ed1"
                          label={{
                            position: 'right',
                            formatter: (datum) => datum.value,
                          }}
                          height={Math.max(topSourcesData.topProtocols.length * 40, 280)}
                        />
                      </Card>
                    </Col>
                  )}
                </Row>
              </>
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
            <Modal
              title="Assistant Explanation"
              open={this.state.assistantModalVisible}
              onCancel={() => this.setState({ assistantModalVisible: false })}
              footer={<Button onClick={() => this.setState({ assistantModalVisible: false })}>Close</Button>}
              width={800}
            >
              {this.state.assistantLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <Spin size="large" />
                </div>
              ) : (
                <>
                  <div className="assistant-markdown" style={{ maxHeight: 500, overflowY: 'auto' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {this.state.assistantText || ''}
                    </ReactMarkdown>
                  </div>
                  {this.state.assistantTokenInfo && (
                    <div style={{ marginTop: 16, padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        <strong>Token Usage:</strong> {this.state.assistantTokenInfo.thisRequest} tokens used this request
                        {this.state.assistantTokenInfo.limit !== Infinity && (
                          <> - <strong>Total:</strong> {this.state.assistantTokenInfo.totalUsed.toLocaleString()}/{this.state.assistantTokenInfo.limit.toLocaleString()} 
                          ({this.state.assistantTokenInfo.percentUsed}% used) - <strong>Remaining:</strong> {this.state.assistantTokenInfo.remaining.toLocaleString()} tokens</>
                        )}
                        {this.state.assistantTokenInfo.limit === Infinity && <> - <strong>Unlimited</strong> (Admin)</>}
                      </Typography.Text>
                    </div>
                  )}
                </>
              )}
            </Modal>
          </>
        ) : null}

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

// Wrap with role check
const PredictPageWithRole = (props) => {
  const userRole = useUserRole();
  return <PredictPage {...props} userRole={userRole} canPerformOnlineActions={userRole.canPerformOnlineActions} isSignedIn={userRole.isSignedIn} isAuthLoaded={userRole.isLoaded} />;
};

export default connect(mapPropsToStates, mapDispatchToProps)(PredictPageWithRole);