const Driver = require('../models/Driver');

/**
 * Middleware to verify if a driver is eligible for material assignment
 * Must be used after authentication middleware
 */
const verifyDriverForMaterialAssignment = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    
    const driver = await Driver.findOne({ driverId });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if driver is approved and email is verified
    if (driver.accountStatus !== 'ACTIVE' || driver.reviewStatus !== 'APPROVED' || !driver.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Driver must be approved and email verified before material assignment',
        requiresVerification: !driver.isEmailVerified,
        requiresApproval: driver.accountStatus !== 'ACTIVE' || driver.reviewStatus !== 'APPROVED'
      });
    }

    // Attach driver to request for use in the route handler
    req.driver = driver;
    next();
  } catch (error) {
    console.error('Error in verifyDriverForMaterialAssignment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during driver verification'
    });
  }
};

/**
 * Middleware factory to check if driver can be assigned a specific material
 * @param {string} materialType - Type of material to check against driver's preferences
 */
const canAssignMaterial = (materialType) => {
  return async (req, res, next) => {
    try {
      const { driver } = req;
      
      // Check if material type is in driver's preferred types or admin overridden types
      const allowedTypes = driver.adminOverride 
        ? driver.adminOverrideMaterialType 
        : driver.preferredMaterialType;

      if (!allowedTypes || !allowedTypes.includes(materialType)) {
        return res.status(403).json({
          success: false,
          message: `Material type ${materialType} is not allowed for this driver`,
          allowedMaterialTypes: allowedTypes || []
        });
      }

      next();
    } catch (error) {
      console.error('Error in canAssignMaterial:', error);
      res.status(500).json({
        success: false,
        message: 'Error validating material assignment'
      });
    }
  };
};

module.exports = {
  verifyDriverForMaterialAssignment,
  canAssignMaterial
};
