const mongoose = require('mongoose');
const UserAnalytics = require('../models/userAnalytics');

// Simple in-memory cache for analytics data
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL (increased from 30s for better performance)
const REALTIME_CACHE_TTL = 30 * 1000; // 30 seconds for real-time viewing (current day)

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
        console.log('📊 Cache hit for key:', cacheKey, isRealtimeView ? '(realtime)' : '(standard)');
        return cached.data;
      }
      analyticsCache.delete(cacheKey);
      console.log('📊 Cache expired for key:', cacheKey);
    }
    return null;
  }
  
  static setCachedData(cacheKey, data) {
    analyticsCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    console.log('📊 Cache set for key:', cacheKey);
  }
  
  static clearUserCache(userId) {
    for (const [key, value] of analyticsCache.entries()) {
      if (key.includes(`analytics_${userId}_`)) {
        analyticsCache.delete(key);
      }
    }
    console.log('📊 Cache cleared for user:', userId);
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
    console.log('📊 All cache cleared');
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
  static async getUserAnalytics(userId, startDate, endDate, period, adId = null) {
    try {
      console.log('📊 getUserAnalytics called with:', { userId, startDate, endDate, period, adId });
      
      // Check cache first (include adId in cache key so filtered queries have separate cache)
      const cacheKey = this.getCacheKey(userId, startDate, endDate, period, adId);
      
      // ✨ Detect if this is a real-time view (current day included)
      const now = new Date();
      const isRealtimeView = period === '1d' || 
                            period === '7d' || 
                            period === '30d' || 
                            (endDate && new Date(endDate).toDateString() === now.toDateString()) ||
                            (!endDate && !period); // Default queries include today
      
      const cachedData = this.getCachedData(cacheKey, isRealtimeView);
      if (cachedData) {
        console.log('📊 Returning cached data for cache key:', cacheKey);
        return cachedData;
      }
      
      // Check if we should return cumulative totals (for "All Devices" view)
      // For 'all' period, we want to use the same logic as other periods but with wide date range
      const shouldReturnCumulative = !period || period === 'cumulative';
      const isAllPeriod = period === 'all';
      console.log('🔍 Period analysis:', {
        period: period,
        shouldReturnCumulative: shouldReturnCumulative,
        periodType: typeof period,
        periodValue: JSON.stringify(period)
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
        // Calculate based on period (using calendar days in UTC, not rolling windows)
        switch (period) {
          case '1d':
            // Today only (from midnight UTC to now)
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
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
      
      // ✅ Get user's first ad creation date for accurate "all time" completion rate calculation
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
            // Use first ad creation date as start date for accurate completion rate
            if (isAllPeriod || shouldReturnCumulative) {
              defaultStartDate = firstAdCreationDate;
              console.log('📅 Using user\'s first ad creation date for completion rate:', firstAdCreationDate);
            }
          } else {
            console.log('⚠️ No ads found for user, using default start date');
          }
        } catch (error) {
          console.warn('⚠️ Error fetching user\'s first ad date, using default:', error.message);
        }
      }
      
      // Store filtered totals from sync result for use in summary
      let filteredTotals = null;
      
      if (shouldReturnCumulative) {
        // For "All Devices" view, check cache first for performance
        console.log('📊 Cumulative query for "All Devices" view - checking cache first');
        
        // ✅ PERFORMANCE FIX: Check cache before expensive sync
        const cumulativeCacheKey = this.getCacheKey(userId, defaultStartDate, defaultEndDate, 'cumulative', null);
        const cachedCumulativeData = this.getCachedData(cumulativeCacheKey);
        
        if (cachedCumulativeData) {
          console.log('✅ Using cached cumulative data (FAST PATH - no database query)');
          console.log('📊 Cache hit! Returning data instantly');
          return cachedCumulativeData;
        }
        
        console.log('📊 Cache miss - syncing fresh data from DeviceDataHistoryV2');
        console.log('📊 Data source: DeviceDataHistoryV2 (fresh data, not cached UserAnalytics)');
        
        // Only sync if cache miss
        const syncResult = await this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate);
        console.log('🔍 Fresh sync result for "All Devices":', {
          success: syncResult.success,
          hasData: !!syncResult.data,
          message: syncResult.message
        });
        
        if (syncResult.success && syncResult.data) {
          // ✅ Use fresh synced totals (real-time data from DeviceTracking/DeviceDataHistoryV2)
          console.log('📊 [SYNC-ALL] Full syncResult.data for cumulative:', {
            totalAdPlays: syncResult.data.totalAdPlays,
            totalAdPlayTime: syncResult.data.totalAdPlayTime,
            totalQRScans: syncResult.data.totalQRScans,
            totalMaterials: syncResult.data.totalMaterials,
            totalDevices: syncResult.data.totalDevices,
            dataKeys: Object.keys(syncResult.data || {})
          });
          
          filteredTotals = {
            totalAdPlays: syncResult.data.totalAdPlays || 0,
            totalAdPlayTime: syncResult.data.totalAdPlayTime || 0,
            totalQRScans: syncResult.data.totalQRScans || 0,
            totalMaterials: syncResult.data.totalMaterials || 0,
            totalDevices: syncResult.data.totalDevices || 0
          };
          
          console.log('📊 [SYNC-ALL] Fresh DeviceDataHistoryV2 totals (REAL-TIME DATA):', filteredTotals);
          console.log('📊 [SYNC-ALL] Fresh Completion Rate:', syncResult.data.averageAdCompletionRate || 0);
          console.log('📊 [SYNC-ALL] Fresh QR Conversion Rate:', syncResult.data.qrScanConversionRate || 0);
          
          // ✅ PERFORMANCE FIX: Cache the result for next time
          // Build the full response and cache it
          const dataToCache = {
            success: true,
            data: syncResult.data
          };
          this.setCachedData(cumulativeCacheKey, dataToCache);
          console.log('✅ Cached cumulative data for 5 minutes');
        } else {
          // Fallback to UserAnalytics if sync fails
        filteredTotals = {
          totalAdPlays: userAnalytics.totalAdPlays || 0,
          totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
          totalQRScans: userAnalytics.totalQRScans || 0,
          totalMaterials: userAnalytics.totalMaterials || 0,
          totalDevices: userAnalytics.totalDevices || 0
        };
          console.log('⚠️ Fallback to UserAnalytics data:', filteredTotals);
        }
      } else {
        // For 30d queries, skip expensive sync and use optimized aggregation directly
        const daysDiff = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24));
        const shouldSkipSync = daysDiff > 14; // Skip sync for queries > 14 days
        
        let syncResult;
        
        if (shouldSkipSync) {
          console.log(`⚡ Large date range detected (${daysDiff} days), skipping sync and using optimized aggregation directly`);
          syncResult = { 
            success: false, 
            message: 'Large date range - using optimized query directly',
            useFallback: true 
          };
        } else {
          // For smaller date ranges, try sync with aggressive timeout
          console.log('🔄 Syncing UserAnalytics with fresh data from DeviceDataHistoryV2...');
          console.log('📊 UserAnalytics before sync:', {
            totalAdPlays: userAnalytics.totalAdPlays,
            totalQRScans: userAnalytics.totalQRScans,
            averageAdCompletionRate: userAnalytics.averageAdCompletionRate
          });
          
          try {
            // Aggressive timeout for sync (10 seconds max)
            syncResult = await Promise.race([
              this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate, adId),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sync timeout - using optimized query instead')), 10000)
              )
            ]);
            
            console.log('🔍 Sync result received:', {
              success: syncResult.success,
              hasData: !!syncResult.data,
              message: syncResult.message,
              adIdFilter: adId || 'none (all ads)'
            });
          } catch (timeoutError) {
            console.warn('⚠️ Sync timeout or error, falling back to optimized aggregation:', timeoutError.message);
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
          console.log('✅ UserAnalytics synced successfully');
          console.log('📊 UserAnalytics after sync:', {
            totalAdPlays: userAnalytics.totalAdPlays,
            totalQRScans: userAnalytics.totalQRScans,
            averageAdCompletionRate: userAnalytics.averageAdCompletionRate
          });
          
          // Refresh the userAnalytics with synced data - fetch directly from DB
          const UserAnalytics = require('../models/userAnalytics');
          userAnalytics = await UserAnalytics.findOne({ userId });
          console.log('✅ UserAnalytics reloaded from DB after sync');
          console.log('🔍 UserAnalytics ads count:', userAnalytics?.ads?.length || 0);
          
          // ✅ Get the filtered totals from the sync result (real-time data from DeviceTracking/DeviceDataHistoryV2)
          // IMPORTANT: syncResult.data contains the processed data from fetchAndUpdateUserAnalyticsFromHistory
          // which includes totalAdPlays, etc. from DeviceDataHistoryV2
          console.log('📊 [SYNC] Full syncResult.data:', {
            totalAdPlays: syncResult.data?.totalAdPlays,
            totalAdPlayTime: syncResult.data?.totalAdPlayTime,
            totalQRScans: syncResult.data?.totalQRScans,
            totalMaterials: syncResult.data?.totalMaterials,
            totalDevices: syncResult.data?.totalDevices,
            adsCount: syncResult.data?.ads?.length,
            hasData: !!syncResult.data,
            dataKeys: syncResult.data ? Object.keys(syncResult.data) : []
          });
          
          filteredTotals = {
            totalAdPlays: syncResult.data?.totalAdPlays || 0,
            totalAdPlayTime: syncResult.data?.totalAdPlayTime || 0,
            totalQRScans: syncResult.data?.totalQRScans || 0,
            totalMaterials: syncResult.data?.totalMaterials || 0,
            totalDevices: syncResult.data?.totalDevices || 0
          };
          
          console.log('📊 [SYNC] Filtered totals extracted from sync result (REAL-TIME DATA):', filteredTotals);
        } else {
          console.log('⚠️ Sync failed or timed out, using optimized aggregation fallback:', syncResult.message);
          
          // Fallback: Use the optimized aggregation pipeline directly
          try {
            const deviceStats = await this.getDeviceStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
            
            if (deviceStats && deviceStats.calculatedSummary) {
              filteredTotals = {
                totalAdPlays: deviceStats.calculatedSummary.totalAdPlays || 0,
                totalAdPlayTime: deviceStats.calculatedSummary.totalAdPlayTime || 0,
                totalQRScans: deviceStats.calculatedSummary.totalQRScans || 0,
                totalMaterials: deviceStats.calculatedSummary.totalMaterials || 0,
                totalDevices: deviceStats.calculatedSummary.totalDevices || 0
              };
              console.log('✅ Fallback aggregation succeeded:', filteredTotals);
            } else {
              console.log('⚠️ Fallback aggregation returned no data, using existing UserAnalytics');
              filteredTotals = {
                totalAdPlays: userAnalytics.totalAdPlays || 0,
                totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
                totalQRScans: userAnalytics.totalQRScans || 0,
                totalMaterials: userAnalytics.totalMaterials || 0,
                totalDevices: userAnalytics.totalDevices || 0
              };
            }
          } catch (fallbackError) {
            console.error('❌ Fallback aggregation failed:', fallbackError.message);
            // Final fallback: use existing userAnalytics data
            filteredTotals = {
              totalAdPlays: userAnalytics.totalAdPlays || 0,
              totalAdPlayTime: userAnalytics.totalAdPlayTime || 0,
              totalQRScans: userAnalytics.totalQRScans || 0,
              totalMaterials: userAnalytics.totalMaterials || 0,
              totalDevices: userAnalytics.totalDevices || 0
            };
          }
        }
      }

      // For "all" period, sync with fresh data to get accurate QR scans
      if (isAllPeriod) {
        console.log('📊 Syncing data for "all" period');
        
        try {
          // Add timeout wrapper for "all" period sync too
          const syncResult = await Promise.race([
            this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('All period sync timeout')), 25000)
            )
          ]);
          
          if (syncResult && syncResult.success && syncResult.data) {
            // ✅ Validate that syncResult.data has actual play data (not all zeros)
            // This prevents using failed syncs that return success but with empty data
            const hasValidData = syncResult.data.totalAdPlays > 0 || 
                                (syncResult.data.totalMaterials > 0 && syncResult.data.totalDevices > 0);
            
            if (hasValidData) {
              // ✅ Extract filteredTotals from syncResult.data (real-time data from DeviceDataHistoryV2)
              // This ensures the summary calculation uses the processed totals (9 plays, etc.)
              console.log('📊 [SYNC-ALL] Full syncResult.data for "all" period:', {
                totalAdPlays: syncResult.data.totalAdPlays,
                totalAdPlayTime: syncResult.data.totalAdPlayTime,
                totalQRScans: syncResult.data.totalQRScans,
                totalMaterials: syncResult.data.totalMaterials,
                totalDevices: syncResult.data.totalDevices,
                dataKeys: Object.keys(syncResult.data || {})
              });
              
              // ✅ Extract filteredTotals from sync result (real-time data from DeviceTracking/DeviceDataHistoryV2)
              filteredTotals = {
                totalAdPlays: syncResult.data.totalAdPlays || 0,
                totalAdPlayTime: syncResult.data.totalAdPlayTime || 0,
                totalQRScans: syncResult.data.totalQRScans || 0,
                totalMaterials: syncResult.data.totalMaterials || 0,
                totalDevices: syncResult.data.totalDevices || 0
              };
              
              console.log('📊 [SYNC-ALL] Extracted filteredTotals from sync result (REAL-TIME DATA):', filteredTotals);
              
              // Refresh the userAnalytics with synced data - fetch directly from DB
              const UserAnalytics = require('../models/userAnalytics');
              userAnalytics = await UserAnalytics.findOne({ userId });
              console.log('✅ UserAnalytics synced successfully for "all" period');
              console.log('🔍 UserAnalytics ads:', userAnalytics.ads.map(ad => ({ adId: ad.adId, totalQRScans: ad.totalQRScans })));
            } else {
              console.warn('⚠️ Sync returned success but with no valid play data (all zeros), skipping filteredTotals extraction');
            }
          } else {
            console.warn('⚠️ Sync failed or returned no data, skipping filteredTotals extraction');
          }
        } catch (timeoutError) {
          console.warn('⚠️ All period sync timeout or error, continuing with existing data:', timeoutError.message);
          // Continue with existing userAnalytics data
          // ✅ Don't set filteredTotals if sync failed - we'll use userAnalytics data instead
          // This prevents overwriting good data with zeros from a failed sync
        }
      }

      // Don't filter ads by date for dropdown display - we want ALL active paid ads to show
      // The date filter should only apply to the data aggregation, not which ads appear
      // Always fetch ALL user's ads for the dropdown, regardless of adId filter
      // ✅ Exclude archived and rejected ads from the count
      const Ad = require('../models/Ad');
      
      const allUserAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        isArchived: false,  // ✅ Exclude archived ads
        status: { $nin: ['REJECTED', 'ARCHIVED'] }  // ✅ Exclude rejected and archived status
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
            totalMaterials: 0,
            totalDevices: 0,
            totalAdPlayTime: 0,
            totalQRScans: 0,
            averageAdCompletionRate: 0,
            qrScanConversionRate: 0,
            isActive: true,
            materials: []
          });
        }
      });

      // Format data for GraphQL schema
      // IMPORTANT: adPerformance array contains ALL user's ads (for dropdown)
      //            but summary totals are filtered by adId if provided
      // ✅ Initialize summary with defaults - will be updated by summary calculation logic below
      const data = {
        summary: {
          // Default values - will be overridden by summary calculation logic after deviceStats is populated
          totalAdsPlayed: (filteredTotals && filteredTotals.totalAdPlays !== undefined)
            ? filteredTotals.totalAdPlays
            : ((userAnalytics.summary && userAnalytics.summary.totalAdPlays) || userAnalytics.totalAdPlays || 0),
          totalDisplayTime: (filteredTotals && filteredTotals.totalAdPlayTime !== undefined)
            ? filteredTotals.totalAdPlayTime
            : ((userAnalytics.summary && userAnalytics.summary.totalAdPlayTime) || userAnalytics.totalAdPlayTime || 0),
          averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
          totalAds: filteredAds ? filteredAds.length : 0,
          activeAds: filteredAds ? filteredAds.filter(ad => ad.isActive).length : 0,
          totalMaterials: (filteredTotals && filteredTotals.totalMaterials !== undefined)
            ? filteredTotals.totalMaterials
            : (userAnalytics.totalMaterials || 0),
          totalDevices: (filteredTotals && filteredTotals.totalDevices !== undefined)
            ? filteredTotals.totalDevices
            : ((userAnalytics.summary && userAnalytics.summary.totalDevices) || userAnalytics.totalDevices || 0),
          totalQRScans: (filteredTotals && filteredTotals.totalQRScans !== undefined)
            ? filteredTotals.totalQRScans
            : ((userAnalytics.summary && userAnalytics.summary.totalQRScans) || userAnalytics.totalQRScans || 0),
          qrScanConversionRate: userAnalytics.qrScanConversionRate || 0
        },
        adPerformance: (filteredAds && filteredAds.length > 0) ? filteredAds.map(ad => ({
          adId: ad.adId ? ad.adId.toString() : '',
          adTitle: ad.adTitle || '',
          totalMaterials: ad.totalMaterials || 0,
          totalDevices: ad.totalDevices || 0,
          totalAdPlayTime: ad.totalAdPlayTime || 0,
          totalQRScans: ad.totalQRScans || 0,
          averageAdCompletionRate: ad.averageAdCompletionRate || 0,
          qrScanConversionRate: ad.qrScanConversionRate || 0,
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
        })) : [], // Always use userAnalytics.ads for consistency
        dailyStats: Array.isArray(userAnalytics.dailyStats) && shouldReturnCumulative ? userAnalytics.dailyStats : [],
        deviceStats: [], // Will be populated from DeviceDataHistoryV2
        period: shouldReturnCumulative ? 'all' : (isAllPeriod ? 'all' : (period || '7d')),
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        lastUpdated: userAnalytics.lastUpdated || new Date().toISOString(),
        isActive: userAnalytics.isActive !== undefined ? userAnalytics.isActive : true
      };

      // Always get device stats for the dropdown, regardless of period
      if (defaultStartDate && defaultEndDate) {
        const deviceStats = await this.getDeviceStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
        data.deviceStats = deviceStats;
        console.log('📊 Device stats populated:', deviceStats.length, 'devices found', adId ? `(filtered by adId: ${adId})` : '(all ads)');
        
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
          totalMaterials: data.deviceStats.length,
          totalAds: data.adPerformance ? data.adPerformance.length : 0,
          activeAds: data.adPerformance ? data.adPerformance.length : 0
        };
        
        console.log('📊 [Summary] Calculating from deviceStats:', {
          deviceStatsCount: data.deviceStats.length,
          calculatedSummary
        });
        
        // Override filteredTotals with calculated values from deviceStats (this is the most accurate data!)
        filteredTotals = {
          totalAdPlays: calculatedSummary.totalAdsPlayed,
          totalAdPlayTime: calculatedSummary.totalDisplayTime,
          totalQRScans: calculatedSummary.totalQRScans,
          totalDevices: calculatedSummary.totalDevices,
          totalMaterials: calculatedSummary.totalMaterials
        };
        
        // Update summary with calculated values from deviceStats for accuracy
        data.summary.totalAdsPlayed = calculatedSummary.totalAdsPlayed;
        data.summary.totalDisplayTime = calculatedSummary.totalDisplayTime;
        data.summary.totalQRScans = calculatedSummary.totalQRScans;
        data.summary.totalDevices = calculatedSummary.totalDevices;
        data.summary.totalMaterials = calculatedSummary.totalMaterials;
        data.summary.totalAds = calculatedSummary.totalAds;
        data.summary.activeAds = calculatedSummary.activeAds;
        
        // Calculate average completion rate based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = calculatedSummary.totalDisplayTime / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // Calculate QR scan conversion rate (using ad plays instead of impressions)
        data.summary.qrScanConversionRate = calculatedSummary.totalAdsPlayed > 0 ? 
          (calculatedSummary.totalQRScans / calculatedSummary.totalAdsPlayed) * 100 : 0;
        
        console.log('📊 [Summary] Updated from deviceStats:', {
          totalAdsPlayed: data.summary.totalAdsPlayed,
          totalQRScans: data.summary.totalQRScans
        });
      } else if (filteredTotals) {
        // ✅ If deviceStats is empty but we have sync data in filteredTotals, use that instead
        // This ensures we use real-time data from DeviceTracking/DeviceDataHistoryV2
        // IMPORTANT: Use filteredTotals even if values are 0 (0 is a valid result)
        console.log('📊 [Summary] deviceStats is empty, using filteredTotals from sync (REAL-TIME DATA):', {
          totalAdPlays: filteredTotals.totalAdPlays,
          totalQRScans: filteredTotals.totalQRScans,
          totalDisplayTime: filteredTotals.totalAdPlayTime,
          totalDevices: filteredTotals.totalDevices,
          totalMaterials: filteredTotals.totalMaterials
        });
        
        // Update summary with filteredTotals from sync (real-time data from DeviceTracking/DeviceDataHistoryV2)
        data.summary.totalAdsPlayed = filteredTotals.totalAdPlays !== undefined ? filteredTotals.totalAdPlays : 0;
        data.summary.totalDisplayTime = filteredTotals.totalAdPlayTime !== undefined ? filteredTotals.totalAdPlayTime : 0;
        data.summary.totalQRScans = filteredTotals.totalQRScans !== undefined ? filteredTotals.totalQRScans : 0;
        data.summary.totalDevices = filteredTotals.totalDevices !== undefined ? filteredTotals.totalDevices : 0;
        data.summary.totalMaterials = filteredTotals.totalMaterials !== undefined ? filteredTotals.totalMaterials : 0;
        
        // Calculate average completion rate from sync data based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = (filteredTotals.totalAdPlayTime || 0) / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // Calculate QR scan conversion rate (using ad plays instead of impressions)
        data.summary.qrScanConversionRate = filteredTotals.totalAdPlays > 0 ? 
          (filteredTotals.totalQRScans / filteredTotals.totalAdPlays) * 100 : 0;
        
        console.log('📊 [Summary] ✅ Updated from sync data (DeviceTracking/DeviceDataHistoryV2 - REAL-TIME):', {
          totalAdsPlayed: data.summary.totalAdsPlayed,
          totalQRScans: data.summary.totalQRScans,
          totalDisplayTime: data.summary.totalDisplayTime,
          totalDevices: data.summary.totalDevices,
          totalMaterials: data.summary.totalMaterials
        });
      } else if (userAnalytics && userAnalytics.totalAdPlays > 0) {
        // ✅ Fallback: Use UserAnalytics data (synced from DeviceTracking/DeviceDataHistoryV2)
        // This ensures we always show real-time data even if deviceStats and filteredTotals are empty
        console.log('📊 [Summary] Using UserAnalytics data (synced from DeviceTracking/DeviceDataHistoryV2):', {
          totalAdPlays: userAnalytics.totalAdPlays,
          totalQRScans: userAnalytics.totalQRScans
        });
        
        // Update summary with UserAnalytics data (real-time synced data)
        data.summary.totalAdsPlayed = userAnalytics.totalAdPlays || 0;
        data.summary.totalDisplayTime = userAnalytics.totalAdPlayTime || 0;
        data.summary.totalQRScans = userAnalytics.totalQRScans || 0;
        data.summary.totalDevices = userAnalytics.totalDevices || 0;
        data.summary.totalMaterials = userAnalytics.totalMaterials || 0;
        data.summary.averageCompletionRate = userAnalytics.averageAdCompletionRate || 0;
        // Calculate QR scan conversion rate (using ad plays instead of impressions)
        data.summary.qrScanConversionRate = userAnalytics.totalAdPlays > 0 ? 
          (userAnalytics.totalQRScans / userAnalytics.totalAdPlays) * 100 : 0;
        
        console.log('📊 [Summary] Updated from UserAnalytics (real-time synced data):', {
          totalAdsPlayed: data.summary.totalAdsPlayed,
          totalQRScans: data.summary.totalQRScans
        });
      } else if (data.deviceStats && data.deviceStats.length > 0 && !adId) {
        // For non-filtered queries, still calculate from deviceStats if available
        const calculatedSummary = {
          totalAdsPlayed: data.deviceStats.reduce((sum, device) => sum + (device.adsPlayed || 0), 0),
          totalDisplayTime: data.deviceStats.reduce((sum, device) => sum + (device.displayTime || 0), 0),
          totalQRScans: data.deviceStats.reduce((sum, device) => sum + (device.qrScans || 0), 0),
          totalDevices: data.deviceStats.length,
          totalMaterials: data.deviceStats.length,
          totalAds: data.adPerformance ? data.adPerformance.length : 0,
          activeAds: data.adPerformance ? data.adPerformance.length : 0
        };
        
        console.log('📊 Calculated summary from device stats (all ads):', calculatedSummary);
        
        // Update summary with calculated values from deviceStats for accuracy
        data.summary.totalAdsPlayed = calculatedSummary.totalAdsPlayed;
        data.summary.totalDisplayTime = calculatedSummary.totalDisplayTime;
        data.summary.totalQRScans = calculatedSummary.totalQRScans;
        data.summary.totalDevices = calculatedSummary.totalDevices;
        data.summary.totalMaterials = calculatedSummary.totalMaterials;
        data.summary.totalAds = calculatedSummary.totalAds;
        data.summary.activeAds = calculatedSummary.activeAds;
        
        // Calculate average completion rate based on 8-hour daily requirement
        // Formula: (totalAdPlayTime in hours / (numberOfDays × 8 hours)) × 100
        const totalPlayTimeInHours = calculatedSummary.totalDisplayTime / 3600; // Convert seconds to hours
        const numberOfDays = Math.ceil((defaultEndDate - defaultStartDate) / (1000 * 60 * 60 * 24)) || 1; // Calculate days in range, minimum 1
        const expectedHours = numberOfDays * 8; // 8 hours per day requirement
        data.summary.averageCompletionRate = expectedHours > 0 ? Math.min(100, (totalPlayTimeInHours / expectedHours) * 100) : 0;
        
        // Calculate QR scan conversion rate (using ad plays instead of impressions)
        data.summary.qrScanConversionRate = calculatedSummary.totalAdsPlayed > 0 ? 
          (calculatedSummary.totalQRScans / calculatedSummary.totalAdsPlayed) * 100 : 0;
        
        console.log('📊 Updated summary with calculated values from device stats:', data.summary);
      }

      // For "All Devices" view, use only UserAnalytics data for summary - but still get device stats
      if (shouldReturnCumulative) {
        console.log('📊 Using UserAnalytics collection data for "All Devices" view');
        console.log('📊 Summary data source: UserAnalytics collection ONLY');
        console.log('📊 Final summary for ALL DEVICES:', {
          totalAdsPlayed: data.summary.totalAdsPlayed,
          totalDisplayTime: data.summary.totalDisplayTime,
          totalQRScans: data.summary.totalQRScans,
          totalMaterials: data.summary.totalMaterials,
          totalDevices: data.summary.totalDevices,
          averageCompletionRate: data.summary.averageCompletionRate,
          qrScanConversionRate: data.summary.qrScanConversionRate
        });
        data.dailyStats = [];
        // deviceStats already populated above
      } else if (isAllPeriod) {
        // For "all" period, use the same logic as other periods (30d, 7d, etc.) but with wide date range
        // This ensures we get the same data structure and QR scan calculations
        if (defaultStartDate && defaultEndDate) {
          const dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
          data.dailyStats = dailyStats;
        }
        // deviceStats already populated above
      } else {
        // Get daily stats from DeviceDataHistoryV2 for filtered periods
        if (defaultStartDate && defaultEndDate) {
          const dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
          data.dailyStats = dailyStats;
        }
        // deviceStats already populated above
      }

      // Debug logging to track data flow
      // When filtering by adId, adPerformance array still contains ALL ads for dropdown
      
      // Final check before returning
      if (!data.adPerformance || data.adPerformance.length === 0) {
        console.error('⚠️ WARNING: adPerformance array is EMPTY! This will cause dropdown to be empty!');
        console.error('⚠️ filteredAds:', filteredAds?.length || 0);
        console.error('⚠️ allUserAds:', allUserAds?.length || 0);
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
        console.log('⚠️ Skipping cache for "all" period - sync may have failed or no valid data (all zeros)');
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
              totalMaterials: 0,
              totalDevices: 0,
              totalQRScans: 0,
              qrScanConversionRate: 0
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

      // ✅ Get user's adIds to filter adPlaybacks (matching getDeviceStatsFromHistory approach)
      const userAds = await Ad.find({ userId: userId });
      const userAdIds = [];
      for (const ad of userAds) {
        if (ad._id) {
          userAdIds.push(ad._id.toString());
        }
      }
      
      // Build match conditions for adPlaybacks (using adId filtering)
      const adPlaybackMatchConditions = [];
      if (adId) {
        // Filter by specific adId
        adPlaybackMatchConditions.push({ $eq: ['$$playback.adId', adId] });
        adPlaybackMatchConditions.push({ $eq: ['$$playback.adId', adId.toString()] });
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
      } else if (userAdIds.length > 0) {
        userAdIds.forEach(adIdStr => {
          qrScanMatchConditions.push({ $eq: ['$$scan.adId', adIdStr] });
          qrScanMatchConditions.push({ $eq: [{ $toString: '$$scan.adId' }, adIdStr] });
        });
      }

      // ✅ Get historical data from DeviceDataHistoryV2
      // If includesToday is true, include today in historical query (in case it's already archived)
      // We'll merge with DeviceTracking data for today if available
      const finalHistoricalEndDate = includesToday ? today : endDateObj;
      const shouldIncludeTodayInHistorical = includesToday;
      
      let historicalResult = [];
      if (startDateObj <= finalHistoricalEndDate) {
        // Only query historical data if there are dates before today
        // ✅ Use adPlaybacks instead of adPerformance (matching getDeviceStatsFromHistory)
        const [result] = await DeviceDataHistoryV2.aggregate([
          { $unwind: '$dailyData' },
          { $match: { 'dailyData.date': { $gte: startDateObj, $lte: finalHistoricalEndDate } } },
          { $facet: {
              adPerf: [
                {
                  $project: {
                    date: '$dailyData.date',
                    filteredAdPlaybacks: {
                      $filter: {
                        input: { $ifNull: ['$dailyData.adPlaybacks', []] },
                        as: 'playback',
                        cond: adPlaybackMatchConditions.length > 0 ? { $or: adPlaybackMatchConditions } : false
                      }
                    }
                  }
                },
                { $match: { $expr: { $gt: [{ $size: '$filteredAdPlaybacks' }, 0] } } },
                { $group: {
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
                        cond: qrScanMatchConditions.length > 0 ? { $or: qrScanMatchConditions } : false
                      }
                    }
                  }
                },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    qrScans: { $sum: { $size: '$filteredQrScans' } }
                  }
                },
                { $sort: { _id: 1 } }
              ]
            }
          }
        ]);
        historicalResult = result || [];
      }

      const adPerfByDate = new Map((historicalResult?.adPerf || []).map(d => [d._id, d]));
      const qrByDate = new Map((historicalResult?.qr || []).map(d => [d._id, d.qrScans]));

      // ✅ Get current day data from DeviceTracking if date range includes today
      if (includesToday) {
        try {
          // Get user's ads to find associated materials
          const userAds = await Ad.find({ userId: userId });
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
                  // Filter by userId
                  if (playback.userId === userId.toString()) {
                    // Filter by adId if provided
                    const playbackAdId = playback.adId ? playback.adId.toString() : '';
                    if (!adId || playbackAdId === adId || playbackAdId === adId.toString()) {
                      todayAdsPlayed += 1; // Count each playback as 1 play
                      todayDisplayTime += playback.viewTime || 0;
                      if (playback.completionRate) {
                        totalCompletionRate += playback.completionRate;
                        completionRateCount++;
                      }
                    }
                  }
                });
              }

              // Process QR scans for current day
              if (device.qrScans && device.qrScans.length > 0) {
                device.qrScans.forEach(qrScan => {
                  // Filter by userId
                  if (qrScan.userId === userId.toString()) {
                    // Filter by adId if provided
                    if (!adId || qrScan.adId === adId || qrScan.adId.toString() === adId) {
                      todayQRScans += 1;
                    }
                  }
                });
              }
            });

            const todayCompletionRate = completionRateCount > 0 ? totalCompletionRate / completionRateCount : 0;

            // Add/update today's data (prioritize DeviceTracking data if it exists)
            // If historical data already has today, merge them (DeviceTracking is more authoritative)
            const existingToday = adPerfByDate.get(todayStr);
            if (existingToday && shouldIncludeTodayInHistorical) {
              console.warn('⚠️ [getDailyStatsFromHistory] Today\'s data exists in both historical and DeviceTracking - prioritizing DeviceTracking');
            }
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
      return dates.map(dateStr => {
        const ap = adPerfByDate.get(dateStr) || {};
        return {
          date: dateStr,
          adsPlayed: ap.adsPlayed || 0,
          displayTime: ap.displayTime || 0,
          qrScans: qrByDate.get(dateStr) || 0,
          completionRate: ap.completionRate || 0
        };
      });
    } catch (error) {
      console.error('Error getting daily stats from history:', error);
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
          totalMaterials: 0,
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
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
                  adPerf.totalMaterials += 1; // Each device counts as one material
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
          adPerf.qrScanConversionRate = (adPerf.totalQRScans / adPerf.totalAdPlays) * 100;
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
      
      // ✅ Get user's adIds first (like fetchAndUpdateUserAnalyticsFromHistory does)
      const userAds = await Ad.find({ userId: userId }).select('_id');
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      if (userAdIds.length === 0) {
        console.log('📊 [getDeviceStatsFromHistory] No ads found for user, returning empty array');
        return [];
      }
      
      // ✅ Build $or condition for filtering by user's adIds (since $in doesn't work in $filter)
      // Since adId is stored as String in adPlaybacks, we'll use string comparison
      // Build simple $or condition with just string comparisons
      const adIdMatchConditions = userAdIds.map(adIdStr => ({
        $eq: ['$$playback.adId', adIdStr]
      }));
      
      const qrScanMatchConditions = userAdIds.map(adIdStr => ({
        $eq: ['$$scan.adId', adIdStr]
      }));
      
      console.log('📊 [getDeviceStatsFromHistory] Building aggregation pipeline with:', {
        userAdIdsCount: userAdIds.length,
        userAdIds: userAdIds,
        adIdMatchConditionsCount: adIdMatchConditions.length,
        hasAdIdFilter: !!adId,
        sampleCondition: adIdMatchConditions[0]
      });
      
      // Build aggregation pipeline for better performance (only for historical data)
      // ✅ Use adPlaybacks instead of adPerformance (matching fetchAndUpdateUserAnalyticsFromHistory)
      const pipeline = [
        // Stage 1: Unwind dailyData array
        { $unwind: '$dailyData' },
        
        // Stage 2: Filter by date range (historical only)
        {
          $match: {
            'dailyData.date': { $gte: startDateObj, $lte: finalHistoricalEndDate }
          }
        },
        
        // Stage 3: Filter adPlaybacks by user's adIds (matching fetchAndUpdateUserAnalyticsFromHistory approach)
        // ✅ Use $setIsSubset or $or since $in doesn't work in $filter conditions
        {
          $project: {
            materialId: 1,
            carGroupId: 1,
            date: '$dailyData.date',
            filteredAdPlaybacks: {
              $filter: {
                input: { $ifNull: ['$dailyData.adPlaybacks', []] },
                as: 'playback',
                cond: adId ? {
                  // Filter by specific adId (adId is string in adPlaybacks)
                  $or: [
                    { $eq: ['$$playback.adId', adId] },
                    { $eq: ['$$playback.adId', adId.toString()] },
                    { $eq: [{ $toString: '$$playback.adId' }, adId] },
                    { $eq: [{ $toString: '$$playback.adId' }, adId.toString()] }
                  ]
                } : (adIdMatchConditions.length > 0 ? {
                  // Filter by user's adIds - use $or with all adId match conditions
                  $or: adIdMatchConditions
                } : false)
              }
            },
            filteredQrScans: {
              $filter: {
                input: { $ifNull: ['$dailyData.qrScans', []] },
                as: 'scan',
                cond: adId ? {
                  // Filter by specific adId (adId is string in qrScans)
                  $or: [
                    { $eq: ['$$scan.adId', adId] },
                    { $eq: ['$$scan.adId', adId.toString()] },
                    { $eq: [{ $toString: '$$scan.adId' }, adId] },
                    { $eq: [{ $toString: '$$scan.adId' }, adId.toString()] }
                  ]
                } : (qrScanMatchConditions.length > 0 ? {
                  // Filter by user's adIds - use $or with all adId match conditions
                  $or: qrScanMatchConditions
                } : false)
              }
            }
          }
        },
        
        // Stage 4: Filter out documents with no matching adPlaybacks
        {
          $match: {
            $expr: { $gt: [{ $size: '$filteredAdPlaybacks' }, 0] }
          }
        },
        
        // Stage 5: Group by materialId to get totals per device (using filteredAdPlaybacks)
        {
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
            totalQRScans: { 
              $sum: { $size: '$filteredQrScans' }
            },
            lastActivity: { $max: '$date' }
          }
        },
        
        // Stage 6: Filter out devices with no data
        {
          $match: {
            $or: [
              { totalAdPlays: { $gt: 0 } },
              { totalQRScans: { $gt: 0 } }
            ]
          }
        },
        
        // Stage 7: Sort by last activity
        { $sort: { lastActivity: -1 } }
      ];

      console.log('📊 Running aggregation pipeline...');
      console.log('📊 Pipeline stages count:', pipeline.length);
      console.log('📊 Date range:', { 
        start: startDateObj.toISOString(), 
        end: finalHistoricalEndDate.toISOString(),
        includesToday,
        shouldIncludeTodayInHistorical
      });
      let aggregationResult = [];
      if (startDateObj <= finalHistoricalEndDate) {
        // Only query historical data if there are dates before today
        try {
          // Debug: Check what data we actually have BEFORE the aggregation
          // Query without date filter to see all available data
          const debugPipeline = [
            { $match: { materialId: { $in: ['DGL-HEADDRESS-CAR-001'] } } },
            { $unwind: '$dailyData' },
            { $project: {
              materialId: 1,
              date: '$dailyData.date',
              adPlaybacksCount: { $size: { $ifNull: ['$dailyData.adPlaybacks', []] } },
              hasAdPlaybacks: { $gt: [{ $size: { $ifNull: ['$dailyData.adPlaybacks', []] } }, 0] },
              sampleAdIds: { $slice: [{ $map: { input: { $ifNull: ['$dailyData.adPlaybacks', []] }, as: 'p', in: '$$p.adId' } }, 3] }
            }},
            { $match: { hasAdPlaybacks: true } },
            { $limit: 10 }
          ];
          const debugResult = await DeviceDataHistoryV2.aggregate(debugPipeline, { allowDiskUse: true });
          console.log('📊 Debug: Found', debugResult.length, 'dailyData entries with adPlaybacks');
          if (debugResult.length > 0) {
            console.log('📊 Debug: Sample entries:', debugResult.slice(0, 3).map(d => ({
              materialId: d.materialId,
              date: d.date,
              adPlaybacksCount: d.adPlaybacksCount,
              sampleAdIds: d.sampleAdIds
            })));
            console.log('📊 Debug: Date range we\'re querying:', {
              start: startDateObj.toISOString(),
              end: finalHistoricalEndDate.toISOString(),
              includesToday: includesToday,
              shouldIncludeTodayInHistorical: shouldIncludeTodayInHistorical
            });
          }
          
          aggregationResult = await DeviceDataHistoryV2.aggregate(pipeline, {
            maxTimeMS: 20000, // Force MongoDB timeout after 20 seconds
            allowDiskUse: true // Allow using disk for large datasets
          });
          console.log('📊 Aggregation completed:', aggregationResult.length, 'devices (historical)');
          if (aggregationResult.length > 0) {
            console.log('📊 Sample aggregation result:', JSON.stringify(aggregationResult[0], null, 2));
          }
        } catch (aggError) {
          if (aggError.code === 50 || aggError.message.includes('exceeded time limit') || aggError.message.includes('timed out')) {
            console.error('⏱️ MongoDB aggregation timeout - returning empty result for large date range');
            aggregationResult = []; // Continue with current day data only
          } else {
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
          const materialIds = [];
          
          // Get Material model to look up materialId strings
          const Material = require('../models/Material');
          
          for (const ad of userAds) {
            // Check targetDevices first (newer field), then materialId (legacy)
            const deviceRefs = (ad.targetDevices && ad.targetDevices.length > 0) 
              ? ad.targetDevices 
              : (ad.materialId && ad.materialId.length > 0 ? ad.materialId : []);
            
            if (deviceRefs.length > 0) {
              // Look up Material documents to get materialId strings
              const materials = await Material.find({ _id: { $in: deviceRefs } }).select('materialId');
              materials.forEach(material => {
                if (material.materialId && !materialIds.includes(material.materialId)) {
                  materialIds.push(material.materialId);
                }
              });
            }
          }

          console.log('📊 [getDeviceStatsFromHistory] Found materialIds for user:', materialIds.length, materialIds);

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
                  // Filter by userId
                  if (adPerf.userId === userId.toString()) {
                    // Filter by adId if provided
                    if (!adId || adPerf.adId === adId || adPerf.adId.toString() === adId) {
                      totalAdPlays += adPerf.playCount || 0;
                      totalAdPlayTime += adPerf.totalViewTime || 0;
                    }
                  }
                });
              }

              // Process QR scans for current day
              if (device.qrScans && device.qrScans.length > 0) {
                device.qrScans.forEach(qrScan => {
                  // Filter by userId
                  if (qrScan.userId === userId.toString()) {
                    // Filter by adId if provided
                    if (!adId || qrScan.adId === adId || qrScan.adId.toString() === adId) {
                      totalQRScans += 1;
                    }
                  }
                });
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
          // If we included today in historical and DeviceTracking also has today's data,
          // we can't easily subtract today from historical totals. 
          // For now, we'll add DeviceTracking data on top (may cause slight double-counting if both have today)
          // But DeviceTracking is more authoritative, so prioritize it
          // TODO: Could improve by excluding today from historical aggregation in a separate query
          const hasDeviceTrackingData = currentDayStats.totalAdPlays > 0;
          
          if (shouldIncludeTodayInHistorical && hasDeviceTrackingData) {
            // Historical includes today, but DeviceTracking has today's data - use DeviceTracking for today
            // This means we might double-count today slightly, but DeviceTracking is more accurate
            console.log(`⚠️ [getDeviceStatsFromHistory] Today's data exists in both historical and DeviceTracking for ${materialId} - using DeviceTracking data`);
          }
          
          // Merge: add current day data to historical totals
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
      const userAds = await Ad.find({ userId: userId }).select('_id targetDevices createdAt').sort({ createdAt: 1 });
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
      const materialIds = [];
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      // Get materials from targetDevices (ObjectIds) and convert to materialIds (strings) - bulk operation
      const Material = require('../models/Material');
      const allTargetDevices = userAds.flatMap(ad => ad.targetDevices || []);
      
      if (allTargetDevices.length > 0) {
        const materials = await Material.find({ _id: { $in: allTargetDevices } }, 'materialId');
        materials.forEach(material => {
          if (material.materialId && !materialIds.includes(material.materialId)) {
            materialIds.push(material.materialId);
          }
        });
      }
      
      if (materialIds.length === 0) {
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
      const processedData = {
        userId,
        totalMaterials: materialIds.length,
        totalDevices: historicalData.length,
        totalAdPlays: 0,
        totalAdPlayTime: 0,
        totalQRScans: 0,
        ads: {},
        materials: {}
      };

      // Process each material's data - optimized processing
      const materialDataMap = new Map();
      const adDataMap = new Map();
      
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
              
              // Filter QR scans to only include user's ads - optimized filtering
              const userQRScans = dailyData.qrScans ? dailyData.qrScans.filter(scan => 
                userAdIds.includes(scan.adId)
              ) : [];
              
              // Calculate totals efficiently
              const userAdPlays = userAdPlaybacks.length;
              const userAdPlayTime = userAdPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0);
              const userQRScansCount = userQRScans.length;
              
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
              
              // Collect QR scans efficiently
              if (userQRScans.length > 0) {
                materialStats.qrScans.push(...userQRScans);
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
      const finalProcessedData = {
        userId,
        totalMaterials: materialIds.length,
        totalDevices: historicalData.length,
        totalAdPlays: 0,
        totalAdPlayTime: 0,
        totalQRScans: 0,
        ads: {},
        materials: {}
      };

      // Calculate totals from material data
      for (const [materialId, materialStats] of materialDataMap) {
        finalProcessedData.materials[materialId] = materialStats;
        finalProcessedData.totalAdPlays += materialStats.totalAdPlays;
        finalProcessedData.totalAdPlayTime += materialStats.totalAdPlayTime;
        finalProcessedData.totalQRScans += materialStats.totalQRScans;
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
        totalMaterials: ad.materials.length,
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
      
      const qrScanConversionRate = finalProcessedData.totalAdPlays > 0 
        ? (finalProcessedData.totalQRScans / finalProcessedData.totalAdPlays) * 100 
        : 0;

      console.log('📊 Processed data summary:', {
        totalMaterials: finalProcessedData.totalMaterials,
        totalDevices: finalProcessedData.totalDevices,
        totalAdPlays: finalProcessedData.totalAdPlays,
        totalAdPlayTime: finalProcessedData.totalAdPlayTime,
        totalQRScans: finalProcessedData.totalQRScans,
        averageAdCompletionRate,
        qrScanConversionRate,
        adsCount: adsArray.length
      });

      return {
        success: true,
        userId,
        dateRange: { startDate: defaultStartDate, endDate: defaultEndDate },
        totalMaterials: finalProcessedData.totalMaterials,
        totalDevices: finalProcessedData.totalDevices,
        totalAdPlays: finalProcessedData.totalAdPlays,
        totalAdPlayTime: finalProcessedData.totalAdPlayTime,
        totalQRScans: finalProcessedData.totalQRScans,
        averageAdCompletionRate,
        qrScanConversionRate,
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
      const defaultStartDate = startDate && !isNaN(new Date(startDate).getTime()) 
        ? new Date(startDate) 
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
      const defaultEndDate = endDate && !isNaN(new Date(endDate).getTime()) 
        ? new Date(endDate) 
        : now;

      // Fetch fresh data from history (pass adId for filtering)
      const freshData = await this.fetchAndUpdateUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate, adId);
      
      console.log('🔍 Fresh Data from History (REAL-TIME DATA):', {
        success: freshData.success,
        adsCount: freshData.ads?.length || 0,
        totalAdPlays: freshData.totalAdPlays,
        totalAdPlayTime: freshData.totalAdPlayTime,
        totalQRScans: freshData.totalQRScans,
        totalMaterials: freshData.totalMaterials,
        totalDevices: freshData.totalDevices,
        dateRange: freshData.dateRange,
        dataKeys: Object.keys(freshData || {})
      });
      
      if (!freshData.success) {
        return freshData;
      }

      // Update or create UserAnalytics document
      let userAnalytics = await UserAnalytics.findOne({ userId });
      
      if (!userAnalytics) {
        // Create new user analytics
        userAnalytics = new UserAnalytics({
          userId,
          ads: [],
          totalAds: 0,
          totalMaterials: 0,
          totalDevices: 0,
          totalAdPlayTime: 0,
          totalQRScans: 0,
          averageAdCompletionRate: 0,
          qrScanConversionRate: 0,
          adPerformance: [],
          errorLogs: [],
          isActive: true
        });
      }

      // Update with fresh data - but DON'T overwrite cumulative totals
      // The useranalytics database should maintain cumulative totals, not filtered totals
      // userAnalytics.totalMaterials = freshData.totalMaterials;
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
        
        // Include ALL active paid ads, even those with no data
        userAnalytics.ads = allUserAds.map(ad => {
          // Find performance data for this ad (if it exists)
          const adPerformance = freshData.ads?.find(a => a.adId === ad._id.toString());
          
          // Find QR scan data for this ad
          const adQRScans = qrScanData.success && qrScanData.ads ? 
            qrScanData.ads.find(qr => qr.adId === ad._id.toString()) : null;
          
          console.log(`🔍 Ad ${ad._id} (${ad.title}) data:`, {
            hasPerformance: !!adPerformance,
            hasQRScans: !!adQRScans,
            totalScans: adQRScans?.totalScans || 0
          });
          
          return {
            adId: ad._id.toString(),
            adTitle: ad.title,
            totalMaterials: adPerformance ? 1 : 0,
            totalDevices: adPerformance ? 1 : 0,
            totalAdPlayTime: adPerformance?.totalViewTime || 0,
            totalQRScans: adQRScans ? adQRScans.totalScans : 0,
            averageAdCompletionRate: adPerformance?.completionRate || 0,
            qrScanConversionRate: (adPerformance?.playCount > 0 && adQRScans) ? (adQRScans.totalScans / adPerformance.playCount) * 100 : 0,
            lastUpdated: new Date().toISOString(),
            materials: [] // Will be populated separately
          };
        });
      } else {
        userAnalytics.ads = [];
      }
      
      // Only update the timestamp to indicate when the sync happened
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();
      userAnalytics.totalAds = userAnalytics.ads.length;

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
              // Update the fresh document with our changes
              freshUserAnalytics.ads = userAnalytics.ads;
              freshUserAnalytics.lastUpdated = new Date();
              freshUserAnalytics.updatedAt = new Date();
              freshUserAnalytics.totalAds = userAnalytics.ads.length;
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
          totalMaterials: freshData.totalMaterials || 0,
          totalDevices: freshData.totalDevices || 0,
          averageAdCompletionRate: freshData.averageAdCompletionRate || 0,
          qrScanConversionRate: freshData.qrScanConversionRate || 0,
          ads: freshData.ads || [],
          materials: freshData.materials || [],
          dateRange: freshData.dateRange || {},
          lastUpdated: freshData.lastUpdated || new Date()
        },
        userAnalytics: {
          userId: userAnalytics.userId,
          totalAds: userAnalytics.totalAds,
          totalMaterials: userAnalytics.totalMaterials,
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
      
      if (!userAnalytics) {
        console.log(`📊 Creating initial UserAnalytics record for user ${userId}`);
        
        userAnalytics = new UserAnalytics({
          userId: userId,
          ads: [],
          totalAds: 0,
          totalMaterials: 0,
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
        console.log(`✅ Created initial UserAnalytics record for user ${userId}`);
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
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          deviceAnalytics: null
        };
      }

      // Set default date range if not provided (last 30 days)
      const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const defaultEndDate = endDate || new Date();

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

      // Filter daily data by date range
      const filteredDailyData = deviceData.dailyData.filter(day => {
        const dayDate = new Date(day.date);
        return dayDate >= defaultStartDate && dayDate <= defaultEndDate;
      });

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
          qrScanConversionRate: 0, // Will be calculated below
          complianceRate: filteredDailyData.length > 0 ? 
            filteredDailyData.reduce((sum, day) => sum + (day.dailySummary?.complianceRate || 0), 0) / filteredDailyData.length : 0,
          uptimePercentage: filteredDailyData.length > 0 ? 
            (filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0) / (filteredDailyData.length * 8)) * 100 : 0
        }
      };

      // Calculate QR scan conversion rate (using ad plays instead of impressions)
      const totalAdPlays = deviceMetrics.totals.totalAdPlays;
      const totalQRScans = deviceMetrics.totals.totalQRScans;
      deviceMetrics.performance.qrScanConversionRate = totalAdPlays > 0 ? (totalQRScans / totalAdPlays) * 100 : 0;

      // Get ad performance breakdown
      const adPerformanceMap = {};
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      filteredDailyData.forEach(day => {
        if (day.adPerformance && day.adPerformance.length > 0) {
          day.adPerformance.forEach(ad => {
            // Only process ads that belong to the current user (check both userId and adId)
            // AND filter by specific ad if filterAdId is provided
            const belongsToUser = ad.userId === userId || userAdIds.includes(ad.adId);
            const matchesFilter = !filterAdId || ad.adId === filterAdId;
            
            if (belongsToUser && matchesFilter) {
              if (!adPerformanceMap[ad.adId]) {
                adPerformanceMap[ad.adId] = {
                  adId: ad.adId,
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
              
              adPerformanceMap[ad.adId].totalPlays += ad.playCount || 0;
              adPerformanceMap[ad.adId].totalViewTime += ad.totalViewTime || 0;
              adPerformanceMap[ad.adId].playCount += ad.playCount || 0;
              
              if (!adPerformanceMap[ad.adId].firstPlayed || (ad.firstPlayed && new Date(ad.firstPlayed) < new Date(adPerformanceMap[ad.adId].firstPlayed))) {
                adPerformanceMap[ad.adId].firstPlayed = ad.firstPlayed;
              }
              if (!adPerformanceMap[ad.adId].lastPlayed || (ad.lastPlayed && new Date(ad.lastPlayed) > new Date(adPerformanceMap[ad.adId].lastPlayed))) {
                adPerformanceMap[ad.adId].lastPlayed = ad.lastPlayed;
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
        if (day.qrScans && day.qrScans.length > 0) {
          day.qrScans.forEach(scan => {
            // Only process QR scans for the current user (check both userId and adId)
            // AND filter by specific ad if filterAdId is provided
            const belongsToUser = scan.userId === userId || (scan.adId && userAdIds.includes(scan.adId));
            const matchesFilter = !filterAdId || scan.adId === filterAdId;
            
            if (belongsToUser && matchesFilter) {
              if (!qrScanMap[scan.adId]) {
                qrScanMap[scan.adId] = {
                  adId: scan.adId,
                  adTitle: scan.adTitle,
                  totalScans: 0,
                  scans: []
                };
              }
              qrScanMap[scan.adId].totalScans += 1;
              qrScanMap[scan.adId].scans.push(scan);
            }
          });
        }
      });
      

      // Calculate totals from user-specific data only (filtered by adId if provided)
      deviceMetrics.totals.totalQRScans = Object.values(qrScanMap).reduce((sum, qr) => sum + (qr.totalScans || 0), 0);
      deviceMetrics.totals.totalAdPlays = Object.values(adPerformanceMap).reduce((sum, ad) => sum + (ad.totalPlays || 0), 0);
      deviceMetrics.totals.totalAdPlayTime = Object.values(adPerformanceMap).reduce((sum, ad) => sum + (ad.totalViewTime || 0), 0);
      
      if (filterAdId) {
        console.log(`📊 Device ${deviceId} - Filtered by adId ${filterAdId}:`, {
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
            const belongsToUser = playback.userId === userId || (playback.adId && userAdIds.includes(playback.adId.toString()));
            const matchesFilter = !filterAdId || playback.adId === filterAdId || playback.adId.toString() === filterAdId;
            
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
            const belongsToUser = scan.userId === userId || (scan.adId && userAdIds.includes(scan.adId.toString()));
            const matchesFilter = !filterAdId || scan.adId === filterAdId || scan.adId.toString() === filterAdId;
            
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
            totalMaterials: userAnalytics.totalMaterials || 0,
            totalDevices: userAnalytics.totalDevices || 0,
            averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
            qrScanConversionRate: userAnalytics.qrScanConversionRate || 0
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
        deviceSummary.summary.qrScanConversionRate = totalAdPlays > 0 ? (totalQRScans / totalAdPlays) * 100 : 0;

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
          totalMaterials: Object.keys(adPlaysByMaterial).length,
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
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          totalScans: 0,
          ads: []
        };
      }

      const userAdIds = userAds.map(ad => ad._id.toString());

      // Set default date range if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const defaultEndDate = endDate || now;

      let totalScans = 0;
      const qrScansByAd = {};
      const qrScansByMaterial = {};

      // QRScanTracking is deprecated - QR scans are now in DeviceTracking and DeviceDataHistoryV2
      // Skip the deprecated QRScanTracking collection

      // QR scans are now processed from DeviceTracking and DeviceDataHistoryV2 below

      // Get additional data from DeviceTracking and DeviceDataHistoryV2
      const materialIds = userAds.flatMap(ad => ad.materialId || []).filter(Boolean);

      // Get current day data from DeviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });

      // Process current day QR scans
      currentData.forEach(device => {
        if (device.qrScansByAd && device.qrScansByAd.length > 0) {
          device.qrScansByAd.forEach(adScan => {
            if (userAdIds.includes(adScan.adId)) {
              if (!qrScansByAd[adScan.adId]) {
                qrScansByAd[adScan.adId] = {
                  adId: adScan.adId,
                  adTitle: adScan.adTitle,
                  totalScans: 0,
                  firstScanned: adScan.firstScanned,
                  lastScanned: adScan.lastScanned,
                  scans: []
                };
              }
              qrScansByAd[adScan.adId].totalScans += adScan.scanCount || 0;
              totalScans += adScan.scanCount || 0;
            }
          });
        }
      });

      // Get historical data from DeviceDataHistoryV2
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(defaultStartDate),
          $lte: new Date(defaultEndDate)
        }
      });

      // Process historical QR scans
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(defaultStartDate) && dailyDate <= new Date(defaultEndDate)) {
              if (dailyData.qrScansByAd && dailyData.qrScansByAd.length > 0) {
                dailyData.qrScansByAd.forEach(adScan => {
                  if (userAdIds.includes(adScan.adId)) {
                    if (!qrScansByAd[adScan.adId]) {
                      qrScansByAd[adScan.adId] = {
                        adId: adScan.adId,
                        adTitle: adScan.adTitle,
                        totalScans: 0,
                        firstScanned: adScan.firstScanned,
                        lastScanned: adScan.lastScanned,
                        scans: []
                      };
                    }
                    qrScansByAd[adScan.adId].totalScans += adScan.scanCount || 0;
                    totalScans += adScan.scanCount || 0;
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
        totalScans,
        ads: Object.values(qrScansByAd),
        materials: Object.values(qrScansByMaterial),
        dateRange: {
          startDate: defaultStartDate,
          endDate: defaultEndDate
        },
        summary: {
          totalAds: Object.keys(qrScansByAd).length,
          totalMaterials: Object.keys(qrScansByMaterial).length,
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
      
      // Get user's ads to find associated materials (including SCHEDULED ads)
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return {
          success: false,
          message: 'No active ads found for this user',
          totalMaterials: 0,
          materials: []
        };
      }

      // Get all materials associated with user's ads
      const materialIds = [];
      const materialDetails = [];

      for (const ad of userAds) {
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          // Get material documents to extract materialId strings
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

      // Get current status from DeviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: currentDay
      });

      // Add current status and performance data
      materialDetails.forEach(material => {
        const currentDevice = currentData.find(device => device.materialId === material.materialId);
        if (currentDevice) {
          material.currentStatus = {
            isOnline: currentDevice.isOnline,
            lastSeen: currentDevice.lastSeen,
            currentLocation: currentDevice.currentLocation,
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
        material.ads = userAds.filter(ad => {
          if (ad.targetDevices && ad.targetDevices.length > 0) {
            return ad.targetDevices.some(targetDevice => {
              return material.materialId === targetDevice.toString();
            });
          }
          return ad.materialId && ad.materialId.some(materialId => materialId.toString() === material.materialId);
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
      });

      // Calculate summary statistics
      const activeMaterials = materialDetails.filter(material => material.currentStatus.isOnline);
      const totalAdPlays = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalAdPlays, 0);
      const totalQRScans = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalQRScans, 0);
      const totalAdPlayTime = materialDetails.reduce((sum, material) => sum + material.currentStatus.totalAdPlayTime, 0);

      return {
        success: true,
        userId,
        totalMaterials: materialDetails.length,
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
          totalMaterials: Object.keys(displayTimeByMaterial).length,
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
      const qrScanConversionRate = totalImpressions > 0 ? (totalQRScans / totalImpressions) * 100 : 0;

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
          totalMaterials: materialsData.totalMaterials || 0,
          activeMaterials: materialsData.activeMaterials || 0,
          totalAds: adPlaysData.summary?.totalAds || 0
        },
        metrics: {
          qrScanConversionRate: qrScanConversionRate,
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
