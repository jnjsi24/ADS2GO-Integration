
const AdsPlan = require('../models/AdsPlan');

module.exports = {
  Query: {
    getAllAdsPlans: async () => {
      return await AdsPlan.find().sort({ createdAt: -1 });
    },
    getAdsPlanById: async (_, { id }) => {
      return await AdsPlan.findById(id);
    },
    getAdsPlansByFilter: async (_, { category, materialType, vehicleType }) => {
      const filter = {};
      if (category) filter.category = category;
      if (materialType) filter.materialType = materialType;
      if (vehicleType) filter.vehicleType = vehicleType;
      return await AdsPlan.find(filter);
    },
  },

  Mutation: {
    createAdsPlan: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create ads plans');
      }
      const newPlan = new AdsPlan(input);
      return await newPlan.save();
    },

    updateAdsPlan: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update ads plans');
      }
      return await AdsPlan.findByIdAndUpdate(id, input, { new: true });
    },

    deleteAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can delete ads plans');
      }
      await AdsPlan.findByIdAndDelete(id);
      return "Ads plan deleted successfully.";
    },
  }
};
