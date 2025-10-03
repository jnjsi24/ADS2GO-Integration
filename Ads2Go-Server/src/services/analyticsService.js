const mongoose = require('mongoose');
const Analytics = require('../models/analytics');

class AnalyticsService {
  
  // Update analytics when Android player sends data
  static async updateAnalytics(deviceId, materialId, slotNumber, data) {
    try {
      // Get the material to find the material type
      const Material = mongoose.models.Material || require('../models/Material');
      const material = await Material.findOne({ materialId: materialId });
      const materialType = material ? material.materialType : 'HEADDRESS';
      
      // Use the new createOrUpdateAdAnalytics method
      const analytics = await Analytics.createOrUpdateAdAnalytics(
        data.adId,
        data.adTitle || `Ad ${data.adId}`,
        materialId,
        slotNumber,
        deviceId,
        {
          userId: data.userId,
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

      return analytics;
    } catch (error) {
      console.error('Error updating analytics:', error);
      throw error;
    }
  }
  
  // Get ad playback data from deviceTracking (no longer stores its own copy)
  static async getAdPlaybackData(materialId, startDate, endDate) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistory = require('../models/deviceDataHistory');
      
      // Get current day data from deviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: materialId,
        date: currentDay
      });
      
      // Get historical data from deviceDataHistory
      const historicalData = await DeviceDataHistory.find({
        materialId: materialId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
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
      
      // Process historical data
      historicalData.forEach(archive => {
        if (archive.adPlaybacks && archive.adPlaybacks.length > 0) {
          allAdPlaybacks.push(...archive.adPlaybacks);
        }
        
        totalAdPlays += archive.totalAdPlays || 0;
        totalAdPlayTime += archive.totalAdPlayTime || 0;
        totalAdImpressions += archive.totalAdImpressions || 0;
        
        if (archive.adPerformance && archive.adPerformance.length > 0) {
          archive.adPerformance.forEach(adPerf => {
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
      
      // Calculate averages for ad playbacks by ad
      Object.values(adPlaybacksByAd).forEach(ad => {
        ad.averageViewTime = ad.playCount > 0 ? ad.totalViewTime / ad.playCount : 0;
        ad.completionRate = ad.totalViewTime > 0 ? (ad.totalViewTime / (ad.totalViewTime + (ad.playCount * 30))) * 100 : 0; // Rough completion rate
      });
      
      return {
        totalAdPlays,
        totalAdPlayTime,
        totalAdImpressions,
        adPlaybacks: allAdPlaybacks,
        adPlaybacksByAd: Object.values(adPlaybacksByAd),
        currentDayData: currentData,
        historicalData: historicalData
      };
      
    } catch (error) {
      console.error('Error fetching ad playback data:', error);
      throw error;
    }
  }
  
  // Get QR scan data from deviceTracking (no longer stores its own copy)
  static async getQRScanData(materialId, startDate, endDate) {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const DeviceDataHistory = require('../models/deviceDataHistory');
      
      // Get current day data from deviceTracking
      const currentDay = new Date().toISOString().split('T')[0];
      const currentData = await DeviceTracking.find({
        materialId: materialId,
        date: currentDay
      });
      
      // Get historical data from deviceDataHistory
      const historicalData = await DeviceDataHistory.find({
        materialId: materialId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
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
      
      // Process historical data
      historicalData.forEach(archive => {
        if (archive.qrScans && archive.qrScans.length > 0) {
          allQRScans.push(...archive.qrScans);
        }
        
        if (archive.qrScansByAd && archive.qrScansByAd.length > 0) {
          archive.qrScansByAd.forEach(adScan => {
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
      
      return {
        totalQRScans: allQRScans.length,
        qrScans: allQRScans,
        qrScansByAd: Object.values(qrScansByAd),
        currentDayData: currentData,
        historicalData: historicalData
      };
      
    } catch (error) {
      console.error('Error fetching QR scan data:', error);
      throw error;
    }
  }
  
  // Get comprehensive analytics for admin dashboard
  static async getAdminAnalytics(startDate, endDate) {
    try {
      const matchStage = {};
      if (startDate && endDate) {
        matchStage.lastUpdated = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const [
        totalDevices,
        onlineDevices,
        totalAdImpressions,
        totalQRScans,
        topPerformingAds,
        locationAnalytics,
        deviceAnalytics
      ] = await Promise.all([
        Analytics.countDocuments(matchStage),
        Analytics.countDocuments({ ...matchStage, isOnline: true }),
        Analytics.aggregate([
          { $match: matchStage },
          { $group: { _id: null, total: { $sum: '$totalAdImpressions' } } }
        ]),
        Analytics.aggregate([
          { $match: matchStage },
          { $group: { _id: null, total: { $sum: '$totalQRScans' } } }
        ]),
        Analytics.getTopPerformingAds(10, startDate, endDate),
        Analytics.getLocationAnalytics(startDate, endDate),
        Analytics.find(matchStage).select('deviceId materialId slotNumber isOnline totalAdImpressions totalQRScans uptimePercentage currentLocation')
      ]);
      
      return {
        overview: {
          totalDevices: totalDevices[0]?.total || 0,
          onlineDevices: onlineDevices,
          offlineDevices: totalDevices - onlineDevices,
          totalAdImpressions: totalAdImpressions[0]?.total || 0,
          totalQRScans: totalQRScans[0]?.total || 0,
          averageUptime: deviceAnalytics.length > 0 ? 
            deviceAnalytics.reduce((sum, device) => sum + device.uptimePercentage, 0) / deviceAnalytics.length : 0
        },
        topPerformingAds,
        locationAnalytics,
        deviceAnalytics
      };
    } catch (error) {
      console.error('Error getting admin analytics:', error);
      throw error;
    }
  }
  
  // Get analytics for specific driver
  static async getDriverAnalytics(driverId, startDate, endDate) {
    try {
      const analytics = await Analytics.getDriverAnalytics(driverId, startDate, endDate);
      
      const summary = {
        totalDevices: analytics.length,
        totalAdImpressions: analytics.reduce((sum, device) => sum + device.totalAdImpressions, 0),
        totalQRScans: analytics.reduce((sum, device) => sum + device.totalQRScans, 0),
        totalAdPlayTime: analytics.reduce((sum, device) => sum + device.totalAdPlayTime, 0),
        averageUptime: analytics.length > 0 ? 
          analytics.reduce((sum, device) => sum + device.uptimePercentage, 0) / analytics.length : 0,
        complianceRate: analytics.length > 0 ? 
          analytics.reduce((sum, device) => sum + device.complianceRate, 0) / analytics.length : 0
      };
      
      return {
        summary,
        devices: analytics
      };
    } catch (error) {
      console.error('Error getting driver analytics:', error);
      throw error;
    }
  }
  
  // Get analytics for specific user's ads
  static async getUserAdAnalytics(userId, startDate, endDate) {
    try {
      const [adAnalytics, qrAnalytics, userSummary] = await Promise.all([
        Analytics.getUserAdAnalytics(userId, startDate, endDate),
        Analytics.getUserQRScanAnalytics(userId, startDate, endDate),
        Analytics.getUserAnalytics(userId, startDate, endDate)
      ]);
      
      return {
        summary: userSummary[0] || {
          uniqueDevices: 0,
          uniqueMaterials: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          totalAdPlayTime: 0,
          averageUptime: 0,
          averageCompliance: 0,
          totalDistanceTraveled: 0
        },
        adPerformance: adAnalytics,
        qrScanPerformance: qrAnalytics
      };
    } catch (error) {
      console.error('Error getting user ad analytics:', error);
      throw error;
    }
  }
  
  // Get analytics for specific ad
  static async getAdAnalytics(adId, startDate, endDate) {
    try {
      const matchStage = { adId: adId };
      if (startDate && endDate) {
        matchStage.lastUpdated = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const [adPlaybacks, qrScans, summary] = await Promise.all([
        Analytics.aggregate([
          { $match: matchStage },
          { $unwind: '$adPlaybacks' },
          { $match: { 'adPlaybacks.adId': adId } },
          {
            $group: {
              _id: null,
              totalImpressions: { $sum: '$adPlaybacks.impressions' },
              totalViewTime: { $sum: '$adPlaybacks.viewTime' },
              averageCompletionRate: { $avg: '$adPlaybacks.completionRate' },
              totalDevices: { $addToSet: '$deviceId' },
              totalMaterials: { $addToSet: '$materialId' },
              firstPlayed: { $min: '$adPlaybacks.startTime' },
              lastPlayed: { $max: '$adPlaybacks.startTime' }
            }
          },
          {
            $addFields: {
              uniqueDevices: { $size: '$totalDevices' },
              uniqueMaterials: { $size: '$totalMaterials' }
            }
          }
        ]),
        Analytics.aggregate([
          { $match: matchStage },
          { $unwind: '$qrScans' },
          { $match: { 'qrScans.adId': adId } },
          {
            $group: {
              _id: null,
              totalScans: { $sum: 1 },
              totalConversions: { $sum: { $cond: ['$qrScans.converted', 1, 0] } },
              averageTimeOnPage: { $avg: '$qrScans.timeOnPage' },
              totalDevices: { $addToSet: '$deviceId' },
              totalMaterials: { $addToSet: '$materialId' },
              firstScan: { $min: '$qrScans.scanTimestamp' },
              lastScan: { $max: '$qrScans.scanTimestamp' }
            }
          },
          {
            $addFields: {
              uniqueDevices: { $size: '$totalDevices' },
              uniqueMaterials: { $size: '$totalMaterials' },
              conversionRate: {
                $multiply: [
                  { $divide: ['$totalConversions', '$totalScans'] },
                  100
                ]
              }
            }
          }
        ]),
        Analytics.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              totalDevices: { $addToSet: '$deviceId' },
              totalMaterials: { $addToSet: '$materialId' },
              totalAdImpressions: { $sum: '$totalAdImpressions' },
              totalQRScans: { $sum: '$totalQRScans' },
              totalAdPlayTime: { $sum: '$totalAdPlayTime' },
              averageUptime: { $avg: '$uptimePercentage' }
            }
          },
          {
            $addFields: {
              uniqueDevices: { $size: '$totalDevices' },
              uniqueMaterials: { $size: '$totalMaterials' }
            }
          }
        ])
      ]);
      
      return {
        summary: summary[0] || {
          uniqueDevices: 0,
          uniqueMaterials: 0,
          totalAdImpressions: 0,
          totalQRScans: 0,
          totalAdPlayTime: 0,
          averageUptime: 0
        },
        adPlaybacks: adPlaybacks[0] || {
          totalImpressions: 0,
          totalViewTime: 0,
          averageCompletionRate: 0,
          uniqueDevices: 0,
          uniqueMaterials: 0,
          firstPlayed: null,
          lastPlayed: null
        },
        qrScans: qrScans[0] || {
          totalScans: 0,
          totalConversions: 0,
          averageTimeOnPage: 0,
          uniqueDevices: 0,
          uniqueMaterials: 0,
          conversionRate: 0,
          firstScan: null,
          lastScan: null
        }
      };
    } catch (error) {
      console.error('Error getting ad analytics:', error);
      throw error;
    }
  }
  
  // Get analytics for specific material
  static async getMaterialAnalytics(materialId, startDate, endDate) {
    try {
      const analytics = await Analytics.getMaterialAnalytics(materialId, startDate, endDate);
      
      const summary = {
        totalSlots: analytics.length,
        totalAdImpressions: analytics.reduce((sum, device) => sum + device.totalAdImpressions, 0),
        totalQRScans: analytics.reduce((sum, device) => sum + device.totalQRScans, 0),
        totalAdPlayTime: analytics.reduce((sum, device) => sum + device.totalAdPlayTime, 0),
        averageUptime: analytics.length > 0 ? 
          analytics.reduce((sum, device) => sum + device.uptimePercentage, 0) / analytics.length : 0
      };
      
      return {
        summary,
        slots: analytics
      };
    } catch (error) {
      console.error('Error getting material analytics:', error);
      throw error;
    }
  }
  
  // Get real-time analytics
  static async getRealTimeAnalytics() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const [
        onlineDevices,
        recentActivity,
        currentAds
      ] = await Promise.all([
        Analytics.find({ isOnline: true }).select('deviceId materialId slotNumber currentLocation lastUpdated'),
        Analytics.find({ 
          lastUpdated: { $gte: oneHourAgo }
        }).select('deviceId materialId slotNumber totalAdImpressions totalQRScans lastUpdated'),
        Analytics.find({ 
          'currentAd.adId': { $exists: true }
        }).select('deviceId materialId slotNumber currentAd currentLocation')
      ]);
      
      return {
        onlineDevices: onlineDevices.length,
        recentActivity: recentActivity.length,
        currentAds: currentAds.map(device => ({
          deviceId: device.deviceId,
          materialId: device.materialId,
          slotNumber: device.slotNumber,
          currentAd: device.currentAd,
          location: device.currentLocation
        }))
      };
    } catch (error) {
      console.error('Error getting real-time analytics:', error);
      throw error;
    }
  }
  
  // Get performance metrics
  static async getPerformanceMetrics(deviceId, startDate, endDate) {
    try {
      const analytics = await Analytics.getDeviceAnalytics(deviceId, startDate, endDate);
      
      if (!analytics) {
        return null;
      }
      
      return {
        deviceId: analytics.deviceId,
        materialId: analytics.materialId,
        slotNumber: analytics.slotNumber,
        uptimePercentage: analytics.uptimePercentage,
        complianceRate: analytics.complianceRate,
        adPerformanceScore: analytics.adPerformanceScore,
        qrPerformanceScore: analytics.qrPerformanceScore,
        totalAdImpressions: analytics.totalAdImpressions,
        totalQRScans: analytics.totalQRScans,
        averageAdCompletionRate: analytics.averageAdCompletionRate,
        qrScanConversionRate: analytics.qrScanConversionRate,
        totalDistanceTraveled: analytics.totalDistanceTraveled,
        averageSpeed: analytics.averageSpeed,
        maxSpeed: analytics.maxSpeed,
        currentHoursToday: analytics.currentHoursToday,
        hoursRemaining: analytics.hoursRemaining,
        isCompliantToday: analytics.isCompliantToday
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }
  
  // Get user-specific analytics
  static async getUserAnalytics(userId, startDate, endDate, period = '7d') {
    try {
      // Debug: console.log(`Getting analytics for user ${userId} for period ${period}`);
      
      // Calculate date range based on period
      const now = new Date();
      let dateFilter = {};
      
      if (startDate && endDate) {
        dateFilter = {
          'adPlaybacks.startTime': {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      } else {
        // Default periods
        switch (period) {
          case '1d':
            dateFilter = {
              'adPlaybacks.startTime': {
                $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
              }
            };
            break;
          case '7d':
            dateFilter = {
              'adPlaybacks.startTime': {
                $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              }
            };
            break;
          case '30d':
            dateFilter = {
              'adPlaybacks.startTime': {
                $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              }
            };
            break;
          default:
            dateFilter = {
              'adPlaybacks.startTime': {
                $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              }
            };
        }
      }

      // Get user's ads first to get the ad IDs - require Ad model locally to avoid OverwriteModelError
      const Ad = mongoose.models.Ad || require('../models/ad');
      const userAds = await Ad.find({ userId: userId }).select('id title description adFormat status createdAt startTime endTime price');
      const userAdIds = userAds.map(ad => ad._id.toString());
      

      if (userAdIds.length === 0) {
        // Return empty analytics if user has no ads
        return {
          summary: {
            totalAdImpressions: 0,
            totalAdsPlayed: 0,
            totalDisplayTime: 0,
            averageCompletionRate: 0,
            totalAds: 0,
            activeAds: 0
          },
          adPerformance: [],
          dailyStats: [],
          deviceStats: [],
          period,
          startDate: startDate || null,
          endDate: endDate || null
        };
      }

      // Get analytics for user's ads only - try both with userId and without (for existing data)
      let userAnalytics = await Analytics.find({
        userId: userId,
        'adPlaybacks.adId': { $in: userAdIds },
        ...dateFilter
      }).populate('userId', 'firstName lastName email');

      // ScreenTracking collection deprecated: skip sync from ScreenTracking to Analytics

      // If no analytics found with userId, try to find analytics that have the user's ads
      if (userAnalytics.length === 0) {
        userAnalytics = await Analytics.find({
          'adPlaybacks.adId': { $in: userAdIds },
          ...dateFilter
        }).populate('userId', 'firstName lastName email');
        
        // Update these analytics documents with the correct userId
        if (userAnalytics.length > 0) {
          await Promise.all(userAnalytics.map(analytics => {
            if (!analytics.userId) {
              analytics.userId = userId;
              return analytics.save();
            }
          }));
        }
      }

      // Aggregate data
      const summary = {
        totalAdImpressions: 0,
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: userAdIds.length,
        activeAds: 0
      };

      const adPerformance = new Map();
      const dailyStats = new Map();
      const activeAdIds = new Set();

      // Process analytics data
      userAnalytics.forEach(analytics => {
        // Process ad playbacks for user's ads only
        analytics.adPlaybacks.forEach(playback => {
          // Only process playbacks for user's ads
          if (!userAdIds.includes(playback.adId)) return;

          // Apply date filter to individual playbacks
          const playbackDate = new Date(playback.startTime);
          const isInDateRange = !startDate || !endDate || 
            (playbackDate >= new Date(startDate) && playbackDate <= new Date(endDate));
          
          if (!isInDateRange) return;

          activeAdIds.add(playback.adId);
          summary.totalAdImpressions += playback.impressions || 1;
          summary.totalAdsPlayed += 1;
          summary.totalDisplayTime += playback.viewTime || 0;

          // Ad performance tracking
          const adKey = playback.adId;
          if (!adPerformance.has(adKey)) {
            // Get ad details from user's ads
            const adDetails = userAds.find(ad => ad._id.toString() === adKey);
            adPerformance.set(adKey, {
              adId: playback.adId,
              adTitle: playback.adTitle || adDetails?.title || 'Unknown Ad',
              impressions: 0,
              totalPlayTime: 0,
              averageCompletionRate: 0,
              playCount: 0,
              lastPlayed: playback.startTime
            });
          }

          const adPerf = adPerformance.get(adKey);
          adPerf.impressions += playback.impressions || 1;
          adPerf.totalPlayTime += playback.viewTime || 0;
          adPerf.playCount += 1;

          // Daily stats
          const dateKey = playbackDate.toISOString().split('T')[0];
          if (!dailyStats.has(dateKey)) {
            dailyStats.set(dateKey, {
              date: dateKey,
              impressions: 0,
              adsPlayed: 0,
              displayTime: 0
            });
          }

          const dailyStat = dailyStats.get(dateKey);
          dailyStat.impressions += playback.impressions || 1;
          dailyStat.adsPlayed += 1;
          dailyStat.displayTime += playback.viewTime || 0;
        });
      });

      // Calculate averages and totals
      summary.activeAds = activeAdIds.size;
      
      // Calculate average completion rate based on actual ad playback data
      let totalCompletionRate = 0;
      let adsWithCompletionRate = 0;
      
      userAds.forEach(ad => {
        if (ad.startTime && ad.endTime) {
          const now = new Date();
          const startDate = new Date(ad.startTime);
          const endDate = new Date(ad.endTime);
          
          const totalDurationMs = endDate.getTime() - startDate.getTime();
          const totalDurationDays = Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24));
          
          const elapsedMs = now.getTime() - startDate.getTime();
          const elapsedDays = Math.max(0, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)));
          
          if (totalDurationDays > 0) {
            // Calculate completion rate based on actual ad playback data for this specific ad
            let adSpecificHours = 0;
            let adSpecificImpressions = 0;
            
            // Check if this ad has been played (has analytics data)
            const adAnalytics = userAnalytics.find(analytics => 
              analytics.adPlaybacks.some(playback => playback.adId === ad._id.toString())
            );
            
            if (adAnalytics) {
              // Get total play time for this specific ad
              const adPlaybacks = adAnalytics.adPlaybacks.filter(playback => 
                playback.adId === ad._id.toString()
              );
              
              adSpecificImpressions = adPlaybacks.reduce((sum, playback) => sum + (playback.impressions || 1), 0);
              adSpecificHours = adPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0) / 3600; // Convert seconds to hours
            }
            
            // Only calculate completion rate if the ad has been played
            let completionRate = 0;
            if (adSpecificImpressions > 0) {
              // Calculate completion rate based on hours this specific ad was played vs 8-hour target
              completionRate = Math.min(100, (adSpecificHours / 8) * 100);
              console.log(`📊 Ad "${ad.title}" - Played ${adSpecificHours.toFixed(2)} hours, ${adSpecificImpressions} impressions, Completion rate: ${completionRate.toFixed(1)}%`);
            } else {
              console.log(`📊 Ad "${ad.title}" - Not played yet, Completion rate: 0%`);
            }
            
            totalCompletionRate += completionRate;
            adsWithCompletionRate++;
          }
        }
      });
      
      summary.averageCompletionRate = adsWithCompletionRate > 0 ? totalCompletionRate / adsWithCompletionRate : 0;

      const processedAdPerformance = Array.from(adPerformance.values()).map(ad => {
        // Find the corresponding ad details to get startTime and endTime
        const adDetails = userAds.find(userAd => userAd._id.toString() === ad.adId);
        
        let completionRate = 0;
        
        if (adDetails && adDetails.startTime && adDetails.endTime) {
          const now = new Date();
          const startDate = new Date(adDetails.startTime);
          const endDate = new Date(adDetails.endTime);
          
          // Calculate total plan duration in days
          const totalDurationMs = endDate.getTime() - startDate.getTime();
          const totalDurationDays = Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24));
          
          // Calculate days elapsed since start
          const elapsedMs = now.getTime() - startDate.getTime();
          const elapsedDays = Math.max(0, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)));
          
          // Calculate completion rate based on actual ad playback data for this specific ad
          // Check if this ad has been played (has analytics data)
          const adAnalytics = userAnalytics.find(analytics => 
            analytics.adPlaybacks.some(playback => playback.adId === ad.adId)
          );
          
          if (adAnalytics) {
            // Get total play time for this specific ad
            const adPlaybacks = adAnalytics.adPlaybacks.filter(playback => 
              playback.adId === ad.adId
            );
            
            const adSpecificImpressions = adPlaybacks.reduce((sum, playback) => sum + (playback.impressions || 1), 0);
            const adSpecificHours = adPlaybacks.reduce((sum, playback) => sum + (playback.viewTime || 0), 0) / 3600; // Convert seconds to hours
            
            // Only calculate completion rate if the ad has been played
            if (adSpecificImpressions > 0) {
              // Calculate completion rate based on hours this specific ad was played vs 8-hour target
              completionRate = Math.min(100, (adSpecificHours / 8) * 100);
            }
          }
        }
        
        return {
          ...ad,
          averageCompletionRate: completionRate
        };
      }).sort((a, b) => b.impressions - a.impressions); // Sort by impressions descending

      const processedDailyStats = Array.from(dailyStats.values()).map(stat => ({
        ...stat
      })).sort((a, b) => new Date(a.date) - new Date(b.date));


      return {
        summary,
        adPerformance: processedAdPerformance,
        dailyStats: processedDailyStats,
        deviceStats: [], // Remove device stats since we're focusing on ads
        period,
        startDate: startDate || null,
        endDate: endDate || null
      };

    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // Get detailed analytics for a specific ad
  static async getUserAdDetails(userId, adId) {
    try {
      console.log(`Getting ad details for user ${userId}, ad ${adId}`);
      
      // Get the ad details - require Ad model locally to avoid OverwriteModelError
      const Ad = mongoose.models.Ad || require('../models/ad');
      const ad = await Ad.findOne({ _id: adId, userId: userId });
      
      if (!ad) {
        throw new Error('Ad not found or access denied');
      }

      // Get analytics for this specific ad
      const adAnalytics = await Analytics.find({
        userId: userId,
        'adPlaybacks.adId': adId
      });

      // Aggregate ad-specific data
      const totalImpressions = adAnalytics.reduce((sum, analytics) => {
        return sum + analytics.adPlaybacks
          .filter(playback => playback.adId === adId)
          .reduce((playbackSum, playback) => playbackSum + (playback.impressions || 1), 0);
      }, 0);

      const totalPlayTime = adAnalytics.reduce((sum, analytics) => {
        return sum + analytics.adPlaybacks
          .filter(playback => playback.adId === adId)
          .reduce((playbackSum, playback) => playbackSum + (playback.viewTime || 0), 0);
      }, 0);

      const averageCompletionRate = adAnalytics.length > 0 ? 
        adAnalytics.reduce((sum, analytics) => {
          const adPlaybacks = analytics.adPlaybacks.filter(playback => playback.adId === adId);
          return sum + adPlaybacks.reduce((playbackSum, playback) => 
            playbackSum + (playback.completionRate || 0), 0);
        }, 0) / adAnalytics.length : 0;

      // Device performance
      const devicePerformance = [];
      const deviceMap = new Map();

      adAnalytics.forEach(analytics => {
        const deviceKey = analytics.deviceId;
        if (!deviceMap.has(deviceKey)) {
          deviceMap.set(deviceKey, {
            deviceId: analytics.deviceId,
            materialId: analytics.materialId,
            impressions: 0,
            playTime: 0,
            completionRate: 0,
            lastPlayed: null
          });
        }

        const devicePerf = deviceMap.get(deviceKey);
        const adPlaybacks = analytics.adPlaybacks.filter(playback => playback.adId === adId);
        
        adPlaybacks.forEach(playback => {
          devicePerf.impressions += playback.impressions || 1;
          devicePerf.playTime += playback.viewTime || 0;
          devicePerf.completionRate = playback.completionRate || 0;
          if (!devicePerf.lastPlayed || new Date(playback.startTime) > new Date(devicePerf.lastPlayed)) {
            devicePerf.lastPlayed = playback.startTime;
          }
        });
      });

      devicePerformance.push(...Array.from(deviceMap.values()));

      // Daily performance
      const dailyPerformance = [];
      const dailyMap = new Map();

      adAnalytics.forEach(analytics => {
        analytics.adPlaybacks
          .filter(playback => playback.adId === adId)
          .forEach(playback => {
            const dateKey = new Date(playback.startTime).toISOString().split('T')[0];
            if (!dailyMap.has(dateKey)) {
              dailyMap.set(dateKey, {
                date: dateKey,
                impressions: 0,
                playTime: 0,
                completionRate: 0
              });
            }

            const dailyPerf = dailyMap.get(dateKey);
            dailyPerf.impressions += playback.impressions || 1;
            dailyPerf.playTime += playback.viewTime || 0;
            dailyPerf.completionRate = playback.completionRate || 0;
          });
      });

      dailyPerformance.push(...Array.from(dailyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date)));

      return {
        adId: ad._id.toString(),
        adTitle: ad.title,
        adDescription: ad.description,
        adFormat: ad.adFormat,
        status: ad.status,
        createdAt: ad.createdAt,
        startTime: ad.startTime,
        endTime: ad.endTime,
        totalImpressions,
        totalPlayTime,
        averageCompletionRate,
        devicePerformance,
        dailyPerformance
      };

    } catch (error) {
      console.error('Error getting user ad details:', error);
      throw error;
    }
  }

  // Sync data from existing collections
  static async syncFromExistingCollections() {
    try {
      console.log('Starting analytics sync from existing collections...');
      
      // ScreenTracking collection deprecated: no sync needed
      
      // QRScanTracking sync removed - QR scans are now handled directly in the ads.js route
      // No need to sync from QRScanTracking collection as it's deprecated
      
      console.log('Analytics sync completed successfully');
      return { success: true, message: 'Analytics sync completed' };
    } catch (error) {
      console.error('Error syncing analytics:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
