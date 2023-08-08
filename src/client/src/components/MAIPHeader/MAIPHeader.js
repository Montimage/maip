import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Radio, Button, Select } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined, 
  SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined, FilePdfOutlined, DownOutlined,
} from "@ant-design/icons";
import {
  setNotification,
} from "../../actions";
import "./styles.css";
import { setApp } from "../../actions";

const { Header } = Layout;
const { SubMenu } = Menu;
const { Option } = Select;

const menuOptions = [
  { key: '0', link: '/build' },
  { key: '1', link: '/models' },
  { key: '2', link: '/models/all' },
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
  { key: '15', link: '/models/retrain' },
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
      {
        key: menuOptions[15].key,
        label: 'Models Retraining',
        link: menuOptions[15].link,
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

  handleChange = (value) => {
    this.setState({ selectedValue: value }, () => {
      console.log(`selected ${value}`);
      if (this.state.selectedValue === 'rca') {
        // TODO: check correct link
        window.open('https://rca.montimage.com', '_blank');
      }
      this.props.setApp(this.state.selectedValue);
    });
  }
  

  render() {
    // Modify the current pathname if it is "/"
    let { pathname } = window.location;
    pathname = pathname === "/" ? "/models/all" : pathname;

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
          <Col span={1} style={{marginRight: '200px', marginTop: '-8px', height: '64px'}}>
            <a href="https://www.montimage.com/">
              <img
                src={'/img/logo_montimage_small.png'}
                className="logo"
                alt="Logo"
                style={{ width: "240px", height: '64px' }}
              />
            </a>
          </Col>

          <Col span={7} style={{ marginLeft: '100px', marginRight: '100px', marginTop: '-7px' }}>
            <Select defaultValue="ad" bordered={false}
              className="selectApp"
              style={{ width: '60%' }} 
              onChange={this.handleChange}
              suffixIcon={<DownOutlined style={{ color: '#fff' }} />}
            >
              <Option style={{ fontSize: '16px' }} value="ac">Activity Classification</Option>
              <Option style={{ fontSize: '16px', }} value="ad">Anomaly Detection</Option>
              <Option style={{ fontSize: '16px', }} value="rca">Root Cause Analysis</Option>
            </Select>
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
  setApp: (app) => dispatch(setApp(app)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(MAIPHeader);
