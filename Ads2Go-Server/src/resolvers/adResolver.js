const Ad = require('../models/Ad');
const User = require('../models/User');
const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const PricingConfig = require('../models/PricingConfig');
const GlobalPricingMultipliers = require('../models/GlobalPricingMultipliers');
const AdsDeployment = require('../models/adsDeployment');
const Analytics = require('../models/analytics');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const adDeploymentService = require('../services/adDeploymentService');
const MaterialAvailabilityService = require('../services/materialAvailabilityService');
const NotificationService = require('../services/notifications/NotificationService');
const { deleteFromFirebase } = require('../utils/firebaseStorage');
const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');

/**
 * Helper function to safely convert any date value to ISO string
 * Handles: Date objects, timestamps (number/string), and ISO strings
 */
function toISOString(value) {
  if (!value) return null;
  
  // If already a Date object, convert to ISO
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's a number or numeric string (timestamp), convert to Date first
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    return new Date(timestamp).toISOString();
  }
  
  // If it's already an ISO string, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  
  // Fallback: try to create a Date and convert
  try {
    return new Date(value).toISOString();
  } catch (error) {
    console.error('❌ Failed to convert date:', value, error);
    return null;
  }
}

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

const adResolvers = {
  Query: {
    getAllAds: async (_, { includeArchived = false }, { user }) => {
      checkAdmin(user);
      // ✅ Exclude archived by default - only include if explicitly requested
      const query = {};
      if (!includeArchived) {
        query.isArchived = { $ne: true };
        query.status = { $nin: ['ARCHIVED'] }; // Also exclude ARCHIVED status
      }
      const ads = await Ad.find(query)
        .populate('userId')
        .populate('driverId')
        .populate('materialId');
      
      // Convert to plain objects and format dates
      const plainAds = ads.map(ad => {
        const obj = ad.toObject();
        obj.id = ad._id.toString();
        
        // Format date fields
        obj.createdAt = toISOString(obj.createdAt);
        obj.updatedAt = toISOString(obj.updatedAt);
        obj.startTime = toISOString(obj.startTime);
        obj.endTime = toISOString(obj.endTime);
        obj.userDesiredStartTime = toISOString(obj.userDesiredStartTime);
        obj.approveTime = toISOString(obj.approveTime);
        obj.rejectTime = toISOString(obj.rejectTime);
        obj.reservationExpires = toISOString(obj.reservationExpires);
        obj.lastDeploymentAttempt = toISOString(obj.lastDeploymentAttempt);
        obj.archivedAt = toISOString(obj.archivedAt);
        obj.scheduledDeletionDate = toISOString(obj.scheduledDeletionDate);
        
        return obj;
      });
      
      return plainAds;
    },

    getAdsByUser: async (_, { userId }, { user }) => {
      checkAdmin(user);
      // ✅ Exclude archived ads - they should be treated as deleted
      return await Ad.find({ 
        userId,
        isArchived: { $ne: true },
        status: { $nin: ['ARCHIVED'] }
      })
        .populate('materialId')
    },

    getMyAds: async (_, __, { user }) => {
      checkAuth(user);
      // ✅ Exclude archived ads - they should be treated as deleted
      return await Ad.find({ 
        userId: user.id,
        isArchived: { $ne: true },
        status: { $nin: ['ARCHIVED'] }
      })
        .populate('materialId')
    },

    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);

      // Only admins can view any ad
      if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Not authorized to view ads');
      }

      const ad = await Ad.findById(id)
        .populate('materialId')
        .populate('userId');

      if (!ad) throw new Error('Ad not found');
      
      // ✅ Check if ad is archived - treat as deleted
      if (ad.isArchived || ad.status === 'ARCHIVED') {
        throw new Error('This ad has been archived and is no longer accessible');
      }
      
      return ad;
    },

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

      console.log(`💰 [calculateFlexiblePricing] Calculating pricing for: ${materialType} ${vehicleType} ${category}, Duration: ${durationDays} days, Ad Length: ${adLengthSeconds}s, Devices: ${numberOfDevices}`);

      // Get pricing configuration
      const pricingConfig = await PricingConfig.findPricingConfig(materialType, vehicleType, category);
      if (!pricingConfig) {
        console.log(`❌ [calculateFlexiblePricing] No pricing config found for ${materialType} ${vehicleType} ${category}`);
        throw new Error(`No pricing configuration found for ${materialType} ${vehicleType} ${category}`);
      }
      console.log(`✅ [calculateFlexiblePricing] Pricing config found`);

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

      // Validate number of devices (must be at least 1)
      if (numberOfDevices < 1) {
        throw new Error('Number of devices must be at least 1');
      }

      // Calculate duration in months
      const durationMonths = durationDays / 30;
      
      // Get global pricing multipliers
      console.log(`💵 [calculateFlexiblePricing] Getting global pricing multipliers...`);
      const multipliers = await GlobalPricingMultipliers.getMultipliers();
      
      // Convert to plain object if needed
      const multipliersObj = multipliers.toObject ? multipliers.toObject() : multipliers;
      
      // Get ad length multiplier from global multipliers
      const adLengthMultiplier = multipliersObj.adLengthMultipliers?.[adLengthSeconds.toString()] || 
        (adLengthSeconds === 20 ? 1.0 : adLengthSeconds === 40 ? 2.0 : 3.0);
      
      // Get duration discount multiplier (round to nearest integer for lookup)
      const durationMonthsKey = Math.round(durationMonths).toString();
      const durationDiscountMultiplier = multipliersObj.durationDiscountMultipliers?.[durationMonthsKey] || 1.0;
      
      console.log(`💵 [calculateFlexiblePricing] Multipliers: adLength=${adLengthMultiplier}, durationDiscount=${durationDiscountMultiplier}`);
      
      // Calculate subtotal: Base Price × Ad Length Multiplier × Duration (months) × Number of Devices
      const subtotal = pricingConfig.basePrice * adLengthMultiplier * durationMonths * numberOfDevices;
      
      // Calculate discount amount
      const discount = subtotal * (1 - durationDiscountMultiplier);
      
      // Calculate total price: Subtotal × Duration Discount Multiplier
      const totalPrice = subtotal * durationDiscountMultiplier;
      
      console.log(`💰 [calculateFlexiblePricing] Pricing breakdown:`, { 
        basePrice: pricingConfig.basePrice,
        adLengthMultiplier,
        durationMonths,
        numberOfDevices,
        durationDiscountMultiplier,
        subtotal,
        discount,
        totalPrice
      });

      // Get available materials to calculate available slots
      // This function already filters for: available slots, driver assigned, mounted, device connected, not dismounted, time conflicts
      console.log(`🔍 [calculateFlexiblePricing] Getting available materials...`);
      const materials = await getMaterialsSortedByAvailability(materialType, vehicleType, category, startTime, endTime);
      console.log(`📊 [calculateFlexiblePricing] Found ${materials.length} available materials`);
      
      // Calculate actual available devices (not slots)
      let availableDevices = 0;
      let devicesWithDriver = 0;
      let devicesMounted = 0;
      
      for (const material of materials) {
        // All materials returned from getMaterialsSortedByAvailability have already passed ALL checks:
        // 1. Have available slots
        // 2. Have driver assigned
        // 3. Are physically mounted
        // 4. Have connected device (validateMaterialHasDevice passed)
        // 5. Are not dismounted
        // 6. Have no time conflicts
        
        // Count devices with driver assigned
        if (material.driverId) {
          devicesWithDriver += 1;
        }
        
        // Count devices that are physically mounted
        if (material.mountedAt) {
          devicesMounted += 1;
        }
        
        // Count as available (already validated by getMaterialsSortedByAvailability)
        availableDevices += 1;
      }

      console.log(`✅ [calculateFlexiblePricing] Returning: ${availableDevices} available devices, ${devicesWithDriver} with driver, ${devicesMounted} mounted`);

      return {
        materialType: pricingConfig.materialType,
        vehicleType: pricingConfig.vehicleType,
        category: pricingConfig.category,
        durationDays,
        durationMonths,
        adLengthSeconds,
        numberOfDevices,
        basePrice: pricingConfig.basePrice,
        adLengthMultiplier,
        durationDiscountMultiplier,
        subtotal,
        discount,
        totalPrice,
        availableDevices: availableDevices, // Count of devices that meet ALL requirements
        devicesWithDriver: devicesWithDriver, // Count of devices with driver assigned
        devicesMounted: devicesMounted, // Count of devices that are physically mounted
        minAdLengthSeconds: pricingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: pricingConfig.maxAdLengthSeconds
      };
    }
  },

  Mutation: {
    // Create ad with flexible configuration (replaces unused createAd mutation)
    createFlexibleAd: async (_, { input }, { user }) => {
      checkAuth(user);

      const dbUser = await User.findById(user.id);
      if (!dbUser) throw new Error('User not found');
      if (!dbUser.isEmailVerified && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Please verify your email before creating an advertisement');
      }

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

      // ✅ TRUST FRONTEND VALIDATION: Frontend already validates video duration with HTML5 video element
      // Backend re-detection often fails with Firebase URLs, causing false errors
      // The frontend auto-selects the correct ad length based on detected video duration
      console.log(`✅ Using user-selected ad length: ${adLengthSeconds}s (frontend-validated)`);
      
      // Set actualVideoDuration to match the selected length (frontend already validated this)
      let actualVideoDuration = adLengthSeconds;

      // Validate duration - only allow 1-6 months (30-180 days)
      const allowedDurations = [30, 60, 90, 120, 150, 180];
      if (!allowedDurations.includes(durationDays)) {
        throw new Error('Duration must be 1-6 months (30-180 days)');
      }

      // Validate number of devices (must be at least 1)
      if (numberOfDevices < 1) {
        throw new Error('Number of devices must be at least 1');
      }

      // Note: maxDevices removed - constraint is now based on available materials, not pricing config
      // Convert duration days to months
      const durationMonths = durationDays / 30;
      
      // Calculate total price with duration discount using the proper method
      console.log(`💵 [createFlexibleAd] Calculating total price with discounts...`);
      const totalPriceCalculation = await pricingConfig.calculateTotalPrice(adLengthSeconds, durationMonths, numberOfDevices);
      console.log(`💵 [createFlexibleAd] Total price calculation:`, totalPriceCalculation);
      
      // Now derive price per play from the total price (for display purposes)
      const pricing = calculatePricing(0, actualVideoDuration, numberOfDevices, durationDays); // This just calculates plays, not price
      const pricePerPlay = totalPriceCalculation.totalPrice / (pricing.totalPlaysPerDay * durationDays);
      
      // Update pricing with the actual calculated values
      pricing.dailyRevenue = totalPriceCalculation.totalPrice / durationDays;
      pricing.totalPrice = totalPriceCalculation.totalPrice;
      
      // Use provided price if available, otherwise use calculated price (with discount applied)
      const finalPrice = price || pricing.totalPrice;
      
      console.log(`💰 [createFlexibleAd] Final pricing:`, { 
        pricePerPlay: pricePerPlay,
        dailyRevenue: pricing.dailyRevenue,
        totalPrice: pricing.totalPrice,
        discount: totalPriceCalculation.discount
      });

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
          throw new Error('No compatible materials found for this configuration. All materials are either full, not mounted, or have no driver assigned.');
        }
        
        // ✅ NEW: Check if we have enough materials BEFORE trying to select
        if (sortedMaterials.length < numberOfDevices) {
          throw new Error(`Only ${sortedMaterials.length} device${sortedMaterials.length === 1 ? '' : 's'} available, but you requested ${numberOfDevices}. Please reduce the number of devices or wait for more slots to become available.`);
        }

        // Select materials for the requested number of devices
        let devicesSelected = 0;
        for (const material of sortedMaterials) {
          if (devicesSelected >= numberOfDevices) break;
          
          // Additional validation: ensure material has driver and is mounted
          if (!material.driverId) {
            console.log(`❌ Skipping ${material.materialId}: No driver assigned`);
            continue;
          }
          
          if (!material.mountedAt) {
            console.log(`❌ Skipping ${material.materialId}: Not physically mounted`);
            continue;
          }
          
          if (material.dismountedAt) {
            console.log(`❌ Skipping ${material.materialId}: Already dismounted`);
            continue;
          }
          
          // Check if device has been connected (has DeviceTracking record)
          const DeviceTracking = require('../models/deviceTracking');
          const deviceTracking = await DeviceTracking.findByMaterialId(material.materialId);
          if (!deviceTracking) {
            console.log(`❌ Skipping ${material.materialId}: No connected device (no DeviceTracking record)`);
            continue;
          }
          
          const availability = await MaterialAvailability.findOne({ materialId: material._id });
          if (availability && availability.canAcceptAd(new Date(startTime), new Date(endTime))) {
            selectedMaterials.push(material);
            devicesSelected++;
            console.log(`🎯 Selected device ${devicesSelected}/${numberOfDevices}: ${material.materialId} (${material.materialType} ${material.vehicleType}) - Driver: ${material.driverId}, Mounted: ${material.mountedAt ? 'Yes' : 'No'} - ${availability.occupiedSlots}/${availability.totalSlots} slots used`);
          }
        }
        
        // Check if we have enough devices
        if (selectedMaterials.length < numberOfDevices) {
          throw new Error(`Only ${selectedMaterials.length} device${selectedMaterials.length === 1 ? '' : 's'} available with open slots, but you requested ${numberOfDevices}. Please reduce the number of devices or try a different date.`);
        }
      } catch (error) {
        console.error('❌ Smart material selection failed:', error.message);
        // Pass through the detailed error message instead of generic one
        throw error;
      }

      // ✅ Set reservation expiration BEFORE creating the ad (7 days from now)
      const reservationExpires = new Date();
      reservationExpires.setDate(reservationExpires.getDate() + 7);

      // Create a single ad that handles multiple devices
      const ad = new Ad({
        title,
        description,
        website: website || null,
        materialId: selectedMaterials.map(m => m._id), // All materials as array
        targetDevices: selectedMaterials.map(m => m._id), // All target devices
        // Removed planId - no longer using AdsPlan
        adType,
        adFormat,
        price: finalPrice,
        durationDays,
        numberOfDevices, // This is the key - store the number of devices in the ad
        adLengthSeconds: actualVideoDuration, // ✅ Use actual detected duration, not user selection
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
        category,
        reservationExpires: reservationExpires // ✅ Set reservation expiration at creation
      });

      const savedAd = await ad.save();

      // Send notification to admins about new ad submission
      try {
        const AdminNotificationService = require('../services/notifications/AdminNotificationService');
        await AdminNotificationService.sendNewAdSubmissionNotification(savedAd._id);
        console.log(`✅ Sent new ad submission notification for ad: ${savedAd._id}`);
      } catch (notificationError) {
        console.error('❌ Error sending new ad submission notification:', notificationError);
        // Don't fail the ad creation if notification fails
      }

      // ✅ NEW: Reserve slots for all target devices with expiration
      try {
        
        for (const material of selectedMaterials) {
          let availability = await MaterialAvailability.findOne({ materialId: material._id });
          if (!availability) {
            availability = new MaterialAvailability({ 
              materialId: material._id, 
              totalSlots: 5,
              occupiedSlots: 0,
              availableSlots: 5,
              currentAds: [],
              scheduledAds: [],
              status: 'AVAILABLE'
            });
          }

          // Check if slots are still available (double-check for race conditions)
          if (!availability.canAcceptAd(savedAd.startTime, savedAd.endTime)) {
            // If slots are not available, delete the ad and throw error
            await Ad.findByIdAndDelete(savedAd._id);
            throw new Error(`Slots no longer available for device ${material.materialId}. Another user may have reserved them.`);
          }

          // Reserve slot using the new method
          const slotNumber = availability.reserveSlot(savedAd._id, savedAd.startTime, savedAd.endTime, reservationExpires);
          await availability.save();

          console.log(`✅ Reserved slot ${slotNumber} for ad on ${material.materialId} (expires: ${reservationExpires.toISOString()})`);
          console.log(`📊 Material ${material.materialId}: ${availability.currentAds.length} current, ${availability.scheduledAds.length} scheduled`);
        }
        
        // ✅ No second save needed - reservationExpires was already set before the first save
        
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
      console.log(`📹 Video duration: ${actualVideoDuration}s (user selected: ${adLengthSeconds}s ad slot)`);
      return savedAd;
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(user.role);

      // Removed applyPlanChanges - no longer using AdsPlan

      if (input.materialId) {
        const materialExists = await Material.exists({ _id: input.materialId });
        if (!materialExists) throw new Error('Material not found');
      }

      if (isAdmin) {
        if (input.status && input.status !== ad.status) {
          const previousStatus = ad.status;
          ad.status = input.status;

          if (input.status === "APPROVED") {
            ad.approveTime = new Date();
            ad.rejectTime = null;
            ad.reasonForReject = null;
            
            // Set paymentStatus to PENDING when admin approves
            ad.paymentStatus = 'PENDING';
            
            // Send approval notification to user
            try {
              console.log('🔔 AdResolver: Sending approval notification for ad:', ad._id);
              await NotificationService.sendAdApprovalNotification(ad._id);
              console.log('✅ AdResolver: Approval notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending approval notification:', notificationError);
              console.error('❌ AdResolver: Error details:', notificationError.message);
              console.error('❌ AdResolver: Stack trace:', notificationError.stack);
              // Don't fail the ad update if notification fails
            }

            // Send notification to Super Admin
            try {
              console.log('🔔 AdResolver: Sending ad approval notification to Super Admin');
              await NotificationService.sendAdApprovalBySuperAdmin(ad._id, user.id);
              console.log('✅ AdResolver: Super Admin notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending Super Admin notification:', notificationError);
              // Don't fail the ad update if notification fails
            }
          } else if (input.status === "REJECTED") {
            ad.rejectTime = new Date();
            ad.approveTime = null;
            ad.reasonForReject = input.reasonForReject || "No reason provided";
            
            // Send rejection notification to user
            try {
              await NotificationService.sendAdRejectionNotification(ad._id, ad.reasonForReject);
            } catch (notificationError) {
              console.error('Error sending rejection notification:', notificationError);
              // Don't fail the ad update if notification fails
            }

            // Send notification to Super Admin
            try {
              console.log('🔔 AdResolver: Sending ad rejection notification to Super Admin');
              await NotificationService.sendAdRejectionBySuperAdmin(ad._id, user.id, ad.reasonForReject);
              console.log('✅ AdResolver: Super Admin notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending Super Admin notification:', notificationError);
              // Don't fail the ad update if notification fails
            }
          } else {
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        // Removed planId handling - no longer using AdsPlan
        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }

        if (input.materialId !== undefined) ad.materialId = input.materialId;

      } else {
        if (ad.userId.toString() !== user.id) throw new Error("Not authorized to update this ad");
        if (input.status && input.status !== ad.status) throw new Error("You are not authorized to update the status");

        // Removed planId handling - no longer using AdsPlan
        // Handle flexible ad updates
        if (true) {
          // Check if material type or vehicle type is changing
          const typeChanged = (input.materialType && input.materialType !== ad.materialType) ||
                            (input.vehicleType && input.vehicleType !== ad.vehicleType);

          if (typeChanged) {
            console.log('🔄 [AdResolver] Material/Vehicle type changed, need to reassign materials');
            
            // Update the types
            if (input.materialType) ad.materialType = input.materialType;
            if (input.vehicleType) ad.vehicleType = input.vehicleType;
            if (input.category) ad.category = input.category;

            // Clear old material assignments
            ad.materialId = [];
            
            console.log('✅ [AdResolver] Types updated, will reassign materials below');
          }

          // Update ad length
          if (input.adLengthSeconds !== undefined) {
            const allowedLengths = [20, 40, 60];
            if (!allowedLengths.includes(input.adLengthSeconds)) {
              throw new Error('Ad length must be 20, 40, or 60 seconds');
            }
            ad.adLengthSeconds = input.adLengthSeconds;
          }

          // Update duration
          if (input.durationDays !== undefined) {
            const allowedDurations = [30, 60, 90, 120, 150, 180];
            if (!allowedDurations.includes(input.durationDays)) {
              throw new Error('Duration must be 1-6 months (30-180 days)');
            }
            ad.durationDays = input.durationDays;

            // Recalculate end time if start time exists
            if (ad.startTime) {
              const endTime = new Date(ad.startTime);
              endTime.setDate(endTime.getDate() + input.durationDays);
              ad.endTime = endTime;
            }
          }

          // Update number of devices
          if (input.numberOfDevices !== undefined) {
            if (input.numberOfDevices < 1) {
              throw new Error('At least 1 device is required');
            }
            ad.numberOfDevices = input.numberOfDevices;
          }

          // Update price
          if (input.price !== undefined) {
            ad.price = input.price;
            ad.totalPrice = input.price;
          }

          // Check if device reassignment is needed
          const needsDeviceReassignment = typeChanged || 
                                         input.numberOfDevices !== undefined || 
                                         input.startTime !== undefined || 
                                         input.durationDays !== undefined;

          // ✅ IMMEDIATE DEVICE REASSIGNMENT
          if (needsDeviceReassignment && ad.materialType && ad.vehicleType) {
            console.log('🔄 [AdResolver] Device reassignment needed - releasing old slots and finding new devices');
            
            // Step 1: Release old slot reservations
            const oldMaterialIds = Array.isArray(ad.materialId) ? ad.materialId : (ad.materialId ? [ad.materialId] : []);
            
            if (oldMaterialIds.length > 0) {
              console.log(`🧹 [AdResolver] Releasing ${oldMaterialIds.length} old slot reservation(s)...`);
              for (const materialId of oldMaterialIds) {
                try {
                  const availability = await MaterialAvailability.findOne({ materialId });
                  if (availability) {
                    availability.removeAd(ad._id);
                    await availability.save();
                    console.log(`✅ [AdResolver] Released slot for material ${materialId}`);
                  }
                } catch (releaseError) {
                  console.error(`❌ [AdResolver] Error releasing slot for material ${materialId}:`, releaseError.message);
                  // Continue with other releases even if one fails
                }
              }
            }

            // Step 2: Get updated parameters for device selection
            const updatedStartTime = input.startTime ? new Date(input.startTime) : ad.startTime;
            const updatedDurationDays = input.durationDays !== undefined ? input.durationDays : ad.durationDays;
            const updatedNumberOfDevices = input.numberOfDevices !== undefined ? input.numberOfDevices : ad.numberOfDevices;
            const updatedMaterialType = input.materialType || ad.materialType;
            const updatedVehicleType = input.vehicleType || ad.vehicleType;
            const updatedCategory = input.category || ad.category;
            
            // Calculate new end time
            const updatedEndTime = new Date(updatedStartTime);
            updatedEndTime.setDate(updatedEndTime.getDate() + updatedDurationDays);

            console.log(`🎯 [AdResolver] Finding ${updatedNumberOfDevices} devices for ${updatedMaterialType} ${updatedVehicleType} ${updatedCategory}`);
            console.log(`📅 [AdResolver] Period: ${updatedStartTime.toISOString()} to ${updatedEndTime.toISOString()}`);

            // Step 3: Run smart material selection
            try {
              const sortedMaterials = await getMaterialsSortedByAvailability(
                updatedMaterialType,
                updatedVehicleType,
                updatedCategory,
                updatedStartTime,
                updatedEndTime
              );

              if (sortedMaterials.length === 0) {
                throw new Error('No compatible devices found for this configuration. All devices are either full, not mounted, or have no driver assigned.');
              }

              if (sortedMaterials.length < updatedNumberOfDevices) {
                throw new Error(`Only ${sortedMaterials.length} device${sortedMaterials.length === 1 ? '' : 's'} available, but you requested ${updatedNumberOfDevices}. Please reduce the number of devices.`);
              }

              // Step 4: Select and validate devices
              let selectedMaterials = [];
              let devicesSelected = 0;

              for (const material of sortedMaterials) {
                if (devicesSelected >= updatedNumberOfDevices) break;

                // Validation: ensure material has driver and is mounted
                if (!material.driverId) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: No driver assigned`);
                  continue;
                }
                
                if (!material.mountedAt) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: Not physically mounted`);
                  continue;
                }
                
                if (material.dismountedAt) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: Already dismounted`);
                  continue;
                }

                // Check if device has been connected
                const DeviceTracking = require('../models/deviceTracking');
                const deviceTracking = await DeviceTracking.findByMaterialId(material.materialId);
                if (!deviceTracking) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: No connected device`);
                  continue;
                }

                const availability = await MaterialAvailability.findOne({ materialId: material._id });
                if (availability && availability.canAcceptAd(updatedStartTime, updatedEndTime)) {
                  selectedMaterials.push(material);
                  devicesSelected++;
                  console.log(`✅ [AdResolver] Selected device ${devicesSelected}/${updatedNumberOfDevices}: ${material.materialId}`);
                }
              }

              if (selectedMaterials.length < updatedNumberOfDevices) {
                throw new Error(`Only ${selectedMaterials.length} device${selectedMaterials.length === 1 ? '' : 's'} available with open slots, but you requested ${updatedNumberOfDevices}. Please reduce the number of devices.`);
              }

              // Step 5: Update ad with new device assignments
              ad.materialId = selectedMaterials.map(m => m._id);
              ad.targetDevices = selectedMaterials.map(m => m._id);
              console.log(`✅ [AdResolver] Updated ad with ${selectedMaterials.length} new device(s)`);

              // Step 6: Reserve new slots in scheduledAds
              const reservationExpires = new Date();
              reservationExpires.setDate(reservationExpires.getDate() + 7); // 7 days expiration

              for (const material of selectedMaterials) {
                let availability = await MaterialAvailability.findOne({ materialId: material._id });
                if (!availability) {
                  availability = new MaterialAvailability({
                    materialId: material._id,
                    totalSlots: 5,
                    occupiedSlots: 0,
                    availableSlots: 5,
                    currentAds: [],
                    scheduledAds: [],
                    status: 'AVAILABLE'
                  });
                }

                // Reserve slot
                const slotNumber = availability.reserveSlot(ad._id, updatedStartTime, updatedEndTime, reservationExpires);
                await availability.save();
                console.log(`✅ [AdResolver] Reserved slot ${slotNumber} for ad on ${material.materialId} (expires: ${reservationExpires.toISOString()})`);
              }

              ad.reservationExpires = reservationExpires;
              console.log(`🎉 [AdResolver] Device reassignment complete! ${selectedMaterials.length} devices assigned.`);

            } catch (reassignmentError) {
              console.error('❌ [AdResolver] Device reassignment failed:', reassignmentError.message);
              // Clear materialId on error
              ad.materialId = [];
              throw new Error(`Failed to reassign devices: ${reassignmentError.message}`);
            }
          }

          // If type changed or any campaign setting changed, reset to PENDING for re-approval
          if (typeChanged || input.adLengthSeconds !== undefined || 
              input.durationDays !== undefined || input.numberOfDevices !== undefined ||
              input.price !== undefined) {
            console.log('🔄 [AdResolver] Campaign settings changed, resetting to PENDING status');
            ad.status = 'PENDING';
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.durationDays) {
            // Recalculate end time for flexible ads
            const endTime = new Date(input.startTime);
            endTime.setDate(endTime.getDate() + ad.durationDays);
            ad.endTime = endTime;
          }
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }
      }

      await ad.save();
      return ad;
    },

    deleteAd: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        // 1. Find the ad first to ensure it exists
        const ad = await Ad.findById(id);
        if (!ad) {
          throw new Error('Ad not found');
        }

        // 2. Check permissions: Admin can delete any ad, users can only delete their own pending ads
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
        const isOwner = ad.userId.toString() === user.id;
        const isPending = ad.status === 'PENDING';

        if (!isAdmin && (!isOwner || !isPending)) {
          throw new Error('You can only delete your own pending advertisements');
        }

        // Check if already archived
        if (ad.isArchived) {
          throw new Error('Ad is already archived');
        }

        console.log(`🗑️ Archiving ad: ${id} (${ad.title}) - 30-day deferred deletion`);

        // ✅ ARCHIVE INSTEAD OF DELETE (30-day deferred deletion like Facebook)
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        ad.isArchived = true;
        ad.archivedAt = now;
        ad.scheduledDeletionDate = deletionDate;
        ad.status = 'ARCHIVED'; // Change status so devices won't play it
        
        await ad.save();

        console.log(`✅ Ad ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);

        // ✅ CLEANUP: Remove from deployments and material availability immediately
        try {
          const AdsDeployment = require('../models/adsDeployment');
          const MaterialAvailability = require('../models/MaterialAvailability');

          // 1. Remove from AdsDeployment (both LCD slots and HEADDRESS/non-LCD deployments)
          console.log(`🧹 Cleaning up deployments for archived ad ${id}...`);
          
          // Find all deployments containing this ad
          // HEADDRESS ads are also stored in lcdSlots, so we check both lcdSlots and adId
          const deployments = await AdsDeployment.find({
            $or: [
              { adId: id },
              { 'lcdSlots.adId': id }
            ]
          });

          for (const deployment of deployments) {
            let deploymentModified = false;

            // Remove from LCD/HEADDRESS slots (both types use lcdSlots array)
            if (deployment.lcdSlots && deployment.lcdSlots.length > 0) {
              const initialLength = deployment.lcdSlots.length;
              deployment.lcdSlots = deployment.lcdSlots.filter(slot => 
                slot.adId.toString() !== id.toString()
              );
              if (deployment.lcdSlots.length < initialLength) {
                deploymentModified = true;
                console.log(`   ✅ Removed ad from slots in deployment ${deployment._id} (${initialLength - deployment.lcdSlots.length} slot(s) removed)`);
              }
            }

            // Remove from non-LCD deployment (single adId field)
            if (deployment.adId && deployment.adId.toString() === id.toString()) {
              deployment.adId = null;
              deploymentModified = true;
              console.log(`   ✅ Removed ad from non-LCD deployment ${deployment._id}`);
            }

            if (deploymentModified) {
              await deployment.save();
            }
          }

          // 2. Remove from MaterialAvailability (both currentAds and scheduledAds)
          console.log(`🧹 Cleaning up material availability for archived ad ${id}...`);
          
          // Get all materials that might have this ad
          const targetDeviceIds = ad.targetDevices || (ad.materialId ? (Array.isArray(ad.materialId) ? ad.materialId : [ad.materialId]) : []);
          
          if (targetDeviceIds.length > 0) {
            for (const deviceId of targetDeviceIds) {
              try {
                const availability = await MaterialAvailability.findOne({ materialId: deviceId });
                if (availability) {
                  const initialCurrent = availability.currentAds.length;
                  const initialScheduled = availability.scheduledAds.length;
                  
                  // Remove from currentAds
                  availability.currentAds = availability.currentAds.filter(adSlot => 
                    adSlot.adId.toString() !== id.toString()
                  );
                  
                  // Remove from scheduledAds
                  availability.scheduledAds = availability.scheduledAds.filter(adSlot => 
                    adSlot.adId.toString() !== id.toString()
                  );
                  
                  // Update slot counts
                  availability.occupiedSlots = availability.currentAds.length;
                  availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
                  
                  // Update availability dates
                  availability.updateAvailabilityDates();
                  
                  await availability.save();
                  
                  const removedCurrent = initialCurrent - availability.currentAds.length;
                  const removedScheduled = initialScheduled - availability.scheduledAds.length;
                  
                  if (removedCurrent > 0 || removedScheduled > 0) {
                    console.log(`   ✅ Removed ad from material ${deviceId}: ${removedCurrent} current, ${removedScheduled} scheduled slots freed`);
                  }
                }
              } catch (availabilityError) {
                console.error(`   ⚠️ Error cleaning up material availability for device ${deviceId}:`, availabilityError.message);
                // Continue with other devices even if one fails
              }
            }
          }

          console.log(`✅ Cleanup completed - ad removed from deployments and material availability`);
        } catch (cleanupError) {
          console.error(`❌ Error during cleanup (non-critical):`, cleanupError);
          // Don't fail the archive if cleanup fails - ad is already archived
        }

        return true;

      } catch (error) {
        console.error('❌ Error archiving ad:', error);
        throw new Error(`Failed to archive ad: ${error.message}`);
      }
    },

    restoreAd: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const ad = await Ad.findById(id);
        if (!ad) {
          throw new Error('Ad not found');
        }

        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
        const isOwner = ad.userId.toString() === user.id;

        if (!isAdmin && !isOwner) {
          throw new Error('Not authorized to restore this advertisement');
        }

        if (!ad.isArchived) {
          throw new Error('Ad is not archived');
        }

        console.log(`✅ Restoring ad: ${id} (${ad.title})`);

        ad.isArchived = false;
        ad.archivedAt = null;
        ad.scheduledDeletionDate = null;
        ad.status = 'PENDING'; // Reset to pending status
        
        await ad.save();

        console.log(`✅ Ad ${id} restored successfully`);

        return true;

      } catch (error) {
        console.error('❌ Error restoring ad:', error);
        throw new Error(`Failed to restore ad: ${error.message}`);
      }
    }
  },

  Ad: {
    id: (parent) => {
      if (parent && parent._id) return parent._id.toString();
      if (parent && parent.id) return parent.id.toString();
      return '';
    },
    userId: async (parent) => await User.findById(parent.userId),
    materialId: async (parent) => await Material.find({ _id: { $in: parent.materialId } }),
    // Removed planId resolver - no longer using AdsPlan
    // Ensure date fields are consistent ISO strings to avoid client-side Invalid Date
    startTime: (parent) => {
      try {
        return parent.startTime ? new Date(parent.startTime).toISOString() : '';
      } catch (e) {
        console.error('Error parsing startTime:', e, 'value:', parent.startTime);
        return '';
      }
    },
    endTime: (parent) => {
      try {
        return parent.endTime ? new Date(parent.endTime).toISOString() : '';
      } catch (e) {
        console.error('Error parsing endTime:', e, 'value:', parent.endTime);
        return '';
      }
    },
    createdAt: (parent) => {
      try {
        return parent.createdAt ? new Date(parent.createdAt).toISOString() : '';
      } catch (e) {
        console.error('Error parsing createdAt:', e, 'value:', parent.createdAt);
        return '';
      }
    },
    updatedAt: (parent) => {
      try {
        return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : '';
      } catch (e) {
        console.error('Error parsing updatedAt:', e, 'value:', parent.updatedAt);
        return '';
      }
    },
  },

};

module.exports = adResolvers;
