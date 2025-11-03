const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const Ad = require('../models/Ad');
const { validateMaterialHasDevice } = require('./materialDeviceValidator');

// Helper function for smart material selection
const getMaterialsSortedByAvailability = async (materialType, vehicleType, category, startTime = null, endTime = null) => {
  try {
    console.log(`🔍 [getMaterialsSortedByAvailability] Searching for: ${materialType} ${vehicleType} ${category}`);
    const materials = await Material.find({ materialType, vehicleType, category });
    console.log(`📦 [getMaterialsSortedByAvailability] Found ${materials.length} materials matching criteria`);
    if (materials.length === 0) return [];

    const materialIds = materials.map(m => m._id);
    const availabilities = await MaterialAvailability.find({ materialId: { $in: materialIds } });
    console.log(`📊 [getMaterialsSortedByAvailability] Found ${availabilities.length} availability records`);

    const availabilityMap = new Map();
    availabilities.forEach(avail => {
      availabilityMap.set(avail.materialId.toString(), avail);
    });

    // Filter out materials that don't meet all requirements
    const availableMaterials = [];
    
    for (const material of materials) {
      const avail = availabilityMap.get(material._id.toString());
      const availableSlots = avail ? avail.availableSlots : 5;
      
      // 1. Check if material has available slots
      if (availableSlots <= 0) {
        console.log(`❌ Material ${material.materialId} excluded: No available slots (${availableSlots})`);
        continue;
      }
      
      // 2. Check if material has a driver assigned
      if (!material.driverId) {
        console.log(`❌ Material ${material.materialId} excluded: No driver assigned`);
        continue;
      }
      
      // 3. Check if material is physically mounted (has mountedAt date)
      if (!material.mountedAt) {
        console.log(`❌ Material ${material.materialId} excluded: Not physically mounted (no mountedAt date)`);
        continue;
      }
      
      // 4. ✅ ENHANCED: Check if device has been connected AND is actively registered
      try {
        const deviceValidation = await validateMaterialHasDevice(material.materialId);
        
        if (!deviceValidation.hasDevice) {
          console.log(`❌ Material ${material.materialId} excluded: ${deviceValidation.reason}`);
          if (deviceValidation.details) {
            console.log(`   Details:`, JSON.stringify(deviceValidation.details, null, 2));
          }
          continue;
        }
        
        // Device is available if it has been connected and has active registration
        // The device can be temporarily offline but still eligible for ads
        console.log(`✅ Material ${material.materialId} included: ${deviceValidation.reason}`);
        if (deviceValidation.details) {
          console.log(`   Device info:`, JSON.stringify(deviceValidation.details.registeredDevices, null, 2));
        }
      } catch (deviceError) {
        console.log(`❌ Material ${material.materialId} excluded: Error validating device - ${deviceError.message}`);
        continue;
      }
      
      // 5. Check if material is not dismounted
      if (material.dismountedAt) {
        console.log(`❌ Material ${material.materialId} excluded: Already dismounted`);
        continue;
      }
      
      // 6. If time period is provided, check for time conflicts
      if (startTime && endTime && avail) {
        if (!avail.canAcceptAd(startTime, endTime)) {
          continue;
        }
      }
      
      // If all checks pass, add to available materials
      availableMaterials.push(material);
    }

    // Sort available materials by fill-in-order strategy (001, 002, 003...)
    const sortedMaterials = availableMaterials.sort((a, b) => {
      // Sort by material ID number (ascending) - fill materials in order 001, 002, 003, 004, 005, 006...
      const getMaterialNumber = (materialId) => {
        const match = materialId.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 999;
      };
      
      const numberA = getMaterialNumber(a.materialId);
      const numberB = getMaterialNumber(b.materialId);
      
      return numberA - numberB;
    });

    console.log(`📊 Materials sorted by fill-in-order strategy (001, 002, 003...):`);
    sortedMaterials.forEach((material, index) => {
      const avail = availabilityMap.get(material._id.toString());
      const slots = avail ? avail.availableSlots : 5;
      const occupied = avail ? avail.occupiedSlots : 0;
      console.log(`   ${index + 1}. ${material.materialId}: ${occupied}/5 slots used (${slots} available)`);
    });

    console.log(`✅ [getMaterialsSortedByAvailability] Returning ${sortedMaterials.length} available materials`);
    return sortedMaterials;
  } catch (error) {
    console.error('Error getting materials sorted by availability:', error);
    return await Material.find({ materialType, vehicleType, category }).limit(3);
  }
};

// Function to sync material slots with running ads
const syncMaterialSlots = async () => {
  try {
    console.log('🔄 Syncing material slots with running ads...');
    
    const materials = await Material.find({});
    console.log(`Found ${materials.length} materials to sync`);

    // Get AdsDeployment model
    const AdsDeployment = require('../models/adsDeployment');

    for (const material of materials) {
      let availability = await MaterialAvailability.findOne({ materialId: material._id });
      if (!availability) {
        availability = new MaterialAvailability({ materialId: material._id, totalSlots: 5 });
      }

      // ✅ NEW: Use AdsDeployment instead of Ad.materialId (flexible ads don't use materialId)
      const deployment = await AdsDeployment.findOne({ materialId: material.materialId });
      
      // Separate RUNNING and SCHEDULED slots from deployment
      availability.currentAds = [];
      availability.scheduledAds = [];
      
      if (deployment && deployment.lcdSlots && deployment.lcdSlots.length > 0) {
        for (const slot of deployment.lcdSlots) {
          // Only count active slots (RUNNING or SCHEDULED)
          if (slot.status === 'RUNNING') {
            availability.currentAds.push({
              adId: slot.adId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              slotNumber: slot.slotNumber
            });
          } else if (slot.status === 'SCHEDULED') {
            availability.scheduledAds.push({
              adId: slot.adId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              slotNumber: slot.slotNumber,
              reservedAt: slot.deployedAt || new Date(),
              reservationExpires: null
            });
          }
        }
      }

      // ✅ Company ads are NOT counted - they're just fillers at runtime
      // Only PAID user ads (RUNNING or SCHEDULED) count towards occupiedSlots
      availability.occupiedSlots = availability.currentAds.length + availability.scheduledAds.length;
      availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
      availability.updateAvailabilityDates(); // Update nextAvailableDate and allSlotsFreeDate
      await availability.save();
      
      console.log(`📦 ${material.materialId}: ${availability.occupiedSlots}/${availability.totalSlots} slots used (${availability.availableSlots} available)`);
    }
    
    console.log('✅ Material slot sync completed!');
  } catch (error) {
    console.error('❌ Error syncing material slots:', error);
  }
};

module.exports = {
  getMaterialsSortedByAvailability,
  syncMaterialSlots
};
