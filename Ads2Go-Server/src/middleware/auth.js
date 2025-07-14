// server/src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const getUser = async (token) => {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('id email role isEmailVerified tokenVersion');

    // Invalidate token if the user's tokenVersion has changed
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      tokenVersion: user.tokenVersion // ✅ This was missing
    };
  } catch (error) {
    console.error('Authentication error:', error.message);
    return null;
  }
};

const authMiddleware = async ({ req }) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const isVerifyEmailRequest = req.body?.query?.includes?.('verifyEmail') || false;

    if (isVerifyEmailRequest) {
      return { user: null }; // Allow unauthenticated access for email verification
    }

    const user = await getUser(token);

    if (!user) {
      return { user: null }; // User is not authenticated
    }

    return { user };
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return { user: null };
  }
};

// 🔹 Middleware to check admin access
const adminMiddleware = async ({ req }) => {
  const { user } = await authMiddleware({ req });

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Access denied! Admins only.');
  }

  return { user };
};

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
