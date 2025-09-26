import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Divider, Form, Table, Tooltip, Upload, message, Spin, notification, Checkbox, Space } from 'antd';
import { UploadOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import Papa from 'papaparse';
import { connect } from 'react-redux';
import {
  FORM_LAYOUT,
  SERVER_URL,
} from '../constants';
import {
  requestExtractFeatures,
} from '../api';
import { handleBulkMitigationAction } from '../utils/mitigation';
import { buildAttackTable } from '../utils/attacksTable';

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
      message.success(`Uploaded ${name}`);
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

    const featureColumns = (featuresColumns && featuresColumns.length > 0) ? featuresColumns : this.buildColumns(featuresData);

    return (
      <LayoutPage pageTitle="Feature Extraction" pageSubTitle="Upload a PCAP and extract features">
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Upload and Analyze</h1>
        </Divider>
        <Form {...FORM_LAYOUT} style={{ maxWidth: 700 }}>
          <Form.Item label="Upload PCAP" name="pcap"
            rules={[
              {
              required: true,
              message: 'Please select a pcap file!',
              },
            ]}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Upload
                beforeUpload={this.beforeUploadPcap}
                action={`${SERVER_URL}/api/pcaps`}
                onChange={this.handleUploadChange}
                customRequest={this.processUploadPcap}
                maxCount={1}
                onRemove={() => this.setState({ uploadedPcapName: null })}
              >
                <Button size="large" icon={<UploadOutlined />}>Upload pcap only</Button>
              </Upload>
              <Space size={8}>
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 12 }}>
            <Button onClick={this.handleExtractFeatures} disabled={!uploadedPcapName || featuresLoading}>
              Extract Features
              {featuresLoading && (
                <Spin size="small" style={{ marginLeft: 8 }} />
              )}
            </Button>
          </div>
          </Form.Item>
        </Form>

        <Divider orientation="left" style={{ marginTop: 24 }}>
          <h1 style={{ fontSize: '24px' }}>Extracted Features</h1>
        </Divider>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
        </div>
        <div>
          <Table
            dataSource={(featuresData || []).map((r, idx) => ({ key: idx + 1, ...r }))}
            columns={featureColumns}
            size="small"
            bordered
            loading={featuresLoading}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10 }}
          />
        </div>
      </LayoutPage>
    );
  }
}

export default connect(() => ({}), () => ({}))(FeatureExtractionPage);
