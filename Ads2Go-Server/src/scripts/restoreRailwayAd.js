const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');

async function restoreRailwayAd() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the Railway ad
    const railwayAd = await Ad.findOne({ title: /railway/i });
    if (!railwayAd) {
      console.log('❌ Railway ad not found');
      await mongoose.disconnect();
      return;
    }
    console.log(`✅ Found Railway ad: ${railwayAd._id} - ${railwayAd.title}`);

    // Find device 003
    const materialId = 'DGL-HEADDRESS-CAR-003';
    const material = await Material.findOne({ materialId });
    if (!material) {
      console.log(`❌ Material ${materialId} not found`);
      await mongoose.disconnect();
      return;
    }
    console.log(`✅ Found material: ${materialId}`);

    // Find or create deployment
    let deployment = await AdsDeployment.findOne({ materialId });
    if (!deployment) {
      console.log(`❌ Deployment for ${materialId} not found`);
      await mongoose.disconnect();
      return;
    }
    console.log(`✅ Found deployment: ${deployment._id}`);

    // Check if Railway ad is already in the deployment
    const existingSlot = deployment.lcdSlots.find(slot => 
      slot.adId && slot.adId.toString() === railwayAd._id.toString()
    );

    if (existingSlot) {
      // Update existing slot to RUNNING
      existingSlot.status = 'RUNNING';
      existingSlot.deployedAt = new Date();
      if (existingSlot.removedAt) {
        existingSlot.removedAt = null;
        existingSlot.removedBy = null;
        existingSlot.removalReason = null;
      }
      console.log(`✅ Updated existing slot to RUNNING`);
    } else {
      // Add new slot
      const activeSlots = deployment.lcdSlots
        .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
        .map(slot => slot.slotNumber);
      
      const nextSlot = [1, 2, 3, 4, 5].find(num => !activeSlots.includes(num));
      
      if (!nextSlot) {
        console.log('❌ No available slots (device is full)');
        await mongoose.disconnect();
        return;
      }

      const startTime = railwayAd.startTime || new Date();
      const endTime = railwayAd.endTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      deployment.lcdSlots.push({
        adId: railwayAd._id,
        slotNumber: nextSlot,
        startTime: startTime,
        endTime: endTime,
        status: 'RUNNING',
        deployedAt: new Date()
      });

      console.log(`✅ Added Railway ad to slot ${nextSlot}`);
    }

    await deployment.save();
    console.log('✅ Deployment saved successfully');

    // Populate to verify
    await deployment.populate('lcdSlots.adId');
    const railwaySlot = deployment.lcdSlots.find(slot => 
      slot.adId && slot.adId._id && slot.adId._id.toString() === railwayAd._id.toString()
    );
    
    if (railwaySlot) {
      console.log(`✅ Railway ad is now in slot ${railwaySlot.slotNumber} with status: ${railwaySlot.status}`);
    }

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

restoreRailwayAd();

