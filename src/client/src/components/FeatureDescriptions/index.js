import React from 'react';
import { Table } from 'antd';
import { COLUMNS_ALL_FEATURES } from '../../constants';
const { BOX_STYLE, AD_FEATURES_DESCRIPTIONS, AC_FEATURES_DESCRIPTIONS } = require('../../constants');

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

  return (
    <div style={{ ...BOX_STYLE, marginTop: '20px' }}>
      {showTitle && <h2>&nbsp;&nbsp;&nbsp;{title}</h2>}
      <Table dataSource={allFeatures} columns={COLUMNS_ALL_FEATURES} size="small" style={{ marginTop: '10px' }} />
    </div>
  );
}
