const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const getUser = async (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check for admin token
    if (decoded.adminId) {
      const admin = await Admin.findById(decoded.adminId).select('id email role isEmailVerified tokenVersion');
      if (!admin || admin.tokenVersion !== decoded.tokenVersion) return null;

      return {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isEmailVerified: admin.isEmailVerified,
        tokenVersion: admin.tokenVersion,
      };
    }

    // Check for superadmin token
    if (decoded.superAdminId) {
      const superAdmin = await SuperAdmin.findById(decoded.superAdminId).select('id email role isEmailVerified tokenVersion');
      if (!superAdmin || superAdmin.tokenVersion !== decoded.tokenVersion) return null;

      return {
        id: superAdmin.id,
        email: superAdmin.email,
        role: superAdmin.role,
        isEmailVerified: superAdmin.isEmailVerified,
        tokenVersion: superAdmin.tokenVersion,
      };
    }

    // Check for regular user token
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('id email role isEmailVerified tokenVersion');
      if (!user || user.tokenVersion !== decoded.tokenVersion) return null;

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        tokenVersion: user.tokenVersion,
      };
    }

    // Note: Driver tokens are handled by driverAuth.js middleware
    // This prevents conflicts between the two authentication systems

    return null;
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
    
    // For admins and regular users only
    // Drivers are handled by driverAuth.js middleware
    return { 
      user: user || null
    };
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



// ✅ Express middleware for protecting admin routes
const checkAdminMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const user = await getUser(token);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin Auth Middleware Error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  JWT_SECRET,
  checkAuth,
  checkAdmin,
  checkAdminMiddleware,
};
