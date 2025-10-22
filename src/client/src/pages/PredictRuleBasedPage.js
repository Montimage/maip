import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayoutPage from './LayoutPage';
import { Form, Select, Button, Table, Divider, Tooltip, Upload, Spin, message, notification, Dropdown, Menu, Modal, Card, Row, Col, Statistic, Tag, Space, Alert, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, SendOutlined, LockOutlined, FileTextOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useUserRole } from '../hooks/useUserRole';
import { Line } from '@ant-design/plots';
import {
  FORM_LAYOUT,
  SERVER_URL,
} from '../constants';
import {
  requestRuleStatus,
  requestRuleAlerts,
  requestRuleOnlineStart,
  requestRuleOnlineStop,
  requestRuleOffline,
  requestAssistantExplainFlow,
} from '../api';
import { handleMitigationAction, handleBulkMitigationAction } from '../utils/mitigation';
import { computeFlowDetails, isValidIPv4 } from '../utils/flowDetails';

class PredictRuleBasedPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'offline', // 'online' or 'offline'
      // Online
      interfacesOptions: [],
      iface: null,
      intervalSec: 5,
      onlineRunning: false,
      status: null,
      // Offline
      pcapFiles: [],
      pcapFile: null,
      wasUploaded: false, // Track if current PCAP was uploaded (vs selected from list)
      offlineLoading: false,
      uploadResetKey: 0,
      detectionComplete: false, // Track if detection has been run
      // Fallback per-rule counts (used notably for Offline when verdicts are not available)
      ruleCountsByCode: {},
      // Alerts
      alerts: [],
      polling: false,
      uploading: false,
      // Real-time alert distribution for Online mode
      alertSeries: [], // [{ time: number (ms), count: number }]
      alertSeriesByRule: [], // [{ time: number (ms, 5s bin), rule: string, count: number }]
      // Assistant modal
      assistantModalVisible: false,
      assistantText: '',
      assistantLoading: false,
      assistantTokenInfo: null,
    };
  }

  onAssistantExplain = (record) => {
    try {
      const { srcIp, dstIp, sessionId, dport, pktsRate, byteRate } = computeFlowDetails(record);
      const modelId = 'rule-based';
      const predictionId = '';
      const { userRole } = this.props;
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
    } catch (e) {
      this.setState({ assistantModalVisible: true, assistantLoading: false, assistantText: `Error: ${e.message || String(e)}` });
      notification.error({
        message: 'AI Assistant Error',
        description: e.message || String(e),
        placement: 'topRight',
      });
    }
  }

  componentDidMount() {
    this.fetchInterfaces();
    this.fetchPcapFiles();
    
    // Check if there's an existing online session
    this.pollStatus().then(() => {
      if (this.state.onlineRunning) {
        console.log('[RuleBased] Found existing online session');
        this.pollAlerts();
      }
    });
    
    // Start a single conditional polling loop
    this.tick();
    this.timer = setInterval(this.tick, 3000);
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  fetchInterfaces = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/predict/interfaces`);
      const data = await res.json();
      const interfaces = Array.isArray(data.interfaces) ? data.interfaces : [];
      const interfacesOptions = interfaces.map(i => {
        const dev = String(i).split(/\s*-\s*/)[0];
        return { label: i, value: dev };
      });
      this.setState({ interfacesOptions });
    } catch (e) {
      // ignore
    }
  }

  fetchPcapFiles = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/pcaps`);
      if (!res.ok) return;
      const data = await res.json();
      this.setState({ pcapFiles: data.pcaps || [] });
    } catch (e) {
      // ignore
    }
  }

  pollStatus = async () => {
    try {
      const st = await requestRuleStatus({});
      const onlineRunning = !!(st.running || st.isRunning);
      this.setState({ status: st, onlineRunning });
    } catch (e) {
      console.error('[RuleBased] pollStatus error:', e);
    }
  }

  pollAlerts = async () => {
    try {
      const { alerts } = await requestRuleAlerts(500);
      const unique = this.dedupeAlerts(alerts || []);
      this.setState(prev => {
        const now = Date.now();
        const bin = Math.floor(now / 5000) * 5000; // 5-second bins
        // Total count series
        const nextTotal = [...(prev.alertSeries || []), { time: now, count: (unique || []).length }].slice(-100);
        // Per-rule counts
        const byRule = new Map();
        (unique || []).forEach((a) => {
          const code = String(a && typeof a.code !== 'undefined' ? a.code : '');
          if (!code) return;
          byRule.set(code, (byRule.get(code) || 0) + 1);
        });
        const prevSeries = Array.isArray(prev.alertSeriesByRule) ? prev.alertSeriesByRule : [];
        // Replace entries for this bin
        const filtered = prevSeries.filter(p => p.time !== bin);
        const appended = Array.from(byRule.entries()).map(([rule, count]) => ({ time: bin, rule: String(rule), count }));
        const nextByRule = [...filtered, ...appended].slice(-300);
        return { alerts: unique, alertSeries: nextTotal, alertSeriesByRule: nextByRule };
      });
    } catch (e) {
      // ignore
    }
  }

  // Collapse redundant alerts: group by stable identity (description+src+dst) and keep the newest
  dedupeAlerts = (list) => {
    try {
      const map = new Map();
      (Array.isArray(list) ? list : []).forEach((a) => {
        const desc = String((a && a.description) || '').trim().toLowerCase();
        const src = String((a && a.srcIp) || '').trim().toLowerCase();
        const dst = String((a && a.dstIp) || '').trim().toLowerCase();
        const key = [desc, src, dst].join('|');
        const ts = Number(a && a.timestamp);
        if (!map.has(key)) {
          map.set(key, a);
        } else {
          const prev = map.get(key);
          const prevTs = Number(prev && prev.timestamp);
          // Keep the most recent alert
          if (!isNaN(ts) && (isNaN(prevTs) || ts >= prevTs)) {
            map.set(key, a);
          }
        }
      });
      return Array.from(map.values());
    } catch {
      return Array.isArray(list) ? list : [];
    }
  }

  tick = () => {
    const { mode, onlineRunning } = this.state;
    console.log('[RuleBased] Tick - mode:', mode, 'running:', onlineRunning);
    if (mode === 'online' && onlineRunning) {
      this.pollStatus().catch(() => {});
      this.pollAlerts().catch(() => {});
    }
  }

  // After Stop, verdict lines may arrive as the process exits.
  // Retry status for a short period so the Verdicts column can populate.
  waitForVerdicts = async (timeoutMs = 4000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await this.pollStatus();
      const rvs = this.state.status?.ruleVerdicts;
      if (Array.isArray(rvs) && rvs.length > 0) return true;
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  handleStartOnline = async () => {
    const { iface, intervalSec } = this.state;
    
    if (!iface) {
      notification.warning({
        message: 'No Interface Selected',
        description: 'Please select a network interface first',
        placement: 'topRight',
      });
      return;
    }
    
    try {
      // Clear previous alerts for a fresh run
      this.setState({ alerts: [], alertSeries: [], alertSeriesByRule: [], detectionComplete: true });
      const data = await requestRuleOnlineStart({ iface, intervalSec });
      
      this.setState({ onlineRunning: true, status: data }, () => {
        notification.success({
          message: 'Success',
          description: `Started rule-based detection on ${iface}`,
          placement: 'topRight',
        });
        this.pollStatus();
        this.pollAlerts();
      });
    } catch (e) {
      notification.error({
        message: 'Error',
        description: `Failed to start: ${e.message}`,
        placement: 'topRight',
      });
    }
  }

  handleStopOnline = async () => {
    try {
      await requestRuleOnlineStop();
      
      notification.success({
        message: 'Success',
        description: 'Stopped rule-based detection',
        placement: 'topRight',
      });
      this.setState({ onlineRunning: false });
      
      // Wait briefly for rule verdicts to be finalized, then refresh alerts
      await this.waitForVerdicts(5000);
      await this.pollAlerts();
    } catch (e) {
      notification.error({
        message: 'Error',
        description: `Failed to stop: ${e.message}`,
        placement: 'topRight',
      });
    }
  }

  beforeUploadPcap = (file) => {
    const ok = file && (file.name.endsWith('.pcap') || file.name.endsWith('.pcapng') || file.name.endsWith('.cap'));
    if (!ok) message.error(`${file?.name || 'File'} is not a valid pcap`);
    return ok ? true : Upload.LIST_IGNORE;
  }

  processUploadPcap = async ({ file, onSuccess, onError }) => {
    this.setState({ uploading: true });
    try {
      const formData = new FormData();
      formData.append('pcapFile', file);
      const response = await fetch(`${SERVER_URL}/api/pcaps`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      onSuccess(data, response);
      this.setState({ pcapFile: data.pcapFile, uploading: false, wasUploaded: true });
      // Refresh PCAP files list
      this.fetchPcapFiles();
    } catch (e) {
      this.setState({ uploading: false });
      onError(e);
      message.error(`Upload failed: ${e.message}`);
    }
  }

  handleOfflineDetect = async () => {
    const { pcapFile } = this.state;
    if (!pcapFile) return;
    try {
      this.setState({ offlineLoading: true });
      const data = await requestRuleOffline({ pcapFile });
      notification.success({
        message: 'Success',
        description: `Offline detection finished: ${data.count} alerts`,
        placement: 'topRight',
      });
      const unique = this.dedupeAlerts(data.alerts || []);
      // Build per-rule counts: prefer server-provided ruleVerdicts, else derive a minimal fallback from alerts
      const mapCounts = new Map();
      if (Array.isArray(data.ruleVerdicts) && data.ruleVerdicts.length > 0) {
        data.ruleVerdicts.forEach(({ rule, verdicts }) => {
          const key = String(typeof rule !== 'undefined' ? rule : '');
          if (!key) return;
          mapCounts.set(key, Number(verdicts) || 0);
        });
      } else {
        (Array.isArray(data.alerts) ? data.alerts : []).forEach((a) => {
          const key = String(typeof a?.code !== 'undefined' ? a.code : '');
          if (!key) return;
          mapCounts.set(key, (mapCounts.get(key) || 0) + 1);
        });
      }
      const ruleCountsByCode = Object.fromEntries(mapCounts.entries());
      this.setState(prev => ({
        alerts: unique,
        offlineLoading: false,
        detectionComplete: true,
        ruleCountsByCode,
        // Populate ruleVerdicts into status so the Alerts summary can reflect offline runs too
        status: {
          ...(prev.status || {}),
          ruleVerdicts: Array.isArray(data.ruleVerdicts) ? data.ruleVerdicts : (prev.status?.ruleVerdicts || []),
        }
      }));
    } catch (e) {
      notification.error({
        message: 'Error',
        description: `Offline detection failed: ${e.message}`,
        placement: 'topRight',
      });
      this.setState({ offlineLoading: false });
    }
  }

  columns = [
    { title: 'Rule', dataIndex: 'code', key: 'code', width: 80 },
    { title: 'Probe ID', dataIndex: 'probeId', key: 'probeId', width: 100 },
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', width: 180, render: (v) => {
      try { return new Date(Number(v) * 1000).toLocaleString(); } catch { return String(v); }
    }},
    { title: 'Category', dataIndex: 'category', key: 'category', width: 140, render: (v) => {
      const t = String(v || '');
      const isAttack = t.trim().toLowerCase() === 'attack';
      return <span style={isAttack ? { color: '#cf1322', fontWeight: 600 } : {}}>{t}</span>;
    }},
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Src IP', dataIndex: 'srcIp', key: 'srcIp', width: 140 },
    { title: 'Dst IP', dataIndex: 'dstIp', key: 'dstIp', width: 140 },
    { title: 'Alerts', key: 'verdicts', width: 120, render: (_, row) => {
      try {
        const verdicts = (this.state.status?.ruleVerdicts || []).find(r => Number(r.rule) === Number(row.code));
        const val = verdicts ? Number(verdicts.verdicts) : undefined;
        if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
        // Fallback to per-rule counts (notably for Offline when server did not provide verdicts)
        const key = String(typeof row?.code !== 'undefined' ? row.code : '');
        const fb = key && this.state.ruleCountsByCode ? this.state.ruleCountsByCode[key] : undefined;
        return (typeof fb === 'number' && !isNaN(fb)) ? fb : '';
      } catch {
        return '';
      }
    }},
    { title: 'Mitigation', key: 'actions', width: 140, fixed: 'right', align: 'center', render: (_, row) => {
      try {
        const { srcIp, dstIp } = computeFlowDetails(row);
        const validSrc = isValidIPv4(srcIp);
        const validDst = isValidIPv4(dstIp);
        const { userRole } = this.props;
        const assistantDisabled = !userRole?.isSignedIn || userRole?.tokenLimitReached;
        const natsDisabled = !userRole?.isAdmin;
        const menu = (
          <Menu onClick={({ key }) => key === 'explain-gpt' ? this.onAssistantExplain(row) : handleMitigationAction({ actionKey: key, srcIp, dstIp, isValidIPv4, flowRecord: row })}>
            <Menu.Item key="explain-gpt" disabled={assistantDisabled}>
              Ask Assistant
              {assistantDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="block-src-ip" disabled={!validSrc}>{`Block source IP${validSrc ? ` ${srcIp}` : ''}`}</Menu.Item>
            <Menu.Item key="block-dst-ip" disabled={!validDst}>{`Block destination IP${validDst ? ` ${dstIp}` : ''}`}</Menu.Item>
            <Menu.Divider />
            <Menu.Item key="send-nats" disabled={natsDisabled}>
              Send alert to NATS
              {natsDisabled && <LockOutlined style={{ marginLeft: 8, fontSize: '11px', color: '#ff4d4f' }} />}
            </Menu.Item>
          </Menu>
        );
        return (
          <Dropdown overlay={menu} trigger={["click"]} placement="bottomRight">
            <Button size="small">Actions</Button>
          </Dropdown>
        );
      } catch (_) {
        return null;
      }
    }},
  ];

  renderOnlineSelector() {
    const { interfacesOptions, iface, onlineRunning } = this.state;
    return (
      <Tooltip title="Select a network interface to run rule-based detection online.">
        <Select
          placeholder="Select a network interface ..."
          options={interfacesOptions}
          value={iface}
          onChange={(v) => {
            // Always clear existing alerts and charts when the interface changes or is cleared
            this.setState(prev => ({
              iface: v,
              alerts: [],
              alertSeries: [],
              alertSeriesByRule: [],
              detectionComplete: false,
              status: { ...(prev.status || {}), ruleVerdicts: [] },
            }));
          }}
          showSearch allowClear
          style={{ width: 300 }}
          disabled={onlineRunning}
        />
      </Tooltip>
    );
  }

  renderOnlineActions() {
    const { iface, onlineRunning } = this.state;
    return (
      <Space>
        <Button 
          type="primary" 
          icon={<PlayCircleOutlined />}
          onClick={this.handleStartOnline} 
          disabled={onlineRunning || !iface}
        >
          Start
        </Button>
        <Button 
          danger
          icon={<StopOutlined />}
          onClick={this.handleStopOnline} 
          disabled={!onlineRunning}
        >
          Stop
        </Button>
        <strong style={{ marginLeft: 12, marginRight: 4 }}>Status:</strong>
        <Tag color={onlineRunning ? 'green' : 'default'}>
          {onlineRunning ? 'Running' : 'Stopped'}
        </Tag>
      </Space>
    );
  }

  renderOfflineSelector() {
    const { uploading, pcapFile, pcapFiles, wasUploaded, offlineLoading } = this.state;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {wasUploaded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color="green" style={{ margin: 0, padding: '4px 12px', fontSize: '14px' }}>
              {pcapFile}
            </Tag>
            <Button 
              size="small"
              disabled={offlineLoading}
              onClick={() => {
                this.setState({
                  pcapFile: null,
                  wasUploaded: false,
                  alerts: [],
                  alertSeries: [],
                  alertSeriesByRule: [],
                  ruleCountsByCode: {},
                  detectionComplete: false,
                  status: { ...(this.state.status || {}), ruleVerdicts: [] },
                  uploadResetKey: (this.state.uploadResetKey || 0) + 1,
                });
              }}
            >
              Clear Upload
            </Button>
          </div>
        ) : (
          <Select
            placeholder="Select a PCAP file..."
            value={pcapFile}
            disabled={offlineLoading}
            onChange={(value) => this.setState({ 
              pcapFile: value,
              wasUploaded: false,
              alerts: [],
              alertSeries: [],
              alertSeriesByRule: [],
              ruleCountsByCode: {},
              detectionComplete: false,
              status: { ...(this.state.status || {}), ruleVerdicts: [] },
            })}
            showSearch allowClear
            style={{ width: 280 }}
          >
            {pcapFiles.map(file => (
              <Select.Option key={file} value={file}>{file}</Select.Option>
            ))}
          </Select>
        )}
        {!wasUploaded && this.props.isSignedIn && (
          <Upload
            key={this.state.uploadResetKey}
            beforeUpload={this.beforeUploadPcap}
            action={`${SERVER_URL}/api/pcaps`}
            customRequest={this.processUploadPcap}
            showUploadList={false}
            disabled={offlineLoading}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading || offlineLoading}>
              Upload PCAP
            </Button>
          </Upload>
        )}
        {!wasUploaded && !this.props.isSignedIn && (
          <Tooltip title="Sign in required">
            <Button icon={<LockOutlined />} disabled>
              Upload PCAP
            </Button>
          </Tooltip>
        )}
        <Button 
          type="primary" 
          onClick={this.handleOfflineDetect} 
          loading={offlineLoading} 
          disabled={!pcapFile || offlineLoading}
        >
          Detect
        </Button>
      </div>
    );
  }

  renderOfflineActions() {
    // Detect button now integrated into renderOfflineSelector
    return null;
  }


  render() {
    const { alerts, mode, onlineRunning } = this.state;
    const ruleVerdicts = Array.isArray(this.state.status?.ruleVerdicts) ? this.state.status.ruleVerdicts : [];
    let rulesCount = ruleVerdicts.length;
    let verdictsTotal = ruleVerdicts.reduce((sum, r) => sum + Number(r && r.verdicts ? r.verdicts : 0), 0);
    // Fallback for offline mode where ruleVerdicts may be unavailable: derive from alerts
    if ((rulesCount === 0 || isNaN(rulesCount)) && Array.isArray(alerts) && alerts.length > 0) {
      const uniqueRules = new Set((alerts || []).map(a => String(a && typeof a.code !== 'undefined' ? a.code : '')));
      uniqueRules.delete('');
      rulesCount = uniqueRules.size;
    }
    if ((verdictsTotal === 0 || isNaN(verdictsTotal)) && Array.isArray(alerts)) {
      verdictsTotal = alerts.length;
    }
    const timesArr = (this.state.alertSeries || []).map(p => Number(p.time) || 0);
    const minTime = timesArr.length ? Math.min(...timesArr) : null;
    const maxTime = timesArr.length ? Math.max(...timesArr) : null;
    const spanMs = (minTime !== null && maxTime !== null) ? Math.max(1, maxTime - minTime) : 60000;
    // Choose a dynamic tick count based on span (aim for 6-12 ticks)
    let dynamicTickCount = 6;
    if (spanMs <= 15000) dynamicTickCount = 6;        // <= 15s
    else if (spanMs <= 30000) dynamicTickCount = 8;   // <= 30s
    else if (spanMs <= 60000) dynamicTickCount = 10;  // <= 60s
    else dynamicTickCount = 12;                        // > 60s
    const chartData = (this.state.alertSeries || []).map(p => ({
      time: p.time, // ms timestamp; plotted as time axis
      count: p.count,
    }));
    
    const isRunning = mode === 'online' ? onlineRunning : this.state.offlineLoading;
    
    return (
      <LayoutPage pageTitle="Rule-based detection" pageSubTitle="Detect anomalies using predefined rules using mmt-security">
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="none">
              <strong style={{ fontSize: '14px' }}>Mode:</strong>
            </Col>
            <Col flex="none">
              <Select
                value={this.state.mode}
                onChange={(value) => {
                  // Prevent switching to online if user doesn't have permission
                  if (value === 'online' && !this.props.canPerformOnlineActions) {
                    message.warning('Administrator privileges required for online rule-based detection');
                    return;
                  }
                  this.setState(prev => ({ 
                    mode: value,
                    alerts: [],
                    alertSeries: [],
                    alertSeriesByRule: [],
                    ruleCountsByCode: {},
                    detectionComplete: false,
                    status: { ...(prev.status || {}), ruleVerdicts: [] },
                    ...(value === 'online' ? { pcapFile: null, uploading: false, offlineLoading: false, uploadResetKey: (prev.uploadResetKey || 0) + 1 } : {}),
                    ...(value === 'offline' ? { iface: null, onlineRunning: false } : {}),
                  }));
                }}
                style={{ width: 180 }}
                disabled={this.state.onlineRunning || this.state.offlineLoading}
              >
                <Select.Option value="offline">Offline (PCAP)</Select.Option>
                <Select.Option value="online" disabled={!this.props.canPerformOnlineActions}>
                  <Tooltip title={!this.props.canPerformOnlineActions ? "Admin access required" : ""}>
                    Online (Interface) {!this.props.canPerformOnlineActions && <LockOutlined />}
                  </Tooltip>
                </Select.Option>
              </Select>
            </Col>
            
            <Divider type="vertical" style={{ height: 32, margin: '0 16px' }} />
            
            <Col flex="none">
              <strong style={{ fontSize: '14px' }}><span style={{ color: 'red' }}>* </span>{this.state.mode === 'offline' ? 'PCAP File:' : 'Interface:'}</strong>
            </Col>
            <Col flex="auto">
              {this.state.mode === 'offline' ? this.renderOfflineSelector() : this.renderOnlineSelector()}
            </Col>
            
            {this.state.mode === 'online' && (
              <Col flex="none" style={{ marginLeft: 12 }}>
                {this.renderOnlineActions()}
              </Col>
            )}
          </Row>
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Rule-based Alerts</h2>
        </Divider>

        {this.state.detectionComplete && (
          <Card style={{ marginBottom: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>Detection Statistics</strong>
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title={mode === 'offline' ? 'PCAP File' : 'Interface'}
                    value={mode === 'offline' ? (this.state.pcapFile || 'N/A') : (this.state.iface || 'N/A')}
                    prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Rules Triggered"
                    value={rulesCount}
                    prefix={<WarningOutlined style={{ color: rulesCount > 0 ? '#cf1322' : '#52c41a' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: rulesCount > 0 ? '#cf1322' : '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Total Alerts"
                    value={verdictsTotal}
                    prefix={<CheckCircleOutlined style={{ color: verdictsTotal > 0 ? '#cf1322' : '#52c41a' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: verdictsTotal > 0 ? '#cf1322' : '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        {(this.state.mode === 'online') && (chartData && chartData.length > 0) && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Real-time Alert Distribution</h3>
            <Line
              data={chartData}
              xField="time"
              yField="count"
              height={260}
              smooth
              padding={[16, 24, 40, 48]}
              xAxis={{ type: 'time', tickCount: dynamicTickCount, label: { autoHide: true } }}
              yAxis={{ label: { formatter: v => String(v) }, title: { text: 'Number of alerts' } }}
              tooltip={{ showMarkers: true }}
              meta={{ time: { type: 'time', mask: 'HH:mm:ss' } }}
              point={{ size: 3 }}
              animation
            />
          </Card>
        )}
        
        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Detected Alerts</h3>
            <Tooltip title={!this.props.userRole?.isAdmin ? "Admin access required" : ""}>
              <Button
                icon={!this.props.userRole?.isAdmin ? <LockOutlined /> : <SendOutlined />}
                onClick={() => handleBulkMitigationAction({ actionKey: 'send-nats-bulk', rows: alerts, isValidIPv4, entityLabel: 'alerts', titleOverride: 'Confirm bulk: Send all to NATS' })}
                disabled={!(alerts && alerts.length > 0) || !this.props.userRole?.isAdmin}
              >
                Send all to NATS
              </Button>
            </Tooltip>
          </div>
          <Table
            dataSource={(alerts || []).map((a, idx) => ({ key: idx + 1, ...a }))}
            columns={this.columns}
            size="small"
            style={{ width: '100%' }}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
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
      </LayoutPage>
    );
  }
}

// Wrap with role check
const PredictRuleBasedPageWithRole = (props) => {
  const userRole = useUserRole();
  return <PredictRuleBasedPage {...props} userRole={userRole} canPerformOnlineActions={userRole.canPerformOnlineActions} isSignedIn={userRole.isSignedIn} isAuthLoaded={userRole.isLoaded} />;
};

export default PredictRuleBasedPageWithRole;
