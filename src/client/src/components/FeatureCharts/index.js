import React from 'react';
import { Divider, Tooltip, Select, Row, Col, Table } from 'antd';
import { Bar, Scatter, Histogram } from '@ant-design/plots';
import { getConfigHistogram, getConfigBarPlot, getTableDatasetsStats } from '../../utils';

const { BOX_STYLE, BIN_CHOICES, DATASET_TABLE_STATS } = require('../../constants');
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

export default function FeatureCharts({ data = [], scatterConfigBuilder, barFeatureOptions, restrictBarToOptionsOnly = false, showSectionTitle = true, sectionTitle = 'Visualize Extracted Features' }) {
  const [selectedFeature, setSelectedFeature] = React.useState(null);
  const [binWidthChoice, setBinWidthChoice] = React.useState('square-root');
  const [xScatterFeature, setXScatterFeature] = React.useState(null);
  const [yScatterFeature, setYScatterFeature] = React.useState(null);
  const [barFeature, setBarFeature] = React.useState(null);

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

  const dataDatasetsStats = selectedFeature ? getTableDatasetsStats(data, selectedFeature) : [];
  const configHistogram = (selectedFeature && binWidthChoice)
    ? getConfigHistogram(data, selectedFeature, binWidthChoice)
    : null;
  const configBar = barFeature ? getConfigBarPlot(data, barFeature) : null;

  if (!data || data.length === 0) return null;

  return (
    <>
      {showSectionTitle && (
        <Divider orientation="left" style={{ marginTop: 24 }}>
          <h1 style={{ fontSize: '24px' }}>{sectionTitle}</h1>
        </Divider>
      )}

      {/* Histogram */}
      <Row gutter={24} style={{ marginTop: '20px' }} id="histogram_plot">
        <Col className="gutter-row" span={24}>
          <div style={{ ...BOX_STYLE, marginTop: '20px' }}>
            <h2>&nbsp;&nbsp;&nbsp;Histogram Plot</h2>
            <div style={{ marginBottom: '20px', marginTop: '10px' }}>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select the feature to plot on the histogram">
                <Select
                  showSearch allowClear
                  placeholder="Select a feature ..."
                  value={selectedFeature}
                  onChange={setSelectedFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 300, marginTop: '10px' }}
                >
                  {featureNames.map((name) => (
                    <Option key={`hist-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select the bin selection algorithm">
                <Select
                  showSearch allowClear
                  placeholder="Select bin width ..."
                  options={binWidthOptions}
                  defaultValue="square-root"
                  onChange={setBinWidthChoice}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 250 }}
                />
              </Tooltip>
            </div>
            {selectedFeature && (
              <Table columns={DATASET_TABLE_STATS} dataSource={dataDatasetsStats} pagination={false} style={{ marginTop: '10px' }} />
            )}
            {configHistogram && (
              <Histogram {...configHistogram} style={{ margin: '20px' }} />
            )}
          </div>
        </Col>
      </Row>

      {/* Scatter */}
      <Row gutter={24} style={{ marginTop: '20px' }} id="scatter_plot">
        <Col className="gutter-row" span={24}>
          <div style={{ ...BOX_STYLE, marginTop: '20px' }}>
            <h2>&nbsp;&nbsp;&nbsp;Scatter Plot</h2>
            <div style={{ marginBottom: '20px', marginTop: '10px' }}>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select a feature displayed on x-axis">
                <Select
                  showSearch allowClear
                  placeholder="Select X feature ..."
                  value={xScatterFeature}
                  onChange={setXScatterFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 300, marginTop: '10px' }}
                >
                  {featureNames.map((name) => (
                    <Option key={`x-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select a feature displayed on y-axis">
                <Select
                  showSearch allowClear
                  placeholder="Select Y feature ..."
                  value={yScatterFeature}
                  onChange={setYScatterFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 300, marginTop: '10px' }}
                >
                  {featureNames.map((name) => (
                    <Option key={`y-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
            </div>
            {xScatterFeature && yScatterFeature && (() => {
              const cfg = scatterConfigBuilder
                ? scatterConfigBuilder(data, xScatterFeature, yScatterFeature)
                : {
                    data,
                    xField: xScatterFeature,
                    yField: yScatterFeature,
                    shape: 'circle',
                    size: 4,
                    xAxis: { title: { text: xScatterFeature, style: { fontSize: 16 } } },
                    yAxis: { title: { text: yScatterFeature, style: { fontSize: 16 } } },
                  };
              return <Scatter {...cfg} style={{ margin: '20px' }} />;
            })()}
          </div>
        </Col>
      </Row>

      {/* Bar */}
      <Row gutter={24} style={{ marginTop: '20px' }} id="bar_plot">
        <Col className="gutter-row" span={12}>
          <div style={{ ...BOX_STYLE, marginTop: '20px' }}>
            <h2>&nbsp;&nbsp;&nbsp;Bar Plot</h2>
            <div style={{ marginBottom: '20px', marginTop: '10px' }}>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select a categorical feature">
                <Select
                  showSearch allowClear
                  value={barFeature}
                  placeholder="Select a feature ..."
                  onChange={setBarFeature}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 300, marginTop: '10px' }}
                  disabled={barNames.length === 0}
                >
                  {barNames.map((name) => (
                    <Option key={`bar-${name}`} value={name}>{name}</Option>
                  ))}
                </Select>
              </Tooltip>
            </div>
            {configBar && <Bar {...configBar} style={{ margin: '10px' }} />}
          </div>
        </Col>
      </Row>
    </>
  );
}
