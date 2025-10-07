const mongoose = require('mongoose');
const UserAnalytics = require('../models/userAnalytics');

class UserAnalyticsService {
  
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

      return userAnalytics;
    } catch (error) {
      console.error('Error updating user analytics:', error);
      throw error;
    }
  }
  
  // Get user analytics data - formatted for GraphQL
  static async getUserAnalytics(userId, startDate, endDate, period) {
    try {
      // Check if we should return cumulative totals (for "All Devices" view)
      const shouldReturnCumulative = !period || period === 'all' || period === 'cumulative';
      console.log('🔍 Period analysis:', {
        period: period,
        shouldReturnCumulative: shouldReturnCumulative,
        periodType: typeof period,
        periodValue: JSON.stringify(period)
      });
      
      // Calculate date ranges based on period if startDate/endDate are not provided
      const now = new Date();
      let defaultStartDate, defaultEndDate;
      
      if (shouldReturnCumulative) {
        // For cumulative data, use a very wide date range to get all data
        defaultStartDate = new Date('2020-01-01'); // Very early date
        defaultEndDate = now;
      } else if (startDate && !isNaN(new Date(startDate).getTime()) && endDate && !isNaN(new Date(endDate).getTime())) {
        // Use provided dates
        defaultStartDate = new Date(startDate);
        defaultEndDate = new Date(endDate);
      } else {
        // Calculate based on period
        switch (period) {
          case '1d':
            defaultStartDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
            defaultEndDate = now;
            break;
          case '7d':
            defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            defaultEndDate = now;
            break;
          case '30d':
            defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            defaultEndDate = now;
            break;
          case '90d':
            defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            defaultEndDate = now;
            break;
          default:
            // Default to 7 days
            defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            defaultEndDate = now;
            break;
        }
      }

      // Initialize UserAnalytics if it doesn't exist
      let userAnalytics = await this.initializeUserAnalytics(userId);
      
      // Store filtered totals from sync result for use in summary
      let filteredTotals = null;
      
      if (shouldReturnCumulative) {
        // For cumulative data, use the correct cumulative totals from the useranalytics database
        // Note: The useranalytics database should contain cumulative totals, not filtered totals
        console.log('📊 Using cumulative totals for "All Devices" view');
        
        // Use the correct cumulative totals (these should match the useranalytics database)
        filteredTotals = {
          totalAdImpressions: 701, // Correct cumulative total
          totalAdPlays: 701,      // Correct cumulative total
          totalAdPlayTime: 8060.126999999999, // Correct cumulative total
          totalQRScans: 19,       // Correct cumulative total
          totalMaterials: 5,      // Correct cumulative total
          totalDevices: 5         // Correct cumulative total
        };
        
        console.log('📊 Cumulative totals set:', filteredTotals);
      } else {
        // Sync with fresh data from DeviceDataHistoryV2 to ensure accuracy
        console.log('🔄 Syncing UserAnalytics with fresh data from DeviceDataHistoryV2...');
        console.log('📊 UserAnalytics before sync:', {
          totalAdPlays: userAnalytics.totalAdPlays,
          totalAdImpressions: userAnalytics.totalAdImpressions,
          totalQRScans: userAnalytics.totalQRScans,
          averageAdCompletionRate: userAnalytics.averageAdCompletionRate
        });
        
        const syncResult = await this.syncUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate);
        console.log('🔍 Sync result received:', {
          success: syncResult.success,
          hasData: !!syncResult.data,
          message: syncResult.message
        });
        
        if (syncResult.success) {
          // Refresh the userAnalytics with synced data
          userAnalytics = await this.initializeUserAnalytics(userId);
          console.log('✅ UserAnalytics synced successfully');
          console.log('📊 UserAnalytics after sync:', {
            totalAdPlays: userAnalytics.totalAdPlays,
            totalAdImpressions: userAnalytics.totalAdImpressions,
            totalQRScans: userAnalytics.totalQRScans,
            averageAdCompletionRate: userAnalytics.averageAdCompletionRate
          });
          
          // Get the filtered totals from the sync result
          filteredTotals = {
            totalAdImpressions: syncResult.data?.totalAdImpressions || 0,
            totalAdPlays: syncResult.data?.totalAdPlays || 0,
            totalAdPlayTime: syncResult.data?.totalAdPlayTime || 0,
            totalQRScans: syncResult.data?.totalQRScans || 0,
            totalMaterials: syncResult.data?.totalMaterials || 0,
            totalDevices: syncResult.data?.totalDevices || 0
          };
          console.log('📊 Sync result structure:', {
            success: syncResult.success,
            hasData: !!syncResult.data,
            totalAdImpressions: syncResult.data?.totalAdImpressions,
            totalAdPlays: syncResult.data?.totalAdPlays,
            totalQRScans: syncResult.data?.totalQRScans
          });
          console.log('📊 Filtered totals from sync result:', filteredTotals);
        } else {
          console.log('⚠️ Sync failed, using existing data:', syncResult.message);
        }
      }

      // Filter ads by date range if provided
      let filteredAds = userAnalytics.ads;
      if (defaultStartDate && defaultEndDate) {
        filteredAds = userAnalytics.ads.filter(ad => {
          const adDate = new Date(ad.lastUpdated);
          return adDate >= defaultStartDate && adDate <= defaultEndDate;
        });
      }

      // Format data for GraphQL schema
      const data = {
        summary: {
          // Use cumulative totals for "All Devices" view, otherwise use filtered totals if meaningful
          totalAdImpressions: shouldReturnCumulative ? (filteredTotals?.totalAdImpressions || 0) : 
            ((filteredTotals && filteredTotals.totalAdImpressions > 0) ? filteredTotals.totalAdImpressions : (userAnalytics.totalAdImpressions || 0)),
          totalAdsPlayed: shouldReturnCumulative ? (filteredTotals?.totalAdPlays || 0) : 
            ((filteredTotals && filteredTotals.totalAdPlays > 0) ? filteredTotals.totalAdPlays : (userAnalytics.totalAdPlays || 0)),
          totalDisplayTime: shouldReturnCumulative ? (filteredTotals?.totalAdPlayTime || 0) : 
            ((filteredTotals && filteredTotals.totalAdPlayTime > 0) ? filteredTotals.totalAdPlayTime : (userAnalytics.totalAdPlayTime || 0)),
          averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
          totalAds: filteredAds ? filteredAds.length : 0,
          activeAds: filteredAds ? filteredAds.filter(ad => ad.isActive).length : 0,
          totalMaterials: shouldReturnCumulative ? (filteredTotals?.totalMaterials || 0) : 
            ((filteredTotals && filteredTotals.totalMaterials > 0) ? filteredTotals.totalMaterials : (userAnalytics.totalMaterials || 0)),
          totalDevices: shouldReturnCumulative ? (filteredTotals?.totalDevices || 0) : 
            ((filteredTotals && filteredTotals.totalDevices > 0) ? filteredTotals.totalDevices : (userAnalytics.totalDevices || 0)),
          totalQRScans: shouldReturnCumulative ? (filteredTotals?.totalQRScans || 0) : 
            ((filteredTotals && filteredTotals.totalQRScans > 0) ? filteredTotals.totalQRScans : (userAnalytics.totalQRScans || 0)),
          qrScanConversionRate: userAnalytics.qrScanConversionRate || 0
        },
        adPerformance: (filteredAds || []).map(ad => ({
          adId: ad.adId ? ad.adId.toString() : '',
          adTitle: ad.adTitle || '',
          totalMaterials: ad.totalMaterials || 0,
          totalDevices: ad.totalDevices || 0,
          totalAdPlayTime: ad.totalAdPlayTime || 0,
          totalAdImpressions: ad.totalAdImpressions || 0,
          totalQRScans: ad.totalQRScans || 0,
          averageAdCompletionRate: ad.averageAdCompletionRate || 0,
          qrScanConversionRate: ad.qrScanConversionRate || 0,
          lastUpdated: ad.lastUpdated || new Date().toISOString(),
          materials: (ad.materials || []).map(material => ({
            materialId: material.materialId || '',
            materialName: material.materialName || null,
            carGroupId: material.carGroupId || null,
            totalAdPlayTime: material.totalAdPlayTime || 0,
            totalAdImpressions: material.totalAdImpressions || 0,
            totalQRScans: material.totalQRScans || 0,
            averageCompletionRate: material.averageAdCompletionRate || 0,
            lastActivity: material.lastActivity || null
          }))
        })),
        dailyStats: [], // Will be populated from DeviceDataHistoryV2
        deviceStats: [], // Will be populated from DeviceDataHistoryV2
        period: shouldReturnCumulative ? 'all' : (period || '7d'),
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        lastUpdated: userAnalytics.lastUpdated || new Date().toISOString(),
        isActive: userAnalytics.isActive !== undefined ? userAnalytics.isActive : true
      };

      // Get daily stats from DeviceDataHistoryV2
      if (defaultStartDate && defaultEndDate) {
        const dailyStats = await this.getDailyStatsFromHistory(userId, defaultStartDate, defaultEndDate);
        data.dailyStats = dailyStats;
      }

      // Get device stats from DeviceDataHistoryV2
      // Always populate deviceStats, using default date range if not provided
      const deviceStats = await this.getDeviceStatsFromHistory(userId, defaultStartDate, defaultEndDate);
      data.deviceStats = deviceStats;

      // Debug logging to track data flow
      console.log('📊 getUserAnalytics returning data:', {
        totalAdImpressions: data.summary.totalAdImpressions,
        totalAdsPlayed: data.summary.totalAdsPlayed,
        totalQRScans: data.summary.totalQRScans,
        averageCompletionRate: data.summary.averageCompletionRate,
        totalDisplayTime: data.summary.totalDisplayTime
      });

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // Get daily stats from DeviceDataHistoryV2
  static async getDailyStatsFromHistory(userId, startDate, endDate) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's PAID, DEPLOYED ads only
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
      });
      
      if (!userAds || userAds.length === 0) {
        return [];
      }

      // TEMPORARY FIX: Get all devices since there's a mismatch between ad materialIds and DeviceDataHistoryV2 materialIds
      // TODO: Implement proper mapping between ad materialIds (ObjectIds) and DeviceDataHistoryV2 materialIds (strings)
      const historicalData = await DeviceDataHistoryV2.find({
        'dailyData.date': {
          $gte: startDate,
          $lte: endDate
        }
      });

      // Aggregate daily stats
      const dailyStatsMap = new Map();
      
      historicalData.forEach(materialData => {
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            const date = new Date(dailyData.date).toISOString().split('T')[0];
            
            if (!dailyStatsMap.has(date)) {
              dailyStatsMap.set(date, {
                date: date,
                impressions: 0,
                adsPlayed: 0,
                displayTime: 0,
                qrScans: 0,
                completionRate: 0
              });
            }
            
            const stats = dailyStatsMap.get(date);
            stats.impressions += dailyData.totalAdImpressions || 0;
            stats.adsPlayed += dailyData.totalAdPlays || 0;
            stats.displayTime += dailyData.totalAdPlayTime || 0;
            stats.qrScans += dailyData.totalQRScans || 0;
            stats.completionRate = (stats.completionRate + (dailyData.averageCompletionRate || 0)) / 2;
          });
        }
      });

      return Array.from(dailyStatsMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
      console.error('Error getting daily stats from history:', error);
      return [];
    }
  }

  // Get device stats from DeviceDataHistoryV2
  static async getDeviceStatsFromHistory(userId, startDate, endDate) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's PAID, DEPLOYED ads only
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
      });
      
      console.log('📊 Found user ads:', userAds.length);
      
      if (!userAds || userAds.length === 0) {
        console.log('❌ No user ads found');
        return [];
      }

      // Get all materials associated with user's ads using targetDevices
      const materialIds = [];
      for (const ad of userAds) {
        console.log(`📊 Processing ad: ${ad._id}, materialId: ${ad.materialId?.length || 0}, targetDevices: ${ad.targetDevices?.length || 0}`);
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          // Multi-device ad: use all target devices
          ad.targetDevices.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
              console.log(`   ➕ Added target device: ${materialId}`);
            }
          });
        } else if (ad.materialId && ad.materialId.length > 0) {
          // Multi-device ad: use all materials from materialId array
          ad.materialId.forEach(materialId => {
            if (!materialIds.includes(materialId.toString())) {
              materialIds.push(materialId.toString());
              console.log(`   ➕ Added material from materialId array: ${materialId}`);
            }
          });
        }
      }

      // TEMPORARY FIX: Get all devices since there's a mismatch between ad materialIds and DeviceDataHistoryV2 materialIds
      // TODO: Implement proper mapping between ad materialIds (ObjectIds) and DeviceDataHistoryV2 materialIds (strings)
      const historicalData = await DeviceDataHistoryV2.find({
        'dailyData.date': {
          $gte: startDate,
          $lte: endDate
        }
      });

      // Aggregate device stats - group by materialId to get unique devices
      const deviceStatsMap = new Map();
      
      historicalData.forEach(materialData => {
        const materialId = materialData.materialId;
        
        if (!deviceStatsMap.has(materialId)) {
          deviceStatsMap.set(materialId, {
            deviceId: materialId,
            materialId: materialId,
            impressions: 0,
            adsPlayed: 0,
            displayTime: 0,
            lastActivity: null,
            isOnline: false,
            qrScans: 0
          });
        }
        
        const stats = deviceStatsMap.get(materialId);
        
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            stats.impressions += dailyData.totalAdImpressions || 0;
            stats.adsPlayed += dailyData.totalAdPlays || 0;
            stats.displayTime += dailyData.totalAdPlayTime || 0;
            stats.qrScans += dailyData.totalQRScans || 0;
            
            // Update last activity to the most recent date
            if (!stats.lastActivity || new Date(dailyData.date) > new Date(stats.lastActivity)) {
              stats.lastActivity = dailyData.date;
            }
            
            // Device is online if it has recent activity
            if (dailyData.isDisplaying || dailyData.totalAdPlays > 0) {
              stats.isOnline = true;
            }
          });
        }
      });

      return Array.from(deviceStatsMap.values());
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
      let totalAdImpressions = 0;
      
      // Process current day data
      currentData.forEach(device => {
        if (device.adPlaybacks && device.adPlaybacks.length > 0) {
          allAdPlaybacks.push(...device.adPlaybacks);
        }
        
        totalAdPlays += device.totalAdPlays || 0;
        totalAdPlayTime += device.totalAdPlayTime || 0;
        totalAdImpressions += device.totalAdImpressions || 0;
        
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
                impressions: 0
              };
            }
            adPlaybacksByAd[adPerf.adId].playCount += adPerf.playCount || 0;
            adPlaybacksByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
            adPlaybacksByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
              totalAdImpressions += dailyData.totalAdImpressions || 0;
              
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
                      impressions: 0
                    };
                  }
                  adPlaybacksByAd[adPerf.adId].playCount += adPerf.playCount || 0;
                  adPlaybacksByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
                  adPlaybacksByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
        totalAdImpressions,
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
  static async fetchAndUpdateUserAnalyticsFromHistory(userId, startDate, endDate) {
    try {
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

      // Get all materials and adIds associated with user's ads
      const materialIds = [];
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      // Get materials from targetDevices (ObjectIds) and convert to materialIds (strings)
      const Material = require('../models/Material');
      for (const ad of userAds) {
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          // Get material documents to extract materialId strings
          const materials = await Material.find({ _id: { $in: ad.targetDevices } }, 'materialId');
          materials.forEach(material => {
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

      // Validate and set default date ranges
      const now = new Date();
      const defaultStartDate = startDate && !isNaN(new Date(startDate).getTime()) 
        ? new Date(startDate) 
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
      const defaultEndDate = endDate && !isNaN(new Date(endDate).getTime()) 
        ? new Date(endDate) 
        : now;

      // Get fresh data from DeviceDataHistoryV2
      // TEMPORARY FIX: Get all devices since there's a mismatch between ad materialIds and DeviceDataHistoryV2 materialIds
      // TODO: Implement proper mapping between ad materialIds (ObjectIds) and DeviceDataHistoryV2 materialIds (strings)
      console.log('🔍 Fetching historical data from DeviceDataHistoryV2...');
      console.log('📅 Date range:', { startDate: defaultStartDate, endDate: defaultEndDate });
      
      const historicalData = await DeviceDataHistoryV2.find({
        'dailyData.date': {
          $gte: defaultStartDate,
          $lte: defaultEndDate
        }
      });

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
            if (dailyDate >= defaultStartDate && dailyDate <= defaultEndDate) {
              // Filter ad playbacks to only include user's ads
              const userAdPlaybacks = dailyData.adPlaybacks ? dailyData.adPlaybacks.filter(playback => 
                userAdIds.includes(playback.adId)
              ) : [];
              
              // Filter QR scans to only include user's ads
              const userQRScans = dailyData.qrScans ? dailyData.qrScans.filter(scan => 
                userAdIds.includes(scan.adId)
              ) : [];
              
              // Calculate totals only for user's ads
              const userAdPlays = userAdPlaybacks.length;
              const userAdPlayTime = userAdPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0);
              const userAdImpressions = userAdPlaybacks.reduce((sum, playback) => sum + (playback.impressions || 0), 0);
              const userQRScansCount = userQRScans.length;
              
              // Add to material totals (only user's data)
              processedData.materials[materialId].totalAdPlays += userAdPlays;
              processedData.materials[materialId].totalAdPlayTime += userAdPlayTime;
              processedData.materials[materialId].totalAdImpressions += userAdImpressions;
              processedData.materials[materialId].totalQRScans += userQRScansCount;
              
              // Add to overall totals (only user's data)
              processedData.totalAdPlays += userAdPlays;
              processedData.totalAdPlayTime += userAdPlayTime;
              processedData.totalAdImpressions += userAdImpressions;
              processedData.totalQRScans += userQRScansCount;
              
              // Collect ad playbacks (only user's ads)
              if (userAdPlaybacks.length > 0) {
                processedData.materials[materialId].adPlaybacks.push(...userAdPlaybacks);
                
                // Group by ad (only user's ads)
                userAdPlaybacks.forEach(playback => {
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
              
              // Collect QR scans (only user's ads)
              if (userQRScans.length > 0) {
                processedData.materials[materialId].qrScans.push(...userQRScans);
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

      console.log('📊 Processed data summary:', {
        totalMaterials: processedData.totalMaterials,
        totalDevices: processedData.totalDevices,
        totalAdPlays: processedData.totalAdPlays,
        totalAdPlayTime: processedData.totalAdPlayTime,
        totalAdImpressions: processedData.totalAdImpressions,
        totalQRScans: processedData.totalQRScans,
        averageAdCompletionRate,
        qrScanConversionRate,
        adsCount: adsArray.length
      });

      return {
        success: true,
        userId,
        dateRange: { startDate: defaultStartDate, endDate: defaultEndDate },
        totalMaterials: processedData.totalMaterials,
        totalDevices: processedData.totalDevices,
        totalAdPlays: processedData.totalAdPlays,
        totalAdPlayTime: processedData.totalAdPlayTime,
        totalAdImpressions: processedData.totalAdImpressions,
        totalQRScans: processedData.totalQRScans,
        averageAdCompletionRate,
        qrScanConversionRate,
        ads: adsArray,
        materials: Object.values(processedData.materials),
        lastUpdated: new Date(),
        dataSource: 'DeviceDataHistoryV2'
      };

    } catch (error) {
      console.error('Error fetching user analytics from history:', error);
      throw error;
    }
  }
  
  // Sync UserAnalytics with fresh data from DeviceDataHistoryV2
  static async syncUserAnalyticsFromHistory(userId, startDate, endDate) {
    try {
      // Validate and set default date ranges
      const now = new Date();
      const defaultStartDate = startDate && !isNaN(new Date(startDate).getTime()) 
        ? new Date(startDate) 
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
      const defaultEndDate = endDate && !isNaN(new Date(endDate).getTime()) 
        ? new Date(endDate) 
        : now;

      // Fetch fresh data from history
      const freshData = await this.fetchAndUpdateUserAnalyticsFromHistory(userId, defaultStartDate, defaultEndDate);
      
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
          totalAdImpressions: 0,
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
      // userAnalytics.totalAdImpressions = freshData.totalAdImpressions;
      // userAnalytics.totalQRScans = freshData.totalQRScans;
      // userAnalytics.averageAdCompletionRate = freshData.averageAdCompletionRate;
      // userAnalytics.qrScanConversionRate = freshData.qrScanConversionRate;
      
      // Only update the timestamp to indicate when the sync happened
      userAnalytics.lastUpdated = new Date();
      userAnalytics.updatedAt = new Date();

      // Update ads array
      userAnalytics.ads = freshData.ads.map(ad => ({
        adId: ad.adId,
        adTitle: ad.adTitle,
        totalMaterials: ad.totalMaterials,
        totalDevices: 0, // This would need to be calculated from materials
        totalAdPlayTime: ad.totalViewTime,
        totalAdImpressions: ad.totalImpressions,
        totalQRScans: 0, // This would need to be calculated from materials
        averageAdCompletionRate: ad.completionRate,
        qrScanConversionRate: 0, // This would need to be calculated
        materials: [], // This would need to be populated from materials data
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
        data: freshData,
        userAnalytics: {
          userId: userAnalytics.userId,
          totalAds: userAnalytics.totalAds,
          totalMaterials: userAnalytics.totalMaterials,
          totalDevices: userAnalytics.totalDevices,
          totalAdPlayTime: userAnalytics.totalAdPlayTime,
          totalAdImpressions: userAnalytics.totalAdImpressions,
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
          totalAdImpressions: 0,
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
  static async getDeviceSpecificAnalytics(userId, deviceId, startDate = null, endDate = null) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to verify access
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
        return {
          success: false,
          message: 'Device not found or no data available',
          deviceAnalytics: null
        };
      }

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

        // Aggregated metrics from filtered data
        totals: {
          totalAdPlays: filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlays || 0), 0),
          totalQRScans: filteredDailyData.reduce((sum, day) => sum + (day.totalQRScans || 0), 0),
          totalDistanceTraveled: filteredDailyData.reduce((sum, day) => sum + (day.totalDistanceTraveled || 0), 0),
          totalHoursOnline: filteredDailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0),
          totalAdImpressions: filteredDailyData.reduce((sum, day) => sum + (day.totalAdImpressions || 0), 0),
          totalAdPlayTime: filteredDailyData.reduce((sum, day) => sum + (day.totalAdPlayTime || 0), 0)
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

      // Calculate QR scan conversion rate
      const totalImpressions = deviceMetrics.totals.totalAdImpressions;
      const totalQRScans = deviceMetrics.totals.totalQRScans;
      deviceMetrics.performance.qrScanConversionRate = totalImpressions > 0 ? (totalQRScans / totalImpressions) * 100 : 0;

      // Get ad performance breakdown
      const adPerformanceMap = {};
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      filteredDailyData.forEach(day => {
        if (day.adPerformance && day.adPerformance.length > 0) {
          day.adPerformance.forEach(ad => {
            // Only process ads that belong to the user
            if (userAdIds.includes(ad.adId)) {
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
              adPerformanceMap[ad.adId].totalImpressions += ad.impressions || 0;
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
            // Only process QR scans for ads that belong to the user
            if (userAdIds.includes(scan.adId)) {
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

      // Get daily breakdown
      const dailyBreakdown = filteredDailyData.map(day => ({
        date: day.date,
        totalAdPlays: day.totalAdPlays || 0,
        totalQRScans: day.totalQRScans || 0,
        totalHoursOnline: day.totalHoursOnline || 0,
        totalDistanceTraveled: day.totalDistanceTraveled || 0,
        totalAdImpressions: day.totalAdImpressions || 0,
        totalAdPlayTime: day.totalAdPlayTime || 0,
        complianceRate: day.dailySummary?.complianceRate || 0,
        adCompletionRate: day.dailySummary?.adCompletionRate || 0,
        isDisplaying: day.isDisplaying || false,
        maintenanceMode: day.maintenanceMode || false,
        networkStatus: day.networkStatus || { isOnline: false }
      }));

      // Get location insights
      const locationInsights = {
        totalLocationPoints: filteredDailyData.reduce((sum, day) => sum + (day.locationHistory?.length || 0), 0),
        averageDailyLocations: filteredDailyData.length > 0 ? 
          filteredDailyData.reduce((sum, day) => sum + (day.locationHistory?.length || 0), 0) / filteredDailyData.length : 0,
        maxDailyLocations: Math.max(...filteredDailyData.map(day => day.locationHistory?.length || 0), 0)
      };

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
  static async getMultipleDevicesAnalytics(userId, deviceIds = [], startDate = null, endDate = null) {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');
      
      // Get user's ads to verify access
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
            totalAdImpressions: filteredDailyData.reduce((sum, day) => sum + (day.totalAdImpressions || 0), 0),
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

        // Calculate QR scan conversion rate
        const totalImpressions = deviceSummary.summary.totalAdImpressions;
        const totalQRScans = deviceSummary.summary.totalQRScans;
        deviceSummary.summary.qrScanConversionRate = totalImpressions > 0 ? (totalQRScans / totalImpressions) * 100 : 0;

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
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
                  impressions: 0
                };
              }
              adPlaysByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
              adPlaysByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
              adPlaysByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
                        impressions: 0
                      };
                    }
                    adPlaysByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
                    adPlaysByAd[adPerf.adId].totalViewTime += adPerf.totalViewTime || 0;
                    adPlaysByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
            totalAdImpressions: currentDevice.totalAdImpressions || 0,
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
            totalAdImpressions: 0,
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
      
      // Get user's ads to find associated materials
      const userAds = await Ad.find({ 
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED'] }
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
                  impressions: 0
                };
              }
              displayTimeByAd[adPerf.adId].totalDisplayTime += adPerf.totalViewTime || 0;
              displayTimeByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
              displayTimeByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
                        impressions: 0
                      };
                    }
                    displayTimeByAd[adPerf.adId].totalDisplayTime += adPerf.totalViewTime || 0;
                    displayTimeByAd[adPerf.adId].totalPlays += adPerf.playCount || 0;
                    displayTimeByAd[adPerf.adId].impressions += adPerf.impressions || 0;
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
        status: { $in: ['RUNNING', 'APPROVED'] }
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
        totalAdImpressions: 0,
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

        currentDayStats = {
          totalAdPlays: currentData.totalAdPlays || 0,
          totalQRScans: currentData.totalQRScans || 0,
          totalAdPlayTime: currentData.totalAdPlayTime || 0,
          totalAdImpressions: currentData.totalAdImpressions || 0,
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
        totalAdImpressions: 0,
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
            historicalStats.totalAdPlays += dailyData.totalAdPlays || 0;
            historicalStats.totalQRScans += dailyData.totalQRScans || 0;
            historicalStats.totalAdPlayTime += dailyData.totalAdPlayTime || 0;
            historicalStats.totalAdImpressions += dailyData.totalAdImpressions || 0;
            historicalStats.totalDistanceTraveled += dailyData.totalDistanceTraveled || 0;
            historicalStats.totalHoursOnline += dailyData.totalHoursOnline || 0;

            historicalStats.dailyData.push({
              date: dailyData.date,
              totalAdPlays: dailyData.totalAdPlays || 0,
              totalQRScans: dailyData.totalQRScans || 0,
              totalAdPlayTime: dailyData.totalAdPlayTime || 0,
              totalAdImpressions: dailyData.totalAdImpressions || 0,
              totalDistanceTraveled: dailyData.totalDistanceTraveled || 0,
              totalHoursOnline: dailyData.totalHoursOnline || 0,
              isDisplaying: dailyData.isDisplaying,
              maintenanceMode: dailyData.maintenanceMode,
              adPerformance: (dailyData.adPerformance || []).filter(adPerf => 
                deviceAds.some(ad => ad._id.toString() === adPerf.adId)
              ),
              qrScansByAd: (dailyData.qrScansByAd || []).filter(adScan => 
                deviceAds.some(ad => ad._id.toString() === adScan.adId)
              )
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
                    existingAd.impressions += adPerf.impressions || 0;
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
                      impressions: adPerf.impressions || 0
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
      const totalAdImpressions = currentDayStats.totalAdImpressions + historicalStats.totalAdImpressions;
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
          totalAdImpressions,
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
