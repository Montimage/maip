import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Radio } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined, SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined
} from "@ant-design/icons";

import {
  setNotification,
} from "../../actions";
import "./styles.css";

const { Header } = Layout;

const appOptions = [
  {
    label: 'Activity Classification',
    value: 'Activity Classification',
    disabled: true,
  },
  {
    label: 'Anomaly Detection',
    value: 'Anomaly Detection',
  },
  {
    label: 'Root Cause Analysis',
    value: 'Root Cause Analysis',
    disabled: true,
  },
];

class MAIPHeader extends Component {
  render() {
    const menuLinks = [
      '/build',
      '/datasets',
      '/models',
      '/predict',
      '/xai',
      '/attacks',
      '/defenses',
      '/metrics',
    ];
    // Calculate the selected menu
    let selectedMenu = 0;
    const fullPath = window.location.pathname;
    let currentPositionIndex = fullPath.length - 1;
    for (let index = 0; index < menuLinks.length; index++) {
      const positionIndex = fullPath.indexOf(menuLinks[index]);
      if ( positionIndex > -1 && positionIndex < currentPositionIndex) {
        currentPositionIndex = positionIndex;
        selectedMenu = index;
      }
    }

    return (
      <Header>
        <Row>
          <Col span={1} style={{marginRight: '400px'}}>
            <a href="/">
              {/* TODO: fix position of the logo */}
              <img
                src={'/img/Logo.png'}
                className="logo"
                alt="Logo"
                style={{ maxWidth: "100px", objectFit: "contain" }}
              />
            </a>
          </Col>
          {/* TODO: make it less ugly */}
          <Col span={7} style={{ marginRight: '1px', width: '300px' }}>
            <Radio.Group style={{ height: '100px' }}
              options={appOptions} optionType="button"
            />
          </Col>
          <Col span={10}>
            <Menu theme="light" mode="horizontal" style={{ lineHeight: "52px", width: "730px" }} selectedKeys={`${selectedMenu}`}>
              <Menu.Item key="0">
                <a href={menuLinks[0]}>
                  <DeploymentUnitOutlined />
                  Build
                </a>
              </Menu.Item>
              <Menu.Item key="1">
                <a href={menuLinks[1]}>
                  <FolderOpenOutlined />
                  Datasets
                </a>
              </Menu.Item>
              <Menu.Item key="2">
                <a href={menuLinks[2]}>
                  <BlockOutlined />
                  Models
                </a>
              </Menu.Item>
              <Menu.Item key="3">
                <a href={menuLinks[3]}>
                  <LineChartOutlined />
                  Predict
                </a>
              </Menu.Item>
              <Menu.Item key="4">
                <a href={menuLinks[4]}>
                  <SolutionOutlined />
                  XAI
                </a>
              </Menu.Item>
              <Menu.Item key="5">
                <a href={menuLinks[5]}>
                  <BugOutlined />
                  Attacks
                </a>
              </Menu.Item>
              <Menu.Item key="6">
                <a href={menuLinks[6]}>
                  <SafetyOutlined />
                  Defenses
                </a>
              </Menu.Item>
              <Menu.Item key="7">
                <a href={menuLinks[7]}>
                  <ExperimentOutlined />
                  Metrics
                </a>
              </Menu.Item>
            </Menu>
          </Col>
        </Row>
      </Header>
    );
  }
}

const mapPropsToStates = ({ requesting }) => ({
  requesting,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(MAIPHeader);
