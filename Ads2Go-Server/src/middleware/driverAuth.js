const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const { JWT_SECRET } = require('./auth'); // reuse same secret

// ✅ Get driver info from token
const getDriverFromToken = async (token) => {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.driverId) return null;

    // Using _id for driver login/auth
    const driver = await Driver.findById(decoded.driverId)
      .select('+password driverId firstName middleName lastName email profilePicture accountStatus tokenVersion isEmailVerified editRequestStatus');

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

module.exports = {
  driverMiddleware,
  checkDriverAuth,
};
