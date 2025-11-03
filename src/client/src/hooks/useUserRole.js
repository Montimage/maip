// Check if Clerk is configured
const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasClerkKey = !!PUBLISHABLE_KEY;

// Conditionally import Clerk hooks
let useAuth, useUser;
if (hasClerkKey) {
  try {
    const clerkReact = require('@clerk/clerk-react');
    useAuth = clerkReact.useAuth;
    useUser = clerkReact.useUser;
  } catch (error) {
    console.warn('[useUserRole] Clerk not available:', error);
  }
}

/**
 * Hook when Clerk is enabled
 */
const useClerkUserRole = () => {
  const { isLoaded, isSignedIn, userId, orgRole, orgId } = useAuth();
  const { user } = useUser();
  const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

  if (!isLoaded) {
    return {
      isLoaded: false,
      isSignedIn: false,
      isAdmin: false,
      canPerformOnlineActions: false,
      canPerformOfflineActions: true,
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
      canPerformOfflineActions: true,
      userId: null,
      userEmail: null,
    };
  }

  // ADMIN DETERMINATION
  const rawAdminEmails = (
    viteEnv.VITE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || process.env.REACT_APP_ADMIN_EMAILS || ''
  ).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  const rawAdminUserIds = (
    viteEnv.VITE_ADMIN_USER_IDS || process.env.VITE_ADMIN_USER_IDS || process.env.REACT_APP_ADMIN_USER_IDS || ''
  ).split(',').map((e) => e.trim()).filter(Boolean);

  const adminOrgId = (
    viteEnv.VITE_ADMIN_ORG_ID || process.env.VITE_ADMIN_ORG_ID || process.env.REACT_APP_ADMIN_ORG_ID || ''
  ).trim();

  const userEmail = (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '')?.toLowerCase();
  const allUserEmails = Array.isArray(user?.emailAddresses)
    ? user.emailAddresses.map((e) => (e?.emailAddress || '').toLowerCase()).filter(Boolean)
    : (userEmail ? [userEmail] : []);

  const isAdminByEmail = allUserEmails.some((em) => rawAdminEmails.includes(em));
  const isAdminById = !!(userId && rawAdminUserIds.includes(userId));
  const isAdminByOrg = !!(adminOrgId && orgId === adminOrgId && (orgRole === 'org:admin' || orgRole === 'admin'));
  const isAdmin = isAdminByEmail || isAdminById || isAdminByOrg;

  return {
    isLoaded: true,
    isSignedIn: true,
    isAdmin,
    canPerformOnlineActions: isAdmin,
    canPerformOfflineActions: true,
    userId,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    orgRole,
    orgId,
    user,
  };
};

/**
 * Hook when Clerk is disabled - grant admin access to all
 */
const useNoAuthUserRole = () => {
  return {
    isLoaded: true,
    isSignedIn: true, // Treat as signed in so features aren't blocked
    isAdmin: true, // All users are admin when no auth
    canPerformOnlineActions: true, // All actions allowed
    canPerformOfflineActions: true,
    userId: 'anonymous', // Provide a dummy user ID
    userEmail: 'anonymous@localhost',
    orgRole: 'admin',
    orgId: null,
    user: {
      // Minimal user object for compatibility
      id: 'anonymous',
      primaryEmailAddress: { emailAddress: 'anonymous@localhost' }
    },
  };
};

/**
 * Export appropriate hook based on configuration
 */
export const useUserRole = (hasClerkKey && useAuth && useUser) ? useClerkUserRole : useNoAuthUserRole;
