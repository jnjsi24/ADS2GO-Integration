const mongoose = require('mongoose');
const UserAnalytics = require('../models/userAnalytics');
const logger = require('../utils/logger');
const { getPhilippinesMidnight } = require('../utils/dateUtils');

// ✅ Helper to check if verbose logging is enabled
const isVerbose = () => process.env.VERBOSE_LOGS === 'true';

// Simple in-memory cache for analytics data
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL (increased from 30s for better performance)
const REALTIME_CACHE_TTL = 15 * 1000; // ✅ Reduced from 30s to 15s for faster QR scan updates (current day)

class UserAnalyticsService {
  
  // Cache utility functions
  static getCacheKey(userId, startDate, endDate, period, adId) {
    return `analytics_${userId}_${startDate || 'null'}_${endDate || 'null'}_${period || 'null'}_${adId || 'null'}`;
  }
  
  static getCachedData(cacheKey, isRealtimeView = false) {
    const cached = analyticsCache.get(cacheKey);
    if (cached) {
      // Use shorter TTL for real-time viewing (current day data)
      const ttl = isRealtimeView ? REALTIME_CACHE_TTL : CACHE_TTL;
      if ((Date.now() - cached.timestamp) < ttl) {
        if (isVerbose()) logger.verbose('📊 Cache hit for key:', cacheKey, isRealtimeView ? '(realtime)' : '(standard)');
        return cached.data;
      }
      analyticsCache.delete(cacheKey);
      if (isVerbose()) logger.verbose('📊 Cache expired for key:', cacheKey);
    }
    return null;
  }
  
  static setCachedData(cacheKey, data) {
    analyticsCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    if (isVerbose()) logger.verbose('📊 Cache set for key:', cacheKey);
  }
  
  static clearUserCache(userId) {
    for (const [key, value] of analyticsCache.entries()) {
      if (key.includes(`analytics_${userId}_`)) {
        analyticsCache.delete(key);
      }
    }
    if (isVerbose()) logger.verbose('📊 Cache cleared for user:', userId);
  }
  
  // Cache management utilities
  static getCacheStats() {
    return {
      size: analyticsCache.size,
      keys: Array.from(analyticsCache.keys()),
      memoryUsage: process.memoryUsage()
    };
  }
  
  static clearAllCache() {
    analyticsCache.clear();
    if (isVerbose()) logger.verbose('📊 All cache cleared');
  }
  
  // Update analytics when Android player sends data
  static async updateUserAnalytics(userId, adId, adTitle, materialId, slotNumber, deviceId, data) {
    try {
      // Get the material to find the material type
      const Material = mongoose.models.Material || require('../models/Material');
      const material = await Material.findOne({ materialId: materialId });
      const materialType = material ? material.materialType : 'HEADDRESS';
      
      // Use the new createOrUpdateUserAnalytics method
      const userAnalytics = await UserAnalytics.createOrUpdateUserAnalytics(
        userId,
        adId,
        adTitle,
        materialId,
        slotNumber,
        deviceId,
        {
          adDeploymentId: data.adDeploymentId,
          carGroupId: data.carGroupId,
          driverId: data.driverId,
          materialType: materialType,
          isOnline: data.isOnline,
          currentLocation: data.gpsData ? {
            type: 'Point',
            coordinates: [data.gpsData.lng, data.gpsData.lat],
            accuracy: data.gpsData.accuracy,
            speed: data.gpsData.speed,
            heading: data.gpsData.heading,
            altitude: data.gpsData.altitude,
            timestamp: new Date()
          } : null,
          networkStatus: {
            isOnline: data.networkStatus || false,
            lastSeen: new Date()
          },
          deviceInfo: data.deviceInfo
        }
      );

      // Clear cache for this user since data has been updated
      this.clearUserCache(userId);

      return userAnalytics;
    } catch (error) {
      console.error('Error updating user analytics:', error);
      throw error;
    }
  }
  
  // Get user analytics data - formatted for GraphQL
  static async getUserAnalytics(userId, startDate, endDate, period, adId = null, forceRealtime = null) {
    try {
      // ✅ NEW: Check environment variable for real-time mode (default: false)
      // Can be overridden by forceRealtime parameter
      const REALTIME_MODE = forceRealtime !== null 
        ? forceRealtime 
        : (process.env.USER_ANALYTICS_REALTIME === 'true');
      
      if (isVerbose()) logger.verbose('📊 getUserAnalytics called with:', { userId, startDate, endDate, period, adId, REALTIME_MODE });
      
      // Check cache first (include adId and realtime mode in cache key so filtered queries have separate cache)
      const cacheKey = this.getCacheKey(userId, startDate, endDate, period, adId) + (REALTIME_MODE ? '_realtime' : '_cached');
      
      // ✨ Detect if this is a real-time view (current day included)
      const now = new Date();
      // ✅ FIX: Also treat period='all' as real-time if it includes today (for faster QR scan updates)
      const isAllPeriodIncludingToday = period === 'all' && (!endDate || new Date(endDate).toDateString() === now.toDateString());
      const isRealtimeView = REALTIME_MODE || 
                            period === '1d' || 
                            period === '7d' || 
                            period === '30d' || 
                            isAllPeriodIncludingToday || // ✅ Treat 'all' period as real-time when viewing current day
                            (endDate && new Date(endDate).toDateString() === now.toDateString()) ||
                            (!endDate && !period); // Default queries include today
      
      // ✅ Skip cache if real-time mode is enabled (always fetch fresh data)
      const cachedData = REALTIME_MODE ? null : this.getCachedData(cacheKey, isRealtimeView);
      if (cachedData) {
        if (isVerbose()) logger.verbose('📊 Returning cached data for cache key:', cacheKey);
        return cachedData;
      }
      
      if (REALTIME_MODE) {
        console.log('⚡ [REALTIME] Real-time mode enabled - fetching directly from DeviceDataHistoryV2 and DeviceTracking (bypassing UserAnalytics cache)');
      }
      
      // Check if we should return cumulative totals (for "All Devices" view)
      // For 'all' period, we want to use the same logic as other periods but with wide date range
      // ✅ If startDate and endDate are provided (custom date range), don't treat as cumulative
      const hasCustomDateRange = startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime());
      const shouldReturnCumulative = (!period || period === 'cumulative') && !hasCustomDateRange;
      const isAllPeriod = period === 'all';
      console.log('🔍 Period analysis:', {
        period: period,
        shouldReturnCumulative: shouldReturnCumulative,
        hasCustomDateRange: hasCustomDateRange,
        periodType: typeof period,
        periodValue: JSON.stringify(period),
        startDate: startDate,
        endDate: endDate
      });
      
      // Calculate date ranges based on period if startDate/endDate are not provided
      let defaultStartDate, defaultEndDate;
      
      if (shouldReturnCumulative) {
        // For cumulative data, use user's first ad creation date (will be updated below)
        defaultStartDate = new Date('2020-01-01'); // Temporary fallback, will be replaced with first ad date
        defaultEndDate = now;
      } else if (isAllPeriod) {
        // For 'all' period, use user's first ad creation date (will be updated below)
        // Use 'now' as endDate for accurate completion rate calculation (days from start to today)
        defaultStartDate = new Date('2020-01-01'); // Temporary fallback, will be replaced with first ad date
        defaultEndDate = now; // Use current date for accurate day count
      } else if (startDate && !isNaN(new Date(startDate).getTime()) && endDate && !isNaN(new Date(endDate).getTime())) {
        // Use provided dates
        defaultStartDate = new Date(startDate);
        defaultEndDate = new Date(endDate);
      } else {
        // Calculate based on period (using calendar days in Philippines timezone, not rolling windows)
        // Helper function to get Philippines midnight (UTC+8)
        const getPhilippinesMidnight = (date = new Date()) => {
          const philippinesOffset = 8 * 60; // 8 hours in minutes
          const phTime = new Date(date.getTime() + (philippinesOffset * 60000));
          phTime.setUTCHours(0, 0, 0, 0);
          return new Date(phTime.getTime() - (philippinesOffset * 60000));
        };
        
        switch (period) {
          case '1d':
            // ✅ Today only (from midnight Philippines time to now)
            defaultStartDate = getPhilippinesMidnight(now);
            defaultEndDate = now;
            break;
          case '7d':
            // Last 7 calendar days (including today) in UTC
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 6); // 6 days ago + today = 7 days
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          case '30d':
            // Last 30 calendar days (including today) in UTC
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 29); // 29 days ago + today = 30 days
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          case '90d':
            // Last 90 calendar days (including today) in UTC
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 89); // 89 days ago + today = 90 days
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          default:
            // Default to 7 days
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 6);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
        }
      }

      // Initialize UserAnalytics if it doesn't exist
      let userAnalytics = await this.initializeUserAnalytics(userId);
      
      // ✅ PERFORMANCE OPTIMIZATION: Limit 'all' period to last 2 years (730 days) instead of all history
      // This prevents scanning millions of records and improves query performance significantly
      // For truly "all-time" totals, we'll use the UserAnalytics collection which has pre-aggregated data
      const MAX_ALL_PERIOD_DAYS = 730; // 2 years - reasonable limit for performance
      let firstAdCreationDate = null;
      if (isAllPeriod || shouldReturnCumulative) {
        try {
          const Ad = require('../models/Ad');
          const firstAd = await Ad.findOne({ userId: userId })
            .sort({ createdAt: 1 })
            .select('createdAt')
            .lean();
          
          if (firstAd && firstAd.createdAt) {
            firstAdCreationDate = new Date(firstAd.createdAt);
            
            // ✅ PERFORMANCE FIX: Limit date range to last 2 years for 'all' period queries
            // Calculate the max start date (2 years ago from now)
            const maxStartDate = new Date(now);
            maxStartDate.setFullYear(maxStartDate.getFullYear() - 2); // 2 years ago
            
            // Use the later of: first ad date or 2 years ago
            // This ensures we don't query more than 2 years of data
            const limitedStartDate = firstAdCreationDate > maxStartDate 
              ? firstAdCreationDate  // User's ads are less than 2 years old
              : maxStartDate;         // Limit to last 2 years for performance
              
            if (isAllPeriod || shouldReturnCumulative) {
              defaultStartDate = limitedStartDate;
              console.log('📅 [PERFORMANCE] Using limited date range for "all" period:', {
                firstAdDate: firstAdCreationDate.toISOString(),
                limitedStartDate: limitedStartDate.toISOString(),
                daysAgo: Math.floor((now - limitedStartDate) / (1000 * 60 * 60 * 24)),
                reason: firstAdCreationDate > maxStartDate 
                  ? 'Using first ad date (less than 2 years)' 
                  : 'Limited to 2 years for performance'
              });
            }
          } else {
            // No ads found - use 2 years ago as default
            const maxStartDate = new Date(now);
            maxStartDate.setFullYear(maxStartDate.getFullYear() - 2);
            defaultStartDate = maxStartDate;
            console.log('⚠️ No ads found for user, using 2-year default:', maxStartDate.toISOString());
          }
        } catch (error) {
          console.warn('⚠️ Error fetching user\'s first ad date, using 2-year default:', error.message);
          // Fallback to 2 years ago
          const maxStartDate = new Date(now);
          maxStartDate.setFullYear(maxStartDate.getFullYear() - 2);
          defaultStartDate = maxStartDate;
        }
      }
      
      // Store filtered totals from sync result for use in summary
      let filteredTotals = null;
      
      if (shouldReturnCumulative) {
        // For "All Devices" view, check cache first for performance (unless real-time mode)
        if (!REALTIME_MODE) {
          if (isVerbose()) logger.verbose('📊 Cumulative query for "All Devices" view - checking cache first');
          
          // ✅ PERFORMANCE FIX: Check cache before expensive sync
          const cumulativeCacheKey = this.getCacheKey(userId, defaultStartDate, defaultEndDate, 'cumulative', null);
          const cachedCumulativeData = this.getCachedData(cumulativeCacheKey);
          
          if (cachedCumulativeData) {
            if (isVerbose()) {
              logger.verbose('✅ Using cached cumulative data (FAST PATH - no database query)');
              logger.verbose('📊 Cache hit! Returning data instantly');
            }
            return cachedCumulativeData;
          }
        } else {
          console.log('⚡ [REALTIME] Real-time mode: Skipping cache for cumulative query');
        }
        
        if (isVerbose()) {
          logger.verbose('📊 Cache miss - syncing fresh data from DeviceDataHistoryV2');
          logger.verbose('📊 Data source: DeviceDataHistoryV2 (fresh data, not cached UserAnalytics)');
        }
        
        // ⚡ REAL-TIME: Always sync fresh data from DeviceDataHistoryV2 (or if cache miss in cached mode)
        const syncResult = await this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate);
        if (isVerbose()) {
          logger.verbose('🔍 Fresh sync result for "All Devices":', {
            success: syncResult.success,
            hasData: !!syncResult.data,
            message: syncResult.message
          });
        }
        
        if (syncResult.success && syncResult.data) {
          // ✅ Use fresh synced totals (real-time data from DeviceTracking/DeviceDataHistoryV2)
          if (isVerbose()) {
            logger.verbose('📊 [SYNC-ALL] Full syncResult.data for cumulative:', {
              totalAdPlays: syncResult.data.totalAdPlays,
              totalAdPlayTime: syncResult.data.totalAdPlayTime,
              totalQRScans: syncResult.data.totalQRScans,
              totalDevices: syncResult.data.totalDevices,
              dataKeys: Object.keys(syncResult.data || {})
            });
          }
          
          filteredTotals = {
            totalAdPlays: syncResult.data.totalAdPlays || 0,
            totalAdPlayTime: syncResult.data.totalAdPlayTime || 0,
            totalQRScans: syncResult.data.totalQRScans || 0,
            totalDevices: syncResult.data.totalDevices || 0
          };
          
          if (isVerbose()) {
            logger.verbose('📊 [SYNC-ALL] Fresh DeviceDataHistoryV2 totals (REAL-TIME DATA):', filteredTotals);
            logger.verbose('📊 [SYNC-ALL] Fresh Completion Rate:', syncResult.data.averageAdCompletionRate || 0);
            // qrScanConversionRate removed - no longer needed
          }
          
          // ✅ PERFORMANCE FIX: Cache the result for next time
          // Build the full response and cache it
          const dataToCache = {
            success: true,
            data: syncResult.data
          };
          this.setCachedData(cumulativeCacheKey, dataToCache);
          if (isVerbose()) logger.verbose('✅ Cached cumulative data for 5 minutes');
        } else {
          // Fallback to UserAnalytics if sync fails
          filteredTotals = {
            totalAdPlays: userAnalytics.totalAdPlays || 0,
            totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
            totalQRScans: userAnalytics.totalQRScans || 0,
            totalDevices: userAnalytics.totalDevices || 0
          };
          if (isVerbose()) logger.verbose('⚠️ Fallback to UserAnalytics data:', filteredTotals);
        }
      } else {
        // For 30d queries, skip expensive sync and use optimized aggregation directly (unless real-time mode)
        const daysDiff = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24));
        const shouldSkipSync = !REALTIME_MODE && daysDiff > 14; // Skip sync for queries > 14 days (unless real-time)
        
        let syncResult;
        
        if (REALTIME_MODE) {
          // ⚡ REAL-TIME: Always sync fresh data from DeviceDataHistoryV2
          console.log(`⚡ [REALTIME] Syncing fresh data from DeviceDataHistoryV2 for ${daysDiff} days...`);
          try {
            syncResult = await this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
            if (isVerbose()) {
              logger.verbose('🔍 [REALTIME] Sync result received:', {
                success: syncResult.success,
                hasData: !!syncResult.data,
                message: syncResult.message,
                adIdFilter: adId || 'none (all ads)'
              });
            }
          } catch (error) {
            console.error('❌ [REALTIME] Sync error:', error.message);
            syncResult = { 
              success: false, 
              message: `Real-time sync failed: ${error.message}`,
              useFallback: false 
            };
          }
        } else if (shouldSkipSync) {
          if (isVerbose()) logger.verbose(`⚡ Large date range detected (${daysDiff} days), skipping sync and using optimized aggregation directly`);
          syncResult = { 
            success: false, 
            message: 'Large date range - using optimized query directly',
            useFallback: true 
          };
        } else {
          // For smaller date ranges, try sync with aggressive timeout
          if (isVerbose()) {
            logger.verbose('🔄 Syncing UserAnalytics with fresh data from DeviceDataHistoryV2...');
            logger.verbose('📊 UserAnalytics before sync:', {
              totalAdPlays: userAnalytics.totalAdPlays,
              totalQRScans: userAnalytics.totalQRScans,
              averageAdCompletionRate: userAnalytics.averageAdCompletionRate
            });
          }
          
          try {
            // Aggressive timeout for sync (10 seconds max)
            syncResult = await Promise.race([
              this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate, adId),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sync timeout - using optimized query instead')), 10000)
              )
            ]);
            
            if (isVerbose()) {
              logger.verbose('🔍 Sync result received:', {
                success: syncResult.success,
                hasData: !!syncResult.data,
                message: syncResult.message,
                adIdFilter: adId || 'none (all ads)'
              });
            }
          } catch (timeoutError) {
            if (isVerbose()) logger.verbose('⚠️ Sync timeout or error, falling back to optimized aggregation:', timeoutError.message);
            syncResult = { 
              success: false, 
              message: 'Timeout - using optimized query',
              useFallback: true 
            };
          }
        }
        
        if (syncResult.success) {
          // Refresh the userAnalytics with synced data
          userAnalytics = await this.initializeUserAnalytics(userId);
          if (isVerbose()) {
            logger.verbose('✅ UserAnalytics synced successfully');
            logger.verbose('📊 UserAnalytics after sync:', {
              totalAdPlays: userAnalytics.totalAdPlays,
              totalQRScans: userAnalytics.totalQRScans,
              averageAdCompletionRate: userAnalytics.averageAdCompletionRate
            });
          }
          
          // Refresh the userAnalytics with synced data - fetch directly from DB
          const UserAnalytics = require('../models/userAnalytics');
          userAnalytics = await UserAnalytics.findOne({ userId });
          if (isVerbose()) {
            logger.verbose('✅ UserAnalytics reloaded from DB after sync');
            logger.verbose('🔍 UserAnalytics ads count:', userAnalytics?.ads?.length || 0);
          }
          
          // ✅ Get the filtered totals from the sync result (real-time data from DeviceTracking/DeviceDataHistoryV2)
          // IMPORTANT: syncResult.data contains the processed data from fetchAndUpdateUserAnalyticsFromHistory
          // which includes totalAdPlays, etc. from DeviceDataHistoryV2
          if (isVerbose()) {
            logger.verbose('📊 [SYNC] Full syncResult.data:', {
              totalAdPlays: syncResult.data?.totalAdPlays,
              totalAdPlayTime: syncResult.data?.totalAdPlayTime,
              totalQRScans: syncResult.data?.totalQRScans,
              totalDevices: syncResult.data?.totalDevices,
              adsCount: syncResult.data?.ads?.length,
              hasData: !!syncResult.data,
              dataKeys: syncResult.data ? Object.keys(syncResult.data) : []
            });
          }
          
          filteredTotals = {
            totalAdPlays: syncResult.data?.totalAdPlays || 0,
            totalAdPlayTime: syncResult.data?.totalAdPlayTime || 0,
            totalQRScans: syncResult.data?.totalQRScans || 0,
            totalDevices: syncResult.data?.totalDevices || 0
          };
          
          if (isVerbose()) logger.verbose('📊 [SYNC] Filtered totals extracted from sync result (REAL-TIME DATA):', filteredTotals);
        } else {
          if (isVerbose()) logger.verbose('⚠️ Sync failed or timed out, using optimized aggregation fallback:', syncResult.message);
          
          // Fallback: Use the optimized aggregation pipeline directly
          try {
            const deviceStats = await this.getDeviceStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
            
            if (deviceStats && deviceStats.calculatedSummary) {
              filteredTotals = {
                totalAdPlays: deviceStats.calculatedSummary.totalAdPlays || 0,
                totalAdPlayTime: deviceStats.calculatedSummary.totalAdPlayTime || 0,
                totalQRScans: deviceStats.calculatedSummary.totalQRScans || 0,
                totalDevices: deviceStats.calculatedSummary.totalDevices || 0
              };
              if (isVerbose()) logger.verbose('✅ Fallback aggregation succeeded:', filteredTotals);
            } else {
              if (isVerbose()) logger.verbose('⚠️ Fallback aggregation returned no data, using existing UserAnalytics');
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
            }
          } catch (fallbackError) {
            if (isVerbose()) logger.verbose('❌ Fallback aggregation failed:', fallbackError.message);
            // Final fallback: use existing userAnalytics data
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
          }
        }
      }

      // ✅ PERFORMANCE OPTIMIZATION: For "all" period, use UserAnalytics pre-aggregated data FIRST
      // Then sync in background if needed. This provides instant results from cached aggregates.
      if (isAllPeriod) {
        if (isVerbose()) logger.verbose('📊 [PERFORMANCE] Using optimized approach for "all" period');
        
        // ✅ Check if UserAnalytics has meaningful data we can use immediately
        const hasUserAnalyticsData = userAnalytics && (
          userAnalytics.totalAdPlays > 0 || 
          userAnalytics.totalAdPlayTime > 0 || 
          userAnalytics.totalQRScans > 0
        );
        
        if (hasUserAnalyticsData) {
          // Use UserAnalytics data immediately (pre-aggregated, fast)
          // This gives instant results while we sync fresh data in background
          console.log('📊 [PERFORMANCE] Using UserAnalytics pre-aggregated data for instant results');
          filteredTotals = {
            totalAdPlays: userAnalytics.totalAdPlays || 0,
            totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
            totalQRScans: userAnalytics.totalQRScans || 0,
            totalDevices: userAnalytics.totalDevices || 0
          };
          
          // ✅ Sync in background (don't await - let it update cache for next time)
          // This ensures data is fresh but doesn't block the response
          this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate)
            .then(syncResult => {
              if (syncResult.success && syncResult.data) {
                console.log('📊 [BACKGROUND] Fresh sync completed for "all" period - cache updated');
                // Cache will be updated by the sync, next request will use fresh data
              }
            })
            .catch(error => {
              console.warn('⚠️ [BACKGROUND] Sync failed (non-blocking):', error.message);
            });
        } else {
          // No UserAnalytics data yet - must sync (but with timeout)
          if (isVerbose()) logger.verbose('📊 No UserAnalytics data, syncing fresh data for "all" period');
          
          try {
            // ✅ Add timeout wrapper for "all" period sync (reduced from 25s to 15s for faster failure)
            const syncResult = await Promise.race([
              this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('All period sync timeout after 15s')), 15000)
              )
            ]);
            
            if (syncResult && syncResult.success && syncResult.data) {
              // ✅ Validate that syncResult.data has actual play data (not all zeros)
              // This prevents using failed syncs that return success but with empty data
              const hasValidData = syncResult.data.totalAdPlays > 0 || 
                                  (syncResult.data.totalDevices > 0);
              
              if (hasValidData) {
                // ✅ Extract filteredTotals from syncResult.data (real-time data from DeviceDataHistoryV2)
                // This ensures the summary calculation uses the processed totals (9 plays, etc.)
                if (isVerbose()) {
                  logger.verbose('📊 [SYNC-ALL] Full syncResult.data for "all" period:', {
                    totalAdPlays: syncResult.data.totalAdPlays,
                    totalAdPlayTime: syncResult.data.totalAdPlayTime,
                    totalQRScans: syncResult.data.totalQRScans,
                    totalDevices: syncResult.data.totalDevices,
                    dataKeys: Object.keys(syncResult.data || {})
                  });
                }
                
                // ✅ Extract filteredTotals from sync result (real-time data from DeviceTracking/DeviceDataHistoryV2)
                filteredTotals = {
                  totalAdPlays: syncResult.data.totalAdPlays || 0,
                  totalAdPlayTime: syncResult.data.totalAdPlayTime || 0,
                  totalQRScans: syncResult.data.totalQRScans || 0,
                  totalDevices: syncResult.data.totalDevices || 0
                };
                
                if (isVerbose()) logger.verbose('📊 [SYNC-ALL] Extracted filteredTotals from sync result (REAL-TIME DATA):', filteredTotals);
                
                // Refresh the userAnalytics with synced data - fetch directly from DB
                const UserAnalytics = require('../models/userAnalytics');
                userAnalytics = await UserAnalytics.findOne({ userId });
                if (isVerbose()) {
                  logger.verbose('✅ UserAnalytics synced successfully for "all" period');
                  logger.verbose('🔍 UserAnalytics ads:', userAnalytics.ads.map(ad => ({ adId: ad.adId, totalQRScans: ad.totalQRScans })));
                }
              } else {
                if (isVerbose()) logger.verbose('⚠️ Sync returned success but with no valid play data (all zeros), using UserAnalytics data');
                // Use UserAnalytics data as fallback
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
              }
            } else {
              if (isVerbose()) logger.verbose('⚠️ Sync failed or returned no data, using UserAnalytics data');
              // Use UserAnalytics data as fallback
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
            }
          } catch (timeoutError) {
            // ✅ FIX: Only log timeout errors in verbose mode
            if (isVerbose()) {
              logger.verbose('⚠️ All period sync timeout or error, using UserAnalytics data:', timeoutError.message);
            }
            // Continue with existing userAnalytics data
            // ✅ Use UserAnalytics data if sync failed - provides fallback data
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
          }
        }
      }

      // Don't filter ads by date for dropdown display - we want ALL active paid ads to show
      // The date filter should only apply to the data aggregation, not which ads appear
      // Always fetch ALL user's ads for the dropdown, regardless of adId filter
      // ✅ Exclude archived and rejected ads from the count
      const Ad = require('../models/Ad');
      
      // ✅ FIX: Include SCHEDULED ads in the query to ensure all active paid ads appear in dropdown
      // This matches the query in getActiveTotalMaterials and syncUserAnalyticsFromHistory
      const allUserAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }  // ✅ Include SCHEDULED ads for dropdown
      }).select('_id title status isArchived');
      
      // Use userAnalytics.ads for the data, but ensure ALL paid ads are in the list
      // ✅ Filter out archived and rejected ads from userAnalytics.ads
      let filteredAds = (userAnalytics.ads || []).filter(ad => {
        // We need to check the actual ad status from the database
        // For now, we'll filter based on what we know from allUserAds
        return true; // Will be filtered when we merge with allUserAds
      });
      
      // ✅ Filter out archived/rejected ads and add any missing ads from the Ad collection
      const validAdIds = new Set(allUserAds.map(ad => ad._id.toString()));
      
      // Remove ads that are archived or rejected
      filteredAds = filteredAds.filter(ad => {
        if (!ad.adId) return false;
        return validAdIds.has(ad.adId.toString());
      });
      
      // Add any missing ads from the Ad collection (ads that might not have analytics yet)
      allUserAds.forEach(ad => {
        const exists = filteredAds.find(fa => fa.adId && fa.adId.toString() === ad._id.toString());
        if (!exists) {
          filteredAds.push({
            adId: ad._id.toString(),
            adTitle: ad.title,
            totalDevices: 0,
            totalAdPlayTime: 0,
            totalQRScans: 0,
            averageAdCompletionRate: 0,
            // qrScanConversionRate removed
            isActive: true,
            materials: []
          });
        }
      });

      // ✅ Fetch fresh QR scan data for all ads to ensure accuracy
      // ✅ For 'all' period, fetch ALL-TIME QR scans (no date filtering)
      // ✅ For other periods, use the date range
      let qrScanDataByAd = {};
      try {
        // For 'all' period, pass null to get ALL-TIME data (no date filtering)
        const qrScanStartDate = (isAllPeriod || shouldReturnCumulative) ? null : defaultStartDate;
        const qrScanEndDate = (isAllPeriod || shouldReturnCumulative) ? null : defaultEndDate;
        
        if (isVerbose()) {
          logger.verbose('🔍 Fetching QR scan data:', {
            period: period,
            isAllPeriod: isAllPeriod,
            shouldReturnCumulative: shouldReturnCumulative,
            dateRange: { start: qrScanStartDate, end: qrScanEndDate },
            message: isAllPeriod ? 'ALL-TIME (no date filter)' : `Date range: ${defaultStartDate} to ${defaultEndDate}`
          });
        }
        
        const qrScanData = await this.getTotalQRScans(userId, qrScanStartDate, qrScanEndDate);
        
        // ✅ Always log QR scan data for debugging (not just verbose mode)
        console.log('📊 [getUserAnalytics] QR scan data response:', {
          success: qrScanData.success,
          totalScans: qrScanData.totalScans || 0,
          adsCount: qrScanData.ads?.length || 0,
          ads: qrScanData.ads?.map(ad => ({ adId: ad.adId, adTitle: ad.adTitle, totalScans: ad.totalScans })) || []
        });
        
        if (qrScanData.success && qrScanData.ads && qrScanData.ads.length > 0) {
          // Create a map of adId -> QR scan data for quick lookup
          // ✅ Normalize adId to string for consistent matching
          qrScanData.ads.forEach((qrAd) => {
            const normalizedAdId = qrAd.adId ? qrAd.adId.toString() : '';
            if (normalizedAdId) {
              qrScanDataByAd[normalizedAdId] = qrAd.totalScans || 0;
              console.log(`✅ [getUserAnalytics] Mapped QR scans for ad "${qrAd.adTitle}" (${normalizedAdId}): ${qrAd.totalScans || 0}`);
            }
          });
          console.log('✅ [getUserAnalytics] Fresh QR scan data fetched:', Object.keys(qrScanDataByAd).length, 'ads with QR scans');
          console.log('🔍 [getUserAnalytics] QR scan data by ad:', qrScanDataByAd);
        } else {
          console.warn('⚠️ [getUserAnalytics] No QR scan data returned or failed:', {
            success: qrScanData.success,
            message: qrScanData.message,
            adsCount: qrScanData.ads?.length || 0
          });
        }
        // ✅ FIX: Don't log "No QR scan data" - it's expected for users without QR scans
      } catch (qrScanError) {
        // ✅ FIX: Only log QR scan errors in verbose mode
        if (isVerbose()) {
          logger.verbose('❌ Error fetching fresh QR scan data:', qrScanError);
          logger.verbose('⚠️ Error fetching fresh QR scan data, using cached data:', qrScanError.message);
        }
      }

      // Format data for GraphQL schema
      // IMPORTANT: adPerformance array contains ALL user's ads (for dropdown)
      //            but summary totals are filtered by adId if provided
      // ✅ Initialize summary with defaults - will be updated by summary calculation logic below
      const data = {
        summary: {
          // Default values - will be overridden by summary calculation logic after deviceStats is populated
          totalAdsPlayed: (filteredTotals && filteredTotals.totalAdPlays !== undefined)
            ? filteredTotals.totalAdPlays
            : (userAnalytics.totalAdPlays || 0),
          totalDisplayTime: (filteredTotals && filteredTotals.totalAdPlayTime !== undefined)
            ? filteredTotals.totalAdPlayTime
            : (userAnalytics.totalAdPlayTime || 0),
          averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
          totalAds: filteredAds ? filteredAds.length : 0,
          activeAds: filteredAds ? filteredAds.filter(ad => ad.isActive).length : 0,
          totalDevices: (filteredTotals && filteredTotals.totalDevices !== undefined)
            ? filteredTotals.totalDevices
            : (userAnalytics.totalDevices || 0),
          totalQRScans: (filteredTotals && filteredTotals.totalQRScans !== undefined)
            ? filteredTotals.totalQRScans
            : (userAnalytics.totalQRScans || 0),
          // qrScanConversionRate removed from API response
        },
        adPerformance: (filteredAds && filteredAds.length > 0) ? filteredAds.map(ad => {
          const adIdStr = ad.adId ? ad.adId.toString() : '';
          // ✅ Use fresh QR scan data if available, otherwise fallback to cached data
          // Try multiple formats for matching (in case of format inconsistencies)
          let freshQRScans = qrScanDataByAd[adIdStr];
          if (freshQRScans === undefined) {
            // Try with ObjectId format if adIdStr doesn't match
            for (const [key, value] of Object.entries(qrScanDataByAd)) {
              if (key === adIdStr || key.toString() === adIdStr || adIdStr === key.toString()) {
                freshQRScans = value;
                break;
              }
            }
          }
          // Fallback to cached data if fresh data not found
          if (freshQRScans === undefined) {
            freshQRScans = ad.totalQRScans || 0;
          }
          
          // ✅ FIX: Suppress verbose QR scan matching logs - only log in verbose mode
          if (isVerbose()) {
            const hasFreshData = qrScanDataByAd[adIdStr] !== undefined;
            const cachedValue = ad.totalQRScans || 0;
            logger.verbose(`🔍 Ad "${ad.adTitle}" (${adIdStr}): QR scans = ${freshQRScans} (fresh: ${hasFreshData ? 'YES' : 'NO'} ${hasFreshData ? `(${qrScanDataByAd[adIdStr]})` : ''}, cached: ${cachedValue})`);
            
            if (freshQRScans === 0 && hasFreshData) {
              logger.verbose(`⚠️ WARNING: Ad "${ad.adTitle}" (${adIdStr}) has fresh data but QR scans = 0. This might indicate a data issue.`);
            }
          }
          
          return {
            adId: adIdStr,
            adTitle: ad.adTitle || '',
            totalDevices: ad.totalDevices || 0,
            totalAdPlayTime: ad.totalAdPlayTime || 0,
            totalAdPlays: ad.totalAdPlays || 0, // ✅ Include actual play count
            totalQRScans: freshQRScans, // ✅ Use fresh QR scan data
            averageAdCompletionRate: ad.averageAdCompletionRate || 0,
            // qrScanConversionRate removed
            lastUpdated: ad.lastUpdated || new Date().toISOString(),
            materials: (ad.materials || []).map(material => ({
              materialId: material.materialId || '',
              materialName: material.materialName || null,
              carGroupId: material.carGroupId || null,
              totalAdPlayTime: material.totalAdPlayTime || 0,
              totalQRScans: material.totalQRScans || 0,
              averageCompletionRate: material.averageAdCompletionRate || 0,
              lastActivity: material.lastActivity || null
            }))
          };
        }) : [], // Always use userAnalytics.ads for consistency
        dailyStats: Array.isArray(userAnalytics.dailyStats) && shouldReturnCumulative ? userAnalytics.dailyStats : [],
        deviceStats: [], // Will be populated from DeviceDataHistoryV2
        period: shouldReturnCumulative ? 'all' : (isAllPeriod ? 'all' : (period || '7d')),
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        lastUpdated: userAnalytics.lastUpdated || new Date().toISOString(),
        isActive: userAnalytics.isActive !== undefined ? userAnalytics.isActive : true
      };

      // Always get device stats for the dropdown, regardless of period
      // ⚡ REAL-TIME: Always fetch fresh device stats from DeviceDataHistoryV2 when real-time mode is enabled
      if (defaultStartDate && defaultEndDate) {
        if (REALTIME_MODE) {
          console.log('⚡ [REALTIME] Fetching device stats directly from DeviceDataHistoryV2...');
        }
        const deviceStats = await this.getDeviceStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
        data.deviceStats = deviceStats;
        if (isVerbose()) logger.verbose('📊 Device stats populated:', deviceStats.length, 'devices found', adId ? `(filtered by adId: ${adId})` : '(all ads)', REALTIME_MODE ? '(REALTIME)' : '(CACHED)');
        
        // Note: Summary calculation will be done after adPerformance is populated
      }

      // ✅ Calculate summary from deviceStats for accuracy (after deviceStats is populated)
      // IMPORTANT: Use deviceStats totals when available AND it has data
      // If deviceStats is empty, prefer filteredTotals from sync (which has real data)
      if (data.deviceStats !== undefined && Array.isArray(data.deviceStats) && data.deviceStats.length > 0) {
        const calculatedSummary = {
          totalAdsPlayed: data.deviceStats.reduce((sum, device) => sum + (device.adsPlayed || 0), 0),
          totalDisplayTime: data.deviceStats.reduce((sum, device) => sum + (device.displayTime || 0), 0),
          totalQRScans: data.deviceStats.reduce((sum, device) => sum + (device.qrScans || 0), 0),
          totalDevices: data.deviceStats.length,
          totalAds: data.adPerformance ? data.adPerformance.length : 0,
          activeAds: data.adPerformance ? data.adPerformance.length : 0
        };
        
        if (isVerbose()) {
          logger.verbose('📊 [Summary] Calculating from deviceStats:', {
            deviceStatsCount: data.deviceStats.length,
            calculatedSummary
          });
        }
        
        // Override filteredTotals with calculated values from deviceStats (this is the most accurate data!)
        filteredTotals = {
          totalAdPlays: calculatedSummary.totalAdsPlayed,
          totalAdPlayTime: calculatedSummary.totalDisplayTime,
          totalQRScans: calculatedSummary.totalQRScans,
          totalDevices: calculatedSummary.totalDevices,
        };
        
        // Update summary with calculated values from deviceStats for accuracy
        data.summary.totalAdsPlayed = calculatedSummary.totalAdsPlayed;
        data.summary.totalDisplayTime = calculatedSummary.totalDisplayTime;
        data.summary.totalQRScans = calculatedSummary.totalQRScans;
        data.summary.totalDevices = calculatedSummary.totalDevices;
        data.summary.totalAds = calculatedSummary.totalAds;
        data.summary.activeAds = calculatedSummary.activeAds;
        
        // Calculate average completion rate based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = calculatedSummary.totalDisplayTime / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // qrScanConversionRate removed - no longer needed
        
        if (isVerbose()) {
          logger.verbose('📊 [Summary] Updated from deviceStats:', {
            totalAdsPlayed: data.summary.totalAdsPlayed,
            totalQRScans: data.summary.totalQRScans,
            note: '✅ QR scans are filtered by user\'s ads only (not all device scans)'
          });
        }
      } else if (filteredTotals) {
        // ✅ If deviceStats is empty but we have sync data in filteredTotals, use that instead
        // This ensures we use real-time data from DeviceTracking/DeviceDataHistoryV2
        // IMPORTANT: Use filteredTotals even if values are 0 (0 is a valid result)
        if (isVerbose()) {
          logger.verbose('📊 [Summary] deviceStats is empty, using filteredTotals from sync (REAL-TIME DATA):', {
            totalAdPlays: filteredTotals.totalAdPlays,
            totalQRScans: filteredTotals.totalQRScans,
            totalDisplayTime: filteredTotals.totalAdPlayTime,
            totalDevices: filteredTotals.totalDevices
          });
        }
        
        // Update summary with filteredTotals from sync (real-time data from DeviceTracking/DeviceDataHistoryV2)
        data.summary.totalAdsPlayed = filteredTotals.totalAdPlays !== undefined ? filteredTotals.totalAdPlays : 0;
        data.summary.totalDisplayTime = filteredTotals.totalAdPlayTime !== undefined ? filteredTotals.totalAdPlayTime : 0;
        data.summary.totalQRScans = filteredTotals.totalQRScans !== undefined ? filteredTotals.totalQRScans : 0;
        data.summary.totalDevices = filteredTotals.totalDevices !== undefined ? filteredTotals.totalDevices : 0;
        
        // Calculate average completion rate from sync data based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = (filteredTotals.totalAdPlayTime || 0) / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // qrScanConversionRate removed - no longer needed
        
        if (isVerbose()) {
          logger.verbose('📊 [Summary] ✅ Updated from sync data (DeviceTracking/DeviceDataHistoryV2 - REAL-TIME):', {
            totalAdsPlayed: data.summary.totalAdsPlayed,
            totalQRScans: data.summary.totalQRScans,
            totalDisplayTime: data.summary.totalDisplayTime,
            totalDevices: data.summary.totalDevices,
            note: '✅ QR scans are filtered by user\'s ads only (not all device scans)'
          });
        }
      } else if (userAnalytics && userAnalytics.totalAdPlays > 0) {
        // ✅ Fallback: Use UserAnalytics data (synced from DeviceTracking/DeviceDataHistoryV2)
        // This ensures we always show real-time data even if deviceStats and filteredTotals are empty
        if (isVerbose()) {
          logger.verbose('📊 [Summary] Using UserAnalytics data (synced from DeviceTracking/DeviceDataHistoryV2):', {
            totalAdPlays: userAnalytics.totalAdPlays,
            totalQRScans: userAnalytics.totalQRScans
          });
        }
        
        // Update summary with UserAnalytics data (real-time synced data)
        data.summary.totalAdsPlayed = userAnalytics.totalAdPlays || 0;
        data.summary.totalDisplayTime = userAnalytics.totalAdPlayTime || 0;
        data.summary.totalQRScans = userAnalytics.totalQRScans || 0;
        data.summary.totalDevices = userAnalytics.totalDevices || 0;
        data.summary.averageCompletionRate = userAnalytics.averageAdCompletionRate || 0;
        // qrScanConversionRate removed - no longer needed
        
        if (isVerbose()) {
          logger.verbose('📊 [Summary] Updated from UserAnalytics (real-time synced data):', {
            totalAdsPlayed: data.summary.totalAdsPlayed,
            totalQRScans: data.summary.totalQRScans
          });
        }
      } else if (data.deviceStats && data.deviceStats.length > 0 && !adId) {
        // For non-filtered queries, still calculate from deviceStats if available
        const calculatedSummary = {
          totalAdsPlayed: data.deviceStats.reduce((sum, device) => sum + (device.adsPlayed || 0), 0),
          totalDisplayTime: data.deviceStats.reduce((sum, device) => sum + (device.displayTime || 0), 0),
          totalQRScans: data.deviceStats.reduce((sum, device) => sum + (device.qrScans || 0), 0),
          totalDevices: data.deviceStats.length,
          totalAds: data.adPerformance ? data.adPerformance.length : 0,
          activeAds: data.adPerformance ? data.adPerformance.length : 0
        };
        
        if (isVerbose()) {
          logger.verbose('📊 Calculated summary from device stats (all ads):', calculatedSummary);
        }
        
        // Update summary with calculated values from deviceStats for accuracy
        data.summary.totalAdsPlayed = calculatedSummary.totalAdsPlayed;
        data.summary.totalDisplayTime = calculatedSummary.totalDisplayTime;
        data.summary.totalQRScans = calculatedSummary.totalQRScans;
        data.summary.totalDevices = calculatedSummary.totalDevices;
        data.summary.totalAds = calculatedSummary.totalAds;
        data.summary.activeAds = calculatedSummary.activeAds;
        
        // Calculate average completion rate based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = calculatedSummary.totalDisplayTime / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // qrScanConversionRate removed - no longer needed
        
        if (isVerbose()) {
          logger.verbose('📊 Updated summary with calculated values from device stats:', data.summary);
        }
      }

      // For "All Devices" view, use only UserAnalytics data for summary - but still get device stats
      if (shouldReturnCumulative) {
        if (isVerbose()) {
          logger.verbose('📊 Using UserAnalytics collection data for "All Devices" view');
          logger.verbose('📊 Summary data source: UserAnalytics collection ONLY');
          logger.verbose('📊 Final summary for ALL DEVICES:', {
            totalAdsPlayed: data.summary.totalAdsPlayed,
            totalDisplayTime: data.summary.totalDisplayTime,
            totalQRScans: data.summary.totalQRScans,
            totalDevices: data.summary.totalDevices,
            averageCompletionRate: data.summary.averageCompletionRate,
            // qrScanConversionRate removed from response
          });
        }
        data.dailyStats = [];
        // deviceStats already populated above
      } else if (isAllPeriod || hasCustomDateRange) {
        // For "all" period or custom date range, use the same logic as other periods (30d, 7d, etc.) but with wide date range
        // This ensures we get the same data structure and QR scan calculations
        // ✅ OPTIMIZATION: Try UserAnalytics first (FAST - no DeviceDataHistoryV2 query!)
        if (defaultStartDate && defaultEndDate) {
          if (isVerbose()) {
            logger.verbose('📊 Fetching dailyStats for custom date range or all period:', {
              startDate: defaultStartDate,
              endDate: defaultEndDate,
              adId: adId || 'all'
            });
          }
          
          // ✅ REAL-TIME MODE: Always query DeviceDataHistoryV2 directly when real-time mode is enabled
          // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
          let dailyStats = [];
          
          if (REALTIME_MODE) {
            // ⚡ REAL-TIME: Always fetch fresh data from DeviceDataHistoryV2
            console.log(`⚡ [REALTIME] Fetching dailyStats directly from DeviceDataHistoryV2...`);
            dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
            console.log(`⚡ [REALTIME] Retrieved ${dailyStats.length} dailyStats entries from DeviceDataHistoryV2`);
          } else if (userAnalytics && userAnalytics.dailyStats && userAnalytics.dailyStats.length > 0) {
            // CACHED MODE: Use pre-aggregated UserAnalytics data (faster)
            const startDateStr = defaultStartDate.toISOString().split('T')[0];
            const endDateStr = defaultEndDate.toISOString().split('T')[0];
            
            // Filter date entries by date range
            const filteredDateEntries = userAnalytics.dailyStats.filter(dateEntry => {
              return dateEntry.date >= startDateStr && dateEntry.date <= endDateStr;
            });
            
            if (adId) {
              // Filter by specific adId - extract totals from matching ads
              const adIdStr = adId.toString();
              dailyStats = filteredDateEntries.map(dateEntry => {
                const matchingAd = dateEntry.ads?.find(ad => 
                  ad.adId && ad.adId.toString() === adIdStr
                );
                if (matchingAd && matchingAd.totals) {
                  return {
                    date: dateEntry.date,
                    adsPlayed: matchingAd.totals.adsPlayed || 0,
                    displayTime: matchingAd.totals.displayTime || 0,
                    qrScans: matchingAd.totals.qrScans || 0,
                    completionRate: matchingAd.totals.completionRate || 0,
                    impressions: matchingAd.totals.impressions || 0
                  };
                }
                return null;
              }).filter(stat => stat !== null);
            } else {
              // Use date totals (aggregated across all ads)
              dailyStats = filteredDateEntries.map(dateEntry => ({
                date: dateEntry.date,
                adsPlayed: dateEntry.totals?.adsPlayed || 0,
                displayTime: dateEntry.totals?.displayTime || 0,
                qrScans: dateEntry.totals?.qrScans || 0,
                completionRate: dateEntry.totals?.completionRate || 0,
                impressions: dateEntry.totals?.impressions || 0
              }));
            }
            
            console.log(`✅ [CACHED] Using UserAnalytics dailyStats: ${dailyStats.length} entries (${adId ? `filtered by adId: ${adId}` : 'all ads'})`);
          } else {
            // Fallback: Query DeviceDataHistoryV2 (only if UserAnalytics is empty)
            console.log(`⚠️ [FALLBACK] UserAnalytics dailyStats empty, querying DeviceDataHistoryV2...`);
            dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
          }
          
          data.dailyStats = dailyStats || [];
          if (isVerbose()) logger.verbose('📊 Retrieved dailyStats count:', dailyStats?.length || 0);
        }
        // deviceStats already populated above
      } else {
        // Get daily stats for other periods (7d, 30d, etc.)
        // ✅ REAL-TIME MODE: Always query DeviceDataHistoryV2 directly when real-time mode is enabled
        // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
        if (defaultStartDate && defaultEndDate) {
          let dailyStats = [];
          
          if (REALTIME_MODE) {
            // ⚡ REAL-TIME: Always fetch fresh data from DeviceDataHistoryV2
            console.log(`⚡ [REALTIME] Fetching dailyStats directly from DeviceDataHistoryV2 for period ${period}...`);
            dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
            console.log(`⚡ [REALTIME] Retrieved ${dailyStats.length} dailyStats entries from DeviceDataHistoryV2`);
          } else if (userAnalytics && userAnalytics.dailyStats && userAnalytics.dailyStats.length > 0) {
            // CACHED MODE: Use pre-aggregated UserAnalytics data (faster)
            const startDateStr = defaultStartDate.toISOString().split('T')[0];
            const endDateStr = defaultEndDate.toISOString().split('T')[0];
            
            // Filter date entries by date range
            const filteredDateEntries = userAnalytics.dailyStats.filter(dateEntry => {
              return dateEntry.date >= startDateStr && dateEntry.date <= endDateStr;
            });
            
            if (adId) {
              // Filter by specific adId - extract totals from matching ads
              const adIdStr = adId.toString();
              dailyStats = filteredDateEntries.map(dateEntry => {
                const matchingAd = dateEntry.ads?.find(ad => 
                  ad.adId && ad.adId.toString() === adIdStr
                );
                if (matchingAd && matchingAd.totals) {
                  return {
                    date: dateEntry.date,
                    adsPlayed: matchingAd.totals.adsPlayed || 0,
                    displayTime: matchingAd.totals.displayTime || 0,
                    qrScans: matchingAd.totals.qrScans || 0,
                    completionRate: matchingAd.totals.completionRate || 0,
                    impressions: matchingAd.totals.impressions || 0
                  };
                }
                return null;
              }).filter(stat => stat !== null);
            } else {
              // Use date totals (aggregated across all ads)
              dailyStats = filteredDateEntries.map(dateEntry => ({
                date: dateEntry.date,
                adsPlayed: dateEntry.totals?.adsPlayed || 0,
                displayTime: dateEntry.totals?.displayTime || 0,
                qrScans: dateEntry.totals?.qrScans || 0,
                completionRate: dateEntry.totals?.completionRate || 0,
                impressions: dateEntry.totals?.impressions || 0
              }));
            }
            
            console.log(`✅ [CACHED] Using UserAnalytics dailyStats: ${dailyStats.length} entries`);
          } else {
            // Fallback: Query DeviceDataHistoryV2
            console.log(`⚠️ [FALLBACK] Querying DeviceDataHistoryV2...`);
            dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
          }
          
          data.dailyStats = dailyStats || [];
        }
        // deviceStats already populated above
      }

      // Debug logging to track data flow
      // When filtering by adId, adPerformance array still contains ALL ads for dropdown
      
      // ✅ FIX: Suppress warning - empty adPerformance is expected for users without ads
      // Only log in verbose mode for debugging
      if ((!data.adPerformance || data.adPerformance.length === 0) && process.env.VERBOSE_LOGS === 'true') {
        const logger = require('../utils/logger');
        logger.verbose('⚠️ WARNING: adPerformance array is EMPTY! This will cause dropdown to be empty!');
        logger.verbose('⚠️ filteredAds:', filteredAds?.length || 0);
        logger.verbose('⚠️ allUserAds:', allUserAds?.length || 0);
      }

      const result = {
        success: true,
        data: data
      };

      // ✅ Only cache if we have valid data (not all zeros when we should have data)
      // For 'all' period, ensure we have filteredTotals from a successful sync before caching
      // This prevents caching failed syncs that return zeros
      const shouldCache = !isAllPeriod || 
                         (filteredTotals && filteredTotals.totalAdPlays > 0) ||
                         (data.deviceStats && data.deviceStats.length > 0 && data.deviceStats.some(d => d.adsPlayed > 0)) ||
                         (data.summary.totalAdsPlayed > 0);
      
      if (shouldCache) {
        this.setCachedData(cacheKey, result);
      } else {
        if (isVerbose()) logger.verbose('⚠️ Skipping cache for "all" period - sync may have failed or no valid data (all zeros)');
      }
      
      return result;
    } catch (error) {
      console.error('Error getting user analytics:', error);
      
      // If it's a timeout error, return a minimal valid response instead of throwing
      if (error.name === 'MongoNetworkTimeoutError' || error.message.includes('timeout') || error.message.includes('timed out')) {
        console.warn('⚠️ MongoDB timeout detected, returning minimal response');
        return {
          success: false,
          message: 'Query timeout - please try a shorter time period or refresh the page',
          data: {
            summary: {
              totalAdsPlayed: 0,
              totalDisplayTime: 0,
              averageCompletionRate: 0,
              totalAds: 0,
              activeAds: 0,
              totalDevices: 0,
              totalQRScans: 0,
              // qrScanConversionRate removed
            },
            adPerformance: [],
            dailyStats: [],
            deviceStats: [],
            period: period || '7d',
            startDate: startDate,
            endDate: endDate,
            lastUpdated: new Date().toISOString(),
            isActive: true
          }
        };
      }
      
      throw error;
    }
  }

  // Get daily stats from DeviceDataHistoryV2 filtered by userId (and optionally by adId)
  // ✅ NEW: Includes DeviceTracking for current day if date range includes today
  static async getDailyStatsFromHistory(userId, startDate, endDate, adId = null) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const DeviceTracking = require('../models/deviceTracking');
      const Ad = require('../models/Ad');

      // Check if current day is included in the date range
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
      const includesToday = today >= startDateObj && today <= endDateObj;

      // ✅ PERFORMANCE OPTIMIZATION: Get user's adIds and materialIds first
      // If filtering by specific adId, get materialIds for that ad to reduce dataset size
      const userAds = await Ad.find({ userId: userId }).select('_id materialId targetDevices');
      const userAdIds = [];
      for (const ad of userAds) {
        if (ad._id) {
          userAdIds.push(ad._id.toString());
        }
      }
      
      // ✅ PERFORMANCE OPTIMIZATION: If filtering by adId, get materialIds for that ad
      // This allows us to filter by materialId early in the pipeline, reducing documents processed
      let materialIdsForAd = null;
      if (adId) {
        const Material = require('../models/Material');
        const selectedAd = userAds.find(ad => ad._id.toString() === adId || ad._id.toString() === adId.toString());
        if (selectedAd) {
          const deviceRefs = (selectedAd.targetDevices && selectedAd.targetDevices.length > 0) 
            ? selectedAd.targetDevices 
            : (selectedAd.materialId && selectedAd.materialId.length > 0 ? selectedAd.materialId : []);
          
          if (deviceRefs.length > 0) {
            const materials = await Material.find({ _id: { $in: deviceRefs } }).select('materialId').lean();
            materialIdsForAd = materials.map(m => m.materialId).filter(Boolean);
            console.log('📊 [PERFORMANCE] getDailyStatsFromHistory - Filtering by materialIds for ad:', materialIdsForAd.length, 'materials');
          }
        }
      }
      
      // Build match conditions for adPlaybacks (using adId filtering)
      const adPlaybackMatchConditions = [];
      if (adId) {
        // Filter by specific adId
        adPlaybackMatchConditions.push({ $eq: ['$$playback.adId', adId] });
        adPlaybackMatchConditions.push({ $eq: ['$$playback.adId', adId.toString()] });
        adPlaybackMatchConditions.push({ $eq: [{ $toString: '$$playback.adId' }, adId] });
        adPlaybackMatchConditions.push({ $eq: [{ $toString: '$$playback.adId' }, adId.toString()] });
      } else if (userAdIds.length > 0) {
        // Filter by user's adIds
        userAdIds.forEach(adIdStr => {
          adPlaybackMatchConditions.push({ $eq: ['$$playback.adId', adIdStr] });
          adPlaybackMatchConditions.push({ $eq: [{ $toString: '$$playback.adId' }, adIdStr] });
        });
      }

      // Build match conditions for qrScans
      const qrScanMatchConditions = [];
      if (adId) {
        qrScanMatchConditions.push({ $eq: ['$$scan.adId', adId] });
        qrScanMatchConditions.push({ $eq: ['$$scan.adId', adId.toString()] });
        qrScanMatchConditions.push({ $eq: [{ $toString: '$$scan.adId' }, adId] });
        qrScanMatchConditions.push({ $eq: [{ $toString: '$$scan.adId' }, adId.toString()] });
      } else if (userAdIds.length > 0) {
        userAdIds.forEach(adIdStr => {
          qrScanMatchConditions.push({ $eq: ['$$scan.adId', adIdStr] });
          qrScanMatchConditions.push({ $eq: [{ $toString: '$$scan.adId' }, adIdStr] });
        });
      }

      // ✅ Get historical data from DeviceDataHistoryV2
      // ✅ FIX: Match getDeviceStatsFromHistory date handling - exclude today from historical query
      // Today's data will be fetched separately from DeviceTracking (more accurate/real-time)
      const finalHistoricalEndDate = includesToday ? new Date(today.getTime() - 1) : endDateObj; // Exclude today if included
      const shouldIncludeTodayInHistorical = false; // Always exclude today from historical query
      
        // ✅ Debug logging
        if (isVerbose()) {
          logger.verbose('📊 [getDailyStatsFromHistory] Query parameters:', {
            userId,
            startDate: startDateObj.toISOString(),
            endDate: endDateObj.toISOString(),
            finalHistoricalEndDate: finalHistoricalEndDate.toISOString(),
            includesToday,
            userAdIdsCount: userAdIds.length,
            userAdIdsSample: userAdIds.slice(0, 5),
            adId: adId || 'all',
            adPlaybackMatchConditionsCount: adPlaybackMatchConditions.length,
            adPlaybackMatchConditionsSample: adPlaybackMatchConditions.slice(0, 3)
          });
        }
      
      let historicalResult = [];
      if (startDateObj <= finalHistoricalEndDate) {
        // Only query historical data if there are dates before today
        // ✅ Use adPlaybacks instead of adPerformance (matching getDeviceStatsFromHistory)
        // ✅ FIX: Build the filter condition correctly - handle both isMaster and adId filtering
        // IMPORTANT: MongoDB $filter cond doesn't support JavaScript conditionals - must build condition object before using
        // ✅ CRITICAL FIX: The original code used a ternary operator inside the aggregation which MongoDB can't evaluate
        // We must build the condition object BEFORE passing it to the aggregation pipeline
        let adPlaybackFilterCondition;
        if (adPlaybackMatchConditions.length > 0) {
          // When we have adId conditions, combine with isMaster check
          // ✅ CRITICAL FIX: Include playbacks where isMaster is true OR missing/undefined (backward compatibility)
          // The $ne operator correctly handles missing fields - returns true if field doesn't exist
          // This means: include if isMaster is true, null, undefined, or missing (exclude only if explicitly false)
          adPlaybackFilterCondition = {
            $and: [
              // isMaster must not be false (allows true, null, undefined, and missing)
              { $ne: ['$$playback.isMaster', false] },
              // Filter by user's adIds - must match at least one condition
              { $or: adPlaybackMatchConditions }
            ]
          };
        } else {
          // No adId filter, just filter by isMaster
          // ✅ Include playbacks where isMaster is not false (allows true, null, undefined, and missing)
          adPlaybackFilterCondition = {
            $ne: ['$$playback.isMaster', false]
          };
        }
        
        // ✅ Debug: Log the filter condition structure
        if (isVerbose()) {
          logger.verbose('📊 [getDailyStatsFromHistory] Built filter condition:', {
            hasAdIdConditions: adPlaybackMatchConditions.length > 0,
            conditionType: adPlaybackMatchConditions.length > 0 ? '$and' : '$ne',
            conditionKeys: Object.keys(adPlaybackFilterCondition)
          });
        }
        
        // ✅ Build QR scan filter condition (same issue - need to build before using in aggregation)
        let qrScanFilterCondition;
        if (qrScanMatchConditions.length > 0) {
          qrScanFilterCondition = { $or: qrScanMatchConditions };
        } else {
          qrScanFilterCondition = false; // No QR scans if no conditions
        }
        
        // ✅ PERFORMANCE OPTIMIZATION: Build pipeline with early materialId filtering
        const dailyStatsPipeline = [];
        
        // ✅ CRITICAL OPTIMIZATION: Add materialId filter BEFORE unwinding if we know which materials have the ad
        // This dramatically reduces the number of documents processed
        if (materialIdsForAd && materialIdsForAd.length > 0) {
          dailyStatsPipeline.push({
            $match: {
              materialId: { $in: materialIdsForAd }
            }
          });
          console.log('📊 [PERFORMANCE] getDailyStatsFromHistory - Added early materialId filter, reducing dataset to', materialIdsForAd.length, 'devices');
        }
        
        // Stage 1: Unwind dailyData array (after materialId filter if applied)
        dailyStatsPipeline.push({ $unwind: '$dailyData' });
        
        // Stage 2: Filter by date range - uses index on dailyData.date
        dailyStatsPipeline.push({ 
          $match: { 
            'dailyData.date': { 
              $gte: startDateObj, 
              $lte: finalHistoricalEndDate 
            } 
          } 
        });
        
        // Stage 3: Facet to get both ad performance and QR scans in one query
        dailyStatsPipeline.push({ 
          $facet: {
            adPerf: [
              {
                $project: {
                  date: '$dailyData.date',
                  materialId: '$materialId',
                  filteredAdPlaybacks: {
                    $filter: {
                      input: { $ifNull: ['$dailyData.adPlaybacks', []] },
                      as: 'playback',
                      cond: adPlaybackFilterCondition
                    }
                  }
                }
              },
              // ✅ Only match entries with filtered playbacks (early filtering)
              {
                $match: {
                  $expr: { $gt: [{ $size: '$filteredAdPlaybacks' }, 0] }
                }
              },
              { 
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                  adsPlayed: { $sum: { $size: '$filteredAdPlaybacks' } },
                  displayTime: { 
                    $sum: {
                      $sum: {
                        $map: {
                          input: '$filteredAdPlaybacks',
                          as: 'playback',
                          in: { $ifNull: ['$$playback.viewTime', 0] }
                        }
                      }
                    }
                  },
                  completionRate: { 
                    $avg: {
                      $map: {
                        input: '$filteredAdPlaybacks',
                        as: 'playback',
                        in: { $ifNull: ['$$playback.completionRate', 0] }
                      }
                    }
                  }
                }
              },
              { $sort: { _id: 1 } }
            ],
            qr: [
              {
                $project: {
                  date: '$dailyData.date',
                  filteredQrScans: {
                    $filter: {
                      input: { $ifNull: ['$dailyData.qrScans', []] },
                      as: 'scan',
                      cond: qrScanFilterCondition
                    }
                  }
                }
              },
              // ✅ Only match entries with QR scans (early filtering)
              {
                $match: {
                  $expr: { $gt: [{ $size: '$filteredQrScans' }, 0] }
                }
              },
              { 
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                  qrScans: { $sum: { $size: '$filteredQrScans' } }
                }
              },
              { $sort: { _id: 1 } }
            ]
          }
        });
        
        // ✅ PERFORMANCE: Execute aggregation with timeout and performance tracking
        const dailyStatsStartTime = Date.now();
        try {
          console.log('📊 [PERFORMANCE] getDailyStatsFromHistory - Running optimized aggregation...', {
            stages: dailyStatsPipeline.length,
            hasMaterialIdFilter: !!materialIdsForAd,
            materialIdsCount: materialIdsForAd?.length || 'all'
          });
          
          const [result] = await DeviceDataHistoryV2.aggregate(dailyStatsPipeline, {
            maxTimeMS: 30000, // 30 seconds timeout (increased for complex queries with 8GB memory)
            allowDiskUse: true, // Allow using disk for large datasets
            hint: materialIdsForAd && materialIdsForAd.length > 0 
              ? { materialId: 1 } // Use materialId index if filtering
              : { 'dailyData.date': 1 } // Use date index otherwise
          });
          
          historicalResult = result || [];
          const dailyStatsDuration = Date.now() - dailyStatsStartTime;
          
          console.log(`📊 [PERFORMANCE] getDailyStatsFromHistory - Aggregation completed in ${dailyStatsDuration}ms:`, {
            hasAdPerf: !!(historicalResult?.adPerf),
            adPerfCount: historicalResult?.adPerf?.length || 0,
            hasQr: !!(historicalResult?.qr),
            qrCount: historicalResult?.qr?.length || 0,
            optimized: !!materialIdsForAd
          });
        } catch (aggError) {
          const dailyStatsDuration = Date.now() - dailyStatsStartTime;
          if (aggError.code === 50 || aggError.message.includes('exceeded time limit') || aggError.message.includes('timed out')) {
            console.error(`⏱️ [PERFORMANCE] getDailyStatsFromHistory - MongoDB aggregation timeout after ${dailyStatsDuration}ms`);
            historicalResult = []; // Return empty result on timeout
          } else {
            console.error('❌ [PERFORMANCE] getDailyStatsFromHistory - Aggregation error:', aggError.message);
            throw aggError;
          }
        }
      }

      const adPerfByDate = new Map((historicalResult?.adPerf || []).map(d => [d._id, d]));
      const qrByDate = new Map((historicalResult?.qr || []).map(d => [d._id, d.qrScans]));

      // ✅ Get current day data from DeviceTracking if date range includes today
      // ✅ PERFORMANCE: Reuse materialIdsForAd if available (already fetched above)
      if (includesToday) {
        try {
          const Material = require('../models/Material');
          let materialIds = [];
          
          // ✅ PERFORMANCE: Use materialIdsForAd if filtering by adId (already fetched)
          if (materialIdsForAd && materialIdsForAd.length > 0) {
            materialIds = materialIdsForAd;
            console.log('📊 [PERFORMANCE] getDailyStatsFromHistory - Reusing materialIdsForAd for current day query:', materialIds.length);
          } else {
            // Get user's ads to find associated materials (only if not already fetched)
            for (const ad of userAds) {
              const deviceRefs = (ad.targetDevices && ad.targetDevices.length > 0) 
                ? ad.targetDevices 
                : (ad.materialId && ad.materialId.length > 0 ? ad.materialId : []);
              
              if (deviceRefs.length > 0) {
                const materials = await Material.find({ _id: { $in: deviceRefs } }).select('materialId').lean();
                materials.forEach(material => {
                  if (material.materialId && !materialIds.includes(material.materialId)) {
                    materialIds.push(material.materialId);
                  }
                });
              }
            }
          }

          if (materialIds.length > 0) {
            // Get current day data from DeviceTracking
            const currentDayData = await DeviceTracking.find({
              materialId: { $in: materialIds },
              date: todayStr
            });

            // Aggregate current day stats
            let todayAdsPlayed = 0;
            let todayDisplayTime = 0;
            let todayQRScans = 0;
            let totalCompletionRate = 0;
            let completionRateCount = 0;

            currentDayData.forEach(device => {
              // ✅ Process adPlaybacks for current day (matching getDeviceStatsFromHistory approach)
              if (device.adPlaybacks && device.adPlaybacks.length > 0) {
                device.adPlaybacks.forEach(playback => {
                  // ✅ FIX: Include playbacks where isMaster is true OR missing (backward compatibility)
                  // This matches the historical data filtering logic
                  const isMasterPlayback = playback.isMaster === true || playback.isMaster === undefined;
                  // ✅ FIX: Filter by checking if adId belongs to user's ads (matching historical logic)
                  // Don't check userId - just check if adId is in user's ads
                  const playbackAdId = playback.adId?.toString();
                  const belongsToUser = playbackAdId && userAdIds.includes(playbackAdId);
                  const matchesFilter = !adId || playbackAdId === adId || playbackAdId === adId.toString();
                  
                  if (isMasterPlayback && belongsToUser && matchesFilter) {
                    todayAdsPlayed += 1; // Count each playback as 1 play
                    todayDisplayTime += playback.viewTime || 0;
                    if (playback.completionRate) {
                      totalCompletionRate += playback.completionRate;
                      completionRateCount++;
                    }
                  }
                });
              }

              // Process QR scans for current day
              if (device.qrScans && device.qrScans.length > 0) {
                device.qrScans.forEach(qrScan => {
                  // ✅ FIX: Filter by checking if adId belongs to user's ads (matching historical logic)
                  // Don't check userId - just check if adId is in user's ads
                  const scanAdId = qrScan.adId?.toString();
                  const belongsToUser = scanAdId && userAdIds.includes(scanAdId);
                  const matchesFilter = !adId || scanAdId === adId || scanAdId === adId.toString();
                  
                  if (belongsToUser && matchesFilter) {
                    todayQRScans += 1;
                  }
                });
              }
            });

            const todayCompletionRate = completionRateCount > 0 ? totalCompletionRate / completionRateCount : 0;

            // ✅ Add today's data from DeviceTracking (today is excluded from historical query to avoid double-counting)
            // DeviceTracking is the authoritative source for today's data (real-time)
            adPerfByDate.set(todayStr, {
              _id: todayStr,
              adsPlayed: todayAdsPlayed,
              displayTime: todayDisplayTime,
              completionRate: todayCompletionRate
            });
            qrByDate.set(todayStr, todayQRScans);
          }
        } catch (currentDayError) {
          console.error('Error getting current day data from DeviceTracking:', currentDayError);
          // Continue with historical data only if current day query fails
        }
      }

      const dates = Array.from(new Set([ ...adPerfByDate.keys(), ...qrByDate.keys() ])).sort();
      const result = dates.map(dateStr => {
        const ap = adPerfByDate.get(dateStr) || {};
        const adsPlayed = ap.adsPlayed || 0;
        // ✅ Debug logging to help identify the +1 issue
        if (adsPlayed > 0) {
          console.log(`📊 [getDailyStatsFromHistory] Date: ${dateStr}, adsPlayed: ${adsPlayed}`);
        }
        return {
          date: dateStr,
          adsPlayed: adsPlayed,
          displayTime: ap.displayTime || 0,
          qrScans: qrByDate.get(dateStr) || 0,
          completionRate: ap.completionRate || 0
        };
      });
      
      // ✅ Debug: Log total plays across all dates
      const totalPlays = result.reduce((sum, day) => sum + day.adsPlayed, 0);
      if (isVerbose()) logger.verbose(`📊 [getDailyStatsFromHistory] Total plays across all dates: ${totalPlays}`);
      
      return result;
    } catch (error) {
      console.error('Error getting daily stats from history:', error);
      return [];
    }
  }

  // ✅ NEW: Get per-ad daily stats from DeviceDataHistoryV2 (groups by date AND adId)
  // This function returns daily stats with adId field for fast filtering in UserAnalytics
  static async getPerAdDailyStatsFromHistory(userId, startDate, endDate) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const DeviceTracking = require('../models/deviceTracking');
      const Ad = require('../models/Ad');
      const mongoose = require('mongoose');

      // Check if current day is included in the date range
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
      const includesToday = today >= startDateObj && today <= endDateObj;

      // Get user's ads and adIds
      const userAds = await Ad.find({ userId: userId }).select('_id materialId targetDevices').lean();
      const userAdIds = userAds.map(ad => ad._id.toString()).filter(Boolean);
      
      if (userAdIds.length === 0) {
        console.log('📊 [getPerAdDailyStatsFromHistory] No ads found for user:', userId);
        return [];
      }

      // Get all materialIds for user's ads
      const Material = require('../models/Material');
      const allMaterialRefs = [];
      for (const ad of userAds) {
        if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
          allMaterialRefs.push(...ad.materialId);
        }
        if (ad.targetDevices && Array.isArray(ad.targetDevices) && ad.targetDevices.length > 0) {
          allMaterialRefs.push(...ad.targetDevices);
        }
      }
      const uniqueMaterialRefs = [...new Set(allMaterialRefs.map(ref => ref.toString()))];
      
      let materialIds = [];
      if (uniqueMaterialRefs.length > 0) {
        const materials = await Material.find({ 
          _id: { $in: uniqueMaterialRefs.map(id => new mongoose.Types.ObjectId(id)) } 
        }).select('materialId').lean();
        materialIds = materials.map(m => m.materialId).filter(Boolean);
      }

      if (materialIds.length === 0) {
        console.log('📊 [getPerAdDailyStatsFromHistory] No materials found for user:', userId);
        return [];
      }

      // Build filter condition for user's adIds (filter by user's ads only)
      const adPlaybackMatchConditions = userAdIds.map(adIdStr => ({
        $eq: ['$$playback.adId', adIdStr]
      })).concat(userAdIds.map(adIdStr => ({
        $eq: [{ $toString: '$$playback.adId' }, adIdStr]
      })));

      const qrScanMatchConditions = userAdIds.map(adIdStr => ({
        $eq: ['$$scan.adId', adIdStr]
      })).concat(userAdIds.map(adIdStr => ({
        $eq: [{ $toString: '$$scan.adId' }, adIdStr]
      })));

      // Build filter conditions
      const adPlaybackFilterCondition = {
        $and: [
          { $ne: ['$$playback.isMaster', false] }, // Include master playbacks only
          { $or: adPlaybackMatchConditions } // Filter by user's adIds
        ]
      };

      const qrScanFilterCondition = qrScanMatchConditions.length > 0 ? { $or: qrScanMatchConditions } : false;

      // Get historical data (exclude today)
      const finalHistoricalEndDate = includesToday ? new Date(today.getTime() - 1) : endDateObj;
      let historicalResult = [];

      if (startDateObj <= finalHistoricalEndDate && materialIds.length > 0) {
        // Build aggregation pipeline - GROUP BY DATE, ADID, AND MATERIALID
        const perAdPipeline = [
          // Stage 1: Filter by materialIds
          {
            $match: {
              materialId: { $in: materialIds }
            }
          },
          // Stage 2: Unwind dailyData
          { $unwind: '$dailyData' },
          // Stage 3: Filter by date range
          {
            $match: {
              'dailyData.date': {
                $gte: startDateObj,
                $lte: finalHistoricalEndDate
              }
            }
          },
          // Stage 4: Facet to get ad performance and QR scans (grouped by date, adId, and materialId)
          {
            $facet: {
              adPerf: [
                {
                  $project: {
                    date: '$dailyData.date',
                    materialId: '$materialId',  // ✅ Preserve materialId in projection
                    filteredAdPlaybacks: {
                      $filter: {
                        input: { $ifNull: ['$dailyData.adPlaybacks', []] },
                        as: 'playback',
                        cond: adPlaybackFilterCondition
                      }
                    }
                  }
                },
                {
                  $match: {
                    $expr: { $gt: [{ $size: '$filteredAdPlaybacks' }, 0] }
                  }
                },
                // ✅ KEY CHANGE: Unwind playbacks to group by adId
                { $unwind: '$filteredAdPlaybacks' },
                {
                  $group: {
                    _id: {
                      date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                      adId: {
                        $cond: {
                          if: { $ne: [{ $type: '$filteredAdPlaybacks.adId' }, 'string'] },
                          then: { $toString: '$filteredAdPlaybacks.adId' },
                          else: '$filteredAdPlaybacks.adId'
                        }
                      },
                      materialId: '$materialId'  // ✅ Add materialId to grouping
                    },
                    adsPlayed: { $sum: 1 },
                    displayTime: { $sum: { $ifNull: ['$filteredAdPlaybacks.viewTime', 0] } },
                    completionRate: { $avg: { $ifNull: ['$filteredAdPlaybacks.completionRate', 0] } }
                  }
                },
                { $sort: { '_id.date': 1, '_id.adId': 1, '_id.materialId': 1 } }
              ],
              qr: [
                {
                  $project: {
                    date: '$dailyData.date',
                    materialId: '$materialId',  // ✅ Preserve materialId in projection
                    filteredQrScans: qrScanFilterCondition ? {
                      $filter: {
                        input: { $ifNull: ['$dailyData.qrScans', []] },
                        as: 'scan',
                        cond: qrScanFilterCondition
                      }
                    } : { $ifNull: ['$dailyData.qrScans', []] }
                  }
                },
                {
                  $match: {
                    $expr: { $gt: [{ $size: '$filteredQrScans' }, 0] }
                  }
                },
                // ✅ KEY CHANGE: Unwind QR scans to group by adId
                { $unwind: '$filteredQrScans' },
                {
                  $group: {
                    _id: {
                      date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                      adId: {
                        $cond: {
                          if: { $ne: [{ $type: '$filteredQrScans.adId' }, 'string'] },
                          then: { $toString: '$filteredQrScans.adId' },
                          else: '$filteredQrScans.adId'
                        }
                      },
                      materialId: '$materialId'  // ✅ Add materialId to grouping
                    },
                    qrScans: { $sum: 1 }
                  }
                },
                { $sort: { '_id.date': 1, '_id.adId': 1, '_id.materialId': 1 } }
              ]
            }
          }
        ];

        try {
          console.log('📊 [getPerAdDailyStatsFromHistory] Running per-ad aggregation...');
          const [result] = await DeviceDataHistoryV2.aggregate(perAdPipeline, {
            maxTimeMS: 30000, // 30 seconds timeout
            allowDiskUse: true
          });
          historicalResult = result || [];
          console.log(`📊 [getPerAdDailyStatsFromHistory] Aggregation completed:`, {
            adPerfCount: historicalResult?.adPerf?.length || 0,
            qrCount: historicalResult?.qr?.length || 0
          });
        } catch (aggError) {
          console.error('❌ [getPerAdDailyStatsFromHistory] Aggregation error:', aggError.message);
          if (aggError.code === 50 || aggError.message.includes('timeout')) {
            historicalResult = [];
          } else {
            throw aggError;
          }
        }
      }

      // Process historical results into Maps keyed by date+adId+materialId
      const adPerfByDateAndAdAndMaterial = new Map();
      const qrByDateAndAdAndMaterial = new Map();

      // Process ad performance data
      if (historicalResult?.adPerf) {
        historicalResult.adPerf.forEach(item => {
          const materialId = item._id.materialId || null;
          const key = `${item._id.date}_${item._id.adId}_${materialId || 'null'}`;
          adPerfByDateAndAdAndMaterial.set(key, {
            date: item._id.date,
            adId: item._id.adId,
            materialId: materialId,
            adsPlayed: item.adsPlayed || 0,
            displayTime: item.displayTime || 0,
            completionRate: item.completionRate || 0
          });
        });
      }

      // Process QR scan data
      if (historicalResult?.qr) {
        historicalResult.qr.forEach(item => {
          const materialId = item._id.materialId || null;
          const key = `${item._id.date}_${item._id.adId}_${materialId || 'null'}`;
          qrByDateAndAdAndMaterial.set(key, item.qrScans || 0);
        });
      }

      // Get current day data from DeviceTracking if date range includes today
      if (includesToday && materialIds.length > 0) {
        try {
          const currentDayData = await DeviceTracking.find({
            materialId: { $in: materialIds },
            date: todayStr
          });

          // Group today's data by adId and materialId
          const todayDataByAdAndMaterial = new Map();

          currentDayData.forEach(device => {
            const materialId = device.materialId || null;
            
            // Process adPlaybacks
            if (device.adPlaybacks && device.adPlaybacks.length > 0) {
              device.adPlaybacks.forEach(playback => {
                const isMasterPlayback = playback.isMaster === true || playback.isMaster === undefined;
                const playbackAdId = playback.adId?.toString();
                const belongsToUser = playbackAdId && userAdIds.includes(playbackAdId);

                if (isMasterPlayback && belongsToUser) {
                  const key = `${playbackAdId}_${materialId || 'null'}`;
                  if (!todayDataByAdAndMaterial.has(key)) {
                    todayDataByAdAndMaterial.set(key, {
                      adId: playbackAdId,
                      materialId: materialId,
                      adsPlayed: 0,
                      displayTime: 0,
                      completionRates: [],
                      qrScans: 0
                    });
                  }
                  const adData = todayDataByAdAndMaterial.get(key);
                  adData.adsPlayed += 1;
                  adData.displayTime += playback.viewTime || 0;
                  if (playback.completionRate) {
                    adData.completionRates.push(playback.completionRate);
                  }
                }
              });
            }

            // Process QR scans
            if (device.qrScans && device.qrScans.length > 0) {
              device.qrScans.forEach(qrScan => {
                const scanAdId = qrScan.adId?.toString();
                const belongsToUser = scanAdId && userAdIds.includes(scanAdId);

                if (belongsToUser) {
                  const key = `${scanAdId}_${materialId || 'null'}`;
                  if (!todayDataByAdAndMaterial.has(key)) {
                    todayDataByAdAndMaterial.set(key, {
                      adId: scanAdId,
                      materialId: materialId,
                      adsPlayed: 0,
                      displayTime: 0,
                      completionRates: [],
                      qrScans: 0
                    });
                  }
                  const adData = todayDataByAdAndMaterial.get(key);
                  adData.qrScans += 1;
                }
              });
            }
          });

          // Add today's data to Maps
          todayDataByAdAndMaterial.forEach((adData) => {
            const key = `${todayStr}_${adData.adId}_${adData.materialId || 'null'}`;
            const completionRate = adData.completionRates.length > 0
              ? adData.completionRates.reduce((sum, rate) => sum + rate, 0) / adData.completionRates.length
              : 0;

            adPerfByDateAndAdAndMaterial.set(key, {
              date: todayStr,
              adId: adData.adId,
              materialId: adData.materialId,
              adsPlayed: adData.adsPlayed,
              displayTime: adData.displayTime,
              completionRate: completionRate
            });
            qrByDateAndAdAndMaterial.set(key, adData.qrScans);
          });
        } catch (currentDayError) {
          console.error('❌ [getPerAdDailyStatsFromHistory] Error getting current day data:', currentDayError.message);
        }
      }

      // Combine ad performance and QR scan data
      const resultMap = new Map();
      
      // Add all ad performance entries
      adPerfByDateAndAdAndMaterial.forEach((value, key) => {
        if (!resultMap.has(key)) {
          resultMap.set(key, {
            date: value.date,
            adId: value.adId,
            materialId: value.materialId,  // ✅ Include materialId
            adsPlayed: value.adsPlayed,
            displayTime: value.displayTime,
            completionRate: value.completionRate,
            qrScans: 0,
            impressions: 0
          });
        } else {
          const existing = resultMap.get(key);
          existing.adsPlayed = value.adsPlayed;
          existing.displayTime = value.displayTime;
          existing.completionRate = value.completionRate;
        }
      });

      // Add QR scan data
      qrByDateAndAdAndMaterial.forEach((qrScans, key) => {
        if (!resultMap.has(key)) {
          const parts = key.split('_');
          const date = parts[0];
          const adId = parts[1];
          const materialId = parts.length > 2 && parts[2] !== 'null' ? parts[2] : null;
          resultMap.set(key, {
            date: date,
            adId: adId,
            materialId: materialId,  // ✅ Include materialId
            adsPlayed: 0,
            displayTime: 0,
            completionRate: 0,
            qrScans: qrScans,
            impressions: 0
          });
        } else {
          const existing = resultMap.get(key);
          existing.qrScans = qrScans;
        }
      });

      // Convert Map to array and sort by date, then adId, then materialId
      // Note: adId is stored as string in result, will be converted to ObjectId when storing in UserAnalytics
      const result = Array.from(resultMap.values()).sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        // If dates are equal, sort by adId (nulls last)
        if (!a.adId && !b.adId) {
          // Both null, sort by materialId
          const matCompare = (a.materialId || '').localeCompare(b.materialId || '');
          return matCompare;
        }
        if (!a.adId) return 1;
        if (!b.adId) return -1;
        // Compare as strings (adId is string in result)
        const aAdId = typeof a.adId === 'string' ? a.adId : a.adId.toString();
        const bAdId = typeof b.adId === 'string' ? b.adId : b.adId.toString();
        const adIdCompare = aAdId.localeCompare(bAdId);
        if (adIdCompare !== 0) return adIdCompare;
        // If adIds are equal, sort by materialId (nulls last)
        const matCompare = (a.materialId || '').localeCompare(b.materialId || '');
        return matCompare;
      });

      console.log(`✅ [getPerAdDailyStatsFromHistory] Returning ${result.length} per-ad daily stats entries`);
      return result;
    } catch (error) {
      console.error('❌ [getPerAdDailyStatsFromHistory] Error:', error);
      return [];
    }
  }

  // Get ad performance data from device stats when ads array is empty
  static async getAdPerformanceFromDeviceStats(userId, startDate, endDate) {
    try {
      console.log('📊 getAdPerformanceFromDeviceStats called for user:', userId, 'with date range:', startDate, 'to', endDate);
      
      // Get user's ads (including SCHEDULED ads for dropdown display)
      const Ad = require('../models/Ad');
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (userAds.length === 0) {
        console.log('📊 No active ads found for user');
        return [];
      }

      // Get all devices that have data (don't filter by date range for device discovery)
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const devicesWithData = await DeviceDataHistoryV2.find({
        // Find devices that have any data for this user, regardless of date
        'dailyData.adPerformance.userId': userId
      });

      console.log('📊 Found devices with data:', devicesWithData.length);
      console.log('📊 Device IDs:', devicesWithData.map(d => d.materialId));

      const adPerformanceMap = new Map();

      // Initialize ad performance for each user ad
      userAds.forEach(ad => {
        adPerformanceMap.set(ad._id.toString(), {
          adId: ad._id.toString(),
          adTitle: ad.title || ad.adTitle || 'Unknown Ad',
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          // qrScanConversionRate removed
          lastUpdated: new Date().toISOString(),
          materials: []
        });
      });

      // Aggregate data from each device
      for (const device of devicesWithData) {
        try {
          // For "All Time" data, don't pass date parameters to getDeviceSpecificAnalytics
          const deviceAnalytics = await this.getDeviceSpecificAnalytics(userId, device.materialId);
          
          if (deviceAnalytics.success && deviceAnalytics.deviceAnalytics) {
            const deviceData = deviceAnalytics.deviceAnalytics;
            
            // Process ad performance data from this device
            if (deviceData.adPerformance && deviceData.adPerformance.length > 0) {
              deviceData.adPerformance.forEach(deviceAd => {
                const adId = deviceAd.adId;
                if (adPerformanceMap.has(adId)) {
                  const adPerf = adPerformanceMap.get(adId);
                  
                  // Aggregate totals
                  adPerf.totalDevices += 1;
                  adPerf.totalAdPlayTime += deviceAd.totalViewTime || 0;
                  
                  // Calculate QR scans from qrScanBreakdown
                  if (deviceData.qrScanBreakdown && deviceData.qrScanBreakdown.length > 0) {
                    const qrBreakdown = deviceData.qrScanBreakdown.find(qr => qr.adId === adId);
                    if (qrBreakdown) {
                      adPerf.totalQRScans += qrBreakdown.totalScans || 0;
                    }
                  }
                  
                  // Add material info
                  adPerf.materials.push({
                    materialId: device.materialId,
                    materialName: device.materialId,
                    carGroupId: device.carGroupId || null,
                    totalAdPlayTime: deviceAd.totalViewTime || 0,
                    totalQRScans: deviceData.qrScanBreakdown?.find(qr => qr.adId === adId)?.totalScans || 0,
                    averageCompletionRate: deviceAd.averageCompletionRate || 0,
                    lastActivity: deviceAd.lastPlayed || null
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error processing device ${device.materialId}:`, error);
          // Continue with other devices
        }
      }

      // Calculate averages and finalize data
      const result = Array.from(adPerformanceMap.values()).map(adPerf => {
        // Calculate average completion rate
        // Calculate average completion rate (using totalAdPlays instead of impressions)
        if (adPerf.totalAdPlayTime > 0 && adPerf.totalAdPlays > 0) {
          adPerf.averageAdCompletionRate = (adPerf.totalAdPlayTime / (adPerf.totalAdPlays * 30)) * 100; // Assuming 30s average ad duration
        }
        
        // Calculate QR scan conversion rate (using totalAdPlays instead of impressions)
        if (adPerf.totalAdPlays > 0) {
          // qrScanConversionRate removed - no longer needed
        }
        
        return adPerf;
      });

      console.log('📊 Ad performance from device stats result:', result.length, 'ads');
      return result;
    } catch (error) {
      console.error('Error getting ad performance from device stats:', error);
      return [];
    }
  }

  // Get device status information using real-time WebSocket status (same as admin)
  static async getDeviceStatusInfo(materialIds) {
    try {
      // Import the real-time device status service singleton (same as admin system)
      const deviceStatusService = require('./deviceStatusService');
      const DeviceTracking = require('../models/deviceTracking');
      const Tablet = require('../models/Tablet');
      
      // Get registered devices from tablet system
      const registeredDevices = new Map();
      const tablets = await Tablet.find({});
      tablets.forEach(tablet => {
        tablet.tablets.forEach(tabletDevice => {
          if (tabletDevice.deviceId) {
            registeredDevices.set(tabletDevice.deviceId, {
              materialId: tablet.materialId,
              carGroupId: tablet.carGroupId,
              slotNumber: tabletDevice.tabletNumber,
              status: tabletDevice.status,
              lastSeen: tabletDevice.lastSeen
            });
          }
        });
      });

      // Get device tracking records for the material IDs
      const allDevices = await DeviceTracking.find({ 
        materialId: { $in: materialIds }
      });

      // Create status map using real-time WebSocket status
      const statusMap = new Map();
      
      allDevices.forEach(device => {
        if (device.slots && device.slots.length > 0) {
          // Process each slot with real-time status
          device.slots.forEach(slot => {
            const deviceInfo = registeredDevices.get(slot.deviceId);
            if (deviceInfo && materialIds.includes(device.materialId)) {
              // Use real-time WebSocket status (same as admin system)
              console.log(`🔍 [UserAnalytics] Checking status for deviceId: ${slot.deviceId}, materialId: ${device.materialId}`);
              const realTimeStatus = deviceStatusService.getDeviceStatus(slot.deviceId);
              let isOnline = realTimeStatus.isOnline || false;
              
              // Trust DeviceStatusManager output - no timeout override
              // DeviceStatusManager already handles WebSocket priority correctly
              
              console.log(`🔍 [UserAnalytics] Real-time status for ${slot.deviceId}:`, {
                isOnline: isOnline,
                originalStatus: realTimeStatus.isOnline,
                source: realTimeStatus.source,
                confidence: realTimeStatus.confidence,
                lastSeen: realTimeStatus.lastSeen,
                timeSinceLastSeen: timeSinceLastSeen
              });
              
              const slotStatus = {
                deviceId: slot.deviceId,
                materialId: device.materialId,
                slotNumber: slot.slotNumber,
                isOnline: isOnline,
                lastSeen: realTimeStatus.lastSeen || device.lastSeen,
                displayStatus: isOnline ? 'ONLINE' : 'OFFLINE',
                statusSource: realTimeStatus.source || 'database' // Track where status came from
              };
              
              if (!statusMap.has(device.materialId)) {
                statusMap.set(device.materialId, {
                  materialId: device.materialId,
                  slots: []
                });
              }
              
              statusMap.get(device.materialId).slots.push(slotStatus);
              
              console.log(`📊 [UserAnalytics] Device ${slot.deviceId} (${device.materialId}): ${isOnline ? 'ONLINE' : 'OFFLINE'} (source: ${realTimeStatus.source})`);
            }
          });
        }
      });

      return statusMap;
    } catch (error) {
      console.error('Error getting device status info:', error);
      return new Map();
    }
  }

  // Get device stats from DeviceDataHistoryV2 filtered by userId (and optionally by adId)
  // ✅ NEW: Includes DeviceTracking for current day if date range includes today
  static async getDeviceStatsFromHistory(userId, startDate, endDate, adId = null) {
    try {
      console.log('📊 getDeviceStatsFromHistory - Using optimized aggregation pipeline', adId ? `(filtering by adId: ${adId})` : '(all ads)');
      
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const DeviceTracking = require('../models/deviceTracking');
      const Ad = require('../models/Ad');
      const mongoose = require('mongoose');

      // Check if current day is included in the date range
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
      const includesToday = today >= startDateObj && today <= endDateObj;

      // ✅ Get historical data from DeviceDataHistoryV2
      // IMPORTANT: Include today in historical query if today is in the date range
      // This is because data may already be archived to DeviceDataHistoryV2 for today
      // We'll also query DeviceTracking for today's data and prioritize it if it exists (more complete/accurate)
      // If today is in range, include it in historical query (don't exclude it)
      const finalHistoricalEndDate = includesToday ? today : endDateObj;
      const shouldIncludeTodayInHistorical = includesToday;
      
      // ✅ PERFORMANCE OPTIMIZATION: Get user's adIds and materialIds first
      // If filtering by specific adId, get materialIds for that ad to reduce dataset size
      // ✅ Exclude archived/deleted ads to ensure their data is not included in totals
      const userAds = await Ad.find({ 
        userId: userId,
        isArchived: false  // ✅ Exclude archived/deleted ads
      }).select('_id materialId targetDevices');
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      if (userAdIds.length === 0) {
        console.log('📊 [getDeviceStatsFromHistory] No ads found for user, returning empty array');
        return [];
      }
      
      // ✅ PERFORMANCE OPTIMIZATION: If filtering by adId, get materialIds for that ad
      // This allows us to filter by materialId early in the pipeline, reducing documents processed
      let materialIdsForAd = null;
      if (adId) {
        const Material = require('../models/Material');
        const selectedAd = userAds.find(ad => ad._id.toString() === adId || ad._id.toString() === adId.toString());
        if (selectedAd) {
          const deviceRefs = (selectedAd.targetDevices && selectedAd.targetDevices.length > 0) 
            ? selectedAd.targetDevices 
            : (selectedAd.materialId && selectedAd.materialId.length > 0 ? selectedAd.materialId : []);
          
          if (deviceRefs.length > 0) {
            const materials = await Material.find({ _id: { $in: deviceRefs } }).select('materialId').lean();
            materialIdsForAd = materials.map(m => m.materialId).filter(Boolean);
            console.log('📊 [PERFORMANCE] Filtering by materialIds for ad:', materialIdsForAd.length, 'materials');
          }
        }
      }
      
      // ✅ Build match conditions for adPlaybacks - handle both string and ObjectId formats
      const adIdMatchConditions = userAdIds.flatMap(adIdStr => [
        { $eq: ['$$playback.adId', adIdStr] },
        { $eq: [{ $toString: '$$playback.adId' }, adIdStr] }
      ]);
      
      // ✅ Build match conditions for QR scans - handle both string and ObjectId formats
      const qrScanMatchConditions = userAdIds.flatMap(adIdStr => [
        { $eq: ['$$scan.adId', adIdStr] },
        { $eq: [{ $toString: '$$scan.adId' }, adIdStr] }
      ]);
      
      // ✅ Build match conditions for qrScansByAd - similar to qrScanMatchConditions but for adScan
      const qrScansByAdMatchConditions = userAdIds.flatMap(adIdStr => [
        { $eq: ['$$adScan.adId', adIdStr] },
        { $eq: [{ $toString: '$$adScan.adId' }, adIdStr] }
      ]);
      
      console.log('📊 [getDeviceStatsFromHistory] Building optimized aggregation pipeline:', {
        userAdIdsCount: userAdIds.length,
        hasAdIdFilter: !!adId,
        materialIdsCount: materialIdsForAd?.length || 'all',
        dateRange: `${startDateObj.toISOString()} to ${finalHistoricalEndDate.toISOString()}`
      });
      
      // ✅ PERFORMANCE OPTIMIZATION: Build aggregation pipeline with early materialId filtering
      // Stage 0: Filter by materialId early (if filtering by specific ad) - uses index
      const pipeline = [];
      
      // ✅ CRITICAL OPTIMIZATION: Add materialId filter BEFORE unwinding if we know which materials have the ad
      // This dramatically reduces the number of documents processed
      if (materialIdsForAd && materialIdsForAd.length > 0) {
        pipeline.push({
          $match: {
            materialId: { $in: materialIdsForAd }
          }
        });
        console.log('📊 [PERFORMANCE] Added early materialId filter, reducing dataset from all devices to', materialIdsForAd.length, 'devices');
      }
      
      // Stage 1: Unwind dailyData array (after materialId filter if applied)
      pipeline.push({ $unwind: '$dailyData' });
      
      // Stage 2: Filter by date range (historical only) - uses index on dailyData.date
      // ✅ Always exclude today from historical aggregation when includesToday is true
      // We'll add today's data separately from DeviceTracking (more accurate/real-time)
      pipeline.push({
        $match: {
          'dailyData.date': includesToday
            ? { $gte: startDateObj, $lt: today } // Exclude today - will be added from DeviceTracking
            : { $gte: startDateObj, $lte: finalHistoricalEndDate }
        }
      });
        
      // Stage 3: Filter adPlaybacks by user's adIds (OPTIMIZED)
      // ✅ PERFORMANCE: Simplified filter conditions - removed redundant ObjectId conversions
      pipeline.push({
        $project: {
          materialId: 1,
          carGroupId: 1,
          date: '$dailyData.date',
          filteredAdPlaybacks: {
            $filter: {
              input: { $ifNull: ['$dailyData.adPlaybacks', []] },
              as: 'playback',
              cond: adId ? {
                // ✅ OPTIMIZED: Filter by specific adId - simplified conditions
                $or: [
                  { $eq: ['$$playback.adId', adId] },
                  { $eq: ['$$playback.adId', adId.toString()] },
                  { $eq: [{ $toString: '$$playback.adId' }, adId] },
                  { $eq: [{ $toString: '$$playback.adId' }, adId.toString()] }
                ]
              } : (adIdMatchConditions.length > 0 ? {
                // Filter by user's adIds
                $or: adIdMatchConditions
              } : { $ne: ['$$playback.adId', null] }) // Include all if no filter
            }
          },
          // ✅ FIX: Prefer qrScansByAd when available, fallback to qrScans
          // This prevents double-counting when both exist
          hasQrScansByAd: {
            $gt: [{ $size: { $ifNull: ['$dailyData.qrScansByAd', []] } }, 0]
          },
          filteredQrScansByAd: {
            $filter: {
              input: { $ifNull: ['$dailyData.qrScansByAd', []] },
              as: 'adScan',
              cond: adId ? {
                // Filter by specific adId
                $or: [
                  { $eq: ['$$adScan.adId', adId] },
                  { $eq: ['$$adScan.adId', adId.toString()] },
                  { $eq: [{ $toString: '$$adScan.adId' }, adId] },
                  { $eq: [{ $toString: '$$adScan.adId' }, adId.toString()] }
                ]
              } : (qrScansByAdMatchConditions.length > 0 ? {
                // Filter by user's adIds
                $or: qrScansByAdMatchConditions
              } : { $ne: ['$$adScan.adId', null] }) // Include all if no filter
            }
          },
          filteredQrScans: {
            $filter: {
              input: { $ifNull: ['$dailyData.qrScans', []] },
              as: 'scan',
              cond: adId ? {
                // ✅ OPTIMIZED: Filter by specific adId - simplified conditions
                $or: [
                  { $eq: ['$$scan.adId', adId] },
                  { $eq: ['$$scan.adId', adId.toString()] },
                  { $eq: [{ $toString: '$$scan.adId' }, adId] },
                  { $eq: [{ $toString: '$$scan.adId' }, adId.toString()] }
                ]
              } : (qrScanMatchConditions.length > 0 ? {
                // Filter by user's adIds
                $or: qrScanMatchConditions
              } : { $ne: ['$$scan.adId', null] }) // Include all if no filter
            }
          }
        }
      });
      
      // Stage 4: Filter out documents with no matching adPlaybacks (early filtering)
      pipeline.push({
        $match: {
          $expr: { $gt: [{ $size: '$filteredAdPlaybacks' }, 0] }
        }
      });
      
      // Stage 5: Group by materialId to get totals per device
      pipeline.push({
        $group: {
          _id: '$materialId',
          materialId: { $first: '$materialId' },
          carGroupId: { $first: '$carGroupId' },
          totalAdPlays: { 
            $sum: { $size: '$filteredAdPlaybacks' }
          },
          totalAdPlayTime: { 
            $sum: {
              $sum: {
                $map: {
                  input: '$filteredAdPlaybacks',
                  as: 'playback',
                  in: { $ifNull: ['$$playback.viewTime', 0] }
                }
              }
            }
          },
          // ✅ FIX: Prefer qrScansByAd count when available, otherwise use raw qrScans count
          // This prevents double-counting when both qrScansByAd and qrScans exist
          totalQRScans: {
            $sum: {
              $cond: [
                '$hasQrScansByAd',
                // Use qrScansByAd: sum the scanCount from filtered entries
                {
                  $reduce: {
                    input: '$filteredQrScansByAd',
                    initialValue: 0,
                    in: { $add: ['$$value', { $ifNull: ['$$this.scanCount', 0] }] }
                  }
                },
                // Fallback to raw qrScans count
                { $size: '$filteredQrScans' }
              ]
            }
          },
          lastActivity: { $max: '$date' }
        }
      });
      
      // Stage 6: Filter out devices with no data
      pipeline.push({
        $match: {
          $or: [
            { totalAdPlays: { $gt: 0 } },
            { totalQRScans: { $gt: 0 } }
          ]
        }
      });
      
      // Stage 7: Sort by last activity
      pipeline.push({ $sort: { lastActivity: -1 } });

      // ✅ PERFORMANCE: Run aggregation with optimized timeout and error handling
      const aggregationStartTime = Date.now();
      let aggregationResult = [];
      
      if (startDateObj <= finalHistoricalEndDate) {
        // Only query historical data if there are dates before today
        try {
          console.log('📊 [PERFORMANCE] Running optimized aggregation pipeline...', {
            stages: pipeline.length,
            hasMaterialIdFilter: !!materialIdsForAd,
            materialIdsCount: materialIdsForAd?.length || 'all',
            dateRange: `${startDateObj.toISOString()} to ${finalHistoricalEndDate.toISOString()}`
          });
          
          // ✅ PERFORMANCE: Reduced timeout from 20s to 15s for faster failure
          // Increased allowDiskUse for large datasets
          aggregationResult = await DeviceDataHistoryV2.aggregate(pipeline, {
            maxTimeMS: 15000, // 15 seconds timeout (reduced from 20s for faster failure)
            allowDiskUse: true // Allow using disk for large datasets
            // Note: MongoDB will automatically use the best index based on $match stages
          });
          
          const aggregationDuration = Date.now() - aggregationStartTime;
          console.log(`📊 [PERFORMANCE] Aggregation completed in ${aggregationDuration}ms:`, {
            devicesFound: aggregationResult.length,
            optimized: !!materialIdsForAd
          });
          
          if (aggregationResult.length > 0 && isVerbose()) {
            logger.verbose('📊 Sample aggregation result:', aggregationResult[0]);
          }
        } catch (aggError) {
          const aggregationDuration = Date.now() - aggregationStartTime;
          if (aggError.code === 50 || aggError.message.includes('exceeded time limit') || aggError.message.includes('timed out')) {
            console.error(`⏱️ [PERFORMANCE] MongoDB aggregation timeout after ${aggregationDuration}ms - returning empty result`);
            aggregationResult = []; // Continue with current day data only
          } else {
            console.error('❌ [PERFORMANCE] Aggregation error:', aggError.message);
            throw aggError; // Re-throw if it's not a timeout error
          }
        }
      }

      // ✅ Get current day data from DeviceTracking if date range includes today
      const currentDayDeviceStats = new Map();
      if (includesToday) {
        try {
          // Get user's ads to find associated materials
          const userAds = await Ad.find({ userId: userId });
          const userAdIds = userAds.map(ad => ad._id.toString()); // ✅ Extract userAdIds for filtering
          const materialIdsSet = new Set(); // 🔧 Use Set for deduplication
          
          // Get Material model to look up materialId strings
          const Material = require('../models/Material');
          
          // Step 1: Get currently assigned devices
          for (const ad of userAds) {
            // Check targetDevices first (newer field), then materialId (legacy)
            const deviceRefs = (ad.targetDevices && ad.targetDevices.length > 0) 
              ? ad.targetDevices 
              : (ad.materialId && ad.materialId.length > 0 ? ad.materialId : []);
            
            if (deviceRefs.length > 0) {
              // Look up Material documents to get materialId strings
              const materials = await Material.find({ _id: { $in: deviceRefs } }).select('materialId');
              materials.forEach(material => {
                if (material.materialId) {
                  materialIdsSet.add(material.materialId);
                }
              });
            }
          }
          
          // 🔧 FIX: Step 2 - Also find devices that have historical data for user's ads
          // This handles cases where ads were reassigned to different devices
          try {
            const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
            const historicalDevices = await DeviceDataHistoryV2.aggregate([
              {
                $match: {
                  $or: [
                    { 'dailyData.adPlaybacks.adId': { $in: userAdIds } },
                    { 'dailyData.adPerformance.adId': { $in: userAdIds } },
                    { 'dailyData.qrScans.adId': { $in: userAdIds } },
                    { 'dailyData.qrScansByAd.adId': { $in: userAdIds } }
                  ]
                }
              },
              { $project: { materialId: 1 } }
            ], { maxTimeMS: 5000 });
            
            historicalDevices.forEach(device => {
              if (device.materialId) {
                materialIdsSet.add(device.materialId);
              }
            });
          } catch (histError) {
            console.warn('⚠️ [getDeviceStatsFromHistory] Could not fetch historical devices:', histError.message);
          }
          
          const materialIds = Array.from(materialIdsSet);

          console.log('📊 [getDeviceStatsFromHistory] Found materialIds for user (including historical):', materialIds.length, materialIds);
          console.log('📊 [getDeviceStatsFromHistory] User adIds for filtering:', userAdIds.length, userAdIds);

          if (materialIds.length > 0) {
            // Get current day data from DeviceTracking
            const currentDayData = await DeviceTracking.find({
              materialId: { $in: materialIds },
              date: todayStr
            });

            // Aggregate current day stats per device
            currentDayData.forEach(device => {
              let totalAdPlays = 0;
              let totalAdPlayTime = 0;
              let totalQRScans = 0;

              // Process adPerformance for current day
              if (device.adPerformance && device.adPerformance.length > 0) {
                device.adPerformance.forEach(adPerf => {
                  // ✅ FIX: Filter by userId AND check if adId belongs to user's ads
                  const belongsToUser = adPerf.userId === userId.toString() || (adPerf.adId && userAdIds.includes(adPerf.adId));
                  const matchesFilter = !adId || adPerf.adId === adId || adPerf.adId.toString() === adId;
                  
                  if (belongsToUser && matchesFilter) {
                    totalAdPlays += adPerf.playCount || 0;
                    totalAdPlayTime += adPerf.totalViewTime || 0;
                  }
                });
              }

              // ✅ FIX: Process QR scans for current day - prefer qrScansByAd when available to prevent double-counting
              const hasQrScansByAd = device.qrScansByAd && device.qrScansByAd.length > 0;
              
              if (hasQrScansByAd) {
                // Process aggregated qrScansByAd
                device.qrScansByAd.forEach(adScan => {
                  const normalizedAdId = adScan.adId ? adScan.adId.toString() : '';
                  const belongsToUser = adScan.userId === userId.toString() || (normalizedAdId && userAdIds.includes(normalizedAdId));
                  const matchesFilter = !adId || normalizedAdId === adId || normalizedAdId === adId.toString();
                  
                  if (belongsToUser && matchesFilter) {
                    totalQRScans += adScan.scanCount || 0;
                  }
                });
              } else if (device.qrScans && device.qrScans.length > 0) {
                // Fallback to raw qrScans only if qrScansByAd is empty
                const deviceTotalScans = device.qrScans.length;
                let filteredScans = 0;
                
                device.qrScans.forEach(qrScan => {
                  // ✅ FIX: Filter by userId AND check if adId belongs to user's ads
                  // This ensures we only count QR scans for the user's ads, not all scans from the device
                  const normalizedAdId = qrScan.adId ? qrScan.adId.toString() : '';
                  const belongsToUser = qrScan.userId === userId.toString() || (normalizedAdId && userAdIds.includes(normalizedAdId));
                  const matchesFilter = !adId || normalizedAdId === adId || normalizedAdId === adId.toString();
                  
                  if (belongsToUser && matchesFilter) {
                    totalQRScans += 1;
                    filteredScans += 1;
                  }
                });
                
                // ✅ Debug: Log filtering results
                if (deviceTotalScans > 0) {
                  console.log(`📊 [Current Day] Device ${device.materialId}: ${deviceTotalScans} total scans, ${filteredScans} filtered scans (user's ads${adId ? `, adId: ${adId}` : ''})`);
                }
              }

              // ✅ Always add device to stats (even if 0 plays) so we can track online devices
              // This ensures devices with ads assigned but not yet played are still included
              currentDayDeviceStats.set(device.materialId, {
                materialId: device.materialId,
                totalAdPlays,
                totalAdPlayTime,
                totalQRScans,
                lastActivity: today,
                isOnline: device.isOnline || false
              });
            });
          }
        } catch (currentDayError) {
          console.error('Error getting current day device stats from DeviceTracking:', currentDayError);
          // Continue with historical data only if current day query fails
        }
      }

      // Get device status information for all devices (historical + current day)
      const allMaterialIds = Array.from(new Set([
        ...aggregationResult.map(d => d.materialId),
        ...Array.from(currentDayDeviceStats.keys())
      ]));
      const deviceStatusMap = await this.getDeviceStatusInfo(allMaterialIds);

      // Merge historical and current day data
      const deviceStatsMap = new Map();

      // Add historical data
      aggregationResult.forEach(device => {
        const deviceStatus = deviceStatusMap.get(device.materialId);
        deviceStatsMap.set(device.materialId, {
          deviceId: device.materialId,
          materialId: device.materialId,
          adsPlayed: device.totalAdPlays || 0,
          displayTime: device.totalAdPlayTime || 0,
          lastActivity: device.lastActivity,
          isOnline: deviceStatus ? deviceStatus.slots.some(slot => slot.isOnline) : false,
          deviceStatus: deviceStatus || null,
          qrScans: device.totalQRScans || 0
        });
      });

      // ✅ Add/merge current day data
      // If historical includes today (shouldIncludeTodayInHistorical), we need to be careful not to double-count
      // But since historical aggregation sums all days, we can't easily subtract today's portion
      // So we'll prioritize DeviceTracking data for today when it exists
      currentDayDeviceStats.forEach((currentDayStats, materialId) => {
        const existingStats = deviceStatsMap.get(materialId);
        const deviceStatus = deviceStatusMap.get(materialId);
        
        if (existingStats) {
          // ✅ Merge: add current day data to historical totals
          // Note: Historical aggregation now excludes today when includesToday is true, so no double-counting
          deviceStatsMap.set(materialId, {
            ...existingStats,
            adsPlayed: existingStats.adsPlayed + (currentDayStats.totalAdPlays || 0),
            displayTime: existingStats.displayTime + (currentDayStats.totalAdPlayTime || 0),
            qrScans: existingStats.qrScans + (currentDayStats.totalQRScans || 0),
            lastActivity: today, // Update to today since we have current day data
            isOnline: deviceStatus ? deviceStatus.slots.some(slot => slot.isOnline) : (currentDayStats.isOnline || false),
            deviceStatus: deviceStatus || existingStats.deviceStatus
          });
        } else {
          // New device: only has current day data
          deviceStatsMap.set(materialId, {
            deviceId: materialId,
            materialId: materialId,
            adsPlayed: currentDayStats.totalAdPlays || 0,
            displayTime: currentDayStats.totalAdPlayTime || 0,
            lastActivity: today,
            isOnline: deviceStatus ? deviceStatus.slots.some(slot => slot.isOnline) : (currentDayStats.isOnline || false),
            deviceStatus: deviceStatus || null,
            qrScans: currentDayStats.totalQRScans || 0
          });
        }
      });

      // Convert to array and sort by last activity
      const result = Array.from(deviceStatsMap.values()).sort((a, b) => {
        const aDate = a.lastActivity instanceof Date ? a.lastActivity : new Date(a.lastActivity);
        const bDate = b.lastActivity instanceof Date ? b.lastActivity : new Date(b.lastActivity);
        return bDate.getTime() - aDate.getTime();
      });

      console.log('📊 Final device stats result:', result.length, 'devices (historical:', aggregationResult.length, ', current day:', currentDayDeviceStats.size, ')');
      
      // ✅ Debug: Log QR scan counts per device to verify filtering
      result.forEach(device => {
        console.log(`📊 Device ${device.materialId} QR scans: ${device.qrScans} (filtered by user's ads${adId ? ` and adId: ${adId}` : ''})`);
      });
      
      return result;
    } catch (error) {
      console.error('Error getting device stats from history:', error);
      return [];
    }
  }
  
  // Get ad playback data for a specific user
  static async getUserAdPlaybackData(userId, startDate, endDate) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ userId: userId });
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No ads found for this user'
        };
      }

      // Get all materials for this user
      const materialIds = [];
      for (const ad of userAds) {
        if (ad.materials && ad.materials.length > 0) {
          ad.materials.forEach(material => {
            if (material.materialId && !materialIds.includes(material.materialId)) {
              materialIds.push(material.materialId);
            }
          });
        }
      }

      if (materialIds.length === 0) {
        return {
          success: false,
          message: 'No materials found for this user'
        };
      }

      // Get current day data from deviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });
      
      // Get historical data from deviceDataHistoryV2
      // TEMPORARY FIX: Get all devices since there's a mismatch between ad materialIds and DeviceDataHistoryV2 materialIds
      // TODO: Implement proper mapping between ad materialIds (ObjectIds) and DeviceDataHistoryV2 materialIds (strings)
      const historicalData = await DeviceDataHistoryV2.find({
        'dailyData.date': {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      // Combine and process ad playback data
      const allAdPlaybacks = [];
      const adPlaybacksByAd = {};
      let totalAdPlays = 0;
      let totalAdPlayTime = 0;
      
      // Process current day data
      currentData.forEach(device => {
        if (device.adPlaybacks && device.adPlaybacks.length > 0) {
          allAdPlaybacks.push(...device.adPlaybacks);
        }
        
        totalAdPlays += device.totalAdPlays || 0;
        totalAdPlayTime += device.totalAdPlayTime || 0;
        
        if (device.adPerformance && device.adPerformance.length > 0) {
          device.adPerformance.forEach(adPerf => {
            if (!adPlaybacksByAd[adPerf.adId]) {
              adPlaybacksByAd[adPerf.adId] = {
                adId: adPerf.adId,
                adTitle: adPerf.adTitle,
                playCount: 0,
                totalViewTime: 0,
                averageViewTime: 0,
                completionRate: 0,
                firstPlayed: adPerf.firstPlayed,
                lastPlayed: adPerf.lastPlayed,
              };
            }
            adPlaybacksByAd[adPerf.adId].playCount += adPerf.playCount || 0;
            adPlaybacksByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
            if (adPerf.lastPlayed > adPlaybacksByAd[adPerf.adId].lastPlayed) {
              adPlaybacksByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
            }
          });
        }
      });
      
      // Process historical data (now in dailyData array)
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            // Check if this daily data is within the date range
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= startDate && dailyDate <= endDate) {
              if (dailyData.adPlaybacks && dailyData.adPlaybacks.length > 0) {
                allAdPlaybacks.push(...dailyData.adPlaybacks);
              }
              
              totalAdPlays += dailyData.totalAdPlays || 0;
              totalAdPlayTime += dailyData.totalAdPlayTime || 0;
              
              if (dailyData.adPerformance && dailyData.adPerformance.length > 0) {
                dailyData.adPerformance.forEach(adPerf => {
                  if (!adPlaybacksByAd[adPerf.adId]) {
                    adPlaybacksByAd[adPerf.adId] = {
                      adId: adPerf.adId,
                      adTitle: adPerf.adTitle,
                      playCount: 0,
                      totalViewTime: 0,
                      averageViewTime: 0,
                      completionRate: 0,
                      firstPlayed: adPerf.firstPlayed,
                      lastPlayed: adPerf.lastPlayed,
                    };
                  }
                  adPlaybacksByAd[adPerf.adId].playCount += adPerf.playCount || 0;
                  adPlaybacksByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
                  if (adPerf.lastPlayed > adPlaybacksByAd[adPerf.adId].lastPlayed) {
                    adPlaybacksByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
                  }
                });
              }
            }
          });
        }
      });
      
      // Calculate averages for ad playbacks by ad
      Object.values(adPlaybacksByAd).forEach(ad => {
        ad.averageViewTime = ad.playCount > 0 ? ad.totalViewTime / ad.playCount : 0;
        ad.completionRate = ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.playCount * 30))) * 100 : 0; // Rough completion rate
      });
      
      return {
        success: true,
        userId,
        totalAdPlays,
        totalAdPlayTime,
        adPlaybacks: allAdPlaybacks,
        adPlaybacksByAd: Object.values(adPlaybacksByAd),
        materialIds,
        dateRange: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Error getting user ad playback data:', error);
      throw error;
    }
  }
  
  // Get QR scan data for a specific user
  static async getUserQRScanData(userId, startDate, endDate) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ userId: userId });
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No ads found for this user'
        };
      }

      // Get all materials for this user
      const materialIds = [];
      for (const ad of userAds) {
        if (ad.materials && ad.materials.length > 0) {
          ad.materials.forEach(material => {
            if (material.materialId && !materialIds.includes(material.materialId)) {
              materialIds.push(material.materialId);
            }
          });
        }
      }

      if (materialIds.length === 0) {
        return {
          success: false,
          message: 'No materials found for this user'
        };
      }

      // Get current day data from deviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });
      
      // Get historical data from deviceDataHistoryV2
      // TEMPORARY FIX: Get all devices since there's a mismatch between ad materialIds and DeviceDataHistoryV2 materialIds
      // TODO: Implement proper mapping between ad materialIds (ObjectIds) and DeviceDataHistoryV2 materialIds (strings)
      const historicalData = await DeviceDataHistoryV2.find({
        'dailyData.date': {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      // Combine and process QR scan data
      const allQRScans = [];
      const qrScansByAd = {};
      
      // Process current day data
      currentData.forEach(device => {
        if (device.qrScans && device.qrScans.length > 0) {
          allQRScans.push(...device.qrScans);
        }
        
        if (device.qrScansByAd && device.qrScansByAd.length > 0) {
          device.qrScansByAd.forEach(adScan => {
            if (!qrScansByAd[adScan.adId]) {
              qrScansByAd[adScan.adId] = {
                adId: adScan.adId,
                adTitle: adScan.adTitle,
                scanCount: 0,
                firstScanned: adScan.firstScanned,
                lastScanned: adScan.lastScanned
              };
            }
            qrScansByAd[adScan.adId].scanCount += adScan.scanCount;
            if (adScan.lastScanned > qrScansByAd[adScan.adId].lastScanned) {
              qrScansByAd[adScan.adId].lastScanned = adScan.lastScanned;
            }
          });
        }
      });
      
      // Process historical data (now in dailyData array)
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            // Check if this daily data is within the date range
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= startDate && dailyDate <= endDate) {
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                allQRScans.push(...dailyData.qrScans);
              }
              
              if (dailyData.qrScansByAd && dailyData.qrScansByAd.length > 0) {
                dailyData.qrScansByAd.forEach(adScan => {
                  if (!qrScansByAd[adScan.adId]) {
                    qrScansByAd[adScan.adId] = {
                      adId: adScan.adId,
                      adTitle: adScan.adTitle,
                      scanCount: 0,
                      firstScanned: adScan.firstScanned,
                      lastScanned: adScan.lastScanned
                    };
                  }
                  qrScansByAd[adScan.adId].scanCount += adScan.scanCount;
                  if (adScan.lastScanned > qrScansByAd[adScan.adId].lastScanned) {
                    qrScansByAd[adScan.adId].lastScanned = adScan.lastScanned;
                  }
                });
              }
            }
          });
        }
      });
      
      return {
        success: true,
        userId,
        totalQRScans: allQRScans.length,
        qrScans: allQRScans,
        qrScansByAd: Object.values(qrScansByAd),
        materialIds,
        dateRange: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Error getting user QR scan data:', error);
      throw error;
    }
  }
  
  // Fetch fresh data from DeviceDataHistoryV2 and update UserAnalytics
  // Optimized version of fetchAndUpdateUserAnalyticsFromHistory with better database queries
  static async fetchAndUpdateUserAnalyticsFromHistory(userId, startDate, endDate) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to find associated materials - optimized query
      // ✅ Exclude archived/deleted ads to ensure their data is not included in totals
      const userAds = await Ad.find({ 
        userId: userId,
        isArchived: false  // ✅ Exclude archived/deleted ads
      }).select('_id targetDevices createdAt').sort({ createdAt: 1 });
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No ads found for this user'
        };
      }
      
      // ✅ Get user's first ad creation date for accurate completion rate calculation
      const firstAd = userAds[0];
      const firstAdCreationDate = firstAd?.createdAt ? new Date(firstAd.createdAt) : null;
      
      // If startDate is not provided or is before first ad creation, use first ad creation date
      const effectiveStartDate = startDate && !isNaN(new Date(startDate).getTime()) 
        ? new Date(startDate)
        : (firstAdCreationDate || new Date('2020-01-01'));
      
      // If first ad creation date is available and earlier than startDate, use it
      const finalStartDate = firstAdCreationDate && firstAdCreationDate < effectiveStartDate
        ? firstAdCreationDate
        : effectiveStartDate;

      // Get all materials and adIds associated with user's ads - optimized bulk query
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      // 🔧 FIX: Get materials from BOTH current targetDevices AND historical data
      // This ensures we include data from devices that were previously assigned to the user's ads
      const Material = require('../models/Material');
      // Note: DeviceDataHistoryV2 already required at top of function
      
      // Step 1: Get currently assigned devices
      const allTargetDevices = userAds.flatMap(ad => ad.targetDevices || []);
      const materialIds = new Set(); // Use Set for deduplication
      
      if (allTargetDevices.length > 0) {
        const materials = await Material.find({ _id: { $in: allTargetDevices } }, 'materialId');
        materials.forEach(material => {
          if (material.materialId) {
            materialIds.add(material.materialId);
          }
        });
      }
      
      // Step 2: 🔧 CRITICAL FIX - Also find devices that have historical data for user's ads
      // This handles cases where ads were reassigned to different devices
      try {
        const historicalDevices = await DeviceDataHistoryV2.aggregate([
          {
            // Match documents that have adPlaybacks for any of the user's ads
            $match: {
              $or: [
                { 'dailyData.adPlaybacks.adId': { $in: userAdIds } },
                { 'dailyData.adPerformance.adId': { $in: userAdIds } },
                { 'dailyData.qrScans.adId': { $in: userAdIds } },
                { 'dailyData.qrScansByAd.adId': { $in: userAdIds } }
              ]
            }
          },
          {
            // Only return materialId
            $project: { materialId: 1 }
          }
        ], { maxTimeMS: 5000 });
        
        historicalDevices.forEach(device => {
          if (device.materialId) {
            materialIds.add(device.materialId);
          }
        });
        
        console.log('🔧 [FIX] Found historical devices for user ads:', {
          currentDevices: allTargetDevices.length,
          historicalDevices: historicalDevices.length,
          totalUniqueDevices: materialIds.size,
          userAdIds: userAdIds.slice(0, 5) // Sample for debugging
        });
      } catch (historyError) {
        console.warn('⚠️ Could not fetch historical devices (non-blocking):', historyError.message);
        // Continue with just current devices if historical query fails
      }
      
      const materialIdsArray = Array.from(materialIds);
      
      if (materialIdsArray.length === 0) {
        return {
          success: false,
          message: 'No materials found for this user'
        };
      }

      // Validate and set default date ranges
      const now = new Date();
      // Use finalStartDate (which includes first ad creation date if available) for accurate completion rate
      const defaultStartDate = finalStartDate;
      const defaultEndDate = endDate && !isNaN(new Date(endDate).getTime()) 
        ? new Date(endDate) 
        : now;
      
      console.log('📅 Date range for fetchAndUpdateUserAnalyticsFromHistory:', {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        firstAdCreationDate: firstAdCreationDate,
        daysInRange: Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24))
      });

      // Optimized query using aggregation pipeline for better performance
      console.log('🔍 Fetching historical data from DeviceDataHistoryV2 with optimized query...');
      console.log('📅 Date range:', { startDate: defaultStartDate, endDate: defaultEndDate });
      
      let historicalData;
      try {
        historicalData = await DeviceDataHistoryV2.aggregate([
          {
            $match: {
              'dailyData.date': {
                $gte: defaultStartDate,
                $lte: defaultEndDate
              }
            }
          },
          {
            $project: {
              materialId: 1,
              carGroupId: 1,
              deviceInfo: 1,
              dailyData: {
                $filter: {
                  input: '$dailyData',
                  cond: {
                    $and: [
                      { $gte: ['$$this.date', defaultStartDate] },
                      { $lte: ['$$this.date', defaultEndDate] }
                    ]
                  }
                }
              }
            }
          }
        ], {
          maxTimeMS: 15000, // 15-second timeout for sync queries
          allowDiskUse: true
        });
      } catch (error) {
        if (error.code === 50 || error.message.includes('exceeded time limit') || error.message.includes('timed out')) {
          console.error('⏱️ Sync query timeout - query too large');
          return {
            success: false,
            message: 'Sync timeout - date range too large'
          };
        }
        throw error;
      }

      console.log('📊 Found historical data records:', historicalData.length);
      
      if (historicalData.length === 0) {
        console.log('❌ No historical data found for the specified date range');
        return {
          success: false,
          message: 'No historical data found for the specified date range'
        };
      }

      // Process the historical data
      // ✅ NOTE: totalDevices should NOT be set here - it will be calculated from active deployments in syncUserAnalyticsFromHistory
      const processedData = {
        userId,
        totalDevices: 0, // ✅ Will be calculated from active deployments, not historical data length
        totalAdPlays: 0,
        totalAdPlayTime: 0,
        totalQRScans: 0,
        ads: {},
        materials: {}
      };

      // ✅ CRITICAL FIX: Also fetch current day data from DeviceTracking (Philippines "today")
      const DeviceTracking = require('../models/deviceTracking');
      const today = getPhilippinesMidnight();
      const tomorrow = getPhilippinesMidnight(new Date(today.getTime() + 24 * 60 * 60 * 1000));
      
      // 🔧 FIX: Use materialIdsArray which includes both current AND historical devices
      const currentDayData = await DeviceTracking.find({
        materialId: { $in: materialIdsArray },
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });
      
      console.log('📊 [fetchAndUpdateUserAnalyticsFromHistory] Current day data found:', currentDayData.length, 'devices');
      
      // Process each material's data - optimized processing
      const materialDataMap = new Map();
      const adDataMap = new Map();
      
      // ✅ Process current day data first
      currentDayData.forEach(device => {
        const materialId = device.materialId;
        
        // Initialize material data if not exists
        if (!materialDataMap.has(materialId)) {
          materialDataMap.set(materialId, {
            materialId,
            carGroupId: device.carGroupId,
            totalAdPlays: 0,
            totalAdPlayTime: 0,
            totalQRScans: 0,
            adPlaybacks: [],
            qrScans: [],
            locationHistory: [],
            dailyData: []
          });
        }
        
        const materialStats = materialDataMap.get(materialId);
        
        // ✅ Process current day QR scans - use qrScansByAd if available (more accurate), otherwise use array
        const hasQrScansByAd = device.qrScansByAd && device.qrScansByAd.length > 0;
        
        if (hasQrScansByAd) {
          // ✅ Use qrScansByAd (preferred method - aggregated count)
          device.qrScansByAd.forEach(adScan => {
            const normalizedAdId = adScan.adId ? adScan.adId.toString() : '';
            if (normalizedAdId && userAdIds.includes(normalizedAdId)) {
              // Validate scanCount against array if available
              let scanCountToUse = adScan.scanCount || 0;
              
              if (device.qrScans && device.qrScans.length > 0) {
                const actualArrayCount = device.qrScans.filter(scan => {
                  const scanAdId = scan.adId ? scan.adId.toString() : '';
                  const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                  return scanAdId === normalizedAdId && belongsToUser;
                }).length;
                
                // Use the maximum (repair if needed)
                if (actualArrayCount > scanCountToUse) {
                  console.log(`🔧 [fetchAndUpdateUserAnalyticsFromHistory] REPAIR Current Day: Ad "${adScan.adTitle}" (${normalizedAdId}) - scanCount was ${scanCountToUse}, but array has ${actualArrayCount}. Using array count.`);
                  scanCountToUse = actualArrayCount;
                }
              }
              
              materialStats.totalQRScans += scanCountToUse;
              
              // Add to ad totals
              if (!adDataMap.has(normalizedAdId)) {
                adDataMap.set(normalizedAdId, {
                  adId: normalizedAdId,
                  adTitle: adScan.adTitle || 'Unknown',
                  totalPlays: 0,
                  totalViewTime: 0,
                  totalQRScans: 0,
                  materials: new Set()
                });
              }
              const adData = adDataMap.get(normalizedAdId);
              adData.totalQRScans += scanCountToUse;
              adData.materials.add(materialId);
            }
          });
        } else if (device.qrScans && device.qrScans.length > 0) {
          // ✅ Fallback: Count from array if qrScansByAd is not available
          const userQRScans = device.qrScans.filter(scan => {
            const scanAdId = scan.adId ? scan.adId.toString() : '';
            const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
            return belongsToUser && scanAdId;
          });
          
          materialStats.totalQRScans += userQRScans.length;
          
          userQRScans.forEach(scan => {
            const adId = scan.adId ? scan.adId.toString() : '';
            if (!adDataMap.has(adId)) {
              adDataMap.set(adId, {
                adId,
                adTitle: scan.adTitle || 'Unknown',
                totalPlays: 0,
                totalViewTime: 0,
                totalQRScans: 0,
                materials: new Set()
              });
            }
            const adData = adDataMap.get(adId);
            adData.totalQRScans += 1;
            adData.materials.add(materialId);
          });
        }
        
        // Process current day ad playbacks
        if (device.adPlaybacks && device.adPlaybacks.length > 0) {
          const userAdPlaybacks = device.adPlaybacks.filter(playback => 
            userAdIds.includes(playback.adId)
          );
          
          materialStats.totalAdPlays += userAdPlaybacks.length;
          materialStats.totalAdPlayTime += userAdPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0);
          
          if (userAdPlaybacks.length > 0) {
            materialStats.adPlaybacks.push(...userAdPlaybacks);
            
            userAdPlaybacks.forEach(playback => {
              const adId = playback.adId;
              if (!adDataMap.has(adId)) {
                adDataMap.set(adId, {
                  adId,
                  adTitle: playback.adTitle || 'Unknown',
                  totalPlays: 0,
                  totalViewTime: 0,
                  totalQRScans: 0,
                  materials: new Set()
                });
              }
              const adData = adDataMap.get(adId);
              adData.totalPlays += 1;
              adData.totalViewTime += playback.viewTime || 0;
              adData.materials.add(materialId);
            });
          }
        }
      });
      
      // ✅ Now process historical data
      historicalData.forEach(materialData => {
        const materialId = materialData.materialId;
        
        // Initialize material data if not exists
        if (!materialDataMap.has(materialId)) {
          materialDataMap.set(materialId, {
            materialId,
            carGroupId: materialData.carGroupId,
            totalAdPlays: 0,
            totalAdPlayTime: 0,
            totalQRScans: 0,
            adPlaybacks: [],
            qrScans: [],
            locationHistory: [],
            dailyData: []
          });
        }
        
        const materialStats = materialDataMap.get(materialId);

        // Process daily data efficiently
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= defaultStartDate && dailyDate <= defaultEndDate) {
              // Filter ad playbacks to only include user's ads - optimized filtering
              const userAdPlaybacks = dailyData.adPlaybacks ? dailyData.adPlaybacks.filter(playback => 
                userAdIds.includes(playback.adId)
              ) : [];
              
              // ✅ Process QR scans - use qrScansByAd if available (more accurate), otherwise use array
              let userQRScansCount = 0;
              
              if (dailyData.qrScansByAd && dailyData.qrScansByAd.length > 0) {
                // ✅ Use qrScansByAd (preferred method - aggregated count)
                dailyData.qrScansByAd.forEach(adScan => {
                  const normalizedAdId = adScan.adId ? adScan.adId.toString() : '';
                  if (normalizedAdId && userAdIds.includes(normalizedAdId)) {
                    // Validate scanCount against array if available
                    let scanCountToUse = adScan.scanCount || 0;
                    
                    if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                      const actualArrayCount = dailyData.qrScans.filter(scan => {
                        const scanAdId = scan.adId ? scan.adId.toString() : '';
                        const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                        return scanAdId === normalizedAdId && belongsToUser;
                      }).length;
                      
                      // Use the maximum (repair if needed)
                      if (actualArrayCount > scanCountToUse) {
                        console.log(`🔧 [fetchAndUpdateUserAnalyticsFromHistory] REPAIR Historical: Ad "${adScan.adTitle}" (${normalizedAdId}) on ${dailyData.date} - scanCount was ${scanCountToUse}, but array has ${actualArrayCount}. Using array count.`);
                        scanCountToUse = actualArrayCount;
                      }
                    }
                    
                    userQRScansCount += scanCountToUse;
                    
                    // Add to ad totals
                    if (!adDataMap.has(normalizedAdId)) {
                      adDataMap.set(normalizedAdId, {
                        adId: normalizedAdId,
                        adTitle: adScan.adTitle || 'Unknown',
                        totalPlays: 0,
                        totalViewTime: 0,
                        totalQRScans: 0,
                        materials: new Set()
                      });
                    }
                    const adData = adDataMap.get(normalizedAdId);
                    adData.totalQRScans += scanCountToUse;
                    adData.materials.add(materialId);
                  }
                });
              } else if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                // ✅ Fallback: Count from array if qrScansByAd is not available
                const userQRScans = dailyData.qrScans.filter(scan => {
                  const scanAdId = scan.adId ? scan.adId.toString() : '';
                  const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                  return belongsToUser && scanAdId;
                });
                
                userQRScansCount = userQRScans.length;
                
                userQRScans.forEach(scan => {
                  const adId = scan.adId ? scan.adId.toString() : '';
                  if (!adDataMap.has(adId)) {
                    adDataMap.set(adId, {
                      adId,
                      adTitle: scan.adTitle || 'Unknown',
                      totalPlays: 0,
                      totalViewTime: 0,
                      totalQRScans: 0,
                      materials: new Set()
                    });
                  }
                  const adData = adDataMap.get(adId);
                  adData.totalQRScans += 1;
                  adData.materials.add(materialId);
                });
              }
              
              // Calculate totals efficiently
              const userAdPlays = userAdPlaybacks.length;
              const userAdPlayTime = userAdPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0);
              
              // Add to material totals
              materialStats.totalAdPlays += userAdPlays;
              materialStats.totalAdPlayTime += userAdPlayTime;
              materialStats.totalQRScans += userQRScansCount;
              
              // Collect ad playbacks efficiently
              if (userAdPlaybacks.length > 0) {
                materialStats.adPlaybacks.push(...userAdPlaybacks);
                
                // Group by ad efficiently using Map
                userAdPlaybacks.forEach(playback => {
                  const adId = playback.adId;
                  if (!adDataMap.has(adId)) {
                    adDataMap.set(adId, {
                      adId,
                      adTitle: playback.adTitle || 'Unknown',
                      totalPlays: 0,
                      totalViewTime: 0,
                      materials: new Set()
                    });
                  }
                  const adData = adDataMap.get(adId);
                  adData.totalPlays += 1;
                  adData.totalViewTime += playback.viewTime || 0;
                  adData.materials.add(materialId);
                });
              }
              
              // ✅ Collect QR scans from array if available (for detailed tracking)
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                const userQRScans = dailyData.qrScans.filter(scan => {
                  const scanAdId = scan.adId ? scan.adId.toString() : '';
                  const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                  return belongsToUser && scanAdId;
                });
                if (userQRScans.length > 0) {
                  materialStats.qrScans.push(...userQRScans);
                }
              }
              
              // Collect location history efficiently
              if (dailyData.locationHistory && dailyData.locationHistory.length > 0) {
                materialStats.locationHistory.push(...dailyData.locationHistory);
              }
              
              // Store daily data
              materialStats.dailyData.push(dailyData);
            }
          });
        }
      });

      // Convert Maps to objects for final processing
      // ✅ NOTE: totalDevices should NOT be set here - it will be calculated from active deployments in syncUserAnalyticsFromHistory
      const finalProcessedData = {
        userId,
        totalDevices: 0, // ✅ Will be calculated from active deployments, not historical data length
        totalAdPlays: 0,
        totalAdPlayTime: 0,
        totalQRScans: 0,
        ads: {},
        materials: {}
      };

      // Calculate totals from material data
      console.log('📊 [fetchAndUpdateUserAnalyticsFromHistory] Calculating totals from material data...');
      for (const [materialId, materialStats] of materialDataMap) {
        finalProcessedData.materials[materialId] = materialStats;
        finalProcessedData.totalAdPlays += materialStats.totalAdPlays;
        finalProcessedData.totalAdPlayTime += materialStats.totalAdPlayTime;
        finalProcessedData.totalQRScans += materialStats.totalQRScans;
        console.log(`📊 [fetchAndUpdateUserAnalyticsFromHistory] Material ${materialId}: QR scans = ${materialStats.totalQRScans}, Total so far = ${finalProcessedData.totalQRScans}`);
      }
      
      // ✅ Also calculate totals from ad data to ensure accuracy
      console.log('📊 [fetchAndUpdateUserAnalyticsFromHistory] Ad data totals:');
      for (const [adId, adData] of adDataMap) {
        console.log(`📊 [fetchAndUpdateUserAnalyticsFromHistory] Ad ${adId} (${adData.adTitle}):`, {
          totalPlays: adData.totalPlays || 0,
          totalViewTime: adData.totalViewTime || 0,
          totalQRScans: adData.totalQRScans || 0,
          materialsCount: adData.materials ? adData.materials.size : 0
        });
      }

      // Convert ad data Map to object
      for (const [adId, adData] of adDataMap) {
        finalProcessedData.ads[adId] = {
          ...adData,
          materials: Array.from(adData.materials)
        };
      }

      // Convert ads object to array
      const adsArray = Object.values(finalProcessedData.ads).map(ad => ({
        ...ad,
        averageViewTime: ad.totalPlays > 0 ? ad.totalViewTime / ad.totalPlays : 0,
        completionRate: 0 // Individual ad completion rate not used in summary - overall completion rate is calculated below
      }));

      // Calculate overall completion rate based on 8-hour daily requirement
      // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
      // This is for ALL ads, ALL devices, ALL days aggregated together
      const totalAdPlayTimeInHours = finalProcessedData.totalAdPlayTime / 3600; // Convert seconds to hours
      const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
      const expectedHours = numberOfDays * 8; // 8 hours per day requirement
      const averageAdCompletionRate = expectedHours > 0 ? Math.min(100, (totalAdPlayTimeInHours / expectedHours) * 100) : 0;
      
      // qrScanConversionRate removed - no longer needed

      console.log('📊 Processed data summary:', {
        totalDevices: finalProcessedData.totalDevices,
        totalAdPlays: finalProcessedData.totalAdPlays,
        totalAdPlayTime: finalProcessedData.totalAdPlayTime,
        totalQRScans: finalProcessedData.totalQRScans,
        averageAdCompletionRate,
        adsCount: adsArray.length
      });

      return {
        success: true,
        userId,
        dateRange: { startDate: defaultStartDate, endDate: defaultEndDate },
        totalDevices: finalProcessedData.totalDevices,
        totalAdPlays: finalProcessedData.totalAdPlays,
        totalAdPlayTime: finalProcessedData.totalAdPlayTime,
        totalQRScans: finalProcessedData.totalQRScans,
        averageAdCompletionRate,
        ads: adsArray,
        materials: Object.values(finalProcessedData.materials),
        lastUpdated: new Date(),
        dataSource: 'DeviceDataHistoryV2'
      };

    } catch (error) {
      console.error('Error fetching user analytics from history:', error);
      throw error;
    }
  }
  
  // Sync UserAnalytics with fresh data from DeviceDataHistoryV2
  static async syncUserAnalyticsFromHistory(userId, startDate, endDate, adId = null) {
    try {
      // Validate and set default date ranges
      const now = new Date();
      
      // ✅ ENHANCEMENT: For dailyStats, we want to store ALL historical data
      // Check if we need to fetch all historical data for dailyStats
      let userAnalytics = await UserAnalytics.findOne({ userId });
      const hasExistingDailyStats = userAnalytics && userAnalytics.dailyStats && userAnalytics.dailyStats.length > 0;
      
      // ✅ STRATEGY: 
      // 1. If dailyStats is empty, fetch ALL historical data (from first ad to now)
      // 2. If dailyStats exists but no startDate provided, fetch ALL historical data to ensure completeness
      // 3. If startDate is explicitly provided, use that range (for specific queries)
      let defaultStartDate, defaultEndDate;
      
      if (!hasExistingDailyStats || !startDate) {
        // Fetch all historical data - get user's first ad creation date
        // This ensures dailyStats contains ALL daily data from history
        try {
          const Ad = require('../models/Ad');
          const firstAd = await Ad.findOne({ userId: userId })
            .sort({ createdAt: 1 })
            .select('createdAt')
            .lean();
          
          if (firstAd && firstAd.createdAt) {
            defaultStartDate = new Date(firstAd.createdAt);
            defaultStartDate.setUTCHours(0, 0, 0, 0); // Start of day
            console.log(`📅 [SYNC] Fetching ALL historical data for dailyStats from first ad date: ${defaultStartDate.toISOString()}`);
          } else {
            // No ads found - use 2 years ago as default
            defaultStartDate = new Date(now);
            defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 2);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            console.log(`📅 [SYNC] No ads found, using 2-year default: ${defaultStartDate.toISOString()}`);
          }
        } catch (error) {
          console.warn('⚠️ Error fetching first ad date, using 2-year default:', error.message);
          defaultStartDate = new Date(now);
          defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 2);
          defaultStartDate.setUTCHours(0, 0, 0, 0);
        }
        defaultEndDate = now;
      } else {
        // Use provided date range (for specific queries, but still merge into dailyStats)
        defaultStartDate = startDate && !isNaN(new Date(startDate).getTime()) 
          ? new Date(startDate) 
          : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
        defaultEndDate = endDate && !isNaN(new Date(endDate).getTime()) 
          ? new Date(endDate) 
          : now;
        console.log(`📅 [SYNC] Using provided date range: ${defaultStartDate.toISOString()} to ${defaultEndDate.toISOString()}`);
      }

      // Fetch fresh data from history (pass adId for filtering)
      const freshData = await this.fetchAndUpdateUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
      
      console.log('🔍 Fresh Data from History (REAL-TIME DATA):', {
        success: freshData.success,
        adsCount: freshData.ads?.length || 0,
        totalAdPlays: freshData.totalAdPlays,
        totalAdPlayTime: freshData.totalAdPlayTime,
        totalQRScans: freshData.totalQRScans,
        totalDevices: freshData.totalDevices,
        dateRange: freshData.dateRange,
        dataKeys: Object.keys(freshData || {})
      });
      
      if (!freshData.success) {
        return freshData;
      }

      // Fetch user to get userName
      const User = require('../models/User');
      const user = await User.findById(userId).select('firstName lastName').lean();
      const userName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
      
      // Update or create UserAnalytics document (reuse the one we fetched earlier)
      if (!userAnalytics) {
        // Create new user analytics
        userAnalytics = new UserAnalytics({
          userId,
          userName: userName,
          ads: [],
          totalAds: 0,
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
          adPerformance: [],
          errorLogs: [],
          isActive: true
        });
      } else {
        // Update userName if it's missing or changed
        if (!userAnalytics.userName || userAnalytics.userName !== userName) {
          userAnalytics.userName = userName;
        }
      }

      // Update with fresh data - but DON'T overwrite cumulative totals
      // The useranalytics database should maintain cumulative totals, not filtered totals
      // userAnalytics.totalDevices = freshData.totalDevices;
      // userAnalytics.totalAdPlays = freshData.totalAdPlays; // Ensure totalAdPlays is set
      // userAnalytics.totalAdPlayTime = freshData.totalAdPlayTime;
      // userAnalytics.totalQRScans = freshData.totalQRScans;
      // userAnalytics.averageAdCompletionRate = freshData.averageAdCompletionRate;
      // userAnalytics.qrScanConversionRate = freshData.qrScanConversionRate;
      
      // Get ALL user's active paid ads (including SCHEDULED) for dropdown display
      const Ad = require('../models/Ad');
      const allUserAds = await Ad.find({
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title');
      
      console.log('📊 All user ads (for dropdown):', allUserAds.length);
      
      // Update the ads array with fresh ad performance data
      if (allUserAds.length > 0) {
        // Calculate QR scans for each ad
        const qrScanData = await this.getTotalQRScans(userId, defaultStartDate, defaultEndDate);
        
        console.log('🔍 QR Scan Data:', {
          success: qrScanData.success,
          totalScans: qrScanData.totalScans,
          adsCount: qrScanData.ads?.length,
          ads: qrScanData.ads
        });
        
        // ✅ Aggregate QR scans from dailyStats (per-ad daily stats) for more accurate totals
        // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
        // This ensures we get QR scans even if getTotalQRScans has date range issues
        const qrScansFromDailyStats = {};
        if (userAnalytics.dailyStats && userAnalytics.dailyStats.length > 0) {
          userAnalytics.dailyStats.forEach(dateEntry => {
            if (dateEntry.ads && Array.isArray(dateEntry.ads)) {
              dateEntry.ads.forEach(adEntry => {
                if (adEntry.adId && adEntry.totals) {
                  const adIdStr = adEntry.adId.toString ? adEntry.adId.toString() : String(adEntry.adId);
                  if (!qrScansFromDailyStats[adIdStr]) {
                    qrScansFromDailyStats[adIdStr] = 0;
                  }
                  qrScansFromDailyStats[adIdStr] += adEntry.totals.qrScans || 0;
                }
              });
            }
          });
        }
        
        // ✅ Get active deployments to populate materials array
        const AdsDeployment = require('../models/adsDeployment');
        const Material = require('../models/Material');
        
        // ✅ Always build adToActiveDevicesMap, even if allUserAds is empty (for else block)
        const adToActiveDevicesMap = new Map();
        const allActiveMaterialIds = new Set();
        let activeMaterials = [];
        
        if (allUserAds.length > 0) {
          const userAdIds = allUserAds.map(ad => ad._id);
          console.log(`🔍 [SYNC] Querying active deployments for ${allUserAds.length} ads:`, userAdIds.map(id => id.toString()));
          
          const activeDeployments = await AdsDeployment.find({
            'lcdSlots.adId': { $in: userAdIds },
            'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
          }).select('materialId lcdSlots');
          
          console.log(`🔍 [SYNC] Found ${activeDeployments.length} active deployments`);
          
          // ✅ Build a map of adId -> Map of materialId -> slotNumber for each ad
          const userAdIdSet = new Set(allUserAds.map(ad => ad._id.toString()));
          
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
                  console.log(`✅ [SYNC] Added device ${deployment.materialId} to ad ${adIdStr} (slot ${slot.slotNumber || 1})`);
                } else {
                  console.log(`⚠️ [SYNC] Skipping device ${deployment.materialId} - ad ${adIdStr} not in user's ads`);
                }
              }
            });
          });
          
          console.log(`🔍 [SYNC] Built adToActiveDevicesMap:`, Array.from(adToActiveDevicesMap.entries()).map(([adId, devices]) => 
            `${adId}: ${devices.size} devices`
          ));
          
          // ✅ Get Material documents for actively deployed devices
          if (allActiveMaterialIds.size > 0) {
            activeMaterials = await Material.find({ 
              materialId: { $in: Array.from(allActiveMaterialIds) } 
            });
            console.log(`🔍 [SYNC] Found ${activeMaterials.length} Material documents for ${allActiveMaterialIds.size} unique materialIds`);
          } else {
            console.log(`⚠️ [SYNC] No active material IDs found - materials array will be empty`);
          }
        }
        
        // Include ALL active paid ads, even those with no data
        userAnalytics.ads = allUserAds.map(ad => {
          const adIdStr = ad._id.toString();
          
          // Find performance data for this ad (if it exists)
          const adPerformance = freshData.ads?.find(a => a.adId === adIdStr);
          
          // ✅ DEBUG: Log adPerformance data
          if (adPerformance) {
            console.log(`📊 [SYNC] Ad ${adIdStr} performance data:`, {
              adId: adPerformance.adId,
              adTitle: adPerformance.adTitle,
              totalPlays: adPerformance.totalPlays || 0,
              totalViewTime: adPerformance.totalViewTime || 0,
              totalQRScans: adPerformance.totalQRScans || 0
            });
          } else {
            console.log(`⚠️ [SYNC] No performance data found for ad ${adIdStr} in freshData.ads`);
          }
          
          // Find QR scan data for this ad from getTotalQRScans
          const adQRScans = qrScanData.success && qrScanData.ads ? 
            qrScanData.ads.find(qr => {
              // Handle both string and ObjectId formats
              const qrAdId = qr.adId ? (qr.adId.toString ? qr.adId.toString() : String(qr.adId)) : '';
              return qrAdId === adIdStr;
            }) : null;
          
          // ✅ FIX: Use Math.max to ensure we get the highest QR scan count
          // This prevents undercounting when API returns partial data but dailyStats has complete data
          const qrFromAPI = adQRScans?.totalScans || 0;
          const qrFromDailyStats = qrScansFromDailyStats[adIdStr] || 0;
          const totalQRScans = Math.max(qrFromAPI, qrFromDailyStats);
          
          if (qrFromAPI !== qrFromDailyStats && (qrFromAPI > 0 || qrFromDailyStats > 0)) {
            console.log(`⚠️ [SYNC] QR scan count mismatch for ad ${adIdStr}: API=${qrFromAPI}, dailyStats=${qrFromDailyStats}, using max=${totalQRScans}`);
          }
          
          // ✅ Get actively deployed devices for this ad from AdsDeployment
          const activeDeviceMap = adToActiveDevicesMap.get(adIdStr) || new Map();
          const activeDeviceEntries = Array.from(activeDeviceMap.entries());
          
          console.log(`🔍 [SYNC] Ad ${adIdStr} (${ad.title}): ${activeDeviceEntries.length} active devices from deployments`);
          
          // Build materials array for this ad
          const adMaterials = [];
          const adMaterialPerformance = [];
          
          activeDeviceEntries.forEach(([materialIdStr, slotNumber]) => {
            const material = activeMaterials.find(m => m.materialId === materialIdStr);
            if (material) {
              console.log(`✅ [SYNC] Adding material ${materialIdStr} to ad ${adIdStr}`);
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
                totalAdPlayTime: 0,
                totalAdImpressions: 0,
                averageAdCompletionRate: 0,
                currentAd: null,
                qrScans: [],
                totalQRScans: 0,
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
              
              adMaterialPerformance.push({
                materialId: material.materialId,
                slotNumber: slotNumber,
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
          
          // ✅ Preserve existing material data if available (merge with new data)
          const existingAd = userAnalytics.ads?.find(a => a.adId?.toString() === adIdStr);
          if (existingAd && existingAd.materials && existingAd.materials.length > 0) {
            // Merge existing materials with new ones (preserve performance data)
            const existingMaterialsMap = new Map();
            existingAd.materials.forEach(mat => {
              if (mat.materialId) {
                existingMaterialsMap.set(mat.materialId, mat);
              }
            });
            
            // Update with new materials, preserving existing performance data
            adMaterials.forEach(newMat => {
              const existingMat = existingMaterialsMap.get(newMat.materialId);
              if (existingMat) {
                // Preserve existing performance data
                newMat.totalAdPlayTime = existingMat.totalAdPlayTime || 0;
                newMat.totalAdImpressions = existingMat.totalAdImpressions || 0;
                newMat.averageAdCompletionRate = existingMat.averageAdCompletionRate || 0;
                newMat.totalQRScans = existingMat.totalQRScans || 0;
                newMat.createdAt = existingMat.createdAt || new Date();
              }
            });
          }
          
          console.log(`🔍 [SYNC] Ad ${adIdStr} (${ad.title}) data:`, {
            hasPerformance: !!adPerformance,
            hasQRScansFromAPI: !!adQRScans,
            qrScansFromAPI: adQRScans?.totalScans || 0,
            qrScansFromDailyStats: qrScansFromDailyStats[adIdStr] || 0,
            finalTotalQRScans: totalQRScans,
            materialsCount: adMaterials.length,
            activeDeviceEntriesCount: activeDeviceEntries.length,
            activeMaterialsCount: activeMaterials.length
          });
          
          // ✅ If adMaterials is empty but totalDevices > 0, try to preserve existing materials
          // This handles the case where active deployments aren't found but devices exist
          let finalMaterials = adMaterials;
          let finalMaterialPerformance = adMaterialPerformance;
          
          if (adMaterials.length === 0 && activeDeviceEntries.length === 0) {
            // No active deployments found - try to preserve existing materials if they exist
            const existingAd = userAnalytics.ads?.find(a => a.adId?.toString() === adIdStr);
            if (existingAd && existingAd.materials && existingAd.materials.length > 0) {
              console.log(`⚠️ [SYNC] No active deployments found for ad ${adIdStr}, preserving existing ${existingAd.materials.length} materials`);
              finalMaterials = existingAd.materials;
              finalMaterialPerformance = existingAd.materialPerformance || [];
            } else {
              console.log(`⚠️ [SYNC] No active deployments found for ad ${adIdStr} and no existing materials to preserve`);
            }
          }
          
          const newAd = {
            adId: adIdStr,
            adTitle: ad.title,
            totalDevices: finalMaterials.length > 0 ? finalMaterials.length : (adMaterials.length || 0),
            totalAdPlayTime: adPerformance?.totalViewTime || 0,
            totalAdPlays: adPerformance?.totalPlays || 0, // ✅ Add actual play count
            totalQRScans: totalQRScans,
            averageAdCompletionRate: adPerformance?.completionRate || 0,
            materials: finalMaterials, // ✅ Populate materials array from active deployments (or preserve existing)
            materialPerformance: finalMaterialPerformance,
            // qrScanConversionRate removed
            lastUpdated: new Date().toISOString()
          };
          
          // ✅ DEBUG: Log final ad data being saved
          console.log(`📊 [SYNC] Final ad ${adIdStr} data:`, {
            adTitle: newAd.adTitle,
            totalDevices: newAd.totalDevices,
            totalAdPlayTime: newAd.totalAdPlayTime,
            totalAdPlays: newAd.totalAdPlays, // ✅ Log play count
            totalQRScans: newAd.totalQRScans,
            materialsCount: newAd.materials.length
          });
          
          // ✅ Explicitly remove totalMaterials if it exists (shouldn't, but be safe)
          if (newAd.totalMaterials !== undefined) {
            delete newAd.totalMaterials;
          }
          
          console.log(`✅ [SYNC] Final ad ${adIdStr}: ${finalMaterials.length} materials, totalDevices=${newAd.totalDevices}`);
          
          return newAd;
        });
      } else {
        // ✅ No active ads - preserve existing ads array but filter materials to only active deployments
        // Don't clear ads array - just update materials arrays
        if (userAnalytics.ads && Array.isArray(userAnalytics.ads) && userAnalytics.ads.length > 0) {
          // Get active deployments for existing ads
          const existingAdIds = userAnalytics.ads.map(ad => {
            const adId = ad.adId?.toString ? ad.adId.toString() : String(ad.adId || '');
            return adId;
          }).filter(id => id);
          
          if (existingAdIds.length > 0) {
            const Ad = require('../models/Ad');
            const existingAds = await Ad.find({
              _id: { $in: existingAdIds.map(id => {
                try {
                  return new require('mongoose').Types.ObjectId(id);
                } catch {
                  return null;
                }
              }).filter(id => id) }
            }).select('_id userId paymentStatus adStatus status');
            
            // Filter to only user's ads that are active and paid
            const validExistingAds = existingAds.filter(ad => 
              ad.userId.toString() === userId.toString() &&
              ad.paymentStatus === 'PAID' &&
              ad.adStatus === 'ACTIVE' &&
              ['RUNNING', 'APPROVED', 'SCHEDULED'].includes(ad.status)
            );
            
            if (validExistingAds.length > 0) {
              const activeDeploymentsForExisting = await AdsDeployment.find({
                'lcdSlots.adId': { $in: validExistingAds.map(ad => ad._id) },
                'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
              }).select('materialId lcdSlots');
              
              const existingAdIdSet = new Set(validExistingAds.map(ad => ad._id.toString()));
              activeDeploymentsForExisting.forEach(deployment => {
                deployment.lcdSlots.forEach(slot => {
                  if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
                    const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
                    if (existingAdIdSet.has(adIdStr)) {
                      if (!adToActiveDevicesMap.has(adIdStr)) {
                        adToActiveDevicesMap.set(adIdStr, new Map());
                      }
                      adToActiveDevicesMap.get(adIdStr).set(deployment.materialId, slot.slotNumber || 1);
                      allActiveMaterialIds.add(deployment.materialId);
                    }
                  }
                });
              });
              
              if (allActiveMaterialIds.size > 0) {
                activeMaterials = await Material.find({ 
                  materialId: { $in: Array.from(allActiveMaterialIds) } 
                });
              }
            }
          }
          
          // Update existing ads with materials from active deployments
          userAnalytics.ads = userAnalytics.ads.map(existingAd => {
            const adIdStr = existingAd.adId?.toString ? existingAd.adId.toString() : String(existingAd.adId || '');
            const activeDeviceMap = adToActiveDevicesMap.get(adIdStr) || new Map();
            const activeDeviceEntries = Array.from(activeDeviceMap.entries());
            
            // Build materials array only from active deployments
            const adMaterials = [];
            const adMaterialPerformance = [];
            
            // Preserve existing materials data
            const existingMaterialsMap = new Map();
            if (existingAd.materials && Array.isArray(existingAd.materials)) {
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
            
            return {
              ...existingAd,
              totalDevices: adMaterials.length,
              materials: adMaterials, // ✅ Only include actively deployed devices
              materialPerformance: adMaterialPerformance
            };
          });
        } else {
          // No existing ads and no active ads - clear array
          userAnalytics.ads = [];
        }
      }
      
      // ✅ ENHANCED SYNC: Populate dailyStats and materialBreakdown for fast queries
      // This allows getUserAnalytics to read directly from UserAnalytics without querying DeviceDataHistoryV2
      // ✅ RESTRUCTURED: Grouped by date (like DeviceDataHistoryV2), with nested ads and materials
      
      // 1. Populate dailyStats from getPerAdDailyStatsFromHistory (per-ad data)
      try {
        console.log('📊 [SYNC] Populating dailyStats in UserAnalytics (grouped by date)...');
        const perAdDailyStats = await this.getPerAdDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate);
        
        if (perAdDailyStats && perAdDailyStats.length > 0) {
          const mongoose = require('mongoose');
          
          // ✅ NEW STRUCTURE: Group by date, then by adId, then by materialId
          // Structure: Map<date, Map<adId, Map<materialId, stats>>>
          const dailyStatsByDate = new Map();
          
          // Process each per-ad, per-material entry
          perAdDailyStats.forEach(stat => {
            const dateKey = stat.date;
            if (!dateKey) return;
            
            // Convert adId to ObjectId
            let adIdValue = null;
            if (stat.adId) {
              try {
                adIdValue = typeof stat.adId === 'string' 
                  ? new mongoose.Types.ObjectId(stat.adId)
                  : (stat.adId instanceof mongoose.Types.ObjectId ? stat.adId : new mongoose.Types.ObjectId(stat.adId));
              } catch (e) {
                console.warn(`⚠️ [SYNC] Invalid adId format: ${stat.adId}, skipping`);
                return;
              }
            }
            
            const materialId = stat.materialId || null;
            if (!materialId) {
              console.warn(`⚠️ [SYNC] Missing materialId for ad ${stat.adId} on ${dateKey}, skipping`);
              return;
            }
            
            // Initialize date entry if needed
            if (!dailyStatsByDate.has(dateKey)) {
              dailyStatsByDate.set(dateKey, {
                date: dateKey,
                ads: new Map(), // Map<adId, { materials: Map<materialId, stats>, totals: {...} }>
                totals: {
                  impressions: 0,
                  adsPlayed: 0,
                  displayTime: 0,
                  qrScans: 0,
                  completionRates: [],
                  completionRate: 0
                }
              });
            }
            
            const dateEntry = dailyStatsByDate.get(dateKey);
            
            // Initialize ad entry if needed
            const adIdStr = adIdValue.toString();
            if (!dateEntry.ads.has(adIdStr)) {
              dateEntry.ads.set(adIdStr, {
                adId: adIdValue,
                materials: new Map(), // Map<materialId, stats>
                totals: {
                  impressions: 0,
                  adsPlayed: 0,
                  displayTime: 0,
                  qrScans: 0,
                  completionRates: [],
                  completionRate: 0
                }
              });
            }
            
            const adEntry = dateEntry.ads.get(adIdStr);
            
            // Store material stats
            adEntry.materials.set(materialId, {
              materialId: materialId,
              impressions: stat.impressions || 0,
              adsPlayed: stat.adsPlayed || 0,
              displayTime: stat.displayTime || 0,
              qrScans: stat.qrScans || 0,
              completionRate: stat.completionRate || 0
            });
            
            // Update ad totals (sum across materials)
            adEntry.totals.impressions += stat.impressions || 0;
            adEntry.totals.adsPlayed += stat.adsPlayed || 0;
            adEntry.totals.displayTime += stat.displayTime || 0;
            adEntry.totals.qrScans += stat.qrScans || 0;
            if (stat.completionRate !== undefined && stat.completionRate > 0) {
              adEntry.totals.completionRates.push(stat.completionRate);
            }
            
            // Update date totals (sum across ads)
            dateEntry.totals.impressions += stat.impressions || 0;
            dateEntry.totals.adsPlayed += stat.adsPlayed || 0;
            dateEntry.totals.displayTime += stat.displayTime || 0;
            dateEntry.totals.qrScans += stat.qrScans || 0;
            if (stat.completionRate !== undefined && stat.completionRate > 0) {
              dateEntry.totals.completionRates.push(stat.completionRate);
            }
          });
          
          // Calculate average completion rates
          dailyStatsByDate.forEach(dateEntry => {
            // Calculate ad-level completion rates
            dateEntry.ads.forEach(adEntry => {
              if (adEntry.totals.completionRates.length > 0) {
                adEntry.totals.completionRate = adEntry.totals.completionRates.reduce((sum, rate) => sum + rate, 0) / adEntry.totals.completionRates.length;
              }
              // Clean up completionRates array (not needed in final structure)
              delete adEntry.totals.completionRates;
            });
            
            // Calculate date-level completion rate
            if (dateEntry.totals.completionRates.length > 0) {
              dateEntry.totals.completionRate = dateEntry.totals.completionRates.reduce((sum, rate) => sum + rate, 0) / dateEntry.totals.completionRates.length;
            }
            delete dateEntry.totals.completionRates;
          });
          
          // Convert Maps to arrays for MongoDB storage
          const newDailyStats = Array.from(dailyStatsByDate.values()).map(dateEntry => {
            const adsArray = Array.from(dateEntry.ads.values()).map(adEntry => {
              const materialsArray = Array.from(adEntry.materials.values());
              return {
                adId: adEntry.adId,
                materials: materialsArray,
                totals: adEntry.totals
              };
            });
            
            return {
              date: dateEntry.date,
              ads: adsArray,
              totals: dateEntry.totals
            };
          });
          
          // ✅ ENHANCEMENT: Merge with existing dailyStats (update existing dates, add new ones)
          // This ensures we preserve all historical data and automatically create new daily entries
          const existingStatsByDate = new Map();
          (userAnalytics.dailyStats || []).forEach(stat => {
            if (stat.date) {
              existingStatsByDate.set(stat.date, stat);
            }
          });
          
          // Update or add date entries
          newDailyStats.forEach(newDateEntry => {
            if (existingStatsByDate.has(newDateEntry.date)) {
              // ✅ ENHANCEMENT: Merge existing date entry instead of replacing
              // This preserves data from previous syncs and merges new data
              const existing = existingStatsByDate.get(newDateEntry.date);
              
              // Merge ads - update existing ads or add new ones
              const existingAdsByAdId = new Map();
              (existing.ads || []).forEach(ad => {
                const adIdStr = ad.adId?.toString ? ad.adId.toString() : String(ad.adId);
                existingAdsByAdId.set(adIdStr, ad);
              });
              
              // Process new ads
              (newDateEntry.ads || []).forEach(newAd => {
                const adIdStr = newAd.adId?.toString ? newAd.adId.toString() : String(newAd.adId);
                
                if (existingAdsByAdId.has(adIdStr)) {
                  // Merge existing ad - merge materials
                  const existingAd = existingAdsByAdId.get(adIdStr);
                  const existingMaterialsByMaterialId = new Map();
                  (existingAd.materials || []).forEach(mat => {
                    existingMaterialsByMaterialId.set(mat.materialId, mat);
                  });
                  
                  // Merge materials - update existing or add new
                  (newAd.materials || []).forEach(newMat => {
                    existingMaterialsByMaterialId.set(newMat.materialId, newMat);
                  });
                  
                  // Update ad totals (sum of all materials)
                  existingAd.materials = Array.from(existingMaterialsByMaterialId.values());
                  existingAd.totals = {
                    impressions: existingAd.materials.reduce((sum, m) => sum + (m.impressions || 0), 0),
                    adsPlayed: existingAd.materials.reduce((sum, m) => sum + (m.adsPlayed || 0), 0),
                    displayTime: existingAd.materials.reduce((sum, m) => sum + (m.displayTime || 0), 0),
                    qrScans: existingAd.materials.reduce((sum, m) => sum + (m.qrScans || 0), 0),
                    completionRate: existingAd.materials.length > 0 
                      ? existingAd.materials.reduce((sum, m) => sum + (m.completionRate || 0), 0) / existingAd.materials.length
                      : 0
                  };
                } else {
                  // Add new ad
                  existingAdsByAdId.set(adIdStr, newAd);
                }
              });
              
              // Update existing date entry with merged ads
              existing.ads = Array.from(existingAdsByAdId.values());
              
              // Recalculate date totals (sum across all ads)
              existing.totals = {
                impressions: existing.ads.reduce((sum, ad) => sum + (ad.totals?.impressions || 0), 0),
                adsPlayed: existing.ads.reduce((sum, ad) => sum + (ad.totals?.adsPlayed || 0), 0),
                displayTime: existing.ads.reduce((sum, ad) => sum + (ad.totals?.displayTime || 0), 0),
                qrScans: existing.ads.reduce((sum, ad) => sum + (ad.totals?.qrScans || 0), 0),
                completionRate: existing.ads.length > 0
                  ? existing.ads.reduce((sum, ad) => sum + (ad.totals?.completionRate || 0), 0) / existing.ads.length
                  : 0
              };
            } else {
              // ✅ AUTOMATIC: Add new date entry (automatically creates new day in array)
              userAnalytics.dailyStats.push(newDateEntry);
              console.log(`📅 [SYNC] Auto-created new daily entry for date: ${newDateEntry.date}`);
            }
          });
          
          // Remove dates that no longer have data (optional cleanup)
          // For now, we keep all dates
          
          // Sort by date
          userAnalytics.dailyStats.sort((a, b) => a.date.localeCompare(b.date));
          
          // Calculate totals from dailyStats
          const totalPlaysFromDailyStats = userAnalytics.dailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.adsPlayed || 0), 0);
          const totalTimeFromDailyStats = userAnalytics.dailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.displayTime || 0), 0);
          const totalQRFromDailyStats = userAnalytics.dailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.qrScans || 0), 0);
          
          console.log(`✅ [SYNC] Updated dailyStats: ${userAnalytics.dailyStats.length} date entries`);
          console.log(`📊 [SYNC] Totals from dailyStats: plays=${totalPlaysFromDailyStats}, time=${totalTimeFromDailyStats}, qr=${totalQRFromDailyStats}`);
        } else {
          // No data, but initialize empty array if needed
          if (!userAnalytics.dailyStats) {
            userAnalytics.dailyStats = [];
          }
        }
      } catch (dailyStatsError) {
        console.warn('⚠️ [SYNC] Failed to populate dailyStats:', dailyStatsError.message);
        console.error('⚠️ [SYNC] dailyStats error stack:', dailyStatsError.stack);
        // Don't fail the entire sync if dailyStats fails
      }
      
      // 2. Update cumulative totals from freshData OR dailyStats
      // ✅ FIX: Always update totals if we have data (either from freshData or dailyStats)
      if (!adId) {
        // Calculate totals from dailyStats if freshData doesn't have them
        // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
        const totalPlaysFromDailyStats = (userAnalytics.dailyStats || []).reduce((sum, dateEntry) => 
          sum + (dateEntry.totals?.adsPlayed || 0), 0);
        const totalTimeFromDailyStats = (userAnalytics.dailyStats || []).reduce((sum, dateEntry) => 
          sum + (dateEntry.totals?.displayTime || 0), 0);
        const totalQRFromDailyStats = (userAnalytics.dailyStats || []).reduce((sum, dateEntry) => 
          sum + (dateEntry.totals?.qrScans || 0), 0);
        
        // Use freshData if available, otherwise use dailyStats totals
        const totalAdPlays = freshData.totalAdPlays > 0 ? freshData.totalAdPlays : totalPlaysFromDailyStats;
        const totalAdPlayTime = freshData.totalAdPlayTime > 0 ? freshData.totalAdPlayTime : totalTimeFromDailyStats;
        const totalQRScans = freshData.totalQRScans > 0 ? freshData.totalQRScans : totalQRFromDailyStats;
        
        // ✅ Always update totals (even if 0) - don't require data to exist
        userAnalytics.totalAdPlays = Math.max(userAnalytics.totalAdPlays || 0, totalAdPlays);
        userAnalytics.totalAdPlayTime = Math.max(userAnalytics.totalAdPlayTime || 0, totalAdPlayTime);
        userAnalytics.totalQRScans = Math.max(userAnalytics.totalQRScans || 0, totalQRScans);
        
        // ✅ ALWAYS calculate totalDevices from active deployments (source of truth)
        // This must run regardless of whether there's data, because totalDevices should reflect current deployments
        try {
          const AdsDeployment = require('../models/adsDeployment');
          const Ad = require('../models/Ad');
          
          // Get user's active ads
          const userAds = await Ad.find({
            userId: userId,
            paymentStatus: 'PAID',
            adStatus: 'ACTIVE',
            status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
          }).select('_id');
          
          if (userAds.length > 0) {
            // Get active deployments for user's ads
            const activeDeployments = await AdsDeployment.find({
              'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
              'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
            }).select('materialId lcdSlots');
            
            // Count unique actively deployed devices (only for user's ads)
            const allUniqueDeviceIds = new Set();
            const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
            
            activeDeployments.forEach(deployment => {
              deployment.lcdSlots.forEach(slot => {
                if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
                  const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
                  // ✅ Only count devices for slots that belong to this user's ads
                  if (userAdIdSet.has(adIdStr)) {
                    allUniqueDeviceIds.add(deployment.materialId);
                  }
                }
              });
            });
            
            userAnalytics.totalDevices = allUniqueDeviceIds.size;
            console.log(`✅ [SYNC] Calculated totalDevices from active deployments: ${userAnalytics.totalDevices} unique devices`);
          } else {
            // No active ads - set to 0
            userAnalytics.totalDevices = 0;
            console.log(`✅ [SYNC] No active ads found - set totalDevices to 0`);
          }
        } catch (deviceCountError) {
          console.warn(`⚠️ [SYNC] Error calculating totalDevices from deployments, using fallback: ${deviceCountError.message}`);
          // Fallback: try to calculate from materials array if available
          if (userAnalytics.ads && userAnalytics.ads.length > 0) {
            const allUniqueDeviceIds = new Set();
            userAnalytics.ads.forEach(ad => {
              if (ad.materials && Array.isArray(ad.materials)) {
                ad.materials.forEach(material => {
                  if (material && material.materialId) {
                    allUniqueDeviceIds.add(material.materialId.toString());
                  }
                });
              }
            });
            userAnalytics.totalDevices = allUniqueDeviceIds.size;
            console.log(`✅ [SYNC] Fallback: Calculated totalDevices from materials array: ${userAnalytics.totalDevices} unique devices`);
          } else {
            // Final fallback: keep existing value (don't use freshData.totalDevices as it's from historical data length)
            console.log(`⚠️ [SYNC] Final fallback: Keeping existing totalDevices: ${userAnalytics.totalDevices || 0}`);
          }
        }
        userAnalytics.averageAdCompletionRate = freshData.averageAdCompletionRate || userAnalytics.averageAdCompletionRate || 0;
        // qrScanConversionRate removed - no longer needed
        
        console.log(`✅ [SYNC] Updated totals: totalAdPlays=${userAnalytics.totalAdPlays}, totalQRScans=${userAnalytics.totalQRScans}, totalDevices=${userAnalytics.totalDevices}`);
      }
      
      // 3. Populate materialBreakdown from freshData.materials (device-level stats)
      // ✅ IMPORTANT: Only add/update materials that are actively deployed
      // First, get the set of actively deployed materialIds
      let activeMaterialIdsSet = new Set();
      try {
        const AdsDeployment = require('../models/adsDeployment');
        const Ad = require('../models/Ad');
        
        const userAds = await Ad.find({
          userId: userId,
          paymentStatus: 'PAID',
          adStatus: 'ACTIVE',
          status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
        }).select('_id');
        
        if (userAds.length > 0) {
          const activeDeployments = await AdsDeployment.find({
            'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
            'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
          }).select('materialId lcdSlots');
          
          const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
          activeDeployments.forEach(deployment => {
            deployment.lcdSlots.forEach(slot => {
              if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
                const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
                if (userAdIdSet.has(adIdStr)) {
                  activeMaterialIdsSet.add(deployment.materialId);
                }
              }
            });
          });
        }
      } catch (activeError) {
        console.warn(`⚠️ [SYNC] Error getting active deployments for materialBreakdown: ${activeError.message}`);
      }
      
      if (freshData.materials && Array.isArray(freshData.materials) && freshData.materials.length > 0) {
        console.log(`📊 [SYNC] Processing ${freshData.materials.length} materials for materialBreakdown (only actively deployed)...`);
        const existingMaterials = new Map((userAnalytics.materialBreakdown || []).map(mat => [mat.materialId, mat]));
        
        freshData.materials.forEach(newMaterial => {
          const materialId = newMaterial.materialId;
          if (!materialId) {
            console.warn(`⚠️ [SYNC] Material missing materialId:`, newMaterial);
            return;
          }
          
          // ✅ Only add/update materials that are actively deployed
          if (!activeMaterialIdsSet.has(materialId)) {
            return; // Skip materials that are not actively deployed
          }
          
          if (existingMaterials.has(materialId)) {
            // Update existing material (use max to keep highest values)
            const existing = existingMaterials.get(materialId);
            existing.totalAdPlays = Math.max(existing.totalAdPlays || 0, newMaterial.totalAdPlays || 0);
            existing.totalAdPlayTime = Math.max(existing.totalAdPlayTime || 0, newMaterial.totalAdPlayTime || 0);
            existing.totalQRScans = Math.max(existing.totalQRScans || 0, newMaterial.totalQRScans || 0);
            existing.totalAdImpressions = Math.max(existing.totalAdImpressions || 0, newMaterial.totalAdImpressions || 0);
            existing.lastActivity = newMaterial.lastActivity || existing.lastActivity || new Date();
            if (newMaterial.isOnline !== undefined) {
              existing.isOnline = newMaterial.isOnline;
            }
          } else {
            // Add new material (only if actively deployed)
            userAnalytics.materialBreakdown = userAnalytics.materialBreakdown || [];
            userAnalytics.materialBreakdown.push({
              materialId: materialId,
              carGroupId: newMaterial.carGroupId || 'UNKNOWN',
              totalAdPlays: newMaterial.totalAdPlays || 0,
              totalAdPlayTime: newMaterial.totalAdPlayTime || 0,
              totalAdImpressions: newMaterial.totalAdImpressions || 0,
              totalQRScans: newMaterial.totalQRScans || 0,
              lastActivity: newMaterial.lastActivity || new Date(),
              isOnline: newMaterial.isOnline || false
            });
          }
        });
        console.log(`✅ [SYNC] Updated materialBreakdown: ${userAnalytics.materialBreakdown.length} materials (only actively deployed)`);
        
        // ✅ Filter materialBreakdown to only include actively deployed devices (matching totalDevices)
        // Use the same activeMaterialIdsSet that was used for adding materials
        const beforeCount = userAnalytics.materialBreakdown?.length || 0;
        if (activeMaterialIdsSet.size > 0) {
          userAnalytics.materialBreakdown = (userAnalytics.materialBreakdown || []).filter(
            material => activeMaterialIdsSet.has(material.materialId)
          );
        } else {
          // ✅ No active deployments - clear materialBreakdown
          userAnalytics.materialBreakdown = [];
        }
        const afterCount = userAnalytics.materialBreakdown.length;
        console.log(`✅ [SYNC] Filtered materialBreakdown: ${beforeCount} → ${afterCount} active devices (matches totalDevices: ${userAnalytics.totalDevices || 0})`);
      } else {
        console.log(`⚠️ [SYNC] No materials in freshData: materials=${freshData.materials ? (Array.isArray(freshData.materials) ? freshData.materials.length : 'not array') : 'null/undefined'}`);
        // ✅ If no materials in freshData, still filter materialBreakdown based on active deployments
        try {
          const AdsDeployment = require('../models/adsDeployment');
          const Ad = require('../models/Ad');
          
          const userAds = await Ad.find({
            userId: userId,
            paymentStatus: 'PAID',
            adStatus: 'ACTIVE',
            status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
          }).select('_id');
          
          if (userAds.length === 0) {
            // No active ads - clear materialBreakdown
            const beforeCount = userAnalytics.materialBreakdown?.length || 0;
            userAnalytics.materialBreakdown = [];
            console.log(`✅ [SYNC] No active ads - cleared materialBreakdown: ${beforeCount} → 0`);
          } else {
            // Get active deployments and filter
            const activeDeployments = await AdsDeployment.find({
              'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
              'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
            }).select('materialId lcdSlots');
            
            const activeMaterialIds = new Set();
            const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
            
            activeDeployments.forEach(deployment => {
              deployment.lcdSlots.forEach(slot => {
                if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
                  const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
                  if (userAdIdSet.has(adIdStr)) {
                    activeMaterialIds.add(deployment.materialId);
                  }
                }
              });
            });
            
            const beforeCount = userAnalytics.materialBreakdown?.length || 0;
            if (activeMaterialIds.size > 0) {
              userAnalytics.materialBreakdown = (userAnalytics.materialBreakdown || []).filter(
                material => activeMaterialIds.has(material.materialId)
              );
            } else {
              userAnalytics.materialBreakdown = [];
            }
            const afterCount = userAnalytics.materialBreakdown.length;
            console.log(`✅ [SYNC] Filtered materialBreakdown (no freshData): ${beforeCount} → ${afterCount} active devices`);
          }
        } catch (filterError) {
          console.warn(`⚠️ [SYNC] Error filtering materialBreakdown (no freshData): ${filterError.message}`);
        }
      }
      
      // Update sync timestamp for incremental updates
      userAnalytics.lastSyncTimestamp = new Date();
      // ✅ Calculate user-level totals from dailyStats date totals to ensure consistency
      // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
      // Sum the totals.qrScans from all date entries
      const calculatedTotalQRScansFromDailyStats = (userAnalytics.dailyStats || []).reduce((sum, dateEntry) => 
        sum + (dateEntry.totals?.qrScans || 0), 0);
      
      // Also calculate from ads array as fallback
      const calculatedTotalQRScansFromAds = (userAnalytics.ads || []).reduce((sum, ad) => sum + (ad.totalQRScans || 0), 0);
      
      // Use dailyStats totals sum if available, otherwise use ads array sum
      const finalTotalQRScans = calculatedTotalQRScansFromDailyStats > 0 
        ? calculatedTotalQRScansFromDailyStats 
        : calculatedTotalQRScansFromAds;
      
      if (finalTotalQRScans > 0) {
        userAnalytics.totalQRScans = finalTotalQRScans;
        console.log(`✅ [SYNC] Calculated totalQRScans: ${finalTotalQRScans} (from dailyStats totals: ${calculatedTotalQRScansFromDailyStats}, from ads: ${calculatedTotalQRScansFromAds})`);
      }
      
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();
      userAnalytics.totalAds = userAnalytics.ads.length;
      
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

      // ✅ Save the updated userAnalytics document with VersionError handling
      // Retry logic for concurrent modification conflicts
      let retries = 3;
      let saved = false;
      while (retries > 0 && !saved) {
        try {
          await userAnalytics.save();
          saved = true;
        } catch (error) {
          if (error.name === 'VersionError' && retries > 0) {
            // Reload the document to get the latest version
            console.log(`⚠️ VersionError on save, reloading document (${retries} retries left)`);
            const freshUserAnalytics = await UserAnalytics.findOne({ userId });
            if (freshUserAnalytics) {
              // Preserve userName if it was set
              const preservedUserName = userAnalytics.userName;
              // Update the fresh document with our changes
              freshUserAnalytics.ads = userAnalytics.ads;
              freshUserAnalytics.lastUpdated = new Date();
              freshUserAnalytics.updatedAt = new Date();
              freshUserAnalytics.totalAds = userAnalytics.ads.length;
              // Preserve userName
              if (preservedUserName) {
                freshUserAnalytics.userName = preservedUserName;
              }
              userAnalytics = freshUserAnalytics;
            }
            retries--;
          } else {
            throw error;
          }
        }
      }
      
      // ✅ Even if save fails after retries, still return freshData so summary can use it
      // The data from DeviceDataHistoryV2 is still valid even if we couldn't save to DB
      if (!saved) {
        console.warn('⚠️ Failed to save UserAnalytics after retries, but returning freshData for summary calculation');
        // Don't throw - return the freshData anyway so summary can use it
      } else {
        // Clear cache for this user since data has been synced
        this.clearUserCache(userId);
        
        // ✅ CRITICAL FIX: Fetch QR scan data using getTotalQRScans (includes both DeviceTracking and DeviceDataHistoryV2)
        // This ensures we get complete QR scan data, including current day data from DeviceTracking
        // This must happen BEFORE updateFlatCollections so the flat collections have the latest data
        try {
          console.log(`📊 [SYNC] Fetching QR scan data for user ${userId}...`);
          const qrScanData = await this.getTotalQRScans(userId, startDate, endDate);
          
          console.log(`📊 [SYNC] getTotalQRScans result:`, {
            success: qrScanData.success,
            totalScans: qrScanData.totalScans,
            adsCount: qrScanData.ads?.length || 0
          });
          
          if (qrScanData.success && qrScanData.ads && qrScanData.ads.length > 0) {
            // Reload userAnalytics to get the latest saved version
            const savedUserAnalytics = await UserAnalytics.findOne({ userId });
            if (savedUserAnalytics) {
              // Create a map of QR scan data by adId
              const qrScanMap = new Map();
              qrScanData.ads.forEach(qrAd => {
                const adId = qrAd.adId ? (qrAd.adId.toString ? qrAd.adId.toString() : String(qrAd.adId)) : '';
                if (adId) {
                  qrScanMap.set(adId, qrAd.totalScans || 0);
                }
              });
              
              console.log(`📊 [SYNC] QR scan map:`, Array.from(qrScanMap.entries()));
              console.log(`📊 [SYNC] Current userAnalytics.ads QR scans:`, savedUserAnalytics.ads.map(ad => ({
                adId: String(ad.adId),
                currentQRScans: ad.totalQRScans || 0
              })));
              
              // Update ads array with QR scan data from getTotalQRScans
              // ✅ CRITICAL FIX: Use Math.max to preserve the higher value (don't overwrite with lower value)
              // This prevents getTotalQRScans from overwriting a correct value calculated from dailyStats
              let updatedCount = 0;
              savedUserAnalytics.ads = savedUserAnalytics.ads.map(ad => {
                const adId = ad.adId.toString ? ad.adId.toString() : String(ad.adId);
                const qrScans = qrScanMap.get(adId);
                if (qrScans !== undefined) {
                  const oldValue = ad.totalQRScans || 0;
                  // ✅ Use Math.max to preserve the higher value (dailyStats might have more accurate count)
                  const newValue = Math.max(oldValue, qrScans);
                  if (newValue !== oldValue) {
                    ad.totalQRScans = newValue;
                    console.log(`✅ [SYNC] Updating ad ${adId} (${ad.adTitle}) QR scans: ${oldValue} → ${newValue} (using max of ${oldValue} and ${qrScans})`);
                    updatedCount++;
                  } else if (qrScans < oldValue) {
                    console.log(`⚠️ [SYNC] Preserving higher QR scan count for ad ${adId} (${ad.adTitle}): ${oldValue} (getTotalQRScans returned ${qrScans}, but dailyStats has ${oldValue})`);
                  }
                }
                return ad;
              });
              
              // ✅ Calculate user-level totalQRScans from ads array to ensure consistency
              const calculatedTotalQRScans = savedUserAnalytics.ads.reduce((sum, ad) => sum + (ad.totalQRScans || 0), 0);
              const oldTotal = savedUserAnalytics.totalQRScans || 0;
              savedUserAnalytics.totalQRScans = calculatedTotalQRScans;
              
              if (oldTotal !== calculatedTotalQRScans || updatedCount > 0) {
                console.log(`✅ [SYNC] Updating totalQRScans: ${oldTotal} → ${calculatedTotalQRScans} (${updatedCount} ads updated)`);
                
                // ✅ CRITICAL: Save the updated QR scan data before updating flat collections
                savedUserAnalytics.markModified('ads');
                savedUserAnalytics.markModified('totalQRScans');
                await savedUserAnalytics.save();
                console.log(`✅ [SYNC] Saved updated QR scans: ${qrScanData.totalScans} total scans across ${qrScanData.ads.length} ads`);
              } else {
                console.log(`ℹ️ [SYNC] No QR scan updates needed (already up-to-date)`);
              }
              
              // Reload again to get the latest saved version with QR scan updates
              const finalUserAnalytics = await UserAnalytics.findOne({ userId }).lean();
              
              // ✅ FIX: Update flat collections (UserAnalyticsSummary & DailyUserAnalytics) after sync
              const userAnalyticsSyncJob = require('../jobs/userAnalyticsSyncJob');
              if (finalUserAnalytics) {
                await userAnalyticsSyncJob.updateFlatCollections(finalUserAnalytics);
                console.log(`✅ [SYNC] Updated flat collections (UserAnalyticsSummary & DailyUserAnalytics) for user ${userId}`);
              }
            }
          } else {
            console.warn(`⚠️ [SYNC] getTotalQRScans returned no data or failed:`, {
              success: qrScanData.success,
              message: qrScanData.message,
              adsCount: qrScanData.ads?.length || 0
            });
            
            // Still update flat collections even if QR scan fetch failed
            const userAnalyticsSyncJob = require('../jobs/userAnalyticsSyncJob');
            const savedUserAnalytics = await UserAnalytics.findOne({ userId }).lean();
            if (savedUserAnalytics) {
              await userAnalyticsSyncJob.updateFlatCollections(savedUserAnalytics);
              console.log(`✅ [SYNC] Updated flat collections (without QR scan update) for user ${userId}`);
            }
          }
        } catch (qrScanError) {
          console.error(`❌ [SYNC] Error fetching QR scan data:`, qrScanError.message);
          console.error(`❌ [SYNC] QR scan error stack:`, qrScanError.stack);
          
          // Still update flat collections even if QR scan fetch failed
          try {
            const userAnalyticsSyncJob = require('../jobs/userAnalyticsSyncJob');
            const savedUserAnalytics = await UserAnalytics.findOne({ userId }).lean();
            if (savedUserAnalytics) {
              await userAnalyticsSyncJob.updateFlatCollections(savedUserAnalytics);
              console.log(`✅ [SYNC] Updated flat collections (QR scan fetch failed) for user ${userId}`);
            }
          } catch (flatCollectionError) {
            console.error('❌ [SYNC] Error updating flat collections:', flatCollectionError.message);
          }
        }
      }

      // ✅ Return freshData with all the processed totals (totalAdPlays, etc.)
      // This ensures the summary calculation can use the real-time data from DeviceDataHistoryV2
      // IMPORTANT: Return freshData even if save failed - the data is still valid
      return {
        success: true,
        message: saved ? 'User analytics synced with fresh data from DeviceDataHistoryV2' : 'User analytics fetched from DeviceDataHistoryV2 (save failed, but data is valid)',
        data: {
          // ✅ Include all the processed totals from freshData (real-time data from DeviceDataHistoryV2)
          totalAdPlays: freshData.totalAdPlays || 0,
          totalAdPlayTime: freshData.totalAdPlayTime || 0,
          totalQRScans: freshData.totalQRScans || 0,
          totalDevices: freshData.totalDevices || 0,
          averageAdCompletionRate: freshData.averageAdCompletionRate || 0,
          // qrScanConversionRate removed
          ads: freshData.ads || [],
          materials: freshData.materials || [],
          dateRange: freshData.dateRange || {},
          lastUpdated: freshData.lastUpdated || new Date()
        },
        userAnalytics: {
          userId: userAnalytics.userId,
          totalAds: userAnalytics.totalAds,
          totalDevices: userAnalytics.totalDevices,
          totalAdPlayTime: userAnalytics.totalAdPlayTime,
          totalQRScans: userAnalytics.totalQRScans,
          lastUpdated: userAnalytics.lastUpdated
        }
      };

    } catch (error) {
      console.error('Error syncing user analytics from history:', error);
      throw error;
    }
  }

  // Initialize UserAnalytics for a user if it doesn't exist
  static async initializeUserAnalytics(userId) {
    try {
      let userAnalytics = await UserAnalytics.findOne({ userId });
      
      // Fetch user to get userName
      const User = require('../models/User');
      const user = await User.findById(userId).select('firstName lastName').lean();
      const userName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
      
      if (!userAnalytics) {
        console.log(`📊 Creating initial UserAnalytics record for user ${userId}`);
        
        userAnalytics = new UserAnalytics({
          userId: userId,
          userName: userName,
          ads: [],
          totalAds: 0,
          totalDevices: 0,
          totalAdPlays: 0, // Ensure this field is initialized
          totalAdPlayTime: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
          adPerformance: [],
          materialBreakdown: [],
          errorLogs: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUpdated: new Date()
        });
        
        await userAnalytics.save();
        console.log(`✅ Created initial UserAnalytics record for user ${userId} (${userName || 'Unknown'})`);
      } else {
        // Update userName if it's missing or changed
        if (!userAnalytics.userName || userAnalytics.userName !== userName) {
          userAnalytics.userName = userName;
          await userAnalytics.save();
          if (userName) {
            console.log(`✅ Updated userName for user ${userId}: ${userName}`);
          }
        }
      }
      
      return userAnalytics;
    } catch (error) {
      console.error('Error initializing user analytics:', error);
      throw error;
    }
  }

  // ===========================================
  // DEVICE-SPECIFIC ANALYTICS FUNCTIONS
  // ===========================================

  // Get detailed analytics for a specific device from DeviceDataHistoryV2
  static async getDeviceSpecificAnalytics(userId, deviceId, startDate = null, endDate = null, filterAdId = null) {
    try {
      console.log('🔍 DEVICE SPECIFIC ANALYTICS - Fetching from DeviceDataHistoryV2 (device tracking database)');
      console.log('🔍 Device ID:', deviceId, 'User ID:', userId, filterAdId ? `Filter Ad ID: ${filterAdId}` : 'All Ads');
      
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to verify access (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          deviceAnalytics: null
        };
      }

      // ✅ Handle date range: if both are null, use all available data (period='all')
      // Otherwise, use provided dates or default to last 30 days
      let defaultStartDate, defaultEndDate;
      
      if (startDate === null && endDate === null) {
        // Period='all' - use all available data (no date filtering)
        defaultStartDate = null;
        defaultEndDate = null;
        console.log('📅 [Device Analytics] Using all available data (period=all)');
      } else if (startDate && endDate) {
        // Use provided dates
        defaultStartDate = startDate instanceof Date ? startDate : new Date(startDate);
        defaultEndDate = endDate instanceof Date ? endDate : new Date(endDate);
        console.log('📅 [Device Analytics] Using provided date range:', {
          start: defaultStartDate.toISOString(),
          end: defaultEndDate.toISOString()
        });
      } else {
        // Default to last 30 days if only one date is provided or neither is provided
        defaultStartDate = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        defaultEndDate = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();
        console.log('📅 [Device Analytics] Using default date range (last 30 days)');
      }

      // Pre-calculate user's ad IDs once (used throughout analytics calculations)
      const userAdIds = userAds.map(ad => ad._id.toString());

      // Find device data in DeviceDataHistoryV2
      const deviceData = await DeviceDataHistoryV2.findOne({ materialId: deviceId });
      
      if (!deviceData) {
        console.log('❌ Device not found in DeviceDataHistoryV2:', deviceId);
        return {
          success: false,
          message: 'Device not found or no data available',
          deviceAnalytics: null
        };
      }

      console.log('✅ Device found in DeviceDataHistoryV2:', deviceId);
      console.log('📊 Device daily data entries:', deviceData.dailyData?.length || 0);
      console.log('📊 [Device Analytics] User ID:', userId, 'User Ad IDs:', userAdIds.length, userAdIds);
      
      // ✅ DEBUG: Log sample data structure to understand what we're working with
      if (deviceData.dailyData && deviceData.dailyData.length > 0) {
        const sampleDay = deviceData.dailyData[0];
        console.log('📊 [Device Analytics] Sample day structure:', {
          date: sampleDay.date,
          hasAdPerformance: !!sampleDay.adPerformance && sampleDay.adPerformance.length > 0,
          adPerformanceCount: sampleDay.adPerformance?.length || 0,
          hasAdPlaybacks: !!sampleDay.adPlaybacks && sampleDay.adPlaybacks.length > 0,
          adPlaybacksCount: sampleDay.adPlaybacks?.length || 0,
          hasQrScansByAd: !!sampleDay.qrScansByAd && sampleDay.qrScansByAd.length > 0,
          qrScansByAdCount: sampleDay.qrScansByAd?.length || 0,
          hasQrScans: !!sampleDay.qrScans && sampleDay.qrScans.length > 0,
          qrScansCount: sampleDay.qrScans?.length || 0,
          sampleAdPerformance: sampleDay.adPerformance?.[0] || null,
          sampleAdPlayback: sampleDay.adPlaybacks?.[0] || null
        });
      }

      // ✅ Filter daily data by date range (if dates are provided, otherwise use all data)
      let filteredDailyData = deviceData.dailyData || [];
      if (defaultStartDate && defaultEndDate) {
        filteredDailyData = deviceData.dailyData.filter(day => {
          const dayDate = new Date(day.date);
          return dayDate >= defaultStartDate && dayDate <= defaultEndDate;
        });
        console.log('📊 [Device Analytics] Filtered daily data by date range:', {
          total: deviceData.dailyData.length,
          filtered: filteredDailyData.length,
          dateRange: { start: defaultStartDate.toISOString(), end: defaultEndDate.toISOString() }
        });
      } else {
        // Use all available data (period='all')
        console.log('📊 [Device Analytics] Using all available daily data (no date filter):', filteredDailyData.length, 'days');
      }

      // Calculate device-specific metrics
      const deviceMetrics = {
        // Basic device info
        deviceInfo: {
          materialId: deviceData.materialId,
          carGroupId: deviceData.carGroupId,
          deviceName: deviceData.deviceInfo?.deviceName || 'Unknown Device',
          deviceType: deviceData.deviceInfo?.deviceType || 'Unknown',
          osName: deviceData.deviceInfo?.osName || 'Unknown',
          osVersion: deviceData.deviceInfo?.osVersion || 'Unknown',
          platform: deviceData.deviceInfo?.platform || 'Unknown',
          brand: deviceData.deviceInfo?.brand || 'Unknown',
          modelName: deviceData.deviceInfo?.modelName || 'Unknown',
          screenResolution: `${deviceData.deviceInfo?.screenWidth || 0}x${deviceData.deviceInfo?.screenHeight || 0}`
        },

        // Date range
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
          totalDays: filteredDailyData.length
        },

        // Aggregated metrics from filtered data (will be calculated from user-specific data only)
        totals: {
          totalAdPlays: 0, // Will be calculated from adPerformanceMap (user's ads only)
          totalQRScans: 0, // Will be calculated from qrScanMap (user's ads only)
          totalDistanceTraveled: filteredDailyData.reduce((sum, day) => sum + (day.totalDistanceTraveled || 0), 0),
          totalHoursOnline: filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0),
 // Will be calculated from adPerformanceMap (user's ads only)
          totalAdPlayTime: 0 // Will be calculated from adPerformanceMap (user's ads only)
        },

        // Averages
        averages: {
          averageDailyPlays: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlays || 0), 0) / filteredDailyData.length : 0,
          averageDailyQRScans: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.totalQRScans || 0), 0) / filteredDailyData.length : 0,
          averageDailyHours: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0) / filteredDailyData.length : 0,
          averageDailyDistance: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.totalDistanceTraveled || 0), 0) / filteredDailyData.length : 0,
          averageCompletionRate: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.dailySummary?.adCompletionRate || 0), 0) / filteredDailyData.length : 0
        },

        // Performance metrics
        performance: {
          totalAdPlayTimeHours: filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlayTime || 0), 0) / 3600,
          // qrScanConversionRate removed
          complianceRate: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.dailySummary?.complianceRate || 0), 0) / filteredDailyData.length : 0,
          uptimePercentage: filteredDailyData.length > 0 ? 
            (filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0) / (filteredDailyData.length * 8)) * 100 : 0
        }
      };

      // Calculate QR scan conversion rate (using ad plays instead of impressions)
      const totalAdPlays = deviceMetrics.totals.totalAdPlays;
      const totalQRScans = deviceMetrics.totals.totalQRScans;
      // qrScanConversionRate removed - no longer needed

      // Get ad performance breakdown
      const adPerformanceMap = {};
      
      // ✅ PRIMARY SOURCE: Use adPlaybacks (raw data) as the source of truth
      // adPerformance might be missing or incomplete, so we always process adPlaybacks
      // If adPerformance exists and has data, we can use it as a supplement, but adPlaybacks is authoritative
      let totalAdPerformanceEntries = 0;
      let totalAdPlaybackEntries = 0;
      let matchedAdPerformanceEntries = 0;
      let matchedAdPlaybackEntries = 0;
      
      filteredDailyData.forEach(day => {
        // ✅ PRIMARY: Always process adPlaybacks first (source of truth)
        // This is the raw data that contains all playback information
        if (day.adPlaybacks && day.adPlaybacks.length > 0) {
          totalAdPlaybackEntries += day.adPlaybacks.length;
          day.adPlaybacks.forEach(playback => {
            // ✅ Convert adId to string for comparison (handles both ObjectId and string)
            const playbackAdIdStr = playback.adId?.toString ? playback.adId.toString() : String(playback.adId);
            const userIdMatch = playback.userId?.toString() === userId?.toString();
            const adIdMatch = playbackAdIdStr && userAdIds.includes(playbackAdIdStr);
            const belongsToUser = userIdMatch || adIdMatch;
            const matchesFilter = !filterAdId || playbackAdIdStr === filterAdId.toString();
            
            // ✅ Only count master playbacks (not slave slot duplicates)
            // Note: isMaster field might not exist in old data, so default to true if undefined
            const isMasterPlayback = playback.isMaster === true || playback.isMaster === undefined;
            
            if (belongsToUser && matchesFilter && isMasterPlayback) {
              matchedAdPlaybackEntries++;
              // ✅ Use playbackAdIdStr as key for consistent string-based lookup
              if (!adPerformanceMap[playbackAdIdStr]) {
                adPerformanceMap[playbackAdIdStr] = {
                  adId: playbackAdIdStr,
                  adTitle: playback.adTitle,
                  totalPlays: 0,
                  totalViewTime: 0,
                  totalImpressions: 0,
                  averageCompletionRate: 0,
                  firstPlayed: null,
                  lastPlayed: null,
                  playCount: 0
                };
              }
              
              adPerformanceMap[playbackAdIdStr].totalPlays += 1;
              adPerformanceMap[playbackAdIdStr].totalViewTime += playback.viewTime || 0;
              adPerformanceMap[playbackAdIdStr].playCount += 1;
              adPerformanceMap[playbackAdIdStr].totalImpressions += playback.impressions || 1;
              
              const playbackStartTime = playback.startTime ? new Date(playback.startTime) : null;
              if (playbackStartTime) {
                if (!adPerformanceMap[playbackAdIdStr].firstPlayed || playbackStartTime < new Date(adPerformanceMap[playbackAdIdStr].firstPlayed)) {
                  adPerformanceMap[playbackAdIdStr].firstPlayed = playbackStartTime;
                }
                if (!adPerformanceMap[playbackAdIdStr].lastPlayed || playbackStartTime > new Date(adPerformanceMap[playbackAdIdStr].lastPlayed)) {
                  adPerformanceMap[playbackAdIdStr].lastPlayed = playbackStartTime;
                }
              }
            }
          });
        }
        
        // ✅ SUPPLEMENT: If adPerformance exists and has data, we can use it to fill in gaps
        // But adPlaybacks is the primary source, so we only use adPerformance if adPlaybacks is empty
        // This handles edge cases where adPerformance might have aggregated data but adPlaybacks was cleared
        if (day.adPerformance && day.adPerformance.length > 0 && (!day.adPlaybacks || day.adPlaybacks.length === 0)) {
          totalAdPerformanceEntries += day.adPerformance.length;
          day.adPerformance.forEach(ad => {
            // Only process ads that belong to the current user (check both userId and adId)
            // AND filter by specific ad if filterAdId is provided
            // ✅ Convert adId to string for comparison (handles both ObjectId and string)
            const adIdStr = ad.adId?.toString ? ad.adId.toString() : String(ad.adId);
            const userIdMatch = ad.userId?.toString() === userId?.toString();
            const adIdMatch = userAdIds.includes(adIdStr);
            const belongsToUser = userIdMatch || adIdMatch;
            const matchesFilter = !filterAdId || adIdStr === filterAdId.toString();
            
            if (belongsToUser && matchesFilter) {
              matchedAdPerformanceEntries++;
              
              // ✅ Use adIdStr as key for consistent string-based lookup
              // Only add if not already in map (adPlaybacks takes precedence)
              if (!adPerformanceMap[adIdStr]) {
                adPerformanceMap[adIdStr] = {
                  adId: adIdStr,
                  adTitle: ad.adTitle,
                  totalPlays: 0,
                  totalViewTime: 0,
                  totalImpressions: 0,
                  averageCompletionRate: 0,
                  firstPlayed: null,
                  lastPlayed: null,
                  playCount: 0
                };
              }
              
              adPerformanceMap[adIdStr].totalPlays += ad.playCount || 0;
              adPerformanceMap[adIdStr].totalViewTime += ad.totalViewTime || 0;
              adPerformanceMap[adIdStr].playCount += ad.playCount || 0;
              
              if (!adPerformanceMap[adIdStr].firstPlayed || (ad.firstPlayed && new Date(ad.firstPlayed) < new Date(adPerformanceMap[adIdStr].firstPlayed))) {
                adPerformanceMap[adIdStr].firstPlayed = ad.firstPlayed;
              }
              if (!adPerformanceMap[adIdStr].lastPlayed || (ad.lastPlayed && new Date(ad.lastPlayed) > new Date(adPerformanceMap[adIdStr].lastPlayed))) {
                adPerformanceMap[adIdStr].lastPlayed = ad.lastPlayed;
              }
            }
          });
        }
      });

      // Calculate average completion rates for each ad
      Object.values(adPerformanceMap).forEach(ad => {
        ad.averageCompletionRate = ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalPlays * 30)) * 100 : 0; // Assuming 30s average ad duration
      });

      // Get QR scan breakdown by ad
      const qrScanMap = {};
      
      filteredDailyData.forEach(day => {
        // ✅ Process qrScansByAd (aggregated data) if available
        const hasDayQrScansByAd = day.qrScansByAd && day.qrScansByAd.length > 0;
        if (hasDayQrScansByAd) {
          day.qrScansByAd.forEach(adScan => {
            const scanAdIdStr = adScan.adId?.toString ? adScan.adId.toString() : String(adScan.adId);
            const belongsToUser = adScan.userId?.toString() === userId?.toString() || (scanAdIdStr && userAdIds.includes(scanAdIdStr));
            const matchesFilter = !filterAdId || scanAdIdStr === filterAdId.toString();
            
            if (belongsToUser && matchesFilter) {
              if (!qrScanMap[scanAdIdStr]) {
                qrScanMap[scanAdIdStr] = {
                  adId: scanAdIdStr,
                  adTitle: adScan.adTitle,
                  totalScans: 0,
                  scans: []
                };
              }
              qrScanMap[scanAdIdStr].totalScans += adScan.scanCount || 0;
            }
          });
        }
        
        // ✅ FIX: FALLBACK: Process raw qrScans ONLY if qrScansByAd is empty
        // This prevents double-counting when both qrScansByAd and qrScans exist
        if (!hasDayQrScansByAd && day.qrScans && day.qrScans.length > 0) {
          day.qrScans.forEach(scan => {
            // Only process QR scans for the current user (check both userId and adId)
            // AND filter by specific ad if filterAdId is provided
            // ✅ Convert adId to string for comparison (handles both ObjectId and string)
            const scanAdIdStr = scan.adId?.toString ? scan.adId.toString() : String(scan.adId);
            const belongsToUser = scan.userId?.toString() === userId?.toString() || (scanAdIdStr && userAdIds.includes(scanAdIdStr));
            const matchesFilter = !filterAdId || scanAdIdStr === filterAdId.toString();
            
            if (belongsToUser && matchesFilter) {
              // ✅ Use scanAdIdStr as key for consistent string-based lookup
              if (!qrScanMap[scanAdIdStr]) {
                qrScanMap[scanAdIdStr] = {
                  adId: scanAdIdStr,
                  adTitle: scan.adTitle,
                  totalScans: 0,
                  scans: []
                };
              }
              qrScanMap[scanAdIdStr].totalScans += 1;
              qrScanMap[scanAdIdStr].scans.push(scan);
            }
          });
        }
      });
      

      // Calculate totals from user-specific data only (filtered by adId if provided)
      deviceMetrics.totals.totalQRScans = Object.values(qrScanMap).reduce((sum, qr) => sum + (qr.totalScans || 0), 0);
      deviceMetrics.totals.totalAdPlays = Object.values(adPerformanceMap).reduce((sum, ad) => sum + (ad.totalPlays || 0), 0);
      deviceMetrics.totals.totalAdPlayTime = Object.values(adPerformanceMap).reduce((sum, ad) => sum + (ad.totalViewTime || 0), 0);
      
      console.log(`📊 [Device Analytics] Calculated totals for device ${deviceId}:`, {
        totalAdPlays: deviceMetrics.totals.totalAdPlays,
        totalQRScans: deviceMetrics.totals.totalQRScans,
        totalAdPlayTime: deviceMetrics.totals.totalAdPlayTime,
        adsInMap: Object.keys(adPerformanceMap).length,
        qrScansInMap: Object.keys(qrScanMap).length,
        filteredDays: filteredDailyData.length,
        filterAdId: filterAdId || 'all',
        userAdIds: userAdIds.length,
        totalAdPerformanceEntries,
        matchedAdPerformanceEntries,
        totalAdPlaybackEntries,
        matchedAdPlaybackEntries,
        usingFallback: totalAdPerformanceEntries === 0 || matchedAdPerformanceEntries === 0
      });
      
      if (filterAdId) {
        console.log(`📊 [Device Analytics] Filtered by adId ${filterAdId}:`, {
          totalAdPlays: deviceMetrics.totals.totalAdPlays,
          totalQRScans: deviceMetrics.totals.totalQRScans,
          adsInMap: Object.keys(adPerformanceMap).length
        });
      }
      
      // Update averages with user-specific totals
      deviceMetrics.averages.averageDailyPlays = filteredDailyData.length > 0 ? 
        deviceMetrics.totals.totalAdPlays / filteredDailyData.length : 0;
      deviceMetrics.averages.averageDailyQRScans = filteredDailyData.length > 0 ? 
        deviceMetrics.totals.totalQRScans / filteredDailyData.length : 0;

      // Get hourly activity pattern
      const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
        hour: hour,
        totalPlays: 0,
        totalQRScans: 0,
        totalDistance: 0,
        totalHoursOnline: 0,
        activityCount: 0
      }));

      filteredDailyData.forEach(day => {
        if (day.hourlyStats && day.hourlyStats.length > 0) {
          day.hourlyStats.forEach(hourlyStat => {
            const hourIndex = hourlyStat.hour;
            if (hourIndex >= 0 && hourIndex < 24) {
              hourlyActivity[hourIndex].totalPlays += hourlyStat.adPlays || 0;
              hourlyActivity[hourIndex].totalQRScans += hourlyStat.qrScans || 0;
              hourlyActivity[hourIndex].totalDistance += hourlyStat.distanceTraveled || 0;
              hourlyActivity[hourIndex].totalHoursOnline += hourlyStat.hoursOnline || 0;
              hourlyActivity[hourIndex].activityCount += hourlyStat.activity || 0;
            }
          });
        }
      });

      // ✅ Get daily breakdown - calculated from filtered user/ad data (not raw daily totals)
      // Group adPlaybacks and qrScans by date to get accurate daily totals
      const dailyAdPlaybacksMap = new Map();
      const dailyQrScansMap = new Map();
      
      filteredDailyData.forEach(day => {
        const dateStr = day.date instanceof Date ? day.date.toISOString().split('T')[0] : new Date(day.date).toISOString().split('T')[0];
        
        // Process adPlaybacks for this day (filtered by user and adId)
        if (day.adPlaybacks && day.adPlaybacks.length > 0) {
          day.adPlaybacks.forEach(playback => {
            // ✅ Convert adId to string for comparison (handles both ObjectId and string)
            const playbackAdIdStr = playback.adId?.toString ? playback.adId.toString() : String(playback.adId);
            const belongsToUser = playback.userId?.toString() === userId?.toString() || (playbackAdIdStr && userAdIds.includes(playbackAdIdStr));
            const matchesFilter = !filterAdId || playbackAdIdStr === filterAdId.toString();
            
            if (belongsToUser && matchesFilter) {
              if (!dailyAdPlaybacksMap.has(dateStr)) {
                dailyAdPlaybacksMap.set(dateStr, { plays: 0, playTime: 0 });
              }
              const dayData = dailyAdPlaybacksMap.get(dateStr);
              dayData.plays += 1;
              dayData.playTime += playback.viewTime || 0;
            }
          });
        }
        
        // Process qrScans for this day (filtered by user and adId)
        if (day.qrScans && day.qrScans.length > 0) {
          day.qrScans.forEach(scan => {
            // ✅ Convert adId to string for comparison (handles both ObjectId and string)
            const scanAdIdStr = scan.adId?.toString ? scan.adId.toString() : String(scan.adId);
            const belongsToUser = scan.userId?.toString() === userId?.toString() || (scanAdIdStr && userAdIds.includes(scanAdIdStr));
            const matchesFilter = !filterAdId || scanAdIdStr === filterAdId.toString();
            
            if (belongsToUser && matchesFilter) {
              if (!dailyQrScansMap.has(dateStr)) {
                dailyQrScansMap.set(dateStr, 0);
              }
              dailyQrScansMap.set(dateStr, dailyQrScansMap.get(dateStr) + 1);
            }
          });
        }
      });
      
      // Build dailyBreakdown from filtered data
      const dailyBreakdown = filteredDailyData.map(day => {
        const dateStr = day.date instanceof Date ? day.date.toISOString().split('T')[0] : new Date(day.date).toISOString().split('T')[0];
        const adPlaybackData = dailyAdPlaybacksMap.get(dateStr) || { plays: 0, playTime: 0 };
        const qrScans = dailyQrScansMap.get(dateStr) || 0;
        
        return {
          date: day.date,
          totalAdPlays: adPlaybackData.plays, // ✅ Filtered by user and adId
          totalQRScans: qrScans, // ✅ Filtered by user and adId
          totalHoursOnline: day.totalHoursOnline || 0,
          totalDistanceTraveled: day.totalDistanceTraveled || 0,
          totalAdPlayTime: adPlaybackData.playTime, // ✅ Filtered by user and adId
          complianceRate: day.dailySummary?.complianceRate || 0,
          adCompletionRate: day.dailySummary?.adCompletionRate || 0,
          isDisplaying: day.isDisplaying || false,
          maintenanceMode: day.maintenanceMode || false,
          networkStatus: day.networkStatus || { isOnline: false }
        };
      });

      // Get location insights
      const locationInsights = {
        totalLocationPoints: filteredDailyData.reduce((sum, day) => sum + (day.locationHistory?.length || 0), 0),
        averageDailyLocations: filteredDailyData.length > 0 ? 
          filteredDailyData.reduce((sum, day) => sum + (day.locationHistory?.length || 0), 0) / filteredDailyData.length : 0,
        maxDailyLocations: Math.max(...filteredDailyData.map(day => day.locationHistory?.length || 0), 0)
      };

      console.log('📊 DEVICE SPECIFIC ANALYTICS - Data sourced from DeviceDataHistoryV2 (device tracking):');
      console.log('📊 Total Ad Plays:', deviceMetrics.totals.totalAdPlays);
      console.log('📊 Total QR Scans:', deviceMetrics.totals.totalQRScans);
      console.log('📊 Total Display Time:', deviceMetrics.totals.totalAdPlayTime);
      console.log('📊 Average Completion Rate:', deviceMetrics.averages.averageCompletionRate);
      console.log('📊 Filtered daily data entries:', filteredDailyData.length);

      return {
        success: true,
        deviceAnalytics: {
          deviceInfo: deviceMetrics.deviceInfo,
          dateRange: deviceMetrics.dateRange,
          totals: deviceMetrics.totals,
          averages: deviceMetrics.averages,
          performance: deviceMetrics.performance,
          adPerformance: Object.values(adPerformanceMap),
          qrScanBreakdown: Object.values(qrScanMap),
          hourlyActivity: hourlyActivity,
          dailyBreakdown: dailyBreakdown,
          locationInsights: locationInsights,
          lifetimeTotals: deviceData.lifetimeTotals || {},
          lastUpdated: deviceData.lastDataUpdate || deviceData.updatedAt
        }
      };

    } catch (error) {
      console.error('Error getting device-specific analytics:', error);
      return {
        success: false,
        message: 'Failed to get device-specific analytics',
        error: error.message
      };
    }
  }

  // Get device analytics summary for multiple devices
  static async getMultipleDevicesAnalytics(userId, deviceIds = [], startDate = null, endDate = null, useAllDevices = false) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // For "All Devices" mode, use only UserAnalytics data
      if (useAllDevices) {
        console.log('📊 Using UserAnalytics data for multiple devices analytics');
        const userAnalytics = await this.initializeUserAnalytics(userId);
        
        return {
          success: true,
          devicesAnalytics: [], // Return empty array for "all devices" since we use summary data
          totalDevices: userAnalytics.totalDevices || 0,
          summary: {
            totalAdPlays: userAnalytics.totalAdPlays || 0,
            totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
            totalQRScans: userAnalytics.totalQRScans || 0,
            totalDevices: userAnalytics.totalDevices || 0,
            averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
            // qrScanConversionRate removed from API response
          },
          dateRange: {
            startDate: startDate || new Date('2020-01-01'),
            endDate: endDate || new Date()
          }
        };
      }
      
      // Get user's ads to verify access (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          devicesAnalytics: []
        };
      }

      // If no device IDs provided, get all devices for user's ads
      if (!deviceIds || deviceIds.length === 0) {
        deviceIds = userAds.flatMap(ad => ad.materialId || []).filter(Boolean);
      }

      // Set default date range if not provided (last 7 days)
      const defaultStartDate = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const defaultEndDate = endDate || new Date();

      // Get device data for all devices
      const deviceDataList = await DeviceDataHistoryV2.find({ 
        materialId: { $in: deviceIds } 
      });

      const devicesAnalytics = [];

      for (const deviceData of deviceDataList) {
        // Filter daily data by date range
        const filteredDailyData = deviceData.dailyData.filter(day => {
          const dayDate = new Date(day.date);
          return dayDate >= defaultStartDate && dayDate <= defaultEndDate;
        });

        // Calculate summary metrics for this device
        const deviceSummary = {
          deviceInfo: {
            materialId: deviceData.materialId,
            carGroupId: deviceData.carGroupId,
            deviceName: deviceData.deviceInfo?.deviceName || 'Unknown Device',
            deviceType: deviceData.deviceInfo?.deviceType || 'Unknown'
          },
          summary: {
            totalAdPlays: filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlays || 0), 0),
            totalQRScans: filteredDailyData.reduce((sum, day) => sum + (day.totalQRScans || 0), 0),
            totalHoursOnline: filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0),
            totalAdPlayTime: filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlayTime || 0), 0),
            averageCompletionRate: filteredDailyData.length > 0 ? 
              filteredDailyData.reduce((sum, day) => sum + (day.dailySummary?.adCompletionRate || 0), 0) / filteredDailyData.length : 0,
            uptimePercentage: filteredDailyData.length > 0 ? 
              (filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0) / (filteredDailyData.length * 8)) * 100 : 0
          },
          dateRange: {
            startDate: defaultStartDate,
            endDate: defaultEndDate,
            totalDays: filteredDailyData.length
          },
          lastActivity: deviceData.lastDataUpdate || deviceData.updatedAt
        };

        // Calculate QR scan conversion rate (using ad plays instead of impressions)
        const totalAdPlays = deviceSummary.summary.totalAdPlays;
        const totalQRScans = deviceSummary.summary.totalQRScans;
        // qrScanConversionRate removed - no longer needed

        devicesAnalytics.push(deviceSummary);
      }

      // Sort by total ad plays (descending)
      devicesAnalytics.sort((a, b) => b.summary.totalAdPlays - a.summary.totalAdPlays);

      return {
        success: true,
        devicesAnalytics: devicesAnalytics,
        totalDevices: devicesAnalytics.length,
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        }
      };

    } catch (error) {
      console.error('Error getting multiple devices analytics:', error);
      return {
        success: false,
        message: 'Failed to get multiple devices analytics',
        error: error.message
      };
    }
  }

  // ===========================================
  // DETAILED ANALYTICS FUNCTIONS
  // ===========================================

  // Get total plays of ads for a specific user
  static async getTotalAdPlays(userId, startDate = null, endDate = null) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          totalPlays: 0,
          ads: []
        };
      }

      // Get all materials associated with user's ads
      const materialIds = [];
      for (const ad of userAds) {
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          ad.targetDevices.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
            }
          });
        } else if (ad.materialId && ad.materialId.length > 0) {
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
          message: 'No materials found for this user',
          totalPlays: 0,
          ads: []
        };
      }

      let totalPlays = 0;
      const adPlaysByAd = {};
      const adPlaysByMaterial = {};

      // Set default date range if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const defaultEndDate = endDate || now;

      // Get current day data from DeviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentDayDate = new Date(currentDay);
      currentDayDate.setHours(0, 0, 0, 0);
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });

      // Process current day data
      currentData.forEach(device => {
        if (device.adPerformance && device.adPerformance.length > 0) {
          device.adPerformance.forEach(adPerf => {
            // Only count plays for user's ads
            const userAd = userAds.find(ad => ad._id.toString() === adPerf.adId);
            if (userAd) {
              if (!adPlaysByAd[adPerf.adId]) {
                adPlaysByAd[adPerf.adId] = {
                  adId: adPerf.adId,
                  adTitle: adPerf.adTitle,
                  totalPlays: 0,
                  totalViewTime: 0,
                  averageViewTime: 0,
                  completionRate: 0,
                  firstPlayed: adPerf.firstPlayed,
                  lastPlayed: adPerf.lastPlayed,
                };
              }
              adPlaysByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
              adPlaysByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
              if (adPerf.lastPlayed > adPlaysByAd[adPerf.adId].lastPlayed) {
                adPlaysByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
              }
              totalPlays += adPerf.playCount || 0;
            }
          });
        }

        // Track by material
        if (!adPlaysByMaterial[device.materialId]) {
          adPlaysByMaterial[device.materialId] = {
            materialId: device.materialId,
            carGroupId: device.carGroupId,
            totalPlays: 0,
            totalViewTime: 0,
            ads: []
          };
        }
        adPlaysByMaterial[device.materialId].totalPlays += device.totalAdPlays || 0;
        adPlaysByMaterial[device.materialId].totalViewTime += device.totalAdPlayTime || 0;
      });

      // Get historical data from DeviceDataHistoryV2
      // ✅ FIX: Exclude today's date from historical data to avoid double-counting
      // Today's data is already counted from DeviceTracking above
      const historicalEndDate = new Date(defaultEndDate);
      // If endDate includes today, exclude today from historical query
      const todayStart = new Date(currentDay);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(currentDay);
      todayEnd.setHours(23, 59, 59, 999);
      
      // Only exclude today if the query range includes today
      const shouldExcludeToday = historicalEndDate >= todayStart;
      
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(defaultStartDate),
          $lte: shouldExcludeToday ? new Date(todayStart.getTime() - 1) : new Date(defaultEndDate)
        }
      });

      // Process historical data
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            // ✅ FIX: Exclude today's date from historical data processing
            const isToday = dailyDate >= todayStart && dailyDate <= todayEnd;
            if (!isToday && dailyDate >= new Date(defaultStartDate) && dailyDate <= new Date(defaultEndDate)) {
              if (dailyData.adPerformance && dailyData.adPerformance.length > 0) {
                dailyData.adPerformance.forEach(adPerf => {
                  // Only count plays for user's ads
                  const userAd = userAds.find(ad => ad._id.toString() === adPerf.adId);
                  if (userAd) {
                    if (!adPlaysByAd[adPerf.adId]) {
                      adPlaysByAd[adPerf.adId] = {
                        adId: adPerf.adId,
                        adTitle: adPerf.adTitle,
                        totalPlays: 0,
                        totalViewTime: 0,
                        averageViewTime: 0,
                        completionRate: 0,
                        firstPlayed: adPerf.firstPlayed,
                        lastPlayed: adPerf.lastPlayed,
                      };
                    }
                    adPlaysByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
                    adPlaysByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
                    if (adPerf.lastPlayed > adPlaysByAd[adPerf.adId].lastPlayed) {
                      adPlaysByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
                    }
                    totalPlays += adPerf.playCount || 0;
                  }
                });
              }

              // Track by material
              if (!adPlaysByMaterial[archive.materialId]) {
                adPlaysByMaterial[archive.materialId] = {
                  materialId: archive.materialId,
                  carGroupId: archive.carGroupId,
                  totalPlays: 0,
                  totalViewTime: 0,
                  ads: []
                };
              }
              adPlaysByMaterial[archive.materialId].totalPlays += dailyData.totalAdPlays || 0;
              adPlaysByMaterial[archive.materialId].totalViewTime += dailyData.totalAdPlayTime || 0;
            }
          });
        }
      });

      // Calculate averages for ad plays
      Object.values(adPlaysByAd).forEach(ad => {
        ad.averageViewTime = ad.totalPlays > 0 ? ad.totalViewTime / ad.totalPlays : 0;
        ad.completionRate = ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.totalPlays * 30))) * 100 : 0;
      });

      return {
        success: true,
        userId,
        totalPlays,
        ads: Object.values(adPlaysByAd),
        materials: Object.values(adPlaysByMaterial),
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        summary: {
          totalAds: Object.keys(adPlaysByAd).length,
          averagePlaysPerAd: Object.keys(adPlaysByAd).length > 0 ? totalPlays / Object.keys(adPlaysByAd).length : 0
        }
      };
    } catch (error) {
      console.error('Error getting total ad plays:', error);
      throw error;
    }
  }

  // Get total QR scans of ads for a specific user
  static async getTotalQRScans(userId, startDate = null, endDate = null) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const QRScanTracking = require('../models/qrScanTracking');
      const Ad = require('../models/Ad');
      
      // ✅ Only log in verbose/debug mode
      const isVerbose = process.env.VERBOSE_LOGS === 'true' || process.env.DEBUG_QR_SCANS === 'true';
      
      if (isVerbose) {
        console.log('🔍 [getTotalQRScans] Called with:', {
          userId: userId,
          startDate: startDate,
          endDate: endDate,
          isAllTime: startDate === null && endDate === null
        });
      }
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      // ✅ For all-time data, include ALL ads regardless of status
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).populate('materialId', 'materialId'); // ✅ Populate Material documents to get materialId strings
      
      if (isVerbose) {
        console.log('🔍 [getTotalQRScans] User ads found:', userAds.length, userAds.map(ad => ({ id: ad._id, title: ad.title })));
      }
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          totalScans: 0,
          ads: []
        };
      }

      const userAdIds = userAds.map(ad => ad._id.toString());
      if (isVerbose) {
        console.log('🔍 [getTotalQRScans] User ad IDs:', userAdIds);
      }

      // ✅ If startDate and endDate are both null, fetch ALL-TIME data (no date filtering)
      // Otherwise use the provided date range
      const now = new Date();
      const isAllTime = startDate === null && endDate === null;
      const defaultStartDate = isAllTime ? null : (startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      const defaultEndDate = isAllTime ? null : (endDate || now);
      
      // ✅ Always log date range for debugging (not just verbose mode)
      console.log('🔍 [getTotalQRScans] Date range:', {
        isAllTime: isAllTime,
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        message: isAllTime ? 'ALL-TIME (no date filter)' : `Date range: ${defaultStartDate} to ${defaultEndDate}`
      });

      let totalScans = 0;
      const qrScansByAd = {};
      const qrScansByMaterial = {};

      // QRScanTracking is deprecated - QR scans are now in DeviceTracking and DeviceDataHistoryV2
      // Skip the deprecated QRScanTracking collection

      // QR scans are now processed from DeviceTracking and DeviceDataHistoryV2 below

      // ✅ Get Material documents and extract their materialId STRINGS (not ObjectIds)
      // ad.materialId is an array of Material ObjectId references
      // After populate, each element should be a Material document with materialId string field
      const Material = require('../models/Material');
      
      // Extract materialId strings from populated Material documents
      const materialIdStrings = new Set(); // Use Set to avoid duplicates
      const materialObjectIdsToFetch = []; // For materials that weren't populated
      
      for (const ad of userAds) {
        if (ad.materialId && Array.isArray(ad.materialId)) {
          for (const material of ad.materialId) {
            // If populated successfully, material is a Material document with materialId string
            if (material && material.materialId && typeof material.materialId === 'string') {
              materialIdStrings.add(material.materialId);
            } else if (material) {
              // If not populated (still ObjectId), collect for batch fetch
              const materialId = material._id || material;
              if (materialId && !materialObjectIdsToFetch.includes(materialId)) {
                materialObjectIdsToFetch.push(materialId);
              }
            }
          }
        }
      }
      
      // Batch fetch any materials that weren't populated
      if (materialObjectIdsToFetch.length > 0) {
        const materials = await Material.find({
          _id: { $in: materialObjectIdsToFetch },
          isArchived: { $ne: true }
        }).select('materialId').lean();
        
        materials.forEach(m => {
          if (m.materialId) {
            materialIdStrings.add(m.materialId);
          }
        });
      }
      
      const materialIds = Array.from(materialIdStrings);
      
      if (isVerbose) {
        console.log('🔍 [getTotalQRScans] Material ID strings extracted:', materialIds.length, materialIds);
        if (materialObjectIdsToFetch.length > 0) {
          console.log('🔍 [getTotalQRScans] Fetched', materialObjectIdsToFetch.length, 'materials that were not populated');
        }
      }

      // Get current day data from DeviceTracking (Philippines "today" - single source of truth)
      const today = getPhilippinesMidnight();
      const tomorrow = getPhilippinesMidnight(new Date(today.getTime() + 24 * 60 * 60 * 1000));
      
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });
      
      // ✅ Always log current day data for debugging
      console.log('🔍 [getTotalQRScans] Current day data found:', currentData.length, 'devices', {
        today: today.toISOString(),
        materialIds: materialIds.length,
        query: { materialId: { $in: materialIds }, date: { $gte: today, $lt: tomorrow } }
      });
      if (currentData.length > 0) {
        currentData.forEach((device, idx) => {
          console.log(`🔍 [getTotalQRScans] Current day device ${idx + 1}:`, {
            materialId: device.materialId,
            date: device.date,
            qrScansByAdCount: device.qrScansByAd?.length || 0,
            qrScansArrayLength: device.qrScans?.length || 0,
            qrScansByAd: device.qrScansByAd?.map(s => ({ adId: s.adId, adTitle: s.adTitle, scanCount: s.scanCount })) || []
          });
        });
      }

      // Process current day QR scans
      currentData.forEach((device, index) => {
        if (isVerbose) {
          console.log(`🔍 [getTotalQRScans] Processing current day device ${index + 1}/${currentData.length}:`, {
            materialId: device.materialId,
            hasQrScansByAd: !!device.qrScansByAd,
            qrScansByAdLength: device.qrScansByAd?.length || 0,
            hasQrScans: !!device.qrScans,
            qrScansLength: device.qrScans?.length || 0
          });
        }
        
        // ✅ Method 1: Process qrScansByAd (aggregated data) if available
        const hasQrScansByAd = device.qrScansByAd && device.qrScansByAd.length > 0;
        // ✅ Track which ads were found in qrScansByAd to avoid double-counting
        const adsFoundInQrScansByAd = new Set();
        
        if (hasQrScansByAd) {
          device.qrScansByAd.forEach(adScan => {
            // ✅ Normalize adId to string for consistent matching
            const normalizedAdId = adScan.adId ? adScan.adId.toString() : '';
            
            if (isVerbose) {
              console.log(`🔍 [getTotalQRScans] Checking QR scan from qrScansByAd:`, {
                normalizedAdId,
                adTitle: adScan.adTitle,
                scanCount: adScan.scanCount,
                isInUserAdIds: userAdIds.includes(normalizedAdId)
              });
            }
            
            if (normalizedAdId && userAdIds.includes(normalizedAdId)) {
              adsFoundInQrScansByAd.add(normalizedAdId); // Track that this ad was found in qrScansByAd
              
              if (!qrScansByAd[normalizedAdId]) {
                qrScansByAd[normalizedAdId] = {
                  adId: normalizedAdId, // ✅ Store as normalized string
                  adTitle: adScan.adTitle,
                  totalScans: 0,
                  firstScanned: adScan.firstScanned,
                  lastScanned: adScan.lastScanned,
                  scans: []
                };
              }
              
              // ✅ CRITICAL FIX: Validate scanCount against actual array count BEFORE adding
              // This prevents using incorrect scanCount values
              let scanCountToAdd = adScan.scanCount || 0;
              
              // If qrScans array exists, count actual scans to validate
              if (device.qrScans && device.qrScans.length > 0) {
                const actualArrayCount = device.qrScans.filter(scan => {
                  const scanAdId = scan.adId ? scan.adId.toString() : '';
                  const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                  return scanAdId === normalizedAdId && belongsToUser;
                }).length;
                
                // ✅ FIX: Always use array count if it exists (more accurate than scanCount field)
                // The array is the source of truth - scanCount field can be stale or incorrect
                if (actualArrayCount > 0) {
                  if (actualArrayCount !== scanCountToAdd) {
                    console.log(`🔧 [getTotalQRScans] REPAIR Current Day: Ad "${adScan.adTitle}" (${normalizedAdId}) - scanCount was ${scanCountToAdd}, but array has ${actualArrayCount}. Using array count (source of truth).`);
                  }
                  scanCountToAdd = actualArrayCount; // Always use array count when available
                } else if (scanCountToAdd > 0) {
                  // If array is empty but scanCount > 0, log a warning but use scanCount (might be valid if array was cleared)
                  console.log(`⚠️ [getTotalQRScans] Current Day: Ad "${adScan.adTitle}" (${normalizedAdId}) - scanCount is ${scanCountToAdd} but array is empty. Using scanCount.`);
                }
              }
              
              const previousTotal = qrScansByAd[normalizedAdId].totalScans || 0;
              qrScansByAd[normalizedAdId].totalScans += scanCountToAdd;
              totalScans += scanCountToAdd;
              
              if (isVerbose || scanCountToAdd > 0) {
                console.log(`✅ [getTotalQRScans] Current day: Ad "${adScan.adTitle}" (${normalizedAdId}): +${scanCountToAdd} scans (total: ${qrScansByAd[normalizedAdId].totalScans})`);
              }
            }
            // ✅ Removed warning log - skipping scans is expected behavior when filtering by user
          });
        }
        
        // ✅ FIX: Method 2: Process qrScans (individual records) for ads NOT found in qrScansByAd
        // This ensures we count scans for ads that exist in the array but not in qrScansByAd
        // Example: If qrScansByAd has FREDDIE but not EFFICASCENT, we still count EFFICASCENT from the array
        if (device.qrScans && device.qrScans.length > 0) {
          // Only process if qrScansByAd is empty OR if there are ads in the array that aren't in qrScansByAd
          const shouldProcessArray = !hasQrScansByAd || adsFoundInQrScansByAd.size === 0;
          
          if (shouldProcessArray || adsFoundInQrScansByAd.size < userAdIds.length) {
            if (isVerbose || !hasQrScansByAd) {
              console.log(`🔍 [getTotalQRScans] Processing ${device.qrScans.length} individual QR scan records for current day (qrScansByAd had ${adsFoundInQrScansByAd.size} ads, looking for missing ads)`);
            }
            
            device.qrScans.forEach(qrScan => {
              // ✅ Filter by userId AND check if adId belongs to user's ads
              const normalizedAdId = qrScan.adId ? qrScan.adId.toString() : '';
              const belongsToUser = qrScan.userId === userId.toString() || (normalizedAdId && userAdIds.includes(normalizedAdId));
              
              // ✅ CRITICAL FIX: Only process if this ad was NOT found in qrScansByAd (to avoid double-counting)
              // If qrScansByAd exists and has this ad, skip it (already counted above)
              const adAlreadyCounted = hasQrScansByAd && adsFoundInQrScansByAd.has(normalizedAdId);
              
              if (belongsToUser && normalizedAdId && !adAlreadyCounted) {
                if (!qrScansByAd[normalizedAdId]) {
                  // Try to get ad title from userAds
                  const ad = userAds.find(a => a._id.toString() === normalizedAdId);
                  qrScansByAd[normalizedAdId] = {
                    adId: normalizedAdId,
                    adTitle: ad?.title || 'Unknown',
                    totalScans: 0,
                    firstScanned: qrScan.scannedAt || qrScan.timestamp || null,
                    lastScanned: qrScan.scannedAt || qrScan.timestamp || null,
                    scans: []
                  };
                }
                qrScansByAd[normalizedAdId].totalScans += 1; // Count individual scans
                totalScans += 1;
                
                // Update first/last scanned timestamps
                const scanTime = qrScan.scannedAt || qrScan.timestamp;
                if (scanTime) {
                  if (!qrScansByAd[normalizedAdId].firstScanned || new Date(scanTime) < new Date(qrScansByAd[normalizedAdId].firstScanned)) {
                    qrScansByAd[normalizedAdId].firstScanned = scanTime;
                  }
                  if (!qrScansByAd[normalizedAdId].lastScanned || new Date(scanTime) > new Date(qrScansByAd[normalizedAdId].lastScanned)) {
                    qrScansByAd[normalizedAdId].lastScanned = scanTime;
                  }
                }
                
                if (isVerbose || (!hasQrScansByAd && qrScansByAd[normalizedAdId].totalScans <= 5)) {
                  console.log(`✅ [getTotalQRScans] Current day (individual): Ad "${qrScansByAd[normalizedAdId].adTitle}" (${normalizedAdId}): +1 scan (total: ${qrScansByAd[normalizedAdId].totalScans})`);
                }
              }
              // ✅ Removed warning log - skipping scans is expected behavior when filtering by user
            });
          } else if (hasQrScansByAd && isVerbose) {
            console.log(`⏭️ [getTotalQRScans] Skipping qrScans array processing for current day - all user ads already found in qrScansByAd`);
          }
        }
        // ✅ Removed warning log - empty QR scan data is expected for many devices
      });

      // Get historical data from DeviceDataHistoryV2
      // ✅ If all-time, don't filter by date (get all historical data)
      const historicalQuery = {
        materialId: { $in: materialIds }
      };
      
      // Only add date filter if NOT all-time
      if (!isAllTime && defaultStartDate && defaultEndDate) {
        historicalQuery['dailyData.date'] = {
          $gte: new Date(defaultStartDate),
          $lte: new Date(defaultEndDate)
        };
      }
      
      // ✅ Always log historical query for debugging
      console.log('🔍 [getTotalQRScans] Historical query:', JSON.stringify(historicalQuery, null, 2));
      console.log('🔍 [getTotalQRScans] Material IDs to search:', materialIds.length, materialIds);
      
      const historicalData = await DeviceDataHistoryV2.find(historicalQuery);
      
      // ✅ Always log historical data found
      console.log('🔍 [getTotalQRScans] Historical data found:', historicalData.length, 'devices');
      if (historicalData.length > 0) {
        console.log('🔍 [getTotalQRScans] Historical devices:', historicalData.map(d => ({
          materialId: d.materialId,
          dailyDataCount: d.dailyData?.length || 0
        })));
      }

      // Process historical QR scans
      historicalData.forEach((archive, archiveIndex) => {
        console.log(`🔍 [getTotalQRScans] Processing historical archive ${archiveIndex + 1}/${historicalData.length}:`, {
          materialId: archive.materialId,
          dailyDataLength: archive.dailyData?.length || 0
        });
        
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach((dailyData, dailyIndex) => {
            // ✅ Always exclude today's date from historical data to avoid double-counting
            // Current day data (DeviceTracking) already includes today, so we don't want to count it again from historical data
            const dailyDate = new Date(dailyData.date);
            // ✅ FIX: Use Philippine timezone for "today" comparison to match data storage
            const today = new Date();
            // Convert to Philippine time (UTC+8)
            const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
            const phTime = new Date(today.getTime() + phOffset);
            phTime.setUTCHours(0, 0, 0, 0);
            
            const dailyDateOnly = new Date(dailyDate);
            dailyDateOnly.setUTCHours(0, 0, 0, 0);
            
            // Compare dates as strings (YYYY-MM-DD) to avoid timezone issues
            const todayStr = phTime.toISOString().split('T')[0];
            const dailyDateStr = dailyDateOnly.toISOString().split('T')[0];
            const isToday = dailyDateStr === todayStr;
            
            // ✅ FIX: Include today from historical data if current day data wasn't found
            // This ensures today's scans are counted even if DeviceTracking query fails or hasn't been archived yet
            let shouldProcess = false;
            if (isToday) {
              // ✅ FIX: Include today from historical data if current day data wasn't found
              // This prevents missing today's scans when DeviceTracking query returns 0 devices
              shouldProcess = currentData.length === 0; // Only skip if we found current day data
              
              if (!shouldProcess) {
                console.log(`⏭️ [getTotalQRScans] Skipping today's date in historical data (current day data found): ${dailyData.date} (today: ${todayStr}, daily: ${dailyDateStr})`);
              } else {
                console.log(`✅ [getTotalQRScans] Including today's date from historical data (no current day data found): ${dailyData.date} (today: ${todayStr}, daily: ${dailyDateStr})`);
              }
            } else if (isAllTime) {
              shouldProcess = true; // Process all historical dates except today (if current day data exists)
            } else if (defaultStartDate && defaultEndDate) {
              shouldProcess = dailyDate >= new Date(defaultStartDate) && dailyDate <= new Date(defaultEndDate);
            }
            
            // ✅ Always log daily data processing for debugging
            console.log(`🔍 [getTotalQRScans] Daily data ${dailyIndex + 1}:`, {
              date: dailyData.date,
              isToday: isToday,
              shouldProcess,
              hasQrScansByAd: !!dailyData.qrScansByAd,
              qrScansByAdLength: dailyData.qrScansByAd?.length || 0,
              qrScansByAd: dailyData.qrScansByAd?.map(s => ({ adId: s.adId, adTitle: s.adTitle, scanCount: s.scanCount })) || [],
              hasQrScans: !!dailyData.qrScans,
              qrScansLength: dailyData.qrScans?.length || 0
            });
            
            // ✅ Only log daily data processing in verbose mode
            if (isVerbose && shouldProcess) {
              console.log(`🔍 [getTotalQRScans] Daily data ${dailyIndex + 1}:`, {
                date: dailyData.date,
                isToday: isToday,
                shouldProcess,
                hasQrScansByAd: !!dailyData.qrScansByAd,
                qrScansByAdLength: dailyData.qrScansByAd?.length || 0,
                hasQrScans: !!dailyData.qrScans,
                qrScansLength: dailyData.qrScans?.length || 0
              });
            }
            
            if (shouldProcess) {
              // ✅ Method 1: Process qrScansByAd (aggregated data) if available
              const hasDailyQrScansByAd = dailyData.qrScansByAd && dailyData.qrScansByAd.length > 0;
              // ✅ Track which ads were found in qrScansByAd to avoid double-counting
              const adsFoundInQrScansByAd = new Set();
              
              if (hasDailyQrScansByAd) {
                dailyData.qrScansByAd.forEach(adScan => {
                  // ✅ Normalize adId to string for consistent matching
                  const normalizedAdId = adScan.adId ? adScan.adId.toString() : '';
                  
                  if (normalizedAdId && userAdIds.includes(normalizedAdId)) {
                    adsFoundInQrScansByAd.add(normalizedAdId); // Track that this ad was found in qrScansByAd
                    
                    if (!qrScansByAd[normalizedAdId]) {
                      qrScansByAd[normalizedAdId] = {
                        adId: normalizedAdId, // ✅ Store as normalized string
                        adTitle: adScan.adTitle,
                        totalScans: 0,
                        firstScanned: adScan.firstScanned,
                        lastScanned: adScan.lastScanned,
                        scans: []
                      };
                    }
                    
                    // ✅ CRITICAL FIX: Validate scanCount against actual array count for historical data too
                    let scanCountToAdd = adScan.scanCount || 0;
                    
                    // If qrScans array exists, count actual scans to validate
                    if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                      const actualArrayCount = dailyData.qrScans.filter(scan => {
                        const scanAdId = scan.adId ? scan.adId.toString() : '';
                        const belongsToUser = scan.userId === userId.toString() || (scanAdId && userAdIds.includes(scanAdId));
                        return scanAdId === normalizedAdId && belongsToUser;
                      }).length;
                      
                      // ✅ FIX: Always use array count if it exists (more accurate than scanCount field)
                      // The array is the source of truth - scanCount field can be stale or incorrect
                      if (actualArrayCount > 0) {
                        if (actualArrayCount !== scanCountToAdd) {
                          console.log(`🔧 [getTotalQRScans] REPAIR Historical: Ad "${adScan.adTitle}" (${normalizedAdId}) on ${dailyData.date} - scanCount was ${scanCountToAdd}, but array has ${actualArrayCount}. Using array count (source of truth).`);
                        }
                        scanCountToAdd = actualArrayCount; // Always use array count when available
                      } else if (scanCountToAdd > 0) {
                        // If array is empty but scanCount > 0, log a warning but use scanCount (might be valid if array was cleared)
                        console.log(`⚠️ [getTotalQRScans] Historical: Ad "${adScan.adTitle}" (${normalizedAdId}) on ${dailyData.date} - scanCount is ${scanCountToAdd} but array is empty. Using scanCount.`);
                      }
                    }
                    
                    const previousHistoricalTotal = qrScansByAd[normalizedAdId].totalScans || 0;
                    qrScansByAd[normalizedAdId].totalScans += scanCountToAdd;
                    totalScans += scanCountToAdd;
                    
                    if (isVerbose || scanCountToAdd > 0) {
                      console.log(`✅ [getTotalQRScans] Historical: Ad "${adScan.adTitle}" (${normalizedAdId}): +${scanCountToAdd} scans on ${dailyData.date} (total: ${qrScansByAd[normalizedAdId].totalScans})`);
                    }
                  }
                  // ✅ Removed warning log - skipping scans is expected behavior when filtering by user
                });
              }
              
              // ✅ FIX: Method 2: Process qrScans (individual records) for ads NOT found in qrScansByAd
              // This ensures we count scans for ads that exist in the array but not in qrScansByAd
              // Example: If qrScansByAd has FREDDIE but not EFFICASCENT, we still count EFFICASCENT from the array
              if (dailyData.qrScans && dailyData.qrScans.length > 0) {
                // Only process if qrScansByAd is empty OR if there are ads in the array that aren't in qrScansByAd
                const shouldProcessArray = !hasDailyQrScansByAd || adsFoundInQrScansByAd.size === 0;
                
                if (shouldProcessArray || adsFoundInQrScansByAd.size < userAdIds.length) {
                  if (isVerbose || !hasDailyQrScansByAd) {
                    console.log(`🔍 [getTotalQRScans] Processing ${dailyData.qrScans.length} individual QR scan records for ${dailyData.date} (qrScansByAd had ${adsFoundInQrScansByAd.size} ads, looking for missing ads)`);
                  }
                  
                  dailyData.qrScans.forEach(qrScan => {
                    // ✅ Filter by userId AND check if adId belongs to user's ads
                    const normalizedAdId = qrScan.adId ? qrScan.adId.toString() : '';
                    const belongsToUser = qrScan.userId === userId.toString() || (normalizedAdId && userAdIds.includes(normalizedAdId));
                    
                    // ✅ CRITICAL FIX: Only process if this ad was NOT found in qrScansByAd (to avoid double-counting)
                    // If qrScansByAd exists and has this ad, skip it (already counted above)
                    const adAlreadyCounted = hasDailyQrScansByAd && adsFoundInQrScansByAd.has(normalizedAdId);
                    
                    if (belongsToUser && normalizedAdId && !adAlreadyCounted) {
                      if (!qrScansByAd[normalizedAdId]) {
                        // Try to get ad title from userAds
                        const ad = userAds.find(a => a._id.toString() === normalizedAdId);
                        qrScansByAd[normalizedAdId] = {
                          adId: normalizedAdId,
                          adTitle: ad?.title || 'Unknown',
                          totalScans: 0,
                          firstScanned: qrScan.scannedAt || qrScan.timestamp || dailyData.date,
                          lastScanned: qrScan.scannedAt || qrScan.timestamp || dailyData.date,
                          scans: []
                        };
                      }
                      qrScansByAd[normalizedAdId].totalScans += 1; // Count individual scans
                      totalScans += 1;
                      
                      // Update first/last scanned timestamps
                      const scanTime = qrScan.scannedAt || qrScan.timestamp || dailyData.date;
                      if (scanTime) {
                        if (!qrScansByAd[normalizedAdId].firstScanned || new Date(scanTime) < new Date(qrScansByAd[normalizedAdId].firstScanned)) {
                          qrScansByAd[normalizedAdId].firstScanned = scanTime;
                        }
                        if (!qrScansByAd[normalizedAdId].lastScanned || new Date(scanTime) > new Date(qrScansByAd[normalizedAdId].lastScanned)) {
                          qrScansByAd[normalizedAdId].lastScanned = scanTime;
                        }
                      }
                      
                      if (isVerbose || (!hasDailyQrScansByAd && qrScansByAd[normalizedAdId].totalScans <= 5)) {
                        console.log(`✅ [getTotalQRScans] Historical (individual): Ad "${qrScansByAd[normalizedAdId].adTitle}" (${normalizedAdId}): +1 scan on ${dailyData.date} (total: ${qrScansByAd[normalizedAdId].totalScans})`);
                      }
                    }
                    // ✅ Removed warning log - skipping scans is expected behavior when filtering by user
                  });
                } else if (hasDailyQrScansByAd && isVerbose) {
                  console.log(`⏭️ [getTotalQRScans] Skipping qrScans array processing for ${dailyData.date} - all user ads already found in qrScansByAd`);
                }
              }
              // ✅ Removed warning log - empty QR scan data is expected for many days
            }
          });
        }
        // ✅ Removed warning log - empty dailyData is expected for some archives
      });

      const finalAdsArray = Object.values(qrScansByAd);
      
      // ✅ Always log final results for debugging
      console.log('📊 [getTotalQRScans] Final results:', {
        totalScans: totalScans,
        adsCount: finalAdsArray.length,
        ads: finalAdsArray.map(ad => ({ 
          adId: ad.adId, 
          adTitle: ad.adTitle, 
          totalScans: ad.totalScans 
        })),
        isAllTime: isAllTime,
        currentDayDevicesProcessed: currentData.length,
        historicalDevicesProcessed: historicalData.length,
        qrScansByAdBreakdown: Object.keys(qrScansByAd).map(adId => ({
          adId,
          adTitle: qrScansByAd[adId].adTitle,
          totalScans: qrScansByAd[adId].totalScans
        }))
      });
      
      return {
        success: true,
        userId,
        totalScans,
        ads: finalAdsArray,
        materials: Object.values(qrScansByMaterial),
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        summary: {
          totalAds: Object.keys(qrScansByAd).length,
          averageScansPerAd: Object.keys(qrScansByAd).length > 0 ? totalScans / Object.keys(qrScansByAd).length : 0
        }
      };
    } catch (error) {
      console.error('Error getting total QR scans:', error);
      throw error;
    }
  }

  // Get active total materials for a specific user
  static async getActiveTotalMaterials(userId) {
    try {
      const Material = require('../models/Material');
      const Ad = require('../models/Ad');
      const DeviceTracking = require('../models/deviceTracking');
      const AdsDeployment = require('../models/adsDeployment');
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          materials: []
        };
      }

      // ✅ FIX: Get materials from AdsDeployment (current device assignments) instead of stale Ad.materialId
      // This ensures the "Today" map shows the actual devices where ads are currently deployed
      const materialIds = [];
      const materialDetails = [];
      
      // Get all adIds from user's ads
      const userAdIds = userAds.map(ad => ad._id);
      
      // Query AdsDeployment to find all materials where user's ads are currently deployed
      const activeDeployments = await AdsDeployment.find({
        'lcdSlots.adId': { $in: userAdIds },
        'lcdSlots.status': { $in: ['SCHEDULED', 'RUNNING'] },
        isArchived: { $ne: true }
      }).lean();
      
      console.log(`📱 [getActiveTotalMaterials] Found ${activeDeployments.length} active deployments for user ${userId}`);
      
      // Extract unique materialId strings and get their details
      const deployedMaterialIdStrings = [...new Set(activeDeployments.map(d => d.materialId))].filter(Boolean);
      
      if (deployedMaterialIdStrings.length > 0) {
        // Get material details for all deployed devices
        const materials = await Material.find({ materialId: { $in: deployedMaterialIdStrings } });
        materials.forEach(material => {
          if (material.materialId && !materialIds.includes(material.materialId)) {
            materialIds.push(material.materialId);
            materialDetails.push({
              materialId: material.materialId,
              materialName: material.materialName,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              category: material.category,
              status: material.status,
              assignedDate: material.assignedDate,
              mountedAt: material.mountedAt,
              dismountedAt: material.dismountedAt,
              driverId: material.driverId,
              location: material.location,
              ads: []
            });
          }
        });
        console.log(`📱 [getActiveTotalMaterials] Found ${materialIds.length} materials from AdsDeployment:`, materialIds);
      } else {
        // Fallback: If no active deployments found, use Ad.targetDevices/materialId as fallback
        console.log(`⚠️ [getActiveTotalMaterials] No active deployments found, falling back to Ad.materialId`);
        for (const ad of userAds) {
          if (ad.targetDevices && ad.targetDevices.length > 0) {
            const materials = await Material.find({ _id: { $in: ad.targetDevices } });
            materials.forEach(material => {
              if (material.materialId && !materialIds.includes(material.materialId)) {
                materialIds.push(material.materialId);
                materialDetails.push({
                  materialId: material.materialId,
                  materialName: material.materialName,
                  materialType: material.materialType,
                  vehicleType: material.vehicleType,
                  category: material.category,
                  status: material.status,
                  assignedDate: material.assignedDate,
                  mountedAt: material.mountedAt,
                  dismountedAt: material.dismountedAt,
                  driverId: material.driverId,
                  location: material.location,
                  ads: []
                });
              }
            });
          } else if (ad.materialId && ad.materialId.length > 0) {
            const materials = await Material.find({ _id: { $in: ad.materialId } });
            materials.forEach(material => {
              if (material && material.materialId && !materialIds.includes(material.materialId)) {
                materialIds.push(material.materialId);
                materialDetails.push({
                  materialId: material.materialId,
                  materialName: material.materialName,
                  materialType: material.materialType,
                  vehicleType: material.vehicleType,
                  category: material.category,
                  status: material.status,
                  assignedDate: material.assignedDate,
                  mountedAt: material.mountedAt,
                  dismountedAt: material.dismountedAt,
                  driverId: material.driverId,
                  location: material.location,
                  ads: []
                });
              }
            });
          }
        }
      }

      // Get current status from DeviceTracking (Philippines "today")
      const today = getPhilippinesMidnight();
      const tomorrow = getPhilippinesMidnight(new Date(today.getTime() + 24 * 60 * 60 * 1000));
      
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      // ✅ FIX: Get all material documents once to avoid repeated queries and fix ObjectId comparison
      // Material is already declared at the top of this function
      const materialDocsMap = new Map();
      const materialDocs = await Material.find({ materialId: { $in: materialIds } });
      materialDocs.forEach(doc => {
        materialDocsMap.set(doc.materialId, doc);
      });

      // Add current status and performance data
      for (const material of materialDetails) {
        const materialDoc = materialDocsMap.get(material.materialId);
        const materialObjectId = materialDoc ? materialDoc._id.toString() : null;
        
        const currentDevice = currentData.find(device => device.materialId === material.materialId);
        if (currentDevice) {
          // ✅ FIX: Convert GeoJSON coordinates [lng, lat] to { lat, lng } format
          let currentLocation = null;
          if (currentDevice.currentLocation && currentDevice.currentLocation.coordinates) {
            const [lng, lat] = currentDevice.currentLocation.coordinates;
            currentLocation = {
              lat: lat,
              lng: lng,
              timestamp: currentDevice.currentLocation.timestamp,
              speed: currentDevice.currentLocation.speed || 0,
              heading: currentDevice.currentLocation.heading || 0,
              accuracy: currentDevice.currentLocation.accuracy || 0,
              address: currentDevice.currentLocation.address || ''
            };
          } else if (currentDevice.currentLocation && currentDevice.currentLocation.lat) {
            // Already in the correct format
            currentLocation = currentDevice.currentLocation;
          }
          
          material.currentStatus = {
            isOnline: currentDevice.isOnline,
            lastSeen: currentDevice.lastSeen,
            currentLocation: currentLocation,
            totalAdPlays: currentDevice.totalAdPlays || 0,
            totalQRScans: currentDevice.totalQRScans || 0,
            totalAdPlayTime: currentDevice.totalAdPlayTime || 0,
            carGroupId: currentDevice.carGroupId,
            screenType: currentDevice.screenType,
            isDisplaying: currentDevice.isDisplaying,
            maintenanceMode: currentDevice.maintenanceMode
          };
        } else {
          material.currentStatus = {
            isOnline: false,
            lastSeen: null,
            currentLocation: null,
            totalAdPlays: 0,
            totalQRScans: 0,
            totalAdPlayTime: 0,
            carGroupId: null,
            screenType: null,
            isDisplaying: false,
            maintenanceMode: false
          };
        }

        // Add associated ads
        // ✅ FIX: Compare material._id (ObjectId) with targetDevice (ObjectId), not material.materialId (string)
        material.ads = userAds.filter(ad => {
          if (ad.targetDevices && ad.targetDevices.length > 0) {
            return ad.targetDevices.some(targetDevice => {
              // ✅ FIX: Compare ObjectId to ObjectId, not string to ObjectId
              return materialObjectId && materialObjectId === targetDevice.toString();
            });
          }
          // ✅ FIX: Also fix the materialId array comparison
          return ad.materialId && ad.materialId.some(materialId => 
            materialObjectId && materialObjectId === materialId.toString()
          );
        }).map(ad => ({
          adId: ad._id,
          adTitle: ad.title,
          adType: ad.adType,
          adFormat: ad.adFormat,
          status: ad.status,
          adStatus: ad.adStatus,
          durationDays: ad.durationDays,
          totalPrice: ad.totalPrice
        }));
      }

      // Calculate summary statistics
      const activeMaterials = materialDetails.filter(material => material.currentStatus.isOnline);
      const totalAdPlays = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalAdPlays, 0);
      const totalQRScans = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalQRScans, 0);
      const totalAdPlayTime = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalAdPlayTime, 0);

      return {
        success: true,
        userId,
        activeMaterials: activeMaterials.length,
        materials: materialDetails,
        summary: {
          totalAdPlays,
          totalQRScans,
          totalAdPlayTime,
          onlinePercentage: materialDetails.length > 0 ? (activeMaterials.length / materialDetails.length) * 100 : 0,
          averagePlaysPerMaterial: materialDetails.length > 0 ? totalAdPlays / materialDetails.length : 0,
          averageScansPerMaterial: materialDetails.length > 0 ? totalQRScans / materialDetails.length : 0
        }
      };
    } catch (error) {
      console.error('Error getting active total materials:', error);
      throw error;
    }
  }

  // Get total display time of ads for a specific user
  static async getTotalDisplayTime(userId, startDate = null, endDate = null) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived/deleted ads
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          totalDisplayTime: 0,
          ads: []
        };
      }

      // Get all materials associated with user's ads
      const materialIds = [];
      for (const ad of userAds) {
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          ad.targetDevices.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
            }
          });
        } else if (ad.materialId && ad.materialId.length > 0) {
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
          message: 'No materials found for this user',
          totalDisplayTime: 0,
          ads: []
        };
      }

      // Set default date range if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const defaultEndDate = endDate || now;

      let totalDisplayTime = 0;
      const displayTimeByAd = {};
      const displayTimeByMaterial = {};

      // Get current day data from DeviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });

      // Process current day data
      currentData.forEach(device => {
        if (device.adPerformance && device.adPerformance.length > 0) {
          device.adPerformance.forEach(adPerf => {
            // Only count display time for user's ads
            const userAd = userAds.find(ad => ad._id.toString() === adPerf.adId);
            if (userAd) {
              if (!displayTimeByAd[adPerf.adId]) {
                displayTimeByAd[adPerf.adId] = {
                  adId: adPerf.adId,
                  adTitle: adPerf.adTitle,
                  totalDisplayTime: 0,
                  totalPlays: 0,
                  averageDisplayTime: 0,
                  completionRate: 0,
                  firstPlayed: adPerf.firstPlayed,
                  lastPlayed: adPerf.lastPlayed,
                };
              }
              displayTimeByAd[adPerf.adId].totalDisplayTime += adPerf.totalViewTime || 0;
              displayTimeByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
              if (adPerf.lastPlayed > displayTimeByAd[adPerf.adId].lastPlayed) {
                displayTimeByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
              }
              totalDisplayTime += adPerf.totalViewTime || 0;
            }
          });
        }

        // Track by material
        if (!displayTimeByMaterial[device.materialId]) {
          displayTimeByMaterial[device.materialId] = {
            materialId: device.materialId,
            carGroupId: device.carGroupId,
            totalDisplayTime: 0,
            totalPlays: 0,
            ads: []
          };
        }
        displayTimeByMaterial[device.materialId].totalDisplayTime += device.totalAdPlayTime || 0;
        displayTimeByMaterial[device.materialId].totalPlays += device.totalAdPlays || 0;
      });

      // Get historical data from DeviceDataHistoryV2
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(defaultStartDate),
          $lte: new Date(defaultEndDate)
        }
      });

      // Process historical data
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(defaultStartDate) && dailyDate <= new Date(defaultEndDate)) {
              if (dailyData.adPerformance && dailyData.adPerformance.length > 0) {
                dailyData.adPerformance.forEach(adPerf => {
                  // Only count display time for user's ads
                  const userAd = userAds.find(ad => ad._id.toString() === adPerf.adId);
                  if (userAd) {
                    if (!displayTimeByAd[adPerf.adId]) {
                      displayTimeByAd[adPerf.adId] = {
                        adId: adPerf.adId,
                        adTitle: adPerf.adTitle,
                        totalDisplayTime: 0,
                        totalPlays: 0,
                        averageDisplayTime: 0,
                        completionRate: 0,
                        firstPlayed: adPerf.firstPlayed,
                        lastPlayed: adPerf.lastPlayed,
                      };
                    }
                    displayTimeByAd[adPerf.adId].totalDisplayTime += adPerf.totalViewTime || 0;
                    displayTimeByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
                    if (adPerf.lastPlayed > displayTimeByAd[adPerf.adId].lastPlayed) {
                      displayTimeByAd[adPerf.adId].lastPlayed = adPerf.lastPlayed;
                    }
                    totalDisplayTime += adPerf.totalViewTime || 0;
                  }
                });
              }

              // Track by material
              if (!displayTimeByMaterial[archive.materialId]) {
                displayTimeByMaterial[archive.materialId] = {
                  materialId: archive.materialId,
                  carGroupId: archive.carGroupId,
                  totalDisplayTime: 0,
                  totalPlays: 0,
                  ads: []
                };
              }
              displayTimeByMaterial[archive.materialId].totalDisplayTime += dailyData.totalAdPlayTime || 0;
              displayTimeByMaterial[archive.materialId].totalPlays += dailyData.totalAdPlays || 0;
            }
          });
        }
      });

      // Calculate averages for display time
      Object.values(displayTimeByAd).forEach(ad => {
        ad.averageDisplayTime = ad.totalPlays > 0 ? ad.totalDisplayTime / ad.totalPlays : 0;
        ad.completionRate = ad.totalDisplayTime > 0 ? (ad.totalDisplayTime / (ad.totalDisplayTime + (ad.totalPlays * 30))) * 100 : 0;
      });

      // Convert seconds to hours for better readability
      const totalDisplayTimeHours = totalDisplayTime / 3600;
      Object.values(displayTimeByAd).forEach(ad => {
        ad.totalDisplayTimeHours = ad.totalDisplayTime / 3600;
        ad.averageDisplayTimeHours = ad.averageDisplayTime / 3600;
      });
      Object.values(displayTimeByMaterial).forEach(material => {
        material.totalDisplayTimeHours = material.totalDisplayTime / 3600;
      });

      return {
        success: true,
        userId,
        totalDisplayTime,
        totalDisplayTimeHours,
        ads: Object.values(displayTimeByAd),
        materials: Object.values(displayTimeByMaterial),
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        summary: {
          totalAds: Object.keys(displayTimeByAd).length,
          averageDisplayTimePerAd: Object.keys(displayTimeByAd).length > 0 ? totalDisplayTimeHours / Object.keys(displayTimeByAd).length : 0,
          averageDisplayTimePerMaterial: Object.keys(displayTimeByMaterial).length > 0 ? totalDisplayTimeHours / Object.keys(displayTimeByMaterial).length : 0
        }
      };
    } catch (error) {
      console.error('Error getting total display time:', error);
      throw error;
    }
  }

  // Get analytics data for a specific device
  static async getDeviceAnalytics(deviceId, startDate = null, endDate = null, userId = null) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Material = require('../models/Material');
      const Ad = require('../models/Ad');
      
      // Find the material associated with this device
      const material = await Material.findOne({ materialId: deviceId });
      if (!material) {
        return {
          success: false,
          message: 'Device not found'
        };
      }

      // Set default date range if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const defaultEndDate = endDate || now;

      // Get current day data from DeviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.findOne({
        materialId: deviceId,
        date: currentDay
      });

      // Get historical data from DeviceDataHistoryV2
      const historicalData = await DeviceDataHistoryV2.findOne({
        materialId: deviceId,
        'dailyData.date': {
          $gte: new Date(defaultStartDate),
          $lte: new Date(defaultEndDate)
        }
      });

      // Get ads associated with this device
      let adsQuery = {
        $or: [
          { materialId: material._id },
          { targetDevices: material._id }
        ],
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      };

      // Filter by userId if provided (for user-specific device analytics)
      if (userId) {
        adsQuery.userId = userId;
      }

      const deviceAds = await Ad.find(adsQuery);

      // Process current day data
      let currentDayStats = {
        totalAdPlays: 0,
        totalQRScans: 0,
        totalAdPlayTime: 0,
        totalDistanceTraveled: 0,
        totalHoursOnline: 0,
        isOnline: false,
        currentLocation: null,
        lastSeen: null,
        adPerformance: [],
        qrScansByAd: []
      };

      if (currentData) {
        // Filter ad performance to only include user's ads
        const userAdIds = deviceAds.map(ad => ad._id.toString());
        const filteredAdPerformance = (currentData.adPerformance || []).filter(adPerf => 
          userAdIds.includes(adPerf.adId)
        );
        const filteredQrScansByAd = (currentData.qrScansByAd || []).filter(adScan => 
          userAdIds.includes(adScan.adId)
        );

        // Calculate user-specific QR scan total from filtered data
        const userQRScansTotal = filteredQrScansByAd.reduce((total, adScan) => total + (adScan.scanCount || 0), 0);

        currentDayStats = {
          totalAdPlays: currentData.totalAdPlays || 0,
          totalQRScans: userQRScansTotal, // ✅ Now only includes QR scans for user's ads
          totalAdPlayTime: currentData.totalAdPlayTime || 0,
          totalDistanceTraveled: currentData.totalDistanceTraveled || 0,
          totalHoursOnline: currentData.totalHoursOnline || 0,
          isOnline: currentData.isOnline || false,
          currentLocation: currentData.currentLocation,
          lastSeen: currentData.lastSeen,
          adPerformance: filteredAdPerformance,
          qrScansByAd: filteredQrScansByAd,
          currentAd: currentData.currentAd,
          slots: currentData.slots || [],
          networkStatus: currentData.networkStatus,
          complianceData: currentData.complianceData,
          isDisplaying: currentData.isDisplaying,
          maintenanceMode: currentData.maintenanceMode
        };
      }

      // Process historical data
      let historicalStats = {
        totalAdPlays: 0,
        totalQRScans: 0,
        totalAdPlayTime: 0,
        totalDistanceTraveled: 0,
        totalHoursOnline: 0,
        dailyData: [],
        adPerformance: [],
        qrScansByAd: []
      };

      if (historicalData && historicalData.dailyData) {
        historicalData.dailyData.forEach(dailyData => {
          const dailyDate = new Date(dailyData.date);
          if (dailyDate >= new Date(defaultStartDate) && dailyDate <= new Date(defaultEndDate)) {
            // Filter daily data to only include user's ads
            const filteredDailyAdPerformance = (dailyData.adPerformance || []).filter(adPerf => 
              deviceAds.some(ad => ad._id.toString() === adPerf.adId)
            );
            const filteredDailyQrScansByAd = (dailyData.qrScansByAd || []).filter(adScan => 
              deviceAds.some(ad => ad._id.toString() === adScan.adId)
            );
            
            // Calculate user-specific totals from filtered data
            const userDailyQRScans = filteredDailyQrScansByAd.reduce((total, adScan) => total + (adScan.scanCount || 0), 0);
            
            historicalStats.totalAdPlays += dailyData.totalAdPlays || 0;
            historicalStats.totalQRScans += userDailyQRScans; // ✅ Now only includes QR scans for user's ads
            historicalStats.totalAdPlayTime += dailyData.totalAdPlayTime || 0;
            historicalStats.totalDistanceTraveled += dailyData.totalDistanceTraveled || 0;
            historicalStats.totalHoursOnline += dailyData.totalHoursOnline || 0;

            historicalStats.dailyData.push({
              date: dailyData.date,
              totalAdPlays: dailyData.totalAdPlays || 0,
              totalQRScans: userDailyQRScans, // ✅ Now only includes QR scans for user's ads
              totalAdPlayTime: dailyData.totalAdPlayTime || 0,
              totalDistanceTraveled: dailyData.totalDistanceTraveled || 0,
              totalHoursOnline: dailyData.totalHoursOnline || 0,
              isDisplaying: dailyData.isDisplaying,
              maintenanceMode: dailyData.maintenanceMode,
              adPerformance: filteredDailyAdPerformance,
              qrScansByAd: filteredDailyQrScansByAd
            });

            // Aggregate ad performance
            if (dailyData.adPerformance) {
              dailyData.adPerformance.forEach(adPerf => {
                // Only process ads that belong to the user
                const userAd = deviceAds.find(ad => ad._id.toString() === adPerf.adId);
                if (userAd) {
                  const existingAd = historicalStats.adPerformance.find(ad => ad.adId === adPerf.adId);
                  if (existingAd) {
                    existingAd.playCount += adPerf.playCount || 0;
                    existingAd.totalViewTime += adPerf.totalViewTime || 0;
                    if (adPerf.lastPlayed > existingAd.lastPlayed) {
                      existingAd.lastPlayed = adPerf.lastPlayed;
                    }
                  } else {
                    historicalStats.adPerformance.push({
                      adId: adPerf.adId,
                      adTitle: adPerf.adTitle,
                      playCount: adPerf.playCount || 0,
                      totalViewTime: adPerf.totalViewTime || 0,
                      averageViewTime: adPerf.averageViewTime || 0,
                      completionRate: adPerf.completionRate || 0,
                      firstPlayed: adPerf.firstPlayed,
                      lastPlayed: adPerf.lastPlayed,
                    });
                  }
                }
              });
            }

            // Aggregate QR scans by ad
            if (dailyData.qrScansByAd) {
              dailyData.qrScansByAd.forEach(adScan => {
                // Only process QR scans for ads that belong to the user
                const userAd = deviceAds.find(ad => ad._id.toString() === adScan.adId);
                if (userAd) {
                  const existingScan = historicalStats.qrScansByAd.find(scan => scan.adId === adScan.adId);
                  if (existingScan) {
                    existingScan.scanCount += adScan.scanCount || 0;
                    if (adScan.lastScanned > existingScan.lastScanned) {
                      existingScan.lastScanned = adScan.lastScanned;
                    }
                  } else {
                    historicalStats.qrScansByAd.push({
                      adId: adScan.adId,
                      adTitle: adScan.adTitle,
                      scanCount: adScan.scanCount || 0,
                      lastScanned: adScan.lastScanned,
                      firstScanned: adScan.firstScanned
                    });
                  }
                }
              });
            }
          }
        });
      }

      // Calculate averages for ad performance
      historicalStats.adPerformance.forEach(ad => {
        ad.averageViewTime = ad.playCount > 0 ? ad.totalViewTime / ad.playCount : 0;
        ad.completionRate = ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.playCount * 30))) * 100 : 0;
      });

      // Calculate totals
      const totalAdPlays = currentDayStats.totalAdPlays + historicalStats.totalAdPlays;
      const totalQRScans = currentDayStats.totalQRScans + historicalStats.totalQRScans;
      const totalAdPlayTime = currentDayStats.totalAdPlayTime + historicalStats.totalAdPlayTime;
      const totalDistanceTraveled = currentDayStats.totalDistanceTraveled + historicalStats.totalDistanceTraveled;
      const totalHoursOnline = currentDayStats.totalHoursOnline + historicalStats.totalHoursOnline;

      return {
        success: true,
        deviceId,
        material: {
          materialId: material.materialId,
          materialName: material.materialName,
          materialType: material.materialType,
          vehicleType: material.vehicleType,
          category: material.category,
          status: material.status,
          driverId: material.driverId,
          location: material.location
        },
        currentDay: currentDayStats,
        historical: historicalStats,
        totals: {
          totalAdPlays,
          totalQRScans,
          totalAdPlayTime,
          totalAdPlayTimeHours: totalAdPlayTime / 3600,
          totalDistanceTraveled,
          totalHoursOnline,
          averagePlaysPerDay: historicalStats.dailyData.length > 0 ? totalAdPlays / historicalStats.dailyData.length : 0,
          averageScansPerDay: historicalStats.dailyData.length > 0 ? totalQRScans / historicalStats.dailyData.length : 0,
          averageDisplayTimePerDay: historicalStats.dailyData.length > 0 ? (totalAdPlayTime / 3600) / historicalStats.dailyData.length : 0
        },
        ads: deviceAds.map(ad => ({
          adId: ad._id,
          adTitle: ad.title,
          adType: ad.adType,
          adFormat: ad.adFormat,
          status: ad.status,
          adStatus: ad.adStatus,
          durationDays: ad.durationDays,
          totalPrice: ad.totalPrice
        })),
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        summary: {
          isOnline: currentDayStats.isOnline,
          lastSeen: currentDayStats.lastSeen,
          currentLocation: currentDayStats.currentLocation,
          totalAds: deviceAds.length,
          activeAds: deviceAds.filter(ad => ad.status === 'RUNNING').length,
          complianceStatus: currentDayStats.complianceData?.complianceStatus || 'PENDING',
          displayStatus: currentDayStats.isDisplaying ? 'ACTIVE' : 'INACTIVE',
          maintenanceMode: currentDayStats.maintenanceMode
        }
      };
    } catch (error) {
      console.error('Error getting device analytics:', error);
      throw error;
    }
  }

  // Get comprehensive analytics summary for a user
  static async getComprehensiveAnalytics(userId, startDate = null, endDate = null) {
    try {
      // Set default date range if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const defaultEndDate = endDate || now;

      // Get all analytics data in parallel
      const [
        adPlaysData,
        qrScansData,
        materialsData,
        displayTimeData
      ] = await Promise.all([
        this.getTotalAdPlays(userId, defaultStartDate, defaultEndDate),
        this.getTotalQRScans(userId, defaultStartDate, defaultEndDate),
        this.getActiveTotalMaterials(userId),
        this.getTotalDisplayTime(userId, defaultStartDate, defaultEndDate)
      ]);

      // Calculate conversion rates
      const totalImpressions = adPlaysData.totalPlays || 0;
      const totalQRScans = qrScansData.totalScans || 0;
      // qrScanConversionRate removed - no longer needed

      // Calculate engagement metrics
      const totalDisplayTimeHours = displayTimeData.totalDisplayTimeHours || 0;
      const averageEngagementTime = totalImpressions > 0 ? totalDisplayTimeHours / totalImpressions : 0;

      return {
        success: true,
        userId,
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        overview: {
          totalAdPlays: adPlaysData.totalPlays || 0,
          totalQRScans: qrScansData.totalScans || 0,
          totalDisplayTimeHours: totalDisplayTimeHours,
          activeMaterials: materialsData.activeMaterials || 0,
          totalAds: adPlaysData.summary?.totalAds || 0
        },
        metrics: {
          // qrScanConversionRate removed
          averageEngagementTimeHours: averageEngagementTime,
          averagePlaysPerAd: adPlaysData.summary?.averagePlaysPerAd || 0,
          averageScansPerAd: qrScansData.summary?.averageScansPerAd || 0,
          averageDisplayTimePerAd: displayTimeData.summary?.averageDisplayTimePerAd || 0,
          onlinePercentage: materialsData.summary?.onlinePercentage || 0
        },
        adPlays: adPlaysData,
        qrScans: qrScansData,
        materials: materialsData,
        displayTime: displayTimeData
      };
    } catch (error) {
      console.error('Error getting comprehensive analytics:', error);
      throw error;
    }
  }
}

module.exports = UserAnalyticsService;
