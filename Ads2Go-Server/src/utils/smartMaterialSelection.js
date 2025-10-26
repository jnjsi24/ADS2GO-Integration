const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const Ad = require('../models/Ad');
const { validateMaterialHasDevice } = require('./materialDeviceValidator');

// Helper function for smart material selection
const getMaterialsSortedByAvailability = async (materialType, vehicleType, category, startTime = null, endTime = null) => {
  try {
    const materials = await Material.find({ materialType, vehicleType, category });
    if (materials.length === 0) return [];

    const materialIds = materials.map(m => m._id);
    const availabilities = await MaterialAvailability.find({ materialId: { $in: materialIds } });

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

    // Sort available materials by fill-in-order strategy (001, 002, 003...), then by occupied slots
    const sortedMaterials = availableMaterials.sort((a, b) => {
      const availA = availabilityMap.get(a._id.toString());
      const availB = availabilityMap.get(b._id.toString());
      
      const occupiedA = availA ? availA.occupiedSlots : 0; // Default to 0 if no availability record
      const occupiedB = availB ? availB.occupiedSlots : 0;
      
      // Primary sort: by material ID number (ascending) - fill materials in order 001, 002, 003, 004, 005, 006...
      const getMaterialNumber = (materialId) => {
        const match = materialId.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 999;
      };
      
      const numberA = getMaterialNumber(a.materialId);
      const numberB = getMaterialNumber(b.materialId);
      
      // Primary sort: by material number (ascending - 001, 002, 003...)
      if (numberA !== numberB) {
        return numberA - numberB;
      }
      
      // Secondary sort: among materials with same number, prefer those with more occupied slots
      return occupiedB - occupiedA;
    });

    console.log(`📊 Materials sorted by fill-in-order strategy (001, 002, 003...):`);
    sortedMaterials.forEach((material, index) => {
      const avail = availabilityMap.get(material._id.toString());
      const slots = avail ? avail.availableSlots : 5;
      const occupied = avail ? avail.occupiedSlots : 0;
      console.log(`   ${index + 1}. ${material.materialId}: ${occupied}/5 slots used (${slots} available)`);
    });

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

    for (const material of materials) {
      let availability = await MaterialAvailability.findOne({ materialId: material._id });
      if (!availability) {
        availability = new MaterialAvailability({ materialId: material._id, totalSlots: 5 });
      }

      // ✅ Only count PAID ads with status RUNNING or SCHEDULED
      // REJECTED, CANCELLED, ENDED, or UNPAID ads should NOT occupy slots
      const runningAds = await Ad.find({
        materialId: material._id,
        status: { $in: ['RUNNING', 'SCHEDULED'] },
        paymentStatus: 'PAID', // ✅ Must be PAID to occupy a slot
        adStatus: 'ACTIVE',
        endTime: { $gt: new Date() } // Ensure ad is still active
      }).sort({ createdAt: 1 }); // Sort to assign slots consistently

      // Separate RUNNING and SCHEDULED ads
      availability.currentAds = [];
      availability.scheduledAds = [];
      let slotNumber = 1;
      
      for (const ad of runningAds) {
        if (ad.status === 'RUNNING') {
          availability.currentAds.push({
            adId: ad._id,
            startTime: ad.startTime,
            endTime: ad.endTime,
            slotNumber: slotNumber++
          });
        } else if (ad.status === 'SCHEDULED') {
          availability.scheduledAds.push({
            adId: ad._id,
            startTime: ad.startTime,
            endTime: ad.endTime,
            slotNumber: slotNumber++,
            reservedAt: ad.createdAt,
            reservationExpires: null // Paid ads never expire
          });
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
