/**
 * Fix UserAnalytics Collection - Populate Materials Array and Fix totalDevices
 * 
 * This script fixes the materials array and totalDevices in the UserAnalytics collection
 * by querying AdsDeployment to find actively deployed devices for each ad.
 * 
 * Usage: node src/scripts/fixUserAnalyticsMaterialsAndDevices.js
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

/**
 * Fix materials array and totalDevices for a single user
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
      return { userId, userName, totalDevices: 0, adsCount: 0, materialsFixed: 0 };
    }
    
    // Get active deployments for all user's ads
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
      'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
    }).select('materialId lcdSlots');
    
    // Create a map of adId -> Map of materialId -> slotNumber where it's actively deployed
    const adToActiveDevicesMap = new Map();
    const allActiveMaterialIds = new Set();
    
    // Create set of user ad IDs for quick lookup
    const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
    
    activeDeployments.forEach(deployment => {
      deployment.lcdSlots.forEach(slot => {
        if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
          // Ensure adId is converted to string consistently
          const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
          
          // ✅ Only process slots for ads that belong to this user
          if (userAdIdSet.has(adIdStr)) {
            if (!adToActiveDevicesMap.has(adIdStr)) {
              adToActiveDevicesMap.set(adIdStr, new Map());
            }
            // Store materialId with its slot number
            adToActiveDevicesMap.get(adIdStr).set(deployment.materialId, slot.slotNumber || 1);
            allActiveMaterialIds.add(deployment.materialId);
          }
        }
      });
    });
    
    // Query Material documents by materialId (string) for all actively deployed devices
    const activeMaterials = await Material.find({ 
      materialId: { $in: Array.from(allActiveMaterialIds) } 
    });
    
    // Update the ads array with materials and correct totalDevices
    let materialsFixed = 0;
    const adsWithDeviceCounts = [];
    
    userAnalytics.ads = userAds.map(userAd => {
      const adIdStr = userAd._id.toString();
      const existingAd = userAnalytics.ads.find(a => a.adId?.toString() === adIdStr);
      
      // Get actively deployed devices for this ad
      const activeDeviceMap = adToActiveDevicesMap.get(adIdStr) || new Map();
      const activeDeviceEntries = Array.from(activeDeviceMap.entries());
      
      // Build materials array from active deployments
      const adMaterials = [];
      const adMaterialPerformance = [];
      
      activeDeviceEntries.forEach(([materialIdStr, slotNumber]) => {
        const material = activeMaterials.find(m => m.materialId === materialIdStr);
        if (material) {
          adMaterials.push({
            materialId: material.materialId,
            materialType: material.materialType || 'HEADDRESS',
            slotNumber: slotNumber,
            deviceId: material.materialId,
            carGroupId: material.carGroupId || 'UNKNOWN',
            driverId: material.driverId || null,
            isOnline: false,
            currentLocation: null,
            networkStatus: { isOnline: false, lastSeen: new Date() },
            deviceInfo: null,
            adPlaybacks: [],
            totalAdPlayTime: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalAdPlayTime || 0,
            totalAdImpressions: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalAdImpressions || 0,
            averageAdCompletionRate: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.averageAdCompletionRate || 0,
            currentAd: null,
            qrScans: [],
            totalQRScans: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalQRScans || 0,
            lastQRScan: null,
            qrScansByAd: [],
            totalDistanceTraveled: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            uptimePercentage: 0,
            complianceRate: 0,
            averageDailyHours: 0,
            totalInteractions: 0,
            totalScreenTaps: 0,
            totalDebugActivations: 0,
            dailySessions: [],
            locationHistory: [],
            isActive: true,
            lastSeen: new Date(),
            createdAt: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.createdAt || new Date(),
            updatedAt: new Date()
          });
          
          adMaterialPerformance.push({
            materialId: material.materialId,
            slotNumber: slotNumber,
            materialName: material.materialId,
            totalDevices: 1,
            onlineDevices: 0,
            totalAdPlayTime: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalAdPlayTime || 0,
            totalAdImpressions: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalAdImpressions || 0,
            totalQRScans: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.totalQRScans || 0,
            averageCompletionRate: existingAd?.materials?.find(m => m.materialId === materialIdStr)?.averageAdCompletionRate || 0,
            lastActivity: new Date()
          });
        }
      });
      
      const deviceCount = adMaterials.length;
      // Don't sum here - we'll count unique devices at the end
      if (deviceCount > 0) materialsFixed += deviceCount;
      
      adsWithDeviceCounts.push({
        adId: adIdStr,
        adTitle: userAd.title,
        deviceCount: deviceCount,
        devices: Array.from(activeDeviceMap.keys())
      });
      
      // ✅ Create new ad object - explicitly exclude totalMaterials
      const newAd = {
        adId: adIdStr,
        adTitle: userAd.title || existingAd?.adTitle || 'Unknown',
        adDeploymentId: existingAd?.adDeploymentId || null,
        totalDevices: deviceCount,
        materials: adMaterials, // ✅ Populate materials array
        materialPerformance: adMaterialPerformance,
        // Preserve existing data that should be kept
        totalAdPlayTime: existingAd?.totalAdPlayTime || 0,
        totalAdImpressions: existingAd?.totalAdImpressions || 0,
        totalQRScans: existingAd?.totalQRScans || 0,
        averageAdCompletionRate: existingAd?.averageAdCompletionRate || 0,
        errorLogs: existingAd?.errorLogs || [],
        isActive: true,
        lastUpdated: new Date(),
        createdAt: existingAd?.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      // ✅ Explicitly remove totalMaterials if it exists
      if (newAd.totalMaterials !== undefined) {
        delete newAd.totalMaterials;
      }
      
      return newAd;
    });
    
    // ✅ Calculate totalDevices: Count UNIQUE devices across all ads (not sum)
    // Same device appearing in multiple ads should only be counted once
    // Example: Ad 1 has [001, 002], Ad 2 has [001, 003] → totalDevices = 3 (unique: 001, 002, 003)
    // Count unique devices from adToActiveDevicesMap (source of truth)
    const uniqueDeviceSet = new Set();
    adToActiveDevicesMap.forEach((deviceMap, adId) => {
      // All entries in the map are already for this user's ads (filtered when building the map)
      deviceMap.forEach((slotNumber, materialId) => {
        uniqueDeviceSet.add(materialId);
      });
    });
    const uniqueTotalDevices = uniqueDeviceSet.size;
    
    // Update totalDevices
    const oldTotalDevices = userAnalytics.totalDevices || 0;
    userAnalytics.totalDevices = uniqueTotalDevices;
    
    // ✅ Remove summary.totalMaterials if it exists (deprecated field)
    if (userAnalytics.summary && userAnalytics.summary.totalMaterials !== undefined) {
      delete userAnalytics.summary.totalMaterials;
      // If summary is now empty, remove it entirely
      if (Object.keys(userAnalytics.summary).length === 0) {
        userAnalytics.summary = undefined;
      }
    }
    
    await userAnalytics.save();
    
    const changed = oldTotalDevices !== uniqueTotalDevices || materialsFixed > 0;
    const changeIndicator = changed ? '🔄' : '✓';
    
    console.log(`   ${changeIndicator} ${userName}: ${oldTotalDevices} → ${uniqueTotalDevices} devices (${userAds.length} ads, ${materialsFixed} materials)`);
    if (changed && adsWithDeviceCounts.length > 0) {
      adsWithDeviceCounts.forEach(({ adTitle, deviceCount, devices }) => {
        if (deviceCount > 0) {
          console.log(`      - ${adTitle}: ${deviceCount} device(s) ${devices.length > 0 ? `(${devices.join(', ')})` : ''}`);
        }
      });
    }
    
    return {
      userId,
      userName,
      totalDevices: uniqueTotalDevices,
      oldTotalDevices,
      adsCount: userAds.length,
      materialsFixed,
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
    console.log('\n🔧 Starting UserAnalytics materials array and totalDevices fix...\n');
    
    // Get all UserAnalytics documents
    const allUserAnalytics = await UserAnalytics.find({});
    console.log(`📊 Found ${allUserAnalytics.length} UserAnalytics documents to process\n`);
    
    if (allUserAnalytics.length === 0) {
      console.log('✅ No UserAnalytics documents found. Nothing to fix.');
      return;
    }
    
    const results = [];
    let fixedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    let totalMaterialsFixed = 0;
    
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
        totalMaterialsFixed += result.materialsFixed || 0;
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
    console.log(`   - Total materials populated: ${totalMaterialsFixed}`);
    console.log(`✓  Unchanged: ${unchangedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // Show users with changes
    const changedUsers = results.filter(r => r.changed);
    if (changedUsers.length > 0) {
      console.log('\n🔄 Users with corrected data:');
      changedUsers.forEach(({ userName, oldTotalDevices, totalDevices, materialsFixed }) => {
        console.log(`   ${userName}: ${oldTotalDevices} → ${totalDevices} devices (${materialsFixed || 0} materials)`);
      });
    }
    
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

