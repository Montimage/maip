import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Tabs, Form, Select, Button, Table, Divider, Tooltip, Upload, Spin, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
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
} from '../api';

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
      // Alerts
      alerts: [],
      polling: false,
      uploading: false,
      // Real-time alert distribution for Online mode
      alertSeries: [], // [{ time: number (ms), count: number }]
      alertSeriesByRule: [], // [{ time: number (ms, 5s bin), rule: string, count: number }]
    };
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
      message.success(`Started rule-based detection on ${iface}`);
      this.setState({ onlineRunning: true, status: data }, () => {
        // Kick an immediate refresh after starting
        this.pollStatus();
        this.pollAlerts();
      });
    } catch (e) {
      message.error(`Failed to start: ${e.message}`);
    }
  }

  handleStopOnline = async () => {
    try {
      await requestRuleOnlineStop();
      message.success('Stopped rule-based detection');
      this.setState({ onlineRunning: false });
      // Wait briefly for rule verdicts to be finalized by the server, then refresh alerts
      await this.waitForVerdicts(5000);
      await this.pollAlerts();
    } catch (e) {
      message.error(`Failed to stop: ${e.message}`);
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
      message.success(`Offline detection finished: ${data.count} alerts`);
      const unique = this.dedupeAlerts(data.alerts || []);
      this.setState(prev => ({
        alerts: unique,
        offlineLoading: false,
        // Populate ruleVerdicts into status so the Alerts summary can reflect offline runs too
        status: {
          ...(prev.status || {}),
          ruleVerdicts: Array.isArray(data.ruleVerdicts) ? data.ruleVerdicts : (prev.status?.ruleVerdicts || []),
        }
      }));
    } catch (e) {
      message.error(`Offline detection failed: ${e.message}`);
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
        return verdicts ? verdicts.verdicts : '';
      } catch {
        return '';
      }
    }},
  ];

  renderOnlineTab() {
    const { interfacesOptions, iface, intervalSec, onlineRunning } = this.state;
    return (
      <>
        <Form {...FORM_LAYOUT} style={{ maxWidth: 500 }}>
          <Form.Item label="Network interface" required>
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
                style={{ width: '100%' }}
              />
            </Tooltip>
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Button type="primary" onClick={this.handleStartOnline} disabled={onlineRunning || !iface}>Start</Button>
            <Button onClick={this.handleStopOnline} disabled={!onlineRunning}>Stop</Button>
            {onlineRunning && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Spin size="small" />
                <span>Running...</span>
              </span>
            )}
          </div>
        </Form>
      </>
    );
  }

  renderOfflineTab() {
    const { uploading, pcapFile } = this.state;
    return (
      <>
        <Form {...FORM_LAYOUT} style={{ maxWidth: 700 }}>
          <Form.Item label="PCAP file" required>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/pcaps`}
              customRequest={this.processUploadPcap}
              onRemove={() => this.setState({ pcapFile: null })}
              maxCount={1}
              itemRender={(originNode, file, fileList, actions) => (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <code>{file.name}</code>
                  <Button type="link" size="small" icon={<DeleteOutlined />} onClick={actions.remove} />
                </div>
              )}
            >
              <Button icon={<UploadOutlined />} disabled={uploading}>
                Upload pcaps only {uploading && <Spin size="small" style={{ marginLeft: 8 }} />}
              </Button>
            </Upload>
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button type="primary" onClick={this.handleOfflineDetect} disabled={!pcapFile || this.state.offlineLoading}>
              Detect
              {this.state.offlineLoading && (
                <Spin size="small" style={{ marginLeft: 8 }} />
              )}
            </Button>
          </div>
        </Form>
      </>
    );
  }

  render() {
    const { alerts } = this.state;
    const ruleVerdicts = Array.isArray(this.state.status?.ruleVerdicts) ? this.state.status.ruleVerdicts : [];
    const rulesCount = ruleVerdicts.length;
    const verdictsTotal = ruleVerdicts.reduce((sum, r) => sum + Number(r && r.verdicts ? r.verdicts : 0), 0);
    const latestBin = (this.state.alertSeries || []).reduce((m, p) => Math.max(m, Number(p.time || 0)), 0) || null;
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
      <LayoutPage pageTitle="Rule-based detection" pageSubTitle="Detect anomalies using predefined rules (mmt_security)">
        <Divider orientation="left"><h1 style={{ fontSize: '24px' }}>Parameters</h1></Divider>
        <Tabs
          activeKey={this.state.activeTab}
          onChange={(k) => this.setState({ activeTab: k })}
          items={[
            { key: 'online', label: 'Online', children: this.renderOnlineTab() },
            { key: 'offline', label: 'Offline', children: this.renderOfflineTab() },
          ]}
        />

        <Divider orientation="left"><h1 style={{ fontSize: '24px' }}>Rule-based Alerts</h1></Divider>
        {/* Real-time alert distribution by Rule (5s bins) */}
        {(chartData && chartData.length > 0) && (
          <div style={{ margin: '4px 0 12px 0' }}>
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
          </div>
        )}
        <div style={{ margin: '4px 0 8px 0', color: '#555', textAlign: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>Total: <b>{rulesCount}</b> rules, <b>{verdictsTotal}</b> alerts</span>
        </div>
        <Table
          dataSource={(alerts || []).map((a, idx) => ({ key: idx + 1, ...a }))}
          columns={this.columns}
          size="small"
          bordered
          style={{ width: '100%' }}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </LayoutPage>
    );
  }
}

export default PredictRuleBasedPage;
