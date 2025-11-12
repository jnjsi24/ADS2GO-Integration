/**
 * Check User Deployments - Debug script to see actual deployments for a user
 * 
 * Usage: node src/scripts/checkUserDeployments.js <userId>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function checkUserDeployments(userId) {
  try {
    const userAnalytics = await UserAnalytics.findOne({ userId });
    if (!userAnalytics) {
      console.log(`❌ No UserAnalytics found for userId: ${userId}`);
      return;
    }
    
    console.log(`\n📊 User: ${userAnalytics.userName} (${userId})`);
    console.log(`   Current totalDevices: ${userAnalytics.totalDevices}`);
    console.log(`   Total ads: ${userAnalytics.ads.length}\n`);
    
    // Get user's active ads
    const userAds = await Ad.find({
      userId: userId,
      paymentStatus: 'PAID',
      adStatus: 'ACTIVE',
      status: { $in: ['RUNNING', 'APPROVED'] },
    }).select('_id title targetDevices materialId');
    
    console.log(`📋 User's Active Ads (${userAds.length}):`);
    userAds.forEach(ad => {
      console.log(`   - ${ad.title} (${ad._id})`);
      console.log(`     targetDevices: ${ad.targetDevices?.length || 0} devices`);
      console.log(`     materialId: ${ad.materialId?.length || 0} materials`);
    });
    
    // Get active deployments
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
      'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
    }).select('materialId lcdSlots');
    
    console.log(`\n🚗 Active Deployments (${activeDeployments.length}):`);
    
    // Create a map of adId -> unique devices (Set to avoid duplicates)
    const adToDevicesMap = new Map();
    const allUniqueDevices = new Set();
    
    activeDeployments.forEach(deployment => {
      deployment.lcdSlots.forEach(slot => {
        if (['RUNNING', 'SCHEDULED'].includes(slot.status)) {
          const adIdStr = slot.adId.toString();
          if (!adToDevicesMap.has(adIdStr)) {
            adToDevicesMap.set(adIdStr, new Map()); // Use Map to store device -> slot info
          }
          // Only add device once per ad (even if it appears in multiple slots)
          if (!adToDevicesMap.get(adIdStr).has(deployment.materialId)) {
            adToDevicesMap.get(adIdStr).set(deployment.materialId, {
              materialId: deployment.materialId,
              slotNumber: slot.slotNumber || 1,
              status: slot.status
            });
          }
          allUniqueDevices.add(deployment.materialId);
        }
      });
    });
    
    // Show devices per ad
    userAds.forEach(ad => {
      const adIdStr = ad._id.toString();
      const devicesMap = adToDevicesMap.get(adIdStr) || new Map();
      const devices = Array.from(devicesMap.values());
      console.log(`\n   📌 ${ad.title} (${adIdStr}):`);
      if (devices.length === 0) {
        console.log(`      ⚠️  No active deployments`);
      } else {
        console.log(`      ${devices.length} device(s):`);
        devices.forEach(device => {
          console.log(`         - ${device.materialId} (slot ${device.slotNumber}, ${device.status})`);
        });
      }
    });
    
    // Calculate totals
    const sumOfAdDevices = Array.from(adToDevicesMap.values()).reduce((sum, devicesMap) => sum + devicesMap.size, 0);
    const uniqueDevicesCount = allUniqueDevices.size;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Sum of all ad devices (current logic): ${sumOfAdDevices}`);
    console.log(`   Unique devices across all ads: ${uniqueDevicesCount}`);
    console.log(`   Current totalDevices in DB: ${userAnalytics.totalDevices}`);
    
    // Show what's in the ads array
    console.log(`\n📋 Current ads array in UserAnalytics:`);
    userAnalytics.ads.forEach(ad => {
      console.log(`   - ${ad.adTitle || 'Unknown'} (${ad.adId}):`);
      console.log(`     totalDevices: ${ad.totalDevices || 0}`);
      console.log(`     materials array length: ${ad.materials?.length || 0}`);
      if (ad.materials && ad.materials.length > 0) {
        ad.materials.forEach(m => {
          console.log(`       - ${m.materialId} (slot ${m.slotNumber})`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  try {
    const userId = process.argv[2];
    if (!userId) {
      console.log('Usage: node src/scripts/checkUserDeployments.js <userId>');
      console.log('Example: node src/scripts/checkUserDeployments.js 6904984dbe891dd9adba1526');
      process.exit(1);
    }
    
    await connectDB();
    await checkUserDeployments(userId);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkUserDeployments };

