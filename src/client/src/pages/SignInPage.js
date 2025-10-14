import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Layout, Card } from 'antd';

const { Content } = Layout;

/**
 * Dedicated Sign-In Page
 * Uses Clerk's pre-built SignIn component
 */
const SignInPage = () => {
  return (
    <Content style={{ padding: '50px', minHeight: '80vh' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh'
      }}>
        <SignIn 
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          afterSignInUrl="/models/all"
        />
      </div>
    </Content>
  );
};

export default SignInPage;
