import React from "react";
import { Form, Typography } from "antd";
const { Paragraph } = Typography;
const FormParagraphItem = ({ label, value, rows = 2, expandable = true }) => (
  <Form.Item label={label} name={label}>
    <Paragraph ellipsis={{ rows, expandable, symbol: "more" }}>
      {value}
    </Paragraph>
  </Form.Item>
);

export default FormParagraphItem;
