import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Select, Alert, Spin, Row, Col, Divider, Tree, Space, Tag, Table, Statistic } from 'antd';
import { PlayCircleOutlined, StopOutlined, DownOutlined } from '@ant-design/icons';
import { Line, Pie } from '@ant-design/plots';
import { SERVER_URL } from '../constants';

const { Option } = Select;

class DPIPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Mode selection
      mode: 'offline', // 'offline' or 'online'
      
      // Data sources
      pcapFiles: [],
      interfaces: [],
      selectedPcap: null,
      selectedInterface: null,
      
      // DPI data
      hierarchyData: [],
      trafficData: [],
      statistics: null,
      conversations: [],
      selectedProtocols: ['ETHERNET'], // Default selection
      metricType: 'dataVolume', // 'dataVolume' or 'packetCount'
      
      // Status
      isRunning: false,
      sessionId: null,
      loading: false,
      error: null,
      lastUpdate: null,
      
      // Tree state
      expandedKeys: [],
      autoExpandParent: true,
    };
    
    this.reloadInterval = null;
  }

  componentDidMount() {
    this.loadPcapFiles();
    this.loadInterfaces();
    this.loadStatus();
  }

  componentWillUnmount() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }

  loadPcapFiles = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/dpi/pcaps`);
      if (response.ok) {
        const data = await response.json();
        this.setState({ 
          pcapFiles: data.pcaps || [],
          selectedPcap: data.pcaps && data.pcaps.length > 0 ? data.pcaps[0] : null
        });
      }
    } catch (error) {
      console.error('Error loading PCAP files:', error);
    }
  };

  loadInterfaces = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/dpi/interfaces`);
      if (response.ok) {
        const data = await response.json();
        this.setState({ 
          interfaces: data.interfaces || [],
          selectedInterface: data.interfaces && data.interfaces.length > 0 ? data.interfaces[0] : null
        });
      }
    } catch (error) {
      console.error('Error loading interfaces:', error);
    }
  };

  loadStatus = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/dpi/status`);
      if (response.ok) {
        const data = await response.json();
        this.setState({
          isRunning: data.isRunning || data.mmtRunning,
          sessionId: data.sessionId,
          mode: data.mode || this.state.mode,
        });
        
        // If running, load data
        if (data.sessionId) {
          this.loadData();
        }
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  loadData = async (isInitialLoad = false) => {
    // Don't show loading spinner for auto-refresh in online mode
    const shouldShowLoading = isInitialLoad || this.state.mode !== 'online';
    
    if (shouldShowLoading) {
      this.setState({ loading: true, error: null });
    }
    
    try {
      console.log('[DPI Frontend] Fetching data from:', `${SERVER_URL}/api/dpi/data`);
      const response = await fetch(`${SERVER_URL}/api/dpi/data`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DPI Frontend] Received data:', {
          hierarchyCount: data.hierarchy ? data.hierarchy.length : 0,
          trafficCount: data.trafficData ? data.trafficData.length : 0,
          mode: data.mode,
          csvFile: data.csvFile,
        });
        console.log('[DPI Frontend] Sample traffic data:', data.trafficData ? data.trafficData.slice(0, 5) : []);
        
        // Convert hierarchy to tree data format
        const newTreeData = this.convertToTreeData(data.hierarchy || []);
        console.log('[DPI Frontend] Converted tree data:', newTreeData.length, 'nodes');
        
        // Backend already handles accumulation for online mode via dpiState.cumulativeProtocols
        // So we just use the data directly without additional accumulation
        const finalHierarchyData = newTreeData.length > 0 ? newTreeData : this.state.hierarchyData;
        
        // For traffic data, append new data points in online mode
        let finalTrafficData;
        if (this.state.mode === 'online' && data.trafficData && data.trafficData.length > 0) {
          // Append new traffic data to existing
          finalTrafficData = [...this.state.trafficData, ...data.trafficData];
          console.log('[DPI Frontend] Appended traffic data, total points:', finalTrafficData.length);
        } else if (this.state.mode === 'offline' && data.trafficData) {
          // For offline mode, replace with new data
          finalTrafficData = data.trafficData;
        } else {
          finalTrafficData = this.state.trafficData;
        }
        
        // Calculate the actual last data timestamp from traffic data
        let lastDataTimestamp = data.lastUpdate;
        if (finalTrafficData && finalTrafficData.length > 0) {
          // Get the maximum timestamp from all traffic data points
          const maxTimestamp = Math.max(...finalTrafficData.map(d => d.time || d.timestamp || 0));
          if (maxTimestamp > 0) {
            lastDataTimestamp = new Date(maxTimestamp * 1000).toISOString();
          }
        }
        
        this.setState({
          hierarchyData: finalHierarchyData,
          trafficData: finalTrafficData,
          statistics: data.statistics || null,
          conversations: data.conversations || [],
          isRunning: data.isRunning,
          lastUpdate: lastDataTimestamp,
          loading: false,
          error: null, // Clear error on successful load
        });
      } else {
        const errorData = await response.json();
        console.error('[DPI Frontend] Error response:', errorData);
        
        // If it's a "waiting for data" error in online mode, auto-retry after a delay
        if (this.state.mode === 'online' && 
            (errorData.error.includes('waiting') || 
             errorData.error.includes('empty') || 
             errorData.error.includes('No CSV'))) {
          console.log('[DPI Frontend] Auto-retrying in 3 seconds...');
          // Don't show error for initial data wait in online mode
          if (!this.state.hierarchyData || this.state.hierarchyData.length === 0) {
            this.setState({ 
              error: errorData.error + ' (auto-retrying...)',
              loading: false 
            });
          }
          setTimeout(() => this.loadData(), 3000);
        } else {
          this.setState({ 
            error: errorData.error || 'Failed to load data',
            loading: false 
          });
        }
      }
    } catch (error) {
      console.error('[DPI Frontend] Error loading DPI data:', error);
      this.setState({ 
        error: error.message,
        loading: false 
      });
    }
  };

  convertToTreeData = (hierarchy) => {
    return hierarchy.map(node => {
      const isSelected = this.state.selectedProtocols.includes(node.name);
      return {
        title: node.name,
        key: node.name,
        packets: node.packets,
        dataVolume: node.dataVolume,
        isSelected: isSelected,
        children: node.children && node.children.length > 0 
          ? this.convertToTreeData(node.children) 
          : undefined,
      };
    });
  };

  accumulateHierarchyData = (existing, newData) => {
    // Create a map of existing nodes for quick lookup
    const existingMap = new Map();
    
    const mapNodes = (nodes) => {
      nodes.forEach(node => {
        existingMap.set(node.key, node);
        if (node.children) {
          mapNodes(node.children);
        }
      });
    };
    mapNodes(existing);
    
    // Accumulate new data into existing
    const accumulate = (nodes) => {
      return nodes.map(newNode => {
        const existingNode = existingMap.get(newNode.key);
        if (existingNode) {
          // Accumulate packets and data volume
          return {
            ...newNode,
            packets: existingNode.packets + newNode.packets,
            dataVolume: existingNode.dataVolume + newNode.dataVolume,
            children: newNode.children ? accumulate(newNode.children) : undefined,
          };
        }
        return newNode; // New protocol, keep as is
      });
    };
    
    return accumulate(newData);
  };

  convertToTableData = (hierarchy, parentKey = '') => {
    let tableData = [];
    
    hierarchy.forEach((node, index) => {
      const key = parentKey ? `${parentKey}-${index}` : `${index}`;
      tableData.push({
        key,
        name: node.name,
        packets: node.packets,
        dataVolume: node.dataVolume,
        children: node.children && node.children.length > 0 
          ? this.convertToTableData(node.children, key)
          : undefined,
      });
    });
    
    return tableData;
  };

  formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  formatBytesToScale = (bytes) => {
    // Convert to appropriate scale for chart Y-axis
    if (bytes === 0) return 0;
    const k = 1024;
    // Determine best scale based on max value
    if (bytes >= k * k * k) return bytes / (k * k * k); // GB
    if (bytes >= k * k) return bytes / (k * k); // MB
    if (bytes >= k) return bytes / k; // KB
    return bytes; // B
  };

  getDataVolumeScale = (data) => {
    if (!data || data.length === 0) return { scale: 1, unit: 'B' };
    const maxValue = Math.max(...data.map(d => d.value || 0));
    const k = 1024;
    if (maxValue >= k * k * k) return { scale: k * k * k, unit: 'GB' };
    if (maxValue >= k * k) return { scale: k * k, unit: 'MB' };
    if (maxValue >= k) return { scale: k, unit: 'KB' };
    return { scale: 1, unit: 'B' };
  };

  formatTimestamp = (timestamp) => {
    // timestamp is already in milliseconds from getLineChartData
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  toggleProtocolSelection = (protocol) => {
    const { selectedProtocols } = this.state;
    const index = selectedProtocols.indexOf(protocol);
    
    if (index > -1) {
      // Remove protocol
      this.setState({
        selectedProtocols: selectedProtocols.filter(p => p !== protocol)
      });
    } else {
      // Add protocol (max 5)
      if (selectedProtocols.length >= 5) {
        this.setState({ error: 'Maximum 5 protocols can be selected' });
        setTimeout(() => this.setState({ error: null }), 3000);
        return;
      }
      this.setState({
        selectedProtocols: [...selectedProtocols, protocol]
      });
    }
  };

  startAnalysis = async () => {
    const { mode, selectedPcap, selectedInterface } = this.state;
    
    // Initialize with empty data to show empty plot/table
    this.setState({ 
      loading: true, 
      error: null,
      hierarchyData: [],
      trafficData: [],
      statistics: null,
      conversations: [],
    });
    
    try {
      const endpoint = mode === 'offline' 
        ? `${SERVER_URL}/api/dpi/start/offline`
        : `${SERVER_URL}/api/dpi/start/online`;
      
      const body = mode === 'offline'
        ? { pcapFile: selectedPcap }
        : { interface: selectedInterface };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.setState({
          isRunning: true,
          sessionId: data.sessionId,
          loading: false,
        });
        
        // Start polling for data
        // For online mode, wait longer for first CSV file to be generated
        const delay = mode === 'online' ? 6000 : 2000;
        console.log(`[DPI Frontend] Starting data load in ${delay}ms`);
        setTimeout(() => this.loadData(true), delay);
        
        // Always start auto-reload for live updates
        this.startAutoReload();
      } else {
        const errorData = await response.json();
        this.setState({ 
          error: errorData.error || 'Failed to start analysis',
          loading: false 
        });
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      this.setState({ 
        error: error.message,
        loading: false 
      });
    }
  };

  stopAnalysis = async () => {
    try {
      console.log('[DPI Frontend] Stopping analysis...');
      
      const response = await fetch(`${SERVER_URL}/api/dpi/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DPI Frontend] Analysis stopped:', data.message);
        
        // Stop auto-reload
        if (this.reloadInterval) {
          clearInterval(this.reloadInterval);
          this.reloadInterval = null;
        }
        
        // Update state
        this.setState({
          isRunning: false,
          error: null,
        });
      } else {
        const errorData = await response.json();
        this.setState({ 
          error: errorData.error || 'Failed to stop analysis'
        });
      }
    } catch (error) {
      console.error('Error stopping analysis:', error);
      this.setState({ 
        error: error.message
      });
    }
  };

  startAutoReload = () => {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
    
    this.reloadInterval = setInterval(() => {
      if (this.state.isRunning) {
        this.loadData();
      }
    }, 5000); // Reload every 5 seconds
  };

  stopAutoReload = () => {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }
  };

  onExpand = (expandedKeysValue) => {
    this.setState({
      expandedKeys: expandedKeysValue,
      autoExpandParent: false,
    });
  };

  getLineChartData = () => {
    const { trafficData, selectedProtocols, metricType } = this.state;
    
    if (!trafficData || trafficData.length === 0) {
      return [];
    }
    
    // Filter data by selected protocols
    const filtered = trafficData.filter(d => {
      // Check if any selected protocol is in the protocol hierarchy
      return selectedProtocols.some(proto => 
        d.protocol.toLowerCase().includes(proto.toLowerCase())
      );
    });
    
    console.log('[DPI Chart] Sample traffic data:', filtered.slice(0, 3));
    
    // Get scale for data volume
    let scale = { scale: 1, unit: 'B' };
    if (metricType === 'dataVolume') {
      const tempData = filtered.map(d => ({ value: d.dataVolume }));
      scale = this.getDataVolumeScale(tempData);
    }
    
    // Format for line chart with selected metric
    const chartData = filtered.map(d => {
      // Convert timestamp to milliseconds for JavaScript Date
      const timestamp = (d.timestamp || d.time) * 1000;
      return {
        time: timestamp, // Use milliseconds for proper date handling
        protocol: d.protocol,
        value: metricType === 'dataVolume' ? d.dataVolume / scale.scale : d.packetCount,
        rawValue: metricType === 'dataVolume' ? d.dataVolume : d.packetCount,
        unit: metricType === 'dataVolume' ? scale.unit : '',
      };
    });
    
    // Sort by time to ensure proper chart rendering
    chartData.sort((a, b) => a.time - b.time);
    
    console.log('[DPI Chart] Formatted chart data sample:', chartData.slice(0, 3));
    if (chartData.length > 0) {
      console.log('[DPI Chart] Total data points:', chartData.length);
      console.log('[DPI Chart] First timestamp (ms):', chartData[0].time);
      console.log('[DPI Chart] First timestamp (ISO):', new Date(chartData[0].time).toISOString());
      console.log('[DPI Chart] First timestamp (local):', new Date(chartData[0].time).toLocaleString());
      console.log('[DPI Chart] Last timestamp (ms):', chartData[chartData.length - 1].time);
      console.log('[DPI Chart] Last timestamp (ISO):', new Date(chartData[chartData.length - 1].time).toISOString());
      console.log('[DPI Chart] Time range (seconds):', (chartData[chartData.length - 1].time - chartData[0].time) / 1000);
      
      // Test the formatter
      const testDate = new Date(chartData[0].time);
      console.log('[DPI Chart] Test formatter output:', 
        `${String(testDate.getHours()).padStart(2, '0')}:${String(testDate.getMinutes()).padStart(2, '0')}:${String(testDate.getSeconds()).padStart(2, '0')}`);
      
      // Log all unique timestamps to debug
      const uniqueTimes = [...new Set(chartData.map(d => d.time))];
      console.log('[DPI Chart] Unique timestamps:', uniqueTimes.length, 'out of', chartData.length);
      console.log('[DPI Chart] First 5 unique times:', uniqueTimes.slice(0, 5).map(t => new Date(t).toISOString()));
    }
    return chartData;
  };

  renderProtocolHierarchy = () => {
    const { hierarchyData, expandedKeys, autoExpandParent, loading, selectedProtocols, isRunning } = this.state;
    
    if (!hierarchyData || hierarchyData.length === 0) {
      if (!isRunning) {
        return (
          <Alert
            message="No Data"
            description="Start an analysis to view protocol hierarchy"
            type="info"
            showIcon
          />
        );
      }
      // Show empty table with loading overlay when running
      return (
        <div style={{ position: 'relative', minHeight: '200px' }}>
          <Spin spinning={true} tip="Loading protocol data...">
            <div style={{ minHeight: '200px' }}></div>
          </Spin>
        </div>
      );
    }
    
    // Table view with clickable rows
    const columns = [
      {
        title: 'Name',
        dataIndex: 'title',
        key: 'title',
        width: 200,
      },
      {
        title: 'Packets',
        dataIndex: 'packets',
        key: 'packets',
        align: 'right',
        width: 120,
        render: (val) => val ? val.toLocaleString() : '0',
      },
      {
        title: 'Data (B)',
        dataIndex: 'dataVolume',
        key: 'dataVolume',
        align: 'right',
        width: 120,
        render: (bytes) => this.formatBytes(bytes || 0),
      },
    ];
    
    return (
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <Table
          columns={columns}
          dataSource={hierarchyData}
          pagination={false}
          size="small"
          expandable={{
            defaultExpandAllRows: true,
            childrenColumnName: 'children',
          }}
          onRow={(record) => ({
            onClick: () => this.toggleProtocolSelection(record.key),
            style: {
              cursor: 'pointer',
              backgroundColor: selectedProtocols.includes(record.key) ? '#e6f7ff' : 'transparent',
            },
          })}
          rowClassName={(record) => 
            selectedProtocols.includes(record.key) ? 'selected-row' : ''
          }
        />
        <Divider />
        <div style={{ fontSize: '12px', color: '#666' }}>
          {this.countDistinctProtocols()} distinct protocols/applications
        </div>
      </div>
    );
  };

  convertHierarchyToTable = (treeData) => {
    const result = [];
    
    const traverse = (nodes) => {
      nodes.forEach(node => {
        // Extract name from the title if it's a React element
        let name = node.key;
        let packets = 0;
        let dataVolume = 0;
        
        // Try to extract from title
        if (typeof node.title === 'object' && node.title.props) {
          const tags = node.title.props.children;
          if (Array.isArray(tags)) {
            tags.forEach(child => {
              if (child && child.props) {
                if (child.props.color === 'blue') {
                  packets = parseInt(child.props.children) || 0;
                } else if (child.props.color === 'green') {
                  // Extract bytes from formatted string
                  const text = child.props.children;
                  if (typeof text === 'string') {
                    const match = text.match(/[\d.]+/);
                    if (match) {
                      dataVolume = parseFloat(match[0]);
                      if (text.includes('KB')) dataVolume *= 1024;
                      else if (text.includes('MB')) dataVolume *= 1024 * 1024;
                      else if (text.includes('GB')) dataVolume *= 1024 * 1024 * 1024;
                    }
                  }
                }
              }
            });
          }
        }
        
        const item = {
          key: node.key,
          name: name,
          packets: packets,
          dataVolume: dataVolume,
        };
        
        if (node.children && node.children.length > 0) {
          item.children = this.convertHierarchyToTable(node.children);
        }
        
        result.push(item);
      });
    };
    
    traverse(treeData);
    return result;
  };

  countDistinctProtocols = () => {
    const { hierarchyData } = this.state;
    
    const countNodes = (nodes) => {
      let count = 0;
      nodes.forEach(node => {
        count += 1;
        if (node.children && node.children.length > 0) {
          count += countNodes(node.children);
        }
      });
      return count;
    };
    
    return countNodes(hierarchyData);
  };

  flattenHierarchy = (nodes, result = []) => {
    nodes.forEach(node => {
      result.push({
        name: node.title || node.key,
        packets: node.packets || 0,
        dataVolume: node.dataVolume || 0,
      });
      if (node.children && node.children.length > 0) {
        this.flattenHierarchy(node.children, result);
      }
    });
    return result;
  };

  renderTopConversations = () => {
    const { conversations, isRunning } = this.state;

    if (!conversations || conversations.length === 0) {
      if (!isRunning) {
        return (
          <Alert
            message="No Data"
            description="Start an analysis to view conversations"
            type="info"
            showIcon
          />
        );
      }
      return (
        <div style={{ position: 'relative', minHeight: '200px' }}>
          <Spin spinning={true} tip="Loading conversation data...">
            <div style={{ minHeight: '200px' }}></div>
          </Spin>
        </div>
      );
    }

    // Group conversations by IP pairs (ignoring ports and protocol)
    const ipPairMap = {};
    conversations.forEach(conv => {
      if (!conv.srcIP || !conv.dstIP) return;
      
      // Create a normalized key for IP pairs (bidirectional)
      // Sort IPs to treat A->B and B->A as the same conversation
      const ips = [conv.srcIP, conv.dstIP].sort();
      const pairKey = `${ips[0]} <-> ${ips[1]}`;
      
      if (!ipPairMap[pairKey]) {
        ipPairMap[pairKey] = {
          ip1: ips[0],
          ip2: ips[1],
          packets: 0,
          bytes: 0,
          protocols: new Set(),
          flowCount: 0,
        };
      }
      
      ipPairMap[pairKey].packets += conv.packets || 0;
      ipPairMap[pairKey].bytes += conv.bytes || 0;
      ipPairMap[pairKey].protocols.add(conv.protocol);
      ipPairMap[pairKey].flowCount += 1;
    });

    // Convert to array and sort by bytes
    const ipPairs = Object.values(ipPairMap)
      .map(pair => ({
        ...pair,
        protocols: Array.from(pair.protocols).join(', '),
      }))
      .sort((a, b) => b.bytes - a.bytes);

    // Calculate totals
    const totalPackets = conversations.reduce((sum, c) => sum + c.packets, 0);
    const totalBytes = conversations.reduce((sum, c) => sum + c.bytes, 0);

    const columns = [
      {
        title: 'IP Address 1',
        dataIndex: 'ip1',
        key: 'ip1',
        ellipsis: true,
        width: 140,
      },
      {
        title: 'IP Address 2',
        dataIndex: 'ip2',
        key: 'ip2',
        ellipsis: true,
        width: 140,
      },
      {
        title: 'Protocols',
        dataIndex: 'protocols',
        key: 'protocols',
        ellipsis: true,
        width: 100,
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
        title: 'Packets',
        dataIndex: 'packets',
        key: 'packets',
        align: 'right',
        width: 100,
        sorter: (a, b) => (a.packets || 0) - (b.packets || 0),
        render: (val) => val ? val.toLocaleString() : '-',
      },
      {
        title: 'Bytes',
        dataIndex: 'bytes',
        key: 'bytes',
        align: 'right',
        width: 110,
        sorter: (a, b) => (a.bytes || 0) - (b.bytes || 0),
        defaultSortOrder: 'descend',
        render: (bytes) => bytes ? this.formatBytes(bytes) : '-',
      },
    ];

    // Add keys to data
    const dataSource = ipPairs.map((pair, index) => ({
      key: index,
      ...pair,
    }));

    return (
      <div>
        <div style={{ marginBottom: 12, fontSize: '12px', color: '#666' }}>
          <strong>{ipPairs.length}</strong> IP pairs | 
          <strong> {conversations.length}</strong> flows | 
          <strong> Total: {totalPackets.toLocaleString()}</strong> packets, 
          <strong> {this.formatBytes(totalBytes)}</strong>
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={{ 
            pageSize: 20, 
            size: 'small',
            showTotal: (total) => `Total ${total} IP pairs`,
          }}
          size="small"
          scroll={{ y: 300 }}
        />
      </div>
    );
  };

  renderProtocolDistributionPie = () => {
    const { hierarchyData, metricType, isRunning } = this.state;

    if (!hierarchyData || hierarchyData.length === 0) {
      if (!isRunning) {
        return (
          <Alert
            message="No Data"
            description="Start an analysis to view protocol distribution"
            type="info"
            showIcon
          />
        );
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading protocol data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Flatten hierarchy to get all protocols
    const allProtocols = this.flattenHierarchy(hierarchyData);
    
    // Prepare data for pie chart
    const pieData = allProtocols.map(proto => ({
      type: proto.name,
      value: metricType === 'dataVolume' ? proto.dataVolume : proto.packets,
    }));

    // Sort by value and take top protocols (limit to avoid clutter)
    pieData.sort((a, b) => b.value - a.value);
    const topProtocols = pieData.slice(0, 10); // Top 10 protocols

    const config = {
      data: topProtocols,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      innerRadius: 0.6,
      label: {
        type: 'spider',
        labelHeight: 28,
        content: '{name}\n{percentage}',
      },
      legend: {
        position: 'bottom',
        itemName: {
          formatter: (text, item) => {
            const dataItem = topProtocols.find(d => d.type === text);
            if (dataItem) {
              const formattedValue = metricType === 'dataVolume' 
                ? this.formatBytes(dataItem.value)
                : dataItem.value.toLocaleString();
              return `${text}: ${formattedValue}`;
            }
            return text;
          },
        },
      },
      interactions: [
        { type: 'element-selected' },
        { type: 'element-active' },
      ],
      statistic: {
        title: false,
        content: {
          style: {
            fontSize: '16px',
            fontWeight: 'bold',
          },
          content: metricType === 'dataVolume' ? 'Data\nVolume' : 'Packet\nCount',
        },
      },
      tooltip: {
        formatter: (datum) => {
          const value = metricType === 'dataVolume'
            ? this.formatBytes(datum.value)
            : datum.value.toLocaleString();
          return {
            name: datum.type,
            value: value,
          };
        },
      },
    };

    return <Pie {...config} />;
  };

  formatBitsPerSecond = (bps) => {
    if (!bps || bps === 0) return '0 bps';
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const k = 1000;
    const i = Math.floor(Math.log(bps) / Math.log(k));
    const value = (bps / Math.pow(k, i)).toFixed(2);
    return `${value} ${units[i]}`;
  };

  formatPacketsPerSecond = (pps) => {
    if (!pps || pps === 0) return '0';
    if (pps >= 1000000) return `${(pps / 1000000).toFixed(2)}M`;
    if (pps >= 1000) return `${(pps / 1000).toFixed(2)}K`;
    return pps.toFixed(2);
  };

  formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m`;
  };

  renderStatisticsSummary = () => {
    const { statistics, isRunning, selectedPcap, selectedInterface, mode } = this.state;

    if (!statistics) {
      // Check if we should show "No Data" based on mode and selection
      const hasSelection = mode === 'offline' ? selectedPcap : selectedInterface;
      
      if (!isRunning && !hasSelection) {
        return (
          <Card style={{ marginBottom: 24 }}>
            <Alert
              message="No Data"
              description="Start an analysis to view traffic statistics"
              type="info"
              showIcon
            />
          </Card>
        );
      }
      
      // Show placeholder when running but no stats yet
      if (isRunning) {
        return (
          <Card style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', minHeight: '120px' }}>
              <Spin spinning={true} tip="Calculating statistics...">
                <div style={{ minHeight: '120px' }}></div>
              </Spin>
            </div>
          </Card>
        );
      }
      
      // If we have a selection but no stats yet and not running, show "No Data"
      return (
        <Card style={{ marginBottom: 24 }}>
          <Alert
            message="No Data"
            description="Start an analysis to view traffic statistics"
            type="info"
            showIcon
          />
        </Card>
      );
    }

    return (
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Total Packets"
              value={statistics.totalPackets}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Total Data"
              value={this.formatBytes(statistics.totalBytes)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Avg Packet Size"
              value={this.formatBytes(statistics.avgPacketSize)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Duration"
              value={this.formatDuration(statistics.duration)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Throughput"
              value={this.formatBitsPerSecond(statistics.bitsPerSecond)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Statistic
              title="Packet Rate"
              value={this.formatPacketsPerSecond(statistics.packetsPerSecond)}
              suffix="pps"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  renderTrafficChart = () => {
    const { loading, selectedProtocols, metricType, isRunning, trafficData } = this.state;
    const chartData = this.getLineChartData();
    
    if (!chartData || chartData.length === 0) {
      if (isRunning && (!trafficData || trafficData.length === 0)) {
        // Show empty chart area with loading overlay when running
        return (
          <div style={{ position: 'relative', minHeight: '300px' }}>
            <Spin spinning={true} tip="Loading traffic data...">
              <div style={{ minHeight: '300px' }}></div>
            </Spin>
          </div>
        );
      }
      return (
        <Alert
          message="No Data"
          description="Select protocols from the table to view their traffic"
          type="info"
          showIcon
        />
      );
    }
    
    // Get the unit for Y-axis label
    const unit = chartData.length > 0 && chartData[0].unit ? chartData[0].unit : '';
    const yAxisLabel = metricType === 'dataVolume' 
      ? `Data Volume (${unit})` 
      : 'Packet Count';
    
    // Determine if we should show milliseconds based on traffic duration
    let showMilliseconds = false;
    if (chartData.length > 1) {
      const duration = chartData[chartData.length - 1].time - chartData[0].time;
      // Show milliseconds if traffic duration is less than 2 seconds
      showMilliseconds = duration < 2000;
    }
    
    const config = {
      data: chartData,
      xField: 'time',
      yField: 'value',
      seriesField: 'protocol',
      smooth: true,
      padding: 'auto',
      appendPadding: [10, 80, 10, 10], // [top, right, bottom, left] - extra padding on right for last tick label
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
      legend: {
        position: 'top',
      },
      xAxis: {
        title: {
          text: 'Time',
        },
        label: {
          formatter: (v) => {
            // v should be the timestamp in milliseconds
            // Treat it as a number and convert to Date
            const timestamp = Number(v);
            if (isNaN(timestamp)) {
              console.error('[DPI Formatter] NaN timestamp:', v);
              return String(v);
            }
            
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
              console.error('[DPI Formatter] Invalid date from:', timestamp);
              return String(timestamp);
            }
            
            // Manual formatting for full control
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            // Show milliseconds only for very short captures (< 2 seconds)
            if (showMilliseconds) {
              const ms = String(date.getMilliseconds()).padStart(3, '0');
              return `${hours}:${minutes}:${seconds}.${ms}`;
            }
            return `${hours}:${minutes}:${seconds}`;
          },
          autoRotate: true,
          style: {
            textAlign: 'center',
          },
        },
        nice: true,
        tickCount: 10,
      },
      yAxis: {
        title: {
          text: yAxisLabel,
        },
        label: {
          formatter: (v) => {
            // Format Y-axis values with proper decimals
            return typeof v === 'number' ? v.toFixed(2) : v;
          },
        },
      },
      tooltip: {
        customContent: (title, items) => {
          if (!items || items.length === 0) return '';
          
          // Format the timestamp (title is the x-axis value - timestamp in ms)
          const timestamp = Number(title);
          const date = new Date(timestamp);
          const dateStr = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
          const timeStr = date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
          });
          
          // Build tooltip HTML
          let html = `<div style="padding: 8px;">`;
          html += `<div style="margin-bottom: 8px; font-weight: bold;">${dateStr} ${timeStr}</div>`;
          
          items.forEach(item => {
            const color = item.color || '#1890ff';
            const name = item.name || 'Unknown';
            const value = item.value || 0;
            
            html += `<div style="margin-bottom: 4px;">`;
            html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>`;
            html += `<span style="font-weight: 500;">${name}:</span> `;
            html += `<span>${metricType === 'dataVolume' ? this.formatBytes(item.data.rawValue || value) : (item.data.rawValue || value).toLocaleString()}</span>`;
            html += `</div>`;
          });
          
          html += `</div>`;
          return html;
        },
      },
    };
    
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <strong>Selected Protocols:</strong>{' '}
          {selectedProtocols.map(proto => (
            <Tag 
              key={proto} 
              closable 
              onClose={() => this.toggleProtocolSelection(proto)}
              color="blue"
            >
              {proto}
            </Tag>
          ))}
        </div>
        <Line {...config} />
      </div>
    );
  };

  render() {
    const { 
      mode, 
      pcapFiles, 
      interfaces, 
      selectedPcap, 
      selectedInterface,
      isRunning,
      loading,
      error,
      lastUpdate,
      hierarchyData,
      trafficData,
      metricType,
    } = this.state;

    return (
      <LayoutPage 
        pageTitle="Deep Packet Inspection" 
        pageSubTitle="Protocol hierarchy and traffic analysis using mmt-probe"
      >
          
          <Divider orientation="left">
            <h2 style={{ fontSize: '20px' }}>Configuration</h2>
          </Divider>
          
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={4} align="middle" justify="space-between">
              <Col flex="none">
                <strong style={{ marginRight: 4 }}>Mode:</strong>
              </Col>
              <Col flex="none">
                <Select
                  value={mode}
                  onChange={(value) => this.setState({ 
                    mode: value,
                    hierarchyData: [],
                    trafficData: [],
                    statistics: null,
                    conversations: [],
                    selectedProtocols: ['ETHERNET'],
                    lastUpdate: null,
                  })}
                  style={{ width: 180 }}
                  disabled={isRunning}
                >
                  <Option value="offline">Offline (PCAP)</Option>
                  <Option value="online">Online (Interface)</Option>
                </Select>
              </Col>
              
              <Col flex="none" style={{ marginLeft: 12 }}>
                <strong style={{ marginRight: 4 }}>{mode === 'offline' ? 'PCAP File:' : 'Interface:'}</strong>
              </Col>
              <Col flex="none">
                {mode === 'offline' ? (
                  <Select
                    value={selectedPcap}
                    onChange={(value) => this.setState({ 
                      selectedPcap: value,
                      hierarchyData: value ? this.state.hierarchyData : [],
                      trafficData: value ? this.state.trafficData : [],
                      statistics: value ? this.state.statistics : null,
                      conversations: value ? this.state.conversations : [],
                      lastUpdate: value ? this.state.lastUpdate : null
                    })}
                    style={{ width: 280 }}
                    disabled={isRunning}
                    allowClear
                    placeholder="Select a PCAP file..."
                  >
                    {pcapFiles.map(file => (
                      <Option key={file} value={file}>{file}</Option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    value={selectedInterface}
                    onChange={(value) => this.setState({ 
                      selectedInterface: value,
                      hierarchyData: value ? this.state.hierarchyData : [],
                      trafficData: value ? this.state.trafficData : [],
                      statistics: value ? this.state.statistics : null,
                      conversations: value ? this.state.conversations : [],
                      lastUpdate: value ? this.state.lastUpdate : null
                    })}
                    style={{ width: 280 }}
                    disabled={isRunning}
                    allowClear
                    placeholder="Select a network interface..."
                  >
                    {interfaces.map(iface => (
                      <Option key={iface} value={iface}>{iface}</Option>
                    ))}
                  </Select>
                )}
              </Col>
              
              <Col flex="none" style={{ marginLeft: 12 }}>
                <Space size="small">
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={this.startAnalysis}
                    loading={loading}
                    disabled={isRunning || (!selectedPcap && !selectedInterface)}
                  >
                    Start
                  </Button>
                  {mode === 'online' && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={this.stopAnalysis}
                      disabled={!isRunning}
                    >
                      Stop
                    </Button>
                  )}
                </Space>
              </Col>
              
              <Col flex="none" style={{ marginLeft: 24 }}>
                <strong style={{ marginRight: 4 }}>Status:</strong>
              </Col>
              <Col flex="none">
                <Tag color={isRunning ? 'green' : 'default'}>
                  {isRunning ? 'Running' : 'Stopped'}
                </Tag>
              </Col>
              
              {lastUpdate && mode === 'online' && (
                <>
                  <Col flex="none" style={{ marginLeft: 12 }}>
                    <strong style={{ marginRight: 4 }}>Last Update:</strong>
                  </Col>
                  <Col flex="none">
                    <span style={{ fontSize: '12px' }}>
                      {new Date(lastUpdate).toLocaleTimeString()}
                    </span>
                  </Col>
                </>
              )}
            </Row>
          </Card>
          
          
          {(selectedPcap || selectedInterface || hierarchyData.length > 0 || trafficData.length > 0) && (
            <>
              <Divider orientation="left">
                <h2 style={{ fontSize: '20px' }}>Traffic Statistics</h2>
              </Divider>
              
              {this.renderStatisticsSummary()}
              
              <Divider orientation="left">
                <h2 style={{ fontSize: '20px' }}>Protocol Analysis</h2>
              </Divider>
              
              <div style={{ marginBottom: 16, textAlign: 'right' }}>
                <strong style={{ marginRight: 8 }}>Metric:</strong>
                <Select
                  value={metricType}
                  onChange={(value) => this.setState({ metricType: value })}
                  style={{ width: 150 }}
                  size="small"
                >
                  <Option value="dataVolume">Data Volume</Option>
                  <Option value="packetCount">Packet Count</Option>
                </Select>
              </div>
              
              <Card style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Traffic Timeline</h3>
                {this.renderTrafficChart()}
              </Card>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Card style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Protocol Hierarchy</h3>
                    {this.renderProtocolHierarchy()}
                  </Card>
                  
                  <Card style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Top Conversations</h3>
                    {this.renderTopConversations()}
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Protocol Distribution</h3>
                    {this.renderProtocolDistributionPie()}
                  </Card>
                </Col>
              </Row>
            </>
          )}
      </LayoutPage>
    );
  }
}

export default DPIPage;
