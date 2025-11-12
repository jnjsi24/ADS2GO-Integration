/**
 * Verify TotalDevices Logic
 * 
 * This script verifies that totalDevices counts UNIQUE devices across all ads,
 * not the sum of devices per ad.
 * 
 * Usage: node src/scripts/verifyTotalDevicesLogic.js <userId>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');

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

async function verifyLogic(userId) {
  try {
    const userAnalytics = await UserAnalytics.findOne({ userId });
    if (!userAnalytics) {
      console.log(`❌ No UserAnalytics found for userId: ${userId}`);
      return;
    }
    
    console.log(`\n📊 User: ${userAnalytics.userName} (${userId})`);
    console.log(`   Current totalDevices in DB: ${userAnalytics.totalDevices}`);
    console.log(`   Total ads: ${userAnalytics.ads.length}\n`);
    
    // Get user's active ads
    const userAds = await Ad.find({
      userId: userId,
      paymentStatus: 'PAID',
      adStatus: 'ACTIVE',
      status: { $in: ['RUNNING', 'APPROVED'] },
    }).select('_id title');
    
    console.log(`📋 User's Active Ads (${userAds.length}):`);
    userAds.forEach(ad => {
      console.log(`   - ${ad.title} (${ad._id})`);
    });
    
    // Get active deployments
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
      'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
    }).select('materialId lcdSlots');
    
    // Create a map of adId -> unique devices (Set to avoid duplicates)
    const adToDevicesMap = new Map();
    const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
    
    activeDeployments.forEach(deployment => {
      deployment.lcdSlots.forEach(slot => {
        if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
          const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
          
          // Only process slots for ads that belong to this user
          if (userAdIdSet.has(adIdStr)) {
            if (!adToDevicesMap.has(adIdStr)) {
              adToDevicesMap.set(adIdStr, new Set());
            }
            adToDevicesMap.get(adIdStr).add(deployment.materialId);
          }
        }
      });
    });
    
    console.log(`\n🚗 Active Deployments for User's Ads:\n`);
    
    // Show devices per ad
    const allUniqueDevices = new Set();
    userAds.forEach(ad => {
      const adIdStr = ad._id.toString();
      const devices = adToDevicesMap.get(adIdStr) || new Set();
      const deviceArray = Array.from(devices);
      
      console.log(`   📌 ${ad.title} (${adIdStr}):`);
      if (devices.size === 0) {
        console.log(`      ⚠️  No active deployments`);
      } else {
        console.log(`      ${devices.size} device(s): ${deviceArray.join(', ')}`);
        deviceArray.forEach(deviceId => {
          allUniqueDevices.add(deviceId);
        });
      }
    });
    
    // Calculate expected totalDevices (unique devices across all ads)
    const expectedTotalDevices = allUniqueDevices.size;
    const actualTotalDevices = userAnalytics.totalDevices || 0;
    
    console.log(`\n📊 Verification Results:`);
    console.log(`   Expected totalDevices (unique): ${expectedTotalDevices}`);
    console.log(`   Actual totalDevices in DB: ${actualTotalDevices}`);
    console.log(`   Unique devices: ${Array.from(allUniqueDevices).join(', ')}`);
    
    if (expectedTotalDevices === actualTotalDevices) {
      console.log(`   ✅ CORRECT: totalDevices matches expected unique device count`);
    } else {
      console.log(`   ❌ INCORRECT: totalDevices should be ${expectedTotalDevices}, but is ${actualTotalDevices}`);
    }
    
    // Show the logic
    console.log(`\n📐 Logic Verification:`);
    console.log(`   - Counting UNIQUE devices across all ads (not sum)`);
    console.log(`   - Same device in multiple ads counts as 1`);
    console.log(`   - Example: Ad 1 has [001, 002], Ad 2 has [001, 003] → totalDevices = 3 (unique: 001, 002, 003)`);
    
    // Calculate sum (wrong way) for comparison
    let sumOfAdDevices = 0;
    adToDevicesMap.forEach((devices, adId) => {
      if (userAdIdSet.has(adId)) {
        sumOfAdDevices += devices.size;
      }
    });
    console.log(`\n   ⚠️  If we SUM devices per ad (WRONG): ${sumOfAdDevices}`);
    console.log(`   ✅ If we count UNIQUE devices (CORRECT): ${expectedTotalDevices}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  try {
    const userId = process.argv[2];
    if (!userId) {
      console.log('Usage: node src/scripts/verifyTotalDevicesLogic.js <userId>');
      console.log('Example: node src/scripts/verifyTotalDevicesLogic.js 6908ccb051b16db8fa237aba');
      process.exit(1);
    }
    
    await connectDB();
    await verifyLogic(userId);
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

module.exports = { verifyLogic };

