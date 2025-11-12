/**
 * Fix UserAnalytics Collection - Correct totalDevices Count
 * 
 * This script fixes the totalDevices field in the UserAnalytics collection
 * by counting only devices where ads are actively deployed (RUNNING or SCHEDULED status)
 * instead of using the targetDevices array which may contain inactive devices.
 * 
 * Usage: node src/scripts/fixUserAnalyticsTotalDevices.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');

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

/**
 * Fix totalDevices for a single user
 */
async function fixUserAnalytics(userAnalytics) {
  try {
    const userId = userAnalytics.userId;
    const userName = userAnalytics.userName || 'Unknown';
    
    // Get user's active ads (RUNNING or APPROVED, PAID, ACTIVE)
    const userAds = await Ad.find({
      userId: userId,
      paymentStatus: 'PAID',
      adStatus: 'ACTIVE',
      status: { $in: ['RUNNING', 'APPROVED'] },
    }).select('_id title');
    
    if (!userAds || userAds.length === 0) {
      console.log(`   ⚠️  No active ads found for user ${userName} (${userId})`);
      // Set totalDevices to 0 if no active ads
      userAnalytics.totalDevices = 0;
      userAnalytics.ads = [];
      await userAnalytics.save();
      return { userId, userName, totalDevices: 0, adsCount: 0 };
    }
    
    // Get active deployments for all user's ads
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
      'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
    }).select('materialId lcdSlots');
    
    // Create a map of adId -> set of materialIds where it's actively deployed
    const adToActiveDevicesMap = new Map();
    activeDeployments.forEach(deployment => {
      deployment.lcdSlots.forEach(slot => {
        if (['RUNNING', 'SCHEDULED'].includes(slot.status)) {
          const adIdStr = slot.adId.toString();
          if (!adToActiveDevicesMap.has(adIdStr)) {
            adToActiveDevicesMap.set(adIdStr, new Set());
          }
          adToActiveDevicesMap.get(adIdStr).add(deployment.materialId);
        }
      });
    });
    
    // ✅ Calculate totalDevices: count UNIQUE devices across all ads (not sum - same device in multiple ads counts as 1)
    // Example: Ad 1 has devices [001, 002], Ad 2 has devices [001, 003] → totalDevices = 3 (unique: 001, 002, 003)
    const allUniqueDeviceIds = new Set();
    const adsWithDeviceCounts = [];
    
    userAds.forEach(userAd => {
      const adIdStr = userAd._id.toString();
      const activeDeviceIds = adToActiveDevicesMap.get(adIdStr) || new Set();
      const deviceCount = activeDeviceIds.size;
      
      // Add all devices from this ad to the unique set
      activeDeviceIds.forEach(deviceId => {
        allUniqueDeviceIds.add(deviceId);
      });
      
      adsWithDeviceCounts.push({
        adId: adIdStr,
        adTitle: userAd.title,
        deviceCount: deviceCount,
        devices: Array.from(activeDeviceIds)
      });
    });
    
    const totalDevices = allUniqueDeviceIds.size;
    
    // Update the ads array in UserAnalytics with correct totalDevices
    if (userAnalytics.ads && userAnalytics.ads.length > 0) {
      userAnalytics.ads = userAnalytics.ads.map(ad => {
        const adIdStr = ad.adId?.toString();
        const activeDeviceIds = adToActiveDevicesMap.get(adIdStr) || new Set();
        return {
          ...ad.toObject ? ad.toObject() : ad,
          totalDevices: activeDeviceIds.size
        };
      });
    }
    
    // Update totalDevices
    const oldTotalDevices = userAnalytics.totalDevices || 0;
    userAnalytics.totalDevices = totalDevices;
    
    // Remove totalMaterials if it exists (deprecated field)
    // Use direct MongoDB update to ensure field is removed
    if (userAnalytics.totalMaterials !== undefined) {
      userAnalytics.totalMaterials = undefined;
      userAnalytics.$unset = userAnalytics.$unset || {};
      userAnalytics.$unset.totalMaterials = '';
    }
    
    await userAnalytics.save();
    
    // ✅ Force remove totalMaterials using direct MongoDB update (always remove it)
    await UserAnalytics.updateOne(
      { _id: userAnalytics._id },
      { $unset: { totalMaterials: '' } }
    );
    
    const changed = oldTotalDevices !== totalDevices;
    const changeIndicator = changed ? '🔄' : '✓';
    
    console.log(`   ${changeIndicator} ${userName}: ${oldTotalDevices} → ${totalDevices} devices (${userAds.length} ads)`);
    if (changed && adsWithDeviceCounts.length > 0) {
      adsWithDeviceCounts.forEach(({ adTitle, deviceCount, devices }) => {
        console.log(`      - ${adTitle}: ${deviceCount} device(s) ${devices.length > 0 ? `(${devices.join(', ')})` : ''}`);
      });
    }
    
    return {
      userId,
      userName,
      totalDevices,
      oldTotalDevices,
      adsCount: userAds.length,
      changed
    };
  } catch (error) {
    console.error(`   ❌ Error fixing user ${userAnalytics.userName || userAnalytics.userId}:`, error.message);
    return {
      userId: userAnalytics.userId,
      userName: userAnalytics.userName || 'Unknown',
      error: error.message
    };
  }
}

/**
 * Main function to fix all UserAnalytics documents
 */
async function fixAllUserAnalytics() {
  try {
    console.log('\n🔧 Starting UserAnalytics totalDevices fix...\n');
    
    // Get all UserAnalytics documents
    const allUserAnalytics = await UserAnalytics.find({}).lean();
    console.log(`📊 Found ${allUserAnalytics.length} UserAnalytics documents to process\n`);
    
    if (allUserAnalytics.length === 0) {
      console.log('✅ No UserAnalytics documents found. Nothing to fix.');
      return;
    }
    
    const results = [];
    let fixedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    
    // Process each user
    for (let i = 0; i < allUserAnalytics.length; i++) {
      const userAnalyticsDoc = await UserAnalytics.findById(allUserAnalytics[i]._id);
      if (!userAnalyticsDoc) continue;
      
      console.log(`[${i + 1}/${allUserAnalytics.length}] Processing user...`);
      const result = await fixUserAnalytics(userAnalyticsDoc);
      results.push(result);
      
      if (result.error) {
        errorCount++;
      } else if (result.changed) {
        fixedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processed: ${results.length}`);
    console.log(`✅ Fixed (changed): ${fixedCount}`);
    console.log(`✓  Unchanged: ${unchangedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // Show users with changes
    const changedUsers = results.filter(r => r.changed);
    if (changedUsers.length > 0) {
      console.log('\n🔄 Users with corrected totalDevices:');
      changedUsers.forEach(({ userName, oldTotalDevices, totalDevices }) => {
        console.log(`   ${userName}: ${oldTotalDevices} → ${totalDevices}`);
      });
    }
    
    // ✅ Final step: Remove totalMaterials from ALL documents using bulk update
    console.log('\n🧹 Removing totalMaterials field from all documents...');
    const bulkUpdateResult = await UserAnalytics.updateMany(
      { totalMaterials: { $exists: true } },
      { $unset: { totalMaterials: '' } }
    );
    console.log(`   ✅ Removed totalMaterials from ${bulkUpdateResult.modifiedCount} document(s)\n`);
    
    console.log('\n✅ Fix completed!\n');
    
  } catch (error) {
    console.error('❌ Error in fixAllUserAnalytics:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await connectDB();
    await fixAllUserAnalytics();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixUserAnalytics, fixAllUserAnalytics };

