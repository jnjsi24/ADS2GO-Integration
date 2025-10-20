const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const { JWT_SECRET } = require('./auth'); // reuse same secret
const logger = require('../utils/logger');

// ✅ Get driver info from token
const getDriverFromToken = async (token) => {
  try {
    if (!token) {
      console.log('🔍 Driver Auth: No token provided');
      return null;
    }

    // Debug: decode and verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      logger.error('❌ Driver Auth Error: jwt.verify failed:', err.message);
      return null;
    }
    
    if (!decoded.driverId) {
      logger.error('❌ Driver Auth Error: No driverId in token');
      return null;
    }

    console.log('🔍 Driver Auth: Looking for driver:', decoded.driverId);

    // Try to find driver by driverId first (new format), then by _id (old format)
    let driver = await Driver.findOne({ driverId: decoded.driverId })
      .select('+password driverId firstName middleName lastName email profilePicture accountStatus tokenVersion isEmailVerified editRequestStatus');
    
    // If not found and decoded.driverId looks like a MongoDB ObjectId, try finding by _id (backward compatibility)
    if (!driver && decoded.driverId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔍 Driver Auth: Trying ObjectId lookup for backward compatibility');
      driver = await Driver.findById(decoded.driverId)
        .select('+password driverId firstName middleName lastName email profilePicture accountStatus tokenVersion isEmailVerified editRequestStatus');
    }

    if (!driver) {
      logger.error('❌ Driver Auth Error: Driver not found in database:', decoded.driverId);
      return null;
    }

    // Check token version
    if (driver.tokenVersion !== decoded.tokenVersion) {
      logger.error('❌ Driver Auth Error: tokenVersion mismatch', {
        driverId: driver.driverId,
        driverTokenVersion: driver.tokenVersion,
        tokenVersion: decoded.tokenVersion
      });
      return null;
    }

    // Check account status
    if (driver.accountStatus !== 'ACTIVE') {
      console.error('❌ Driver Auth Error: account not ACTIVE', {
        driverId: driver.driverId,
        accountStatus: driver.accountStatus
      });
      return null; // Changed from throw to return null for consistency
    }

    console.log('✅ Driver Auth: Successfully authenticated driver:', driver.driverId);
    return driver; // full driver object for resolvers
  } catch (error) {
    console.error('❌ Driver Auth Error:', error.message);
    return null;
  }
};

// ✅ Middleware for Apollo context
const driverMiddleware = async ({ req }) => {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader) {
    console.warn('Driver Auth: missing Authorization header');
  }
  const token = authHeader.replace('Bearer ', '');
  const driver = await getDriverFromToken(token);
  
  // Debug logging
  if (driver) {
    console.log('✅ Driver authenticated:', driver.driverId, driver.accountStatus);
  } else if (token) {
    logger.warn('⚠️  Driver token provided but authentication failed');
  }
  
  return { driver }; // can be null if not authenticated
};

// ✅ Helper to protect driver resolvers
const checkDriverAuth = (driver) => {
  if (!driver) {
    throw new Error('Not authenticated as driver');
  }
  return driver;
};

// ✅ Express middleware for protecting driver routes
const checkDriver = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const driver = await getDriverFromToken(token);
    
    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'Driver authentication required'
      });
    }
    
    req.driver = driver;
    next();
  } catch (error) {
    console.error('Driver Auth Middleware Error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid driver token'
    });
  }
};

module.exports = {
  driverMiddleware,
  checkDriverAuth,
  checkDriver,
};