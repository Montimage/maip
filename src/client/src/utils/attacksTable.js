import React from 'react';
import { Dropdown, Menu, Button } from 'antd';
import Papa from 'papaparse';

// Build malicious flows table data and an actions column menu
// onAction signature: (key, record) => void
export function buildAttackTable({ csvString, onAction, buildMenu }) {
  // Parse CSV as arrays to manage duplicate headers ourselves
  const results = Papa.parse((csvString || '').trim(), {
    header: false,
    skipEmptyLines: true,
  });
  const matrix = Array.isArray(results.data) ? results.data : [];
  const headersRaw = matrix.length > 0 ? matrix[0] : [];
  const dataRowsRaw = matrix.length > 1 ? matrix.slice(1) : [];

  // Build unique keys for columns, preserving duplicates by suffixing _<n>
  const headerCounts = {};
  const uniqueKeys = headersRaw.map((h) => {
    const name = String(h ?? '').trim();
    const count = (headerCounts[name] || 0);
    headerCounts[name] = count + 1;
    return count === 0 ? name : `${name}_${count}`;
  });

  // Build row objects using unique keys
  const rows = dataRowsRaw.map((arr, index) => {
    const obj = { key: index + 1 };
    for (let j = 0; j < uniqueKeys.length; j++) {
      obj[uniqueKeys[j]] = arr[j];
    }
    return obj;
  });
  const keyList = uniqueKeys;

  const sanitizeHeader = (raw) => {
    if (!raw) return raw;
    let s = String(raw).trim();
    // Strip surrounding quotes
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.substring(1, s.length - 1);
    }
    // Remove Papa duplicate suffixes like "_1, _2" that might appear at the end OR
    // immediately after a numeric token within the header (e.g., "150.0_1").
    // We consider it a suffix when it is followed by a delimiter or end of string.
    s = s.replace(/(_\d+)(?=\s|,|]|\)|$)/g, '');
    // Fix numeric tokens written with underscores instead of dots, e.g., 150_0 -> 150.0, -0_001 -> -0.001
    // Do this after removing duplicate suffixes to avoid producing artifacts like ".1" in ranges.
    s = s.replace(/(\d+)_+(\d+)/g, '$1.$2');
    s = s.replace(/-(\d+)_+(\d+)/g, '-$1.$2');
    return s;
  };

  // Build columns with unique, user-friendly titles even when CSV headers contain duplicates
  const titleCounts = {};
  const flowColumns = keyList.map((key) => {
    const baseTitle = sanitizeHeader(key);
    const nextCount = (titleCounts[baseTitle] || 0) + 1;
    titleCounts[baseTitle] = nextCount;
    const finalTitle = nextCount > 1 ? `${baseTitle} (${nextCount})` : baseTitle;
    return {
      title: finalTitle,
      dataIndex: key,
      sorter: (a, b) => {
        const aVal = parseFloat(a[key]);
        const bVal = parseFloat(b[key]);
        if (!isNaN(aVal) && !isNaN(bVal)) return aVal - bVal;
        return String(a[key]).localeCompare(String(b[key]));
      },
    };
  });

  const actionsMenu = (record) => {
    if (typeof buildMenu === 'function') return buildMenu(record, onAction);
    return (
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
  };

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
