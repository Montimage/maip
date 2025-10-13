/**
 * Unified Session Manager
 * Manages multiple concurrent sessions for different modules (DPI, Prediction, XAI, etc.)
 * Each module can have multiple independent sessions per user
 */

class SessionManager {
  constructor() {
    // Map of sessionType -> Map of sessionId -> session data
    // Example: { 'dpi': Map(), 'prediction': Map(), 'xai': Map() }
    this.sessions = new Map();
    
    // Track online sessions separately (only one per module allowed)
    // Example: { 'dpi': 'session_123', 'prediction': 'session_456' }
    this.onlineSessions = new Map();
    
    // Initialize session types
    this.initializeSessionType('dpi');
    this.initializeSessionType('prediction');
    this.initializeSessionType('xai');
    this.initializeSessionType('attacks');
  }

  /**
   * Initialize a session type (module)
   */
  initializeSessionType(type) {
    if (!this.sessions.has(type)) {
      this.sessions.set(type, new Map());
    }
  }

  /**
   * Create a new session
   * @param {string} type - Session type ('dpi', 'prediction', 'xai', 'attacks')
   * @param {string} sessionId - Unique session ID
   * @param {string} mode - Session mode ('online' or 'offline')
   * @param {object} options - Additional session data
   */
  createSession(type, sessionId, mode, options = {}) {
    this.initializeSessionType(type);
    
    const session = {
      sessionId,
      type,
      mode, // 'online' or 'offline'
      isRunning: true,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      lastUpdate: new Date().toISOString(),
      ...options
    };

    this.sessions.get(type).set(sessionId, session);

    // Track online session separately
    if (mode === 'online') {
      this.onlineSessions.set(type, sessionId);
    }

    console.log(`[SessionManager] Created ${mode} ${type} session:`, sessionId);
    return session;
  }

  /**
   * Get session by type and ID
   */
  getSession(type, sessionId) {
    if (!sessionId || !this.sessions.has(type)) return null;
    
    const session = this.sessions.get(type).get(sessionId);
    if (session) {
      session.lastAccessedAt = Date.now();
    }
    return session;
  }

  /**
   * Get the active online session for a type
   */
  getOnlineSession(type) {
    const sessionId = this.onlineSessions.get(type);
    if (!sessionId) return null;
    return this.getSession(type, sessionId);
  }

  /**
   * Update session data
   */
  updateSession(type, sessionId, updates) {
    const session = this.sessions.get(type)?.get(sessionId);
    if (session) {
      Object.assign(session, updates, { 
        lastAccessedAt: Date.now(),
        lastUpdate: new Date().toISOString()
      });
      return session;
    }
    return null;
  }

  /**
   * Mark session as completed (for async operations like predictions)
   */
  completeSession(type, sessionId) {
    const session = this.sessions.get(type)?.get(sessionId);
    if (session) {
      session.isRunning = false;
      session.completedAt = Date.now();
      
      // Clear online session tracking
      if (this.onlineSessions.get(type) === sessionId) {
        this.onlineSessions.delete(type);
      }
      
      console.log(`[SessionManager] Completed ${type} session:`, sessionId);
      return session;
    }
    return null;
  }

  /**
   * Delete session
   */
  deleteSession(type, sessionId) {
    const sessions = this.sessions.get(type);
    if (!sessions) return false;
    
    const session = sessions.get(sessionId);
    if (session) {
      // Clear online session tracking
      if (this.onlineSessions.get(type) === sessionId) {
        this.onlineSessions.delete(type);
      }
      
      sessions.delete(sessionId);
      console.log(`[SessionManager] Deleted ${type} session:`, sessionId);
      return true;
    }
    return false;
  }

  /**
   * Check if a session exists and is running
   */
  isSessionRunning(type, sessionId) {
    const session = this.getSession(type, sessionId);
    return session && session.isRunning;
  }

  /**
   * Get all sessions for a type
   */
  getAllSessions(type) {
    const sessions = this.sessions.get(type);
    return sessions ? Array.from(sessions.values()) : [];
  }

  /**
   * Get all running sessions for a type
   */
  getRunningSessions(type) {
    return this.getAllSessions(type).filter(s => s.isRunning);
  }

  /**
   * Get all offline sessions for a type
   */
  getOfflineSessions(type) {
    return this.getAllSessions(type).filter(s => s.mode === 'offline');
  }

  /**
   * Get session count for a type
   */
  getSessionCount(type, mode = null) {
    const sessions = this.getAllSessions(type);
    if (!mode) {
      return sessions.length;
    }
    return sessions.filter(s => s.mode === mode).length;
  }

  /**
   * Clean up old sessions
   * - DPI: Remove sessions inactive > 1 hour
   * - Prediction: Remove completed sessions > 2 hours old
   * - XAI: Remove completed sessions > 2 hours old
   * - Attacks: Remove completed sessions > 2 hours old
   */
  cleanupOldSessions() {
    const now = Date.now();
    const cleanupRules = {
      dpi: { maxAge: 60 * 60 * 1000, checkCompleted: false }, // 1 hour, check lastAccessedAt
      prediction: { maxAge: 2 * 60 * 60 * 1000, checkCompleted: true }, // 2 hours, check completedAt
      xai: { maxAge: 2 * 60 * 60 * 1000, checkCompleted: true }, // 2 hours
      attacks: { maxAge: 2 * 60 * 60 * 1000, checkCompleted: true }, // 2 hours
    };

    let totalCleaned = 0;

    for (const [type, rule] of Object.entries(cleanupRules)) {
      if (!this.sessions.has(type)) continue;

      const sessions = this.sessions.get(type);
      let cleaned = 0;

      for (const [sessionId, session] of sessions) {
        let shouldClean = false;

        if (rule.checkCompleted) {
          // For async operations (prediction, xai, attacks), only clean completed sessions
          if (!session.isRunning && session.completedAt) {
            const age = now - session.completedAt;
            shouldClean = age > rule.maxAge;
          }
        } else {
          // For sync operations (dpi), clean based on last access
          const age = now - session.lastAccessedAt;
          shouldClean = age > rule.maxAge;
        }

        if (shouldClean) {
          const ageMinutes = Math.round((now - (session.completedAt || session.lastAccessedAt)) / 60000);
          console.log(`[SessionManager] Cleaning up old ${type} session: ${sessionId} (age: ${ageMinutes} minutes)`);
          this.deleteSession(type, sessionId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[SessionManager] Cleaned up ${cleaned} old ${type} sessions`);
        totalCleaned += cleaned;
      }
    }

    if (totalCleaned > 0) {
      console.log(`[SessionManager] Total cleaned: ${totalCleaned} sessions`);
    }

    return totalCleaned;
  }

  /**
   * Get legacy status for backward compatibility
   * Returns the most recent session in the old format
   * Used by modules that expect single global status
   */
  getLegacyStatus(type) {
    const runningSessions = this.getRunningSessions(type);
    
    if (runningSessions.length > 0) {
      // Return the most recent running session
      const latest = runningSessions.sort((a, b) => b.createdAt - a.createdAt)[0];
      
      // Format depends on type
      if (type === 'dpi') {
        return {
          isRunning: true,
          sessionId: latest.sessionId,
          mode: latest.mode,
          lastUpdate: latest.lastUpdate,
          ...latest
        };
      } else if (type === 'prediction') {
        return {
          isRunning: true,
          lastPredictedAt: latest.createdAt,
          lastPredictedId: latest.sessionId,
          config: latest.config
        };
      } else if (type === 'xai') {
        return {
          isRunning: true,
          config: latest.config,
          lastRunAt: latest.createdAt
        };
      } else if (type === 'attacks') {
        return {
          isRunning: true,
          config: latest.config,
          lastRunAt: latest.createdAt
        };
      }
    }
    
    // Return the most recent completed session
    const allSessions = this.getAllSessions(type);
    if (allSessions.length > 0) {
      const latest = allSessions.sort((a, b) => b.createdAt - a.createdAt)[0];
      
      if (type === 'dpi') {
        return {
          isRunning: false,
          sessionId: latest.sessionId,
          mode: latest.mode,
          lastUpdate: latest.lastUpdate
        };
      } else if (type === 'prediction') {
        return {
          isRunning: false,
          lastPredictedAt: latest.createdAt,
          lastPredictedId: latest.sessionId,
          config: latest.config
        };
      } else if (type === 'xai') {
        return {
          isRunning: false,
          config: latest.config,
          lastRunAt: latest.createdAt
        };
      } else if (type === 'attacks') {
        return {
          isRunning: false,
          config: latest.config,
          lastRunAt: latest.createdAt
        };
      }
    }
    
    // No sessions - return empty status
    if (type === 'prediction') {
      return {
        isRunning: false,
        lastPredictedAt: null,
        lastPredictedId: null,
        config: null
      };
    } else if (type === 'xai' || type === 'attacks') {
      return {
        isRunning: false,
        config: null,
        lastRunAt: null
      };
    } else {
      return {
        isRunning: false,
        sessionId: null,
        mode: null
      };
    }
  }

  /**
   * Get statistics for all session types
   */
  getStats() {
    const stats = {};
    
    for (const [type, sessions] of this.sessions) {
      const allSessions = Array.from(sessions.values());
      stats[type] = {
        total: allSessions.length,
        running: allSessions.filter(s => s.isRunning).length,
        completed: allSessions.filter(s => !s.isRunning).length,
        online: allSessions.filter(s => s.mode === 'online').length,
        offline: allSessions.filter(s => s.mode === 'offline').length,
      };
    }
    
    return stats;
  }
}

// Export singleton instance
module.exports = new SessionManager();
