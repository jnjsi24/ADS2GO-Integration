const mongoose = require('mongoose');
const MaterialAvailability = require('../src/models/MaterialAvailability');
const Ad = require('../src/models/Ad');
const Material = require('../src/models/Material');
require('dotenv').config();

async function syncMaterialAvailability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
    
    // Get all materials
    const materials = await Material.find({});
    console.log(`Found ${materials.length} materials`);
    
    for (const material of materials) {
      console.log(`\n=== Syncing ${material.materialId} ===`);
      
      // Get or create material availability
      let availability = await MaterialAvailability.findOne({ materialId: material._id });
      if (!availability) {
        availability = new MaterialAvailability({
          materialId: material._id,
          totalSlots: 5,
          occupiedSlots: 0,
          availableSlots: 5,
          nextAvailableDate: new Date(),
          allSlotsFreeDate: new Date(),
          status: 'AVAILABLE',
          currentAds: []
        });
      }
      
      // Find all running ads for this material
      const runningAds = await Ad.find({
        materialId: material._id,
        status: 'RUNNING',
        adStatus: 'ACTIVE'
      });
      
      console.log(`Found ${runningAds.length} running ads for ${material.materialId}`);
      
      // Clear existing current ads
      availability.currentAds = [];
      availability.occupiedSlots = 0;
      
      // Add running ads to availability
      let slotNumber = 1;
      for (const ad of runningAds) {
        availability.currentAds.push({
          adId: ad._id,
          startTime: ad.startTime,
          endTime: ad.endTime,
          slotNumber: slotNumber
        });
        slotNumber++;
      }
      
      // Update counts
      availability.occupiedSlots = availability.currentAds.length;
      availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
      
      // Update availability dates
      if (availability.currentAds.length === 0) {
        availability.nextAvailableDate = new Date();
        availability.allSlotsFreeDate = new Date();
      } else {
        const endTimes = availability.currentAds.map(ad => ad.endTime).sort();
        availability.nextAvailableDate = endTimes[0];
        availability.allSlotsFreeDate = endTimes[endTimes.length - 1];
      }
      
      // Save the updated availability
      await availability.save();
      
      console.log(`Updated ${material.materialId}:`);
      console.log(`  - Total Slots: ${availability.totalSlots}`);
      console.log(`  - Occupied Slots: ${availability.occupiedSlots}`);
      console.log(`  - Available Slots: ${availability.availableSlots}`);
      console.log(`  - Current Ads: ${availability.currentAds.length}`);
    }
    
    console.log('\n✅ Material availability synchronization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncMaterialAvailability();
