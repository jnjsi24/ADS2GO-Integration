const AdsPlan = require('../models/AdsPlan');
const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const MaterialAvailabilityService = require('../services/materialAvailabilityService');
const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');

// Helper function to get pricePerPlay - super admin must provide this
const getPricePerPlay = (pricePerPlay) => {
  if (pricePerPlay === null || pricePerPlay === undefined) {
    throw new Error('pricePerPlay is required - super admin must set the price per play');
  }
  if (pricePerPlay <= 0) {
    throw new Error('pricePerPlay must be greater than 0');
  }
  return pricePerPlay;
};

// Helper function to calculate plays per day based on screen hours and ad slots
const calculatePlaysPerDay = (adLengthSeconds, screenHoursPerDay = 8, adSlotsPerDevice = 5) => {
  // Convert screen hours to seconds
  const screenSecondsPerDay = screenHoursPerDay * 60 * 60; // 8 hours = 28,800 seconds
  
  // Calculate how many times each ad slot can play in a day
  // Each slot plays DIFFERENT ads, so we calculate per slot, not total
  const playsPerSlotPerDay = Math.floor(screenSecondsPerDay / adLengthSeconds);
  
  // Each ad gets played in ONE slot, so plays per device = plays per slot
  // (not multiplied by number of slots since each slot has different ads)
  const playsPerDevicePerDay = playsPerSlotPerDay;
  
  console.log(`📊 Play Calculation: ${screenHoursPerDay}h screen ÷ ${adLengthSeconds}s ads = ${playsPerDevicePerDay} plays/ad/day (each of ${adSlotsPerDevice} slots plays different ads)`);
  
  return playsPerDevicePerDay;
};

// Helper function to calculate pricing (simplified - no overrides needed)
const calculatePricing = (
  numberOfDevices,
  adLengthSeconds,
  durationDays,
  playsPerDayPerDevice = null, // Will be calculated if not provided
  pricePerPlay // Now mandatory
) => {
  // Calculate plays per day if not provided
  const calculatedPlaysPerDay = playsPerDayPerDevice || calculatePlaysPerDay(adLengthSeconds);
  const totalPlaysPerDay = calculatedPlaysPerDay * numberOfDevices;
  const dailyRevenue = totalPlaysPerDay * pricePerPlay;

  // --- Total Price (simplified) ---
  const totalPrice = dailyRevenue * durationDays;

  return {
    totalPlaysPerDay,
    dailyRevenue,
    totalPrice
  };
};


module.exports = {

  Mutation: {
    createAdsPlan: async (_, { input }, { user }) => {
      if (!user || user.role !== 'SUPERADMIN') {
        throw new Error('Unauthorized: Only SUPERADMIN can create ads plans');
      }

      const vehicleType = input.vehicleType.toUpperCase();
      const materialType = input.materialType.toUpperCase();

      // ✅ Get pricePerPlay - super admin must provide this
      if (!input.pricePerPlay) {
        throw new Error('pricePerPlay is required - super admin must set the price per play for this plan');
      }
      const pricePerPlay = getPricePerPlay(input.pricePerPlay);

      // Calculate plays per day based on screen hours and ad slots
      const playsPerDayPerDevice = calculatePlaysPerDay(input.adLengthSeconds);
      console.log(`🎯 Plan: ${input.name} - ${playsPerDayPerDevice} plays/device/day (${input.adLengthSeconds}s ads, 8h screen, 5 slots)`);

      // Calculate pricing
      const pricing = calculatePricing(
        input.numberOfDevices,
        input.adLengthSeconds,
        input.durationDays,
        playsPerDayPerDevice,
        pricePerPlay
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
        status: input.status || 'PENDING',
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      });

      const savedPlan = await newPlan.save();

      // Automatically assign compatible materials to the plan (sorted by slot availability)
      try {
        console.log(`🔗 Auto-assigning materials to plan: ${savedPlan.name}`);
        
        // Get materials sorted by slot availability (most available first)
        const compatibleMaterials = await getMaterialsSortedByAvailability(
          materialType,
          vehicleType,
          input.category
        );
        
        console.log(`📋 Found ${compatibleMaterials.length} compatible materials for plan: ${savedPlan.name}`);
        
        if (compatibleMaterials.length > 0) {
          // Take up to 3 materials, already sorted by availability
          const materialsToAssign = compatibleMaterials.slice(0, 3);
          savedPlan.materials = materialsToAssign.map(m => m._id);
          await savedPlan.save();
          
          console.log(`✅ Assigned ${materialsToAssign.length} materials to plan: ${savedPlan.name}`);
          console.log(`📦 Materials (sorted by availability): ${materialsToAssign.map(m => m.materialId).join(', ')}`);
        } else {
          console.log(`⚠️ No compatible materials found for plan: ${savedPlan.name}`);
          console.log(`🔍 Looking for: ${materialType} ${vehicleType} ${input.category}`);
        }
      } catch (materialAssignmentError) {
        console.error(`❌ Error auto-assigning materials to plan:`, materialAssignmentError);
        // Don't throw error - material assignment is helpful but shouldn't break plan creation
        console.log(`⚠️ Plan created but material assignment failed. Run fix script to assign materials.`);
      }

      return savedPlan;
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
      const vehicleType = (input.vehicleType || existingPlan.vehicleType).toUpperCase();
      const materialType = (input.materialType || existingPlan.materialType).toUpperCase();

      // ✅ Get pricePerPlay - super admin must provide this
      const newPricePerPlay = input.pricePerPlay ?? existingPlan.pricePerPlay;
      if (!newPricePerPlay) {
        throw new Error('pricePerPlay is required - super admin must set the price per play for this plan');
      }
      const pricePerPlay = getPricePerPlay(newPricePerPlay);

      // Calculate plays per day based on screen hours and ad slots
      const playsPerDayPerDevice = calculatePlaysPerDay(adLengthSeconds);
      console.log(`🎯 Plan Update: ${existingPlan.name} - ${playsPerDayPerDevice} plays/device/day (${adLengthSeconds}s ads, 8h screen, 5 slots)`);

      // Recalculate pricing
      const pricing = calculatePricing(
        numberOfDevices,
        adLengthSeconds,
        durationDays,
        playsPerDayPerDevice,
        pricePerPlay
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

  Query: {
    getAllAdsPlans: async () => {
      return await AdsPlan.find().populate('materials').sort({ createdAt: -1 });
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

    getPlanAvailability: async (_, { planId, desiredStartDate }, { user }) => {
      if (!user) {
        throw new Error('Authentication required');
      }
      
      try {
        const availability = await MaterialAvailabilityService.validatePlanAvailability(
          planId, 
          desiredStartDate
        );
        
        return {
          canCreate: availability.canCreate,
          plan: availability.plan,
          materialAvailabilities: availability.materialAvailabilities,
          totalAvailableSlots: availability.totalAvailableSlots,
          availableMaterialsCount: availability.availableMaterialsCount,
          nextAvailableDate: availability.nextAvailableDate ? 
            new Date(availability.nextAvailableDate).toISOString() : null
        };
      } catch (error) {
        throw new Error(`Error checking plan availability: ${error.message}`);
      }
    },

    getMaterialsAvailability: async (_, { materialIds }, { user }) => {
      if (!user) {
        throw new Error('Authentication required');
      }
      
      try {
        return await MaterialAvailabilityService.getMaterialsAvailability(materialIds);
      } catch (error) {
        throw new Error(`Error getting materials availability: ${error.message}`);
      }
    },

    getSmartMaterialSelection: async (_, { materialType, vehicleType, category, timestamp, requestId }, { user }) => {
      if (!user) {
        throw new Error('Authentication required');
      }
      
      console.log(`🧠 [getSmartMaterialSelection] Request for: ${materialType} ${vehicleType} ${category} (timestamp: ${timestamp}, requestId: ${requestId})`);
      
      try {
        // Get materials sorted by smart selection logic
        const sortedMaterials = await getMaterialsSortedByAvailability(materialType, vehicleType, category);
        
        // Return the first material (highest priority) with slot information
        if (sortedMaterials.length > 0) {
          const selectedMaterial = sortedMaterials[0];
          const availability = await MaterialAvailability.findOne({ materialId: selectedMaterial._id });
          
          const result = {
            id: selectedMaterial._id,
            materialId: selectedMaterial.materialId,
            materialType: selectedMaterial.materialType,
            vehicleType: selectedMaterial.vehicleType,
            category: selectedMaterial.category,
            occupiedSlots: availability ? availability.occupiedSlots : 0,
            availableSlots: availability ? availability.availableSlots : 5,
            totalSlots: availability ? availability.totalSlots : 5,
            priority: 1
          };
          
          console.log(`🎯 [getSmartMaterialSelection] Returning: ${result.materialId} (${result.occupiedSlots}/${result.totalSlots} slots)`);
          return result;
        }
        
        return null;
      } catch (error) {
        throw new Error(`Error getting smart material selection: ${error.message}`);
      }
    },

    getAvailabilitySummary: async (_, __, { user }) => {
      if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required');
      }
      
      try {
        const summary = await MaterialAvailabilityService.getAvailabilitySummary();
        return JSON.stringify(summary);
      } catch (error) {
        throw new Error(`Error getting availability summary: ${error.message}`);
      }
    },
  },
};

