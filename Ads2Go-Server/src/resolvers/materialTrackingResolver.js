// src/resolvers/materialTrackingResolver.js
const MaterialTracking = require('../models/materialTracking'); // match actual filename (case-sensitive)

const ADMIN_TOKEN = process.env.ADMIN_KEY_TOKEN || 'default_admin_token';

function checkAdmin(context = {}) {
  // support different context shapes (Apollo: context.req.headers.authorization,
  // custom: context.headers.authorization, or direct context.authorization)
  const token =
    context?.req?.headers?.authorization ||
    context?.headers?.authorization ||
    context?.authorization ||
    '';

  // accept either "Bearer <token>" or the raw token
  const provided = token.startsWith('Bearer ') ? token.slice(7) : token;

  if (!provided || provided !== ADMIN_TOKEN) {
    throw new Error('Unauthorized: Admin access required');
  }
}

const resolvers = {
  Query: {
    getMaterialTrackings: async () => {
      return await MaterialTracking.find();
    },
    getMaterialTrackingById: async (_, { id }) => {
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
