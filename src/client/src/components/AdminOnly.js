import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Alert } from 'antd';

/**
 * Component that only renders children if user is an admin
 * Shows access denied message for non-admin users
 */
const AdminOnly = ({ children, fallback = null, showMessage = false }) => {
  const { isLoaded, isSignedIn, orgRole, userId } = useAuth();

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

  // Check if user is admin (you can customize this logic)
  // Option 1: Use Clerk roles (requires setting up roles in dashboard)
  // const isAdmin = orgRole === 'admin';
  
  // Option 2: Use specific user IDs (simpler, for small teams)
  // Replace with your actual Clerk user ID
  const adminUserIds = [
    // Add your user ID here after you sign in
    // You can find it in Clerk Dashboard → Users → Your Account
    // Example: 'user_2xxxxxxxxxxxxxxxxxxxxx'
  ];
  const isAdmin = adminUserIds.includes(userId);

  // Option 3: Use email domain check (requires public metadata)
  // This would need additional setup in Clerk

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
