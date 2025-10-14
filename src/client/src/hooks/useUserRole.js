import { useAuth, useUser } from '@clerk/clerk-react';

/**
 * Custom hook to check user roles and permissions
 * Returns role information and permission checks
 */
export const useUserRole = () => {
  const { isLoaded, isSignedIn, userId, orgRole, orgId } = useAuth();
  const { user } = useUser();

  // Check if Clerk is configured
  const hasClerkKey = !!(
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || 
    process.env.VITE_CLERK_PUBLISHABLE_KEY
  );

  // If Clerk not configured, NO ONE can perform online actions (secure by default)
  if (!hasClerkKey) {
    return {
      isLoaded: true,
      isSignedIn: false,
      isAdmin: false,
      canPerformOnlineActions: false, // Require authentication for online actions
      canPerformOfflineActions: true, // Allow offline actions for everyone
      userId: null,
      userEmail: null,
    };
  }

  if (!isLoaded) {
    return {
      isLoaded: false,
      isSignedIn: false,
      isAdmin: false,
      canPerformOnlineActions: false,
      canPerformOfflineActions: true, // Offline actions available to all
      userId: null,
      userEmail: null,
    };
  }

  if (!isSignedIn) {
    return {
      isLoaded: true,
      isSignedIn: false,
      isAdmin: false,
      canPerformOnlineActions: false,
      canPerformOfflineActions: true, // Offline actions available to all
      userId: null,
      userEmail: null,
    };
  }

  // CUSTOMIZE THIS: Define who is an admin
  // Priority 1: Check Clerk organization admin role (if user is in an org)
  const isOrgAdmin = orgRole === 'org:admin' || orgRole === 'admin';
  
  // Priority 2: Hardcode admin user IDs (optional, for users not in org)
  const adminUserIds = [
    // Add your Clerk user ID here (optional)
    // Find it in: Clerk Dashboard → Users → Click your account
    // Example: 'user_2xxxxxxxxxxxxxxxxxxxxx'
  ];
  
  // Priority 3: Use email addresses (optional)
  const adminEmails = [
    // Add your Gmail here (optional)
    // 'your.email@gmail.com'
  ];

  // Priority 4: Use Clerk public metadata role (optional)
  const isMetadataAdmin = user?.publicMetadata?.role === 'admin';

  // Check if user is admin (any method)
  const isAdminById = adminUserIds.includes(userId);
  const isAdminByEmail = user?.primaryEmailAddress?.emailAddress && 
                          adminEmails.includes(user.primaryEmailAddress.emailAddress);
  const isAdmin = isOrgAdmin || isAdminById || isAdminByEmail || isMetadataAdmin;

  return {
    isLoaded: true,
    isSignedIn: true,
    isAdmin,
    canPerformOnlineActions: isAdmin, // Only admins can perform online actions
    canPerformOfflineActions: true, // Everyone can perform offline actions
    userId,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    orgRole, // Organization role (e.g., 'org:admin', 'admin', 'member')
    orgId, // Organization ID
    user,
  };
};
