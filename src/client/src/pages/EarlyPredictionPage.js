import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Button, Card, Table, Divider, Alert, Spin, notification } from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Line, Bar } from '@ant-design/plots';
import { SERVER_URL } from '../constants';

class EarlyPredictionPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      contributions: [],
      detectedData: [],
      forecastData: [],
      forecastChartData: null,
      loading: false,
      running: false,
      errorMessage: null,
      lastUpdated: null,
    };
  }

  componentDidMount() {
    this.loadArtifacts();
  }

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

  renderDetectionChart = () => {
    const { detectedData } = this.state;
    if (!detectedData || detectedData.length === 0) return null;

    // Sample data for performance (take every 10th point if > 1000 points)
    const sampledData = detectedData.length > 1000
      ? detectedData.filter((_, idx) => idx % 10 === 0)
      : detectedData;

    // Prepare data for Line chart
    const chartData = [];
    sampledData.forEach((row) => {
      const timestamp = row.timestamp;
      const flowsPerMin = parseFloat(row.flows_per_min);
      const rollMean = parseFloat(row.roll_mean);
      const rollStd = parseFloat(row.roll_std);
      const anomalyFlag = parseInt(row.anomaly_flag);

      if (!isNaN(flowsPerMin)) {
        chartData.push({ timestamp, value: flowsPerMin, type: 'Flows per min' });
      }
      if (!isNaN(rollMean)) {
        chartData.push({ timestamp, value: rollMean, type: 'Rolling mean' });
        // Add ±3σ bands
        if (!isNaN(rollStd)) {
          chartData.push({ timestamp, value: rollMean + 3 * rollStd, type: 'Upper 3σ' });
          chartData.push({ timestamp, value: rollMean - 3 * rollStd, type: 'Lower 3σ' });
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
      color: ['#1890ff', '#52c41a', '#ff4d4f', '#ff4d4f'],
      lineStyle: (datum) => {
        if (datum.type === 'Upper 3σ' || datum.type === 'Lower 3σ') {
          return { lineDash: [4, 4], opacity: 0.5 };
        }
        return {};
      },
    };

    return <Line {...config} style={{ height: 400 }} />;
  };

  render() {
    const {
      contributions,
      detectedData,
      forecastChartData,
      loading,
      running,
      errorMessage,
      lastUpdated,
    } = this.state;

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

    return (
      <LayoutPage
        pageTitle="Early Prediction"
        pageSubTitle="Anomaly detection and short-term forecasting for staged attack prediction"
      >
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={this.runDetect}
            loading={running}
            disabled={running}
          >
            Run Detection
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={this.runForecast}
            loading={running}
            disabled={running}
          >
            Run Forecast
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={this.runScripts}
            loading={running}
            disabled={running}
          >
            Run Both
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={this.loadArtifacts}
            loading={loading}
            disabled={loading || running}
          >
            Refresh Results
          </Button>
        </div>

        {lastUpdated && (
          <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
            Last updated: {lastUpdated}
          </div>
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

        {!loading && !hasArtifacts && (
          <Alert
            message="No Results Available"
            description="Click 'Run Detection' to start anomaly detection, then 'Run Forecast' to generate predictions. Or click 'Run Both' to execute both steps."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!loading && hasArtifacts && !lastUpdated && (
          <Alert
            message="Displaying Cached Results"
            description="These results are from a previous run. Click 'Run Detection' or 'Run Forecast' to generate fresh analysis with current data."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!loading && hasArtifacts && lastUpdated && (
          <Alert
            message="Fresh Results"
            description={`Analysis completed successfully. Last updated: ${lastUpdated}`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!loading && hasArtifacts && (
          <>
            <Divider orientation="left">
              <h2 style={{ fontSize: '20px' }}>Anomaly Detection (Rolling 3σ)</h2>
            </Divider>
            {detectedData.length > 0 ? (
              <Card style={{ marginBottom: 24 }}>
                {this.renderDetectionChart()}
                <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                  Interactive rolling z-score anomaly detection on flows_per_min with ±3σ bands
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
              <h2 style={{ fontSize: '20px' }}>Short-term Forecast & Early Warning</h2>
            </Divider>
            {forecastChartData ? (
              <Card style={{ marginBottom: 24 }}>
                {this.renderForecastChart()}
                <p style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
                  Interactive forecast: Last 12h history + next 60min prediction with 95% bands and 3σ threshold
                </p>
              </Card>
            ) : (
              <Alert
                message="Forecast data not available"
                description="Click 'Run Forecast' to generate forecast results."
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
                  {this.renderContributionsChart()}
                  <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
                    Average absolute contribution of temporal features (lags and time-of-day) across the forecast horizon.
                  </p>
                </Card>
              </>
            )}
          </>
        )}
      </LayoutPage>
    );
  }
}

export default EarlyPredictionPage;
