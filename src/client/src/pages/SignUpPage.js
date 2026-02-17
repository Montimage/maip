import React from 'react';
import { Layout } from 'antd';
import { Navigate } from 'react-router-dom';

const { Content } = Layout;

// Check if Clerk is configured at module level
const HAS_CLERK_KEY = !!(process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY);

// Conditionally import Clerk components
let SignUp;
if (HAS_CLERK_KEY) {
  try {
    const clerkReact = require('@clerk/clerk-react');
    SignUp = clerkReact.SignUp;
  } catch (error) {
    console.warn('[SignUpPage] Clerk not available:', error);
  }
}

/**
 * Dedicated Sign-Up Page
 * Uses Clerk's pre-built SignUp component
 */
const SignUpPage = () => {
  // If Clerk is not configured, redirect to home
  if (!HAS_CLERK_KEY || !SignUp) {
    return <Navigate to="/" replace />;
  }

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
