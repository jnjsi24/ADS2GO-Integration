const mongoose = require('mongoose');
const AdsDeployment = require('../src/models/adsDeployment');
const Ad = require('../src/models/Ad');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migrateMediaFile() {
  try {
    console.log('🔄 Starting mediaFile migration...');
    
    // Find all deployments with LCD slots that don't have mediaFile
    const deployments = await AdsDeployment.find({
      'lcdSlots.0': { $exists: true }
    });
    
    console.log(`📊 Found ${deployments.length} deployments with LCD slots`);
    
    let updatedCount = 0;
    
    for (const deployment of deployments) {
      let needsUpdate = false;
      
      for (const slot of deployment.lcdSlots) {
        if (!slot.mediaFile) {
          // Fetch the ad to get the mediaFile
          const ad = await Ad.findById(slot.adId);
          if (ad && ad.mediaFile) {
            slot.mediaFile = ad.mediaFile;
            needsUpdate = true;
            console.log(`✅ Updated slot ${slot.slotNumber} for ad ${slot.adId} with mediaFile: ${ad.mediaFile}`);
          } else {
            console.warn(`⚠️  Could not find ad or mediaFile for slot ${slot.slotNumber}, adId: ${slot.adId}`);
          }
        }
      }
      
      if (needsUpdate) {
        await deployment.save();
        updatedCount++;
        console.log(`💾 Saved deployment ${deployment._id}`);
      }
    }
    
    console.log(`✅ Migration completed! Updated ${updatedCount} deployments`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateMediaFile();
}

module.exports = migrateMediaFile;
