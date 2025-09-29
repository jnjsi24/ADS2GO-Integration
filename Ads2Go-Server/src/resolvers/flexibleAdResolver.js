const Ad = require('../models/Ad');
const PricingConfig = require('../models/PricingConfig');
const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');

// Helper function to check authentication
const checkAuth = (user) => {
  if (!user) {
    throw new Error('Authentication required');
  }
};

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
    // Get available field combinations for ad creation
    getFlexibleFieldCombinations: async (_, __, { user }) => {
      checkAuth(user);
      return await PricingConfig.find({ isActive: true }).sort({ materialType: 1, vehicleType: 1, category: 1 });
    },

    // Calculate pricing for flexible ad creation
    calculateFlexiblePricing: async (_, { materialType, vehicleType, category, durationDays, adLengthSeconds, numberOfDevices }, { user }) => {
      // This can be called by both superadmin and regular users for pricing calculations

      // Generate default time range for availability calculation (next 30 days)
      const startTime = new Date();
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + durationDays);

      // Get pricing configuration
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

      // Get available materials to calculate available slots
      const materials = await getMaterialsSortedByAvailability(materialType, vehicleType, category, startTime, endTime);
      
      // Calculate actual available devices (not slots)
      let availableDevices = 0;
      for (const material of materials) {
        const availability = await MaterialAvailability.findOne({ materialId: material._id });
        if (availability) {
          // Count devices that have at least one available slot
          if (availability.availableSlots > 0) {
            availableDevices += 1;
          }
        } else {
          // If no availability record, assume material is fully available
          availableDevices += 1;
        }
      }

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
        availableDevices: availableDevices, // Count of devices with available slots
        minAdLengthSeconds: pricingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: pricingConfig.maxAdLengthSeconds
      };
    }
  },

  Mutation: {
    // Create ad with flexible configuration
    createFlexibleAd: async (_, { input }, { user }) => {
      checkAuth(user);

      const {
        title,
        description,
        website,
        materialType,
        vehicleType,
        category,
        durationDays,
        adLengthSeconds,
        numberOfDevices,
        adType,
        adFormat,
        status,
        startTime,
        endTime,
        mediaFile,
        price
      } = input;

      // Get pricing configuration
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
      
      // Use provided price if available, otherwise use calculated price
      const finalPrice = price || pricing.totalPrice;

      // Use smart material selection for multiple devices
      let selectedMaterials = [];
      
      try {
        console.log(`🧠 Using smart material selection for ${numberOfDevices} devices...`);
        const sortedMaterials = await getMaterialsSortedByAvailability(
          materialType,
          vehicleType,
          category,
          new Date(startTime),
          new Date(endTime)
        );
        
        if (sortedMaterials.length === 0) {
          throw new Error('No compatible materials found for this configuration');
        }

        // Select materials for the requested number of devices
        let devicesSelected = 0;
        for (const material of sortedMaterials) {
          if (devicesSelected >= numberOfDevices) break;
          
          const availability = await MaterialAvailability.findOne({ materialId: material._id });
          if (availability && availability.canAcceptAd(new Date(startTime), new Date(endTime))) {
            selectedMaterials.push(material);
            devicesSelected++;
            console.log(`🎯 Selected device ${devicesSelected}/${numberOfDevices}: ${material.materialId} (${material.materialType} ${material.vehicleType}) - ${availability.occupiedSlots}/${availability.totalSlots} slots used`);
          }
        }
        
        // Check if we have enough devices
        if (selectedMaterials.length < numberOfDevices) {
          throw new Error(`Only ${selectedMaterials.length} devices available, but ${numberOfDevices} requested`);
        }
      } catch (error) {
        console.error('❌ Smart material selection failed:', error.message);
        throw new Error('No compatible materials found for this configuration');
      }

      // Create a single ad that handles multiple devices
      const ad = new Ad({
        title,
        description,
        website: website || null,
        materialId: selectedMaterials[0]._id, // Primary device (first selected)
        targetDevices: selectedMaterials.map(m => m._id), // All target devices
        planId: null, // No plan for flexible ads
        adType,
        adFormat,
        price: finalPrice,
        durationDays,
        numberOfDevices, // This is the key - store the number of devices in the ad
        adLengthSeconds,
        playsPerDayPerDevice: pricing.playsPerDayPerDevice,
        totalPlaysPerDay: pricing.totalPlaysPerDay, // Total plays across all devices
        pricePerPlay,
        totalPrice: finalPrice,
        status: 'PENDING',
        adStatus: 'ACTIVE',
        paymentStatus: 'PENDING',
        impressions: 0,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        mediaFile,
        userId: user.id,
        materialType,
        vehicleType,
        category
      });

      const savedAd = await ad.save();

      // Reserve slots for all target devices (regardless of payment status)
      // This must be done outside of any transaction to ensure it executes
      try {
        for (const material of selectedMaterials) {
          let availability = await MaterialAvailability.findOne({ materialId: material._id });
          if (!availability) {
            availability = new MaterialAvailability({ 
              materialId: material._id, 
              totalSlots: 5 
            });
          }

          // Check if slots are still available (double-check for race conditions)
          if (!availability.canAcceptAd(savedAd.startTime, savedAd.endTime)) {
            // If slots are not available, delete the ad and throw error
            await Ad.findByIdAndDelete(savedAd._id);
            throw new Error(`Slots no longer available for device ${material.materialId}. Another user may have reserved them.`);
          }

          // Add this ad to the material's current ads (reserve the slot)
          availability.currentAds = availability.currentAds || [];
          availability.currentAds.push({
            adId: savedAd._id,
            startTime: savedAd.startTime,
            endTime: savedAd.endTime,
            slotNumber: availability.currentAds.length + 1
          });

          availability.occupiedSlots = availability.currentAds.length;
          availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
          availability.updateAvailabilityDates();
          await availability.save();

          console.log(`✅ Reserved slot for ad: ${material.materialId} - ${availability.occupiedSlots}/${availability.totalSlots} slots used`);
        }
      } catch (availabilityError) {
        console.error('❌ Error reserving slots:', availabilityError);
        // If slot reservation fails, delete the ad to maintain consistency
        try {
          await Ad.findByIdAndDelete(savedAd._id);
        } catch (deleteError) {
          console.error('❌ Error deleting ad after slot reservation failure:', deleteError);
        }
        throw new Error(`Failed to reserve slots: ${availabilityError.message}`);
      }

      console.log(`✅ Flexible ad created successfully: ${savedAd.title} for ${numberOfDevices} devices (${savedAd._id})`);
      return savedAd;
    }
  }
};
