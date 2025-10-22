/**
 * User Authentication Middleware
 * Extracts user identification from request headers
 * Supports both authenticated users and anonymous users
 */

/**
 * Middleware to extract and attach user information to request
 * For authenticated users: uses x-user-id header from Clerk
 * For anonymous users: generates a session-based anonymous ID
 */
function identifyUser(req, res, next) {
  // Try to get user ID from headers (Clerk authentication)
  const userId = req.headers['x-user-id'];
  const isAdmin = req.headers['x-is-admin'] === 'true';
  
  if (userId) {
    // Authenticated user
    req.userId = userId;
    req.isAdmin = isAdmin;
    req.isAnonymous = false;
  } else {
    // Anonymous user - use session-based ID or generate one
    // For anonymous users, we'll use their session or a combination of IP + user-agent
    const sessionId = req.headers['x-session-id'] || req.session?.id;
    
    if (sessionId) {
      req.userId = `anonymous_${sessionId}`;
    } else {
      // Fallback: create a temporary ID based on IP and user-agent
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const hash = require('crypto')
        .createHash('md5')
        .update(`${ip}_${userAgent}`)
        .digest('hex')
        .substring(0, 16);
      req.userId = `anonymous_${hash}`;
    }
    
    req.isAdmin = false;
    req.isAnonymous = true;
  }
  
  next();
}

/**
 * Middleware to require authentication (blocks anonymous users)
 */
function requireAuth(req, res, next) {
  if (!req.userId || req.isAnonymous) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this resource'
    });
  }
  next();
}

/**
 * Middleware to require admin access
 */
function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'You do not have permission to access this resource'
    });
  }
  next();
}

module.exports = {
  identifyUser,
  requireAuth,
  requireAdmin,
};
