// src/resolvers/materialTrackingResolver.js
const jwt = require('jsonwebtoken');
const DeviceCompliance = require('../models/deviceCompliance');
const { JWT_SECRET } = process.env;

/**
 * Middleware-like function to ensure the requester is an authenticated ADMIN.
 * Reads token from context and verifies role.
 */
function checkAdmin(context = {}) {
  const authHeader =
    context?.req?.headers?.authorization ||
    context?.headers?.authorization ||
    context?.authorization ||
    '';

  if (!authHeader) {
    throw new Error('Unauthorized: No token provided');
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin role required');
    }

    return decoded; // return payload for later use if needed
  } catch (err) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

const resolvers = {
  Query: {
    getDeviceCompliances: async (_, __, context) => {
      checkAdmin(context);
      return await DeviceCompliance.find();
    },
    getDeviceComplianceById: async (_, { id }, context) => {
      checkAdmin(context);
      return await DeviceCompliance.findById(id);
    }
  },

  Mutation: {
    createDeviceCompliance: async (_, { input }, context) => {
      checkAdmin(context);
      const newCompliance = new DeviceCompliance(input);
      return await newCompliance.save();
    },
    updateDeviceCompliance: async (_, { id, input }, context) => {
      checkAdmin(context);
      return await DeviceCompliance.findByIdAndUpdate(id, input, { new: true });
    },
    deleteDeviceCompliance: async (_, { id }, context) => {
      checkAdmin(context);
      await DeviceCompliance.findByIdAndDelete(id);
      return 'Device compliance record deleted successfully';
    }
  }
};

module.exports = resolvers;
