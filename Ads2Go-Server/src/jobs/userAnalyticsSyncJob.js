const cron = require('node-cron');
const UserAnalyticsService = require('../services/userAnalyticsService');
const UserAnalytics = require('../models/userAnalytics');
const User = require('../models/User');
const logger = require('../utils/logger');

class UserAnalyticsSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
  }

  // Start the sync job - runs every 3 minutes
  start() {
    if (this.isRunning) {
      console.log('⚠️ UserAnalyticsSyncJob is already running');
      return;
    }

    console.log('🚀 Starting UserAnalyticsSyncJob - will sync every 3 minutes');
    
    // Run immediately on start
    this.syncAllUsers();
    
    // Schedule to run every 3 minutes
    this.cronJob = cron.schedule('*/3 * * * *', () => {
      this.syncAllUsers();
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.isRunning = true;
  }

  // Stop the sync job
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 UserAnalyticsSyncJob stopped');
  }

  // Sync all users with fresh data from DeviceDataHistoryV2
  async syncAllUsers() {
    try {
      console.log('🔄 Starting UserAnalytics sync with DeviceDataHistoryV2...');
      const startTime = new Date();
      
      // Get all users
      const users = await User.find({}).select('_id firstName lastName');
      logger.database(`👥 Found ${users.length} users to sync`);

      if (users.length === 0) {
        console.log('❌ No users found for sync');
        return;
      }

      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      let successCount = 0;
      let errorCount = 0;

      // Sync each user
      for (const user of users) {
        try {
          logger.database(`🔄 Syncing user: ${user.firstName} ${user.lastName} (${user._id})`);
          
          // New: Sync using userId-based aggregations (no material mapping)
          const result = await this.syncUserByUserId(user._id.toString(), startDate, endDate);
          
          if (result.success) {
            successCount++;
            logger.database(`✅ Synced user ${user.firstName}: ${result.data?.totalAdPlays || 0} ad plays, ${result.data?.totalQRScans || 0} QR scans`);
          } else {
            errorCount++;
            console.log(`❌ Failed to sync user ${user.firstName}: ${result.message}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error syncing user ${user.firstName}:`, error.message);
        }
      }

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      logger.database(`🎉 UserAnalytics sync completed in ${duration.toFixed(2)}s`);
      logger.database(`   ✅ Success: ${successCount} users`);
      logger.database(`   ❌ Errors: ${errorCount} users`);
      
      this.lastSync = endTime;

    } catch (error) {
      console.error('❌ Error in UserAnalyticsSyncJob:', error);
    }
  }

  // Sync a specific user with their own materials only
  async syncUserWithAllMaterials(userId, startDate, endDate) {
    try {
      // Get user's PAID, DEPLOYED ads only (exclude deleted ads)
      const Ad = require('../models/Ad');
      const Material = require('../models/Material');
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] },
        // Explicitly exclude deleted ads (status: 'DELETED' or null/undefined)
        $and: [
          { status: { $ne: 'DELETED' } },
          { status: { $exists: true } }
        ]
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No paid, deployed ads found for this user'
        };
      }

      // Get all materials associated with user's ads using targetDevices
      const materialIds = [];
      for (const ad of userAds) {
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          // Multi-device ad: use all target devices
          ad.targetDevices.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
            }
          });
        } else if (ad.materialId && ad.materialId.length > 0) {
          // Multi-device ad: use all materials from materialId array
          ad.materialId.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
            }
          });
        }
      }

      if (materialIds.length === 0) {
        return {
          success: false,
          message: 'No materials found for this user\'s ads'
        };
      }
      
      // Get fresh data from DeviceDataHistoryV2 for user's materials only
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      
      // Convert materialIds to string materialIds for DeviceDataHistoryV2 query
      const materials = await Material.find({ _id: { $in: materialIds } });
      const stringMaterialIds = materials.map(m => m.materialId);
      
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: stringMaterialIds }
        // Temporarily remove date filtering to ensure we get data
        // 'dailyData.date': {
        //   $gte: new Date(startDate),
        //   $lte: new Date(endDate)
        // }
      });

      if (historicalData.length === 0) {
        return {
          success: false,
          message: 'No historical data found for user\'s materials'
        };
      }

      // Get valid ad IDs for this user to filter playbacks
      const validAdIds = userAds.map(ad => ad._id.toString());
      
      // Process the data
      const processedData = {
        userId,
        totalMaterials: materialIds.length,
        totalDevices: historicalData.length,
        totalAdPlays: 0,
        totalAdPlayTime: 0,
        totalAdImpressions: 0,
        totalQRScans: 0,
        ads: {},
        materials: {},
        materialBreakdown: {} // New: Clear breakdown by material
      };

      // Process each material's data
      historicalData.forEach(materialData => {
        const materialId = materialData.materialId;
        processedData.materials[materialId] = {
          materialId,
          carGroupId: materialData.carGroupId,
          totalAdPlays: 0,
          totalAdPlayTime: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          adPlaybacks: [],
          qrScans: [],
          locationHistory: [],
          dailyData: []
        };

        // Initialize material breakdown
        processedData.materialBreakdown[materialId] = {
          materialId,
          carGroupId: materialData.carGroupId,
          totalAdPlays: 0,
          totalAdPlayTime: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          ads: {},
          lastActivity: null,
          isOnline: false,
          totalDays: 0
        };

        // Process daily data
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(startDate) && dailyDate <= new Date(endDate)) {
              // Calculate user-specific totals from playbacks and QR scans
              let userAdPlays = 0;
              let userAdPlayTime = 0;
              let userAdImpressions = 0;
              let userQRScans = 0;
              
              // Calculate totals from user-owned playbacks only
              if (dailyData.adPlaybacks && dailyData.adPlaybacks.length > 0) {
                const userOwnedPlaybacks = dailyData.adPlaybacks.filter(playback => 
                  validAdIds.includes(playback.adId)
                );
                userAdPlays = userOwnedPlaybacks.length;
                userAdPlayTime = userOwnedPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0);
                userAdImpressions = userOwnedPlaybacks.reduce((sum, playback) => sum + (playback.impressions || 0), 0);
              }
              
              // Calculate totals from user-owned QR scans only
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                const userOwnedQrScans = dailyData.qrScans.filter(qrScan => 
                  validAdIds.includes(qrScan.adId)
                );
                userQRScans = userOwnedQrScans.length;
              }
              
              // Add to material totals (user's data only)
              processedData.materials[materialId].totalAdPlays += userAdPlays;
              processedData.materials[materialId].totalAdPlayTime += userAdPlayTime;
              processedData.materials[materialId].totalAdImpressions += userAdImpressions;
              processedData.materials[materialId].totalQRScans += userQRScans;
              
              // Add to material breakdown (user's data only)
              processedData.materialBreakdown[materialId].totalAdPlays += userAdPlays;
              processedData.materialBreakdown[materialId].totalAdPlayTime += userAdPlayTime;
              processedData.materialBreakdown[materialId].totalAdImpressions += userAdImpressions;
              processedData.materialBreakdown[materialId].totalQRScans += userQRScans;
              processedData.materialBreakdown[materialId].totalDays += 1;
              
              // Update last activity
              if (!processedData.materialBreakdown[materialId].lastActivity || dailyDate > processedData.materialBreakdown[materialId].lastActivity) {
                processedData.materialBreakdown[materialId].lastActivity = dailyDate;
              }
              
              // Add to overall totals (user's data only)
              processedData.totalAdPlays += userAdPlays;
              processedData.totalAdPlayTime += userAdPlayTime;
              processedData.totalAdImpressions += userAdImpressions;
              processedData.totalQRScans += userQRScans;
              
              // Collect user-owned ad playbacks for detailed tracking
              if (dailyData.adPlaybacks && dailyData.adPlaybacks.length > 0) {
                const userOwnedPlaybacks = dailyData.adPlaybacks.filter(playback => 
                  validAdIds.includes(playback.adId)
                );
                
                if (userOwnedPlaybacks.length > 0) {
                  processedData.materials[materialId].adPlaybacks.push(...userOwnedPlaybacks);
                  
                  // Group by ad (only user's ads)
                  userOwnedPlaybacks.forEach(playback => {
                    const adId = playback.adId;
                    if (!processedData.ads[adId]) {
                      processedData.ads[adId] = {
                        adId,
                        adTitle: playback.adTitle || 'Unknown',
                        totalPlays: 0,
                        totalViewTime: 0,
                        totalImpressions: 0,
                        materials: []
                      };
                    }
                    processedData.ads[adId].totalPlays += 1;
                    processedData.ads[adId].totalViewTime += playback.viewTime || 0;
                    processedData.ads[adId].totalImpressions += playback.impressions || 0;
                    
                    if (!processedData.ads[adId].materials.includes(materialId)) {
                      processedData.ads[adId].materials.push(materialId);
                    }
                  });
                }
              }
              
              // Collect user-owned QR scans for detailed tracking
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                const userOwnedQrScans = dailyData.qrScans.filter(qrScan => 
                  validAdIds.includes(qrScan.adId)
                );
                
                if (userOwnedQrScans.length > 0) {
                  processedData.materials[materialId].qrScans.push(...userOwnedQrScans);
                }
              }
              
              // Collect location history
              if (dailyData.locationHistory && dailyData.locationHistory.length > 0) {
                processedData.materials[materialId].locationHistory.push(...dailyData.locationHistory);
              }
              
              // Store daily data
              processedData.materials[materialId].dailyData.push(dailyData);
            }
          });
        }
      });

      // Convert ads object to array (already filtered by user ownership above)
      const filteredAds = Object.values(processedData.ads);
      
      const adsArray = filteredAds.map(ad => ({
        ...ad,
        totalMaterials: ad.materials.length,
        averageViewTime: ad.totalPlays > 0 ? ad.totalViewTime / ad.totalPlays : 0,
        completionRate: ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.totalPlays * 30))) * 100 : 0
      }));

      // Calculate overall averages
      const averageAdCompletionRate = adsArray.length > 0 
        ? adsArray.reduce((sum, ad) => sum + ad.completionRate, 0) / adsArray.length 
        : 0;
      
      const qrScanConversionRate = processedData.totalAdImpressions > 0 
        ? (processedData.totalQRScans / processedData.totalAdImpressions) * 100 
        : 0;

      // Update or create UserAnalytics document
      let userAnalytics = await UserAnalytics.findOne({ userId });
      
      if (!userAnalytics) {
        userAnalytics = new UserAnalytics({
          userId,
          ads: [],
          totalAds: 0,
          totalMaterials: 0,
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
          adPerformance: [],
          errorLogs: [],
          isActive: true
        });
      } else {
        // Clean up stale ad data - remove ads that no longer exist or are deleted
        const validAdIds = userAds.map(ad => ad._id.toString());
        
        // Filter ads array
        const originalAdsCount = userAnalytics.ads.length;
        userAnalytics.ads = userAnalytics.ads.filter(ad => validAdIds.includes(ad.adId.toString()));
        
        // Filter adPerformance array
        const originalPerformanceCount = userAnalytics.adPerformance.length;
        userAnalytics.adPerformance = userAnalytics.adPerformance.filter(ad => validAdIds.includes(ad.adId.toString()));
        
        const cleanedAds = originalAdsCount - userAnalytics.ads.length;
        const cleanedPerformance = originalPerformanceCount - userAnalytics.adPerformance.length;
        
        if (cleanedAds > 0 || cleanedPerformance > 0) {
          console.log(`🧹 Cleaned up stale ad data for user ${userId}: ${cleanedAds} ads, ${cleanedPerformance} performance entries`);
        }
      }

      // Update with fresh data
      userAnalytics.totalMaterials = processedData.totalMaterials;
      userAnalytics.totalDevices = processedData.totalDevices;
      userAnalytics.totalAdPlays = processedData.totalAdPlays;
      userAnalytics.totalAdPlayTime = processedData.totalAdPlayTime;
      userAnalytics.totalAdImpressions = processedData.totalAdImpressions;
      userAnalytics.totalQRScans = processedData.totalQRScans;
      userAnalytics.averageAdCompletionRate = averageAdCompletionRate;
      userAnalytics.qrScanConversionRate = qrScanConversionRate;
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();

      // Add material breakdown for clear data source tracking
      userAnalytics.materialBreakdown = Object.values(processedData.materialBreakdown).map(material => ({
        materialId: material.materialId,
        carGroupId: material.carGroupId,
        totalAdPlays: material.totalAdPlays,
        totalAdPlayTime: material.totalAdPlayTime,
        totalAdImpressions: material.totalAdImpressions,
        totalQRScans: material.totalQRScans,
        totalDays: material.totalDays,
        lastActivity: material.lastActivity,
        isOnline: material.isOnline,
        averageDailyAdPlays: material.totalDays > 0 ? (material.totalAdPlays / material.totalDays).toFixed(2) : 0,
        averageDailyPlayTime: material.totalDays > 0 ? (material.totalAdPlayTime / material.totalDays).toFixed(2) : 0,
        qrScanRate: material.totalAdImpressions > 0 ? ((material.totalQRScans / material.totalAdImpressions) * 100).toFixed(2) : 0
      }));

      // Update ads array with complete data structure
      userAnalytics.ads = adsArray.map(ad => {
        // Get materials for this ad from targetDevices
        const adMaterials = [];
        const adMaterialPerformance = [];
        
        // Find the ad in userAds to get targetDevices
        const userAd = userAds.find(ua => ua._id.toString() === ad.adId);
        if (userAd && userAd.targetDevices && userAd.targetDevices.length > 0) {
          // Get material details for each target device
          userAd.targetDevices.forEach((materialId, index) => {
            const material = materials.find(m => m._id.toString() === materialId.toString());
            if (material) {
              adMaterials.push({
                materialId: material.materialId,
                materialType: material.materialType,
                slotNumber: index + 1,
                deviceId: material.materialId, // Use materialId as deviceId
                carGroupId: material.carGroupId || 'UNKNOWN',
                driverId: material.driverId || null,
                isOnline: false,
                currentLocation: null,
                networkStatus: { isOnline: false, lastSeen: new Date() },
                deviceInfo: null,
                adPlaybacks: [],
                totalAdPlayTime: 0,
                totalAdImpressions: 0,
                averageAdCompletionRate: 0,
                currentAd: null,
                qrScans: [],
                totalQRScans: 0,
                qrScanConversionRate: 0,
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
                createdAt: new Date(),
                updatedAt: new Date()
              });
              
              // Add material performance data
              adMaterialPerformance.push({
                materialId: material.materialId,
                slotNumber: index + 1,
                materialName: material.materialId,
                totalDevices: 1,
                onlineDevices: 0,
                totalAdPlayTime: 0,
                totalAdImpressions: 0,
                totalQRScans: 0,
                averageCompletionRate: 0,
                lastActivity: new Date()
              });
            }
          });
        }
        
        return {
          adId: ad.adId,
          adTitle: ad.adTitle,
          adDeploymentId: null,
          totalMaterials: adMaterials.length,
          totalDevices: adMaterials.length,
          totalAdPlayTime: ad.totalViewTime,
          totalAdImpressions: ad.totalImpressions,
          totalQRScans: 0, // Will be calculated from materials
          averageAdCompletionRate: ad.completionRate,
          qrScanConversionRate: 0, // Will be calculated from materials
          materials: adMaterials,
          materialPerformance: adMaterialPerformance,
          errorLogs: [],
          isActive: true,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      userAnalytics.totalAds = userAnalytics.ads.length;

      // Save the updated analytics
      await userAnalytics.save();

      return {
        success: true,
        message: 'User analytics synced with fresh data from DeviceDataHistoryV2',
        data: {
          userId,
          totalMaterials: processedData.totalMaterials,
          totalDevices: processedData.totalDevices,
          totalAdPlays: processedData.totalAdPlays,
          totalAdPlayTime: processedData.totalAdPlayTime,
          totalAdImpressions: processedData.totalAdImpressions,
          totalQRScans: processedData.totalQRScans,
          averageAdCompletionRate,
          qrScanConversionRate,
          ads: adsArray.length,
          lastUpdated: new Date()
        }
      };

    } catch (error) {
      console.error('Error syncing user with all materials:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // New: Sync a specific user by aggregating directly via userId
  async syncUserByUserId(userId, startDate, endDate) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const UserAnalytics = require('../models/userAnalytics');

      // Aggregate daily stats (user-scoped)
      const [dailyFacet] = await DeviceDataHistoryV2.aggregate([
        { $match: { 'dailyData.date': { $gte: startDate, $lte: endDate } } },
        { $project: {
            materialId: 1,
            dailyData: {
              $filter: { input: '$dailyData', cond: { $and: [ { $gte: ['$$this.date', startDate] }, { $lte: ['$$this.date', endDate] } ] } }
            }
          }
        },
        { $facet: {
            adPerf: [
              { $unwind: '$dailyData' },
              { $unwind: '$dailyData.adPerformance' },
              { $match: { 'dailyData.adPerformance.userId': userId } },
              { $group: {
                  _id: null,
                  totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
                  totalPlayTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
                  totalAdsPlayed: { $sum: '$dailyData.adPerformance.playCount' }
                }
              }
            ],
            deviceStats: [
              { $unwind: '$dailyData' },
              { $unwind: '$dailyData.adPerformance' },
              { $match: { 'dailyData.adPerformance.userId': userId } },
              { $group: {
                  _id: '$materialId',
                  impressions: { $sum: '$dailyData.adPerformance.impressions' },
                  adsPlayed: { $sum: '$dailyData.adPerformance.playCount' },
                  displayTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
                  lastActivity: { $max: '$dailyData.date' }
                }
              }
            ],
            qr: [
              { $unwind: '$dailyData' },
              { $unwind: { path: '$dailyData.qrScans', preserveNullAndEmptyArrays: true } },
              { $match: { 'dailyData.qrScans.userId': userId } },
              { $group: { _id: null, totalQRScans: { $sum: 1 } } }
            ],
           dailyPerf: [
             { $unwind: '$dailyData' },
             { $unwind: '$dailyData.adPerformance' },
             { $match: { 'dailyData.adPerformance.userId': userId } },
             { $group: {
                 _id: { $dateToString: { format: '%Y-%m-%d', date: '$dailyData.date' } },
                 impressions: { $sum: '$dailyData.adPerformance.impressions' },
                 adsPlayed: { $sum: '$dailyData.adPerformance.playCount' },
                 displayTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
                 completionRate: { $avg: '$dailyData.adPerformance.completionRate' }
               }
             },
             { $sort: { _id: 1 } }
           ],
           dailyQR: [
             { $unwind: '$dailyData' },
             { $unwind: { path: '$dailyData.qrScans', preserveNullAndEmptyArrays: true } },
             { $match: { 'dailyData.qrScans.userId': userId } },
             { $group: {
                 _id: { $dateToString: { format: '%Y-%m-%d', date: '$dailyData.qrScans.scanTimestamp' } },
                 qrScans: { $sum: 1 }
               }
             },
             { $sort: { _id: 1 } }
           ]
         }
        }
      ]);

      const adPerf = dailyFacet?.adPerf?.[0] || { totalImpressions: 0, totalPlayTime: 0, totalAdsPlayed: 0 };
      const totalQRScans = dailyFacet?.qr?.[0]?.totalQRScans || 0;
      const deviceStats = dailyFacet?.deviceStats || [];

      // Merge daily performance with daily QR into dailyStats
      const dailyPerfMap = new Map((dailyFacet?.dailyPerf || []).map(d => [d._id, d]));
      const dailyQRMap = new Map((dailyFacet?.dailyQR || []).map(d => [d._id, d.qrScans]));
      const allDates = Array.from(new Set([ ...dailyPerfMap.keys(), ...dailyQRMap.keys() ])).sort();
      const dailyStats = allDates.map(dateStr => {
        const perf = dailyPerfMap.get(dateStr) || {};
        return {
          date: dateStr,
          impressions: perf.impressions || 0,
          adsPlayed: perf.adsPlayed || 0,
          displayTime: perf.displayTime || 0,
          qrScans: dailyQRMap.get(dateStr) || 0,
          completionRate: perf.completionRate || 0
        };
      });

      // Get ALL user's active paid ads (including SCHEDULED) for dropdown
      const Ad = require('../models/Ad');
      const allUserAds = await Ad.find({
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title');
      
      // Build ads array with ALL active paid ads (even those with no data yet)
      const adsArray = allUserAds.map(ad => ({
        adId: ad._id.toString(),
        adTitle: ad.title,
        totalMaterials: 0,
        totalDevices: 0,
        totalAdPlayTime: 0,
        totalAdImpressions: 0,
        totalQRScans: 0,
        averageAdCompletionRate: 0,
        qrScanConversionRate: 0,
        lastUpdated: new Date().toISOString(),
        materials: []
      }));

      // Upsert summary AND ads array into UserAnalytics
      const summaryUpdate = {
        $set: {
          summary: {
            totalAdImpressions: adPerf.totalImpressions || 0,
            totalAdPlays: adPerf.totalAdsPlayed || 0,
            totalAdPlayTime: adPerf.totalPlayTime || 0,
            totalQRScans: totalQRScans || 0,
            totalDevices: deviceStats.length
          },
          ads: adsArray,  // ← Now includes ALL active paid ads
          totalAds: adsArray.length,
          dailyStats: dailyStats,
          lastUpdated: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        $setOnInsert: {
          totalMaterials: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
          adPerformance: [],
          errorLogs: []
        }
      };

      await UserAnalytics.updateOne({ userId }, summaryUpdate, { upsert: true });

      return {
        success: true,
        message: 'User analytics summary synced by userId',
        data: {
          userId,
          totalAdImpressions: adPerf.totalImpressions || 0,
          totalAdPlayTime: adPerf.totalPlayTime || 0,
          totalAdPlays: adPerf.totalAdsPlayed || 0,
          totalQRScans: totalQRScans || 0,
          totalDevices: deviceStats.length
        }
      };
    } catch (error) {
      console.error('Error syncing user by userId:', error);
      return { success: false, message: error.message };
    }
  }

  // Get sync status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      nextSync: this.cronJob ? this.cronJob.nextDate() : null
    };
  }
}

// Create singleton instance
const userAnalyticsSyncJob = new UserAnalyticsSyncJob();

module.exports = userAnalyticsSyncJob;
