import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined,
  SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined, FilePdfOutlined,
  InfoCircleOutlined, ApartmentOutlined, LoginOutlined,
} from "@ant-design/icons";
// import {
//   setNotification,
//   requestApp,
//   setApp,
// } from "../../actions";
import "./styles.css";
import {
  MENU_OPTIONS,
} from "../../constants";
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

// Determine if Clerk is configured at build time
const HAS_CLERK_KEY = !!(process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY);

const { Header } = Layout;
const { SubMenu } = Menu;

class MAIPHeader extends Component {
  // Removed state and constructor since app selection is no longer needed

  getMenuItems() {
    return [
      {
        key: 'traffic-analysis',
        label: 'Traffic Analysis',
        icon: <ApartmentOutlined />,
        children: [
          {
            key: MENU_OPTIONS[20].key,
            label: 'Deep Packet Inspection',
            link: MENU_OPTIONS[20].link,
          },
          {
            key: MENU_OPTIONS[17].key,
            label: 'Feature Extraction',
            link: '/features',
          },
        ],
      },
      {
        key: MENU_OPTIONS[0].key,
        label: 'Build',
        icon: <DeploymentUnitOutlined />,
        link: `/build/ad`,
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
        label: 'Detect',
        icon: <LineChartOutlined />,
        children: [
          {
            key: MENU_OPTIONS[18].key,
            label: 'Rule-based Mode',
            link: MENU_OPTIONS[18].link,
          },
          {
            key: 'predict-unified',
            label: 'Predict',
            link: '/predict',
          },
          {
            key: MENU_OPTIONS[19].key,
            label: 'Early Prediction',
            link: MENU_OPTIONS[19].link,
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
          <Col span={1} style={{marginTop: '-8px', height: '64px'}}>
            <a href="https://www.montimage.com/">
              <img
                src={'/img/logo-montimage.png'}
                className="logo"
                alt="Logo"
                style={{ width: "100px", height: '64px' }}
              />
            </a>
          </Col>

          {/* Title next to the logo */}
          <Col span={6} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginTop: '-8px', marginLeft: '30px', whiteSpace: 'nowrap' }}>
              Network Detection and Response
            </div>
          </Col>

          {/* Removed the app selection dropdown */}

          <Col span={17} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Menu
              theme="dark"
              mode="horizontal"
              style={{ lineHeight: '52px', fontSize: '16px' }}
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
              
              {/* Clerk Authentication - Sign in button */}
              {HAS_CLERK_KEY && (
                <SignedOut>
                  <Menu.Item key="sign-in" icon={<LoginOutlined />} style={{ fontSize: '16px' }}>
                    <SignInButton mode="modal">
                      <span style={{ cursor: 'pointer' }}>Sign in</span>
                    </SignInButton>
                  </Menu.Item>
                </SignedOut>
              )}
            </Menu>
            
            {/* User avatar when signed in */}
            {HAS_CLERK_KEY && (
              <SignedIn>
                <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center' }}>
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "width-32 height-32"
                      }
                    }}
                  />
                </div>
              </SignedIn>
            )}
          </Col>
        </Row>
      </Header>
    );
  }
}

const mapPropsToStates = ({ app, requesting }) => ({
  app, requesting,
});

export default connect(mapPropsToStates)(MAIPHeader);
