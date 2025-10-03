const cron = require('node-cron');
const UserAnalyticsService = require('../services/userAnalyticsService');
const UserAnalytics = require('../models/userAnalytics');
const User = require('../models/User');

class UserAnalyticsSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
  }

  // Start the sync job - runs every 10 minutes
  start() {
    if (this.isRunning) {
      console.log('⚠️ UserAnalyticsSyncJob is already running');
      return;
    }

    console.log('🚀 Starting UserAnalyticsSyncJob - will sync every 10 minutes');
    
    // Run immediately on start
    this.syncAllUsers();
    
    // Schedule to run every 10 minutes
    this.cronJob = cron.schedule('*/10 * * * *', () => {
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
      console.log(`👥 Found ${users.length} users to sync`);

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
          console.log(`🔄 Syncing user: ${user.firstName} ${user.lastName} (${user._id})`);
          
          // For now, we'll use a simple approach - sync with all available materials
          // In a real implementation, you'd need to link users to their materials
          const result = await this.syncUserWithAllMaterials(user._id, startDate, endDate);
          
          if (result.success) {
            successCount++;
            console.log(`✅ Synced user ${user.firstName}: ${result.data?.totalAdPlays || 0} ad plays, ${result.data?.totalQRScans || 0} QR scans`);
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

      console.log(`🎉 UserAnalytics sync completed in ${duration.toFixed(2)}s`);
      console.log(`   ✅ Success: ${successCount} users`);
      console.log(`   ❌ Errors: ${errorCount} users`);
      
      this.lastSync = endTime;

    } catch (error) {
      console.error('❌ Error in UserAnalyticsSyncJob:', error);
    }
  }

  // Sync a specific user with all available materials
  async syncUserWithAllMaterials(userId, startDate, endDate) {
    try {
      // Get all materials from DeviceDataHistoryV2
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const materials = await DeviceDataHistoryV2.find({}).select('materialId carGroupId');
      
      if (materials.length === 0) {
        return {
          success: false,
          message: 'No materials found in DeviceDataHistoryV2'
        };
      }

      const materialIds = materials.map(m => m.materialId);
      
      // Get fresh data from DeviceDataHistoryV2 for all materials
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });

      if (historicalData.length === 0) {
        return {
          success: false,
          message: 'No historical data found for the specified date range'
        };
      }

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
        materials: {}
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

        // Process daily data
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(startDate) && dailyDate <= new Date(endDate)) {
              // Add to material totals
              processedData.materials[materialId].totalAdPlays += dailyData.totalAdPlays || 0;
              processedData.materials[materialId].totalAdPlayTime += dailyData.totalAdPlayTime || 0;
              processedData.materials[materialId].totalAdImpressions += dailyData.totalAdImpressions || 0;
              processedData.materials[materialId].totalQRScans += dailyData.totalQRScans || 0;
              
              // Add to overall totals
              processedData.totalAdPlays += dailyData.totalAdPlays || 0;
              processedData.totalAdPlayTime += dailyData.totalAdPlayTime || 0;
              processedData.totalAdImpressions += dailyData.totalAdImpressions || 0;
              processedData.totalQRScans += dailyData.totalQRScans || 0;
              
              // Collect ad playbacks
              if (dailyData.adPlaybacks && dailyData.adPlaybacks.length > 0) {
                processedData.materials[materialId].adPlaybacks.push(...dailyData.adPlaybacks);
                
                // Group by ad
                dailyData.adPlaybacks.forEach(playback => {
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
              
              // Collect QR scans
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                processedData.materials[materialId].qrScans.push(...dailyData.qrScans);
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

      // Convert ads object to array
      const adsArray = Object.values(processedData.ads).map(ad => ({
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
      }

      // Update with fresh data
      userAnalytics.totalMaterials = processedData.totalMaterials;
      userAnalytics.totalDevices = processedData.totalDevices;
      userAnalytics.totalAdPlayTime = processedData.totalAdPlayTime;
      userAnalytics.totalAdImpressions = processedData.totalAdImpressions;
      userAnalytics.totalQRScans = processedData.totalQRScans;
      userAnalytics.averageAdCompletionRate = averageAdCompletionRate;
      userAnalytics.qrScanConversionRate = qrScanConversionRate;
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();

      // Update ads array
      userAnalytics.ads = adsArray.map(ad => ({
        adId: ad.adId,
        adTitle: ad.adTitle,
        totalMaterials: ad.totalMaterials,
        totalDevices: 0,
        totalAdPlayTime: ad.totalViewTime,
        totalAdImpressions: ad.totalImpressions,
        totalQRScans: 0,
        averageAdCompletionRate: ad.completionRate,
        qrScanConversionRate: 0,
        materials: [],
        materialPerformance: [],
        errorLogs: [],
        isActive: true,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

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
