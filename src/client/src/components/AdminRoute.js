import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useUserRole } from '../hooks/useUserRole';

/**
 * AdminRoute component - wraps routes that require admin access
 * Only renders children if user is an admin, otherwise redirects to home
 */
const AdminRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAdmin } = useUserRole();

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

  // If not signed in or not admin, redirect to home page
  if (!isSignedIn || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // User is admin, render the protected content
  return children;
};

export default AdminRoute;
