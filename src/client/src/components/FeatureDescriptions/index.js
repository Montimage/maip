import React from 'react';
import { Table, Tag } from 'antd';
const { AD_FEATURES_DESCRIPTIONS, AC_FEATURES_DESCRIPTIONS } = require('../../constants');

function inferDescriptionsFromData(data = []) {
  if (!Array.isArray(data) || data.length === 0) return AD_FEATURES_DESCRIPTIONS;
  const keys = new Set(Object.keys(data[0] || {}));
  // Count overlap with AD/AC definitions
  const adKeys = Object.keys(AD_FEATURES_DESCRIPTIONS);
  const acKeys = Object.keys(AC_FEATURES_DESCRIPTIONS);
  const adOverlap = adKeys.reduce((acc, k) => acc + (keys.has(k) ? 1 : 0), 0);
  const acOverlap = acKeys.reduce((acc, k) => acc + (keys.has(k) ? 1 : 0), 0);
  return adOverlap >= acOverlap ? AD_FEATURES_DESCRIPTIONS : AC_FEATURES_DESCRIPTIONS;
}

export default function FeatureDescriptions({ data = [], modelId, app, title = 'Feature Descriptions', showTitle = true }) {
  // If modelId/app is provided, a more advanced selection could be used; for now, infer from data.
  const featuresDescriptions = React.useMemo(() => inferDescriptionsFromData(data), [data]);
  const allFeatures = React.useMemo(() => {
    return Object.keys(featuresDescriptions).map((feature, index) => ({
      key: index + 1,
      name: feature,
      description: featuresDescriptions[feature].description,
      type: featuresDescriptions[feature].type,
    }));
  }, [featuresDescriptions]);

  // Enhanced columns with improved styling (matching EarlyPredictionPage format)
  const enhancedColumns = [
    {
      title: 'ID',
      dataIndex: 'key',
      key: 'key',
      width: 60,
      sorter: (a, b) => a.key - b.key,
    },
    {
      title: 'Feature Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text) => (
        <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>
          {text}
        </code>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 400,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (text) => {
        const colorMap = {
          'numerical': 'blue',
          'categorical': 'green',
          'binary': 'orange',
          'temporal': 'purple',
        };
        const color = colorMap[text?.toLowerCase()] || 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
  ];

  return (
    <>
      {showTitle && <h3 style={{ fontSize: '16px', marginBottom: 16, fontWeight: 600 }}>{title}</h3>}
      <Table 
        dataSource={allFeatures} 
        columns={enhancedColumns} 
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} features` }}
      />
    </>
  );
}
