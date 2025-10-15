import { useAuth, useUser } from '@clerk/clerk-react';

/**
 * Custom hook to check user roles and permissions
 * Returns role information and permission checks
 */
export const useUserRole = () => {
  const { isLoaded, isSignedIn, userId, orgRole, orgId } = useAuth();
  const { user } = useUser();
  // Vite env (fallback to empty object if not available)
  const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

  // Proceed regardless of env presence; rely on Clerk's actual loaded state

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

  // ADMIN DETERMINATION (secure-by-default)
  // 1) Allowlist via environment variables (recommended)
  const rawAdminEmails = (
    viteEnv.VITE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || process.env.REACT_APP_ADMIN_EMAILS || ''
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const rawAdminUserIds = (
    viteEnv.VITE_ADMIN_USER_IDS || process.env.VITE_ADMIN_USER_IDS || process.env.REACT_APP_ADMIN_USER_IDS || ''
  )
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  // 2) Optional: specific Clerk Organization ID treated as admin org
  const adminOrgId = (
    viteEnv.VITE_ADMIN_ORG_ID || process.env.VITE_ADMIN_ORG_ID || process.env.REACT_APP_ADMIN_ORG_ID || ''
  ).trim();

  const userEmail = (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '')?.toLowerCase();
  const allUserEmails = Array.isArray(user?.emailAddresses)
    ? user.emailAddresses.map((e) => (e?.emailAddress || '').toLowerCase()).filter(Boolean)
    : (userEmail ? [userEmail] : []);
  const isAdminByEmail = allUserEmails.some((em) => rawAdminEmails.includes(em));
  const isAdminById = !!(userId && rawAdminUserIds.includes(userId));
  const isAdminByOrg = !!(
    adminOrgId && orgId === adminOrgId && (orgRole === 'org:admin' || orgRole === 'admin')
  );

  // NOTE: Avoid trusting user-editable publicMetadata for admin.
  // If you want to use metadata, set it from a trusted backend and verify server-side.
  const isAdmin = isAdminByEmail || isAdminById || isAdminByOrg;

  // Debug the final admin determination
  console.debug('[useUserRole] Admin check result:', {
    allUserEmails,
    rawAdminEmails,
    isAdminByEmail,
    isAdminById,
    isAdminByOrg,
    isAdmin,
    canPerformOnlineActions: isAdmin
  });

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
