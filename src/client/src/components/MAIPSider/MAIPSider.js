import React from "react";
import { Layout, Menu } from "antd";

import "./styles.css";

const { Sider } = Layout;
const MAIPSider = ({ defaultKey, items, rightSide, theme }) => (
  <Sider className="side-background-color" breakpoint="lg" collapsedWidth="0">
    <Menu
      mode="inline"
      theme={theme ? theme : "light"}
      style={
        rightSide
          ? { height: "100%", borderRight: 0 }
          : { height: "100%", borderLeft: 10 }
      }
      defaultSelectedKeys={[`${defaultKey}`]}
      defaultOpenKeys={[`sub${defaultKey}`]}
    >
      {items.map((i) =>
        i.action ? (
          <Menu.Item key={i.key} onClick={i.action}>
            {i.icon}
            {i.text}
          </Menu.Item>
        ) : i.href ? (
          <Menu.Item key={i.key}>
            <a href={i.href}>
              {i.icon}
              {i.text}
            </a>
          </Menu.Item>
        ) : (
          <Menu.Item key={i.key}>
            {i.icon}
            {i.text}
          </Menu.Item>
        )
      )}
    </Menu>
  </Sider>
);

export default MAIPSider;
