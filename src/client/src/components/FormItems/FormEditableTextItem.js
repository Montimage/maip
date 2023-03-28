import React from "react";
import { Form, Typography } from "antd";
const { Text } = Typography;

const FormEditableTextItem = ({ label, defaultValue, onChange, helpText=null }) => (
  <Form.Item label={label} extra={helpText}>
      <Text
        editable={{
          onChange: (v) => {
            onChange(v);
          },
        }}
        code
      >
        {typeof defaultValue === "string" ? defaultValue : JSON.stringify(defaultValue)}
      </Text>
  </Form.Item>
);

export default FormEditableTextItem;
