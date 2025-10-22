import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Row, Col, Divider, Space, Alert, Spin, Upload, Tag, message, notification, Checkbox, Select, Statistic, Tooltip, Table } from 'antd';
import { UploadOutlined, DownloadOutlined, ApartmentOutlined, FolderOpenOutlined, FileTextOutlined, DatabaseOutlined, CheckCircleOutlined, SendOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import Papa from 'papaparse';
import { connect } from 'react-redux';
import { useUserRole } from '../hooks/useUserRole';
import {
  FORM_LAYOUT,
  SERVER_URL,
  AD_FEATURES_DESCRIPTIONS,
  AC_FEATURES_DESCRIPTIONS,
  MAX_PCAP_SIZE_BYTES,
  MAX_PCAP_SIZE_MB,
} from '../constants';
import {
  requestExtractFeatures,
} from '../api';
import { buildAttackTable } from '../utils/attacksTable';
import FeatureCharts from '../components/FeatureCharts';
import FeatureDescriptions from '../components/FeatureDescriptions';
import { getUserHeaders, fetchWithAuth } from '../utils/fetchWithAuth';

class FeatureExtractionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      uploadedPcapName: null,
      pcapFiles: [],
      // Track if current PCAP was uploaded (vs selected from list or loaded from DPI)
      wasUploaded: false,
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
      // Track if loaded from DPI
      loadedFromDPI: false,
    };
  }

  async componentDidMount() {
    // Check if navigated from DPI page
    try {
      const pendingPcap = localStorage.getItem('pendingFeatureExtractionPcap');
      const fromDPI = localStorage.getItem('pendingFeatureExtractionFromDPI');
      if (pendingPcap) {
        // Check if there are previously extracted features for this PCAP
        try {
          const pcapToReportRaw = localStorage.getItem('pcapToReport');
          const pcapToReport = pcapToReportRaw ? JSON.parse(pcapToReportRaw) : {};
          const reportId = pcapToReport[pendingPcap];
          
          if (reportId) {
            // Try to retrieve previously extracted features
            const response = await fetch(`${SERVER_URL}/api/features/retrieve/${reportId}`);
            if (response.ok) {
              const result = await response.json();
              
              if (result && result.csvContent) {
                // Restore the features data
                const csvText = result.csvContent;
                const { rows, flowColumns } = buildAttackTable({ csvString: csvText, sortColumns: false });
                
                // Detect label choice based on presence of malware column
                let detectedLabelChoice = 'none';
                if (flowColumns && flowColumns.length > 0) {
                  const hasMalwareColumn = flowColumns.some(col => 
                    String(col.title || '').trim().toLowerCase().startsWith('malware')
                  );
                  // If malware column exists, we can't determine if it was 'normal' or 'malicious'
                  // Default to 'normal' as it's the safer choice
                  if (hasMalwareColumn) {
                    detectedLabelChoice = 'normal';
                  }
                }
                
                this.setState({ 
                  uploadedPcapName: pendingPcap,
                  loadedFromDPI: fromDPI === 'true',
                  disableUpload: true,
                  featuresCsvText: csvText,
                  featuresData: rows,
                  featuresColumns: flowColumns,
                  featuresFileName: result.csvFile || `${pendingPcap}.features.csv`,
                  featuresSessionId: result.sessionId || null,
                  featuresLoading: false,
                  labelChoice: detectedLabelChoice,
                  wasUploaded: false, // Explicitly set to false for DPI-loaded files
                });
                
                localStorage.removeItem('pendingFeatureExtractionPcap');
                localStorage.removeItem('pendingFeatureExtractionFromDPI');
                
                // Calculate actual feature count (excluding 'key' field)
                const actualFeatureCount = flowColumns.filter(col => col.dataIndex !== 'key').length;
                
                notification.success({
                  message: 'Features Restored',
                  description: `Loaded previously extracted features for "${pendingPcap}" (${rows.length} flows, ${actualFeatureCount} features)`,
                  placement: 'topRight',
                });
                
                return;
              }
            }
          }
        } catch (e) {
          console.error('Error retrieving previous features:', e);
          // Fall through to default behavior
        }
        
        // No previous features found, just load the PCAP
        this.setState({ 
          uploadedPcapName: pendingPcap,
          loadedFromDPI: fromDPI === 'true',
          disableUpload: true,  // Disable upload when loaded from DPI
          wasUploaded: false, // Explicitly set to false for DPI-loaded files
        });
        localStorage.removeItem('pendingFeatureExtractionPcap');
        localStorage.removeItem('pendingFeatureExtractionFromDPI');
        notification.info({
          message: 'PCAP Loaded from DPI',
          description: `Ready to extract features from "${pendingPcap}"`,
          placement: 'topRight',
        });
      }
    } catch (e) {
      // ignore storage errors
    }
    // Load available PCAP files from server (similar to DPI page)
    // Only load if auth is already loaded, otherwise wait for componentDidUpdate
    if (this.props.isAuthLoaded) {
      await this.loadPcapFiles();
    }
  }

  componentDidUpdate(prevProps) {
    // Load files when auth finishes loading
    if (!prevProps.isAuthLoaded && this.props.isAuthLoaded) {
      this.loadPcapFiles();
    }
  }

  loadPcapFiles = async () => {
    try {
      const res = await fetchWithAuth(`${SERVER_URL}/api/pcaps`, {}, this.props.userRole);
      if (!res.ok) return;
      const data = await res.json();
      const pcaps = (data && data.pcaps) ? data.pcaps : [];
      // Do NOT auto-select a PCAP here; keep uploadedPcapName as-is so dropdown shows when null
      this.setState((prev) => ({
        pcapFiles: pcaps,
        uploadedPcapName: prev.uploadedPcapName,
      }));
    } catch (e) {
      // silent
    }
  }

  handleViewDPI = () => {
    const { uploadedPcapName } = this.state;
    if (uploadedPcapName) {
      try {
        localStorage.setItem('pendingDPIPcap', uploadedPcapName);
        notification.success({
          message: 'Navigating to DPI',
          description: `PCAP file "${uploadedPcapName}" will be loaded for deep packet inspection.`,
          placement: 'topRight',
        });
        window.location.href = '/dpi';
      } catch (e) {
        notification.error({
          message: 'Navigation failed',
          description: e.message || String(e),
          placement: 'topRight',
        });
      }
    }
  };

  beforeUploadPcap = (file) => {
    // Check file extension
    const hasValidExtension = file.name.endsWith('.pcap') || file.name.endsWith('.pcapng') || file.name.endsWith('.cap');
    if (!hasValidExtension) {
      notification.error({
        message: 'Invalid File Type',
        description: `"${file.name}" is not a valid PCAP file. Only .pcap, .pcapng, and .cap files are allowed.`,
        placement: 'topRight',
        duration: 2,
      });
      return Upload.LIST_IGNORE;
    }
    
    // Check file size
    if (file.size > MAX_PCAP_SIZE_BYTES) {
      notification.error({
        message: 'File Too Large',
        description: `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed size of ${MAX_PCAP_SIZE_MB} MB. Please use a smaller file.`,
        placement: 'topRight',
        duration: 2,
      });
      return Upload.LIST_IGNORE;
    }
    
    return true;
  };

  processUploadPcap = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('pcapFile', file);
      
      // Add user authentication headers
      const userHeaders = getUserHeaders(this.props.userRole);
      const res = await fetch(`${SERVER_URL}/api/pcaps`, { 
        method: 'POST', 
        body: formData,
        headers: userHeaders,
      });
      
      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          const errorText = await res.text();
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.message || 'Upload failed');
      }
      
      const data = await res.json();
      onSuccess(data, res);
    } catch (e) {
      console.error('Upload error:', e);
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
      
      notification.info({
        message: 'Extracting Features',
        description: `Processing "${uploadedPcapName}"...`,
        placement: 'topRight',
        duration: 3,
      });
      const isMalicious = labelChoice === 'malicious' ? true : labelChoice === 'normal' ? false : undefined;
      const result = await requestExtractFeatures({ pcapFile: uploadedPcapName, isMalicious, userRole: this.props.userRole });
      if (!result || !result.csvContent) {
        throw new Error('No features CSV returned');
      }
      const csvText = result.csvContent;
      // Build rows and columns preserving backend feature order (AD_FEATURES from constants.py)
      const { rows, flowColumns } = buildAttackTable({ csvString: csvText, sortColumns: false });
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
      
      // Calculate actual feature count (excluding 'key' field)
      const actualFeatureCount = finalColumns.filter(col => col.dataIndex !== 'key').length;
      
      notification.success({ 
        message: 'Feature extraction completed',
        description: `Extracted ${finalRows.length} flows with ${actualFeatureCount} features from "${uploadedPcapName}"`,
        placement: 'topRight',
      });
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
    const { status, response, name, error } = info.file;
    if (status === 'uploading') {
      // no-op
    } else if (status === 'done') {
      const uploaded = (response && response.pcapFile) || (info.file.response && info.file.response.pcapFile) || null;
      const data = response || info.file.response || {};
      this.setState({ 
        uploadedPcapName: uploaded,
        loadedFromDPI: false, // Reset DPI flag when uploading new file
        wasUploaded: true,
      });
      const isDuplicate = data.alreadyExisted || false;
      notification.success({
        message: isDuplicate ? 'PCAP Already Exists' : 'PCAP Uploaded',
        description: isDuplicate 
          ? `File "${uploaded}" already exists. Using existing file for feature extraction.`
          : `File "${uploaded}" uploaded successfully and ready for feature extraction.`,
        placement: 'topRight',
      });
      // Reload the PCAP list to include the newly uploaded file
      this.loadPcapFiles();
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
    } else if (status === 'error') {
      const errorMsg = error?.message || 'Upload failed';
      notification.error({
        message: 'Upload Failed',
        description: errorMsg,
        placement: 'topRight',
        duration: 2,
      });
    }
  };

  // Removed MMT reports flow; feature extraction runs end-to-end on click

  buildColumns = (rows) => {
    if (!rows || rows.length === 0) return [];
    // Object.keys() preserves insertion order (ES2015+), so columns appear in backend order
    return Object.keys(rows[0]).map((key) => ({
      title: key,
      dataIndex: key,
      // Removed sorter to keep columns in correct order without sorting
    }));
  };

  render() {
    const { uploadedPcapName, pcapFiles, featuresLoading, featuresData, featuresCsvText, featuresColumns, loadedFromDPI } = this.state;

    // Only allow Predict Offline after feature extraction has produced results
    const featuresReady = !featuresLoading && (((featuresData || []).length > 0) || !!featuresCsvText);

    const featureColumns = (featuresColumns && featuresColumns.length > 0) ? featuresColumns : this.buildColumns(featuresData);
    
    // Calculate actual feature count (excluding 'key' field which is just for React rendering)
    const actualFeatureCount = featureColumns.filter(col => col.dataIndex !== 'key').length;

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
          {loadedFromDPI && uploadedPcapName && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue" icon={<ApartmentOutlined />}>
                Loaded from DPI Analysis
              </Tag>
            </div>
          )}
          <Row gutter={8} align="middle" justify="space-between">
            <Col flex="auto">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                <strong style={{ marginRight: 4 }}><span style={{ color: 'red' }}>* </span>PCAP File:</strong>
                {this.state.wasUploaded ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="green" style={{ margin: 0, padding: '4px 12px', fontSize: '14px' }}>
                      {uploadedPcapName}
                    </Tag>
                    <Button 
                      size="small" 
                      disabled={this.state.featuresLoading}
                      onClick={async () => {
                        await new Promise(resolve => {
                          this.setState({
                            uploadedPcapName: null,
                            wasUploaded: false,
                            featuresCsvText: '',
                            featuresData: [],
                            featuresColumns: [],
                            featuresFileName: null,
                            featuresSessionId: null,
                          }, resolve);
                        });
                        // Reload PCAP files to repopulate dropdown
                        await this.loadPcapFiles();
                      }}
                    >
                      Clear Upload
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Select
                      showSearch
                      placeholder="Select a PCAP ..."
                      style={{ width: 250 }}
                      value={uploadedPcapName || undefined}
                      allowClear
                      disabled={this.state.featuresLoading}
                      onChange={(value) => {
                        this.setState({
                          uploadedPcapName: value || null,
                          loadedFromDPI: false,
                          disableUpload: false,
                          wasUploaded: false,
                          featuresCsvText: '',
                          featuresData: [],
                          featuresColumns: [],
                          featuresFileName: null,
                          featuresSessionId: null,
                        });
                      }}
                      onClear={async () => {
                        await new Promise(resolve => {
                          this.setState({
                            uploadedPcapName: null,
                            loadedFromDPI: false,
                            disableUpload: false,
                            wasUploaded: false,
                            featuresCsvText: '',
                            featuresData: [],
                            featuresColumns: [],
                            featuresFileName: null,
                            featuresSessionId: null,
                          }, resolve);
                        });
                        await this.loadPcapFiles();
                      }}
                      filterOption={(input, option) => {
                        return option.children.props?.children?.[1]?.toLowerCase().includes(input.toLowerCase()) || false;
                      }}
                    >
                      {(() => {
                        const entries = Array.isArray(pcapFiles) ? pcapFiles : [];
                        const byName = new Map();
                        for (const item of entries) {
                          const f = typeof item === 'string' ? { name: item, type: 'sample', path: 'samples' } : item;
                          const existing = byName.get(f.name);
                          if (!existing || (existing.type !== 'user' && f.type === 'user')) {
                            byName.set(f.name, f);
                          }
                        }
                        const users = [];
                        const samples = [];
                        for (const f of byName.values()) {
                          if (f.type === 'user') users.push(f);
                          else samples.push(f);
                        }
                        users.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                        samples.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                        const renderOption = (f) => (
                          <Select.Option key={f.name} value={f.name}>
                            <span>
                              {f.type === 'user' && <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />}
                              {f.type === 'sample' && <DatabaseOutlined style={{ marginRight: 8, color: '#52c41a' }} />}
                              {f.name}
                            </span>
                          </Select.Option>
                        );
                        return [
                          ...users.map(renderOption),
                          ...samples.map(renderOption),
                        ];
                      })()}
                    </Select>
                    {this.props.isSignedIn && (
                      <Tooltip title={`Upload your own PCAP file (max ${MAX_PCAP_SIZE_MB} MB)`} placement="top">
                        <Upload
                          beforeUpload={this.beforeUploadPcap}
                          action={`${SERVER_URL}/api/pcaps`}
                          onChange={this.handleUploadChange}
                          customRequest={this.processUploadPcap}
                          maxCount={1}
                          disabled={this.state.featuresLoading}
                          showUploadList={false}
                          onRemove={() => {
                            this.setState({
                              uploadedPcapName: null,
                              featuresCsvText: '',
                              featuresData: [],
                              featuresColumns: [],
                              featuresFileName: null,
                              featuresSessionId: null,
                            }, async () => {
                              await this.loadPcapFiles();
                            });
                          }}
                        >
                          <Button icon={<UploadOutlined />} disabled={this.state.featuresLoading}>Upload PCAP</Button>
                        </Upload>
                      </Tooltip>
                    )}
                    {!this.props.isSignedIn && (
                      <Tooltip title="Sign in required">
                        <Button icon={<LockOutlined />} disabled>
                          Upload PCAP
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </Col>
            
            <Col flex="auto" style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ marginRight: 4 }}>Label:</strong>
                <Space size={6}>
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
              </div>
            </Col>
            
            <Col flex="none">
              <Space size="small">
                <Button 
                  type="primary" 
                  icon={<FolderOpenOutlined />}
                  onClick={this.handleExtractFeatures} 
                  disabled={!uploadedPcapName || featuresLoading}
                  loading={featuresLoading}
                >
                  Extract Features
                </Button>
                <Button
                  type={uploadedPcapName ? 'primary' : 'default'}
                  icon={<ApartmentOutlined />}
                  onClick={this.handleViewDPI}
                  disabled={!uploadedPcapName || featuresLoading}
                  title={featuresLoading ? 'Please wait for feature extraction to complete' : ''}
                >
                  View DPI
                </Button>
                <Button
                  type={featuresReady ? 'primary' : 'default'}
                  icon={<SendOutlined />}
                  disabled={!featuresReady || featuresLoading}
                  title={featuresLoading ? 'Please wait for feature extraction to complete' : ''}
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
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Extracted Features</h2>
        </Divider>

        {featuresData && featuresData.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>Extraction Summary</strong>
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="PCAP File"
                    value={uploadedPcapName || 'N/A'}
                    prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Extracted Flows"
                    value={featuresData.length}
                    prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                  <Statistic
                    title="Features"
                    value={actualFeatureCount}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        )}
        
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Features Table</h3>
          <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
            Tabular view of all extracted features for each network flow
          </div>
          <div style={{ marginBottom: 12 }}>
            <Space size={8}>
              <Tooltip title="Download extracted features CSV">
                <Button icon={<DownloadOutlined />} disabled={!featuresCsvText} onClick={this.downloadExtractedCsv}>
                  Download Features CSV
                </Button>
              </Tooltip>
              <Tooltip title={!this.props.userRole?.isAdmin ? "Admin access required" : "Stream all flows to NATS in chunks"}>
                <Button 
                  icon={!this.props.userRole?.isAdmin ? <LockOutlined /> : <SendOutlined />} 
                  disabled={!this.state.featuresFileName || !this.state.featuresSessionId || !this.props.userRole?.isAdmin}
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
              <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Feature Descriptions</h3>
              <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
                Detailed metadata and explanations for each extracted feature
              </div>
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

const ConnectedFeatureExtractionPage = connect(() => ({}), () => ({}))(FeatureExtractionPage);

const FeatureExtractionPageWithRole = (props) => {
  const userRole = useUserRole();
  return (
    <ConnectedFeatureExtractionPage
      {...props}
      userRole={userRole}
      isSignedIn={userRole.isSignedIn}
      isAuthLoaded={userRole.isLoaded}
    />
  );
};

export default FeatureExtractionPageWithRole;
