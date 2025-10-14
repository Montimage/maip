import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Layout } from 'antd';

const { Content } = Layout;

/**
 * Dedicated Sign-Up Page
 * Uses Clerk's pre-built SignUp component
 */
const SignUpPage = () => {
  return (
    <Content style={{ padding: '50px', minHeight: '80vh' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh'
      }}>
        <SignUp 
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          afterSignUpUrl="/models/all"
        />
      </div>
    </Content>
  );
};

export default SignUpPage;
