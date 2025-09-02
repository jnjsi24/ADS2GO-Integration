const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const { JWT_SECRET } = require('./auth'); // reuse same secret

// ✅ Get driver info from token
const getDriverFromToken = async (token) => {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.driverId) return null;

    // Try to find driver by driverId first (new format), then by _id (old format)
    let driver = await Driver.findOne({ driverId: decoded.driverId })
      .select('+password driverId firstName middleName lastName email profilePicture accountStatus tokenVersion isEmailVerified editRequestStatus');
    
    // If not found and decoded.driverId looks like a MongoDB ObjectId, try finding by _id (backward compatibility)
    if (!driver && decoded.driverId.match(/^[0-9a-fA-F]{24}$/)) {
      driver = await Driver.findById(decoded.driverId)
        .select('+password driverId firstName middleName lastName email profilePicture accountStatus tokenVersion isEmailVerified editRequestStatus');
    }

    if (!driver) return null;

    // Check token version
    if (driver.tokenVersion !== decoded.tokenVersion) return null;

    // Check account status
    if (driver.accountStatus !== 'ACTIVE') {
      throw new Error('Driver account is not active');
    }

    return driver; // full driver object for resolvers
  } catch (error) {
    console.error('Driver Auth Error:', error.message);
    return null;
  }
};

// ✅ Middleware for Apollo context
const driverMiddleware = async ({ req }) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const driver = await getDriverFromToken(token);
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
