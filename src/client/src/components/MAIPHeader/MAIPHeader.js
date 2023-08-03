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

const menuOptions = [
  { key: '0', link: '/build' },
  { key: '1', link: '/models' },
  { key: '2', link: '/models' },
  { key: '3', link: '/models/comparison' },
  { key: '4', link: '/predict' },
  { key: '5', link: '/predict/online' },
  { key: '6', link: '/predict/offline' },
  { key: '7', link: '/attacks' },
  { key: '8', link: '/xai' },
  { key: '9', link: '/xai/shap' },
  { key: '10', link: '/xai/lime' },
  { key: '11', link: '/metrics' },
  { key: '12', link: '/metrics/accountability' },
  { key: '13', link: '/metrics/resilience' },
  { key: '14', link: '/reports' },
];

const menuItems = [
  {
    key: menuOptions[0].key,
    label: 'Build',
    icon: <DeploymentUnitOutlined />,
    link: menuOptions[0].link,
  },
  {
    key: menuOptions[1].key,
    label: 'Models',
    icon: <BlockOutlined />,
    children: [
      {
        key: menuOptions[2].key,
        label: 'All Models',
        link: menuOptions[2].link,
      },
      {
        key: menuOptions[3].key,
        label: 'Models Comparison',
        link: menuOptions[3].link,
      },
    ],
  },
  {
    key: menuOptions[4].key,
    label: 'Predict',
    icon: <LineChartOutlined />,
    children: [
      {
        key: menuOptions[5].key,
        label: 'Online Mode',
        link: menuOptions[5].link,
      },
      {
        key: menuOptions[6].key,
        label: 'Offline Mode',
        link: menuOptions[6].link,
      },
    ],
  },
  {
    key: menuOptions[7].key,
    label: 'Attacks',
    icon: <BugOutlined />,
    link: menuOptions[7].link,
  },
  {
    key: menuOptions[8].key,
    label: 'XAI',
    icon: <SolutionOutlined />,
    children: [
      {
        key: menuOptions[9].key,
        label: 'SHAP',
        link: menuOptions[9].link,
      },
      {
        key: menuOptions[10].key,
        label: 'LIME',
        link: menuOptions[10].link,
      },
    ],
  },
  
  {
    key: menuOptions[11].key,
    label: 'Metrics',
    icon: <ExperimentOutlined />,
    children: [
      {
        key: menuOptions[12].key,
        label: 'Accountability Metrics',
        link: menuOptions[12].link,
      },
      {
        key: menuOptions[13].key,
        label: 'Resilience Metrics',
        link: menuOptions[13].link,
      },
    ],
  },
  {
    key: menuOptions[14].key,
    label: 'Reports',
    icon: <FilePdfOutlined />,
    link: menuOptions[14].link,
  },
];

class MAIPHeader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: 'ad',
    };
  }

  handleChange = (e) => {
    this.setState({ selectedValue: e.target.value }, () => {
      if (this.state.selectedValue === 'rca') {
        // TODO: check correct link
        window.open('https://rca.montimage.com', '_blank');
      }
    });
  }

  render() {
    // Modify the current pathname if it is "/"
    let { pathname } = window.location;
    pathname = pathname === "/" ? "/models" : pathname;

    // Calculate the selected menu
    const selectedMenu = menuOptions.findIndex(
      menuOption => pathname.startsWith(menuOption.link));

    let selectedKeys = [];
    menuOptions.forEach(option => {
      if (pathname.includes(option.link)) {
        selectedKeys.push(option.key);
      }
    });

    return (
      <Header>
        <Row>
          <Col span={1} style={{marginRight: '200px', marginTop: '-7px', height: '64px'}}>
            <a href="https://www.montimage.com/">
              <img
                src={'/img/logo_montimage_small.png'}
                className="logo"
                alt="Logo"
                style={{ width: "240px", height: '64px' }}
              />
            </a>
          </Col>
          {/* TODO: look ugly if the browser is small */}
          <Col span={7} style={{ marginRight: '200px', width: '250px' }}>
            <Radio.Group defaultValue="ad" buttonStyle="solid"
              onChange={this.handleChange}  
            >
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
              selectedKeys={selectedKeys}
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
                  <Menu.Item 
                    key={item.key} 
                    icon={item.icon} 
                    className={selectedMenu === item.key ? 'selectedMenuItem' : ''} 
                    style={{ fontSize: '16px' }}>
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
