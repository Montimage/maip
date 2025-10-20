/**
 * Token Usage Limiter Middleware
 * Tracks OpenAI token usage per user and enforces limits
 */

const TOKEN_LIMITS = {
  admin: Infinity, // No limit for admins
  user: parseInt(process.env.USER_TOKEN_LIMIT) || 50000, // Default 50k tokens per user
};

// In-memory storage (consider using Redis or database for production)
const userTokenUsage = new Map();

/**
 * Get current token usage for a user
 */
function getUserTokenUsage(userId) {
  if (!userTokenUsage.has(userId)) {
    userTokenUsage.set(userId, {
      totalTokens: 0,
      requestCount: 0,
      lastReset: Date.now(),
      history: []
    });
  }
  return userTokenUsage.get(userId);
}

/**
 * Record token usage for a user
 */
function recordTokenUsage(userId, tokens, isAdmin = false) {
  if (isAdmin) return; // Don't track admin usage
  
  const usage = getUserTokenUsage(userId);
  usage.totalTokens += tokens;
  usage.requestCount += 1;
  usage.history.push({
    timestamp: Date.now(),
    tokens,
  });
  
  // Keep only last 100 requests in history
  if (usage.history.length > 100) {
    usage.history = usage.history.slice(-100);
  }
}

/**
 * Check if user has exceeded token limit
 */
function hasExceededLimit(userId, isAdmin = false) {
  if (isAdmin) return false;
  
  const usage = getUserTokenUsage(userId);
  const limit = TOKEN_LIMITS.user;
  
  return usage.totalTokens >= limit;
}

/**
 * Middleware to check token limits before AI requests
 */
function checkTokenLimit(req, res, next) {
  const userId = req.userId || req.headers['x-user-id'];
  const isAdmin = req.isAdmin || req.headers['x-is-admin'] === 'true';
  
  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to use AI Assistant'
    });
  }
  
  if (hasExceededLimit(userId, isAdmin)) {
    const usage = getUserTokenUsage(userId);
    return res.status(429).json({
      error: 'Token limit exceeded',
      message: `You have used ${usage.totalTokens} tokens. Limit: ${TOKEN_LIMITS.user} tokens.`,
      tokenUsage: usage.totalTokens,
      tokenLimit: TOKEN_LIMITS.user
    });
  }
  
  // Attach usage info to request for later recording
  req.tokenUsage = getUserTokenUsage(userId);
  req.userId = userId;
  req.isAdmin = isAdmin;
  
  next();
}

/**
 * Middleware to record token usage after AI response
 */
function recordTokens(tokensUsed) {
  return (req, res, next) => {
    if (req.userId && tokensUsed) {
      recordTokenUsage(req.userId, tokensUsed, req.isAdmin);
    }
    next();
  };
}

/**
 * Get token usage stats endpoint
 */
function getTokenStats(req, res) {
  const userId = req.userId || req.headers['x-user-id'];
  const isAdmin = req.isAdmin || req.headers['x-is-admin'] === 'true';
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const usage = getUserTokenUsage(userId);
  const limit = isAdmin ? Infinity : TOKEN_LIMITS.user;
  
  res.json({
    totalTokens: usage.totalTokens,
    tokenLimit: limit,
    requestCount: usage.requestCount,
    percentUsed: isAdmin ? 0 : Math.round((usage.totalTokens / limit) * 100),
    isAdmin,
    limitReached: !isAdmin && usage.totalTokens >= limit
  });
}

/**
 * Reset token usage (admin only)
 */
function resetTokenUsage(req, res) {
  const targetUserId = req.body.userId || req.query.userId;
  const isAdmin = req.isAdmin || req.headers['x-is-admin'] === 'true';
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  if (targetUserId) {
    userTokenUsage.delete(targetUserId);
    res.json({ message: `Token usage reset for user ${targetUserId}` });
  } else {
    userTokenUsage.clear();
    res.json({ message: 'All token usage reset' });
  }
}

module.exports = {
  checkTokenLimit,
  recordTokenUsage,
  recordTokens,
  hasExceededLimit,
  getUserTokenUsage,
  getTokenStats,
  resetTokenUsage,
  TOKEN_LIMITS
};
