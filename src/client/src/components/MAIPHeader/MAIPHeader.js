import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Radio } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined, 
  SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined, FilePdfOutlined,
} from "@ant-design/icons";
import {
  setNotification,
} from "../../actions";
import "./styles.css";

const { Header } = Layout;
const { SubMenu } = Menu;

class MAIPHeader extends Component {
  render() {
    const menuLinks = [
      '/build',
      '/datasets',
      '/models',
      '/predict',
      /* '/xai', */
      '/xai/shap',
      '/xai/lime',
      '/metrics',
      '/attacks',
      '/defenses',
      '/reports',
    ];
    const menuItems = [
      {
        key: '0',
        label: 'Build',
        icon: <DeploymentUnitOutlined />,
        link: menuLinks[0],
      },
      // TODO: currently don't need ?
      {
        key: '1',
        label: 'Datasets',
        icon: <FolderOpenOutlined />,
        link: menuLinks[1],
      },
      {
        key: '2',
        label: 'Models',
        icon: <BlockOutlined />,
        link: menuLinks[2],
      },
      {
        key: '3',
        label: 'Predict',
        icon: <LineChartOutlined />,
        link: menuLinks[3],
      },
      {
        /* TODO: should I add a link for XAI here */
        key: '4',
        label: 'XAI',
        icon: <SolutionOutlined />,
        children: [
          {
            key: '4.1',
            label: 'SHAP',
            link: menuLinks[4],
          },
          {
            key: '4.2',
            label: 'LIME',
            link: menuLinks[5],
          },
        ],
      },
      {
        key: '5',
        label: 'Metrics',
        icon: <ExperimentOutlined />,
        link: menuLinks[6],
      },
      {
        key: '6',
        label: 'Attacks',
        icon: <BugOutlined />,
        link: menuLinks[7],
      },
      {
        key: '7',
        label: 'Defenses',
        icon: <SafetyOutlined />,
        link: menuLinks[8],
      },
      {
        key: '8',
        label: 'Reports',
        icon: <FilePdfOutlined />,
        link: menuLinks[9],
      },
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
          <Col span={1} style={{marginRight: '200px', marginTop: '-7px', height: '64px'}}>
            <img
              src={'/img/logo_montimage_small.png'}
              className="logo"
              alt="Logo"
              style={{ width: "240px", height: '64px' }}
            />
          </Col>
          {/* TODO: look ugly if the browser is small */}
          <Col span={7} style={{ marginRight: '200px', width: '250px' }}>
            <Radio.Group defaultValue="ad" buttonStyle="solid">
              <Radio.Button value="ac" style={{ width: '120px', height: '52px', lineHeight: '1.7' }}>
                Activity Classification
              </Radio.Button>
              <Radio.Button value="ad" style={{ width: '120px', height: '52px', lineHeight: '1.7' }}>
                Anomaly Detection
              </Radio.Button>
              <Radio.Button value="rca" style={{ width: '120px', height: '52px', lineHeight: '1.7' }}>
                Root Cause Analysis
              </Radio.Button>
            </Radio.Group>
          </Col>
          <Col span={10}>
            <Menu
              theme="dark"
              mode="horizontal"
              style={{ lineHeight: '52px', width: '730px', fontSize: '16px' }}
              selectedKeys={[selectedMenu]}
            >
              {menuItems.map((item) =>
                item.children ? (
                  <SubMenu key={item.key} icon={item.icon} title={item.label} style={{ fontSize: '16px' }}>
                    {item.children.map((child) => (
                      <Menu.Item key={child.key} style={{ fontSize: '16px' }}>
                        <a href={child.link}>{child.label}</a>
                      </Menu.Item>
                    ))}
                  </SubMenu>
                ) : (
                  <Menu.Item key={item.key} icon={item.icon} style={{ fontSize: '16px' }}>
                    <a href={item.link}>{item.label}</a>
                  </Menu.Item>
                )
              )}
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
