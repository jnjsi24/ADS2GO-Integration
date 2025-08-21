// AdsPlanResolver.js

const AdsPlan = require('../models/AdsPlan');

// Helper function to calculate pricing in Philippine Pesos
const calculatePricing = (
  numberOfDevices,
  adLengthSeconds,
  durationDays,
  playsPerDayPerDevice = 160,
  pricePerPlay = 1,
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
    deviceUnitCost = deviceCostOverride; // use override if provided
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
                   adLengthSeconds === 40 ? 1000 :
                   adLengthSeconds === 60 ? 1500 : 0;
  }

  // --- Duration Cost Rules (with override support) ---
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
      const pricePerPlay = input.pricePerPlay || 1;

      // Calculate pricing (with override support)
      const pricing = calculatePricing(
        input.numberOfDevices,
        input.adLengthSeconds,
        input.durationDays,
        playsPerDayPerDevice,
        pricePerPlay,
        input.vehicleType.toUpperCase(),
        input.materialType.toUpperCase(),
        input.deviceCostOverride ?? null,
        input.durationCostOverride ?? null,
        input.adLengthCostOverride ?? null,

        
      );

      const newPlan = new AdsPlan({
        name: input.name,
        description: input.description,
        durationDays: input.durationDays,
        category: input.category,
        materialType: input.materialType,
        vehicleType: input.vehicleType,
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

      const numberOfDevices =
        input.numberOfDevices ?? existingPlan.numberOfDevices;
      const adLengthSeconds =
        input.adLengthSeconds ?? existingPlan.adLengthSeconds;
      const durationDays = input.durationDays ?? existingPlan.durationDays;
      const playsPerDayPerDevice =
        input.playsPerDayPerDevice ?? existingPlan.playsPerDayPerDevice;
      const pricePerPlay = input.pricePerPlay ?? existingPlan.pricePerPlay;
      const vehicleType = (
        input.vehicleType || existingPlan.vehicleType
      ).toUpperCase();
      const materialType = (
        input.materialType || existingPlan.materialType
      ).toUpperCase();

      // Recalculate pricing if key fields change
      if (
        input.numberOfDevices ||
        input.adLengthSeconds ||
        input.durationDays ||
        input.playsPerDayPerDevice ||
        input.pricePerPlay ||
        input.vehicleType ||
        input.materialType ||
        input.deviceCostOverride ||
        input.durationCostOverride
      ) {
        const pricing = calculatePricing(
          numberOfDevices,
          adLengthSeconds,
          durationDays,
          playsPerDayPerDevice,
          pricePerPlay,
          vehicleType,
          materialType,
          input.deviceCostOverride ?? null,
          input.durationCostOverride ?? null
        );

        input.totalPlaysPerDay = pricing.totalPlaysPerDay;
        input.dailyRevenue = pricing.dailyRevenue;
        input.totalPrice = pricing.totalPrice;
      }

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
