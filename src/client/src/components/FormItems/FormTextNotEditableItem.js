import React from "react";
import { Form, Typography } from "antd";
const { Text } = Typography;

const FormTextNotEditableItem = ({ label, value, helpText = null, copyable = false }) => (
  <Form.Item label={label} name={label} extra={helpText}>
    <Text copyable={copyable}>{value}</Text>
  </Form.Item>
);

export default FormTextNotEditableItem;
