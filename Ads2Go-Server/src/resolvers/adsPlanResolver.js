const AdsPlan = require('../models/AdsPlan');

// Helper function to get pricePerPlay rules
const getPricePerPlay = (vehicleType, materialType, override = null) => {
  if (override !== null) return override; // allow SUPERADMIN override

  if (vehicleType === 'CAR') {
    if (materialType === 'LCD') return 3;
    if (materialType === 'HEADDRESS') return 2;
  }
  if (vehicleType === 'MOTORCYCLE') {
    if (materialType === 'LCD') return 1;
  }
  return 1; // default fallback
};

// Helper function to calculate pricing
const calculatePricing = (
  numberOfDevices,
  adLengthSeconds,
  durationDays,
  playsPerDayPerDevice = 160,
  pricePerPlay,
  vehicleType,
  materialType,
  deviceCostOverride = null,
  durationCostOverride = null,
  adLengthCostOverride = null
) => {
  const totalPlaysPerDay = playsPerDayPerDevice * numberOfDevices;
  const dailyRevenue = totalPlaysPerDay * pricePerPlay;

  // --- Device Cost Rules (with override support) ---
  let deviceUnitCost = 0;
  if (deviceCostOverride !== null) {
    deviceUnitCost = deviceCostOverride;
  } else {
    if (vehicleType === 'CAR') {
      if (materialType === 'LCD') deviceUnitCost = 4000;
      else if (materialType === 'HEADDRESS') deviceUnitCost = 1000;
    } else if (vehicleType === 'MOTORCYCLE') {
      if (materialType === 'LCD') deviceUnitCost = 2000;
    }
  }
  const deviceCost = numberOfDevices * deviceUnitCost;

  // --- Ad Length Cost ---
  let adLengthCost;
  if (adLengthCostOverride !== null) {
    adLengthCost = adLengthCostOverride;
  } else {
    adLengthCost = adLengthSeconds === 20 ? 500 :
                   adLengthSeconds === 40 ? 5000 :
                   adLengthSeconds === 60 ? 10000 : 0;
  }

  // --- Duration Cost Rules ---
  const durationMonths = Math.ceil(durationDays / 30);
  let durationCostPerMonth = 0;
  if (durationCostOverride !== null) {
    durationCostPerMonth = durationCostOverride;
  } else {
    if (vehicleType === 'CAR') {
      if (materialType === 'LCD') durationCostPerMonth = 2000;
      else if (materialType === 'HEADDRESS') durationCostPerMonth = 1500;
    } else if (vehicleType === 'MOTORCYCLE') {
      if (materialType === 'LCD') durationCostPerMonth = 1000;
    }
  }
  const durationCost = durationMonths * durationCostPerMonth;

  // --- Total Price ---
  const totalForPlay = totalPlaysPerDay * pricePerPlay * durationDays;
  const totalPrice = totalForPlay + deviceCost + durationCost + adLengthCost;

  return {
    totalPlaysPerDay,
    dailyRevenue,
    totalPrice
  };
};

module.exports = {
  Query: {
    getAllAdsPlans: async () => {
      return await AdsPlan.find().sort({ createdAt: -1 });
    },

    getAdsPlanById: async (_, { id }) => {
      return await AdsPlan.findById(id);
    },

    getAdsPlansByFilter: async (
      _,
      { category, materialType, vehicleType, numberOfDevices, status }
    ) => {
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

      const playsPerDayPerDevice = input.playsPerDayPerDevice || 160;
      const vehicleType = input.vehicleType.toUpperCase();
      const materialType = input.materialType.toUpperCase();

      // ✅ Get pricePerPlay automatically (with override)
      const pricePerPlay = getPricePerPlay(
        vehicleType,
        materialType,
        input.pricePerPlay ?? null
      );

      // Calculate pricing
      const pricing = calculatePricing(
        input.numberOfDevices,
        input.adLengthSeconds,
        input.durationDays,
        playsPerDayPerDevice,
        pricePerPlay,
        vehicleType,
        materialType,
        input.deviceCostOverride ?? null,
        input.durationCostOverride ?? null,
        input.adLengthCostOverride ?? null
      );

      const newPlan = new AdsPlan({
        name: input.name,
        description: input.description,
        durationDays: input.durationDays,
        category: input.category,
        materialType: materialType,
        vehicleType: vehicleType,
        numberOfDevices: input.numberOfDevices,
        adLengthSeconds: input.adLengthSeconds,
        playsPerDayPerDevice: playsPerDayPerDevice,
        pricePerPlay: pricePerPlay,
        totalPlaysPerDay: pricing.totalPlaysPerDay,
        dailyRevenue: pricing.dailyRevenue,
        totalPrice: pricing.totalPrice,
        status: 'PENDING',
        startDate: null,
        endDate: null,
      });

      return await newPlan.save();
    },

    updateAdsPlan: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can update ads plans');
      }

      const existingPlan = await AdsPlan.findById(id);
      if (!existingPlan) {
        throw new Error('Ads plan not found');
      }

      const numberOfDevices = input.numberOfDevices ?? existingPlan.numberOfDevices;
      const adLengthSeconds = input.adLengthSeconds ?? existingPlan.adLengthSeconds;
      const durationDays = input.durationDays ?? existingPlan.durationDays;
      const playsPerDayPerDevice = input.playsPerDayPerDevice ?? existingPlan.playsPerDayPerDevice;
      const vehicleType = (input.vehicleType || existingPlan.vehicleType).toUpperCase();
      const materialType = (input.materialType || existingPlan.materialType).toUpperCase();

      // ✅ Recalculate pricePerPlay with new rule (unless overridden)
      const pricePerPlay = getPricePerPlay(
        vehicleType,
        materialType,
        input.pricePerPlay ?? existingPlan.pricePerPlay
      );

      // Recalculate pricing
      const pricing = calculatePricing(
        numberOfDevices,
        adLengthSeconds,
        durationDays,
        playsPerDayPerDevice,
        pricePerPlay,
        vehicleType,
        materialType,
        input.deviceCostOverride ?? null,
        input.durationCostOverride ?? null,
        input.adLengthCostOverride ?? null
      );

      input.pricePerPlay = pricePerPlay;
      input.totalPlaysPerDay = pricing.totalPlaysPerDay;
      input.dailyRevenue = pricing.dailyRevenue;
      input.totalPrice = pricing.totalPrice;

      return await AdsPlan.findByIdAndUpdate(id, input, { new: true });
    },

    deleteAdsPlan: async (_, { id }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can delete ads plans');
      }
      await AdsPlan.findByIdAndDelete(id);
      return 'Ads plan deleted successfully.';
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
  },
};
