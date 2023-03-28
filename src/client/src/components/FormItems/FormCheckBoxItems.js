import React from "react";
import { Form, Checkbox } from "antd";

const FormCheckBoxItem = ({ label, defaultValue, onChange, options, helpText = null  }) => (
  <Form.Item label={label} extra={helpText}>
    <Checkbox.Group
      options={options}
      defaultValue={defaultValue}
      onChange={onChange}
    />
  </Form.Item>
);

export default FormCheckBoxItem;
