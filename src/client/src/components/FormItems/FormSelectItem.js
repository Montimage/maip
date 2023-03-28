import React from 'react';
import { Form, Select } from "antd";

const FormSelectItem = ({label, defaultValue, onChange, options, helpText = null }) => (
  <Form.Item label={label} extra={helpText}>
    <Select
      defaultValue={defaultValue ? defaultValue : (options ? options[0] : null) }
      onChange={v => onChange( v)}
      style={{ minWidth: 300 }} 
    >
      {options.map(tid => (
        <Select.Option value={tid} key={tid}>{tid}</Select.Option>
      ))}
    </Select>
  </Form.Item>
)

export default FormSelectItem;