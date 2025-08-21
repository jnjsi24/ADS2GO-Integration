const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const getUser = async (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.userId) return null;

    const user = await User.findById(decoded.userId).select('id email role isEmailVerified tokenVersion');
    if (!user || user.tokenVersion !== decoded.tokenVersion) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      tokenVersion: user.tokenVersion,
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

    if (isVerifyEmailRequest) return { user: null };

    const user = await getUser(token);
    return { user: user || null };
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return { user: null };
  }
};

const adminMiddleware = async ({ req }) => {
  const { user } = await authMiddleware({ req });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    throw new Error('Access denied! Admins only.');
  }
  return { user };
};

const checkAuth = (user) => {
  if (!user) throw new Error('Not authenticated');
  return user;
};

const checkAdmin = (user) => {
  checkAuth(user);
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    throw new Error('Access denied! Admins only.');
  }
  return user;
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  JWT_SECRET,
  checkAuth,
  checkAdmin,
};
