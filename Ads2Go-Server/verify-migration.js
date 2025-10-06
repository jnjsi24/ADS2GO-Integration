const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Verify migration results
async function verifyMigration() {
  try {
    console.log('🔍 Verifying materialId migration...');
    
    const Ad = mongoose.model('Ad', new mongoose.Schema({}, { strict: false }));
    
    // Get all ads
    const allAds = await Ad.find({});
    console.log(`📊 Total ads in database: ${allAds.length}`);
    
    // Check each ad's materialId type
    let arrayCount = 0;
    let singleCount = 0;
    let nullCount = 0;
    
    console.log('\n📋 Detailed verification:');
    allAds.forEach((ad, index) => {
      const materialIdType = Array.isArray(ad.materialId) ? 'array' : typeof ad.materialId;
      const materialIdLength = Array.isArray(ad.materialId) ? ad.materialId.length : (ad.materialId ? 1 : 0);
      
      console.log(`${index + 1}. Ad: ${ad.title}`);
      console.log(`   ID: ${ad._id}`);
      console.log(`   materialId: ${materialIdType} (${materialIdLength} items)`);
      console.log(`   targetDevices: ${ad.targetDevices?.length || 0} devices`);
      
      if (Array.isArray(ad.materialId)) {
        arrayCount++;
        console.log(`   ✅ materialId is array: [${ad.materialId.join(', ')}]`);
      } else if (ad.materialId) {
        singleCount++;
        console.log(`   ⚠️ materialId is single: ${ad.materialId}`);
      } else {
        nullCount++;
        console.log(`   ❌ materialId is null/undefined`);
      }
      console.log('');
    });
    
    console.log('📊 Migration Summary:');
    console.log(`✅ Array materialId: ${arrayCount} ads`);
    console.log(`⚠️ Single materialId: ${singleCount} ads`);
    console.log(`❌ Null materialId: ${nullCount} ads`);
    
    if (singleCount > 0) {
      console.log('\n🔄 Running additional migration for remaining single materialIds...');
      
      // Find ads with single materialId
      const singleMaterialAds = await Ad.find({
        materialId: { $exists: true, $not: { $type: "array" } }
      });
      
      for (const ad of singleMaterialAds) {
        if (ad.materialId && !Array.isArray(ad.materialId)) {
          await Ad.updateOne(
            { _id: ad._id },
            { $set: { materialId: [ad.materialId] } }
          );
          console.log(`✅ Fixed ad: ${ad._id} - "${ad.title}"`);
        }
      }
      
      console.log('🎉 Additional migration completed!');
    }
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const finalAds = await Ad.find({});
    const finalArrayCount = finalAds.filter(ad => Array.isArray(ad.materialId)).length;
    
    console.log(`📊 Final result: ${finalArrayCount}/${finalAds.length} ads have array materialId`);
    
    if (finalArrayCount === finalAds.length) {
      console.log('🎉 SUCCESS: All ads now have array materialId!');
    } else {
      console.log('⚠️ Some ads still need attention');
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
}

// Show specific ad details
async function showAdDetails(adId) {
  try {
    const Ad = mongoose.model('Ad', new mongoose.Schema({}, { strict: false }));
    const ad = await Ad.findById(adId);
    
    if (!ad) {
      console.log('❌ Ad not found');
      return;
    }
    
    console.log(`\n📋 Ad Details: ${ad.title}`);
    console.log(`ID: ${ad._id}`);
    console.log(`materialId: ${Array.isArray(ad.materialId) ? `[${ad.materialId.length} materials]` : typeof ad.materialId}`);
    console.log(`materialId values: ${Array.isArray(ad.materialId) ? ad.materialId.join(', ') : ad.materialId}`);
    console.log(`targetDevices: [${ad.targetDevices?.length || 0} devices]`);
    console.log(`targetDevices values: ${ad.targetDevices?.join(', ') || 'none'}`);
    console.log(`numberOfDevices: ${ad.numberOfDevices}`);
    console.log(`status: ${ad.status}`);
    console.log(`paymentStatus: ${ad.paymentStatus}`);
    console.log(`deploymentStatus: ${ad.deploymentStatus}`);
    
  } catch (error) {
    console.error('❌ Error showing ad details:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  
  const command = process.argv[2];
  const adId = process.argv[3];
  
  if (command === 'show' && adId) {
    await showAdDetails(adId);
  } else {
    await verifyMigration();
  }
  
  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
}

main().catch(console.error);
