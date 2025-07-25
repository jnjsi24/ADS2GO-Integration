const Material = require('../models/Material');
const { checkAdmin } = require('../middleware/auth');

module.exports = {
  Query: {
    getAllMaterials: async (_, __, context) => {
      const { user } = context;
      checkAdmin(user);
      return await Material.find().sort({ createdAt: -1 });
    },

    getMaterialsByCategory: async (_, { category }, context) => {
      if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
        throw new Error('Invalid material category');
      }

      return await Material.find({ category }).sort({ createdAt: -1 });
    },

    getMaterialById: async (_, { id }, context) => {
      const { user } = context;
      checkAdmin(user);
      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');
      return material;
    },
  },

  Mutation: {
    createMaterial: async (_, { input }, context) => {
      const { user } = context;
      checkAdmin(user);

      // Manual validation
      if (input.price < 0) throw new Error('Price must be non-negative');
      if (!input.name || input.name.trim().length < 3)
        throw new Error('Name must be at least 3 characters long');

      const material = new Material(input);
      await material.save();
      return material;
    },

    updateMaterial: async (_, { id, input }, context) => {
      const { user } = context;
      checkAdmin(user);

      if (input.name && input.name.trim().length < 3) {
        throw new Error('Name must be at least 3 characters long');
      }

      if (input.price !== undefined && input.price < 0) {
        throw new Error('Price must be a non-negative number');
      }

      const updated = await Material.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      });
      if (!updated) throw new Error('Material not found');
      return updated;
    },

    deleteMaterial: async (_, { id }, context) => {
      const { user } = context;
      checkAdmin(user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');
      return 'Material deleted successfully.';
    },
  },

  // ✅ This maps MongoDB _id to GraphQL id field
  Material: {
    id: (parent) => parent._id.toString(),
  },
};
