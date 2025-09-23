const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const Ad = require('../models/Ad');

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

    // Filter out full materials and materials with time conflicts
    const availableMaterials = materials.filter(material => {
      const avail = availabilityMap.get(material._id.toString());
      const availableSlots = avail ? avail.availableSlots : 5;
      
      // Check if material has available slots
      if (availableSlots <= 0) {
        return false;
      }
      
      // If time period is provided, check for time conflicts
      if (startTime && endTime && avail) {
        return avail.canAcceptAd(startTime, endTime);
      }
      
      return true; // If no time period provided, just check slots
    });

    // Sort available materials by occupied slots (descending) to fill materials ASAP, then by specific priority order
    const sortedMaterials = availableMaterials.sort((a, b) => {
      const availA = availabilityMap.get(a._id.toString());
      const availB = availabilityMap.get(b._id.toString());
      
      const occupiedA = availA ? availA.occupiedSlots : 0; // Default to 0 if no availability record
      const occupiedB = availB ? availB.occupiedSlots : 0;
      
      // Primary sort: by occupied slots (descending) - fill materials that are closest to full first
      if (occupiedA !== occupiedB) {
        return occupiedB - occupiedA;
      }
      
      // Secondary sort: by specific priority order (002, 003, 001)
      const priorityOrder = {
        'DGL-HEADDRESS-CAR-002': 1,
        'DGL-HEADDRESS-CAR-003': 2,
        'DGL-HEADDRESS-CAR-001': 3
      };
      
      const priorityA = priorityOrder[a.materialId] || 999;
      const priorityB = priorityOrder[b.materialId] || 999;
      
      return priorityA - priorityB;
    });

    console.log(`📊 Materials sorted by occupied slots (fill ASAP):`);
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

      const runningAds = await Ad.find({
        materialId: material._id,
        status: 'RUNNING',
        adStatus: 'ACTIVE',
        endTime: { $gt: new Date() } // Ensure ad is still active
      }).sort({ createdAt: 1 }); // Sort to assign slots consistently

      availability.currentAds = [];
      let slotNumber = 1;
      for (const ad of runningAds) {
        availability.currentAds.push({
          adId: ad._id,
          startTime: ad.startTime,
          endTime: ad.endTime,
          slotNumber: slotNumber++
        });
      }

      availability.occupiedSlots = availability.currentAds.length;
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
