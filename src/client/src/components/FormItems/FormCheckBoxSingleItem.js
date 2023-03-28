import React from 'react';
import { Form, Checkbox } from "antd";

const FormCheckBoxSingleItem = ({label, checked, onChange, helpText = null }) =>(
  <Form.Item label={label} extra={helpText}>
    <Checkbox
      onChange={e => onChange(e.target.checked)}
      checked={checked}
    />
  </Form.Item>
);

export default FormCheckBoxSingleItem;