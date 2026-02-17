import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useUserRole } from '../hooks/useUserRole';

/**
 * ProtectedRoute component - wraps routes that require authentication
 * Only renders children if user is signed in, otherwise redirects to sign-in
 */
const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useUserRole();

  // Check if Clerk is configured
  const hasClerkKey = !!(
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY
  );

  // If Clerk is not configured, allow access (backwards compatibility)
  if (!hasClerkKey) {
    return children;
  }

  // Show loading spinner while authentication state is loading
  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // If not signed in, redirect to home page (sign-in modal will show)
  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the protected content
  return children;
};

export default ProtectedRoute;
