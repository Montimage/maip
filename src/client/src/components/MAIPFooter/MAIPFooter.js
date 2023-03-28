import React from "react";
import { Layout } from "antd";
import VERSION from "../../VERSION";

const { Footer } = Layout;
const MAIPFooter = () => (
  <Footer style={{ textAlign: "center", marginTop: "30px" }}>
    MAIP©{new Date().getFullYear()} Created by{" "}
    <a href="https://www.montimage.com">Montimage</a>. Version {VERSION}
  </Footer>
);

export default MAIPFooter;
