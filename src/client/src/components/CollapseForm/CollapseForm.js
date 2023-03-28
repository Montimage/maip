import React from "react";
import { Collapse } from "antd";

const { Panel } = Collapse;

const CollapseForm = ({ title, children, bordered = true, active, extra=null }) => (
  <Collapse accordion style={{margin: '10px'}} defaultActiveKey={active ? ['1'] : null} bordered={bordered}>
    <Panel header={title} key="1" extra={extra}>
      {children}
    </Panel>
  </Collapse>
);

export default CollapseForm;
