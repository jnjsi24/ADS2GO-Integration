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
  static async getUserAnalytics(userId, startDate, endDate) {
    try {
      const userAnalytics = await UserAnalytics.findOne({ userId });
      
      if (!userAnalytics) {
        return {
          success: false,
          message: 'User analytics not found'
        };
      }

      // Filter ads by date range if provided
      let filteredAds = userAnalytics.ads;
      if (startDate && endDate) {
        filteredAds = userAnalytics.ads.filter(ad => {
          const adDate = new Date(ad.lastUpdated);
          return adDate >= new Date(startDate) && adDate <= new Date(endDate);
        });
      }

      // Format data for GraphQL schema
      const data = {
        summary: {
          totalAdImpressions: userAnalytics.totalAdImpressions || 0,
          totalAdsPlayed: userAnalytics.totalAdImpressions || 0, // Using impressions as plays
          totalDisplayTime: userAnalytics.totalAdPlayTime || 0,
          averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
          totalAds: filteredAds.length,
          activeAds: filteredAds.filter(ad => ad.isActive).length,
          totalMaterials: userAnalytics.totalMaterials || 0,
          totalDevices: userAnalytics.totalDevices || 0,
          totalQRScans: userAnalytics.totalQRScans || 0,
          qrScanConversionRate: userAnalytics.qrScanConversionRate || 0
        },
        adPerformance: filteredAds.map(ad => ({
          adId: ad.adId.toString(),
          adTitle: ad.adTitle,
          totalMaterials: ad.totalMaterials || 0,
          totalDevices: ad.totalDevices || 0,
          totalAdPlayTime: ad.totalAdPlayTime || 0,
          totalAdImpressions: ad.totalAdImpressions || 0,
          totalQRScans: ad.totalQRScans || 0,
          averageAdCompletionRate: ad.averageAdCompletionRate || 0,
          qrScanConversionRate: ad.qrScanConversionRate || 0,
          lastUpdated: ad.lastUpdated,
          materials: ad.materials || []
        })),
        dailyStats: [], // Will be populated from DeviceDataHistoryV2
        deviceStats: [], // Will be populated from DeviceDataHistoryV2
        period: startDate && endDate ? 'custom' : '7d',
        startDate: startDate,
        endDate: endDate,
        lastUpdated: userAnalytics.lastUpdated,
        isActive: userAnalytics.isActive
      };

      // Get daily stats from DeviceDataHistoryV2
      if (startDate && endDate) {
        const dailyStats = await this.getDailyStatsFromHistory(userId, startDate, endDate);
        data.dailyStats = dailyStats;
      }

      // Get device stats from DeviceDataHistoryV2
      if (startDate && endDate) {
        const deviceStats = await this.getDeviceStatsFromHistory(userId, startDate, endDate);
        data.deviceStats = deviceStats;
      }

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
        } else if (ad.materialId) {
          // Single-device ad: use primary material
          if (!materialIds.includes(ad.materialId.toString())) {
            materialIds.push(ad.materialId.toString());
          }
        }
      }

      if (materialIds.length === 0) {
        return [];
      }

      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
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
      
      if (!userAds || userAds.length === 0) {
        return [];
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
        } else if (ad.materialId) {
          // Single-device ad: use primary material
          if (!materialIds.includes(ad.materialId.toString())) {
            materialIds.push(ad.materialId.toString());
          }
        }
      }

      if (materialIds.length === 0) {
        return [];
      }

      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });

      // Aggregate device stats
      const deviceStatsMap = new Map();
      
      historicalData.forEach(materialData => {
        if (materialData.dailyData && materialData.dailyData.length > 0) {
          materialData.dailyData.forEach(dailyData => {
            const deviceKey = `${materialData.materialId}-${dailyData.date}`;
            
            if (!deviceStatsMap.has(deviceKey)) {
              deviceStatsMap.set(deviceKey, {
                deviceId: materialData.materialId,
                materialId: materialData.materialId,
                impressions: 0,
                adsPlayed: 0,
                displayTime: 0,
                lastActivity: dailyData.date,
                isOnline: dailyData.isDisplaying || false,
                qrScans: 0
              });
            }
            
            const stats = deviceStatsMap.get(deviceKey);
            stats.impressions += dailyData.totalAdImpressions || 0;
            stats.adsPlayed += dailyData.totalAdPlays || 0;
            stats.displayTime += dailyData.totalAdPlayTime || 0;
            stats.qrScans += dailyData.totalQRScans || 0;
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
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
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
      
      // Process historical data (now in dailyData array)
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            // Check if this daily data is within the date range
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(startDate) && dailyDate <= new Date(endDate)) {
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
      const historicalData = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds },
        'dailyData.date': {
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
      
      // Process historical data (now in dailyData array)
      historicalData.forEach(archive => {
        if (archive.dailyData && archive.dailyData.length > 0) {
          archive.dailyData.forEach(dailyData => {
            // Check if this daily data is within the date range
            const dailyDate = new Date(dailyData.date);
            if (dailyDate >= new Date(startDate) && dailyDate <= new Date(endDate)) {
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

      // Get all materials associated with user's ads
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

      // Get fresh data from DeviceDataHistoryV2
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

      return {
        success: true,
        userId,
        dateRange: { startDate, endDate },
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
      // Fetch fresh data from history
      const freshData = await this.fetchAndUpdateUserAnalyticsFromHistory(userId, startDate, endDate);
      
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

      // Update with fresh data
      userAnalytics.totalMaterials = freshData.totalMaterials;
      userAnalytics.totalDevices = freshData.totalDevices;
      userAnalytics.totalAdPlayTime = freshData.totalAdPlayTime;
      userAnalytics.totalAdImpressions = freshData.totalAdImpressions;
      userAnalytics.totalQRScans = freshData.totalQRScans;
      userAnalytics.averageAdCompletionRate = freshData.averageAdCompletionRate;
      userAnalytics.qrScanConversionRate = freshData.qrScanConversionRate;
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
}

module.exports = UserAnalyticsService;
