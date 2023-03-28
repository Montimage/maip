import React from "react";
import { Form, Input } from "antd";
const FormTextAreaItem = ({
  label,
  defaultValue,
  onChange,
  helpText = null,
  rules=null,
}) => (
  <Form.Item label={label} name={label} extra={helpText} rules={rules}>
    <Input.TextArea
      rows={4}
      onChange={(v) => onChange(v.target.value)}
      style={{ minWidth: 300 }} 
    >
      {defaultValue}
    </Input.TextArea>
  </Form.Item>
);

export default FormTextAreaItem;
