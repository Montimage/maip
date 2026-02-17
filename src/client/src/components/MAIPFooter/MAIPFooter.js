import React from "react";
import { Layout } from "antd";
import VERSION from "../../VERSION";

const { Footer } = Layout;
const MAIPFooter = () => (
  <Footer style={{ textAlign: "center", background: "#001529", color: "#fff", fontSize: "16px", position: "fixed", left: 0, bottom: 0, width: "100%" }}>
    <span style={{ display: "inline-block", textAlign: "center"}}>
      NDR©{new Date().getFullYear()} developed by{" "}
      <a href="https://www.montimage.com">Montimage</a>. Version {VERSION}
    </span>
  </Footer>
);

export default MAIPFooter;
