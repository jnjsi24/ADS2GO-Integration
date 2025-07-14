// server/utils/sessionManager.js

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.blacklistedTokens = new Set();
  }

  // Create new session
  createSession(userId, deviceInfo) {
    const sessionId = jwt.sign(
      { userId, sessionId: Date.now() },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    this.activeSessions.set(sessionId, {
      userId,
      deviceInfo,
      createdAt: new Date(),
      lastActivity: new Date()
    });

    return sessionId;
  }

  // Validate session
  validateSession(sessionId) {
    try {
      if (this.blacklistedTokens.has(sessionId)) {
        return { valid: false, reason: 'Token blacklisted' };
      }

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      // Update last activity
      session.lastActivity = new Date();
      this.activeSessions.set(sessionId, session);

      return { valid: true, session };
    } catch (error) {
      return { valid: false, reason: 'Invalid session' };
    }
  }

  // End session
  endSession(sessionId) {
    this.activeSessions.delete(sessionId);
    this.blacklistedTokens.add(sessionId);
  }

  // Get user's active sessions
  getUserSessions(userId) {
    const userSessions = [];
    this.activeSessions.forEach((session, sessionId) => {
      if (session.userId === userId) {
        userSessions.push({
          sessionId,
          ...session
        });
      }
    });
    return userSessions;
  }

  // Clean up expired sessions and blacklisted tokens
  cleanup() {
    const now = new Date();
    
    // Clean up old sessions (older than 24 hours)
    this.activeSessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > 24 * 60 * 60 * 1000) {
        this.activeSessions.delete(sessionId);
      }
    });

    // Clean up blacklisted tokens (older than 24 hours)
    this.blacklistedTokens.forEach(token => {
      try {
        jwt.verify(token, JWT_SECRET);
      } catch (error) {
        // Token is expired, remove from blacklist
        this.blacklistedTokens.delete(token);
      }
    });
  }
}

module.exports = new SessionManager();
