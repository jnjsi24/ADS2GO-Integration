const DeviceTracking = require('../models/deviceTracking');
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
        await DeviceTracking.updateMany(
          { 
            'slots.isOnline': true,
            'slots.lastSeen': { $lt: twoMinutesAgo }
          },
          { 
            $set: { 
              'slots.$.isOnline': false,
              isOnline: false
            } 
          },
          { multi: true }
        );
        
        let query = {
          // Only fetch materials that have actual connected devices (not just temporary records)
          $and: [
            {
              $or: [
                { 'slots.0': { $exists: true } }, // Has at least one device in slots array
                { 
                  'slots.deviceId': { $not: { $regex: /^TEMP-/ } }, // Not a temporary device ID
                  'slots.deviceId': { $exists: true, $ne: null } // Has a real device ID
                }
              ]
            },
            {
              $nor: [{ 'slots.deviceId': { $regex: /^TEMP-/ } }] // Exclude if any device in array is temporary
            },
            {
              $or: [
                { 'slots.deviceId': { $regex: /TABLET/ } }, // Only include devices with TABLET in name
                { 'slots': { $exists: false } }, // Or no slots array (legacy records)
                { 
                  'slots': { $size: 0 }, // Or empty slots array
                  'slots.deviceId': { $regex: /TABLET/ } // But main deviceId has TABLET
                }
              ]
            }
          ]
        };
        
        if (filters) {
          if (filters.screenType) query.screenType = filters.screenType;
          if (filters.materialId) query.materialId = filters.materialId;
          
          if (filters.status === 'online') {
            query['slots.isOnline'] = true;
            query['slots.lastSeen'] = { $gte: twoMinutesAgo };
            query.isOnline = true;
          }
          if (filters.status === 'offline') {
            query['$or'] = [
              { 'slots.isOnline': false },
              { 'slots.lastSeen': { $lt: twoMinutesAgo } },
              { 'slots': { $exists: false } },
              { isOnline: false }
            ];
          }
          if (filters.status === 'displaying') query['isDisplaying'] = true;
          if (filters.status === 'maintenance') query['maintenanceMode'] = true;
        }

        const screens = await DeviceTracking.find(query);
        
        // Auto-sync root isOnline with slots array before processing
        for (const screen of screens) {
          if (screen.slots && screen.slots.length > 0) {
            const hasOnlineDevice = screen.slots.some(slot => slot.isOnline);
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
        
        // Process screens to create individual device records
        const individualScreens = [];
        
        screens.forEach(screen => {
          if (screen.slots && screen.slots.length > 0) {
            // New multi-device structure: create individual records per device
            screen.slots.forEach((slot, index) => {
              // Use DeviceStatusManager as the source of truth for each device
              let deviceStatus = deviceStatusService.getDeviceStatus(slot.deviceId);
              let isActuallyOnline = false;
              
              if (deviceStatus) {
                isActuallyOnline = deviceStatus.isOnline;
              } else {
                // Fallback to slot status
                isActuallyOnline = slot.isOnline;
              }
              
              let displayStatus = 'OFFLINE';
              if (isActuallyOnline) {
                if (screen.maintenanceMode) {
                  displayStatus = 'MAINTENANCE';
                } else if (screen.isDisplaying) {
                  displayStatus = 'PLAYING';
                } else {
                  displayStatus = 'ONLINE';
                }
              }
              
              // Parse location data if it's a string
              let locationData = null;
              const deviceLocation = screen.currentLocation;
              if (deviceLocation) {
                if (typeof deviceLocation === 'string') {
                  try {
                    locationData = JSON.parse(deviceLocation);
                  } catch (e) {
                    locationData = { address: deviceLocation };
                  }
                } else if (typeof deviceLocation === 'object') {
                  locationData = deviceLocation;
                }
              }

              // Parse daily ad stats if it's a string
              let dailyAdStats = null;
              // DeviceTracking doesn't have screenMetrics, use adPerformance instead
              if (screen.adPerformance && screen.adPerformance.length > 0) {
                const totalAdsPlayed = screen.adPerformance.reduce((sum, ad) => sum + ad.playCount, 0);
                const totalDisplayTime = screen.adPerformance.reduce((sum, ad) => sum + ad.totalViewTime, 0);
                const uniqueAdsPlayed = screen.adPerformance.length;
                const averageAdDuration = totalAdsPlayed > 0 ? totalDisplayTime / totalAdsPlayed : 0;
                const adCompletionRate = totalAdsPlayed > 0 ? screen.adPerformance.reduce((sum, ad) => sum + ad.completionRate, 0) / screen.adPerformance.length : 0;
                
                dailyAdStats = {
                  totalAdsPlayed,
                  totalDisplayTime,
                  uniqueAdsPlayed,
                  averageAdDuration,
                  adCompletionRate
                };
              } else {
                dailyAdStats = { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 };
              }

              individualScreens.push({
                deviceId: slot.deviceId,
                displayId: `${screen.materialId}-SLOT-${slot.slotNumber || (index + 1)}`, // Unique identifier for frontend
                materialId: screen.materialId,
                screenType: screen.screenType,
                carGroupId: screen.carGroupId,
                slotNumber: slot.slotNumber,
                isOnline: isActuallyOnline,
                currentLocation: locationData,
                lastSeen: slot.lastSeen,
                currentHours: screen.totalHoursOnline || 0,
                hoursRemaining: Math.max(0, 8 - (screen.totalHoursOnline || 0)), // 8 hours target
                totalDistanceToday: screen.totalDistanceTraveled || 0,
                displayStatus: displayStatus,
                screenMetrics: {
                  isDisplaying: screen.isDisplaying || false,
                  brightness: slot.brightness || 50,
                  volume: slot.volume || 50,
                  adPlayCount: screen.totalAdPlays || 0,
                  maintenanceMode: screen.maintenanceMode || false,
                  currentAd: screen.currentAd || null,
                  dailyAdStats: dailyAdStats || { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 },
                  adPerformance: screen.adPerformance || [],
                  displayHours: screen.totalHoursOnline || 0,
                  lastAdPlayed: screen.adPerformance && screen.adPerformance.length > 0 ? screen.adPerformance[screen.adPerformance.length - 1].lastPlayed : null
                }
              });
            });
          } else {
            // No slots - skip this screen as DeviceTracking requires slots
            console.log(`⚠️ Skipping screen ${screen.materialId} - no slots found`);
          }
        });
        
        const screensData = individualScreens;
        
        return {
          screens: screensData,
          totalScreens: screensData.length,
          onlineScreens: screensData.filter(s => s.isOnline).length,
          displayingScreens: screensData.filter(s => s.screenMetrics?.isDisplaying).length,
          maintenanceScreens: screensData.filter(s => s.screenMetrics?.maintenanceMode).length
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
        const screen = await DeviceTracking.findOne({ 'slots.deviceId': deviceId });
        if (!screen) {
          throw new Error('Screen not found');
        }

        const slot = screen.slots.find(s => s.deviceId === deviceId);
        if (!slot) {
          throw new Error('Device slot not found');
        }

        const deviceStatus = deviceStatusService.getDeviceStatus(deviceId);
        const isActuallyOnline = deviceStatus ? deviceStatus.isOnline : slot.isOnline;

        return {
          deviceId: slot.deviceId,
          materialId: screen.materialId,
          screenType: screen.screenType,
          carGroupId: screen.carGroupId,
          slotNumber: slot.slotNumber,
          isOnline: isActuallyOnline,
          currentLocation: screen.currentLocation,
          lastSeen: slot.lastSeen,
          currentHours: screen.totalHoursOnline || 0,
          hoursRemaining: Math.max(0, 8 - (screen.totalHoursOnline || 0)),
          totalDistanceToday: screen.totalDistanceTraveled || 0,
          displayStatus: isActuallyOnline ? 'ONLINE' : 'OFFLINE',
          screenMetrics: {
            isDisplaying: screen.isDisplaying || false,
            brightness: slot.brightness || 50,
            volume: slot.volume || 50,
            adPlayCount: screen.totalAdPlays || 0,
            maintenanceMode: screen.maintenanceMode || false,
            currentAd: screen.currentAd || null,
            dailyAdStats: {},
            adPerformance: screen.adPerformance || [],
            displayHours: screen.totalHoursOnline || 0,
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

      try {
        const DeviceTracking = require('../models/deviceTracking');
        const Tablet = require('../models/Tablet');
        const targetDate = date ? new Date(date) : new Date();

        // First, get all registered devices from tablet system
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
        
        console.log('📱 Registered devices from tablet system:', registeredDevices.size);

        // Get all device tracking records for registered devices
        const registeredDeviceIds = Array.from(registeredDevices.keys());
        const registeredMaterialIds = Array.from(new Set(Array.from(registeredDevices.values()).map(info => info.materialId)));
        
        // Query by materialId (new system) and deviceId in slots
        const allDevices = await DeviceTracking.find({ 
          $or: [
            { 'slots.deviceId': { $in: registeredDeviceIds } },
            { materialId: { $in: registeredMaterialIds } }
          ]
        });
        
        console.log(`📊 Found ${allDevices.length} device tracking records`);

        // Initialize screens array to collect individual device records
        const individualScreens = [];
        const seenDisplayIds = new Set();
        let totalOnlineScreens = 0;
        let totalCompliantScreens = 0;
        let totalHours = 0;
        let totalDistance = 0;

        // Process each device tracking record
        allDevices.forEach(device => {
          // Process each slot in the device
          if (device.slots && device.slots.length > 0) {
            device.slots.forEach(slot => {
              if (slot.deviceId && !seenDisplayIds.has(slot.deviceId)) {
                seenDisplayIds.add(slot.deviceId);
                
                const isOnline = slot.isOnline || false;
                const isCompliant = device.currentSession?.complianceStatus === 'COMPLIANT';
                
                if (isOnline) totalOnlineScreens++;
                if (isCompliant) totalCompliantScreens++;
                
                totalHours += device.totalHoursOnline || 0;
                totalDistance += device.totalDistanceTraveled || 0;

                individualScreens.push({
                  deviceId: slot.deviceId,
                  materialId: device.materialId,
                  screenType: device.screenType || 'HEADDRESS',
                  carGroupId: device.carGroupId,
                  slotNumber: slot.slotNumber,
                  isOnline,
                  currentLocation: device.currentLocation,
                  lastSeen: slot.lastSeen || device.lastSeen,
                  currentHours: device.currentHoursToday || 0,
                  hoursRemaining: device.hoursRemaining || 0,
                  isCompliant,
                  totalDistanceToday: device.currentSession?.totalDistanceTraveled || 0,
                  displayStatus: isOnline ? 'ONLINE' : 'OFFLINE',
                  screenMetrics: {
                    isDisplaying: device.isDisplaying || false,
                    brightness: slot.brightness || 100,
                    volume: slot.volume || 50,
                    adPlayCount: device.totalAdPlays || 0,
                    maintenanceMode: device.maintenanceMode || false,
                    currentAd: device.currentAd,
                    displayHours: device.totalHoursOnline || 0
                  }
                });
              }
            });
          }
        });

        return {
          date: targetDate.toISOString().split('T')[0],
          totalTablets: individualScreens.length,
          onlineTablets: totalOnlineScreens,
          compliantTablets: totalCompliantScreens,
          nonCompliantTablets: individualScreens.length - totalCompliantScreens,
          averageHours: individualScreens.length > 0 ? Math.round((totalHours / individualScreens.length) * 100) / 100 : 0,
          averageDistance: individualScreens.length > 0 ? Math.round((totalDistance / individualScreens.length) * 100) / 100 : 0,
          screens: individualScreens
        };

      } catch (error) {
        console.error('Error getting compliance report:', error);
        throw new Error('Failed to get compliance report: ' + error.message);
      }
    },

    getAdAnalytics: async (_, { date, materialId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        // Get all screens for analytics
        const screens = await DeviceTracking.find({});
        
        const totalDevices = screens.length;
        const onlineDevices = screens.filter(s => s.isOnline).length;
        const totalAdsPlayed = screens.reduce((sum, s) => sum + (s.totalAdPlays || 0), 0);
        const totalDisplayHours = screens.reduce((sum, s) => sum + (s.totalHoursOnline || 0), 0);
        
        const devices = screens.map(screen => {
          // Calculate daily stats from adPerformance
          let dailyStats = null;
          if (screen.adPerformance && screen.adPerformance.length > 0) {
            const totalAdsPlayed = screen.adPerformance.reduce((sum, ad) => sum + ad.playCount, 0);
            const totalDisplayTime = screen.adPerformance.reduce((sum, ad) => sum + ad.totalViewTime, 0);
            const uniqueAdsPlayed = screen.adPerformance.length;
            const averageAdDuration = totalAdsPlayed > 0 ? totalDisplayTime / totalAdsPlayed : 0;
            const adCompletionRate = totalAdsPlayed > 0 ? screen.adPerformance.reduce((sum, ad) => sum + ad.completionRate, 0) / screen.adPerformance.length : 0;
            
            dailyStats = {
              totalAdsPlayed,
              totalDisplayTime,
              uniqueAdsPlayed,
              averageAdDuration,
              adCompletionRate
            };
          } else {
            dailyStats = { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 };
          }

          return {
            deviceId: screen.slots && screen.slots.length > 0 ? screen.slots[0].deviceId : null,
            materialId: screen.materialId,
            screenType: screen.screenType,
            currentAd: screen.currentAd ? JSON.stringify(screen.currentAd) : null,
            dailyStats: dailyStats,
            totalAdsPlayed: screen.totalAdPlays || 0,
            displayHours: screen.totalHoursOnline || 0,
            adPerformance: screen.adPerformance || [],
            lastAdPlayed: screen.adPerformance && screen.adPerformance.length > 0 ? screen.adPerformance[screen.adPerformance.length - 1].lastPlayed : null,
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
        const screens = await DeviceTracking.find({});
        const tablets = [];
        
        screens.forEach(screen => {
          if (screen.slots && screen.slots.length > 0) {
            screen.slots.forEach(slot => {
              if (slot.deviceId) {
                tablets.push({
                  id: `${screen._id}-${slot.slotNumber}`,
                  deviceId: slot.deviceId,
                  materialId: screen.materialId,
                  screenType: screen.screenType,
                  status: slot.isOnline ? 'online' : 'offline',
                  lastSeen: slot.lastSeen,
                  location: screen.currentLocation,
                  batteryLevel: 100, // Placeholder
                  isOnline: slot.isOnline
                });
              }
            });
          }
        });
        
        return tablets;
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

    getDeviceAdAnalytics: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const screen = await DeviceTracking.findOne({ 'slots.deviceId': deviceId });
        if (!screen) {
          throw new Error('Device not found');
        }

        const slot = screen.slots.find(s => s.deviceId === deviceId);
        if (!slot) {
          throw new Error('Device slot not found');
        }

        return {
          deviceId: slot.deviceId,
          date: date || new Date().toISOString().split('T')[0],
          totalAdsPlayed: screen.totalAdPlays || 0,
          totalDisplayHours: screen.totalHoursOnline || 0,
          adPerformance: screen.adPerformance || [],
          dailyStats: JSON.stringify({
            totalAdsPlayed: screen.totalAdPlays || 0,
            totalDisplayTime: screen.totalAdPlayTime || 0,
            uniqueAdsPlayed: screen.adPerformance ? screen.adPerformance.length : 0,
            averageAdDuration: screen.adPerformance && screen.adPerformance.length > 0 ? 
              screen.adPerformance.reduce((sum, ad) => sum + ad.averageViewTime, 0) / screen.adPerformance.length : 0,
            adCompletionRate: screen.adPerformance && screen.adPerformance.length > 0 ? 
              screen.adPerformance.reduce((sum, ad) => sum + ad.completionRate, 0) / screen.adPerformance.length : 0
          })
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
