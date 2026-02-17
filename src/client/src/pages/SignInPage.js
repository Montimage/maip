import React from 'react';
import { Layout, Card, Alert } from 'antd';
import { Navigate } from 'react-router-dom';

const { Content } = Layout;

// Check if Clerk is configured at module level
const HAS_CLERK_KEY = !!(process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY);

// Conditionally import Clerk components
let SignIn;
if (HAS_CLERK_KEY) {
  try {
    const clerkReact = require('@clerk/clerk-react');
    SignIn = clerkReact.SignIn;
  } catch (error) {
    console.warn('[SignInPage] Clerk not available:', error);
  }
}

/**
 * Dedicated Sign-In Page
 * Uses Clerk's pre-built SignIn component
 */
const SignInPage = () => {
  // If Clerk is not configured, redirect to home
  if (!HAS_CLERK_KEY || !SignIn) {
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
