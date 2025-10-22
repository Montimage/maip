import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Table, Divider, Alert, Spin, notification, Statistic, Tag, Row, Col, Select } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, LockOutlined } from '@ant-design/icons';
import { Line, Bar } from '@ant-design/plots';
import { SERVER_URL } from '../constants';
import { useUserRole } from '../hooks/useUserRole';

const { Option } = Select;

class EarlyPredictionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      contributions: [],
      detectedData: [],
      forecastData: [],
      forecastChartData: null,
      comparisonData: null,
      comparisonCSVData: null,
      forecastComparisonData: null,
      selectedAlgorithm: 'zscore',
      loading: false,
      running: false,
      errorMessage: null,
      lastUpdated: null,
    };
  }

  componentDidMount() {
    // Load only the raw flow data for initial visualization
    this.loadRawData();
  }

  loadRawData = async () => {
    this.setState({ loading: true });
    try {
      // Load only detected data (which contains flows_per_min)
      const detectedResp = await fetch(`${SERVER_URL}/api/early-prediction/data/detected`);
      if (detectedResp.ok) {
        const { data } = await detectedResp.json();
        this.setState({ detectedData: data });
      }
    } catch (error) {
      console.warn('Raw data not available:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  loadArtifacts = async () => {
    this.setState({ loading: true, errorMessage: null });
    try {

      // Fetch detected data for interactive chart
      try {
        const detectedResp = await fetch(`${SERVER_URL}/api/early-prediction/data/detected`);
        if (detectedResp.ok) {
          const { data } = await detectedResp.json();
          this.setState({ detectedData: data || [] });
        }
      } catch (e) {
        console.warn('Detected data not available:', e);
      }

      // Fetch forecast contributions
      try {
        const forecastResp = await fetch(`${SERVER_URL}/api/early-prediction/data/forecast`);
        if (forecastResp.ok) {
          const { data } = await forecastResp.json();
          const parsed = this.parseContributions(data);
          this.setState({ contributions: parsed, forecastData: data || [], lastUpdated: new Date().toLocaleString() });
        }
      } catch (e) {
        console.warn('Forecast data not available:', e);
      }

      // Fetch forecast chart data (historical + predictions)
      try {
        const forecastChartResp = await fetch(`${SERVER_URL}/api/early-prediction/data/forecast-chart`);
        if (forecastChartResp.ok) {
          const { data } = await forecastChartResp.json();
          this.setState({ forecastChartData: data });
        }
      } catch (e) {
        console.warn('Forecast chart data not available:', e);
      }

      // Fetch comparison data
      try {
        const comparisonResp = await fetch(`${SERVER_URL}/api/early-prediction/data/comparison`);
        if (comparisonResp.ok) {
          const { data } = await comparisonResp.json();
          this.setState({ comparisonData: data });
        }
      } catch (e) {
        console.warn('Comparison data not available:', e);
      }

      // Fetch comparison CSV data for algorithm selection
      try {
        const comparisonCSVResp = await fetch(`${SERVER_URL}/api/early-prediction/data/comparison-csv`);
        if (comparisonCSVResp.ok) {
          const { data } = await comparisonCSVResp.json();
          this.setState({ comparisonCSVData: data });
        }
      } catch (e) {
        console.warn('Comparison CSV data not available:', e);
      }

      // Fetch forecast comparison data
      try {
        const forecastCompResp = await fetch(`${SERVER_URL}/api/early-prediction/data/forecast-comparison`);
        if (forecastCompResp.ok) {
          const { data } = await forecastCompResp.json();
          this.setState({ forecastComparisonData: data });
        }
      } catch (e) {
        console.warn('Forecast comparison data not available:', e);
      }
    } catch (error) {
      console.error('Error loading artifacts:', error);
      this.setState({ errorMessage: error.message || 'Failed to load artifacts' });
    } finally {
      this.setState({ loading: false });
    }
  };


  parseContributions = (data) => {
    // data is an array of { timestamp, top_contributions: [[name, val], ...] }
    // Aggregate by feature name and compute average absolute contribution
    const aggregated = {};
    if (Array.isArray(data)) {
      data.forEach((record) => {
        const topContribs = record.top_contributions || [];
        topContribs.forEach(([name, val]) => {
          if (!aggregated[name]) {
            aggregated[name] = { sum: 0, count: 0 };
          }
          aggregated[name].sum += Math.abs(val);
          aggregated[name].count += 1;
        });
      });
    }

    // Convert to array and sort by average contribution
    const result = Object.entries(aggregated)
      .map(([name, { sum, count }]) => ({
        feature: name,
        avgContribution: (sum / count).toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.avgContribution) - parseFloat(a.avgContribution))
      .slice(0, 10); // Top 10

    return result;
  };

  runScripts = async () => {
    this.setState({ running: true, errorMessage: null });
    try {
      const response = await fetch(`${SERVER_URL}/api/early-prediction/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        notification.success({
          message: 'Scripts executed successfully',
          description: result.message || 'Early prediction artifacts generated.',
          placement: 'topRight',
        });
        setTimeout(() => this.loadArtifacts(), 1000);
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to run scripts');
      }
    } catch (error) {
      console.error('Error running scripts:', error);
      notification.error({
        message: 'Script execution failed',
        description: error.message || 'Unable to run early prediction scripts.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  runSelectedAlgorithm = async () => {
    const { selectedAlgorithm } = this.state;
    const algorithmNames = {
      'zscore': 'Z-Score',
      'ewma': 'EWMA',
      'iforest': 'Isolation Forest',
      'iqr': 'IQR'
    };

    this.setState({ running: true, errorMessage: null });
    
    try {
      // Run only the selected algorithm
      const response = await fetch(`${SERVER_URL}/api/early-prediction/run-single-algorithm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: selectedAlgorithm }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to run analysis');
      }

      notification.success({
        message: `${algorithmNames[selectedAlgorithm]} Complete`,
        description: `Detection and forecast completed for ${algorithmNames[selectedAlgorithm]}.`,
        placement: 'topRight',
      });

      setTimeout(() => this.loadArtifacts(), 1000);
    } catch (error) {
      console.error('Error:', error);
      notification.error({
        message: 'Analysis Failed',
        description: error.message || 'Unable to complete analysis.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  runDetect = async () => {
    this.setState({ running: true, errorMessage: null });
    try {
      const response = await fetch(`${SERVER_URL}/api/early-prediction/run-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        notification.success({
          message: 'Anomaly detection completed',
          description: result.message || 'Detection artifacts generated.',
          placement: 'topRight',
        });
        setTimeout(() => this.loadArtifacts(), 1000);
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to run detection');
      }
    } catch (error) {
      console.error('Error running detection:', error);
      notification.error({
        message: 'Detection failed',
        description: error.message || 'Unable to run anomaly detection.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  runForecast = async () => {
    this.setState({ running: true, errorMessage: null });
    try {
      const response = await fetch(`${SERVER_URL}/api/early-prediction/run-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        notification.success({
          message: 'Forecast completed',
          description: result.message || 'Forecast artifacts generated.',
          placement: 'topRight',
        });
        setTimeout(() => this.loadArtifacts(), 1000);
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to run forecast');
      }
    } catch (error) {
      console.error('Error running forecast:', error);
      notification.error({
        message: 'Forecast failed',
        description: error.message || 'Unable to run forecast.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  runComparison = async () => {
    this.setState({ running: true, errorMessage: null });
    try {
      // Run detection comparison
      const detectionResponse = await fetch(`${SERVER_URL}/api/early-prediction/run-comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!detectionResponse.ok) {
        throw new Error('Failed to run detection comparison');
      }

      // Run forecast comparison
      const forecastResponse = await fetch(`${SERVER_URL}/api/early-prediction/run-forecast-comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!forecastResponse.ok) {
        throw new Error('Failed to run forecast comparison');
      }

      notification.success({
        message: 'Analysis completed',
        description: 'Detection and forecast comparison completed for all 5 algorithms (Z-Score, EWMA, Isolation Forest, IQR, LOF).',
        placement: 'topRight',
      });
      setTimeout(() => this.loadArtifacts(), 1000);
    } catch (error) {
      console.error('Error running comparison:', error);
      notification.error({
        message: 'Analysis failed',
        description: error.message || 'Unable to complete analysis.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  runForecastComparison = async () => {
    this.setState({ running: true, errorMessage: null });
    try {
      const response = await fetch(`${SERVER_URL}/api/early-prediction/run-forecast-comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        notification.success({
          message: 'Forecast comparison completed',
          description: 'Generated forecasts for all 4 detection algorithms.',
          placement: 'topRight',
        });
        setTimeout(() => this.loadArtifacts(), 1000);
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to run forecast comparison');
      }
    } catch (error) {
      console.error('Error running forecast comparison:', error);
      notification.error({
        message: 'Forecast comparison failed',
        description: error.message || 'Unable to run forecast comparison.',
        placement: 'topRight',
      });
      this.setState({ errorMessage: error.message });
    } finally {
      this.setState({ running: false });
    }
  };

  renderMultiAlgorithmForecastChart = () => {
    const { forecastComparisonData } = this.state;
    if (!forecastComparisonData) return null;

    const { historical, forecasts } = forecastComparisonData;

    // Prepare data for Line chart
    const chartData = [];

    // Add historical data
    (historical || []).forEach((row) => {
      chartData.push({
        timestamp: row.timestamp,
        value: parseFloat(row.flows_per_min),
        type: 'Historical',
      });
    });

    // Add forecasts for each algorithm
    const algorithmColors = {
      'zscore': 'Z-Score',
      'ewma': 'EWMA',
      'iforest': 'Isolation Forest',
      'iqr': 'IQR',
      'lof': 'LOF'
    };

    // Debug: log available algorithms
    console.log('Available forecast algorithms:', Object.keys(forecasts));

    Object.keys(forecasts).forEach((algoKey) => {
      const algoData = forecasts[algoKey];
      const algoName = algorithmColors[algoKey] || algoKey.toUpperCase();
      
      console.log(`Processing ${algoKey}: ${algoName}, forecast points: ${(algoData.forecast || []).length}`);
      
      (algoData.forecast || []).forEach((row) => {
        chartData.push({
          timestamp: row.timestamp,
          value: parseFloat(row.pred),
          type: `${algoName} Forecast`,
        });
      });
    });

    const config = {
      data: chartData,
      xField: 'timestamp',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      animation: false,
      xAxis: {
        type: 'time',
        label: {
          autoRotate: true,
          autoHide: true,
        },
      },
      yAxis: {
        label: {
          formatter: (v) => `${parseFloat(v).toFixed(0)}`,
        },
      },
      legend: {
        position: 'top-right',
      },
      color: ['#1890ff', '#52c41a', '#ff7a45', '#9254de', '#ffc53d', '#eb2f96'],
      lineStyle: (datum) => {
        if (datum.type === 'Historical') {
          return { lineWidth: 2 };
        }
        return { lineWidth: 1.5, lineDash: [4, 4] };
      },
    };

    // Check for early warnings
    const warnings = [];
    Object.keys(forecasts).forEach((algoKey) => {
      const algoData = forecasts[algoKey];
      if (algoData.early_warning) {
        warnings.push({
          algorithm: algorithmColors[algoKey],
          reasons: algoData.warning_reasons,
          threshold: algoData.anomaly_threshold
        });
      }
    });

    return (
      <>
        <Line {...config} style={{ height: 400 }} />
        {warnings.length > 0 && (
          <Alert
            message={`EARLY WARNING (${warnings.length} algorithm${warnings.length > 1 ? 's' : ''})`}
            description={
              <div>
                {warnings.map((w, idx) => (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <strong>{w.algorithm}:</strong> {w.reasons.join(', ')} (Threshold: {w.threshold.toFixed(2)} flows/min)
                  </div>
                ))}
              </div>
            }
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </>
    );
  };

  renderForecastChart = () => {
    const { forecastChartData } = this.state;
    if (!forecastChartData) return null;

    const { historical, forecast, anomaly_threshold, early_warning } = forecastChartData;

    // Prepare data for Line chart
    const chartData = [];

    // Add historical data
    (historical || []).forEach((row) => {
      chartData.push({
        timestamp: row.timestamp,
        value: parseFloat(row.flows_per_min),
        type: 'Observed',
      });
    });

    // Add forecast data
    (forecast || []).forEach((row) => {
      chartData.push({
        timestamp: row.timestamp,
        value: parseFloat(row.pred),
        type: 'Forecast',
      });
      chartData.push({
        timestamp: row.timestamp,
        value: parseFloat(row.lower95),
        type: 'Lower 95%',
      });
      chartData.push({
        timestamp: row.timestamp,
        value: parseFloat(row.upper95),
        type: 'Upper 95%',
      });
    });

    // Add threshold line across entire time range
    if (historical && historical.length > 0 && forecast && forecast.length > 0) {
      const firstTime = historical[0].timestamp;
      const lastTime = forecast[forecast.length - 1].timestamp;
      chartData.push({
        timestamp: firstTime,
        value: anomaly_threshold,
        type: '3σ Threshold',
      });
      chartData.push({
        timestamp: lastTime,
        value: anomaly_threshold,
        type: '3σ Threshold',
      });
    }

    const config = {
      data: chartData,
      xField: 'timestamp',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      animation: false,
      xAxis: {
        type: 'time',
        label: {
          autoRotate: true,
          autoHide: true,
        },
      },
      yAxis: {
        label: {
          formatter: (v) => `${parseFloat(v).toFixed(0)}`,
        },
      },
      legend: {
        position: 'top-right',
      },
      color: ['#1890ff', '#52c41a', '#d3d3d3', '#d3d3d3', '#ff4d4f'],
      lineStyle: (datum) => {
        if (datum.type === 'Lower 95%' || datum.type === 'Upper 95%') {
          return { lineDash: [2, 2], opacity: 0.4 };
        }
        if (datum.type === '3σ Threshold') {
          return { lineDash: [4, 4], opacity: 0.7, lineWidth: 2 };
        }
        if (datum.type === 'Forecast') {
          return { lineWidth: 2 };
        }
        return {};
      },
    };

    return (
      <>
        <Line {...config} style={{ height: 400 }} />
        {early_warning && (
          <Alert
            message="⚠️ EARLY WARNING"
            description="Forecast crosses the anomaly threshold — potential staged attack detected!"
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </>
    );
  };

  renderContributionsChart = () => {
    const { contributions } = this.state;
    if (!contributions || contributions.length === 0) return null;

    const config = {
      data: contributions,
      xField: 'avgContribution',
      yField: 'feature',
      seriesField: 'feature',
      legend: false,
      color: '#1890ff',
      label: {
        position: 'right',
        formatter: (datum) => `${datum.avgContribution}`,
      },
      xAxis: {
        label: {
          formatter: (v) => `${parseFloat(v).toFixed(1)}`,
        },
      },
    };

    return <Bar {...config} style={{ height: 300 }} />;
  };

  renderRawDataChart = () => {
    const { detectedData } = this.state;
    if (!detectedData || detectedData.length === 0) return null;

    // Sample data for performance
    const sampledData = detectedData.length > 1000
      ? detectedData.filter((_, idx) => idx % 10 === 0)
      : detectedData;

    // Prepare data - only flows per minute
    const chartData = sampledData.map(row => ({
      timestamp: row.timestamp,
      value: parseFloat(row.flows_per_min),
      type: 'Flows per min'
    }));

    const config = {
      data: chartData,
      xField: 'timestamp',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      animation: false,
      xAxis: {
        type: 'time',
        label: {
          autoRotate: true,
          autoHide: true,
        },
      },
      yAxis: {
        label: {
          formatter: (v) => `${parseFloat(v).toFixed(0)}`,
        },
      },
      legend: {
        position: 'top-right',
      },
      color: ['#1890ff'],
      lineStyle: {
        lineWidth: 2,
      },
    };

    return <Line {...config} style={{ height: 400 }} />;
  };

  renderDetectionChart = () => {
    const { comparisonCSVData, selectedAlgorithm } = this.state;
    
    // Use comparison data if available, otherwise fall back to original detected data
    const dataToUse = comparisonCSVData && comparisonCSVData.length > 0 ? comparisonCSVData : this.state.detectedData;
    
    if (!dataToUse || dataToUse.length === 0) return null;

    // Map algorithm names to flag columns
    const algorithmFlagMap = {
      'zscore': 'zscore_flag',
      'ewma': 'ewma_flag',
      'iforest': 'iforest_flag',
      'iqr': 'iqr_flag',
      'lof': 'lof_flag'
    };

    const flagColumn = algorithmFlagMap[selectedAlgorithm] || 'anomaly_flag';

    // Sample data for performance but keep all anomalies
    let sampledData;
    if (dataToUse.length > 1000) {
      // Keep every 10th point + all anomalies
      sampledData = dataToUse.filter((row, idx) => {
        return idx % 10 === 0 || parseInt(row[flagColumn] || row.anomaly_flag || 0) === 1;
      });
    } else {
      sampledData = dataToUse;
    }

    // Prepare data for Line chart
    const chartData = [];
    
    sampledData.forEach((row) => {
      const timestamp = row.timestamp;
      const flowsPerMin = parseFloat(row.flows_per_min);
      const anomalyFlag = parseInt(row[flagColumn] || row.anomaly_flag || 0);

      if (!isNaN(flowsPerMin)) {
        chartData.push({ timestamp, value: flowsPerMin, type: 'Flows per min' });
        
        // Add anomaly points as separate series for visibility
        if (anomalyFlag === 1) {
          chartData.push({ timestamp, value: flowsPerMin, type: 'Anomaly' });
        }
      }

      // Add reference lines for Z-Score algorithm (rolling mean and bands)
      if (selectedAlgorithm === 'zscore' && row.roll_mean && row.roll_std) {
        const rollMean = parseFloat(row.roll_mean);
        const rollStd = parseFloat(row.roll_std);
        if (!isNaN(rollMean)) {
          chartData.push({ timestamp, value: rollMean, type: 'Rolling mean' });
          if (!isNaN(rollStd)) {
            chartData.push({ timestamp, value: rollMean + 3 * rollStd, type: 'Upper 3σ' });
            chartData.push({ timestamp, value: rollMean - 3 * rollStd, type: 'Lower 3σ' });
          }
        }
      }
    });

    const config = {
      data: chartData,
      xField: 'timestamp',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      animation: false,
      xAxis: {
        type: 'time',
        label: {
          autoRotate: true,
          autoHide: true,
        },
      },
      yAxis: {
        label: {
          formatter: (v) => `${parseFloat(v).toFixed(0)}`,
        },
      },
      legend: {
        position: 'top-right',
      },
      // Use color function for explicit mapping
      color: (datum) => {
        const colorMap = {
          'Flows per min': '#1890ff',    // Blue
          'Anomaly': '#ff4d4f',           // Red
          'Rolling mean': '#722ed1',      // Purple
          'Upper 3σ': '#ffadd2',          // Light pink
          'Lower 3σ': '#ffadd2',          // Light pink
        };
        return colorMap[datum.type] || '#1890ff';
      },
      lineStyle: (datum) => {
        if (datum.type === 'Upper 3σ' || datum.type === 'Lower 3σ') {
          return { lineDash: [4, 4], opacity: 0.5, lineWidth: 1 };
        }
        if (datum.type === 'Anomaly') {
          return { lineWidth: 4 }; // Thick red line for anomalies (all algorithms)
        }
        if (datum.type === 'Flows per min') {
          return { lineWidth: 1.5 };
        }
        if (datum.type === 'Rolling mean') {
          return { lineWidth: 2 }; // Purple rolling mean line
        }
        return { lineWidth: 1 };
      },
    };

    return <Line {...config} style={{ height: 400 }} key={selectedAlgorithm} />;
  };

  render() {
    const {
      contributions,
      detectedData,
      forecastChartData,
      comparisonData,
      comparisonCSVData,
      forecastComparisonData,
      selectedAlgorithm,
      loading,
      running,
      errorMessage,
      lastUpdated,
    } = this.state;
    
    const { isAdmin, isSignedIn } = this.props;

    // Algorithm display names
    const algorithmNames = {
      'zscore': 'Z-Score',
      'ewma': 'EWMA',
      'iforest': 'Isolation Forest',
      'iqr': 'IQR',
      'lof': 'LOF'
    };

    const contribColumns = [
      {
        title: 'Feature',
        dataIndex: 'feature',
        key: 'feature',
      },
      {
        title: 'Avg |Contribution|',
        dataIndex: 'avgContribution',
        key: 'avgContribution',
        align: 'right',
      },
    ];

    const hasArtifacts = contributions.length > 0 || detectedData.length > 0 || forecastChartData;

    // Frozen overlay style for non-admin users
    const frozenOverlayStyle = {
      position: 'relative',
      pointerEvents: isAdmin ? 'auto' : 'none',
      opacity: isAdmin ? 1 : 0.5,
    };

    const overlayMessageStyle = {
      position: 'fixed',
      top: '50%',
      left: 'calc(50% + 135px)',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '24px 32px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      textAlign: 'center',
      border: '2px solid #ff4d4f',
      maxWidth: '500px',
    };

    return (
      <LayoutPage
        pageTitle="Early Prediction"
        pageSubTitle="Anomaly detection and short-term forecasting for staged attack prediction"
      >
        {/* Overlay message for non-admin users */}
        {!isAdmin && (
          <div style={overlayMessageStyle}>
            <LockOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px', fontWeight: 600 }}>Administrator Access Required</h3>
            <p style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: 0 }}>
              Only administrators can access early prediction
            </p>
          </div>
        )}
        
        <div style={frozenOverlayStyle}>
        {/* Algorithm Comparison Summary Banner */}
        {!loading && comparisonData && (
          <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f5ff' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Algorithm Comparison Results</strong>
            </div>
            <Row gutter={12}>
              {comparisonData.algorithms.map((algo, idx) => (
                <Col flex={1} key={idx}>
                  <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                    <Statistic
                      title={algo.name}
                      value={algo.anomalies}
                      suffix={`(${algo.rate.toFixed(2)}%)`}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {errorMessage && (
          <Alert
            message="Error"
            description={errorMessage}
            type="error"
            closable
            onClose={() => this.setState({ errorMessage: null })}
            style={{ marginBottom: 16 }}
          />
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="Loading artifacts..." />
          </div>
        )}

        {/* Show raw data chart before analysis */}
        {!loading && detectedData.length > 0 && !comparisonData && (
          <>
            <Divider orientation="left">
              <h2 style={{ fontSize: '20px' }}>Network Traffic Overview</h2>
            </Divider>
            <Card style={{ marginBottom: 16 }}>
              {this.renderRawDataChart()}
              <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                Raw network traffic visualization on flows_per_min
              </p>
            </Card>
            
            {/* Main Action Button */}
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                onClick={this.runComparison}
                disabled={running}
                size="large"
                style={{ minWidth: 250 }}
              >
                Run Detection & Forecast
                {running && <Spin size="small" style={{ marginLeft: 8 }} />}
              </Button>
              <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                Analyze traffic with 5 anomaly detection algorithms and generate forecast
              </p>
            </div>
          </>
        )}

        {!loading && !hasArtifacts && detectedData.length === 0 && (
          <Alert
            message="No Data Available"
            description="No network traffic data found. Please ensure data collection is running."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Early Warning Banner - Priority 1 */}
        {!loading && forecastChartData?.early_warning && (
          <Alert
            message={
              <div style={{ textAlign: 'center' }}>
                <WarningOutlined style={{ marginRight: 8 }} />
                <strong>EARLY WARNING: Potential Staged Attack Detected</strong>
              </div>
            }
            description={
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>Anomaly Threshold:</strong> {forecastChartData.anomaly_threshold?.toFixed(2)} flows/min
                </p>
                {forecastChartData.warning_reasons && forecastChartData.warning_reasons.length > 0 && (
                  <p style={{ marginBottom: 8 }}>
                    <strong>Reasons:</strong> {forecastChartData.warning_reasons.join(', ')}
                  </p>
                )}
                <p style={{ marginBottom: 0 }}>
                  <strong>Action Required:</strong> Investigate network activity and prepare mitigation measures.
                </p>
              </div>
            }
            type="error"
            showIcon
            banner
            closable
            style={{ marginBottom: 16 }}
          />
        )}



        {!loading && hasArtifacts && comparisonData && (
          <>
            <Divider orientation="left">
              <h2 style={{ fontSize: '20px' }}>Anomaly Detection</h2>
            </Divider>

            {comparisonCSVData && comparisonCSVData.length > 0 && (
              <>
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 'bold' }}>Select Algorithm:</span>
                  <Select
                    value={selectedAlgorithm}
                    onChange={(value) => this.setState({ selectedAlgorithm: value })}
                    style={{ width: 240 }}
                  >
                    <Option value="zscore">Z-Score (Rolling 3σ)</Option>
                    <Option value="ewma">EWMA (Exponential Weighted)</Option>
                    <Option value="iforest">Isolation Forest (ML)</Option>
                    <Option value="iqr">IQR (Interquartile Range)</Option>
                    <Option value="lof">LOF (Local Outlier Factor)</Option>
                  </Select>
                </div>

                {/* Selected Algorithm Statistics Banner */}
                <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fff7e6', textAlign: 'center' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="Total Data Points"
                        value={comparisonCSVData.length}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title={`Anomalies (${algorithmNames[selectedAlgorithm]})`}
                        value={(() => {
                          const flagColumn = {
                            'zscore': 'zscore_flag',
                            'ewma': 'ewma_flag',
                            'iforest': 'iforest_flag',
                            'iqr': 'iqr_flag',
                            'lof': 'lof_flag'
                          }[selectedAlgorithm];
                          return comparisonCSVData.filter(d => String(d[flagColumn]) === '1').length;
                        })()}
                        valueStyle={{ color: '#cf1322' }}
                        prefix={<WarningOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Anomaly Rate"
                        value={(() => {
                          const flagColumn = {
                            'zscore': 'zscore_flag',
                            'ewma': 'ewma_flag',
                            'iforest': 'iforest_flag',
                            'iqr': 'iqr_flag',
                            'lof': 'lof_flag'
                          }[selectedAlgorithm];
                          const anomalyCount = comparisonCSVData.filter(d => String(d[flagColumn]) === '1').length;
                          return ((anomalyCount / comparisonCSVData.length) * 100).toFixed(1);
                        })()}
                        suffix="%"
                        valueStyle={{
                          color: (() => {
                            const flagColumn = {
                              'zscore': 'zscore_flag',
                              'ewma': 'ewma_flag',
                              'iforest': 'iforest_flag',
                              'iqr': 'iqr_flag',
                              'lof': 'lof_flag'
                            }[selectedAlgorithm];
                            const anomalyCount = comparisonCSVData.filter(d => String(d[flagColumn]) === '1').length;
                            return (anomalyCount / comparisonCSVData.length) > 0.05 ? '#cf1322' : '#3f8600';
                          })()
                        }}
                      />
                    </Col>
                  </Row>
                </Card>
              </>
            )}

            {(comparisonCSVData || detectedData).length > 0 ? (
              <Card style={{ marginBottom: 24 }} key={selectedAlgorithm}>
                {this.renderDetectionChart()}
                <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                  {algorithmNames[selectedAlgorithm]} anomaly detection on flows_per_min
                </p>
              </Card>
            ) : (
              <Alert
                message="Anomaly detection data not available"
                description="Click 'Run Detection' to generate anomaly detection results."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            <Divider orientation="left">
              <h2 style={{ fontSize: '20px' }}>
                {forecastComparisonData ? 'Multi-Algorithm Forecast Comparison' : `Short-term Forecast - ${algorithmNames[selectedAlgorithm]}`}
              </h2>
            </Divider>
            {forecastComparisonData ? (
              <Card style={{ marginBottom: 24 }}>
                {this.renderMultiAlgorithmForecastChart()}
                <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                  Multi-algorithm forecast comparison: Last 12h history + next 60min predictions from all 5 detection algorithms (Z-Score, EWMA, Isolation Forest, IQR, LOF)
                </p>
              </Card>
            ) : forecastChartData ? (
              <Card style={{ marginBottom: 24 }}>
                {this.renderForecastChart()}
                <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                  Interactive forecast: Last 12h history + next 60min prediction with 95% bands and 3σ threshold
                </p>
              </Card>
            ) : (
              <Alert
                message="Forecast data not available"
                description="Click 'Run Forecast' to generate forecast results, or 'Compare Forecast' for multi-algorithm comparison."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            {contributions.length > 0 && (
              <>
                <Divider orientation="left">
                  <h2 style={{ fontSize: '20px' }}>Top Contributing Features (Forecast)</h2>
                </Divider>
                <Card>
                  <Row gutter={16}>
                    {/* Left: Chart */}
                    <Col span={12}>
                      {this.renderContributionsChart()}
                      <p style={{ marginTop: 12, fontSize: 12, color: '#666', textAlign: 'center' }}>
                        Average absolute contribution of temporal features across the forecast horizon
                      </p>
                    </Col>
                    
                    {/* Right: Feature Description Table */}
                    <Col span={12}>
                      <div style={{ marginTop: 8 }}>
                        <h4 style={{ marginBottom: 12 }}>Feature Descriptions</h4>
                        <Table
                    dataSource={[
                      {
                        key: '1',
                        feature: 'lag_1',
                        description: 'Flow rate 1 minute ago',
                        type: 'Recent History',
                        importance: 'Captures immediate short-term trends'
                      },
                      {
                        key: '2',
                        feature: 'lag_5',
                        description: 'Flow rate 5 minutes ago',
                        type: 'Short-term History',
                        importance: 'Captures recent patterns and momentum'
                      },
                      {
                        key: '3',
                        feature: 'lag_10',
                        description: 'Flow rate 10 minutes ago',
                        type: 'Medium-term History',
                        importance: 'Identifies emerging trends'
                      },
                      {
                        key: '4',
                        feature: 'lag_60',
                        description: 'Flow rate 60 minutes ago (1 hour)',
                        type: 'Long-term History',
                        importance: 'Captures hourly patterns and cycles'
                      },
                      {
                        key: '5',
                        feature: 'tod_sin',
                        description: 'Time of day (sine component)',
                        type: 'Temporal Cycle',
                        importance: 'Captures daily periodicity (morning/evening peaks)'
                      },
                      {
                        key: '6',
                        feature: 'tod_cos',
                        description: 'Time of day (cosine component)',
                        type: 'Temporal Cycle',
                        importance: 'Captures daily periodicity (complementary to sine)'
                      }
                    ]}
                    columns={[
                      {
                        title: 'Feature',
                        dataIndex: 'feature',
                        key: 'feature',
                        width: 100,
                        render: (text) => <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>{text}</code>
                      },
                      {
                        title: 'Description',
                        dataIndex: 'description',
                        key: 'description',
                        width: 200
                      },
                      {
                        title: 'Type',
                        dataIndex: 'type',
                        key: 'type',
                        width: 150,
                        render: (text) => {
                          const color = text.includes('History') ? 'blue' : 'green';
                          return <Tag color={color}>{text}</Tag>;
                        }
                      },
                      {
                        title: 'Importance',
                        dataIndex: 'importance',
                        key: 'importance'
                      }
                    ]}
                    pagination={false}
                    size="small"
                  />
                      </div>
                    </Col>
                  </Row>
                </Card>
              </>
            )}

          </>
        )}
        </div>
      </LayoutPage>
    );
  }
}

// Wrap with role check
const EarlyPredictionPageWithRole = (props) => {
  const userRole = useUserRole();
  return <EarlyPredictionPage {...props} isAdmin={userRole.isAdmin} isSignedIn={userRole.isSignedIn} />;
};

export default EarlyPredictionPageWithRole;
