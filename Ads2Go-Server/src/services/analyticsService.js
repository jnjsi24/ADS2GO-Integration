const Analytics = require('../models/analytics');
const QRScanTracking = require('../models/qrScanTracking');
const ScreenTracking = require('../models/screenTracking');
const MaterialTracking = require('../models/materialTracking');

class AnalyticsService {
  
  // Update analytics when Android player sends data
  static async updateAnalytics(deviceId, materialId, slotNumber, data) {
    try {
      let analytics = await Analytics.findOne({ deviceId, materialId, slotNumber });
      
      if (!analytics) {
        // Check if there's a deployment placeholder analytics record
        const deploymentAnalytics = await Analytics.findOne({
          materialId,
          slotNumber,
          'deviceInfo.deviceId': { $regex: `DEPLOYMENT-.*-${slotNumber}$` }
        });
        
        if (deploymentAnalytics) {
          // Update the deployment placeholder with real device data
          console.log(`🔄 Updating deployment placeholder with real device data: ${deviceId}`);
          analytics = deploymentAnalytics;
          analytics.deviceId = deviceId;
          analytics.deviceInfo.deviceId = deviceId;
        } else {
          // Create new analytics record
          analytics = new Analytics({
            deviceId,
            materialId,
            slotNumber,
            carGroupId: data.carGroupId,
            driverId: data.driverId,
            adId: data.adId,
            userId: data.userId,
            adDeploymentId: data.adDeploymentId,
            deviceInfo: data.deviceInfo,
            isOnline: data.isOnline || false,
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
            }
          });
        }
      } else {
        // Update existing analytics
        analytics.isOnline = data.isOnline || false;
        analytics.lastUpdated = new Date();
        
        // Update ad and user references if provided
        if (data.adId) analytics.adId = data.adId;
        if (data.userId) analytics.userId = data.userId;
        if (data.adDeploymentId) analytics.adDeploymentId = data.adDeploymentId;
        
        if (data.gpsData) {
          await analytics.updateLocation(
            data.gpsData.lat,
            data.gpsData.lng,
            data.gpsData.speed,
            data.gpsData.heading,
            data.gpsData.accuracy
          );
        }
        
        if (data.deviceInfo) {
          analytics.deviceInfo = { ...analytics.deviceInfo, ...data.deviceInfo };
        }
        
        if (data.networkStatus !== undefined) {
          analytics.networkStatus.isOnline = data.networkStatus;
          analytics.networkStatus.lastSeen = new Date();
        }
      }
      
      await analytics.save();
      return analytics;
    } catch (error) {
      console.error('Error updating analytics:', error);
      throw error;
    }
  }
  
  // Track ad playback
  static async trackAdPlayback(deviceId, materialId, slotNumber, adId, adTitle, adDuration, viewTime = 0) {
    try {
      let analytics = await Analytics.findOne({ deviceId, materialId, slotNumber });
      
      if (!analytics) {
        analytics = new Analytics({
          deviceId,
          materialId,
          slotNumber,
          adPlaybacks: [],
          totalAdPlayTime: 0,
          totalAdImpressions: 0
        });
      }
      
      await analytics.addAdPlayback(adId, adTitle, adDuration, viewTime);
      
      // Also update screen tracking
      await ScreenTracking.findOneAndUpdate(
        { 'devices.deviceId': deviceId },
        { 
          $inc: { 'screenMetrics.adPlayCount': 1 },
          $set: { 
            'screenMetrics.lastAdPlayed': new Date(),
            'screenMetrics.currentAd.adId': adId,
            'screenMetrics.currentAd.adTitle': adTitle
          }
        }
      );
      
      return analytics;
    } catch (error) {
      console.error('Error tracking ad playback:', error);
      throw error;
    }
  }
  
  // Track QR scan
  static async trackQRScan(deviceId, materialId, slotNumber, qrScanData) {
    try {
      let analytics = await Analytics.findOne({ deviceId, materialId, slotNumber });
      
      if (!analytics) {
        analytics = new Analytics({
          deviceId,
          materialId,
          slotNumber,
          qrScans: [],
          totalQRScans: 0
        });
      }
      
      await analytics.addQRScan(qrScanData);
      
      // Also update QR scan tracking collection
      const qrScan = new QRScanTracking(qrScanData);
      await qrScan.save();
      
      // Update material tracking
      await MaterialTracking.findOneAndUpdate(
        { materialId },
        { $inc: { qrCodeScans: 1 } },
        { upsert: false }
      );
      
      return analytics;
    } catch (error) {
      console.error('Error tracking QR scan:', error);
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
  
  // Sync data from existing collections
  static async syncFromExistingCollections() {
    try {
      console.log('Starting analytics sync from existing collections...');
      
      // Sync from ScreenTracking
      const screenTrackings = await ScreenTracking.find({});
      for (const screen of screenTrackings) {
        for (const device of screen.devices) {
          await Analytics.findOneAndUpdate(
            { deviceId: device.deviceId, materialId: screen.materialId },
            {
              $set: {
                deviceId: device.deviceId,
                materialId: screen.materialId,
                slotNumber: device.slotNumber,
                isOnline: device.isOnline,
                currentLocation: device.currentLocation,
                totalHoursOnline: device.totalHoursOnline,
                totalDistanceTraveled: device.totalDistanceTraveled,
                uptimePercentage: screen.screenMetrics?.displayHours || 0,
                totalAdImpressions: screen.screenMetrics?.adPlayCount || 0,
                totalQRScans: screen.screenMetrics?.qrCodeScans || 0,
                lastUpdated: device.lastSeen
              }
            },
            { upsert: true }
          );
        }
      }
      
      // Sync from QRScanTracking
      const qrScans = await QRScanTracking.find({});
      for (const scan of qrScans) {
        await Analytics.findOneAndUpdate(
          { materialId: scan.materialId },
          {
            $push: { qrScans: scan },
            $inc: { totalQRScans: 1 },
            $set: { lastQRScan: scan.scanTimestamp }
          },
          { upsert: true }
        );
      }
      
      console.log('Analytics sync completed successfully');
      return { success: true, message: 'Analytics sync completed' };
    } catch (error) {
      console.error('Error syncing analytics:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
