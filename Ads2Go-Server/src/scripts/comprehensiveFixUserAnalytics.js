/**
 * Comprehensive fix script for UserAnalytics
 * This script:
 * 1. Fixes totalDevices (counts unique devices from active deployments)
 * 2. Populates materials array for each ad
 * 3. Filters materialBreakdown to only include actively deployed devices
 * 4. Removes totalMaterials from all locations (ad objects, summary, root)
 * 5. Ensures all data is consistent
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');

async function comprehensiveFix() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const allUsers = await UserAnalytics.find({}).select('userId userName ads summary materialBreakdown totalDevices');
    console.log(`\n📊 Found ${allUsers.length} users to process\n`);

    let fixedCount = 0;
    let totalDevicesFixed = 0;
    let materialsFixed = 0;
    let materialBreakdownFixed = 0;
    let totalMaterialsRemoved = 0;

    for (let i = 0; i < allUsers.length; i++) {
      const userAnalytics = allUsers[i];
      const userId = userAnalytics.userId;
      const userName = userAnalytics.userName || 'Unknown';

      console.log(`[${i + 1}/${allUsers.length}] Processing ${userName}...`);

      let changed = false;
      const changes = [];

      // Get user's active ads
      const userAds = await Ad.find({
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title');

      if (userAds.length === 0) {
        // No active ads - clear everything
        if (userAnalytics.totalDevices !== 0) {
          userAnalytics.totalDevices = 0;
          changed = true;
          changes.push('totalDevices: set to 0');
        }
        if (userAnalytics.materialBreakdown && userAnalytics.materialBreakdown.length > 0) {
          userAnalytics.materialBreakdown = [];
          changed = true;
          changes.push('materialBreakdown: cleared');
        }
        if (userAnalytics.ads && userAnalytics.ads.length > 0) {
          userAnalytics.ads = [];
          changed = true;
          changes.push('ads: cleared');
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

        // Calculate unique totalDevices
        const uniqueTotalDevices = allActiveMaterialIds.size;
        const oldTotalDevices = userAnalytics.totalDevices || 0;
        
        if (oldTotalDevices !== uniqueTotalDevices) {
          userAnalytics.totalDevices = uniqueTotalDevices;
          changed = true;
          changes.push(`totalDevices: ${oldTotalDevices} → ${uniqueTotalDevices}`);
          totalDevicesFixed++;
        }

        // Get Material documents for actively deployed devices
        const activeMaterials = await Material.find({
          materialId: { $in: Array.from(allActiveMaterialIds) }
        });

        // Update ads array with materials
        if (!userAnalytics.ads || !Array.isArray(userAnalytics.ads)) {
          userAnalytics.ads = [];
        }

        const updatedAds = userAds.map(userAd => {
          const adIdStr = userAd._id.toString();
          const existingAd = userAnalytics.ads.find(a => {
            const existingAdId = a.adId?.toString ? a.adId.toString() : String(a.adId || '');
            return existingAdId === adIdStr;
          });
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
            totalMaterialsRemoved++;
            changed = true;
            changes.push(`ad.totalMaterials: removed from ad ${adIdStr}`);
          }

          // Check if materials array was empty and now has items
          const existingMaterialsCount = existingAd?.materials?.length || 0;
          if (existingMaterialsCount === 0 && adMaterials.length > 0) {
            materialsFixed++;
            changed = true;
            changes.push(`materials: populated for ad ${adIdStr} (${adMaterials.length} devices)`);
          } else if (existingMaterialsCount !== adMaterials.length) {
            changed = true;
            changes.push(`materials: updated for ad ${adIdStr} (${existingMaterialsCount} → ${adMaterials.length})`);
          }

          return newAd;
        });

        userAnalytics.ads = updatedAds;

        // Filter materialBreakdown to only include actively deployed devices
        const beforeCount = userAnalytics.materialBreakdown?.length || 0;
        if (allActiveMaterialIds.size > 0) {
          userAnalytics.materialBreakdown = (userAnalytics.materialBreakdown || []).filter(
            material => allActiveMaterialIds.has(material.materialId)
          );
        } else {
          userAnalytics.materialBreakdown = [];
        }
        const afterCount = userAnalytics.materialBreakdown.length;
        if (beforeCount !== afterCount) {
          changed = true;
          changes.push(`materialBreakdown: ${beforeCount} → ${afterCount}`);
          materialBreakdownFixed++;
        }
      }

      // Remove summary.totalMaterials
      if (userAnalytics.summary && userAnalytics.summary.totalMaterials !== undefined) {
        delete userAnalytics.summary.totalMaterials;
        if (Object.keys(userAnalytics.summary).length === 0) {
          userAnalytics.summary = undefined;
        }
        changed = true;
        totalMaterialsRemoved++;
        changes.push('summary.totalMaterials: removed');
      }

      // Remove root-level totalMaterials
      if (userAnalytics.totalMaterials !== undefined) {
        userAnalytics.totalMaterials = undefined;
        changed = true;
        totalMaterialsRemoved++;
        changes.push('root.totalMaterials: removed');
      }

      if (changed) {
        // Use direct MongoDB update to ensure totalMaterials is removed
        await UserAnalytics.updateOne(
          { _id: userAnalytics._id },
          {
            $set: {
              totalDevices: userAnalytics.totalDevices,
              ads: userAnalytics.ads,
              materialBreakdown: userAnalytics.materialBreakdown,
              summary: userAnalytics.summary
            },
            $unset: {
              totalMaterials: '',
              'summary.totalMaterials': '',
              'ads.$[].totalMaterials': ''
            }
          }
        );
        
        fixedCount++;
        console.log(`   🔄 ${userName}: ${changes.join(', ')}`);
      } else {
        console.log(`   ✓ ${userName}: No changes needed`);
      }
    }

    console.log('\n============================================================');
    console.log('📊 COMPREHENSIVE FIX SUMMARY');
    console.log('============================================================');
    console.log(`Total processed: ${allUsers.length}`);
    console.log(`✅ Fixed (changed): ${fixedCount}`);
    console.log(`✓  Unchanged: ${allUsers.length - fixedCount}`);
    console.log(`📦 totalDevices fixed: ${totalDevicesFixed}`);
    console.log(`📦 Materials arrays populated: ${materialsFixed}`);
    console.log(`📦 materialBreakdown filtered: ${materialBreakdownFixed}`);
    console.log(`🗑️  totalMaterials removed: ${totalMaterialsRemoved}`);
    console.log('\n✅ Comprehensive fix completed!');

    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

comprehensiveFix();

