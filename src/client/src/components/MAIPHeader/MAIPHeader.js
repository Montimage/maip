import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Radio, Button, Select } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined,
  SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined, FilePdfOutlined, DownOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  setNotification,
  requestApp,
  setApp,
} from "../../actions";
import "./styles.css";
import {
  MENU_OPTIONS,
} from "../../constants";

const { Header } = Layout;
const { SubMenu } = Menu;
const { Option } = Select;

class MAIPHeader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: this.props.app,
    };
  }

  getMenuItems() {
    return [
      {
        key: MENU_OPTIONS[0].key,
        label: 'Build',
        icon: <DeploymentUnitOutlined />,
        link: `/build/${this.props.app}`,
        //link: MENU_OPTIONS[0].link,
      },
      {
        key: MENU_OPTIONS[1].key,
        label: 'Models',
        icon: <BlockOutlined />,
        children: [
          {
            key: MENU_OPTIONS[2].key,
            label: 'All Models',
            link: MENU_OPTIONS[2].link,
          },
          // {
          //   key: MENU_OPTIONS[17].key,
          //   label: 'Datasets',
          //   link: MENU_OPTIONS[17].link,
          // },
          {
            key: MENU_OPTIONS[3].key,
            label: 'Models Comparison',
            link: MENU_OPTIONS[3].link,
          },
          {
            key: MENU_OPTIONS[15].key,
            label: 'Models Retraining',
            link: MENU_OPTIONS[15].link,
          },
        ],
      },
      {
        key: MENU_OPTIONS[4].key,
        label: 'Predict',
        icon: <LineChartOutlined />,
        children: [
          /* {
            key: MENU_OPTIONS[5].key,
            label: 'Online Mode',
            link: MENU_OPTIONS[5].link,
          }, */
          {
            key: MENU_OPTIONS[6].key,
            label: 'Offline Mode',
            link: MENU_OPTIONS[6].link,
          },
        ],
      },
      {
        key: MENU_OPTIONS[7].key,
        label: 'Attacks',
        icon: <BugOutlined />,
        link: MENU_OPTIONS[7].link,
      },
      {
        key: MENU_OPTIONS[8].key,
        label: 'XAI',
        icon: <SolutionOutlined />,
        children: [
          {
            key: MENU_OPTIONS[9].key,
            label: 'SHAP',
            link: MENU_OPTIONS[9].link,
          },
          {
            key: MENU_OPTIONS[10].key,
            label: 'LIME',
            link: MENU_OPTIONS[10].link,
          },
        ],
      },

      {
        key: MENU_OPTIONS[11].key,
        label: 'Metrics',
        icon: <ExperimentOutlined />,
        children: [
          {
            key: MENU_OPTIONS[12].key,
            label: 'Accountability Metrics',
            link: MENU_OPTIONS[12].link,
          },
          {
            key: MENU_OPTIONS[13].key,
            label: 'Resilience Metrics',
            link: MENU_OPTIONS[13].link,
          },
        ],
      },
      // {
      //   key: MENU_OPTIONS[14].key,
      //   label: 'Reports',
      //   icon: <FilePdfOutlined />,
      //   link: MENU_OPTIONS[14].link,
      // },
      {
        key: MENU_OPTIONS[16].key,
        label: 'About',
        icon: <InfoCircleOutlined />,
        link: MENU_OPTIONS[16].link,
      },
    ];
  }

  hasModelIdInUrl = () => {
    const { pathname } = window.location;
    const pathParts = pathname.split('/').filter(Boolean);

    // List of all specific routes that should disable the updating app
    const restrictedRoutes = [
      '/xai/shap/',
      '/xai/lime/',
      '/metrics/accountability/',
      '/metrics/resilience/',
      '/attacks/',
      '/predict/online/',
      '/predict/offline/',
      '/build/ad',
      '/build/ac'
    ];

    if (restrictedRoutes.some(route => pathname.startsWith(route))) {
      return true;
    }

    if (pathParts[0] === 'models') {
      if ((pathParts[1] === 'datasets' && pathParts[2]) ||
            (pathParts[1] === 'retrain' && pathParts[2])) {
          return true;
      }
    }

    return false;
  }

  handleChange = (value) => {
    this.setState({ selectedValue: value }, () => {
      console.log(`selected ${value}`);
      if (this.state.selectedValue === 'rca') {
        // TODO: check correct link
        window.open('http://rca.montimage.com:8080/ui', '_blank');
      }
      this.props.setApp(this.state.selectedValue);
    });
  }

  render() {
    // Modify the current pathname if it is "/"
    let { pathname } = window.location;
    pathname = pathname === "/" ? "/models/all" : pathname;

    const menuItems = this.getMenuItems();

    // Calculate the selected menu
    const selectedMenu = MENU_OPTIONS.findIndex(
      menuOption => pathname.startsWith(menuOption.link));

    let selectedKeys = [];
    MENU_OPTIONS.forEach(option => {
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
                src={'/img/logo-montimage.png'}
                className="logo"
                alt="Logo"
                style={{ width: "100px", height: '64px' }}
              />
            </a>
          </Col>

          <Col span={7} style={{ marginLeft: '100px', marginRight: '100px', marginTop: '-7px' }}>
            <Select defaultValue="ad" bordered={false}
              value={this.props.app}
              //value={this.state.selectedValue}
              className="selectApp"
              style={{ width: '60%' }}
              onChange={this.handleChange}
              disabled={this.hasModelIdInUrl()}
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

const mapPropsToStates = ({ app, requesting }) => ({
  app, requesting,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
  setApp: (app) => dispatch(setApp(app)),
  fetchApp: () => dispatch(requestApp()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(MAIPHeader);
