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
        
        let query = {
          // Only fetch materials that have actual connected devices (not just temporary records)
          $and: [
            {
              $or: [
                { 'devices.0': { $exists: true } }, // Has at least one device in devices array
                { 
                  deviceId: { $not: { $regex: /^TEMP-/ } }, // Not a temporary device ID
                  deviceId: { $exists: true, $ne: null } // Has a real device ID
                }
              ]
            },
            {
              $nor: [{ 'devices.deviceId': { $regex: /^TEMP-/ } }] // Exclude if any device in array is temporary
            },
            {
              $or: [
                { 'devices.deviceId': { $regex: /TABLET/ } }, // Only include devices with TABLET in name
                { 'devices': { $exists: false } }, // Or no devices array (legacy records)
                { 
                  'devices': { $size: 0 }, // Or empty devices array
                  deviceId: { $regex: /TABLET/ } // But main deviceId has TABLET
                }
              ]
            }
          ]
        };
        
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

        const screens = await DeviceTracking.find(query);
        
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
        
        // Process screens to create individual device records
        const individualScreens = [];
        
        screens.forEach(screen => {
          if (screen.devices && screen.devices.length > 0) {
            // New multi-device structure: create individual records per device
            screen.devices.forEach((device, index) => {
              // Use DeviceStatusManager as the source of truth for each device
              let deviceStatus = deviceStatusService.getDeviceStatus(device.deviceId);
              let isActuallyOnline = false;
              
              if (deviceStatus) {
                isActuallyOnline = deviceStatus.isOnline;
              } else {
                // Fallback to device status
                isActuallyOnline = device.isOnline;
              }
              
              let displayStatus = 'OFFLINE';
              if (isActuallyOnline) {
                if (screen.screenMetrics?.maintenanceMode) {
                  displayStatus = 'MAINTENANCE';
                } else if (screen.screenMetrics?.isDisplaying) {
                  displayStatus = 'PLAYING';
                } else {
                  displayStatus = 'ONLINE';
                }
              }
              
              // Parse location data if it's a string
              let locationData = null;
              const deviceLocation = device.currentLocation || screen.currentLocation;
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

              individualScreens.push({
                deviceId: device.deviceId,
                displayId: `${screen.materialId}-SLOT-${device.slotNumber || (index + 1)}`, // Unique identifier for frontend
                materialId: screen.materialId,
                screenType: screen.screenType,
                carGroupId: screen.carGroupId,
                slotNumber: device.slotNumber,
                isOnline: isActuallyOnline,
                currentLocation: locationData,
                lastSeen: device.lastSeen,
                currentHours: device.totalHoursOnline || 0,
                hoursRemaining: Math.max(0, 8 - (device.totalHoursOnline || 0)), // 8 hours target
                totalDistanceToday: device.totalDistanceTraveled || 0,
                displayStatus: displayStatus,
                screenMetrics: {
                  isDisplaying: screen.screenMetrics?.isDisplaying || false,
                  brightness: screen.screenMetrics?.brightness || 50,
                  volume: screen.screenMetrics?.volume || 50,
                  adPlayCount: screen.screenMetrics?.adPlayCount || 0,
                  maintenanceMode: screen.screenMetrics?.maintenanceMode || false,
                  currentAd: screen.screenMetrics?.currentAd || null,
                  dailyAdStats: dailyAdStats || { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 },
                  adPerformance: screen.screenMetrics?.adPerformance || [],
                  displayHours: device.totalHoursOnline || 0,
                  lastAdPlayed: screen.screenMetrics?.lastAdPlayed || null
                }
              });
            });
          } else {
            // Legacy single-device structure: use root-level fields for backward compatibility
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
                displayStatus = 'PLAYING';
              } else {
                displayStatus = 'ONLINE';
              }
            }
            
            // Parse location data if it's a string
            let locationData = null;
            if (screen.currentLocation) {
              if (typeof screen.currentLocation === 'string') {
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

            individualScreens.push({
              deviceId: screen.deviceId,
              displayId: `${screen.materialId}-SLOT-${screen.slotNumber || 1}`,
              materialId: screen.materialId,
              screenType: screen.screenType,
              carGroupId: screen.carGroupId,
              slotNumber: screen.slotNumber,
              isOnline: isActuallyOnline,
              currentLocation: locationData,
              lastSeen: screen.lastSeen,
              currentHours: screen.currentHoursToday || 0,
              hoursRemaining: screen.hoursRemaining || 0,
              totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
              displayStatus: displayStatus,
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
            });
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
        const screen = await DeviceTracking.findOne({ deviceId });
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
          currentHours: screen.currentHoursToday || 0,
          hoursRemaining: screen.hoursRemaining || 0,
          totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
          displayStatus: isActuallyOnline ? 'ONLINE' : 'OFFLINE',
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
        const screens = await DeviceTracking.find({});
        
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
        const screens = await DeviceTracking.find({});
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

    getDeviceAdAnalytics: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        const screen = await DeviceTracking.findOne({ deviceId });
        if (!screen) {
          throw new Error('Device not found');
        }

        return {
          deviceId: screen.deviceId,
          date: date || new Date().toISOString().split('T')[0],
          totalAdsPlayed: screen.screenMetrics?.adPlayCount || 0,
          totalDisplayHours: screen.screenMetrics?.displayHours || 0,
          adPerformance: screen.screenMetrics?.adPerformance || [],
          dailyStats: screen.screenMetrics?.dailyAdStats || "{}"
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
      
      try {
        console.log('🔄 [SyncAll] Starting sync all command...');
        
        // Get the device status service instance
        const deviceStatusService = require('../services/deviceStatusService');
        console.log('🔄 [SyncAll] Device status service loaded');
        
        const service = deviceStatusService;
        console.log('🔄 [SyncAll] Device status service instance obtained');
        
        // Group devices by material ID
        const devicesByMaterial = new Map();
        const activeConnections = service.activeConnections || new Map();
        
        console.log(`🔄 [SyncAll] Found ${activeConnections.size} active connections`);
        
        // Group playback connections by material ID
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) {
            const materialId = ws.materialId;
            if (materialId) {
              if (!devicesByMaterial.has(materialId)) {
                devicesByMaterial.set(materialId, []);
              }
              devicesByMaterial.get(materialId).push({ deviceId, ws });
            }
          }
        }
        
        console.log(`🔄 [SyncAll] Found ${devicesByMaterial.size} materials with active devices`);
        
        let totalSyncedDevices = 0;
        const syncResults = [];
        
        // Sync devices within each material group
        for (const [materialId, devices] of devicesByMaterial) {
          if (devices.length >= 1) { // Allow sync even with single device for testing
            console.log(`🔄 [SyncAll] Syncing ${devices.length} devices for material: ${materialId}`);
            
            // Find the device with the most recent ad activity (or use the first one as reference)
            const referenceDevice = devices[0];
            const referenceDeviceId = referenceDevice.deviceId;
            
            console.log(`🔄 [SyncAll] Using device ${referenceDeviceId} as reference for material ${materialId}`);
            
            // Create a sync timestamp that all devices will use for perfect synchronization
            const syncTimestamp = new Date().toISOString();
            const syncDelay = 3000; // 3 second delay to ensure all devices receive the command
            
            // Send sync command to ALL devices in this material group (including reference)
            for (const { deviceId, ws } of devices) {
              try {
                const syncMessage = {
                  type: 'slotSync',
                  timestamp: syncTimestamp,
                  command: 'sync',
                  materialId: materialId,
                  referenceDeviceId: referenceDeviceId,
                  targetDeviceId: deviceId,
                  syncDelay: syncDelay, // Delay before executing sync
                  executeAt: new Date(Date.now() + syncDelay).toISOString(), // Exact time to execute
                  testMode: devices.length === 1 // Mark as test mode for single device
                };
                
                console.log(`🔄 [SyncAll] Sending sync command to device: ${deviceId} (material: ${materialId}) - Execute at: ${syncMessage.executeAt}${devices.length === 1 ? ' [TEST MODE]' : ''}`);
                ws.send(JSON.stringify(syncMessage));
                totalSyncedDevices++;
                console.log(`🔄 [SyncAll] ✅ Sent sync command to device: ${deviceId}`);
              } catch (error) {
                console.error(`❌ [SyncAll] Failed to send sync command to ${deviceId}:`, error);
              }
            }
            
            syncResults.push({
              materialId: materialId,
              syncedDevices: devices.length - 1, // Exclude reference device
              totalDevices: devices.length
            });
          } else {
            console.log(`🔄 [SyncAll] Skipping material ${materialId} - only 1 device (no sync needed)`);
          }
        }
        
        console.log(`🔄 [SyncAll] Sync commands sent to ${totalSyncedDevices} devices across ${syncResults.length} materials`);
        
        return { 
          success: true, 
          message: `Sync commands sent to ${totalSyncedDevices} devices across ${syncResults.length} materials`,
          pausedCount: totalSyncedDevices,
          syncResults: syncResults
        };
      } catch (error) {
        console.error('❌ [SyncAll] Error sending sync commands:', error);
        console.error('❌ [SyncAll] Error stack:', error.stack);
        return { 
          success: false, 
          message: 'Failed to send sync commands',
          error: error.message 
        };
      }
    },

    playAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      try {
        console.log('▶️ [PlayAll] Starting play all command...');
        
        // Get the device status service instance
        const deviceStatusService = require('../services/deviceStatusService');
        console.log('▶️ [PlayAll] Device status service loaded');
        
        const service = deviceStatusService;
        console.log('▶️ [PlayAll] Device status service instance obtained');
        
        const playMessage = {
          type: 'resumeAll',
          timestamp: new Date().toISOString(),
          command: 'resume'
        };
        
        let resumedCount = 0;
        const activeConnections = service.activeConnections || new Map();
        
        console.log(`▶️ [PlayAll] Found ${activeConnections.size} active connections`);
        
        // Send resume command only to playback connections
        for (const [deviceId, ws] of activeConnections) {
          // Check if the connection is a playback connection and not an admin connection
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) { // WebSocket.OPEN
            try {
              console.log(`▶️ [PlayAll] Sending to device: ${deviceId}, connection type: ${ws.connectionType || 'unknown'}`);
              ws.send(JSON.stringify(playMessage));
              resumedCount++;
              console.log(`▶️ [PlayAll] ✅ Sent resume command to device: ${deviceId}`);
            } catch (error) {
              console.error(`❌ [PlayAll] Failed to send resume command to ${deviceId}:`, error);
            }
          } else {
            console.log(`▶️ [PlayAll] Skipping device ${deviceId} - not a playback connection (type: ${ws?.connectionType}, isAdmin: ${ws?.isAdmin})`);
          }
        }
        
        console.log(`▶️ [PlayAll] Resume command sent to ${resumedCount} devices`);
        
        return { 
          success: true, 
          message: `Resume command sent to ${resumedCount} devices`,
          pausedCount: resumedCount 
        };
      } catch (error) {
        console.error('❌ [PlayAll] Error sending resume commands:', error);
        console.error('❌ [PlayAll] Error stack:', error.stack);
        return { 
          success: false, 
          message: 'Failed to send resume commands',
          error: error.message 
        };
      }
    },

    pauseAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      try {
        console.log('⏸️ [PauseAll] Starting pause all command...');
        
        // Get the device status service instance
        const deviceStatusService = require('../services/deviceStatusService');
        console.log('⏸️ [PauseAll] Device status service loaded');
        
        const service = deviceStatusService;
        console.log('⏸️ [PauseAll] Device status service instance obtained');
        
        // Send pause command to all connected devices
        const pauseMessage = {
          type: 'pauseAll',
          timestamp: new Date().toISOString(),
          command: 'pause'
        };
        
        let pausedCount = 0;
        const activeConnections = service.activeConnections || new Map();
        
        console.log(`⏸️ [PauseAll] Found ${activeConnections.size} active connections`);
        
        // Send pause command only to playback connections (devices that can pause ads)
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1) { // WebSocket.OPEN
            // Only send pause commands to playback connections, not status connections
            if (ws.connectionType === 'playback' && !ws.isAdmin) {
              try {
                console.log(`⏸️ [PauseAll] Sending to device: ${deviceId}, connection type: ${ws.connectionType}`);
                ws.send(JSON.stringify(pauseMessage));
                pausedCount++;
                console.log(`⏸️ [PauseAll] ✅ Sent pause command to device: ${deviceId}`);
              } catch (error) {
                console.error(`❌ [PauseAll] Failed to send pause command to ${deviceId}:`, error);
              }
            } else {
              console.log(`⏸️ [PauseAll] Skipping device ${deviceId} - not a playback connection (type: ${ws.connectionType}, isAdmin: ${ws.isAdmin})`);
            }
          } else {
            console.log(`⏸️ [PauseAll] Skipping device ${deviceId} - WebSocket not open (state: ${ws?.readyState})`);
          }
        }
        
        console.log(`⏸️ [PauseAll] Pause command sent to ${pausedCount} devices`);
        
        return { 
          success: true, 
          message: `Pause command sent to ${pausedCount} devices`,
          pausedCount 
        };
      } catch (error) {
        console.error('❌ [PauseAll] Error sending pause commands:', error);
        console.error('❌ [PauseAll] Error stack:', error.stack);
        return { 
          success: false, 
          message: 'Failed to send pause commands',
          error: error.message 
        };
      }
    },

    stopAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens stopped', pausedCount: 0 };
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
      
      try {
        console.log('🔒 [LockdownAll] Starting lockdown command...');
        
        const deviceStatusService = require('../services/deviceStatusService');
        const service = deviceStatusService;
        
        const activeConnections = service.activeConnections || new Map();
        let lockedCount = 0;
        
        console.log(`🔒 [LockdownAll] Found ${activeConnections.size} active connections`);
        
        // Debug: Log all connections
        for (const [deviceId, ws] of activeConnections) {
          console.log(`🔒 [LockdownAll] Connection ${deviceId}:`, {
            readyState: ws?.readyState,
            connectionType: ws?.connectionType,
            isAdmin: ws?.isAdmin,
            materialId: ws?.materialId
          });
        }
        
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) {
            try {
              const lockMessage = {
                type: 'lockdown',
                timestamp: new Date().toISOString(),
                command: 'lock',
                message: 'Screen locked by admin'
              };
              
              console.log(`🔒 [LockdownAll] Sending lockdown command to device: ${deviceId}`);
              ws.send(JSON.stringify(lockMessage));
              lockedCount++;
              console.log(`🔒 [LockdownAll] ✅ Sent lockdown command to device: ${deviceId}`);
            } catch (error) {
              console.error(`❌ [LockdownAll] Failed to send lockdown command to ${deviceId}:`, error);
            }
          }
        }
        
        console.log(`🔒 [LockdownAll] Lockdown commands sent to ${lockedCount} devices`);
        
        return { 
          success: true, 
          message: `Lockdown commands sent to ${lockedCount} devices`,
          lockedCount: lockedCount
        };
      } catch (error) {
        console.error('❌ [LockdownAll] Error sending lockdown commands:', error);
        return { 
          success: false, 
          message: 'Failed to send lockdown commands',
          error: error.message 
        };
      }
    },

    unlockAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      try {
        console.log('🔓 [UnlockAll] Starting unlock command...');
        
        const deviceStatusService = require('../services/deviceStatusService');
        const service = deviceStatusService;
        
        const activeConnections = service.activeConnections || new Map();
        let unlockedCount = 0;
        
        console.log(`🔓 [UnlockAll] Found ${activeConnections.size} active connections`);
        
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) {
            try {
              const unlockMessage = {
                type: 'unlock',
                timestamp: new Date().toISOString(),
                command: 'unlock',
                message: 'Screen unlocked by admin'
              };
              
              console.log(`🔓 [UnlockAll] Sending unlock command to device: ${deviceId}`);
              ws.send(JSON.stringify(unlockMessage));
              unlockedCount++;
              console.log(`🔓 [UnlockAll] ✅ Sent unlock command to device: ${deviceId}`);
            } catch (error) {
              console.error(`❌ [UnlockAll] Failed to send unlock command to ${deviceId}:`, error);
            }
          }
        }
        
        console.log(`🔓 [UnlockAll] Unlock commands sent to ${unlockedCount} devices`);
        
        return { 
          success: true, 
          message: `Unlock commands sent to ${unlockedCount} devices`,
          unlockedCount: unlockedCount
        };
      } catch (error) {
        console.error('❌ [UnlockAll] Error sending unlock commands:', error);
        return { 
          success: false, 
          message: 'Failed to send unlock commands',
          error: error.message 
        };
      }
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
    },

    fullscreenAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        console.log('🖥️ [FullscreenAll] Starting fullscreen command for all screens');
        
        const deviceStatusService = require('../services/deviceStatusService');
        const service = deviceStatusService;
        
        const fullscreenMessage = {
          type: 'fullscreen',
          command: 'fullscreen',
          timestamp: new Date().toISOString(),
          source: 'admin'
        };

        let fullscreenCount = 0;
        const activeConnections = service.activeConnections || new Map();
        
        console.log(`🖥️ [FullscreenAll] Found ${activeConnections.size} active connections`);
        
        // Debug: Log all connections
        for (const [deviceId, ws] of activeConnections) {
          console.log(`🖥️ [FullscreenAll] Connection ${deviceId}:`, {
            readyState: ws?.readyState,
            connectionType: ws?.connectionType,
            isAdmin: ws?.isAdmin,
            materialId: ws?.materialId
          });
        }
        
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) {
            try {
              console.log(`🖥️ [FullscreenAll] Sending fullscreen command to device: ${deviceId}`);
              ws.send(JSON.stringify(fullscreenMessage));
              fullscreenCount++;
              console.log(`🖥️ [FullscreenAll] ✅ Sent fullscreen command to device: ${deviceId}`);
            } catch (error) {
              console.error(`❌ [FullscreenAll] Failed to send fullscreen command to ${deviceId}:`, error);
            }
          }
        }
        
        console.log(`🖥️ [FullscreenAll] Fullscreen command sent to ${fullscreenCount} devices`);
        
        return { 
          success: true, 
          message: `Fullscreen command sent to ${fullscreenCount} devices`,
          fullscreenCount 
        };
      } catch (error) {
        console.error('❌ [FullscreenAll] Error sending fullscreen commands:', error);
        return { 
          success: false, 
          message: 'Failed to send fullscreen commands',
          error: error.message 
        };
      }
    },

    exitFullscreenAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      try {
        console.log('🖥️ [ExitFullscreenAll] Starting exit fullscreen command for all screens');
        
        const deviceStatusService = require('../services/deviceStatusService');
        const service = deviceStatusService;
        
        const exitFullscreenMessage = {
          type: 'exit-fullscreen',
          command: 'exit-fullscreen',
          timestamp: new Date().toISOString(),
          source: 'admin'
        };

        let exitFullscreenCount = 0;
        const activeConnections = service.activeConnections || new Map();
        
        console.log(`🖥️ [ExitFullscreenAll] Found ${activeConnections.size} active connections`);
        
        // Debug: Log all connections
        for (const [deviceId, ws] of activeConnections) {
          console.log(`🖥️ [ExitFullscreenAll] Connection ${deviceId}:`, {
            readyState: ws?.readyState,
            connectionType: ws?.connectionType,
            isAdmin: ws?.isAdmin,
            materialId: ws?.materialId
          });
        }
        
        for (const [deviceId, ws] of activeConnections) {
          if (ws && ws.readyState === 1 && ws.connectionType === 'playback' && !ws.isAdmin) {
            try {
              console.log(`🖥️ [ExitFullscreenAll] Sending exit fullscreen command to device: ${deviceId}`);
              ws.send(JSON.stringify(exitFullscreenMessage));
              exitFullscreenCount++;
              console.log(`🖥️ [ExitFullscreenAll] ✅ Sent exit fullscreen command to device: ${deviceId}`);
            } catch (error) {
              console.error(`❌ [ExitFullscreenAll] Failed to send exit fullscreen command to ${deviceId}:`, error);
            }
          }
        }
        
        console.log(`🖥️ [ExitFullscreenAll] Exit fullscreen command sent to ${exitFullscreenCount} devices`);
        
        return { 
          success: true, 
          message: `Exit fullscreen command sent to ${exitFullscreenCount} devices`,
          exitFullscreenCount 
        };
      } catch (error) {
        console.error('❌ [ExitFullscreenAll] Error sending exit fullscreen commands:', error);
        return { 
          success: false, 
          message: 'Failed to send exit fullscreen commands',
          error: error.message 
        };
      }
    }
  }
};

module.exports = resolvers;
