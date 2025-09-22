const ScreenTracking = require('../models/screenTracking');
const deviceStatusService = require('../services/deviceStatusService');
const { checkAuth } = require('../middleware/auth');

const resolvers = {
  Query: {
    getAllScreens: async (_, { filters }, { admin, superAdmin }) => {
      // Check authentication
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const now = new Date();
        const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
        
        // Mark devices as offline if lastSeen is older than 2 minutes
        await ScreenTracking.updateMany(
          { 
            'devices.isOnline': true,
            'devices.lastSeen': { $lt: twoMinutesAgo }
          },
          { 
            $set: { 
              'devices.$.isOnline': false,
              isOnline: false
            } 
          },
          { multi: true }
        );
        
        let query = {};
        
        if (filters) {
          if (filters.screenType) query.screenType = filters.screenType;
          if (filters.materialId) query.materialId = filters.materialId;
          
          if (filters.status === 'online') {
            query['devices.isOnline'] = true;
            query['devices.lastSeen'] = { $gte: twoMinutesAgo };
            query.isOnline = true;
          }
          if (filters.status === 'offline') {
            query['$or'] = [
              { 'devices.isOnline': false },
              { 'devices.lastSeen': { $lt: twoMinutesAgo } },
              { 'devices': { $exists: false } },
              { isOnline: false }
            ];
          }
          if (filters.status === 'displaying') query['screenMetrics.isDisplaying'] = true;
          if (filters.status === 'maintenance') query['screenMetrics.maintenanceMode'] = true;
        }

        const screens = await ScreenTracking.find(query);
        
        // Auto-sync root isOnline with devices array before processing
        for (const screen of screens) {
          if (screen.devices && screen.devices.length > 0) {
            const hasOnlineDevice = screen.devices.some(device => device.isOnline);
            if (screen.isOnline !== hasOnlineDevice) {
              screen.isOnline = hasOnlineDevice;
              await screen.save();
            }
          }
          
          // Sync with DeviceStatusManager
          const allStatuses = deviceStatusService.getAllDeviceStatuses();
          const materialStatus = allStatuses.find(status => {
            return status.deviceId === screen.materialId || 
                   status.deviceId.includes(screen.materialId) ||
                   screen.materialId.includes(status.deviceId);
          });
          
          if (materialStatus) {
            console.log(`🔄 [AUTO-SYNC] Found WebSocket status for material ${screen.materialId}: ${materialStatus.deviceId} -> ${materialStatus.isOnline ? 'ONLINE' : 'OFFLINE'}`);
          }
        }
        
        const screensData = screens.map(screen => {
          // Use DeviceStatusManager as the source of truth
          let deviceStatus = deviceStatusService.getDeviceStatus(screen.deviceId);
          let isActuallyOnline = false;
          
          if (deviceStatus) {
            isActuallyOnline = deviceStatus.isOnline;
          } else {
            // Fallback to database status
            isActuallyOnline = screen.isOnline;
          }
          
          let displayStatus = 'OFFLINE';
          if (isActuallyOnline) {
            if (screen.screenMetrics?.maintenanceMode) {
              displayStatus = 'MAINTENANCE';
            } else if (screen.screenMetrics?.isDisplaying) {
              displayStatus = 'ACTIVE';
            } else {
              displayStatus = 'DISPLAY_OFF';
            }
          }
          
          // Get formatted location data (same as REST API)
          let locationData = null;
          if (screen.currentLocation) {
            // Check if it's a GeoJSON Point format (from database)
            if (screen.currentLocation.type === 'Point' && screen.currentLocation.coordinates) {
              locationData = {
                lat: screen.currentLocation.coordinates[1], // latitude
                lng: screen.currentLocation.coordinates[0], // longitude
                timestamp: screen.currentLocation.timestamp,
                speed: screen.currentLocation.speed,
                heading: screen.currentLocation.heading,
                accuracy: screen.currentLocation.accuracy,
                address: screen.currentLocation.address
              };
            } else if (typeof screen.currentLocation === 'string') {
              try {
                locationData = JSON.parse(screen.currentLocation);
              } catch (e) {
                locationData = { address: screen.currentLocation };
              }
            } else if (typeof screen.currentLocation === 'object') {
              locationData = screen.currentLocation;
            }
          }

          // Parse daily ad stats if it's a string
          let dailyAdStats = null;
          if (screen.screenMetrics?.dailyAdStats) {
            if (typeof screen.screenMetrics.dailyAdStats === 'string') {
              try {
                dailyAdStats = JSON.parse(screen.screenMetrics.dailyAdStats);
              } catch (e) {
                dailyAdStats = { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 };
              }
            } else if (typeof screen.screenMetrics.dailyAdStats === 'object') {
              dailyAdStats = screen.screenMetrics.dailyAdStats;
            }
          }

          // Get last seen location data (virtual field from model)
          let lastSeenLocationData = null;
          if (screen.lastSeenLocation) {
            // Check if it's a GeoJSON Point format (from database)
            if (screen.lastSeenLocation.type === 'Point' && screen.lastSeenLocation.coordinates) {
              lastSeenLocationData = {
                lat: screen.lastSeenLocation.coordinates[1], // latitude
                lng: screen.lastSeenLocation.coordinates[0], // longitude
                timestamp: screen.lastSeenLocation.timestamp,
                speed: screen.lastSeenLocation.speed,
                heading: screen.lastSeenLocation.heading,
                accuracy: screen.lastSeenLocation.accuracy,
                address: screen.lastSeenLocation.address
              };
            } else {
              // Already properly formatted
              lastSeenLocationData = screen.lastSeenLocation;
            }
          }

          return {
            deviceId: screen.deviceId,
            materialId: screen.materialId,
            screenType: screen.screenType,
            carGroupId: screen.carGroupId,
            slotNumber: screen.slotNumber,
            isOnline: isActuallyOnline,
            currentLocation: locationData,
            lastSeen: screen.lastSeen,
            lastSeenDisplay: screen.lastSeenDisplay, // Virtual field from model
            lastSeenLocation: lastSeenLocationData, // Virtual field from model
            currentHours: screen.currentHoursToday || 0,
            hoursRemaining: screen.hoursRemaining || 0,
            isCompliant: screen.isCompliantToday || false,
            totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
            averageDailyHours: screen.averageDailyHours || 0,
            complianceRate: screen.complianceRate || 0,
            totalHoursOnline: screen.totalHoursOnline || 0,
            totalDistanceTraveled: screen.totalDistanceTraveled || 0,
            displayStatus: displayStatus,
            alerts: screen.alerts || [],
            screenMetrics: {
              isDisplaying: screen.screenMetrics?.isDisplaying || false,
              brightness: screen.screenMetrics?.brightness || 50,
              volume: screen.screenMetrics?.volume || 50,
              adPlayCount: screen.screenMetrics?.adPlayCount || 0,
              maintenanceMode: screen.screenMetrics?.maintenanceMode || false,
              currentAd: screen.screenMetrics?.currentAd || null,
              dailyAdStats: dailyAdStats || { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 },
              adPerformance: screen.screenMetrics?.adPerformance || [],
              displayHours: screen.screenMetrics?.displayHours || 0,
              lastAdPlayed: screen.screenMetrics?.lastAdPlayed || null
            }
          };
        });
        
        return {
          screens: screensData,
          totalScreens: screens.length,
          onlineScreens: screens.filter(s => s.isOnline).length,
          displayingScreens: screens.filter(s => s.screenMetrics?.isDisplaying).length,
          maintenanceScreens: screens.filter(s => s.screenMetrics?.maintenanceMode).length
        };
      } catch (error) {
        console.error('Error in getAllScreens:', error);
        throw new Error('Failed to fetch screens data');
      }
    },

    getScreenStatus: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const screen = await ScreenTracking.findOne({ deviceId });
        if (!screen) {
          throw new Error('Screen not found');
        }

        const deviceStatus = deviceStatusService.getDeviceStatus(deviceId);
        const isActuallyOnline = deviceStatus ? deviceStatus.isOnline : screen.isOnline;

        return {
          deviceId: screen.deviceId,
          materialId: screen.materialId,
          screenType: screen.screenType,
          carGroupId: screen.carGroupId,
          slotNumber: screen.slotNumber,
          isOnline: isActuallyOnline,
          currentLocation: screen.getFormattedLocation ? screen.getFormattedLocation() : screen.currentLocation,
          lastSeen: screen.lastSeen,
          lastSeenDisplay: screen.lastSeenDisplay,
          lastSeenLocation: screen.lastSeenLocation,
          currentHours: screen.currentHoursToday || 0,
          hoursRemaining: screen.hoursRemaining || 0,
          isCompliant: screen.isCompliantToday || false,
          totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
          averageDailyHours: screen.averageDailyHours || 0,
          complianceRate: screen.complianceRate || 0,
          totalHoursOnline: screen.totalHoursOnline || 0,
          totalDistanceTraveled: screen.totalDistanceTraveled || 0,
          displayStatus: isActuallyOnline ? (screen.screenMetrics?.maintenanceMode ? 'MAINTENANCE' : (screen.screenMetrics?.isDisplaying ? 'ACTIVE' : 'DISPLAY_OFF')) : 'OFFLINE',
          alerts: screen.alerts || [],
          screenMetrics: screen.screenMetrics || {
            isDisplaying: false,
            brightness: 50,
            volume: 50,
            adPlayCount: 0,
            maintenanceMode: false,
            currentAd: null,
            dailyAdStats: "{}",
            adPerformance: [],
            displayHours: 0,
            lastAdPlayed: null
          }
        };
      } catch (error) {
        console.error('Error in getScreenStatus:', error);
        throw new Error('Failed to fetch screen status');
      }
    },

    getComplianceReport: async (_, { date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      // For now, return a basic compliance report
      // This would need to be implemented based on your business logic
      return {
        date: date || new Date().toISOString().split('T')[0],
        totalTablets: 0,
        onlineTablets: 0,
        compliantTablets: 0,
        nonCompliantTablets: 0,
        averageHours: 0,
        averageDistance: 0,
        screens: []
      };
    },

    getAdAnalytics: async (_, { date, materialId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        // Get all screens for analytics
        const screens = await ScreenTracking.find({});
        
        const totalDevices = screens.length;
        const onlineDevices = screens.filter(s => s.isOnline).length;
        const totalAdsPlayed = screens.reduce((sum, s) => sum + (s.screenMetrics?.adPlayCount || 0), 0);
        const totalDisplayHours = screens.reduce((sum, s) => sum + (s.screenMetrics?.displayHours || 0), 0);
        
        const devices = screens.map(screen => {
          // Parse daily ad stats if it's a string
          let dailyStats = null;
          if (screen.screenMetrics?.dailyAdStats) {
            if (typeof screen.screenMetrics.dailyAdStats === 'string') {
              try {
                dailyStats = JSON.parse(screen.screenMetrics.dailyAdStats);
              } catch (e) {
                dailyStats = { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 };
              }
            } else if (typeof screen.screenMetrics.dailyAdStats === 'object') {
              dailyStats = screen.screenMetrics.dailyAdStats;
            }
          }

          return {
            deviceId: screen.deviceId,
            materialId: screen.materialId,
            screenType: screen.screenType,
            currentAd: screen.screenMetrics?.currentAd ? JSON.stringify(screen.screenMetrics.currentAd) : null,
            dailyStats: dailyStats || { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 },
            totalAdsPlayed: screen.screenMetrics?.adPlayCount || 0,
            displayHours: screen.screenMetrics?.displayHours || 0,
            adPerformance: screen.screenMetrics?.adPerformance || [],
            lastAdPlayed: screen.screenMetrics?.lastAdPlayed || null,
            isOnline: screen.isOnline,
            lastSeen: screen.lastSeen
          };
        });

        return {
          summary: {
            totalDevices,
            onlineDevices,
            totalAdsPlayed,
            totalDisplayHours,
            averageAdsPerDevice: totalDevices > 0 ? totalAdsPlayed / totalDevices : 0,
            averageDisplayHours: totalDevices > 0 ? totalDisplayHours / totalDevices : 0
          },
          devices
        };
      } catch (error) {
        console.error('Error in getAdAnalytics:', error);
        throw new Error('Failed to fetch ad analytics');
      }
    },

    getTabletsList: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const screens = await ScreenTracking.find({});
        return screens.map(screen => ({
          id: screen._id,
          deviceId: screen.deviceId,
          materialId: screen.materialId,
          screenType: screen.screenType,
          status: screen.isOnline ? 'online' : 'offline',
          lastSeen: screen.lastSeen,
          location: screen.getFormattedLocation ? screen.getFormattedLocation() : screen.currentLocation,
          batteryLevel: 100, // Placeholder
          isOnline: screen.isOnline
        }));
      } catch (error) {
        console.error('Error in getTabletsList:', error);
        return [];
      }
    },

    getAdsDeployments: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      // Placeholder implementation
      return [];
    },

    getAdsForMaterial: async (_, { materialId, slotNumber }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      // Placeholder implementation
      return [];
    },

    getScreenPath: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      // Placeholder implementation
      return {
        deviceId,
        date: date || new Date().toISOString().split('T')[0],
        path: [],
        totalDistance: 0,
        totalHours: 0
      };
    },

    getAdAnalytics: async (_, { date, materialId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        let query = { isActive: true };
        if (materialId) {
          query.materialId = materialId;
        }

        const allTablets = await ScreenTracking.find(query);
        
        const analytics = allTablets.map(tablet => ({
          deviceId: tablet.deviceId,
          materialId: tablet.materialId,
          screenType: tablet.screenType,
          currentAd: tablet.screenMetrics?.currentAd || null,
          dailyStats: tablet.screenMetrics?.dailyAdStats || null,
          totalAdsPlayed: tablet.screenMetrics?.adPlayCount || 0,
          displayHours: tablet.screenMetrics?.displayHours || 0,
          adPerformance: tablet.screenMetrics?.adPerformance || [],
          lastAdPlayed: tablet.screenMetrics?.lastAdPlayed || null,
          isOnline: tablet.isOnline,
          lastSeen: tablet.lastSeen
        }));

        // Calculate summary statistics
        const summary = {
          totalDevices: analytics.length,
          onlineDevices: analytics.filter(a => a.isOnline).length,
          totalAdsPlayed: analytics.reduce((sum, a) => sum + a.totalAdsPlayed, 0),
          totalDisplayHours: analytics.reduce((sum, a) => sum + a.displayHours, 0),
          averageAdsPerDevice: analytics.length > 0 ? analytics.reduce((sum, a) => sum + a.totalAdsPlayed, 0) / analytics.length : 0,
          averageDisplayHours: analytics.length > 0 ? analytics.reduce((sum, a) => sum + a.displayHours, 0) / analytics.length : 0
        };

        return {
          summary: summary,
          devices: analytics
        };
      } catch (error) {
        console.error('Error in getAdAnalytics:', error);
        throw new Error('Failed to fetch ad analytics');
      }
    },

    getDeviceAdAnalytics: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const screen = await ScreenTracking.findOne({ deviceId });
        if (!screen) {
          throw new Error('Device not found');
        }

        return {
          deviceId: screen.deviceId,
          date: date || new Date().toISOString().split('T')[0],
          totalAdsPlayed: screen.screenMetrics?.adPlayCount || 0,
          totalDisplayHours: screen.screenMetrics?.displayHours || 0,
          adPerformance: screen.screenMetrics?.adPerformance || [],
          dailyStats: [{
            date: date || new Date().toISOString().split('T')[0],
            adsPlayed: screen.screenMetrics?.adPlayCount || 0,
            displayHours: screen.screenMetrics?.displayHours || 0,
            revenue: 0 // Placeholder for revenue calculation
          }]
        };
      } catch (error) {
        console.error('Error in getDeviceAdAnalytics:', error);
        throw new Error('Failed to fetch device ad analytics');
      }
    }
  },

  Mutation: {
    // Placeholder mutations - these would need to be implemented based on your business logic
    syncAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens synced successfully' };
    },

    playAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens started playing' };
    },

    pauseAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens paused' };
    },

    stopAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens stopped' };
    },

    restartAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens restarted' };
    },

    emergencyStopAll: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Emergency stop activated for all screens' };
    },

    lockdownAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens locked down' };
    },

    unlockAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens unlocked' };
    },

    // Individual screen operations
    updateScreenMetrics: async (_, { deviceId, metrics }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen metrics updated', data: null };
    },

    startScreenSession: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen session started' };
    },

    endScreenSession: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen session ended' };
    },

    trackAdPlayback: async (_, { deviceId, adId, adTitle, adDuration, viewTime }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad playback tracked' };
    },

    endAdPlayback: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad playback ended' };
    },

    updateDriverActivity: async (_, { deviceId, isActive }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Driver activity updated' };
    },

    resolveAlert: async (_, { deviceId, alertIndex }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Alert resolved' };
    },

    deployAdToScreens: async (_, { adId, targetScreens, schedule }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad deployed to screens' };
    },

    updateScreenBrightness: async (_, { deviceId, brightness }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen brightness updated' };
    },

    updateScreenVolume: async (_, { deviceId, volume }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen volume updated' };
    },

    setMaintenanceMode: async (_, { deviceId, enabled }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Maintenance mode updated' };
    },

    playScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen started playing' };
    },

    pauseScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen paused' };
    },

    stopScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen stopped' };
    },

    restartScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen restarted' };
    },

    skipToNextAd: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Skipped to next ad' };
    }
  }
};

module.exports = resolvers;