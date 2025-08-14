const AdsPlan = require('../models/AdsPlan');

module.exports = {
  Query: {
    // Get all plans (latest first)
    getAllAdsPlans: async () => {
      return await AdsPlan.find().sort({ createdAt: -1 });
    },

    // Get a plan by its ID
    getAdsPlanById: async (_, { id }) => {
      return await AdsPlan.findById(id);
    },

    // Filter plans based on optional criteria
    getAdsPlansByFilter: async (_, { category, materialType, vehicleType, numberOfDevices, status }) => {
      const filter = {};
      if (category) filter.category = category;
      if (materialType) filter.materialType = materialType;
      if (vehicleType) filter.vehicleType = vehicleType;
      if (numberOfDevices) filter.numberOfDevices = numberOfDevices;
      if (status) filter.status = status;
      return await AdsPlan.find(filter);
    },
  },

  Mutation: {
    // Create a new Ads Plan
    createAdsPlan: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create ads plans');
      }

      // Auto-calculate based on input
      const totalPlaysPerDay = input.playsPerDayPerDevice * input.numberOfDevices;
      const dailyRevenue = totalPlaysPerDay * input.pricePerPlay;
      const totalPrice = dailyRevenue * input.durationDays;

      const newPlan = new AdsPlan({
        ...input,
        totalPlaysPerDay,
        dailyRevenue,
        totalPrice,
        impressions: 0,
        status: 'PENDING',
        startDate: null,
        endDate: null
      });

      return await newPlan.save();
    },

    // Update an Ads Plan
    updateAdsPlan: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update ads plans');
      }

      // Recalculate if key fields change
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

    // Delete an Ads Plan
    deleteAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can delete ads plans');
      }
      await AdsPlan.findByIdAndDelete(id);
      return "Ads plan deleted successfully.";
    },

    // Start an ad plan
    startAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can start ads plans');
      }
      return await AdsPlan.findByIdAndUpdate(
        id,
        { status: 'RUNNING', startDate: new Date(), endDate: null },
        { new: true }
      );
    },

    // End an ad plan
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

    // Increment impressions when ad is displayed
    incrementImpressions: async (_, { id }) => {
      const plan = await AdsPlan.findById(id);
      if (!plan) throw new Error('Ad plan not found');

      plan.impressions += 1;
      await plan.save();
      return plan;
    }
  }
};
