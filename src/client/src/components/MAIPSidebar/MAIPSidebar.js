import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Tooltip } from "antd";
import {
  DeploymentUnitOutlined, FolderOpenOutlined, BlockOutlined, LineChartOutlined,
  SolutionOutlined, BugOutlined, SafetyOutlined, ExperimentOutlined, FilePdfOutlined,
  InfoCircleOutlined, ApartmentOutlined, LockOutlined,
} from "@ant-design/icons";
import "./styles.css";
import {
  MENU_OPTIONS,
} from "../../constants";
import { useUserRole } from '../../hooks/useUserRole';

const { Sider } = Layout;
const { SubMenu } = Menu;

class MAIPSidebar extends Component {
  getMenuItems() {
    const { isAdmin, isSignedIn, isLoaded } = this.props;
    
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
        label: (
          <>
            Build
            {isLoaded && !isAdmin && <LockOutlined style={{ fontSize: '12px', color: '#ff4d4f', marginLeft: '8px' }} />}
          </>
        ),
        icon: <DeploymentUnitOutlined />,
        link: `/build/ad`,
        protected: false,
        requireAuth: false,
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
          {
            key: MENU_OPTIONS[3].key,
            label: 'Models Comparison',
            link: MENU_OPTIONS[3].link,
          },
          {
            key: MENU_OPTIONS[15].key,
            label: (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Models Retraining</span>
                {isLoaded && !isAdmin && <LockOutlined style={{ fontSize: '12px', color: '#ff4d4f', marginLeft: '8px' }} />}
              </span>
            ),
            link: MENU_OPTIONS[15].link,
            protected: false,
            requireAuth: false,
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
            label: 'Rule-based Detection',
            link: MENU_OPTIONS[18].link,
          },
          {
            key: 'predict-unified',
            label: 'Anomaly Prediction',
            link: '/predict',
          },
          {
            key: MENU_OPTIONS[19].key,
            label: (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Early Prediction</span>
                {isLoaded && !isAdmin && <LockOutlined style={{ fontSize: '12px', color: '#ff4d4f', marginLeft: '8px' }} />}
              </span>
            ),
            link: MENU_OPTIONS[19].link,
            protected: false,
            requireAuth: false,
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
      {
        key: MENU_OPTIONS[16].key,
        label: 'About',
        icon: <InfoCircleOutlined />,
        link: MENU_OPTIONS[16].link,
      },
    ];
  }

  render() {
    const { isAdmin, isSignedIn, isLoaded } = this.props;
    
    // Get current pathname
    let { pathname } = window.location;

    const menuItems = this.getMenuItems();

    let selectedKeys = [];
    let openKeys = [];
    
    MENU_OPTIONS.forEach(option => {
      if (pathname.includes(option.link)) {
        selectedKeys.push(option.key);
      }
    });
    
    // Special handling for Anomaly Prediction - only if not rule-based or early
    if (pathname.includes('/predict') && !pathname.includes('/rule-based') && !pathname.includes('/early') && !selectedKeys.includes('predict-unified')) {
      selectedKeys.push('predict-unified');
    }
    
    // Determine which submenu should be open based on current path
    if (pathname.includes('/dpi') || pathname.includes('/features')) {
      openKeys.push('traffic-analysis');
    } else if (pathname.includes('/models') || pathname.includes('/build')) {
      openKeys.push(MENU_OPTIONS[1].key);
    } else if (pathname.includes('/predict')) {
      openKeys.push(MENU_OPTIONS[4].key);
    } else if (pathname.includes('/xai')) {
      openKeys.push(MENU_OPTIONS[8].key);
    } else if (pathname.includes('/metrics')) {
      openKeys.push(MENU_OPTIONS[11].key);
    }

    return (
      <Sider
        width={270}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 64,
          bottom: 0,
        }}
        theme="light"
      >
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          style={{ height: '100%', borderRight: 0, padding: 0 }}
          inlineIndent={24}
        >
          {menuItems.map((item) => {
            const isItemBlocked = isLoaded && ((item.requireAuth && !isSignedIn) || (item.protected && !item.requireAuth && !isAdmin));
            
            return item.children ? (
              <SubMenu 
                key={item.key} 
                icon={item.icon} 
                title={item.label}
                disabled={isItemBlocked}
              >
                {item.children.map((child) => {
                  const isChildBlocked = isLoaded && ((child.requireAuth && !isSignedIn) || (child.protected && !child.requireAuth && !isAdmin));
                  const tooltipTitle = child.requireAuth ? "Sign in required" : "Admin access required";
                  
                  const menuItem = (
                    <Menu.Item 
                      key={child.key}
                      style={{ 
                        cursor: isChildBlocked ? 'not-allowed' : 'pointer',
                        opacity: isChildBlocked ? 0.75 : 1,
                      }}
                      disabled={isChildBlocked}
                      onClick={() => !isChildBlocked ? window.location.href = child.link : null}
                    >
                      {child.label}
                    </Menu.Item>
                  );
                  
                  return isChildBlocked ? (
                    <Tooltip key={child.key} title={tooltipTitle} placement="right">
                      {menuItem}
                    </Tooltip>
                  ) : menuItem;
                })}
              </SubMenu>
            ) : (
              isItemBlocked ? (
                <Tooltip key={item.key} title={item.requireAuth ? "Sign in required" : "Admin access required"} placement="right">
                  <Menu.Item
                    key={item.key}
                    icon={item.icon}
                    disabled
                    style={{ 
                      cursor: 'not-allowed',
                      opacity: 0.75
                    }}
                  >
                    {item.label}
                  </Menu.Item>
                </Tooltip>
              ) : (
                <Menu.Item
                  key={item.key}
                  icon={item.icon}
                  onClick={() => window.location.href = item.link}
                >
                  {item.label}
                </Menu.Item>
              )
            );
          })}
        </Menu>
      </Sider>
    );
  }
}

const mapPropsToStates = ({ app, requesting }) => ({
  app, requesting,
});

// HOC to inject user role into class component
function withUserRole(Component) {
  return function WrappedComponent(props) {
    const userRole = useUserRole();
    return <Component {...props} isAdmin={userRole.isAdmin} isSignedIn={userRole.isSignedIn} isLoaded={userRole.isLoaded} />;
  };
}

export default withUserRole(connect(mapPropsToStates)(MAIPSidebar));
