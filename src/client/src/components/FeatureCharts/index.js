import React from 'react';
import { Divider, Tooltip, Select, Row, Col, Table, Card } from 'antd';
import { Bar, Box, Histogram, Heatmap } from '@ant-design/plots';
import { getConfigHistogram, getConfigBarPlot, getTableDatasetsStats } from '../../utils';

const { BIN_CHOICES, DATASET_TABLE_STATS } = require('../../constants');
const { Option } = Select;

function inferFeatureNames(data = []) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const keys = Object.keys(data[0] || {});
  // Exclude React Table key if present
  return keys.filter((k) => k !== 'key');
}

function isNumeric(val) {
  if (val === null || val === undefined) return false;
  const n = Number(val);
  return !Number.isNaN(n) && Number.isFinite(n);
}

function inferCategoricalFeatures(data = [], featureNames = []) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const sampleSize = Math.min(data.length, 500);
  const names = featureNames.length > 0 ? featureNames : inferFeatureNames(data);
  const thresholdUnique = Math.max(10, Math.floor(sampleSize * 0.05)); // heuristic
  const categoricals = [];
  for (const name of names) {
    const values = [];
    for (let i = 0; i < sampleSize; i++) {
      const v = data[i] ? data[i][name] : undefined;
      if (v !== undefined && v !== null && v !== '') values.push(v);
    }
    if (values.length === 0) continue;
    const nonNumericCount = values.reduce((acc, v) => acc + (isNumeric(v) ? 0 : 1), 0);
    const uniqueCount = new Set(values.map(v => String(v))).size;
    // Consider categorical if mostly non-numeric OR has few distinct values
    const mostlyNonNumeric = nonNumericCount / values.length > 0.5;
    const fewUniques = uniqueCount <= thresholdUnique;
    if (mostlyNonNumeric || fewUniques) categoricals.push(name);
  }
  return categoricals;
}

function calculateFeatureStats(data, featureName) {
  const values = data.map(d => parseFloat(d[featureName])).filter(v => !isNaN(v) && isFinite(v));
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    std,
    variance,
    q1: sorted[Math.floor(sorted.length * 0.25)],
    q3: sorted[Math.floor(sorted.length * 0.75)],
  };
}

function getTopFeaturesByVariance(data, featureNames, topN = 10) {
  const numericFeatures = featureNames.filter(name => {
    const sample = data[0]?.[name];
    return isNumeric(sample);
  });
  
  const featuresWithVariance = numericFeatures
    .map(name => {
      const stats = calculateFeatureStats(data, name);
      return stats ? { name, variance: stats.variance, std: stats.std } : null;
    })
    .filter(f => f !== null)
    .sort((a, b) => b.variance - a.variance)
    .slice(0, topN);
  
  return featuresWithVariance;
}

function calculateCorrelationMatrix(data, featureNames) {
  const numericFeatures = featureNames.filter(name => {
    const sample = data[0]?.[name];
    return isNumeric(sample);
  }).slice(0, 15); // Limit to 15 features for readability
  
  const correlations = [];
  
  for (let i = 0; i < numericFeatures.length; i++) {
    for (let j = 0; j < numericFeatures.length; j++) {
      const feat1 = numericFeatures[i];
      const feat2 = numericFeatures[j];
      
      const values1 = data.map(d => parseFloat(d[feat1])).filter(v => !isNaN(v));
      const values2 = data.map(d => parseFloat(d[feat2])).filter(v => !isNaN(v));
      
      if (values1.length === 0 || values2.length === 0) continue;
      
      // Pearson correlation
      const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
      const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;
      
      let num = 0, den1 = 0, den2 = 0;
      for (let k = 0; k < Math.min(values1.length, values2.length); k++) {
        const diff1 = values1[k] - mean1;
        const diff2 = values2[k] - mean2;
        num += diff1 * diff2;
        den1 += diff1 * diff1;
        den2 += diff2 * diff2;
      }
      
      const correlation = den1 === 0 || den2 === 0 ? 0 : num / Math.sqrt(den1 * den2);
      
      correlations.push({
        x: feat1,
        y: feat2,
        value: correlation,
      });
    }
  }
  
  return correlations;
}

export default function FeatureCharts({ data = [], scatterConfigBuilder, barFeatureOptions, restrictBarToOptionsOnly = false, showSectionTitle = true, sectionTitle = 'Visualize Extracted Features' }) {
  const [selectedFeature, setSelectedFeature] = React.useState(null);
  const [binWidthChoice, setBinWidthChoice] = React.useState('square-root');
  const [barFeature, setBarFeature] = React.useState(null);
  const [selectedBoxFeatures, setSelectedBoxFeatures] = React.useState([]);

  const featureNames = React.useMemo(() => inferFeatureNames(data), [data]);
  const barNames = React.useMemo(() => {
    const set = new Set(featureNames);
    const filtered = Array.isArray(barFeatureOptions) ? barFeatureOptions.filter((n) => set.has(n)) : [];
    if (restrictBarToOptionsOnly) return filtered; // no fallback
    if (filtered.length > 0) return filtered;
    // Fallback to inferred categoricals from data (do NOT default to all features)
    return inferCategoricalFeatures(data, featureNames);
  }, [barFeatureOptions, featureNames, data, restrictBarToOptionsOnly]);
  const binWidthOptions = React.useMemo(() => BIN_CHOICES.map(choice => ({ value: choice, label: choice })), []);

  // Calculate correlation matrix
  const correlationData = React.useMemo(() => calculateCorrelationMatrix(data, featureNames), [data, featureNames]);
  
  // Get numeric features for box plot
  const numericFeatures = React.useMemo(() => {
    return featureNames.filter(name => {
      const sample = data[0]?.[name];
      return isNumeric(sample);
    });
  }, [featureNames, data]);

  const dataDatasetsStats = selectedFeature ? getTableDatasetsStats(data, selectedFeature) : [];
  const configHistogram = (selectedFeature && binWidthChoice)
    ? getConfigHistogram(data, selectedFeature, binWidthChoice)
    : null;
  const configBar = barFeature ? getConfigBarPlot(data, barFeature) : null;

  // Prepare box plot data (must be before early return)
  const boxPlotData = React.useMemo(() => {
    if (!data || data.length === 0 || selectedBoxFeatures.length === 0) return [];
    
    const result = [];
    selectedBoxFeatures.forEach(featureName => {
      const stats = calculateFeatureStats(data, featureName);
      if (stats) {
        result.push({
          x: featureName,
          low: stats.min,
          q1: stats.q1,
          median: stats.median,
          q3: stats.q3,
          high: stats.max,
        });
      }
    });
    return result;
  }, [data, selectedBoxFeatures]);

  if (!data || data.length === 0) return null;

  return (
    <>
      {showSectionTitle && (
        <Divider orientation="left" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: '20px' }}>{sectionTitle}</h2>
        </Divider>
      )}

      {/* Histogram on left, Box Plot and Bar Plot on right */}
      <Row gutter={16}>
        <Col span={12}>
          <Card style={{ marginBottom: 16 }} id="histogram_plot">
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Histogram Plot</h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Distribution of values for a single feature across all flows
            </div>
            <div style={{ marginBottom: 16 }}>
              <Tooltip title="Select the feature to plot on the histogram">
                <Select
                  showSearch allowClear
                  placeholder="Select a feature ..."
                  value={selectedFeature}
                  onChange={setSelectedFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  {featureNames.map((name) => (
                    <Option key={`hist-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
              <Tooltip title="Select the bin selection algorithm">
                <Select
                  showSearch allowClear
                  placeholder="Select bin width ..."
                  options={binWidthOptions}
                  defaultValue="square-root"
                  onChange={setBinWidthChoice}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%' }}
                />
              </Tooltip>
            </div>
            {selectedFeature && (
              <Table columns={DATASET_TABLE_STATS} dataSource={dataDatasetsStats} pagination={false} style={{ marginBottom: 16 }} size="small" />
            )}
            {configHistogram && (
              <Histogram {...configHistogram} />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{ marginBottom: 16 }} id="box_plot">
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>
              Box Plot Comparison
            </h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Compare statistical distributions (quartiles, median, outliers) across multiple features
            </div>
            <div style={{ marginBottom: 16 }}>
              <Tooltip title="Select features to compare (max 5)">
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Select features to compare ..."
                  value={selectedBoxFeatures}
                  onChange={(values) => {
                    if (values.length <= 5) {
                      setSelectedBoxFeatures(values);
                    }
                  }}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%' }}
                  maxTagCount={5}
                >
                  {numericFeatures.map((name) => (
                    <Option key={`box-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
            </div>
            {boxPlotData.length > 0 && (
              <Box
                data={boxPlotData}
                xField="x"
                yField={['low', 'q1', 'median', 'q3', 'high']}
                boxStyle={{
                  stroke: '#545454',
                  fill: '#1890ff',
                  fillOpacity: 0.3,
                }}
                animation={false}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: false,
                  },
                }}
                tooltip={{
                  customContent: (title, items) => {
                    if (!items || items.length === 0) return null;
                    const data = items[0]?.data;
                    return (
                      <div style={{ padding: 8 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
                        <div>Min: {data?.low?.toFixed(2)}</div>
                        <div>Q1: {data?.q1?.toFixed(2)}</div>
                        <div>Median: {data?.median?.toFixed(2)}</div>
                        <div>Q3: {data?.q3?.toFixed(2)}</div>
                        <div>Max: {data?.high?.toFixed(2)}</div>
                      </div>
                    );
                  },
                }}
              />
            )}
          </Card>
          <Card style={{ marginBottom: 16 }} id="bar_plot">
            <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Bar Plot (Categorical)</h3>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
              Frequency distribution of categorical feature values
            </div>
            <div style={{ marginBottom: 16 }}>
              <Tooltip title="Select a categorical feature">
                <Select
                  showSearch allowClear
                  value={barFeature}
                  placeholder="Select a feature ..."
                  onChange={setBarFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: '100%' }}
                  disabled={barNames.length === 0}
                >
                  {barNames.map((name) => (
                    <Option key={`bar-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
            </div>
            {configBar && <Bar {...configBar} />}
            {!configBar && barNames.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                No categorical features available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Correlation Heatmap */}
      <Card style={{ marginBottom: 16 }} id="correlation_heatmap">
        <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>Feature Correlation Heatmap</h3>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          Shows Pearson correlation coefficients between features (top 15 numeric features)
        </div>
        {correlationData.length > 0 && (
          <Heatmap
            data={correlationData}
            xField="x"
            yField="y"
            colorField="value"
            color={['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']}
            meta={{
              value: {
                min: -1,
                max: 1,
                alias: 'Correlation',
              },
            }}
            xAxis={{
              label: {
                rotate: -45,
                offset: 0,
                style: { fontSize: 9, textAlign: 'right' },
                autoHide: true,
                autoRotate: false,
              },
            }}
            yAxis={{
              label: {
                style: { fontSize: 9 },
              },
            }}
            tooltip={{
              formatter: (datum) => {
                return {
                  name: `${datum.x} vs ${datum.y}`,
                  value: datum.value.toFixed(3),
                };
              },
            }}
          />
        )}
      </Card>
    </>
  );
}
