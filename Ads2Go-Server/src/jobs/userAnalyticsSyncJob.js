const cron = require('node-cron');
const UserAnalyticsService = require('../services/userAnalyticsService');
const UserAnalytics = require('../models/userAnalytics');
const User = require('../models/User');
const DailyUserAnalytics = require('../models/dailyUserAnalytics');
const UserAnalyticsSummary = require('../models/userAnalyticsSummary');
const logger = require('../utils/logger');

class UserAnalyticsSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
    this.isSyncing = false; // Track if a sync operation is currently running
  }

  // 🔥 NEW: Update flat collections (DailyUserAnalytics & UserAnalyticsSummary)
  async updateFlatCollections(userAnalytics) {
    try {
      const mongoose = require('mongoose');
      const userId = userAnalytics.userId;
      
      console.log(`📊 [FLAT SYNC] Updating flat collections for user ${userId}...`);
      
      // 1. Update DailyUserAnalytics (flatten nested dailyStats)
      const dailyDocs = [];
      for (const dayData of userAnalytics.dailyStats || []) {
        for (const ad of dayData.ads || []) {
          dailyDocs.push({
            userId: new mongoose.Types.ObjectId(userId),
            date: dayData.date,
            adId: new mongoose.Types.ObjectId(ad.adId),
            adsPlayed: ad.totals?.adsPlayed || 0,
            displayTime: ad.totals?.displayTime || 0,
            qrScans: ad.totals?.qrScans || 0,
            impressions: ad.totals?.impressions || 0,
            completionRate: ad.totals?.completionRate || 0,
            materialStats: ad.materials?.map(m => ({
              materialId: m.materialId,
              adsPlayed: m.adsPlayed,
              displayTime: m.displayTime,
              qrScans: m.qrScans
            })) || [],
            lastUpdated: new Date(),
            dataSource: 'sync'
          });
        }
      }
      
      if (dailyDocs.length > 0) {
        // Delete old dailyUserAnalytics for this user and replace with new ones
        await DailyUserAnalytics.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
        await DailyUserAnalytics.insertMany(dailyDocs, { ordered: false });
        console.log(`✅ [FLAT SYNC] Updated ${dailyDocs.length} daily analytics records`);
      }
      
      // 2. Update UserAnalyticsSummary (aggregate data)
      const summaryData = {
        userId: new mongoose.Types.ObjectId(userId),
        userName: userAnalytics.userName || null,
        totalAdsPlayed: userAnalytics.totalAdPlays || 0,
        totalDisplayTime: userAnalytics.totalAdPlayTime || 0,
        totalQRScans: userAnalytics.totalQRScans || 0,
        totalAdImpressions: userAnalytics.totalAdImpressions || 0,
        totalAds: userAnalytics.totalAds || 0,
        totalDevices: userAnalytics.totalDevices || 0,
        averageAdCompletionRate: userAnalytics.averageAdCompletionRate || 0,
        ads: (userAnalytics.ads || []).map(ad => ({
          adId: new mongoose.Types.ObjectId(ad.adId),
          adTitle: ad.adTitle,
          totalPlays: ad.totalAdPlays || (ad.totalAdPlayTime ? Math.round(ad.totalAdPlayTime / 35) : 0),
          totalQRScans: ad.totalQRScans || 0,
          totalDisplayTime: ad.totalAdPlayTime || 0,
          totalImpressions: ad.totalAdImpressions || 0,
          averageCompletionRate: ad.averageAdCompletionRate || 0,
          lastActivity: ad.lastActivity || null
        })),
        materialBreakdown: (userAnalytics.materialBreakdown || []).map(m => ({
          materialId: m.materialId,
          carGroupId: m.carGroupId || null,
          totalAdPlays: m.totalAdPlays || 0,
          totalAdPlayTime: m.totalAdPlayTime || 0,
          totalQRScans: m.totalQRScans || 0,
          lastActivity: m.lastActivity || null,
          isOnline: m.isOnline || false
        })),
        lastUpdated: new Date(),
        lastSyncTimestamp: new Date()
      };
      
      console.log(`📊 [FLAT SYNC] Summary data for ${userId}:`, {
        adsCount: summaryData.ads.length,
        efficascentQRScans: summaryData.ads.find(a => String(a.adId) === '695bbb2fefe78bace15c6e7f')?.totalQRScans
      });
      
      const result = await UserAnalyticsSummary.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        { $set: summaryData },
        { upsert: true, new: true }
      );
      
      console.log(`✅ [FLAT SYNC] Updated user analytics summary for user ${userId}`, {
        resultExists: !!result,
        adsCount: result?.ads?.length
      });
      
    } catch (error) {
      console.error('❌ [FLAT SYNC] Error updating flat collections:', error);
      // Don't throw - we don't want to break the main sync if flat collection update fails
    }
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Smart sync with active/inactive user separation
  // Start the sync job - runs smart sync (active users frequently, inactive users rarely)
  start() {
    if (this.isRunning) {
      console.log('⚠️ UserAnalyticsSyncJob is already running');
      return;
    }

    console.log('🚀 Starting UserAnalyticsSyncJob - Real-time sync mode');
    console.log('   - Active users: Every 30 seconds (real-time)');
    console.log('   - Inactive users: Every hour');
    
    // Run immediately on start
    this.syncActiveUsers();
    
    // ⚡ REAL-TIME: Sync active users every 30 seconds for near real-time updates
    this.activeUsersCronJob = cron.schedule('*/30 * * * * *', () => {
      this.syncActiveUsers();
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });
    
    // ⚡ PERFORMANCE OPTIMIZATION: Sync inactive users less frequently (hourly)
    this.inactiveUsersCronJob = cron.schedule('0 * * * *', () => {
      this.syncInactiveUsers();
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.isRunning = true;
  }

  // Stop the sync job
  stop() {
    if (this.activeUsersCronJob) {
      this.activeUsersCronJob.destroy();
      this.activeUsersCronJob = null;
    }
    if (this.inactiveUsersCronJob) {
      this.inactiveUsersCronJob.destroy();
      this.inactiveUsersCronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 UserAnalyticsSyncJob stopped');
  }

  // ⚡ REAL-TIME: Sync a specific user immediately (called when data changes)
  async syncUserImmediately(userId) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId).select('_id firstName lastName lastAnalyticsAccess');
      
      if (!user) {
        console.log(`⚠️ [REALTIME] User ${userId} not found, skipping sync`);
        return;
      }

      console.log(`⚡ [REALTIME] Triggering immediate sync for user ${user.firstName} (${userId})`);
      const startTime = new Date();
      
      const UserAnalyticsService = require('../services/userAnalyticsService');
      const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(
        userId.toString(),
        null, // startDate - will use incremental sync
        null, // endDate
        null, // adId
        false // forceFullSync = false (use incremental for speed)
      );
      
      const duration = (Date.now() - startTime) / 1000;
      if (result.success) {
        console.log(`✅ [REALTIME] User ${user.firstName} synced in ${duration.toFixed(2)}s: ${result.data?.totalQRScans || 0} QR scans`);
      } else {
        console.log(`⚠️ [REALTIME] User ${user.firstName} sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ [REALTIME] Error syncing user ${userId}:`, error.message);
    }
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Sync active users (accessed analytics in last 24 hours)
  async syncActiveUsers() {
    if (this.isSyncing) {
      console.log('⏭️ Skipping active users sync - previous sync still running');
      return;
    }

    this.isSyncing = true;
    
    try {
      console.log('⚡ [ACTIVE] Starting active users sync...');
      const startTime = new Date();
      
      // Get active users (accessed analytics in last 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const activeUsers = await User.find({
        $or: [
          { lastAnalyticsAccess: { $gte: twentyFourHoursAgo } },
          { 'lastAnalyticsAccess': { $exists: false } } // Include users who never accessed (new users)
        ]
      }).select('_id firstName lastName lastAnalyticsAccess').limit(100); // Limit to prevent overload
      
      logger.database(`👥 [ACTIVE] Found ${activeUsers.length} active users to sync`);

      if (activeUsers.length === 0) {
        console.log('ℹ️ [ACTIVE] No active users found for sync');
        return;
      }

      // Use incremental sync for active users (faster)
      await this.syncUsersBatch(activeUsers, true); // true = incremental sync
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      logger.database(`✅ [ACTIVE] Active users sync completed in ${duration.toFixed(2)}s`);
      
      this.lastSync = endTime;

    } catch (error) {
      console.error('❌ [ACTIVE] Error in active users sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Sync inactive users (haven't accessed analytics recently)
  async syncInactiveUsers() {
    if (this.isSyncing) {
      console.log('⏭️ Skipping inactive users sync - previous sync still running');
      return;
    }

    this.isSyncing = true;
    
    try {
      console.log('⏰ [INACTIVE] Starting inactive users sync...');
      const startTime = new Date();
      
      // Get inactive users (haven't accessed analytics in last 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const inactiveUsers = await User.find({
        lastAnalyticsAccess: { $lt: twentyFourHoursAgo }
      }).select('_id firstName lastName lastAnalyticsAccess').limit(50); // Limit inactive users
      
      logger.database(`👥 [INACTIVE] Found ${inactiveUsers.length} inactive users to sync`);

      if (inactiveUsers.length === 0) {
        console.log('ℹ️ [INACTIVE] No inactive users found for sync');
        return;
      }

      // Use incremental sync for inactive users too (still faster than full sync)
      await this.syncUsersBatch(inactiveUsers, true); // true = incremental sync
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      logger.database(`✅ [INACTIVE] Inactive users sync completed in ${duration.toFixed(2)}s`);
      
      this.lastSync = endTime;

    } catch (error) {
      console.error('❌ [INACTIVE] Error in inactive users sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // 🔥 NEW: Sync all users (for manual trigger)
  async syncAllUsers() {
    console.log('🔄 Manual sync triggered - syncing ALL users...');
    
    if (this.isSyncing) {
      console.log('⏭️ Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    
    try {
      const startTime = new Date();
      
      // Get all users with ads
      const User = require('../models/User');
      const Ad = require('../models/Ad');
      
      const usersWithAds = await Ad.distinct('userId', {
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false
      });
      
      const users = await User.find({ _id: { $in: usersWithAds } })
        .select('_id firstName lastName')
        .lean();
      
      console.log(`👥 Found ${users.length} users with active ads to sync`);
      
      if (users.length === 0) {
        console.log('ℹ️ No users found for sync');
        return { success: true, message: 'No users to sync' };
      }

      // Sync all users (full sync)
      await this.syncUsersBatch(users, false); // false = full sync, not incremental
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.log(`✅ Manual sync completed in ${duration.toFixed(2)}s`);
      
      this.lastSync = endTime;
      
      return { 
        success: true, 
        message: `Successfully synced ${users.length} users`,
        duration: `${duration.toFixed(2)}s`
      };

    } catch (error) {
      console.error('❌ Error in manual sync:', error);
      return { success: false, message: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Sync users in batch with parallel processing
  async syncUsersBatch(users, useIncrementalSync = true) {
    const startTime = new Date();
    let successCount = 0;
    let errorCount = 0;
    
    // Calculate date range (last 7 days for incremental, all time for full)
    const endDate = new Date();
    const startDate = useIncrementalSync 
      ? null // Will use lastSyncTimestamp from UserAnalytics (incremental)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    // ⚡ PERFORMANCE OPTIMIZATION: Process users in parallel (batches of 5)
    const batchSize = 5;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (user) => {
        try {
          logger.database(`🔄 Syncing user: ${user.firstName} ${user.lastName} (${user._id})`);
          
          // Use incremental sync via UserAnalyticsService
          if (useIncrementalSync) {
            const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(
              user._id.toString(), 
              startDate, 
              endDate,
              null, // adId
              false // forceFullSync = false (use incremental)
            );
            
            if (result.success) {
              successCount++;
              logger.database(`✅ Synced user ${user.firstName}: ${result.data?.totalAdPlays || 0} ad plays, ${result.data?.totalQRScans || 0} QR scans`);
            } else {
              errorCount++;
              console.log(`❌ Failed to sync user ${user.firstName}: ${result.message}`);
            }
          } else {
            // Fallback to old method for full sync
            const result = await this.syncUserByUserId(user._id.toString(), startDate, endDate);
            
            if (result.success) {
              successCount++;
              logger.database(`✅ Synced user ${user.firstName}: ${result.data?.totalAdPlays || 0} ad plays, ${result.data?.totalQRScans || 0} QR scans`);
            } else {
              errorCount++;
              console.log(`❌ Failed to sync user ${user.firstName}: ${result.message}`);
            }
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error syncing user ${user.firstName}:`, error.message);
        }
      });
      
      // Wait for batch to complete before starting next batch
      await Promise.all(batchPromises);
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    logger.database(`🎉 Batch sync completed in ${duration.toFixed(2)}s`);
    logger.database(`   ✅ Success: ${successCount} users`);
    logger.database(`   ❌ Errors: ${errorCount} users`);
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
        isArchived: false,  // ✅ Exclude archived/deleted ads
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
      // ✅ NOTE: totalDevices will be calculated from active deployments later, not from historicalData.length
      const processedData = {
        userId,
        totalDevices: 0, // ✅ Will be calculated from active deployments, not historical data length
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
                        totalQRScans: 0,  // ✅ Initialize QR scans counter
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
                  
                  // ✅ Aggregate QR scans per ad
                  userOwnedQrScans.forEach(qrScan => {
                    const adId = qrScan.adId;
                    if (!processedData.ads[adId]) {
                      processedData.ads[adId] = {
                        adId,
                        adTitle: qrScan.adTitle || 'Unknown',
                        totalPlays: 0,
                        totalViewTime: 0,
                        totalImpressions: 0,
                        totalQRScans: 0,
                        materials: []
                      };
                    }
                    if (!processedData.ads[adId].totalQRScans) {
                      processedData.ads[adId].totalQRScans = 0;
                    }
                    processedData.ads[adId].totalQRScans += 1;
                  });
                }
              }
              
              // ✅ Also process qrScansByAd if available (aggregated format)
              if (dailyData.qrScansByAd && dailyData.qrScansByAd.length > 0) {
                dailyData.qrScansByAd.forEach(adScan => {
                  // ✅ FIX: Normalize adId to string for comparison (handles ObjectId vs string)
                  const adId = adScan.adId ? (adScan.adId.toString ? adScan.adId.toString() : String(adScan.adId)) : null;
                  const adIdStr = adId;
                  
                  // #region agent log
                  // DISABLED: Debug logging
                  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:656',message:'Processing qrScansByAd entry in sync job',data:{adIdStr,adTitle:adScan.adTitle,scanCount:adScan.scanCount||0,isValidAd:adIdStr?validAdIds.includes(adIdStr):false,validAdIdsSample:validAdIds.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                  // #endregion
                  
                  if (adIdStr && validAdIds.includes(adIdStr)) {
                    if (!processedData.ads[adIdStr]) {
                      processedData.ads[adIdStr] = {
                        adId: adScan.adId, // Keep original ObjectId format
                        adTitle: adScan.adTitle || 'Unknown',
                        totalPlays: 0,
                        totalViewTime: 0,
                        totalImpressions: 0,
                        totalQRScans: 0,
                        materials: []
                      };
                    }
                    if (!processedData.ads[adIdStr].totalQRScans) {
                      processedData.ads[adIdStr].totalQRScans = 0;
                    }
                    const previousCount = processedData.ads[adIdStr].totalQRScans || 0;
                    processedData.ads[adIdStr].totalQRScans += (adScan.scanCount || 0);
                    
                    // #region agent log
                    // DISABLED: Debug logging
                  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:675',message:'Added QR scans to ad in sync job',data:{adIdStr,adTitle:adScan.adTitle,scanCount:adScan.scanCount||0,previousCount,newCount:processedData.ads[adIdStr].totalQRScans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                    // #endregion
                  }
                });
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
        averageViewTime: ad.totalPlays > 0 ? ad.totalViewTime / ad.totalPlays : 0,
        completionRate: ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.totalPlays * 30))) * 100 : 0,
        totalQRScans: ad.totalQRScans || 0  // ✅ Include QR scan count per ad
      }));

      // Calculate overall averages
      const averageAdCompletionRate = adsArray.length > 0 
        ? adsArray.reduce((sum, ad) => sum + ad.completionRate, 0) / adsArray.length 
        : 0;
      
      // qrScanConversionRate removed - no longer needed

      // Update or create UserAnalytics document
      let userAnalytics = await UserAnalytics.findOne({ userId });
      
      if (!userAnalytics) {
        userAnalytics = new UserAnalytics({
          userId,
          ads: [],
          totalAds: 0,
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          // qrScanConversionRate removed
          errorLogs: [],
          isActive: true
        });
      } else {
        // Clean up stale ad data - remove ads that no longer exist or are deleted
        const validAdIds = userAds.map(ad => ad._id.toString());
        
        // Filter ads array
        const originalAdsCount = userAnalytics.ads.length;
        userAnalytics.ads = userAnalytics.ads.filter(ad => validAdIds.includes(ad.adId.toString()));
        
        const cleanedAds = originalAdsCount - userAnalytics.ads.length;
        
        if (cleanedAds > 0) {
          console.log(`🧹 Cleaned up stale ad data for user ${userId}: ${cleanedAds} ads removed`);
        }
      }

      // Update with fresh data (but don't calculate totalDevices yet - wait until ads array is updated)
      userAnalytics.totalAdPlays = processedData.totalAdPlays;
      userAnalytics.totalAdPlayTime = processedData.totalAdPlayTime;
      userAnalytics.totalAdImpressions = processedData.totalAdImpressions;
      userAnalytics.totalQRScans = processedData.totalQRScans;
      userAnalytics.averageAdCompletionRate = averageAdCompletionRate;
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();

      // ✅ Include ALL user's ads, even those without data (for consistency with service)
      // Create a map of ads with data for quick lookup
      const adsWithDataMap = new Map();
      adsArray.forEach(ad => {
        adsWithDataMap.set(ad.adId, ad);
      });
      
      // ✅ Get active deployments for all user ads to count actual deployed devices
      const AdsDeployment = require('../models/adsDeployment');
      const activeDeployments = await AdsDeployment.find({
        'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
        'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
      }).select('materialId lcdSlots');
      
      // Create a map of adId -> array of {materialId, slotNumber} where it's actively deployed
      const adToActiveDevicesMap = new Map();
      const allActiveMaterialIds = new Set(); // Collect all unique materialIds from active deployments
      activeDeployments.forEach(deployment => {
        deployment.lcdSlots.forEach(slot => {
          if (['RUNNING', 'SCHEDULED'].includes(slot.status)) {
            const adIdStr = slot.adId.toString();
            if (!adToActiveDevicesMap.has(adIdStr)) {
              adToActiveDevicesMap.set(adIdStr, new Map()); // Use Map to store materialId -> slotNumber
            }
            // Store materialId with its slot number
            adToActiveDevicesMap.get(adIdStr).set(deployment.materialId, slot.slotNumber || 1);
            allActiveMaterialIds.add(deployment.materialId); // Collect materialId for querying
          }
        });
      });
      
      // ✅ Query Material documents by materialId (string) for all actively deployed devices
      // This ensures we get material details even if they're not in targetDevices
      const activeMaterials = await Material.find({ 
        materialId: { $in: Array.from(allActiveMaterialIds) } 
      });
      
      // ✅ Log active deployments for debugging
      console.log(`✅ [SYNC-JOB] Found ${activeDeployments.length} active deployments for user ${userId}`);
      adToActiveDevicesMap.forEach((deviceMap, adId) => {
        const deviceList = Array.from(deviceMap.keys()).map(materialId => {
          const slotNum = deviceMap.get(materialId);
          return `${materialId} (slot ${slotNum})`;
        }).join(', ');
        console.log(`   Ad ${adId}: ${deviceMap.size} actively deployed device(s) - ${deviceList}`);
      });
      
      // ✅ Preserve existing materials data when updating ads array
      const existingAdsMapForSync = new Map();
      if (userAnalytics.ads && Array.isArray(userAnalytics.ads)) {
        userAnalytics.ads.forEach(existingAd => {
          const existingAdId = existingAd.adId?.toString ? existingAd.adId.toString() : String(existingAd.adId || '');
          if (existingAdId) {
            existingAdsMapForSync.set(existingAdId, existingAd);
          }
        });
      }
      
      // Update ads array with complete data structure - include ALL user's ads
      userAnalytics.ads = userAds.map(userAd => {
        const adId = userAd._id.toString();
        const ad = adsWithDataMap.get(adId);
        const existingAd = existingAdsMapForSync.get(adId);
        
        // ✅ Get actively deployed devices for this ad from AdsDeployment (not targetDevices)
        const activeDeviceMap = adToActiveDevicesMap.get(adId) || new Map();
        const activeDeviceEntries = Array.from(activeDeviceMap.entries()); // [materialId, slotNumber] pairs
        
        // Get materials for this ad from active deployments only
        const adMaterials = [];
        const adMaterialPerformance = [];
        
        // ✅ Preserve existing materials data if available
        const existingMaterialsMap = new Map();
        if (existingAd && existingAd.materials && Array.isArray(existingAd.materials)) {
          existingAd.materials.forEach(mat => {
            if (mat.materialId) {
              existingMaterialsMap.set(mat.materialId, mat);
            }
          });
        }
        
        // Find materials that match the actively deployed device IDs
        activeDeviceEntries.forEach(([materialIdStr, slotNumber]) => {
          // ✅ Query Material by materialId string (from AdsDeployment) - use activeMaterials array
          const material = activeMaterials.find(m => m.materialId === materialIdStr);
            if (material) {
            const existingMat = existingMaterialsMap.get(materialIdStr);
              adMaterials.push({
                materialId: material.materialId,
                materialType: material.materialType,
              slotNumber: slotNumber, // ✅ Use actual slot number from deployment
                deviceId: material.materialId, // Use materialId as deviceId
                carGroupId: material.carGroupId || 'UNKNOWN',
                driverId: material.driverId || null,
                isOnline: false,
                currentLocation: null,
                networkStatus: { isOnline: false, lastSeen: new Date() },
                deviceInfo: null,
                adPlaybacks: [],
              // ✅ Preserve existing performance data if available
              totalAdPlayTime: existingMat?.totalAdPlayTime || 0,
              totalAdImpressions: existingMat?.totalAdImpressions || 0,
              averageAdCompletionRate: existingMat?.averageAdCompletionRate || 0,
                currentAd: null,
                qrScans: [],
              totalQRScans: existingMat?.totalQRScans || 0,
                // qrScanConversionRate removed
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
              createdAt: existingMat?.createdAt || new Date(),
                updatedAt: new Date()
              });
              
              // Add material performance data
              adMaterialPerformance.push({
                materialId: material.materialId,
              slotNumber: slotNumber, // ✅ Use actual slot number from deployment
                materialName: material.materialId,
                totalDevices: 1,
                onlineDevices: 0,
              totalAdPlayTime: existingMat?.totalAdPlayTime || 0,
              totalAdImpressions: existingMat?.totalAdImpressions || 0,
              totalQRScans: existingMat?.totalQRScans || 0,
              averageCompletionRate: existingMat?.averageAdCompletionRate || 0,
                lastActivity: new Date()
              });
          } else {
            // ⚠️ Material not found - log for debugging
            console.log(`⚠️ [SYNC-JOB] Material not found for ad ${adId} (${userAd.title}): materialId=${materialIdStr}, slot=${slotNumber}`);
            console.log(`   Available materials: ${activeMaterials.map(m => m.materialId).join(', ') || 'none'}`);
            }
          });
        
        // ✅ Use QR scan data from aggregated processedData if available
        const totalQRScans = ad ? (ad.totalQRScans || 0) : (existingAd?.totalQRScans || 0);
        
        // ✅ Create new ad object - explicitly exclude totalMaterials
        const newAd = {
          adId: adId,
          adTitle: userAd.title || ad?.adTitle || existingAd?.adTitle || 'Unknown',
          adDeploymentId: existingAd?.adDeploymentId || null,
          // ✅ Calculate totalDevices: count of devices where ad is actively deployed (RUNNING or SCHEDULED)
          totalDevices: adMaterials.length,
          // ✅ Preserve existing ad performance data if available
          totalAdPlayTime: ad ? ad.totalViewTime : (existingAd?.totalAdPlayTime || 0),
          totalAdImpressions: ad ? ad.totalImpressions : (existingAd?.totalAdImpressions || 0),
          totalQRScans: totalQRScans, // ✅ Use aggregated QR scan count
          averageAdCompletionRate: ad ? ad.completionRate : (existingAd?.averageAdCompletionRate || 0),
          // qrScanConversionRate removed
          materials: adMaterials, // ✅ Populate materials array from active deployments
          materialPerformance: adMaterialPerformance,
          errorLogs: existingAd?.errorLogs || [],
          isActive: true,
          lastUpdated: new Date(),
          createdAt: existingAd?.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        // ✅ Explicitly remove totalMaterials if it exists (shouldn't, but be safe)
        if (newAd.totalMaterials !== undefined) {
          delete newAd.totalMaterials;
        }
        
        return newAd;
      });
      
      // ✅ FIX: Fetch QR scan data using getTotalQRScans (includes both DeviceTracking and DeviceDataHistoryV2)
      // This ensures we get complete QR scan data, including current day data from DeviceTracking
      try {
        const UserAnalyticsService = require('../services/userAnalyticsService');
        const qrScanData = await UserAnalyticsService.getTotalQRScans(userId, startDate, endDate);
        
        if (qrScanData.success && qrScanData.ads && qrScanData.ads.length > 0) {
          // Create a map of QR scan data by adId
          const qrScanMap = new Map();
          qrScanData.ads.forEach(qrAd => {
            const adId = qrAd.adId ? (qrAd.adId.toString ? qrAd.adId.toString() : String(qrAd.adId)) : '';
            if (adId) {
              qrScanMap.set(adId, qrAd.totalScans || 0);
              
              // #region agent log
              // DISABLED: Debug logging
              // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:951',message:'Mapping QR scan data from getTotalQRScans',data:{adId,adTitle:qrAd.adTitle||qrAd.adId,totalScans:qrAd.totalScans||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
              // #endregion
            }
          });
          
          // #region agent log
          // DISABLED: Debug logging
          // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:955',message:'Updating ads array with QR scan data',data:{qrScanMapSize:qrScanMap.size,qrScanMapEntries:Array.from(qrScanMap.entries()).map(([k,v])=>({adId:k,totalScans:v})),userAnalyticsAdsCount:userAnalytics.ads?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
          
          // Update ads array with QR scan data from getTotalQRScans
          userAnalytics.ads = userAnalytics.ads.map(ad => {
            const adId = ad.adId.toString ? ad.adId.toString() : String(ad.adId);
            const qrScans = qrScanMap.get(adId);
            const previousQRScans = ad.totalQRScans || 0;
            
            // #region agent log
            // DISABLED: Debug logging
            // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:958',message:'Updating ad with QR scan data',data:{adId,adTitle:ad.adTitle||ad.adId,previousQRScans,qrScansFromMap:qrScans,willUpdate:qrScans!==undefined&&qrScans>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
            // #endregion
            
            if (qrScans !== undefined && qrScans > 0) {
              // Use QR scan data from getTotalQRScans (more complete, includes current day)
              ad.totalQRScans = qrScans;
              
              // #region agent log
              // DISABLED: Debug logging
              // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userAnalyticsSyncJob.js:961',message:'Updated ad totalQRScans',data:{adId,adTitle:ad.adTitle||ad.adId,previousQRScans,newQRScans:ad.totalQRScans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
              // #endregion
            }
            return ad;
          });
          
          console.log(`✅ [SYNC-JOB] Updated QR scans from getTotalQRScans: ${qrScanData.totalScans} total scans across ${qrScanData.ads.length} ads`);
        }
      } catch (qrScanError) {
        console.warn(`⚠️ [SYNC-JOB] Error fetching QR scan data: ${qrScanError.message}`);
        // Continue with existing data if QR scan fetch fails
      }
      
      // ✅ Calculate user-level totalQRScans from ads array to ensure consistency
      const calculatedTotalQRScans = userAnalytics.ads.reduce((sum, ad) => sum + (ad.totalQRScans || 0), 0);
      if (calculatedTotalQRScans > 0) {
        userAnalytics.totalQRScans = calculatedTotalQRScans;
        console.log(`✅ [SYNC-JOB] Calculated totalQRScans from ads array: ${calculatedTotalQRScans}`);
      }

      userAnalytics.totalAds = userAnalytics.ads.length;
      
      // ✅ Calculate totalDevices: Count UNIQUE devices across all ads (not sum - same device in multiple ads counts as 1)
      // Example: Ad 1 has devices [001, 002], Ad 2 has devices [001, 003] → totalDevices = 3 (unique: 001, 002, 003)
      // ✅ Use adToActiveDevicesMap directly - this is the source of truth from AdsDeployment
      const allUniqueDeviceIds = new Set();
      adToActiveDevicesMap.forEach((deviceMap, adId) => {
        // Only count devices for ads that belong to this user
        if (userAds.some(ad => ad._id.toString() === adId)) {
          deviceMap.forEach((slotNumber, materialId) => {
            allUniqueDeviceIds.add(materialId);
          });
        }
      });
      
      userAnalytics.totalDevices = allUniqueDeviceIds.size;
      console.log(`✅ [SYNC-JOB] Calculated totalDevices (unique): ${userAnalytics.totalDevices} unique devices across ${userAnalytics.ads.length} ads`);
      
      // ✅ Filter materialBreakdown to only include actively deployed devices (matching totalDevices)
      // This ensures materialBreakdown.length === totalDevices (only currently active devices)
      userAnalytics.materialBreakdown = Object.values(processedData.materialBreakdown)
        .filter(material => allUniqueDeviceIds.has(material.materialId)) // ✅ Only include actively deployed devices
        .map(material => ({
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
      
      console.log(`✅ [SYNC-JOB] Filtered materialBreakdown: ${userAnalytics.materialBreakdown.length} active devices (matches totalDevices: ${userAnalytics.totalDevices})`);
      
      // ✅ Remove summary.totalMaterials if it exists (deprecated field)
      if (userAnalytics.summary && userAnalytics.summary.totalMaterials !== undefined) {
        delete userAnalytics.summary.totalMaterials;
        // If summary is now empty, remove it entirely
        if (Object.keys(userAnalytics.summary).length === 0) {
          userAnalytics.summary = undefined;
        }
      }
      
      // ✅ Remove totalMaterials from all ad objects
      if (userAnalytics.ads && Array.isArray(userAnalytics.ads)) {
        userAnalytics.ads.forEach(ad => {
          if (ad.totalMaterials !== undefined) {
            delete ad.totalMaterials;
          }
        });
      }
      
      // ✅ Remove root-level totalMaterials
      if (userAnalytics.totalMaterials !== undefined) {
        userAnalytics.totalMaterials = undefined;
      }

      // Save the updated analytics
      await userAnalytics.save();
      
      // ✅ Force remove totalMaterials using direct MongoDB update
      await UserAnalytics.updateOne(
        { _id: userAnalytics._id },
        {
          $unset: {
            totalMaterials: '',
            'summary.totalMaterials': ''
          }
        }
      );

      // 🔥 NEW: Also update flat collections (Phase 2)
      await this.updateFlatCollections(userAnalytics);

      return {
        success: true,
        message: 'User analytics synced with fresh data from DeviceDataHistoryV2',
        data: {
          userId,
          totalDevices: userAnalytics.totalDevices, // ✅ Use calculated totalDevices from active deployments, not processedData.totalDevices
          totalAdPlays: processedData.totalAdPlays,
          totalAdPlayTime: processedData.totalAdPlayTime,
          totalAdImpressions: processedData.totalAdImpressions,
          totalQRScans: processedData.totalQRScans,
          averageAdCompletionRate,
          // qrScanConversionRate removed
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

      // ✨ OPTIMIZATION: Use allowDiskUse to prevent memory crashes with large datasets
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
      ]).allowDiskUse(true); // ← CRITICAL: Prevents memory crashes by using disk for large datasets

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
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title');
      
      // ✅ Get active deployments to count UNIQUE devices (not deviceStats.length)
      const AdsDeployment = require('../models/adsDeployment');
      const activeDeployments = await AdsDeployment.find({
        'lcdSlots.adId': { $in: allUserAds.map(ad => ad._id) },
        'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
      }).select('materialId lcdSlots');
      
      // Create a map of adId -> unique devices (Set to avoid duplicates)
      const adToActiveDevicesMap = new Map();
      const allUniqueDeviceIds = new Set();
      const userAdIdSet = new Set(allUserAds.map(ad => ad._id.toString()));
      
      console.log(`🔍 [SYNC-BY-USER-ID] User has ${allUserAds.length} ads, checking ${activeDeployments.length} deployments`);
      
      activeDeployments.forEach(deployment => {
        deployment.lcdSlots.forEach(slot => {
          if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
            const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
            // Only count devices for ads that belong to this user
            if (userAdIdSet.has(adIdStr)) {
              allUniqueDeviceIds.add(deployment.materialId);
              if (!adToActiveDevicesMap.has(adIdStr)) {
                adToActiveDevicesMap.set(adIdStr, new Map());
              }
              adToActiveDevicesMap.get(adIdStr).set(deployment.materialId, slot.slotNumber || 1);
              console.log(`   ✅ Counting device ${deployment.materialId} for ad ${adIdStr}`);
            } else {
              console.log(`   ⚠️ Skipping device ${deployment.materialId} - ad ${adIdStr} not in user's ads`);
            }
          }
        });
      });
      
      console.log(`✅ [SYNC-BY-USER-ID] Calculated ${allUniqueDeviceIds.size} unique devices: ${Array.from(allUniqueDeviceIds).join(', ')}`);
      
      // ✅ Get Material documents for actively deployed devices
      const Material = require('../models/Material');
      const activeMaterials = await Material.find({ 
        materialId: { $in: Array.from(allUniqueDeviceIds) } 
      });
      
      // ✅ Get existing UserAnalytics to preserve materials arrays
      const existingUserAnalytics = await UserAnalytics.findOne({ userId }).select('ads materialBreakdown');
      const existingAdsMap = new Map();
      if (existingUserAnalytics && existingUserAnalytics.ads && Array.isArray(existingUserAnalytics.ads)) {
        existingUserAnalytics.ads.forEach(existingAd => {
          const existingAdId = existingAd.adId?.toString ? existingAd.adId.toString() : String(existingAd.adId || '');
          if (existingAdId) {
            existingAdsMap.set(existingAdId, existingAd);
          }
        });
      }
      
      // Build ads array with materials populated from active deployments
      const adsArray = allUserAds.map(ad => {
        const adIdStr = ad._id.toString();
        const existingAd = existingAdsMap.get(adIdStr);
        const activeDeviceMap = adToActiveDevicesMap.get(adIdStr) || new Map();
        const activeDeviceEntries = Array.from(activeDeviceMap.entries());
        
        // Build materials array for this ad
        const adMaterials = [];
        const adMaterialPerformance = [];
        
        // ✅ Preserve existing materials data if available
        const existingMaterialsMap = new Map();
        if (existingAd && existingAd.materials && Array.isArray(existingAd.materials)) {
          existingAd.materials.forEach(mat => {
            if (mat.materialId) {
              existingMaterialsMap.set(mat.materialId, mat);
            }
          });
        }
        
        activeDeviceEntries.forEach(([materialIdStr, slotNumber]) => {
          const material = activeMaterials.find(m => m.materialId === materialIdStr);
          if (material) {
            const existingMat = existingMaterialsMap.get(materialIdStr);
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
              // ✅ Preserve existing performance data if available
              totalAdPlayTime: existingMat?.totalAdPlayTime || 0,
              totalAdImpressions: existingMat?.totalAdImpressions || 0,
              averageAdCompletionRate: existingMat?.averageAdCompletionRate || 0,
              currentAd: null,
              qrScans: [],
              totalQRScans: existingMat?.totalQRScans || 0,
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
              createdAt: existingMat?.createdAt || new Date(),
              updatedAt: new Date()
            });
            
            adMaterialPerformance.push({
              materialId: material.materialId,
              slotNumber: slotNumber,
              materialName: material.materialId,
              totalDevices: 1,
              onlineDevices: 0,
              totalAdPlayTime: existingMat?.totalAdPlayTime || 0,
              totalAdImpressions: existingMat?.totalAdImpressions || 0,
              totalQRScans: existingMat?.totalQRScans || 0,
              averageCompletionRate: existingMat?.averageAdCompletionRate || 0,
              lastActivity: new Date()
            });
          }
        });
        
        const newAd = {
          adId: adIdStr,
        adTitle: ad.title,
          totalDevices: adMaterials.length,
          // ✅ Preserve existing ad performance data if available
          totalAdPlayTime: existingAd?.totalAdPlayTime || 0,
          totalAdImpressions: existingAd?.totalAdImpressions || 0,
          totalQRScans: existingAd?.totalQRScans || 0,
          averageAdCompletionRate: existingAd?.averageAdCompletionRate || 0,
        qrScanConversionRate: 0,
        lastUpdated: new Date().toISOString(),
          materials: adMaterials, // ✅ Populate materials array from active deployments
          materialPerformance: adMaterialPerformance,
          errorLogs: existingAd?.errorLogs || [],
          isActive: true,
          createdAt: existingAd?.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        // ✅ Explicitly remove totalMaterials if it exists (shouldn't, but be safe)
        if (newAd.totalMaterials !== undefined) {
          delete newAd.totalMaterials;
        }
        
        return newAd;
      });

      // Upsert ads array and totals into UserAnalytics
      // Note: summary field has been removed - using individual total fields instead
      const summaryUpdate = {
        $set: {
          ads: adsArray,  // ← Now includes ALL active paid ads
          totalAds: adsArray.length,
          totalAdImpressions: adPerf.totalImpressions || 0,
          totalAdPlays: adPerf.totalAdsPlayed || 0,
          totalAdPlayTime: adPerf.totalPlayTime || 0,
          totalQRScans: totalQRScans || 0,
          // ✅ Count UNIQUE devices from active deployments (not deviceStats.length)
          totalDevices: allUniqueDeviceIds.size,
          dailyStats: dailyStats,
          lastUpdated: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        $setOnInsert: {
          averageAdCompletionRate: 0,
          errorLogs: []
        },
        $unset: {
          summary: '',  // Explicitly remove summary field if it exists
          qrScanConversionRate: '',  // Explicitly remove qrScanConversionRate field if it exists
          'summary.totalMaterials': '',  // ✅ Explicitly remove summary.totalMaterials if it exists
          totalMaterials: '',  // ✅ Explicitly remove root-level totalMaterials if it exists
          'ads.$[].totalMaterials': ''  // ✅ Explicitly remove totalMaterials from all ad objects
        }
      };

      // ✅ Also filter materialBreakdown to only include actively deployed devices
      let filteredMaterialBreakdown = [];
      if (existingUserAnalytics && existingUserAnalytics.materialBreakdown) {
        filteredMaterialBreakdown = existingUserAnalytics.materialBreakdown.filter(
          material => allUniqueDeviceIds.has(material.materialId)
        );
      }
      
      summaryUpdate.$set.materialBreakdown = filteredMaterialBreakdown;

      await UserAnalytics.updateOne({ userId }, summaryUpdate, { upsert: true });

      // 🔥 NEW: Also update flat collections (Phase 2)
      const updatedUserAnalytics = await UserAnalytics.findOne({ userId }).lean();
      if (updatedUserAnalytics) {
        await this.updateFlatCollections(updatedUserAnalytics);
      }

      return {
        success: true,
        message: 'User analytics summary synced by userId',
        data: {
          userId,
          totalAdImpressions: adPerf.totalImpressions || 0,
          totalAdPlayTime: adPerf.totalPlayTime || 0,
          totalAdPlays: adPerf.totalAdsPlayed || 0,
          totalQRScans: totalQRScans || 0,
          // ✅ Count UNIQUE devices from active deployments (not deviceStats.length)
          totalDevices: allUniqueDeviceIds.size
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
      nextActiveSync: this.activeUsersCronJob ? this.activeUsersCronJob.nextDate() : null,
      nextInactiveSync: this.inactiveUsersCronJob ? this.inactiveUsersCronJob.nextDate() : null
    };
  }
}

// Create singleton instance
const userAnalyticsSyncJob = new UserAnalyticsSyncJob();

module.exports = userAnalyticsSyncJob;
