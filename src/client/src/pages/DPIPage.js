import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Select, Alert, Spin, Row, Col, Divider, Tree, Space, Tag, Table } from 'antd';
import { PlayCircleOutlined, StopOutlined, DownOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
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
        
        // For online mode, accumulate hierarchy data (add packet counts)
        let finalHierarchyData;
        if (this.state.mode === 'online' && this.state.hierarchyData.length > 0 && newTreeData.length > 0) {
          finalHierarchyData = this.accumulateHierarchyData(this.state.hierarchyData, newTreeData);
          console.log('[DPI Frontend] Accumulated hierarchy data');
        } else {
          // For offline mode or first load, replace data
          finalHierarchyData = newTreeData.length > 0 ? newTreeData : this.state.hierarchyData;
        }
        
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
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
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
          <div>
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
                      trafficData: value ? this.state.trafficData : []
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
                      trafficData: value ? this.state.trafficData : []
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
              
              {lastUpdate && (
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
          
          {loading && !error && (
            <Alert
              message="Loading Data"
              description="Fetching protocol hierarchy and traffic data from mmt-probe..."
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          {(selectedPcap || selectedInterface || hierarchyData.length > 0 || trafficData.length > 0) && (
            <>
              <Divider orientation="left">
                <h2 style={{ fontSize: '20px' }}>Protocol Hierarchy & Traffic</h2>
              </Divider>
              
              <Card style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col span={10}>
                    {this.renderProtocolHierarchy()}
                  </Col>
                  
                  <Col span={14}>
                    {this.renderTrafficChart()}
                  </Col>
                </Row>
              </Card>
            </>
          )}
      </LayoutPage>
    );
  }
}

export default DPIPage;
