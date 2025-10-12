import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayoutPage from './LayoutPage';
import { Tabs, Form, Select, Button, Table, Divider, Tooltip, Upload, Spin, message, notification, Dropdown, Menu, Modal, Card, Row, Col, Statistic, Tag, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, SendOutlined } from '@ant-design/icons';
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
      activeTab: 'online',
      // Online
      interfacesOptions: [],
      iface: null,
      intervalSec: 5,
      onlineRunning: false,
      status: null,
      // Offline
      pcapFile: null,
      offlineLoading: false,
      uploadResetKey: 0,
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
    };
  }

  onAssistantExplain = (record) => {
    try {
      const { srcIp, dstIp, sessionId, dport, pktsRate, byteRate } = computeFlowDetails(record);
      const modelId = 'rule-based';
      const predictionId = '';
      this.setState({ assistantModalVisible: true, assistantLoading: true, assistantText: '' });
      requestAssistantExplainFlow({
        flowRecord: record,
        modelId,
        predictionId,
        extra: { srcIp, dstIp, sessionId, dport, pktsRate, byteRate }
      }).then(({ text }) => {
        this.setState({ assistantText: text || '', assistantLoading: false });
      }).catch((e) => {
        this.setState({ assistantText: `Error: ${e.message || String(e)}`, assistantLoading: false });
      });
    } catch (e) {
      this.setState({ assistantModalVisible: true, assistantLoading: false, assistantText: `Error: ${e.message || String(e)}` });
    }
  }

  componentDidMount() {
    this.fetchInterfaces();
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

  pollStatus = async () => {
    try {
      const st = await requestRuleStatus();
      this.setState({ status: st, onlineRunning: !!st.running });
    } catch (e) {
      // ignore
    }
  }

  pollAlerts = async () => {
    try {
      const { alerts } = await requestRuleAlerts(500);
      const unique = this.dedupeAlerts(alerts || []);
      this.setState(prev => {
        const now = Date.now();
        const bin = Math.floor(now / 5000) * 5000; // 5-second bins
        // Total count series (keep for potential future use)
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
        const nextByRule = [...filtered, ...appended].slice(-300); // keep last ~1500s of data
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
    } catch (e) {
      return Array.isArray(list) ? list : [];
    }
  }

  tick = async () => {
    try {
      const { activeTab, onlineRunning } = this.state;
      if (activeTab === 'online' && onlineRunning) {
        await this.pollStatus();
        await this.pollAlerts();
      }
    } catch (e) {
      // ignore tick errors
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
    if (!iface) return;
    try {
      // Clear previous alerts for a fresh run
      this.setState({ alerts: [], alertSeries: [], alertSeriesByRule: [] });
      const data = await requestRuleOnlineStart({ iface, intervalSec });
      notification.success({
        message: 'Success',
        description: `Started rule-based detection on ${iface}`,
        placement: 'topRight',
      });
      this.setState({ onlineRunning: true, status: data }, () => {
        // Kick an immediate refresh after starting
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
      // Wait briefly for rule verdicts to be finalized by the server, then refresh alerts
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
      this.setState({ pcapFile: data.pcapFile, uploading: false });
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
        const menu = (
          <Menu onClick={({ key }) => key === 'explain-gpt' ? this.onAssistantExplain(row) : handleMitigationAction({ actionKey: key, srcIp, dstIp, isValidIPv4, flowRecord: row })}>
            <Menu.Item key="explain-gpt">Ask Assistant</Menu.Item>
            <Menu.Divider />
            <Menu.Item key="block-src-ip" disabled={!validSrc}>{`Block source IP${validSrc ? ` ${srcIp}` : ''}`}</Menu.Item>
            <Menu.Item key="block-dst-ip" disabled={!validDst}>{`Block destination IP${validDst ? ` ${dstIp}` : ''}`}</Menu.Item>
            <Menu.Divider />
            <Menu.Item key="send-nats">Send alert to NATS</Menu.Item>
          </Menu>
        );
        return (
          <Dropdown overlay={menu} trigger={["click"]} placement="bottomRight" getPopupContainer={() => document.body} overlayStyle={{ zIndex: 2000 }}>
            <Button size="small">Actions</Button>
          </Dropdown>
        );
      } catch (_) {
        return null;
      }
    }},
  ];

  renderOnlineTab() {
    const { interfacesOptions, iface, onlineRunning } = this.state;
    return (
      <Row gutter={4} align="middle" justify="center">
        <Col flex="none">
          <strong style={{ marginRight: 4 }}>Network Interface:</strong>
        </Col>
        <Col flex="none">
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
                  status: { ...(prev.status || {}), ruleVerdicts: [] },
                }));
              }}
              showSearch allowClear
              style={{ width: 280 }}
            />
          </Tooltip>
        </Col>
        
        <Col flex="none" style={{ marginLeft: 12 }}>
          <Space size="small">
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
          </Space>
        </Col>
        
        <Col flex="none" style={{ marginLeft: 24 }}>
          <strong style={{ marginRight: 4 }}>Status:</strong>
        </Col>
        <Col flex="none">
          <Tag color={onlineRunning ? 'green' : 'default'}>
            {onlineRunning ? 'Running' : 'Stopped'}
          </Tag>
        </Col>
      </Row>
    );
  }

  renderOfflineTab() {
    const { uploading, pcapFile } = this.state;
    return (
      <Row gutter={4} align="middle" justify="center">
        <Col flex="none">
          <strong style={{ marginRight: 4 }}>PCAP File:</strong>
        </Col>
        <Col flex="none">
          <Upload
            key={this.state.uploadResetKey}
            beforeUpload={this.beforeUploadPcap}
            action={`${SERVER_URL}/api/pcaps`}
            customRequest={this.processUploadPcap}
            onRemove={() => this.setState(prev => ({
              pcapFile: null,
              alerts: [],
              alertSeries: [],
              alertSeriesByRule: [],
              ruleCountsByCode: {},
              status: { ...(prev.status || {}), ruleVerdicts: [] },
            }))}
            maxCount={1}
            itemRender={(originNode, file, fileList, actions) => (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <code>{file.name}</code>
                <Button type="link" size="small" icon={<DeleteOutlined />} onClick={actions.remove} />
              </div>
            )}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading} style={{ width: 280 }}>
              Upload PCAP
            </Button>
          </Upload>
        </Col>
        
        <Col flex="none" style={{ marginLeft: 12 }}>
          <Button type="primary" onClick={this.handleOfflineDetect} loading={this.state.offlineLoading} disabled={!pcapFile || this.state.offlineLoading}>
            Detect
          </Button>
        </Col>
      </Row>
    );
  }

  render() {
    const { alerts } = this.state;
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
    return (
      <LayoutPage pageTitle="Rule-based detection" pageSubTitle="Detect anomalies using predefined rules using mmt_security">
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Tabs
            activeKey={this.state.activeTab}
            onChange={(k) => this.setState(prev => ({
              activeTab: k,
              alerts: [],
              alertSeries: [],
              alertSeriesByRule: [],
              ruleCountsByCode: {},
              status: { ...(prev.status || {}), ruleVerdicts: [] },
              ...(k === 'online' ? { pcapFile: null, uploading: false, offlineLoading: false, uploadResetKey: (prev.uploadResetKey || 0) + 1 } : {}),
              ...(k === 'offline' ? { iface: null } : {}),
            }))}
            items={[
              { key: 'online', label: 'Online', children: this.renderOnlineTab() },
              { key: 'offline', label: 'Offline', children: this.renderOfflineTab() },
            ]}
          />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>Detection Statistics</strong>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Rules Triggered"
                  value={rulesCount}
                  valueStyle={{ color: rulesCount > 0 ? '#cf1322' : '#3f8600', fontSize: 16 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Total Alerts"
                  value={verdictsTotal}
                  valueStyle={{ color: verdictsTotal > 0 ? '#cf1322' : '#3f8600', fontSize: 16 }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Rule-based Alerts</h2>
        </Divider>
        {(this.state.activeTab === 'online') && (chartData && chartData.length > 0) && (
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
            <Button
              icon={<SendOutlined />}
              onClick={() => handleBulkMitigationAction({ actionKey: 'send-nats-bulk', rows: alerts, isValidIPv4, entityLabel: 'alerts', titleOverride: 'Confirm bulk: Send all alerts to NATS' })}
              disabled={!(alerts && alerts.length > 0)}
            >
              Send all alerts to NATS
            </Button>
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
            <div className="assistant-markdown" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {this.state.assistantText || ''}
              </ReactMarkdown>
            </div>
          )}
        </Modal>
      </LayoutPage>
    );
  }
}

export default PredictRuleBasedPage;
