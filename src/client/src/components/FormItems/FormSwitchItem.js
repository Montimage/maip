import React from 'react';
import { Form, Switch } from "antd";

const FormSwitchItem = ({label, checked, onChange, checkedChildren, unCheckedChildren, helpText = null}) =>(
  <Form.Item label={label} extra={helpText}>
    <Switch
      onChange={v => onChange(v)}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
      checked={checked}
    />
  </Form.Item>
);

export default FormSwitchItem;