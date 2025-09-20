const mongoose = require('mongoose');
const MaterialAvailability = require('../src/models/MaterialAvailability');
const Ad = require('../src/models/Ad');
const Material = require('../src/models/Material');
require('dotenv').config();

async function checkSync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
    
    console.log('\n=== MATERIAL AVAILABILITY ===');
    const avail = await MaterialAvailability.findOne({}).populate('materialId');
    if (avail) {
      console.log('Material:', avail.materialId.materialId);
      console.log('Total Slots:', avail.totalSlots);
      console.log('Occupied Slots:', avail.occupiedSlots);
      console.log('Available Slots:', avail.availableSlots);
      console.log('Current Ads:', avail.currentAds.length);
      avail.currentAds.forEach(ad => {
        console.log('  - Ad ID:', ad.adId, 'Slot:', ad.slotNumber, 'Start:', ad.startTime, 'End:', ad.endTime);
      });
    }
    
    console.log('\n=== ACTUAL RUNNING ADS ===');
    const runningAds = await Ad.find({ 
      status: 'RUNNING', 
      adStatus: 'ACTIVE',
      materialId: '68cc0806b160d3b50450d20e' // DGL-HEADDRESS-CAR-001
    });
    console.log('Running ads count:', runningAds.length);
    runningAds.forEach(ad => {
      console.log('  - Ad ID:', ad._id, 'Title:', ad.title, 'Start:', ad.startTime, 'End:', ad.endTime);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSync();
