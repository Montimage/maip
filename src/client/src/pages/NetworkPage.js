import React, { Component, useEffect, useRef } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Select, Alert, Spin, Row, Col, Divider, Space, Tag, Table, Statistic, notification, Tooltip, Empty, Upload, message } from 'antd';
import { PlayCircleOutlined, StopOutlined, GlobalOutlined, ApartmentOutlined, UserOutlined, SwapOutlined, ReloadOutlined, EnvironmentOutlined, UploadOutlined, DatabaseOutlined, LockOutlined, FolderOpenOutlined, ApiOutlined } from '@ant-design/icons';
import { Pie, Column } from '@ant-design/plots';
import { SERVER_URL, MAX_PCAP_SIZE_BYTES, MAX_PCAP_SIZE_MB } from '../constants';
import { getUserHeaders, fetchWithAuth } from '../utils/fetchWithAuth';
import { useUserRole } from '../hooks/useUserRole';

const { Option } = Select;

// Network Topology Graph Component using vis-network
const NetworkTopologyGraph = ({ nodes, edges }) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !nodes || nodes.length === 0) return;

    // Dynamically import vis-network
    import('vis-network/standalone').then((vis) => {
      const Network = vis.Network;
      const DataSet = vis.DataSet;

      // Prepare nodes data
      const nodesData = new DataSet(
        nodes.map(node => ({
          id: node.id,
          label: node.label,
          title: node.title || node.label,
          value: node.value || 1,
          shape: 'dot',
          color: {
            background: '#1890ff',
            border: '#0050b3',
            highlight: {
              background: '#40a9ff',
              border: '#096dd9',
            },
          },
        }))
      );

      // Prepare edges data
      const edgesData = new DataSet(
        edges.map(edge => ({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          title: edge.title || `${edge.from} → ${edge.to}`,
          value: edge.value || 1,
          arrows: 'to',
          color: {
            color: '#d9d9d9',
            highlight: '#1890ff',
          },
        }))
      );

      const data = {
        nodes: nodesData,
        edges: edgesData,
      };

      const options = {
        nodes: {
          shape: 'dot',
          scaling: {
            min: 10,
            max: 30,
            label: {
              enabled: true,
              min: 10,
              max: 14,
            },
          },
          font: {
            size: 12,
            face: 'Arial',
          },
        },
        edges: {
          width: 1,
          smooth: {
            type: 'continuous',
            roundness: 0.5,
          },
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 0.5,
            },
          },
        },
        physics: {
          enabled: true,
          stabilization: {
            enabled: true,
            iterations: 100,
          },
          barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.3,
            springLength: 95,
            springConstant: 0.04,
            damping: 0.09,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          navigationButtons: true,
          keyboard: true,
        },
      };

      // Create network
      networkRef.current = new Network(containerRef.current, data, options);

      // Add event listeners
      networkRef.current.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          console.log('Clicked node:', nodeId);
        }
      });
    }).catch((error) => {
      console.error('Error loading vis-network:', error);
    });

    // Cleanup
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [nodes, edges]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        height: '500px', 
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        background: '#fafafa',
      }} 
    />
  );
};

class NetworkPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Data sources
      pcapFiles: [],
      selectedPcap: null,
      uploadedPcapName: null,
      
      // Network data
      topUsers: [],
      geoLocations: [],
      topologyData: { nodes: [], edges: [] },
      topLinks: [],
      
      // Status
      isRunning: false,
      sessionId: null,
      loading: false,
      error: null,
      lastUpdate: null,
      
      // Filters
      metricType: 'dataVolume', // 'dataVolume', 'packetCount', 'sessionCount'
      topN: 20, // Number of top items to show
    };
    
    this.reloadInterval = null;
  }

  componentDidMount() {
    // Only load files if auth is already loaded, otherwise wait for componentDidUpdate
    if (this.props.isAuthLoaded) {
      this.loadPcapFiles();
    }
  }

  componentDidUpdate(prevProps) {
    // Load files when auth finishes loading
    if (!prevProps.isAuthLoaded && this.props.isAuthLoaded) {
      this.loadPcapFiles();
    }
  }

  componentWillUnmount() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }

  loadPcapFiles = async () => {
    try {
      const response = await fetchWithAuth(`${SERVER_URL}/api/pcaps`, {}, this.props.userRole);
      if (response.ok) {
        const data = await response.json();
        console.log('[Network] Loaded PCAP files:', data);
        // data contains: { pcaps: [{name, type, path}], samples: [...], userUploads: [...] }
        this.setState({
          pcapFiles: data.pcaps || [],
        });
      }
    } catch (error) {
      console.error('[Network] Error loading PCAP files:', error);
    }
  };

  loadNetworkData = async () => {
    const { selectedPcap } = this.state;
    
    if (!selectedPcap) {
      return;
    }

    this.setState({ loading: true, error: null });

    try {
      const response = await fetch(`${SERVER_URL}/api/network/analysis?pcap=${encodeURIComponent(selectedPcap)}`, {
        headers: getUserHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        this.setState({
          topUsers: data.topUsers || [],
          geoLocations: data.geoLocations || [],
          topologyData: data.topology || { nodes: [], edges: [] },
          topLinks: data.topLinks || [],
          loading: false,
          lastUpdate: new Date(),
        });
      } else {
        throw new Error('Failed to load network data');
      }
    } catch (error) {
      console.error('[Network] Error loading network data:', error);
      this.setState({
        error: error.message,
        loading: false,
      });
    }
  };

  handlePcapChange = (value) => {
    this.setState({ 
      selectedPcap: value,
      uploadedPcapName: null,
    });
  };

  handleViewNetwork = () => {
    this.loadNetworkData();
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
    const isLt = file.size <= MAX_PCAP_SIZE_BYTES;
    if (!isLt) {
      notification.error({
        message: 'File Too Large',
        description: `"${file.name}" exceeds the maximum file size of ${MAX_PCAP_SIZE_MB} MB.`,
        placement: 'topRight',
        duration: 2,
      });
      return Upload.LIST_IGNORE;
    }
    
    return true;
  };

  processUploadPcap = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('pcap', file);

    try {
      const response = await fetch(`${SERVER_URL}/api/pcaps`, {
        method: 'POST',
        headers: getUserHeaders(),
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        notification.success({
          message: 'Upload Successful',
          description: `"${file.name}" has been uploaded successfully.`,
          placement: 'topRight',
        });
        this.setState({
          uploadedPcapName: file.name,
          selectedPcap: file.name,
        });
        // Reload the PCAP list to include the newly uploaded file
        this.loadPcapFiles();
        onSuccess(data, file);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('[Network] Upload error:', error);
      const errorMsg = error?.message || 'Upload failed';
      notification.error({
        message: 'Upload Failed',
        description: errorMsg,
        placement: 'topRight',
      });
      onError(error);
    }
  };

  handleUploadChange = (info) => {
    const { status } = info.file;
    
    if (status === 'uploading') {
      this.setState({ loading: true });
    } else if (status === 'done') {
      this.setState({ loading: false });
    } else if (status === 'error') {
      this.setState({ loading: false });
    }
  };

  handleMetricChange = (value) => {
    this.setState({ metricType: value });
  };

  handleRefresh = () => {
    this.loadNetworkData();
  };

  formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  renderTopUsersTable = () => {
    const { topUsers, loading, metricType } = this.state;

    if (loading) {
      return (
        <div style={{ position: 'relative', minHeight: '400px' }}>
          <Spin spinning={true} tip="Loading top users...">
            <div style={{ minHeight: '400px' }}></div>
          </Spin>
        </div>
      );
    }

    if (!topUsers || topUsers.length === 0) {
      return (
        <Empty 
          description="No user data available. Please select a PCAP file."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    const columns = [
      {
        title: 'Rank',
        key: 'rank',
        width: 60,
        align: 'center',
        render: (text, record, index) => index + 1,
      },
      {
        title: 'IP Address',
        dataIndex: 'ip',
        key: 'ip',
        width: 150,
        ellipsis: true,
        render: (ip) => (
          <Tooltip title={ip}>
            <Tag color="blue" style={{ fontFamily: 'monospace' }}>{ip}</Tag>
          </Tooltip>
        ),
      },
      {
        title: 'Location',
        dataIndex: 'location',
        key: 'location',
        width: 150,
        ellipsis: true,
        render: (location) => location ? (
          <span>
            <EnvironmentOutlined style={{ marginRight: 4, color: '#52c41a' }} />
            {location.country || 'Unknown'}
            {location.city && ` (${location.city})`}
          </span>
        ) : <span style={{ color: '#999' }}>Unknown</span>,
      },
      {
        title: 'Sent',
        children: [
          {
            title: 'Packets',
            dataIndex: ['sent', 'packets'],
            key: 'sentPackets',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.sent?.packets || 0) - (b.sent?.packets || 0),
            render: (val) => val ? val.toLocaleString() : '-',
          },
          {
            title: 'Bytes',
            dataIndex: ['sent', 'bytes'],
            key: 'sentBytes',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.sent?.bytes || 0) - (b.sent?.bytes || 0),
            render: (val) => val ? this.formatBytes(val) : '-',
          },
        ],
      },
      {
        title: 'Received',
        children: [
          {
            title: 'Packets',
            dataIndex: ['received', 'packets'],
            key: 'receivedPackets',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.received?.packets || 0) - (b.received?.packets || 0),
            render: (val) => val ? val.toLocaleString() : '-',
          },
          {
            title: 'Bytes',
            dataIndex: ['received', 'bytes'],
            key: 'receivedBytes',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.received?.bytes || 0) - (b.received?.bytes || 0),
            render: (val) => val ? this.formatBytes(val) : '-',
          },
        ],
      },
      {
        title: 'Total',
        children: [
          {
            title: 'Packets',
            dataIndex: 'totalPackets',
            key: 'totalPackets',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.totalPackets || 0) - (b.totalPackets || 0),
            render: (val) => val ? <strong>{val.toLocaleString()}</strong> : '-',
          },
          {
            title: 'Bytes',
            dataIndex: 'totalBytes',
            key: 'totalBytes',
            align: 'right',
            width: 120,
            sorter: (a, b) => (a.totalBytes || 0) - (b.totalBytes || 0),
            render: (val) => val ? <strong>{this.formatBytes(val)}</strong> : '-',
          },
        ],
      },
      {
        title: 'Sessions',
        dataIndex: 'sessions',
        key: 'sessions',
        align: 'right',
        width: 90,
        sorter: (a, b) => (a.sessions || 0) - (b.sessions || 0),
        render: (val) => val ? val.toLocaleString() : '-',
      },
    ];

    const dataSource = topUsers.map((user, index) => ({
      key: index,
      ...user,
    }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{ 
          pageSize: 10, 
          size: 'small',
          showTotal: (total) => `Total ${total} users`,
        }}
        size="small"
        scroll={{ x: 1200, y: 400 }}
        bordered
      />
    );
  };

  renderGeoLocationMap = () => {
    const { geoLocations, loading } = this.state;

    if (loading) {
      return (
        <div style={{ position: 'relative', minHeight: '400px' }}>
          <Spin spinning={true} tip="Loading geographic data...">
            <div style={{ minHeight: '400px' }}></div>
          </Spin>
        </div>
      );
    }

    if (!geoLocations || geoLocations.length === 0) {
      return (
        <Empty 
          description="No geographic data available. Please select a PCAP file."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // Prepare data for pie chart (top countries)
    const countryData = geoLocations
      .reduce((acc, loc) => {
        const country = loc.country || 'Unknown';
        if (!acc[country]) {
          acc[country] = { country, packets: 0, bytes: 0, count: 0 };
        }
        acc[country].packets += loc.packets || 0;
        acc[country].bytes += loc.bytes || 0;
        acc[country].count += 1;
        return acc;
      }, {});

    const pieData = Object.values(countryData)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10)
      .map(item => ({
        type: item.country,
        value: item.bytes,
      }));

    const pieConfig = {
      data: pieData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      label: {
        type: 'outer',
        content: '{name} {percentage}',
      },
      interactions: [
        { type: 'element-active' },
        { type: 'pie-legend-active' },
      ],
      legend: {
        position: 'right',
      },
      tooltip: {
        formatter: (datum) => {
          return {
            name: datum.type,
            value: this.formatBytes(datum.value),
          };
        },
      },
    };

    // Table for detailed geo data
    const geoColumns = [
      {
        title: 'Country',
        dataIndex: 'country',
        key: 'country',
        width: 150,
        render: (country) => (
          <span>
            <GlobalOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {country || 'Unknown'}
          </span>
        ),
      },
      {
        title: 'City',
        dataIndex: 'city',
        key: 'city',
        width: 120,
        render: (city) => city || '-',
      },
      {
        title: 'IPs',
        dataIndex: 'ipCount',
        key: 'ipCount',
        align: 'right',
        width: 80,
        sorter: (a, b) => (a.ipCount || 0) - (b.ipCount || 0),
        render: (val) => val ? val.toLocaleString() : '-',
      },
      {
        title: 'Packets',
        dataIndex: 'packets',
        key: 'packets',
        align: 'right',
        width: 120,
        sorter: (a, b) => (a.packets || 0) - (b.packets || 0),
        render: (val) => val ? val.toLocaleString() : '-',
      },
      {
        title: 'Bytes',
        dataIndex: 'bytes',
        key: 'bytes',
        align: 'right',
        width: 120,
        sorter: (a, b) => (a.bytes || 0) - (b.bytes || 0),
        render: (val) => val ? this.formatBytes(val) : '-',
      },
      {
        title: '% of Total',
        dataIndex: 'percentage',
        key: 'percentage',
        align: 'right',
        width: 100,
        render: (val) => val ? `${val.toFixed(2)}%` : '-',
      },
    ];

    const totalBytes = geoLocations.reduce((sum, loc) => sum + (loc.bytes || 0), 0);
    const geoDataSource = Object.values(countryData)
      .map((item, index) => ({
        key: index,
        ...item,
        ipCount: item.count,
        percentage: totalBytes > 0 ? (item.bytes / totalBytes) * 100 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div style={{ height: 400 }}>
              <Pie {...pieConfig} />
            </div>
          </Col>
          <Col span={12}>
            <Table
              columns={geoColumns}
              dataSource={geoDataSource}
              pagination={{ 
                pageSize: 8, 
                size: 'small',
                showTotal: (total) => `Total ${total} locations`,
              }}
              size="small"
              scroll={{ y: 350 }}
              bordered
            />
          </Col>
        </Row>
      </div>
    );
  };

  renderNetworkTopology = () => {
    const { topologyData, loading } = this.state;

    if (loading) {
      return (
        <div style={{ position: 'relative', minHeight: '500px' }}>
          <Spin spinning={true} tip="Loading network topology...">
            <div style={{ minHeight: '500px' }}></div>
          </Spin>
        </div>
      );
    }

    if (!topologyData || !topologyData.nodes || topologyData.nodes.length === 0) {
      return (
        <Empty 
          description="No topology data available. Please select a PCAP file with network traffic."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // Render network topology graph using vis-network
    return (
      <div>
        <div style={{ marginBottom: 12, fontSize: '12px', color: '#666' }}>
          <strong>{topologyData.nodes.length}</strong> nodes | 
          <strong> {topologyData.edges.length}</strong> connections
        </div>
        <NetworkTopologyGraph 
          nodes={topologyData.nodes} 
          edges={topologyData.edges} 
        />
      </div>
    );
  };

  renderTopLinksTable = () => {
    const { topLinks, loading } = this.state;

    if (loading) {
      return (
        <div style={{ position: 'relative', minHeight: '400px' }}>
          <Spin spinning={true} tip="Loading top links...">
            <div style={{ minHeight: '400px' }}></div>
          </Spin>
        </div>
      );
    }

    if (!topLinks || topLinks.length === 0) {
      return (
        <Empty 
          description="No link data available. Please select a PCAP file."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    const columns = [
      {
        title: 'Rank',
        key: 'rank',
        width: 60,
        align: 'center',
        render: (text, record, index) => index + 1,
      },
      {
        title: 'Source IP',
        dataIndex: 'srcIP',
        key: 'srcIP',
        width: 150,
        ellipsis: true,
        render: (ip) => (
          <Tooltip title={ip}>
            <Tag color="green" style={{ fontFamily: 'monospace' }}>{ip}</Tag>
          </Tooltip>
        ),
      },
      {
        title: '',
        key: 'arrow',
        width: 40,
        align: 'center',
        render: () => <SwapOutlined style={{ color: '#1890ff' }} />,
      },
      {
        title: 'Destination IP',
        dataIndex: 'dstIP',
        key: 'dstIP',
        width: 150,
        ellipsis: true,
        render: (ip) => (
          <Tooltip title={ip}>
            <Tag color="orange" style={{ fontFamily: 'monospace' }}>{ip}</Tag>
          </Tooltip>
        ),
      },
      {
        title: 'Protocols',
        dataIndex: 'protocols',
        key: 'protocols',
        width: 150,
        ellipsis: true,
        render: (protocols) => {
          if (!protocols || protocols.length === 0) return '-';
          return protocols.map((proto, idx) => (
            <Tag key={idx} color="blue" style={{ marginBottom: 2 }}>
              {proto}
            </Tag>
          ));
        },
      },
      {
        title: 'Flows',
        dataIndex: 'flowCount',
        key: 'flowCount',
        align: 'right',
        width: 80,
        sorter: (a, b) => (a.flowCount || 0) - (b.flowCount || 0),
        render: (val) => val ? val.toLocaleString() : '-',
      },
      {
        title: 'Forward',
        children: [
          {
            title: 'Packets',
            dataIndex: ['forward', 'packets'],
            key: 'forwardPackets',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.forward?.packets || 0) - (b.forward?.packets || 0),
            render: (val) => val ? val.toLocaleString() : '-',
          },
          {
            title: 'Bytes',
            dataIndex: ['forward', 'bytes'],
            key: 'forwardBytes',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.forward?.bytes || 0) - (b.forward?.bytes || 0),
            render: (val) => val ? this.formatBytes(val) : '-',
          },
        ],
      },
      {
        title: 'Backward',
        children: [
          {
            title: 'Packets',
            dataIndex: ['backward', 'packets'],
            key: 'backwardPackets',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.backward?.packets || 0) - (b.backward?.packets || 0),
            render: (val) => val ? val.toLocaleString() : '-',
          },
          {
            title: 'Bytes',
            dataIndex: ['backward', 'bytes'],
            key: 'backwardBytes',
            align: 'right',
            width: 100,
            sorter: (a, b) => (a.backward?.bytes || 0) - (b.backward?.bytes || 0),
            render: (val) => val ? this.formatBytes(val) : '-',
          },
        ],
      },
      {
        title: 'Total Bytes',
        dataIndex: 'totalBytes',
        key: 'totalBytes',
        align: 'right',
        width: 120,
        sorter: (a, b) => (a.totalBytes || 0) - (b.totalBytes || 0),
        render: (val) => val ? <strong>{this.formatBytes(val)}</strong> : '-',
      },
    ];

    const dataSource = topLinks.map((link, index) => ({
      key: index,
      ...link,
    }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{ 
          pageSize: 10, 
          size: 'small',
          showTotal: (total) => `Total ${total} links`,
        }}
        size="small"
        scroll={{ x: 1400, y: 400 }}
        bordered
      />
    );
  };

  render() {
    const { pcapFiles, selectedPcap, uploadedPcapName, loading, error, lastUpdate, topUsers, geoLocations, topologyData, topLinks } = this.state;

    const hasData = topUsers.length > 0 || geoLocations.length > 0 || topLinks.length > 0;

    return (
      <LayoutPage 
        pageTitle="Network Analysis" 
        pageSubTitle="Analyze network topology, geographic distribution, and communication patterns from DPI results"
      >
          
          <Divider orientation="left">
            <h2 style={{ fontSize: '20px' }}>Configuration</h2>
          </Divider>
          
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={4} align="middle" justify="space-between">
              <Col flex="none">
                <strong style={{ marginRight: 4 }}><span style={{ color: 'red' }}>* </span>PCAP File:</strong>
              </Col>
              <Col flex="none">
                {uploadedPcapName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="green" style={{ margin: 0, padding: '4px 12px', fontSize: '14px' }}>
                      {uploadedPcapName}
                    </Tag>
                    <Button 
                      size="small" 
                      disabled={loading}
                      onClick={() => {
                        this.setState({
                          uploadedPcapName: null,
                          selectedPcap: null,
                          topUsers: [],
                          geoLocations: [],
                          topologyData: { nodes: [], edges: [] },
                          topLinks: [],
                          lastUpdate: null,
                        });
                      }}
                    >
                      Clear Upload
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Select
                      value={selectedPcap || undefined}
                      onChange={this.handlePcapChange}
                      style={{ width: 300 }}
                      disabled={loading}
                      placeholder="Select a PCAP file..."
                      allowClear
                    >
                      {(() => {
                        const entries = Array.isArray(pcapFiles) ? pcapFiles : [];
                        const byName = new Map();
                        for (const item of entries) {
                          const f = typeof item === 'string' ? { name: item, type: 'sample', path: 'samples' } : item;
                          const key = f.name;
                          const existing = byName.get(key);
                          if (!existing || (existing.type !== 'user' && f.type === 'user')) {
                            byName.set(key, f);
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
                          <Option key={f.name} value={f.name}>
                            {f.type === 'user' && <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />}
                            {f.type === 'sample' && <DatabaseOutlined style={{ marginRight: 8, color: '#52c41a' }} />}
                            {f.name}
                          </Option>
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
                          disabled={loading}
                          showUploadList={false}
                        >
                          <Button icon={<UploadOutlined />} disabled={loading}>
                            Upload PCAP
                          </Button>
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
              </Col>
              
              <Col flex="none" style={{ marginLeft: 12 }}>
                <Button 
                  type="primary"
                  icon={<ApiOutlined />}
                  onClick={this.handleViewNetwork}
                  loading={loading}
                  disabled={!selectedPcap}
                >
                  View Network
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              closable
              onClose={() => this.setState({ error: null })}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Results Section */}
          {hasData && (
            <>
              <Divider orientation="left">
                <h2 style={{ fontSize: '20px' }}>Network Analysis Results</h2>
              </Divider>

              <Row gutter={[16, 16]}>
                {/* Top Users Card */}
                <Col xs={24}>
                  <Card 
                    title={
                      <div>
                        <div>
                          <UserOutlined style={{ marginRight: 8 }} />
                          Top Users
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: 4 }}>
                          Most active IP addresses by data volume and packet count
                        </div>
                      </div>
                    }
                  >
                    {this.renderTopUsersTable()}
                  </Card>
                </Col>

                {/* Geographic Distribution Card */}
                <Col xs={24}>
                  <Card 
                    title={
                      <div>
                        <div>
                          <GlobalOutlined style={{ marginRight: 8 }} />
                          Geographic Distribution
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: 4 }}>
                          Traffic distribution across countries and cities
                        </div>
                      </div>
                    }
                  >
                    {this.renderGeoLocationMap()}
                  </Card>
                </Col>

                {/* Network Topology Card */}
                <Col xs={24}>
                  <Card 
                    title={
                      <div>
                        <div>
                          <ApartmentOutlined style={{ marginRight: 8 }} />
                          Network Topology
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: 4 }}>
                          Interactive visualization of network connections and nodes
                        </div>
                      </div>
                    }
                  >
                    {this.renderNetworkTopology()}
                  </Card>
                </Col>

                {/* Top Communication Links Card */}
                <Col xs={24}>
                  <Card 
                    title={
                      <div>
                        <div>
                          <SwapOutlined style={{ marginRight: 8 }} />
                          Top Communication Links
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: 4 }}>
                          Most active communication pairs with protocol and traffic details
                        </div>
                      </div>
                    }
                  >
                    {this.renderTopLinksTable()}
                  </Card>
                </Col>
              </Row>
            </>
          )}

          {/* No Data Message */}
          {!hasData && !loading && selectedPcap && (
            <Card style={{ marginTop: 16 }}>
              <Empty 
                description={
                  <span>
                    No network data available for this PCAP file.<br />
                    Please ensure DPI analysis has been completed first.
                  </span>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}

          {/* Initial State Message */}
          {!hasData && !loading && !selectedPcap && (
            <Card style={{ marginTop: 16 }}>
              <Empty 
                description="Select a PCAP file and click 'View Network' to analyze network patterns"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}
      </LayoutPage>
    );
  }
}

// Wrap with role check
const NetworkPageWithRole = (props) => {
  const userRole = useUserRole();
  const { canPerformOnlineActions, isSignedIn, isLoaded } = userRole;
  return <NetworkPage {...props} userRole={userRole} canPerformOnlineActions={canPerformOnlineActions} isSignedIn={isSignedIn} isAuthLoaded={isLoaded} />;
};

export default NetworkPageWithRole;