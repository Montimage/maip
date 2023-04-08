import React from "react";
import { Layout } from "antd";
import VERSION from "../../VERSION";

const { Footer } = Layout;
const MAIPFooter = () => (
  <Footer style={{ textAlign: "center", marginTop: "10px" }}>
    <span style={{ display: "inline-block", textAlign: "center" }}>
      MAIP©{new Date().getFullYear()} developed by{" "}
      <a href="https://www.montimage.com">Montimage</a>. Version {VERSION}
    </span>
  </Footer>
);

export default MAIPFooter;
