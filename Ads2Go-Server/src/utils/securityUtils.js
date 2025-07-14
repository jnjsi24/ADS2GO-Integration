// server/utils/securityUtils.js

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

// Password strength checker
const checkPasswordStrength = (password) => {
  const strengthChecks = {
    length: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passedChecks = Object.values(strengthChecks).filter(Boolean).length;
  
  // Return detailed feedback
  return {
    score: (passedChecks / 5) * 100,
    strong: passedChecks >= 4,
    errors: {
      length: !strengthChecks.length ? 'Password must be at least 8 characters long' : null,
      hasUpperCase: !strengthChecks.hasUpperCase ? 'Password must contain uppercase letters' : null,
      hasLowerCase: !strengthChecks.hasLowerCase ? 'Password must contain lowercase letters' : null,
      hasNumbers: !strengthChecks.hasNumbers ? 'Password must contain numbers' : null,
      hasSpecialChar: !strengthChecks.hasSpecialChar ? 'Password must contain special characters' : null,
    }
  };
};

// Generate secure reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash password with bcrypt
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Compare password with hash
const comparePasswords = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Rate limiting helper
class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxAttempts = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.attempts = new Map();
  }

  attempt(key) {
    const now = Date.now();
    const userAttempts = this.attempts.get(key) || { count: 0, firstAttempt: now };

    // Reset if window has passed
    if (now - userAttempts.firstAttempt > this.windowMs) {
      userAttempts.count = 0;
      userAttempts.firstAttempt = now;
    }

    userAttempts.count++;
    this.attempts.set(key, userAttempts);

    return {
      blocked: userAttempts.count > this.maxAttempts,
      attemptsLeft: Math.max(0, this.maxAttempts - userAttempts.count),
      msBeforeReset: Math.max(0, this.windowMs - (now - userAttempts.firstAttempt))
    };
  }

  reset(key) {
    this.attempts.delete(key);
  }
}

module.exports = {
  checkPasswordStrength,
  generateResetToken,
  hashPassword,
  comparePasswords,
  RateLimiter
};
