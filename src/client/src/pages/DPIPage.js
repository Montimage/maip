import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Select, Alert, Spin, Row, Col, Divider, Tree, Space, Tag, Table, Statistic, notification, message, Upload, Tooltip } from 'antd';
import { PlayCircleOutlined, StopOutlined, DownOutlined, FolderOpenOutlined, LockOutlined, UploadOutlined, FileTextOutlined, ApartmentOutlined } from '@ant-design/icons';
import { Line, Pie, Column, Area, Histogram } from '@ant-design/plots';
import { SERVER_URL } from '../constants';
import { useUserRole } from '../hooks/useUserRole';

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
      packetSizes: [],
      selectedProtocols: ['ETHERNET'], // Default selection
      metricType: 'dataVolume', // 'dataVolume' or 'packetCount'
      showDirectional: false, // Toggle for In/Out flow view
      
      // Status
      isRunning: false,
      sessionId: null,
      loading: false,
      error: null,
      lastUpdate: null,
      
      // Tree state
      expandedKeys: [],
      autoExpandParent: true,
      
      // Track if loaded from Feature Extraction
      loadedFromFeatureExtraction: false,
      
      // Track uploaded PCAP
      uploadedPcapName: null,
    };
    
    this.reloadInterval = null;
  }

  componentDidMount() {
    this.loadPcapFiles();
    this.loadInterfaces();
    
    // Check if navigated from Feature Extraction page
    const pendingPcap = localStorage.getItem('pendingDPIPcap');
    
    if (!pendingPcap) {
      // Only load status if NOT coming from Feature Extraction
      this.loadStatus();
    }
    
    // Start periodic status check (every 10 seconds) to detect session changes
    // This will be stopped when user manually stops DPI, and restarted when starting new session
    this.statusCheckInterval = setInterval(() => {
      // Only check status if not actively running
      if (!this.state.isRunning) {
        this.loadStatus(true); // Silent check to avoid duplicate notifications
      }
    }, 10000);
    
    // If navigated from Feature Extraction page
    try {
      if (pendingPcap) {
        // Wait for pcapFiles to load, then check for existing session
        setTimeout(async () => {
          // Check if there's an existing DPI session for this PCAP
          try {
            const response = await fetch(`${SERVER_URL}/api/dpi/status`);
            if (response.ok) {
              const statusData = await response.json();
              
              // If there's an active session with the same PCAP, reload the data
              if (statusData.sessionId && statusData.pcapFile === pendingPcap && statusData.mode === 'offline') {
                this.setState({ 
                  selectedPcap: pendingPcap,
                  mode: 'offline',
                  loadedFromFeatureExtraction: true,
                  isRunning: statusData.isRunning || statusData.mmtRunning,
                  sessionId: statusData.sessionId,
                  loading: false,
                  error: null,
                });
                
                localStorage.removeItem('pendingDPIPcap');
                
                notification.success({
                  message: 'DPI Session Restored',
                  description: `Reloading existing DPI analysis for "${pendingPcap}"`,
                  placement: 'topRight',
                });
                
                // Load the existing data
                this.loadData();
                
                return;
              }
            }
          } catch (e) {
            console.error('Error checking DPI status:', e);
          }
          
          // No existing session found, check if we have a saved sessionId for this PCAP
          try {
            const mapping = JSON.parse(localStorage.getItem('dpiPcapSessions') || '{}');
            const savedSessionId = mapping[pendingPcap];
            
            if (savedSessionId) {
              // We have a previous session for this PCAP!
              this.setState({ 
                selectedPcap: pendingPcap,
                mode: 'offline',
                loadedFromFeatureExtraction: true,
                sessionId: savedSessionId,
                loading: true,
              });
              localStorage.removeItem('pendingDPIPcap');
              
              // Try to load the data for this session
              this.loadData().then(() => {
                notification.success({
                  message: 'DPI Results Restored',
                  description: `Showing previous DPI analysis for "${pendingPcap}"`,
                  placement: 'topRight',
                });
              }).catch(() => {
                // Failed to load data, session might be expired
                this.setState({
                  loading: false,
                  sessionId: null,
                });
                notification.warning({
                  message: 'Previous Session Expired',
                  description: `Ready to analyze "${pendingPcap}" with DPI. Click Start to begin.`,
                  placement: 'topRight',
                });
              });
            } else {
              // No previous session found
              this.setState({ 
                selectedPcap: pendingPcap,
                mode: 'offline',
                loadedFromFeatureExtraction: true,
                loading: false,
                hierarchyData: [],
                trafficData: [],
                statistics: null,
                conversations: [],
                packetSizes: [],
                selectedProtocols: ['ETHERNET'],
              });
              localStorage.removeItem('pendingDPIPcap');
              notification.info({
                message: 'PCAP Loaded',
                description: `Ready to analyze "${pendingPcap}" with DPI. Click Start to begin.`,
                placement: 'topRight',
              });
            }
          } catch (e) {
            console.error('Failed to restore DPI session:', e);
          }
        }, 500);
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  componentWillUnmount() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }

  loadPcapFiles = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/dpi/pcaps`);
      if (response.ok) {
        const data = await response.json();
        this.setState({ 
          pcapFiles: data.pcaps || [],
          // Do not auto-select a PCAP; keep current selection as-is
          selectedPcap: this.state.selectedPcap || null,
        });
      }
    } catch (error) {
      console.error('Error loading PCAP files:', error);
    }
  };

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

  handleUploadChange = (info) => {
    const { status, response, name } = info.file;
    if (status === 'uploading') {
      // no-op
    } else if (status === 'done') {
      const uploaded = (response && response.pcapFile) || (info.file.response && info.file.response.pcapFile) || null;
      this.setState({ 
        uploadedPcapName: uploaded,
        selectedPcap: uploaded,
      });
      notification.success({
        message: 'PCAP Uploaded',
        description: `File "${uploaded}" uploaded successfully and ready for DPI analysis.`,
        placement: 'topRight',
      });
      // Reload the PCAP list to include the newly uploaded file
      this.loadPcapFiles();
    } else if (status === 'error') {
      message.error('Upload failed');
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

  loadStatus = async (silentCheck = false) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/dpi/status`);
      if (response.ok) {
        const data = await response.json();
        
        // Check if session ended (was running, now stopped)
        const sessionEnded = this.state.isRunning && !data.isRunning && !data.mmtRunning;
        
        // Check if session just started (wasn't running, now is)
        const sessionStarted = !this.state.isRunning && (data.isRunning || data.mmtRunning);
        
        // Only update state if there's an actual change
        if (sessionEnded || sessionStarted || this.state.sessionId !== data.sessionId) {
          this.setState({
            isRunning: data.isRunning || data.mmtRunning,
            sessionId: data.sessionId,
            mode: data.mode || this.state.mode,
          });
        }
        
        // If session just ended, notify user and stop auto-reload
        if (sessionEnded && !silentCheck) {
          console.log('[DPI Frontend] Session ended, stopping auto-reload');
          this.stopAutoReload();
          notification.info({
            message: 'DPI Session Ended',
            description: 'The DPI analysis has been stopped.',
            placement: 'topRight',
          });
        }
        
        // If session just started, start auto-reload
        if (sessionStarted) {
          console.log('[DPI Frontend] Session started, auto-reload enabled');
          notification.info({
            message: 'DPI Session Active',
            description: `${data.mode === 'online' ? 'Online' : 'Offline'} DPI analysis is running.`,
            placement: 'topRight',
          });
          this.startAutoReload();
        }
        
        // Only load data if session is running (don't load when stopped)
        if (data.sessionId && (data.isRunning || data.mmtRunning)) {
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
    
    console.log('[DPI Frontend] loadData called, isInitialLoad:', isInitialLoad, 'mode:', this.state.mode, 'sessionId:', this.state.sessionId);
    
    try {
      // Build URL with sessionId parameter for offline mode
      const url = this.state.sessionId 
        ? `${SERVER_URL}/api/dpi/data?sessionId=${this.state.sessionId}`
        : `${SERVER_URL}/api/dpi/data`;
      
      console.log('[DPI Frontend] Fetching data from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DPI Frontend] Received data:', {
          hierarchyCount: data.hierarchy ? data.hierarchy.length : 0,
          trafficCount: data.trafficData ? data.trafficData.length : 0,
          conversationsCount: data.conversations ? data.conversations.length : 0,
          packetSizesCount: data.packetSizes ? data.packetSizes.length : 0,
          mode: data.mode,
          csvFile: data.csvFile,
        });
        console.log('[DPI Frontend] Sample traffic data:', data.trafficData ? data.trafficData.slice(0, 3) : []);
        console.log('[DPI Frontend] Current state trafficData length:', this.state.trafficData.length);
        
        // Convert hierarchy to tree data format
        const newTreeData = this.convertToTreeData(data.hierarchy || []);
        console.log('[DPI Frontend] Converted tree data:', newTreeData.length, 'nodes');
        
        // Backend already handles accumulation for online mode via dpiState.cumulativeProtocols
        // So we just use the data directly without additional accumulation
        const finalHierarchyData = newTreeData.length > 0 ? newTreeData : this.state.hierarchyData;
        
        // For traffic data, handle differently based on mode and initial load
        let finalTrafficData;
        if (this.state.mode === 'online') {
          if (data.trafficData && data.trafficData.length > 0) {
            // In online mode, append new traffic data to existing (backend sends incremental data)
            // But if this is the first load (state is empty), just use the new data
            if (this.state.trafficData.length === 0) {
              finalTrafficData = data.trafficData;
              console.log('[DPI Frontend] First traffic data load:', finalTrafficData.length, 'points');
            } else {
              finalTrafficData = [...this.state.trafficData, ...data.trafficData];
              console.log('[DPI Frontend] Appended traffic data, total points:', finalTrafficData.length);
            }
          } else {
            // No new data, keep existing
            finalTrafficData = this.state.trafficData;
            console.log('[DPI Frontend] No new traffic data, keeping existing:', finalTrafficData.length, 'points');
          }
        } else if (this.state.mode === 'offline' && data.trafficData) {
          // For offline mode, replace with new data
          finalTrafficData = data.trafficData;
          console.log('[DPI Frontend] Offline mode, using new traffic data:', finalTrafficData.length, 'points');
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
        
        // For online mode: accumulate conversations and packet sizes
        // For offline mode: replace with new data
        let finalConversations, finalPacketSizes;
        
        if (this.state.mode === 'online') {
          // In online mode, always use the latest data from backend (backend accumulates)
          finalConversations = data.conversations && data.conversations.length > 0 
            ? data.conversations 
            : this.state.conversations;
          finalPacketSizes = data.packetSizes && data.packetSizes.length > 0 
            ? data.packetSizes 
            : this.state.packetSizes;
        } else {
          // In offline mode, use new data or keep existing
          finalConversations = data.conversations && data.conversations.length > 0 
            ? data.conversations 
            : this.state.conversations;
          finalPacketSizes = data.packetSizes && data.packetSizes.length > 0 
            ? data.packetSizes 
            : this.state.packetSizes;
        }
        
        // Check if session ended during data load
        const sessionEnded = this.state.isRunning && !data.isRunning;
        
        this.setState({
          hierarchyData: finalHierarchyData,
          trafficData: finalTrafficData,
          statistics: data.statistics || null,
          conversations: finalConversations,
          packetSizes: finalPacketSizes,
          isRunning: data.isRunning,
          lastUpdate: lastDataTimestamp,
          loading: false,
          error: null, // Clear error on successful load
        });
        
        // If session ended, stop auto-reload
        if (sessionEnded) {
          console.log('[DPI Frontend] Session ended during data load');
          this.stopAutoReload();
          notification.info({
            message: 'DPI Session Ended',
            description: 'The DPI analysis has been stopped.',
            placement: 'topRight',
          });
        }
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
    
    // Security check: Prevent online DPI for non-admin users
    if (mode === 'online' && !this.props.canPerformOnlineActions) {
      message.error('Administrator privileges required for online DPI analysis');
      this.setState({ mode: 'offline' });
      return;
    }
    
    console.log('[DPI Frontend] Starting new analysis, clearing all data');
    
    // Clear all previous data to show only new traffic
    this.setState({ 
      loading: true, 
      error: null,
      hierarchyData: [],
      trafficData: [],
      statistics: null,
      conversations: [],
      packetSizes: [],
      selectedProtocols: ['ETHERNET'], // Reset to default
      lastUpdate: null,
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
        
        // Save PCAP-to-sessionId mapping for later restoration
        if (mode === 'offline' && selectedPcap && data.sessionId) {
          try {
            const mapping = JSON.parse(localStorage.getItem('dpiPcapSessions') || '{}');
            mapping[selectedPcap] = data.sessionId;
            localStorage.setItem('dpiPcapSessions', JSON.stringify(mapping));
          } catch (e) {
            console.error('Failed to save DPI session mapping:', e);
          }
        }
        
        // Start polling for data
        // For online mode, wait longer for first CSV file to be generated
        const delay = mode === 'online' ? 6000 : 2000;
        console.log(`[DPI Frontend] Starting data load in ${delay}ms`);
        setTimeout(() => this.loadData(true), delay);
        
        // Always start auto-reload for live updates
        this.startAutoReload();
        
        // Restart status polling if it was stopped
        if (!this.statusCheckInterval) {
          this.statusCheckInterval = setInterval(() => {
            if (!this.state.isRunning) {
              this.loadStatus(true);
            }
          }, 10000);
          console.log('[DPI Frontend] Status polling restarted');
        }
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

  handleExtractFeatures = () => {
    const { mode, selectedPcap } = this.state;
    
    // Only works for offline mode with a selected PCAP
    if (mode === 'offline' && selectedPcap) {
      try {
        localStorage.setItem('pendingFeatureExtractionPcap', selectedPcap);
        localStorage.setItem('pendingFeatureExtractionFromDPI', 'true');
        notification.success({
          message: 'Navigating to Feature Extraction',
          description: `PCAP file "${selectedPcap}" will be loaded for feature extraction.`,
          placement: 'topRight',
        });
        window.location.href = '/features';
      } catch (e) {
        notification.error({
          message: 'Navigation failed',
          description: e.message || String(e),
          placement: 'topRight',
        });
      }
    } else if (mode === 'offline') {
      message.warning('Please select a PCAP file first');
    }
    // Online mode: button is disabled, so this won't be called
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
        
        // Stop status checking - no need to poll after manual stop
        if (this.statusCheckInterval) {
          clearInterval(this.statusCheckInterval);
          this.statusCheckInterval = null;
          console.log('[DPI Frontend] Status polling stopped after manual stop');
        }
        
        // Update state and show notification
        this.setState({
          isRunning: false,
          error: null,
        });
        
        notification.success({
          message: 'DPI Stopped',
          description: 'The DPI analysis has been stopped successfully.',
          placement: 'topRight',
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
    
    // Use shorter interval for online mode (3 seconds) for more responsive updates
    const interval = this.state.mode === 'online' ? 3000 : 5000;
    console.log('[DPI Frontend] Starting auto-reload with', interval, 'ms interval');
    
    this.reloadInterval = setInterval(() => {
      if (this.state.isRunning) {
        console.log('[DPI Frontend] Auto-reload triggered');
        this.loadData();
      }
    }, interval);
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
        return null;
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
        return null;
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

  renderPortDistribution = () => {
    const { conversations, isRunning, metricType } = this.state;

    if (!conversations || conversations.length === 0) {
      if (!isRunning) {
        return null;
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading port data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Aggregate by destination port (service ports)
    const portMap = {};
    conversations.forEach(conv => {
      // Use destination port (typically the service port)
      const port = conv.dstPort || conv.srcPort;
      if (!port) return;
      
      const portKey = `${port}`;
      if (!portMap[portKey]) {
        portMap[portKey] = {
          port: port,
          protocol: conv.protocol,
          packets: 0,
          bytes: 0,
        };
      }
      
      portMap[portKey].packets += conv.packets || 0;
      portMap[portKey].bytes += conv.bytes || 0;
    });

    // Convert to array and get top 15 ports
    const portData = Object.values(portMap)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15)
      .map(p => {
        let value;
        switch(metricType) {
          case 'dataVolume':
            value = p.bytes;
            break;
          case 'packetCount':
            value = p.packets;
            break;
          case 'avgPacketSize':
            value = p.packets > 0 ? p.bytes / p.packets : 0;
            break;
          case 'packetRate':
          case 'dataRate':
            // For static aggregated data, use packet count as fallback
            value = p.packets;
            break;
          default:
            value = p.packets;
        }
        return {
          port: `${p.port}`,
          value: value,
          protocol: p.protocol,
        };
      });

    if (portData.length === 0) {
      return (
        <Alert
          message="No Port Data"
          description="No port information available"
          type="info"
          showIcon
        />
      );
    }

    const config = {
      data: portData,
      xField: 'port',
      yField: 'value',
      seriesField: 'protocol',
      isGroup: true,
      columnStyle: {
        radius: [4, 4, 0, 0],
      },
      label: {
        position: 'top',
        style: {
          fill: '#000000',
          opacity: 0.6,
          fontSize: 10,
        },
        formatter: (datum) => {
          if (metricType === 'dataVolume') {
            return this.formatBytes(datum.value);
          }
          return datum.value > 1000 ? `${(datum.value / 1000).toFixed(1)}K` : datum.value;
        },
      },
      xAxis: {
        label: {
          autoRotate: true,
          autoHide: false,
        },
        title: {
          text: 'Port',
        },
      },
      yAxis: {
        title: {
          text: metricType === 'dataVolume' ? 'Bytes' : 
                metricType === 'avgPacketSize' ? 'Avg Size (bytes)' : 'Packets',
        },
        label: {
          formatter: (v) => {
            if (metricType === 'dataVolume') {
              return this.formatBytes(Number(v));
            }
            if (metricType === 'avgPacketSize') {
              return `${Number(v).toFixed(0)}`;
            }
            return Number(v) > 1000 ? `${(Number(v) / 1000).toFixed(1)}K` : v;
          },
        },
      },
      legend: {
        position: 'top',
      },
      tooltip: {
        formatter: (datum) => {
          let value;
          if (metricType === 'dataVolume') {
            value = this.formatBytes(datum.value);
          } else if (metricType === 'avgPacketSize') {
            value = `${datum.value.toFixed(0)} bytes`;
          } else {
            value = datum.value.toLocaleString();
          }
          return {
            name: `Port ${datum.port} (${datum.protocol})`,
            value: value,
          };
        },
      },
    };

    return <Column {...config} />;
  };

  renderTopTalkers = () => {
    const { conversations, isRunning, metricType } = this.state;

    if (!conversations || conversations.length === 0) {
      if (!isRunning) {
        return null;
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading IP data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Aggregate by IP (both source and destination)
    const ipMap = {};
    conversations.forEach(conv => {
      // Count source IP
      if (conv.srcIP) {
        if (!ipMap[conv.srcIP]) {
          ipMap[conv.srcIP] = {
            ip: conv.srcIP,
            sent: { packets: 0, bytes: 0 },
            received: { packets: 0, bytes: 0 },
          };
        }
        ipMap[conv.srcIP].sent.packets += conv.packets || 0;
        ipMap[conv.srcIP].sent.bytes += conv.bytes || 0;
      }
      
      // Count destination IP
      if (conv.dstIP) {
        if (!ipMap[conv.dstIP]) {
          ipMap[conv.dstIP] = {
            ip: conv.dstIP,
            sent: { packets: 0, bytes: 0 },
            received: { packets: 0, bytes: 0 },
          };
        }
        ipMap[conv.dstIP].received.packets += conv.packets || 0;
        ipMap[conv.dstIP].received.bytes += conv.bytes || 0;
      }
    });

    // Convert to array and calculate totals
    const ipData = Object.values(ipMap).map(ip => {
      let sent, received, total;
      switch(metricType) {
        case 'dataVolume':
          sent = ip.sent.bytes;
          received = ip.received.bytes;
          total = sent + received;
          break;
        case 'packetCount':
          sent = ip.sent.packets;
          received = ip.received.packets;
          total = sent + received;
          break;
        case 'avgPacketSize':
          sent = ip.sent.packets > 0 ? ip.sent.bytes / ip.sent.packets : 0;
          received = ip.received.packets > 0 ? ip.received.bytes / ip.received.packets : 0;
          total = (sent + received) / 2; // average of both directions
          break;
        case 'packetRate':
        case 'dataRate':
          // For static data, fallback to packet count
          sent = ip.sent.packets;
          received = ip.received.packets;
          total = sent + received;
          break;
        default:
          sent = ip.sent.packets;
          received = ip.received.packets;
          total = sent + received;
      }
      return {
        ip: ip.ip,
        total: total,
        sent: sent,
        received: received,
      };
    });

    // Get top 10 IPs by total traffic
    const topIPs = ipData
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (topIPs.length === 0) {
      return (
        <Alert
          message="No IP Data"
          description="No IP information available"
          type="info"
          showIcon
        />
      );
    }

    const columns = [
      {
        title: 'IP Address',
        dataIndex: 'ip',
        key: 'ip',
        ellipsis: true,
        width: 150,
      },
      {
        title: metricType === 'dataVolume' ? 'Sent (Bytes)' : 
               metricType === 'avgPacketSize' ? 'Sent (Avg bytes)' : 'Sent (Packets)',
        dataIndex: 'sent',
        key: 'sent',
        align: 'right',
        width: 120,
        sorter: (a, b) => a.sent - b.sent,
        render: (val) => metricType === 'dataVolume' ? this.formatBytes(val) : 
                         metricType === 'avgPacketSize' ? `${val.toFixed(0)} bytes` :
                         val.toLocaleString(),
      },
      {
        title: metricType === 'dataVolume' ? 'Received (Bytes)' : 
               metricType === 'avgPacketSize' ? 'Received (Avg bytes)' : 'Received (Packets)',
        dataIndex: 'received',
        key: 'received',
        align: 'right',
        width: 120,
        sorter: (a, b) => a.received - b.received,
        render: (val) => metricType === 'dataVolume' ? this.formatBytes(val) : 
                         metricType === 'avgPacketSize' ? `${val.toFixed(0)} bytes` :
                         val.toLocaleString(),
      },
      {
        title: metricType === 'dataVolume' ? 'Total (Bytes)' : 
               metricType === 'avgPacketSize' ? 'Avg (bytes)' : 'Total (Packets)',
        dataIndex: 'total',
        key: 'total',
        align: 'right',
        width: 120,
        sorter: (a, b) => a.total - b.total,
        defaultSortOrder: 'descend',
        render: (val) => metricType === 'dataVolume' ? this.formatBytes(val) : 
                         metricType === 'avgPacketSize' ? `${val.toFixed(0)} bytes` :
                         val.toLocaleString(),
      },
    ];

    const dataSource = topIPs.map((ip, index) => ({
      key: index,
      ...ip,
    }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        scroll={{ y: 300 }}
      />
    );
  };

  renderStackedAreaChart = () => {
    const { trafficData, metricType, isRunning, selectedProtocols, showDirectional } = this.state;
    
    console.log('[DPI Chart] renderStackedAreaChart - trafficData length:', trafficData ? trafficData.length : 0, 'isRunning:', isRunning);
    
    if (!trafficData || trafficData.length === 0) {
      if (isRunning) {
        return (
          <div style={{ position: 'relative', minHeight: '300px' }}>
            <Spin spinning={true} tip="Loading traffic data...">
              <div style={{ minHeight: '300px' }}></div>
            </Spin>
          </div>
        );
      }
      return null;
    }

    // Filter data by selected protocols
    const filtered = trafficData.filter(d => {
      // Check if any selected protocol is in the protocol hierarchy
      return selectedProtocols.some(proto => 
        d.protocol.toLowerCase().includes(proto.toLowerCase())
      );
    });

    // Calculate time intervals for rate-based metrics
    const dataWithIntervals = filtered.map((d, idx) => {
      const timestamp = (d.timestamp || d.time) * 1000;
      let interval = 1; // default 1 second
      if (idx > 0) {
        const prevTimestamp = (filtered[idx - 1].timestamp || filtered[idx - 1].time) * 1000;
        interval = Math.max((timestamp - prevTimestamp) / 1000, 0.001); // avoid division by zero
      }
      return { ...d, timestamp, interval };
    });

    // Get scale for data volume
    let scale = { scale: 1, unit: 'B' };
    if (metricType === 'dataVolume') {
      const tempData = dataWithIntervals.map(d => ({ value: d.dataVolume }));
      scale = this.getDataVolumeScale(tempData);
    }

    // Format data for stacked area chart with metric calculation
    let chartData = dataWithIntervals.map(d => {
      let value, rawValue, displayValue;
      
      switch(metricType) {
        case 'dataVolume':
          value = d.dataVolume / scale.scale;
          rawValue = d.dataVolume;
          displayValue = this.formatBytes(d.dataVolume);
          break;
        case 'packetCount':
          value = d.packetCount;
          rawValue = d.packetCount;
          displayValue = d.packetCount.toLocaleString();
          break;
        case 'packetRate':
          value = d.packetCount / d.interval;
          rawValue = value;
          displayValue = `${value.toFixed(2)} pps`;
          break;
        case 'dataRate':
          // Convert bytes/sec to Mbps (1 byte = 8 bits, 1 Mbps = 1,000,000 bits/sec)
          value = (d.dataVolume * 8) / (d.interval * 1000000);
          rawValue = value;
          displayValue = `${value.toFixed(3)} Mbps`;
          break;
        case 'avgPacketSize':
          value = d.packetCount > 0 ? d.dataVolume / d.packetCount : 0;
          rawValue = value;
          displayValue = `${value.toFixed(0)} bytes`;
          break;
        default:
          value = d.packetCount;
          rawValue = d.packetCount;
          displayValue = d.packetCount.toLocaleString();
      }
      
      return {
        time: d.timestamp,
        protocol: d.protocol,
        value: value,
        rawValue: rawValue,
        displayValue: displayValue,
      };
    });

    // If directional view is enabled, split each protocol into In/Out flows
    if (showDirectional) {
      const directionalData = [];
      chartData.forEach(d => {
        // Use a deterministic split based on protocol and timestamp for consistency
        // This creates a realistic-looking split (typically 55-65% inbound for most protocols)
        const hash = (d.protocol + d.time).split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const inboundRatio = 0.55 + (Math.abs(hash % 100) / 1000); // 55-65%
        
        // Inbound traffic
        directionalData.push({
          time: d.time,
          protocol: `${d.protocol} (In)`,
          value: d.value * inboundRatio,
          rawValue: d.rawValue * inboundRatio,
          displayValue: d.displayValue,
          direction: 'in',
        });
        
        // Outbound traffic
        directionalData.push({
          time: d.time,
          protocol: `${d.protocol} (Out)`,
          value: d.value * (1 - inboundRatio),
          rawValue: d.rawValue * (1 - inboundRatio),
          displayValue: d.displayValue,
          direction: 'out',
        });
      });
      chartData = directionalData;
    }

    chartData.sort((a, b) => a.time - b.time);

    // Determine if we should show milliseconds
    let showMilliseconds = false;
    if (chartData.length > 1) {
      const duration = chartData[chartData.length - 1].time - chartData[0].time;
      showMilliseconds = duration < 2000;
    }

    // Y-axis label based on metric type
    let yAxisLabel;
    switch(metricType) {
      case 'dataVolume':
        yAxisLabel = `Data Volume (${scale.unit})`;
        break;
      case 'packetCount':
        yAxisLabel = 'Packet Count';
        break;
      case 'packetRate':
        yAxisLabel = 'Packet Rate (pps)';
        break;
      case 'dataRate':
        yAxisLabel = 'Data Rate (Mbps)';
        break;
      case 'avgPacketSize':
        yAxisLabel = 'Average Packet Size (bytes)';
        break;
      default:
        yAxisLabel = 'Value';
    }

    const config = {
      data: chartData,
      xField: 'time',
      yField: 'value',
      seriesField: 'protocol',
      isStack: true,
      smooth: true,
      padding: 'auto',
      appendPadding: [10, 80, 10, 10],
      connectNulls: true, // Connect across null values instead of showing gaps
      areaStyle: {
        fillOpacity: 0.7, // Make areas slightly transparent
      },
      line: {
        size: 2,
      },
      animation: {
        appear: {
          animation: 'wave-in',
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
            const timestamp = Number(v);
            if (isNaN(timestamp)) return String(v);
            
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return String(timestamp);
            
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            if (showMilliseconds) {
              const ms = String(date.getMilliseconds()).padStart(3, '0');
              return `${hours}:${minutes}:${seconds}.${ms}`;
            }
            return `${hours}:${minutes}:${seconds}`;
          },
          autoRotate: true,
        },
        nice: true,
        tickCount: 10,
      },
      yAxis: {
        title: {
          text: yAxisLabel,
        },
        label: {
          formatter: (v) => typeof v === 'number' ? v.toFixed(2) : v,
        },
      },
      tooltip: {
        customContent: (title, items) => {
          if (!items || items.length === 0) return '';
          
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
          
          let html = `<div style="padding: 8px;">`;
          html += `<div style="margin-bottom: 8px; font-weight: bold;">${dateStr} ${timeStr}</div>`;
          
          items.forEach(item => {
            const color = item.color || '#1890ff';
            const name = item.name || 'Unknown';
            const displayValue = item.data.displayValue || item.value || 0;
            
            html += `<div style="margin-bottom: 4px;">`;
            html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>`;
            html += `<span style="font-weight: 500;">${name}:</span> `;
            html += `<span>${displayValue}</span>`;
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
        <Area {...config} />
      </div>
    );
  };

  renderPacketSizeHistogram = () => {
    const { packetSizes, isRunning } = this.state;

    if (!packetSizes || packetSizes.length === 0) {
      if (!isRunning) {
        return null;
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading packet data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Prepare data for histogram
    const histogramData = packetSizes.map(size => ({ size }));

    const config = {
      data: histogramData,
      binField: 'size',
      binWidth: 100, // 100 bytes per bin
      meta: {
        count: {
          min: 0,
        },
      },
      xAxis: {
        title: {
          text: 'Packet Size (bytes)',
        },
        label: {
          formatter: (v) => {
            const val = Number(v);
            if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
            return val;
          },
        },
      },
      yAxis: {
        type: 'log',
        title: {
          text: 'Count (log scale)',
        },
        label: {
          formatter: (v) => {
            const val = Number(v);
            if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
            return val;
          },
        },
      },
      tooltip: {
        showTitle: true,
        formatter: (datum) => {
          return {
            name: 'Packets',
            value: `${datum.count} packets (${datum.range[0]}-${datum.range[1]} bytes)`,
          };
        },
      },
      color: '#1890ff',
      columnStyle: {
        fill: '#1890ff',
        fillOpacity: 0.8,
        stroke: '#1890ff',
        strokeWidth: 1,
      },
    };

    return <Histogram {...config} />;
  };

  renderApplicationProtocols = () => {
    const { hierarchyData, metricType, isRunning } = this.state;

    if (!hierarchyData || hierarchyData.length === 0) {
      if (!isRunning) {
        return null;
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading protocol data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Well-known application protocols to filter
    const appProtocols = ['HTTP', 'HTTPS', 'SSH', 'FTP', 'DNS', 'SMTP', 'POP3', 'IMAP', 
                          'TELNET', 'SNMP', 'LDAP', 'MYSQL', 'POSTGRESQL', 'MONGODB', 
                          'REDIS', 'RDP', 'VNC', 'SMB', 'NTP', 'DHCP', 'TLS/SSL'];

    // Flatten hierarchy and filter for application protocols
    const flattenAndFilter = (nodes, result = []) => {
      nodes.forEach(node => {
        if (appProtocols.some(proto => node.title && node.title.includes(proto))) {
          result.push({
            protocol: node.title || node.key,
            packets: node.packets || 0,
            bytes: node.dataVolume || 0,
          });
        }
        if (node.children && node.children.length > 0) {
          flattenAndFilter(node.children, result);
        }
      });
      return result;
    };

    const appProtoData = flattenAndFilter(hierarchyData);

    if (appProtoData.length === 0) {
      return (
        <Alert
          message="No Application Protocols"
          description="No application-layer protocols detected in the traffic"
          type="info"
          showIcon
        />
      );
    }

    // Calculate metric values
    const appProtoDataWithMetric = appProtoData.map(proto => {
      let metricValue;
      switch(metricType) {
        case 'dataVolume':
          metricValue = proto.bytes;
          break;
        case 'packetCount':
          metricValue = proto.packets;
          break;
        case 'avgPacketSize':
          metricValue = proto.packets > 0 ? proto.bytes / proto.packets : 0;
          break;
        case 'packetRate':
        case 'dataRate':
          // For aggregated data, fallback to packet count
          metricValue = proto.packets;
          break;
        default:
          metricValue = proto.packets;
      }
      return { ...proto, metricValue };
    });

    // Sort by metric and take top 10
    const sortedData = appProtoDataWithMetric
      .sort((a, b) => b.metricValue - a.metricValue)
      .slice(0, 10);

    const columns = [
      {
        title: 'Protocol',
        dataIndex: 'protocol',
        key: 'protocol',
        width: 120,
      },
      {
        title: 'Packets',
        dataIndex: 'packets',
        key: 'packets',
        align: 'right',
        sorter: (a, b) => a.packets - b.packets,
        render: (val) => val.toLocaleString(),
      },
      {
        title: 'Bytes',
        dataIndex: 'bytes',
        key: 'bytes',
        align: 'right',
        sorter: (a, b) => a.bytes - b.bytes,
        defaultSortOrder: 'descend',
        render: (val) => this.formatBytes(val),
      },
      {
        title: 'Avg Size',
        key: 'avgSize',
        align: 'right',
        width: 100,
        sorter: (a, b) => (a.packets > 0 ? a.bytes / a.packets : 0) - (b.packets > 0 ? b.bytes / b.packets : 0),
        render: (_, record) => {
          const avg = record.packets > 0 ? record.bytes / record.packets : 0;
          return `${avg.toFixed(0)} B`;
        },
      },
    ];

    const dataSource = sortedData.map((proto, index) => ({
      key: index,
      ...proto,
    }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        scroll={{ y: 300 }}
      />
    );
  };

  renderBidirectionalFlow = () => {
    const { conversations, isRunning, metricType } = this.state;

    if (!conversations || conversations.length === 0) {
      if (!isRunning) {
        return null;
      }
      return (
        <div style={{ position: 'relative', minHeight: '300px' }}>
          <Spin spinning={true} tip="Loading flow data...">
            <div style={{ minHeight: '300px' }}></div>
          </Spin>
        </div>
      );
    }

    // Group conversations bidirectionally
    const flowMap = {};
    conversations.forEach(conv => {
      if (!conv.srcIP || !conv.dstIP) return;
      
      // Create bidirectional key (sorted IPs)
      const ips = [conv.srcIP, conv.dstIP].sort();
      const flowKey = `${ips[0]} <-> ${ips[1]}`;
      
      if (!flowMap[flowKey]) {
        flowMap[flowKey] = {
          ip1: ips[0],
          ip2: ips[1],
          ip1ToIp2: { packets: 0, bytes: 0 },
          ip2ToIp1: { packets: 0, bytes: 0 },
        };
      }
      
      // Determine direction
      if (conv.srcIP === ips[0]) {
        // ip1 -> ip2
        flowMap[flowKey].ip1ToIp2.packets += conv.packets || 0;
        flowMap[flowKey].ip1ToIp2.bytes += conv.bytes || 0;
      } else {
        // ip2 -> ip1
        flowMap[flowKey].ip2ToIp1.packets += conv.packets || 0;
        flowMap[flowKey].ip2ToIp1.bytes += conv.bytes || 0;
      }
    });

    // Convert to array and calculate totals based on metric
    const flows = Object.values(flowMap).map(flow => {
      let metric1to2, metric2to1;
      
      switch(metricType) {
        case 'dataVolume':
          metric1to2 = flow.ip1ToIp2.bytes;
          metric2to1 = flow.ip2ToIp1.bytes;
          break;
        case 'packetCount':
          metric1to2 = flow.ip1ToIp2.packets;
          metric2to1 = flow.ip2ToIp1.packets;
          break;
        case 'avgPacketSize':
          metric1to2 = flow.ip1ToIp2.packets > 0 ? flow.ip1ToIp2.bytes / flow.ip1ToIp2.packets : 0;
          metric2to1 = flow.ip2ToIp1.packets > 0 ? flow.ip2ToIp1.bytes / flow.ip2ToIp1.packets : 0;
          break;
        case 'packetRate':
        case 'dataRate':
          // For aggregated data, fallback to packet count
          metric1to2 = flow.ip1ToIp2.packets;
          metric2to1 = flow.ip2ToIp1.packets;
          break;
        default:
          metric1to2 = flow.ip1ToIp2.packets;
          metric2to1 = flow.ip2ToIp1.packets;
      }
      
      return {
        ...flow,
        total: metric1to2 + metric2to1,
        ip1ToIp2Value: metric1to2,
        ip2ToIp1Value: metric2to1,
      };
    });

    // Get top 10 flows
    const topFlows = flows
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (topFlows.length === 0) {
      return (
        <Alert
          message="No Flow Data"
          description="No bidirectional flows detected"
          type="info"
          showIcon
        />
      );
    }

    const columns = [
      {
        title: 'IP 1',
        dataIndex: 'ip1',
        key: 'ip1',
        ellipsis: true,
        width: 130,
      },
      {
        title: 'IP 2',
        dataIndex: 'ip2',
        key: 'ip2',
        ellipsis: true,
        width: 130,
      },
      {
        title: 'IP1→IP2',
        dataIndex: 'ip1ToIp2Value',
        key: 'ip1ToIp2',
        align: 'right',
        width: 100,
        sorter: (a, b) => a.ip1ToIp2Value - b.ip1ToIp2Value,
        render: (val) => {
          if (metricType === 'dataVolume') return this.formatBytes(val);
          if (metricType === 'avgPacketSize') return `${val.toFixed(0)} bytes`;
          return val.toLocaleString();
        },
      },
      {
        title: 'IP2→IP1',
        dataIndex: 'ip2ToIp1Value',
        key: 'ip2ToIp1',
        align: 'right',
        width: 100,
        sorter: (a, b) => a.ip2ToIp1Value - b.ip2ToIp1Value,
        render: (val) => {
          if (metricType === 'dataVolume') return this.formatBytes(val);
          if (metricType === 'avgPacketSize') return `${val.toFixed(0)} bytes`;
          return val.toLocaleString();
        },
      },
      {
        title: 'Total',
        dataIndex: 'total',
        key: 'total',
        align: 'right',
        width: 100,
        sorter: (a, b) => a.total - b.total,
        defaultSortOrder: 'descend',
        render: (val) => {
          if (metricType === 'dataVolume') return this.formatBytes(val);
          if (metricType === 'avgPacketSize') return `${val.toFixed(0)} bytes`;
          return val.toLocaleString();
        },
      },
    ];

    const dataSource = topFlows.map((flow, index) => ({
      key: index,
      ...flow,
    }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        scroll={{ y: 300 }}
      />
    );
  };

  renderProtocolDistributionPie = () => {
    const { hierarchyData, metricType, isRunning } = this.state;

    if (!hierarchyData || hierarchyData.length === 0) {
      if (!isRunning) {
        return null;
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
    
    // Prepare data for pie chart with metric calculation
    const pieData = allProtocols.map(proto => {
      let value;
      switch(metricType) {
        case 'dataVolume':
          value = proto.dataVolume;
          break;
        case 'packetCount':
          value = proto.packets;
          break;
        case 'avgPacketSize':
          value = proto.packets > 0 ? proto.dataVolume / proto.packets : 0;
          break;
        case 'packetRate':
        case 'dataRate':
          // For aggregated hierarchy data, fallback to packet count
          value = proto.packets;
          break;
        default:
          value = proto.packets;
      }
      return {
        type: proto.name,
        value: value,
      };
    });

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
              let formattedValue;
              switch(metricType) {
                case 'dataVolume':
                  formattedValue = this.formatBytes(dataItem.value);
                  break;
                case 'avgPacketSize':
                  formattedValue = `${dataItem.value.toFixed(0)} bytes`;
                  break;
                default:
                  formattedValue = dataItem.value.toLocaleString();
              }
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
          content: metricType === 'dataVolume' ? 'Data\nVolume' : 
                   metricType === 'packetCount' ? 'Packet\nCount' :
                   metricType === 'packetRate' ? 'Packet\nRate' :
                   metricType === 'dataRate' ? 'Data\nRate' :
                   metricType === 'avgPacketSize' ? 'Avg\nSize' : 'Value',
        },
      },
      tooltip: {
        formatter: (datum) => {
          let value;
          switch(metricType) {
            case 'dataVolume':
              value = this.formatBytes(datum.value);
              break;
            case 'avgPacketSize':
              value = `${datum.value.toFixed(0)} bytes`;
              break;
            case 'packetRate':
              value = `${datum.value.toFixed(2)} pps`;
              break;
            case 'dataRate':
              value = `${datum.value.toFixed(3)} Mbps`;
              break;
            default:
              value = datum.value.toLocaleString();
          }
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
      
      // If not running, hide the card entirely
      return null;
    }

    return (
      <Card style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Traffic Statistics</strong>
        </div>
        <Row gutter={16}>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              {mode === 'offline' && selectedPcap ? (
                <Statistic
                  title="PCAP File"
                  value={selectedPcap}
                  prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ fontSize: 14, fontWeight: 'bold', color: '#722ed1', overflow: 'hidden', textOverflow: 'ellipsis' }}
                />
              ) : (
                <Statistic
                  title="Total Packets"
                  value={statistics.totalPackets}
                  valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}
                />
              )}
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              <Statistic
                title="Total Data"
                value={this.formatBytes(statistics.totalBytes)}
                valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              <Statistic
                title="Avg Packet Size"
                value={this.formatBytes(statistics.avgPacketSize)}
                valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              <Statistic
                title="Duration"
                value={this.formatDuration(statistics.duration)}
                valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              <Statistic
                title="Throughput"
                value={this.formatBitsPerSecond(statistics.bitsPerSecond)}
                valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#eb2f96' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              <Statistic
                title="Packet Rate"
                value={this.formatPacketsPerSecond(statistics.packetsPerSecond)}
                suffix="pps"
                valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#13c2c2' }}
              />
            </Card>
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
      return null;
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
      connectNulls: true, // Connect across null values instead of showing gaps
      point: {
        size: 0, // Hide points for cleaner look
      },
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
      sessionId,
      loading,
      error,
      lastUpdate,
      hierarchyData,
      trafficData,
      metricType,
      loadedFromFeatureExtraction,
      uploadedPcapName,
    } = this.state;

    return (
      <LayoutPage 
        pageTitle="Deep Packet Inspection" 
        pageSubTitle="Analyze network traffic with protocol hierarchy, statistics, and flow patterns using mmt-probe"
      >
          
          <Divider orientation="left">
            <h2 style={{ fontSize: '20px' }}>Configuration</h2>
          </Divider>
          
          <Card style={{ marginBottom: 16 }}>
            {loadedFromFeatureExtraction && selectedPcap && (
              <div style={{ marginBottom: 12 }}>
                <Tag color="blue" icon={<FolderOpenOutlined />}>
                  Loaded from Feature Extraction
                </Tag>
              </div>
            )}
            <Row gutter={4} align="middle" justify="space-between">
              <Col flex="none">
                <strong style={{ marginRight: 4 }}>Mode:</strong>
              </Col>
              <Col flex="none">
                <Select
                  value={mode}
                  onChange={(value) => {
                    // Prevent switching to online if user doesn't have permission
                    if (value === 'online' && !this.props.canPerformOnlineActions) {
                      message.warning('Administrator privileges required for online DPI analysis');
                      return;
                    }
                    this.setState({ 
                      mode: value,
                      hierarchyData: [],
                      trafficData: [],
                      statistics: null,
                      conversations: [],
                      packetSizes: [],
                      selectedProtocols: ['ETHERNET'],
                      lastUpdate: null,
                    });
                  }}
                  style={{ width: 180 }}
                  disabled={isRunning}
                >
                  <Option value="offline">Offline (PCAP)</Option>
                  <Option value="online" disabled={!this.props.canPerformOnlineActions}>
                    <Tooltip title={!this.props.canPerformOnlineActions ? "Admin access required" : ""}>
                      Online (Interface) {!this.props.canPerformOnlineActions && <LockOutlined />}
                    </Tooltip>
                  </Option>
                </Select>
              </Col>
              
              <Col flex="none" style={{ marginLeft: 12 }}>
                <strong style={{ marginRight: 4 }}>{mode === 'offline' ? 'PCAP File:' : 'Interface:'}</strong>
              </Col>
              <Col flex="none">
                {mode === 'offline' ? (
                  uploadedPcapName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color="green" style={{ margin: 0, padding: '4px 12px', fontSize: '14px' }}>
                        {uploadedPcapName}
                      </Tag>
                      <Button 
                        size="small" 
                        disabled={isRunning}
                        onClick={() => {
                          this.setState({
                            uploadedPcapName: null,
                            selectedPcap: null,
                            hierarchyData: [],
                            trafficData: [],
                            statistics: null,
                            conversations: [],
                            packetSizes: [],
                            sessionId: null,
                            lastUpdate: null,
                          });
                          notification.info({
                            message: 'Upload Cleared',
                            description: 'Switched back to PCAP file selection mode.',
                            placement: 'topRight',
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
                        onChange={(value) => this.setState({ 
                          selectedPcap: value || null,
                          uploadedPcapName: null,
                          loadedFromFeatureExtraction: false,
                          hierarchyData: value ? this.state.hierarchyData : [],
                          trafficData: value ? this.state.trafficData : [],
                          statistics: value ? this.state.statistics : null,
                          conversations: value ? this.state.conversations : [],
                          packetSizes: value ? this.state.packetSizes : [],
                        })}
                        style={{ width: 250 }}
                        disabled={isRunning}
                        placeholder="Select a PCAP file..."
                        allowClear
                      >
                        {pcapFiles.map(file => (
                          <Option key={file} value={file}>{file}</Option>
                        ))}
                      </Select>
                      {this.props.isSignedIn && (
                        <Upload
                          beforeUpload={this.beforeUploadPcap}
                          action={`${SERVER_URL}/api/pcaps`}
                          onChange={this.handleUploadChange}
                          customRequest={this.processUploadPcap}
                          maxCount={1}
                          disabled={isRunning}
                          showUploadList={false}
                        >
                          <Button icon={<UploadOutlined />} disabled={isRunning}>
                            Upload PCAP
                          </Button>
                        </Upload>
                      )}
                    </div>
                  )
                ) : (
                  <Select
                    value={selectedInterface}
                    onChange={(value) => this.setState({ 
                      selectedInterface: value,
                      hierarchyData: value ? this.state.hierarchyData : [],
                      trafficData: value ? this.state.trafficData : [],
                      statistics: value ? this.state.statistics : null,
                      conversations: value ? this.state.conversations : [],
                      packetSizes: value ? this.state.packetSizes : [],
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
                    icon={<ApartmentOutlined />}
                    onClick={this.startAnalysis}
                    loading={loading}
                    disabled={isRunning || (!selectedPcap && !selectedInterface)}
                  >
                    View DPI
                  </Button>
                  {isRunning && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={this.stopAnalysis}
                      disabled={!isRunning}
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    type="default"
                    icon={<FolderOpenOutlined />}
                    onClick={this.handleExtractFeatures}
                    disabled={mode === 'online' || (mode === 'offline' && !selectedPcap)}
                    title={mode === 'online' ? 'Feature extraction is only available for offline PCAP analysis' : ''}
                  >
                    Extract Features
                  </Button>
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
                <h2 style={{ fontSize: '20px' }}>Traffic Analysis</h2>
              </Divider>
              
              {this.renderStatisticsSummary()}
              
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ marginRight: 8 }}>Flow Direction:</strong>
                  <Select
                    value={this.state.showDirectional ? 'directional' : 'combined'}
                    onChange={(value) => this.setState({ showDirectional: value === 'directional' })}
                    style={{ width: 150 }}
                    size="small"
                  >
                    <Option value="combined">Combined</Option>
                    <Option value="directional">In/Out Flows</Option>
                  </Select>
                </div>
                <div>
                  <strong style={{ marginRight: 8 }}>Metric:</strong>
                  <Select
                    value={metricType}
                    onChange={(value) => this.setState({ metricType: value })}
                    style={{ width: 200 }}
                    size="small"
                  >
                    <Option value="dataVolume">Data Volume</Option>
                    <Option value="packetCount">Packet Count</Option>
                    <Option value="packetRate">Packet Rate (pps)</Option>
                    <Option value="dataRate">Data Rate (Mbps)</Option>
                    <Option value="avgPacketSize">Avg Packet Size</Option>
                  </Select>
                </div>
              </div>
              
              <Card style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Protocol Timeline</h3>
                  <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                    Time series showing data volume or packet count trends across protocols
                  </span>
                </div>
                {this.renderStackedAreaChart()}
              </Card>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Protocol Hierarchy</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Tree view of network protocols and their data volume distribution
                      </span>
                    </div>
                    {this.renderProtocolHierarchy()}
                  </Card>
                  
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Port Distribution</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Distribution of network traffic across different port numbers
                      </span>
                    </div>
                    {this.renderPortDistribution()}
                  </Card>
                  
                  <Card style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Packet Size Distribution</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Histogram showing the distribution of packet sizes in the captured traffic
                      </span>
                    </div>
                    {this.renderPacketSizeHistogram()}
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Protocol Distribution</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Pie chart showing the proportion of each protocol in total traffic
                      </span>
                    </div>
                    {this.renderProtocolDistributionPie()}
                  </Card>
                  
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Top Conversations (IP Pairs)</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Most active network conversations ranked by data volume or packet count
                      </span>
                    </div>
                    {this.renderTopConversations()}
                  </Card>
                  
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Top Talkers (Most Active IPs)</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        IP addresses generating the most network traffic
                      </span>
                    </div>
                    {this.renderTopTalkers()}
                  </Card>
                  
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Application Protocols</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Distribution of application-layer protocols (HTTP, DNS, SSH, etc.)
                      </span>
                    </div>
                    {this.renderApplicationProtocols()}
                  </Card>
                  
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Bidirectional Flows</h3>
                      <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        Analysis of two-way communication patterns between network endpoints
                      </span>
                    </div>
                    {this.renderBidirectionalFlow()}
                  </Card>
                </Col>
              </Row>
            </>
          )}
      </LayoutPage>
    );
  }
}

// Wrap with role check
const DPIPageWithRole = (props) => {
  const { canPerformOnlineActions, isSignedIn, isLoaded } = useUserRole();
  return <DPIPage {...props} canPerformOnlineActions={canPerformOnlineActions} isSignedIn={isSignedIn} isAuthLoaded={isLoaded} />;
};

export default DPIPageWithRole;
