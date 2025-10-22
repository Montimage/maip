/**
 * Fetch utility with automatic user authentication headers
 * Attaches x-user-id and x-is-admin headers to all API requests
 */

/**
 * Get user headers for API requests
 * @param {object} userRole - User role object from useUserRole hook
 * @returns {object} - Headers object with user authentication
 */
export function getUserHeaders(userRole) {
  const headers = {};
  
  if (userRole && userRole.isLoaded) {
    if (userRole.userId && userRole.isSignedIn) {
      // Authenticated user
      headers['x-user-id'] = userRole.userId;
      if (userRole.isAdmin) {
        headers['x-is-admin'] = 'true';
      }
    } else {
      // Anonymous user - generate a session ID
      let anonymousId = sessionStorage.getItem('anonymous-user-id');
      if (!anonymousId) {
        anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('anonymous-user-id', anonymousId);
      }
      headers['x-session-id'] = anonymousId;
    }
  }
  
  return headers;
}

/**
 * Fetch with automatic user authentication headers
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {object} userRole - User role object from useUserRole hook
 * @returns {Promise} - Fetch promise
 */
export async function fetchWithAuth(url, options = {}, userRole = null) {
  const userHeaders = getUserHeaders(userRole);
  
  const mergedOptions = {
    ...options,
    headers: {
      ...options.headers,
      ...userHeaders,
    },
  };
  
  return fetch(url, mergedOptions);
}

/**
 * Create form data with user headers for file uploads
 * Note: FormData cannot have custom headers, so you need to add headers to fetch options
 * @param {FormData} formData - Form data object
 * @param {object} userRole - User role object from useUserRole hook
 * @returns {object} - Object with formData and headers to use in fetch
 */
export function createFormDataWithAuth(formData, userRole = null) {
  const userHeaders = getUserHeaders(userRole);
  
  return {
    body: formData,
    headers: userHeaders,
  };
}
