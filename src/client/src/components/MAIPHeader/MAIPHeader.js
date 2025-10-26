import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Row, Col } from "antd";
import {
  LoginOutlined,
} from "@ant-design/icons";
// import {
//   setNotification,
//   requestApp,
//   setApp,
// } from "../../actions";
import "./styles.css";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { useUserRole } from '../../hooks/useUserRole';

// Determine if Clerk is configured at build time
const HAS_CLERK_KEY = !!(process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY);

const { Header } = Layout;

class MAIPHeader extends Component {

  render() {

    return (
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <a href="https://www.montimage.com/" style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={'/img/logo-montimage.png'}
              className="logo"
              alt="Logo"
              style={{ width: "100px", height: '64px' }}
            />
          </a>
          <a href="/" style={{ textDecoration: 'none', marginLeft: '24px' }}>
            <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              Network Detection and Response
            </div>
          </a>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Clerk Authentication - Sign in button */}
          {HAS_CLERK_KEY && (
            <SignedOut>
              <SignInButton mode="modal">
                <span style={{ 
                  color: '#fff', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                  <LoginOutlined />
                  <span>Sign in</span>
                </span>
              </SignInButton>
            </SignedOut>
          )}
          
          {/* User avatar when signed in */}
          {HAS_CLERK_KEY && (
            <SignedIn>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {this.props.user && (
                  <span style={{ color: '#fff', fontSize: '16px' }}>
                    Welcome, {this.props.user.firstName || this.props.user.username || 'User'}
                  </span>
                )}
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
        </div>
      </Header>
    );
  }
}

const mapPropsToStates = ({ app, requesting }) => ({
  app, requesting,
});

// HOC to inject user role and user info into class component
function withUserRole(Component) {
  return function WrappedComponent(props) {
    const userRole = useUserRole();
    const { user } = useUser();
    return <Component {...props} isAdmin={userRole.isAdmin} isSignedIn={userRole.isSignedIn} isLoaded={userRole.isLoaded} user={user} />;
  };
}

export default withUserRole(connect(mapPropsToStates)(MAIPHeader));
