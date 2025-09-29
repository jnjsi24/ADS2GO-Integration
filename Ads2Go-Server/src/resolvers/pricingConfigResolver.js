const PricingConfig = require('../models/PricingConfig');

// Helper function to calculate plays per day
const calculatePlaysPerDay = (adLengthSeconds, screenHoursPerDay = 8) => {
  const screenSecondsPerDay = screenHoursPerDay * 60 * 60; // 8 hours = 28,800 seconds
  return Math.floor(screenSecondsPerDay / adLengthSeconds);
};

// Helper function to calculate pricing
const calculatePricing = (pricePerPlay, adLengthSeconds, numberOfDevices, durationDays) => {
  const playsPerDayPerDevice = calculatePlaysPerDay(adLengthSeconds);
  const totalPlaysPerDay = playsPerDayPerDevice * numberOfDevices;
  const dailyRevenue = totalPlaysPerDay * pricePerPlay;
  const totalPrice = dailyRevenue * durationDays;

  return {
    playsPerDayPerDevice,
    totalPlaysPerDay,
    dailyRevenue,
    totalPrice
  };
};

module.exports = {
  Query: {
    getAllPricingConfigs: async (_, __, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can view pricing configurations');
      }
      return await PricingConfig.find({}).sort({ materialType: 1, vehicleType: 1, category: 1 });
    },

    getPricingConfigById: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can view pricing configurations');
      }
      return await PricingConfig.findById(id);
    },

    getPricingConfig: async (_, { materialType, vehicleType, category }, { user }) => {
      // This can be called by both superadmin and regular users for pricing calculations
      return await PricingConfig.findPricingConfig(materialType, vehicleType, category);
    },

    calculatePricingConfig: async (_, { materialType, vehicleType, category, durationDays, adLengthSeconds, numberOfDevices }, { user }) => {
      // This can be called by both superadmin and regular users
      const pricingConfig = await PricingConfig.findPricingConfig(materialType, vehicleType, category);
      
      if (!pricingConfig) {
        throw new Error(`No pricing configuration found for ${materialType} ${vehicleType} ${category}`);
      }

      // Validate ad length - only allow 20, 40, or 60 seconds
      const allowedAdLengths = [20, 40, 60];
      if (!allowedAdLengths.includes(adLengthSeconds)) {
        throw new Error('Ad length must be 20, 40, or 60 seconds');
      }

      // Validate duration - only allow 1-6 months (30-180 days)
      const allowedDurations = [30, 60, 90, 120, 150, 180];
      if (!allowedDurations.includes(durationDays)) {
        throw new Error('Duration must be 1-6 months (30-180 days)');
      }

      // Validate number of devices
      if (numberOfDevices > pricingConfig.maxDevices) {
        throw new Error(`Maximum ${pricingConfig.maxDevices} devices allowed for this combination`);
      }

      // Get price for duration
      const pricePerPlay = pricingConfig.getPriceWithAdLength(durationDays, adLengthSeconds);
      
      // Calculate pricing
      const pricing = calculatePricing(pricePerPlay, adLengthSeconds, numberOfDevices, durationDays);

      return {
        materialType: pricingConfig.materialType,
        vehicleType: pricingConfig.vehicleType,
        category: pricingConfig.category,
        durationDays,
        adLengthSeconds,
        numberOfDevices,
        pricePerPlay,
        playsPerDayPerDevice: pricing.playsPerDayPerDevice,
        totalPlaysPerDay: pricing.totalPlaysPerDay,
        dailyRevenue: pricing.dailyRevenue,
        totalPrice: pricing.totalPrice,
        maxDevices: pricingConfig.maxDevices,
        minAdLengthSeconds: pricingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: pricingConfig.maxAdLengthSeconds
      };
    }
  },

  Mutation: {
    createPricingConfig: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create pricing configurations');
      }

      // Check if combination already exists
      const existing = await PricingConfig.findPricingConfig(input.materialType, input.vehicleType, input.category);
      if (existing) {
        throw new Error('Pricing configuration already exists for this combination');
      }

      // Validate pricing tiers
      if (!input.pricingTiers || input.pricingTiers.length === 0) {
        throw new Error('At least one pricing tier is required');
      }

      // Sort tiers by duration
      input.pricingTiers.sort((a, b) => a.durationDays - b.durationDays);

      const newConfig = new PricingConfig({
        ...input,
        materialType: input.materialType.toUpperCase(),
        vehicleType: input.vehicleType.toUpperCase(),
        category: input.category.toUpperCase(),
        createdBy: user.id
      });

      return await newConfig.save();
    },

    updatePricingConfig: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update pricing configurations');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      // If updating pricing tiers, sort them
      if (input.pricingTiers) {
        input.pricingTiers.sort((a, b) => a.durationDays - b.durationDays);
      }

      return await PricingConfig.findByIdAndUpdate(id, input, { new: true });
    },

    deletePricingConfig: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can delete pricing configurations');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      await PricingConfig.findByIdAndDelete(id);
      return 'Pricing configuration deleted successfully';
    },

    togglePricingConfigStatus: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can toggle pricing configuration status');
      }

      const existing = await PricingConfig.findById(id);
      if (!existing) {
        throw new Error('Pricing configuration not found');
      }

      existing.isActive = !existing.isActive;
      return await existing.save();
    }
  }
};

