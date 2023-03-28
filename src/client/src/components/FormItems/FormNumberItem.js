import React from "react";
import { Form, InputNumber } from "antd";

const FormNumberItem = ({
  label,
  defaultValue,
  min,
  max,
  onChange,
  placeholder,
  helpText = null,
  rules = null,
}) => (
  <Form.Item label={label} extra={helpText} rules={rules}>
    <InputNumber
      min={min}
      max={max}
      defaultValue={defaultValue}
      onChange={(v) => onChange(v)}
      placeholder={placeholder}
    />
  </Form.Item>
);

export default FormNumberItem;
