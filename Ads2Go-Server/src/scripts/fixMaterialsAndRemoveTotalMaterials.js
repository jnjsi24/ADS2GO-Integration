/**
 * Script to fix materials array in ads and remove totalMaterials from all documents
 * This script:
 * 1. Populates materials array for each ad based on active deployments
 * 2. Removes totalMaterials from ad objects
 * 3. Removes summary.totalMaterials
 * 4. Clears materialBreakdown when there are no active ads
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');

async function fixMaterialsAndRemoveTotalMaterials() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const allUsers = await UserAnalytics.find({}).select('userId userName ads summary materialBreakdown');
    console.log(`\n📊 Found ${allUsers.length} users to process\n`);

    let fixedCount = 0;
    let materialsFixed = 0;
    let totalMaterialsRemoved = 0;

    for (let i = 0; i < allUsers.length; i++) {
      const userAnalytics = allUsers[i];
      const userId = userAnalytics.userId;
      const userName = userAnalytics.userName || 'Unknown';

      console.log(`[${i + 1}/${allUsers.length}] Processing ${userName}...`);

      let changed = false;
      let adMaterialsFixed = 0;
      let adTotalMaterialsRemoved = 0;
      let allActiveMaterialIds = new Set();

      // Get user's active ads
      const userAds = await Ad.find({
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title');

      if (userAds.length === 0) {
        // No active ads - clear materialBreakdown and remove totalMaterials
        if (userAnalytics.materialBreakdown && userAnalytics.materialBreakdown.length > 0) {
          userAnalytics.materialBreakdown = [];
          changed = true;
          console.log(`   🔄 Cleared materialBreakdown (no active ads)`);
        }
      } else {
        // Get active deployments for user's ads
        const activeDeployments = await AdsDeployment.find({
          'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
          'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
        }).select('materialId lcdSlots');

        // Build map of adId -> Map of materialId -> slotNumber
        const adToActiveDevicesMap = new Map();
        const allActiveMaterialIds = new Set();
        const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));

        activeDeployments.forEach(deployment => {
          deployment.lcdSlots.forEach(slot => {
            if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
              const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
              if (userAdIdSet.has(adIdStr)) {
                if (!adToActiveDevicesMap.has(adIdStr)) {
                  adToActiveDevicesMap.set(adIdStr, new Map());
                }
                adToActiveDevicesMap.get(adIdStr).set(deployment.materialId, slot.slotNumber || 1);
                allActiveMaterialIds.add(deployment.materialId);
              }
            }
          });
        });

        // Get Material documents for actively deployed devices
        const activeMaterials = await Material.find({
          materialId: { $in: Array.from(allActiveMaterialIds) }
        });

        // Update ads array
        if (!userAnalytics.ads || !Array.isArray(userAnalytics.ads)) {
          userAnalytics.ads = [];
        }

        const updatedAds = userAds.map(userAd => {
          const adIdStr = userAd._id.toString();
          const existingAd = userAnalytics.ads.find(a => a.adId?.toString() === adIdStr);
          const activeDeviceMap = adToActiveDevicesMap.get(adIdStr) || new Map();
          const activeDeviceEntries = Array.from(activeDeviceMap.entries());

          // Build materials array for this ad
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
                totalAdPlayTime: existingAd?.totalAdPlayTime || 0,
                totalAdImpressions: existingAd?.totalAdImpressions || 0,
                averageAdCompletionRate: existingAd?.averageAdCompletionRate || 0,
                currentAd: null,
                qrScans: [],
                totalQRScans: existingAd?.totalQRScans || 0,
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
                createdAt: existingAd?.createdAt || new Date(),
                updatedAt: new Date()
              });

              adMaterialPerformance.push({
                materialId: material.materialId,
                slotNumber: slotNumber,
                materialName: material.materialId,
                totalDevices: 1,
                onlineDevices: 0,
                totalAdPlayTime: existingAd?.totalAdPlayTime || 0,
                totalAdImpressions: existingAd?.totalAdImpressions || 0,
                totalQRScans: existingAd?.totalQRScans || 0,
                averageCompletionRate: existingAd?.averageAdCompletionRate || 0,
                lastActivity: new Date()
              });
            }
          });

          const newAd = {
            adId: adIdStr,
            adTitle: userAd.title || existingAd?.adTitle || 'Unknown',
            adDeploymentId: existingAd?.adDeploymentId || null,
            totalDevices: adMaterials.length,
            materials: adMaterials,
            materialPerformance: adMaterialPerformance,
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

          // Remove totalMaterials if it exists
          if (newAd.totalMaterials !== undefined) {
            delete newAd.totalMaterials;
            adTotalMaterialsRemoved++;
            changed = true;
          }

          // Check if materials array was empty and now has items
          if ((!existingAd || !existingAd.materials || existingAd.materials.length === 0) && adMaterials.length > 0) {
            adMaterialsFixed++;
            changed = true;
          }

          return newAd;
        });

        userAnalytics.ads = updatedAds;
        materialsFixed += adMaterialsFixed;
        totalMaterialsRemoved += adTotalMaterialsRemoved;
      }

      // Remove summary.totalMaterials
      if (userAnalytics.summary && userAnalytics.summary.totalMaterials !== undefined) {
        delete userAnalytics.summary.totalMaterials;
        if (Object.keys(userAnalytics.summary).length === 0) {
          userAnalytics.summary = undefined;
        }
        changed = true;
        totalMaterialsRemoved++;
      }

      // Filter materialBreakdown to only include actively deployed devices
      if (userAds.length > 0 && allActiveMaterialIds && allActiveMaterialIds.size > 0) {
        const activeMaterialIdsSet = new Set(Array.from(allActiveMaterialIds));
        const beforeCount = userAnalytics.materialBreakdown?.length || 0;
        if (beforeCount > 0) {
          userAnalytics.materialBreakdown = (userAnalytics.materialBreakdown || []).filter(
            material => activeMaterialIdsSet.has(material.materialId)
          );
          const afterCount = userAnalytics.materialBreakdown.length;
          if (beforeCount !== afterCount) {
            changed = true;
            console.log(`   🔄 Filtered materialBreakdown: ${beforeCount} → ${afterCount}`);
          }
        }
      }

      if (changed) {
        await userAnalytics.save();
        fixedCount++;
        const changeIndicator = '🔄';
        console.log(`   ${changeIndicator} ${userName}: Fixed (${adMaterialsFixed} materials, ${adTotalMaterialsRemoved} totalMaterials removed)`);
      } else {
        console.log(`   ✓ ${userName}: No changes needed`);
      }
    }

    console.log('\n============================================================');
    console.log('📊 FIX SUMMARY');
    console.log('============================================================');
    console.log(`Total processed: ${allUsers.length}`);
    console.log(`✅ Fixed (changed): ${fixedCount}`);
    console.log(`✓  Unchanged: ${allUsers.length - fixedCount}`);
    console.log(`📦 Materials arrays populated: ${materialsFixed}`);
    console.log(`🗑️  totalMaterials removed: ${totalMaterialsRemoved}`);
    console.log('\n✅ Fix completed!');

    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixMaterialsAndRemoveTotalMaterials();

