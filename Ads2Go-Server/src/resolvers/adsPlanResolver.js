const AdsPlan = require('../models/AdsPlan');

module.exports = {
  Query: {
    getAllAdsPlans: async () => {
      return await AdsPlan.find().sort({ createdAt: -1 });
    },

    getAdsPlanById: async (_, { id }) => {
      return await AdsPlan.findById(id);
    },

    getAdsPlansByFilter: async (_, { category, materialType, vehicleType, numberOfDevices, status }) => {
      const filter = {};
      if (category) filter.category = category.toUpperCase();
      if (materialType) filter.materialType = materialType.toUpperCase();
      if (vehicleType) filter.vehicleType = vehicleType.toUpperCase();
      if (numberOfDevices) filter.numberOfDevices = numberOfDevices;
      if (status) filter.status = status.toUpperCase();
      return await AdsPlan.find(filter);
    },
  },

  Mutation: {
    createAdsPlan: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create ads plans');
      }

      const totalPlaysPerDay = input.playsPerDayPerDevice * input.numberOfDevices;
      const dailyRevenue = totalPlaysPerDay * input.pricePerPlay;
      const totalPrice = dailyRevenue * input.durationDays;

      const newPlan = new AdsPlan({
        ...input,
        totalPlaysPerDay,
        dailyRevenue,
        totalPrice,
        status: 'PENDING',
        startDate: null,
        endDate: null
      });

      return await newPlan.save();
    },

    updateAdsPlan: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update ads plans');
      }

      // Recalculate totals if key fields change
      if (input.numberOfDevices || input.playsPerDayPerDevice || input.pricePerPlay || input.durationDays) {
        const existingPlan = await AdsPlan.findById(id);
        const playsPerDayPerDevice = input.playsPerDayPerDevice ?? existingPlan.playsPerDayPerDevice;
        const numberOfDevices = input.numberOfDevices ?? existingPlan.numberOfDevices;
        const pricePerPlay = input.pricePerPlay ?? existingPlan.pricePerPlay;
        const durationDays = input.durationDays ?? existingPlan.durationDays;

        input.totalPlaysPerDay = playsPerDayPerDevice * numberOfDevices;
        input.dailyRevenue = input.totalPlaysPerDay * pricePerPlay;
        input.totalPrice = input.dailyRevenue * durationDays;
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

    startAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can start ads plans');
      }
      return await AdsPlan.findByIdAndUpdate(
        id,
        { status: 'RUNNING', startDate: new Date() },
        { new: true }
      );
    },

    endAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can end ads plans');
      }
      return await AdsPlan.findByIdAndUpdate(
        id,
        { status: 'ENDED', endDate: new Date() },
        { new: true }
      );
    },
  }
};
