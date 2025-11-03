import React from 'react';
import { Alert } from 'antd';
import { useUserRole } from '../hooks/useUserRole';

/**
 * Component that only renders children if user is an admin
 * Shows access denied message for non-admin users
 */
const AdminOnly = ({ children, fallback = null, showMessage = false }) => {
  const { isLoaded, isSignedIn, isAdmin } = useUserRole();

  // Check if Clerk is configured
  const hasClerkKey = !!(
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY
  );

  // If Clerk is not configured, allow access (backwards compatibility)
  if (!hasClerkKey) {
    return children;
  }

  // Wait for auth to load
  if (!isLoaded) {
    return null;
  }

  // User must be signed in
  if (!isSignedIn) {
    if (showMessage) {
      return (
        <Alert
          message="Admin Access Required"
          description="You must be signed in as an administrator to access this feature."
          type="warning"
          showIcon
          style={{ margin: '20px' }}
        />
      );
    }
    return fallback;
  }

  if (!isAdmin) {
    if (showMessage) {
      return (
        <Alert
          message="Insufficient Permissions"
          description="You do not have administrator privileges to access this feature."
          type="error"
          showIcon
          style={{ margin: '20px' }}
        />
      );
    }
    return fallback;
  }

  // User is admin, render children
  return children;
};

export default AdminOnly;
