import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Divider, Form, Table, Tooltip, Upload, message, Spin, notification, Checkbox, Space, Card, Row, Col, Statistic } from 'antd';
import { UploadOutlined, DownloadOutlined, SendOutlined, FileTextOutlined, DatabaseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Papa from 'papaparse';
import { connect } from 'react-redux';
import {
  FORM_LAYOUT,
  SERVER_URL,
  AD_FEATURES_DESCRIPTIONS,
  AC_FEATURES_DESCRIPTIONS,
} from '../constants';
import {
  requestExtractFeatures,
} from '../api';
import { buildAttackTable } from '../utils/attacksTable';
import FeatureCharts from '../components/FeatureCharts';
import FeatureDescriptions from '../components/FeatureDescriptions';

class FeatureExtractionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      uploadedPcapName: null,
      // Optional label selection: 'none' | 'normal' | 'malicious'
      labelChoice: 'none',
      // Feature extraction results
      featuresLoading: false,
      featuresCsvText: '',
      featuresData: [],
      featuresFileName: null,
      featuresColumns: [],
      featuresSessionId: null,
      // When navigating to Predict Offline, disable upload to avoid changes mid-navigation
      disableUpload: false,
    };
  }

  beforeUploadPcap = (file) => {
    const ok = file.name.endsWith('.pcap') || file.name.endsWith('.pcapng') || file.name.endsWith('.cap');
    if (!ok) message.error(`${file.name} is not a pcap file`);
    return ok ? true : Upload.LIST_IGNORE;
  };

  processUploadPcap = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('pcapFile', file);
      const res = await fetch(`${SERVER_URL}/api/pcaps`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSuccess(data, res);
    } catch (e) {
      onError(e);
    }
  };

  handleExtractFeatures = async () => {
    const { uploadedPcapName, labelChoice } = this.state;
    if (!uploadedPcapName) {
      message.warning('Please upload a PCAP first');
      return;
    }
    try {
      this.setState({ featuresLoading: true, featuresCsvText: '', featuresData: [], featuresFileName: null, featuresSessionId: null });
      const isMalicious = labelChoice === 'malicious' ? true : labelChoice === 'normal' ? false : undefined;
      const result = await requestExtractFeatures({ pcapFile: uploadedPcapName, isMalicious });
      if (!result || !result.csvContent) {
        throw new Error('No features CSV returned');
      }
      const csvText = result.csvContent;
      // Build rows and columns using the same logic as malicious flows table
      const { rows, flowColumns } = buildAttackTable({ csvString: csvText });
      let finalColumns = flowColumns;
      let finalRows = rows;
      let finalCsvText = csvText;
      if (labelChoice === 'none') {
        // Filter out any column whose title starts with 'malware' (case-insensitive)
        const filteredColumns = (flowColumns || []).filter(c => !String(c.title || '').trim().toLowerCase().startsWith('malware'));
        const keepKeys = new Set(filteredColumns.map(c => c.dataIndex));
        const filteredRows = (rows || []).map(r => {
          const o = { ...r };
          Object.keys(o).forEach(k => { if (k !== 'key' && !keepKeys.has(k)) delete o[k]; });
          return o;
        });
        // Regenerate CSV text to exclude malware column
        try {
          const csvDataForDownload = filteredRows.map(r => {
            const obj = {};
            filteredColumns.forEach(c => { obj[c.title] = r[c.dataIndex]; });
            return obj;
          });
          finalCsvText = Papa.unparse(csvDataForDownload, { header: true });
        } catch (e) {
          // Fallback to original text if unparse fails
          finalCsvText = csvText;
        }
        finalColumns = filteredColumns;
        finalRows = filteredRows;
      }
      this.setState({
        featuresCsvText: finalCsvText,
        featuresData: finalRows,
        featuresColumns: finalColumns,
        featuresFileName: result.csvFile || `${uploadedPcapName}.features.csv`,
        featuresSessionId: result.sessionId || null,
        featuresLoading: false,
      });
      // Cache mapping PCAP -> reportId for Predict Offline page to reuse without re-running MMT
      try {
        const reportId = result.sessionId ? `report-${result.sessionId}` : null;
        if (reportId && uploadedPcapName) {
          const raw = localStorage.getItem('pcapToReport');
          let map = raw ? JSON.parse(raw) : {};
          if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
          map[uploadedPcapName] = reportId;
          localStorage.setItem('pcapToReport', JSON.stringify(map));
        }
      } catch (e) { /* ignore storage errors */ }
      notification.success({ message: 'Feature extraction completed' });
    } catch (e) {
      console.error(e);
      message.error(e.message || 'Feature extraction failed');
      this.setState({ featuresLoading: false });
    }
  };

  downloadExtractedCsv = () => {
    const { featuresCsvText, featuresFileName } = this.state;
    if (!featuresCsvText) return;
    const blob = new Blob([featuresCsvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', featuresFileName || 'features.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  sendFeaturesToNatsStreaming = async () => {
    const { featuresFileName, featuresSessionId } = this.state;
    if (!featuresFileName || !featuresSessionId) {
      message.warning('No extracted features to send');
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/security/nats-publish/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: featuresSessionId, fileName: featuresFileName, chunkLines: 1000 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      notification.success({ message: 'Sent flows to NATS', description: `Published in ${data.chunks} chunk(s)`, placement: 'topRight' });
    } catch (e) {
      notification.error({ message: 'Failed to stream features to NATS', description: e.message || String(e), placement: 'topRight' });
    }
  }

  handleUploadChange = (info) => {
    const { status, response, name } = info.file;
    if (status === 'uploading') {
      // no-op
    } else if (status === 'done') {
      const uploaded = (response && response.pcapFile) || (info.file.response && info.file.response.pcapFile) || null;
      this.setState({ uploadedPcapName: uploaded });
      try {
        if (uploaded) localStorage.setItem('lastUploadedPcap', uploaded);
        if (uploaded) {
          const raw = localStorage.getItem('uploadedPcaps');
          let list = [];
          try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
          if (!Array.isArray(list)) list = [];
          if (!list.includes(uploaded)) list.unshift(uploaded);
          // keep only recent 20
          if (list.length > 20) list = list.slice(0, 20);
          localStorage.setItem('uploadedPcaps', JSON.stringify(list));
        }
      } catch (e) {
        // ignore storage errors
      }
      // Removed success notification
    } else if (status === 'error') {
      message.error('Upload failed');
    }
  };

  // Removed MMT reports flow; feature extraction runs end-to-end on click

  buildColumns = (rows) => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({
      title: key,
      dataIndex: key,
      sorter: (a, b) => {
        const av = parseFloat(a[key]);
        const bv = parseFloat(b[key]);
        if (!isNaN(av) && !isNaN(bv)) return av - bv;
        const as = (a[key] || '').toString();
        const bs = (b[key] || '').toString();
        return as.localeCompare(bs);
      },
    }));
  };

  render() {
    const { uploadedPcapName, featuresLoading, featuresData, featuresCsvText, featuresColumns } = this.state;

    // Only allow Predict Offline after feature extraction has produced results
    const featuresReady = !featuresLoading && (((featuresData || []).length > 0) || !!featuresCsvText);

    const featureColumns = (featuresColumns && featuresColumns.length > 0) ? featuresColumns : this.buildColumns(featuresData);

    // Compute categorical feature options for bar plot using AD/AC definitions present in data
    const barCategoricalOptions = (() => {
      if (!featuresData || featuresData.length === 0) return [];
      const keys = new Set(Object.keys(featuresData[0] || {}).filter(k => k !== 'key'));
      const adKeys = Object.keys(AD_FEATURES_DESCRIPTIONS);
      const acKeys = Object.keys(AC_FEATURES_DESCRIPTIONS);
      const adOverlap = adKeys.reduce((acc, k) => acc + (keys.has(k) ? 1 : 0), 0);
      const acOverlap = acKeys.reduce((acc, k) => acc + (keys.has(k) ? 1 : 0), 0);
      const desc = adOverlap >= acOverlap ? AD_FEATURES_DESCRIPTIONS : AC_FEATURES_DESCRIPTIONS;
      return Object.entries(desc)
        .filter(([name, meta]) => meta.type === 'categorical' && keys.has(name))
        .map(([name]) => name);
    })();

    return (
      <LayoutPage pageTitle="Feature Extraction" pageSubTitle="Upload a PCAP and extract features">
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={4} align="middle" justify="space-between">
            <Col flex="none">
              <strong style={{ marginRight: 4 }}><span style={{ color: 'red' }}>* </span>PCAP File:</strong>
            </Col>
            <Col flex="none">
              <Upload
                beforeUpload={this.beforeUploadPcap}
                action={`${SERVER_URL}/api/pcaps`}
                onChange={this.handleUploadChange}
                customRequest={this.processUploadPcap}
                maxCount={1}
                disabled={this.state.disableUpload}
                onRemove={() => this.setState({
                  uploadedPcapName: null,
                  featuresCsvText: '',
                  featuresData: [],
                  featuresColumns: [],
                  featuresFileName: null,
                  featuresSessionId: null,
                })}
              >
                <Button icon={<UploadOutlined />} disabled={this.state.disableUpload} style={{ width: 280 }}>Upload PCAP</Button>
              </Upload>
            </Col>
            
            <Col flex="none" style={{ marginLeft: 12 }}>
              <strong style={{ marginRight: 4 }}>Label:</strong>
            </Col>
            <Col flex="none">
              <Space size={4}>
                <Checkbox
                  checked={this.state.labelChoice === 'normal'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    this.setState({ labelChoice: checked ? 'normal' : (this.state.labelChoice === 'normal' ? 'none' : this.state.labelChoice) });
                  }}
                >
                  Normal
                </Checkbox>
                <Checkbox
                  checked={this.state.labelChoice === 'malicious'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    this.setState({ labelChoice: checked ? 'malicious' : (this.state.labelChoice === 'malicious' ? 'none' : this.state.labelChoice) });
                  }}
                >
                  Malicious
                </Checkbox>
              </Space>
            </Col>
            
            <Col flex="none" style={{ marginLeft: 12 }}>
              <Space size={4}>
                <Button 
                  type="primary" 
                  onClick={this.handleExtractFeatures} 
                  disabled={!uploadedPcapName || featuresLoading}
                  loading={featuresLoading}
                >
                  Extract Features
                </Button>
                <Button
                  type={featuresReady ? 'primary' : 'default'}
                  disabled={!featuresReady}
                  onClick={() => {
                    this.setState({ disableUpload: true }, () => {
                      try {
                        if (uploadedPcapName) localStorage.setItem('pendingPredictOfflinePcap', uploadedPcapName);
                        if (this.state.featuresSessionId) {
                          localStorage.setItem('pendingPredictOfflineReportId', `report-${this.state.featuresSessionId}`);
                        }
                      } catch (e) { /* ignore */ }
                      window.location.href = '/predict/offline';
                    });
                  }}
                >
                  Predict Offline
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
        
        {featuresData && featuresData.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>Extraction Summary</strong>
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="PCAP File"
                    value={uploadedPcapName || 'N/A'}
                    prefix={<FileTextOutlined />}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Extracted Flows"
                    value={featuresData.length}
                    prefix={<DatabaseOutlined />}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Features"
                    value={featureColumns.length}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Extracted Features</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Features Table</h3>
          <div style={{ marginBottom: 12 }}>
            <Space size={8}>
              <Tooltip title="Download extracted features CSV">
                <Button icon={<DownloadOutlined />} disabled={!featuresCsvText} onClick={this.downloadExtractedCsv}>
                  Download Features CSV
                </Button>
              </Tooltip>
              <Tooltip title="Stream all flows to NATS in chunks">
                <Button icon={<SendOutlined />} disabled={!this.state.featuresFileName || !this.state.featuresSessionId}
                  onClick={this.sendFeaturesToNatsStreaming}>
                  Send all to NATS
                </Button>
              </Tooltip>
            </Space>
          </div>
          <Table
            dataSource={(featuresData || []).map((r, idx) => ({ key: idx + 1, ...r }))}
            columns={featureColumns}
            size="small"
            loading={featuresLoading}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} flows` }}
          />
        </Card>
        
        {featuresData && featuresData.length > 0 && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Feature Descriptions</h3>
              <FeatureDescriptions data={featuresData} showTitle={false} />
            </Card>
            
            <FeatureCharts
              data={featuresData}
              barFeatureOptions={barCategoricalOptions}
              restrictBarToOptionsOnly={true}
            />
          </>
        )}
      </LayoutPage>
    );
  }
}

export default connect(() => ({}), () => ({}))(FeatureExtractionPage);
