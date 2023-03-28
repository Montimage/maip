import React from "react";
import { Form, InputNumber, List, Card } from "antd";

const FormRegularNumberItem = ({ label, items, onChange, helpText = null  }) => (
  <Form.Item label={label} extra={helpText}>
    <List
      grid={{ gutter: 16, column: items.length }}
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <Card size="small" bordered={false}  title={item.title}>
            <InputNumber
              onChange={(v) => onChange(item.dataPath, v)}
              defaultValue={item.defaultValue ? item.defaultValue : 0}
              placeholder={item.title}
            />
          </Card>
        </List.Item>
      )}
    />
  </Form.Item>
);

export default FormRegularNumberItem;
