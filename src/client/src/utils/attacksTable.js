import React from 'react';
import { Dropdown, Menu, Button } from 'antd';
import Papa from 'papaparse';

// Build malicious flows table data and an actions column menu
// onAction signature: (key, record) => void
export function buildAttackTable({ csvString, onAction }) {
  const results = Papa.parse((csvString || '').trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const rows = (results.data || []).map((row, index) => ({ key: index + 1, ...row }));
  const keyList = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== 'key') : [];

  const flowColumns = keyList.map((key) => ({
    title: key,
    dataIndex: key,
    sorter: (a, b) => {
      const aVal = parseFloat(a[key]);
      const bVal = parseFloat(b[key]);
      if (!isNaN(aVal) && !isNaN(bVal)) return aVal - bVal;
      return String(a[key]).localeCompare(String(b[key]));
    },
  }));

  const actionsMenu = (record) => (
    <Menu onClick={({ key }) => onAction && onAction(key, record)}>
      <Menu.Item key="explain-shap">Explain (XAI SHAP)</Menu.Item>
      <Menu.Item key="explain-lime">Explain (XAI LIME)</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="block-src-ip">Block source IP</Menu.Item>
      <Menu.Item key="block-dst-ip">Block destination IP</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="block-dst-port">Block destination port</Menu.Item>
      <Menu.Item key="block-ip-port-src">Block srcIP:dstPort/tcp</Menu.Item>
      <Menu.Item key="block-ip-port-dst">Block dstIP:dstPort/tcp</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="drop-session">Drop session</Menu.Item>
      <Menu.Item key="rate-limit-src">Rate-limit source</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="send-nats">Send flow to NATS</Menu.Item>
    </Menu>
  );

  const mitigationColumns = [
    {
      title: 'Mitigation',
      key: 'mitigation',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Dropdown
          overlay={actionsMenu(record)}
          trigger={["click"]}
          placement="bottomRight"
          getPopupContainer={() => document.body}
          overlayStyle={{ zIndex: 2000 }}
        >
          <Button size="small">Actions</Button>
        </Dropdown>
      ),
    },
  ];

  return { rows, flowColumns, mitigationColumns };
}
