// src/resolvers/materialTrackingResolver.js
const jwt = require('jsonwebtoken');
const MaterialTracking = require('../models/materialTracking'); // fixed filename case
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
    getMaterialTrackings: async (_, __, context) => {
      checkAdmin(context);
      return await MaterialTracking.find();
    },
    getMaterialTrackingById: async (_, { id }, context) => {
      checkAdmin(context);
      return await MaterialTracking.findById(id);
    }
  },

  Mutation: {
    createMaterialTracking: async (_, { input }, context) => {
      checkAdmin(context);
      const newTracking = new MaterialTracking(input);
      return await newTracking.save();
    },
    updateMaterialTracking: async (_, { id, input }, context) => {
      checkAdmin(context);
      return await MaterialTracking.findByIdAndUpdate(id, input, { new: true });
    },
    deleteMaterialTracking: async (_, { id }, context) => {
      checkAdmin(context);
      await MaterialTracking.findByIdAndDelete(id);
      return 'Material tracking record deleted successfully';
    }
  }
};

module.exports = resolvers;
