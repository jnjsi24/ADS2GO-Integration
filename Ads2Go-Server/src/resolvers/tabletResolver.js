
const mongoose = require('mongoose');
const Tablet = require('../models/Tablet');
const DeviceTracking = require('../models/deviceTracking');
const deviceStatusService = require('../services/deviceStatusService');
const AnalyticsService = require('../services/analyticsService');
const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');
const Ad = require('../models/Ad');

module.exports = {
  Query: {
    getTablet: async (_, { deviceId }) => {
      return await Tablet.findOne({ deviceId });
    },
    getTabletsByMaterial: async (_, { materialId }) => {
      try {
        console.log('=== getTabletsByMaterial called ===');
        console.log('Searching for tablets with materialId:', materialId);
        console.log('materialId type:', typeof materialId);
        
        // Find tablets by materialId (as string)
        const tablets = await Tablet.find({ materialId });
        console.log('Found tablets count:', tablets.length);
        
        // If no tablets found, let's check what's actually in the database
        if (tablets.length === 0) {
          console.log('No tablets found, checking all tablets in database...');
          const allTablets = await Tablet.find({});
          console.log('All tablets in database:', allTablets.map(t => ({ id: t._id, materialId: t.materialId, carGroupId: t.carGroupId })));
        }
        
        console.log('Final tablets result count:', tablets.length);
        return tablets;
      } catch (error) {
        console.error('Error fetching tablets by material:', error);
        return [];
      }
    },
    getAllTablets: async () => {
      return await Tablet.find();
    },
    getTabletConnectionStatus: async (_, { materialId, slotNumber }) => {
      console.log('=== getTabletConnectionStatus called ===');
      console.log('Getting connection status for materialId:', materialId, 'slotNumber:', slotNumber);
      console.log('materialId type:', typeof materialId);
      
      // Default response
      const defaultResponse = {
        isConnected: false,
        materialId: materialId || '',
        slotNumber: slotNumber || 1,
        carGroupId: null,
        connectedDevice: null
      };
      
      try {
        
        // Find tablet by materialId (as string)
        const tablet = await Tablet.findOne({ materialId });
        console.log('Found tablet by materialId:', materialId, 'Tablet:', tablet ? 'Found' : 'Not found');
        
        // If no tablet found, let's check what's actually in the database
        if (!tablet) {
          console.log('No tablet found, checking all tablets in database...');
          const allTablets = await Tablet.find({});
          console.log('All tablets in database:', allTablets.map(t => ({ id: t._id, materialId: t.materialId, carGroupId: t.carGroupId })));
        }
        
        if (!tablet) {
          console.log('No tablet found for materialId:', materialId);
          return defaultResponse;
        }

        // Check if tablet has tablets array and the slot exists
        if (!tablet.tablets || !Array.isArray(tablet.tablets)) {
          console.log('Tablet has no tablets array or tablets is not an array');
          return {
            ...defaultResponse,
            carGroupId: tablet.carGroupId || null
          };
        }

        const tabletUnit = tablet.tablets[slotNumber - 1]; // slotNumber is 1-based
        if (!tabletUnit) {
          console.log('Tablet unit not found for slot:', slotNumber);
          return {
            ...defaultResponse,
            carGroupId: tablet.carGroupId || null
          };
        }

        // Check if device is connected (has deviceId) and get online status
        const hasDeviceId = !!tabletUnit.deviceId;
        const statusInfo = deviceStatusService.getDeviceStatus(tabletUnit.deviceId);
        const isOnline = !!statusInfo.isOnline;

        // Fetch latest tracking info for lastSeen/GPS
        const tracking = await DeviceTracking.findOne({ deviceId: tabletUnit.deviceId });
        const lastSeen = statusInfo.lastSeen || tracking?.lastSeen || tabletUnit.lastSeen || null;
        const gps = tracking?.currentLocation || tabletUnit.gps || null;
        
        return {
          isConnected: hasDeviceId, // Connected if has deviceId, regardless of online status
          connectedDevice: hasDeviceId ? {
            deviceId: tabletUnit.deviceId,
            status: isOnline ? 'ONLINE' : 'OFFLINE',
            lastSeen,
            gps
          } : null,
          materialId,
          slotNumber,
          carGroupId: tablet.carGroupId || null
        };
      } catch (error) {
        console.error('Error getting tablet connection status:', error);
        // Return the default response instead of throwing an error
        return defaultResponse;
      }
    }
  },

  Mutation: {
    registerTablet: async (_, { input }) => {
      try {
        const { deviceId, materialId, slotNumber, carGroupId } = input;
        
        
        // Validate required fields
        if (!deviceId || !materialId || !slotNumber || !carGroupId) {
          throw new Error('Missing required fields: deviceId, materialId, slotNumber, carGroupId');
        }
        
        // Validate slot number
        if (slotNumber < 1 || slotNumber > 2) {
          throw new Error('Slot number must be 1 or 2');
        }
        
        // Find the tablet document for this material
        let tablet = await Tablet.findOne({ materialId });
        if (!tablet) {
          throw new Error('No tablet configuration found for this material');
        }
        
        // Validate car group ID
        if (tablet.carGroupId !== carGroupId) {
          throw new Error('Invalid car group ID');
        }
        
        // Check if the device ID is already in use by any tablet in the system
        const existingDevice = await Tablet.findOne({ 'tablets.deviceId': deviceId });
        if (existingDevice) {
          throw new Error(`Device ID ${deviceId} is already registered to another tablet`);
        }

        // Check if the slot is already occupied by another device
        const existingTablet = tablet.tablets.find(t => t.tabletNumber === slotNumber);
        if (existingTablet && existingTablet.deviceId && existingTablet.deviceId !== deviceId) {
          throw new Error(`Slot ${slotNumber} is already occupied by device ${existingTablet.deviceId}`);
        }
        
        // ✅ MASTER-SLAVE VALIDATION: Slot 1 must be registered before Slot 2
        // Slot 1 is the master, Slot 2 is the slave - enforce strict ordering
        if (slotNumber === 2) {
          const slot1 = tablet.tablets.find(t => t.tabletNumber === 1);
          
          // Check if Slot 1 exists and has a registered device
          if (!slot1 || !slot1.deviceId || slot1.status === 'OFFLINE') {
            console.log(`🚫 [GraphQL Registration Blocked] Cannot register Slot 2 - Slot 1 must be registered first`);
            console.log(`   Slot 1 status: ${slot1 ? (slot1.deviceId ? slot1.status : 'Not registered') : 'Not configured'}`);
            
            throw new Error('Cannot register Slot 2 before Slot 1. Slot 1 (Master) must be registered and online before Slot 2 (Slave) can be registered.');
          }
          
          console.log(`✅ [GraphQL Registration] Slot 1 is registered (${slot1.deviceId}) - allowing Slot 2 registration`);
        }
        
        // Update the tablet slot
        const tabletIndex = tablet.tablets.findIndex(t => t.tabletNumber === slotNumber);
        if (tabletIndex === -1) {
          throw new Error(`Invalid slot number: ${slotNumber}`);
        }
        
        // Update the tablet slot with device information
        tablet.tablets[tabletIndex] = {
          tabletNumber: slotNumber,
          deviceId,
          status: 'ONLINE',
          lastSeen: new Date(),
          gps: tablet.tablets[tabletIndex].gps || null
        };
        
        await tablet.save();
        
        // AUTO-SET MOUNTED DATE: When device connects, automatically set mountedAt
        try {
          const Material = require('../models/Material');
          const MaterialUsageHistory = require('../models/MaterialUsageHistory');
          const material = await Material.findOne({ materialId: materialId });
          if (material && !material.mountedAt) {
            const mountedDate = new Date();
            material.mountedAt = mountedDate;
            await material.save();
            console.log(`🎯 Auto-set mountedAt date for material ${materialId} when device connected via GraphQL`);

            // Also update usage history if there's an active driver
            if (material.driverId) {
              try {
                const usageHistory = await MaterialUsageHistory.findOne({
                  materialId: material._id,
                  driverId: material.driverId,
                  isActive: true
                });
                
                if (usageHistory) {
                  usageHistory.mountedAt = mountedDate;
                  await usageHistory.save();
                  console.log(`✅ Auto-synced mountedAt date to usage history for material ${materialId}, driver ${material.driverId}`);
                }
              } catch (usageError) {
                console.error('Error syncing mountedAt to usage history:', usageError);
                // Don't fail the main operation
              }
            }
          }
        } catch (mountError) {
          console.error('Error auto-setting mountedAt date:', mountError);
          // Don't fail the registration if mountedAt setting fails
        }
        
        // Create or update deviceTracking record for this device
        try {
          const DeviceTracking = require('../models/deviceTracking');
          let existingDeviceTracking = await DeviceTracking.findByMaterialId(materialId);
          
          // If not found by materialId, try to find by deviceId (fallback for restart scenarios)
          if (!existingDeviceTracking) {
            console.log(`🔍 DeviceTracking not found by materialId: ${materialId}, trying deviceId: ${deviceId}`);
            existingDeviceTracking = await DeviceTracking.findByDeviceId(deviceId);
            
            if (existingDeviceTracking) {
              console.log(`🔄 Found existing DeviceTracking by deviceId, updating materialId to: ${materialId}`);
              existingDeviceTracking.materialId = materialId;
              existingDeviceTracking.carGroupId = material.carGroupId;
              await existingDeviceTracking.save();
            }
          }
          
          if (!existingDeviceTracking) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const deviceTracking = new DeviceTracking({
              materialId,
              carGroupId: material.carGroupId,
              screenType: 'HEADDRESS',
              date: today,
              isOnline: true,
              lastSeen: new Date(),
              slots: [{
                slotNumber: parseInt(slotNumber),
                deviceId,
                isOnline: true,
                lastSeen: new Date(),
                deviceInfo: {}
              }],
              currentSession: {
                date: today,
                startTime: new Date(),
                lastOnlineUpdate: new Date(),  // Initialize to prevent incorrect calculations
                totalHoursOnline: 0,
                totalDistanceTraveled: 0,
                targetHours: 8,
                complianceStatus: 'NON_COMPLIANT',
                isActive: true
              }
            });
            await deviceTracking.save();
            console.log(`✅ Created deviceTracking record for material: ${materialId} with slot ${slotNumber}`);
          } else {
            // Check if this is a new day
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sessionDate = new Date(existingDeviceTracking.currentSession?.date || 0);
            sessionDate.setHours(0, 0, 0, 0);
            const isNewDay = sessionDate.getTime() !== today.getTime();
            
            if (isNewDay) {
              // NEW DAY: Reset session and start fresh
              console.log(`📅 New day detected - resetting session for ${materialId}`);
              existingDeviceTracking.currentSession = {
                date: today,
                startTime: new Date(),
                lastOnlineUpdate: new Date(),
                totalHoursOnline: 0,
                totalDistanceTraveled: 0,
                targetHours: 8,
                complianceStatus: 'PENDING',
                isActive: true
              };
            } else if (!existingDeviceTracking.currentSession || !existingDeviceTracking.currentSession.isActive) {
              // SAME DAY, SESSION ENDED: Reactivate session, keep accumulated hours
              console.log(`🔄 Reactivating session for ${materialId} - preserving ${existingDeviceTracking.currentSession?.totalHoursOnline || 0} hours`);
              if (!existingDeviceTracking.currentSession) {
                existingDeviceTracking.currentSession = {
                  date: today,
                  startTime: new Date(),
                  lastOnlineUpdate: new Date(),
                  totalHoursOnline: 0,
                  totalDistanceTraveled: 0,
                  targetHours: 8,
                  complianceStatus: 'PENDING',
                  isActive: true
                };
              } else {
                // Reactivate existing session (keeps totalHoursOnline)
                existingDeviceTracking.currentSession.isActive = true;
                existingDeviceTracking.currentSession.lastOnlineUpdate = new Date();
              }
            } else {
              // Session is already active - just update lastOnlineUpdate
              existingDeviceTracking.currentSession.lastOnlineUpdate = new Date();
            }
            
            // Check if slot already exists with null deviceId (previously unregistered)
            const existingSlot = existingDeviceTracking.slots.find(s => s.slotNumber === parseInt(slotNumber));
            
            if (existingSlot && (existingSlot.deviceId === null || !existingSlot.deviceId)) {
              console.log(`🔄 Slot ${slotNumber} found with null deviceId - updating with new device: ${deviceId}`);
              console.log('📊 Historical data will be preserved for this slot');
              
              // Update the deviceId in the existing slot while preserving all historical data
              const slotIndex = existingDeviceTracking.slots.findIndex(s => s.slotNumber === parseInt(slotNumber));
              await DeviceTracking.updateOne(
                { _id: existingDeviceTracking._id },
                { 
                  $set: { 
                    [`slots.${slotIndex}.deviceId`]: deviceId,
                    [`slots.${slotIndex}.isOnline`]: true,
                    [`slots.${slotIndex}.lastSeen`]: new Date(),
                    [`slots.${slotIndex}.deviceInfo`]: {},
                    isOnline: true,
                    lastSeen: new Date()
                  }
                }
              );
              console.log(`✅ Updated slot ${slotNumber} with new deviceId: ${deviceId}`);
            } else {
              // Normal update - slot doesn't exist or already has a different deviceId
              await existingDeviceTracking.updateSlot(parseInt(slotNumber), {
                deviceId,
                isOnline: true,
                deviceInfo: {}
              });
              existingDeviceTracking.isOnline = true;
              existingDeviceTracking.lastSeen = new Date();
              console.log(`✅ Updated deviceTracking record for material: ${materialId} with slot ${slotNumber}`);
            }
            
            await existingDeviceTracking.save();
          }
        } catch (deviceTrackingError) {
          console.error('Error creating deviceTracking record:', deviceTrackingError);
          // Don't fail the registration if deviceTracking creation fails
        }
        
        // Update analytics to link tablet device with deployment analytics
        try {
          console.log(`🔄 Updating analytics for tablet device: ${deviceId}`);
          
          // Find the deployment for this material
          const deployment = await AdsDeployment.findOne({ materialId });
          
          if (deployment && deployment.lcdSlots && deployment.lcdSlots.length > 0) {
            // Find the slot that matches the slotNumber
            const slot = deployment.lcdSlots.find(s => s.slotNumber === slotNumber);
            
            if (slot && slot.adId) {
              // Get the ad details
              const ad = await Ad.findById(slot.adId);
              
              if (ad) {
                // Get material details
                const material = await Material.findOne({ materialId });
                
                if (material) {
                  // Update analytics with real device data
                  const analyticsData = {
                    carGroupId: material.carGroupId,
                    driverId: material.driverId,
                    adId: slot.adId,
                    userId: ad.userId,
                    adDeploymentId: deployment._id,
                    deviceInfo: {
                      deviceId: deviceId,
                      deviceName: 'Tablet Device',
                      deviceType: 'tablet',
                      osName: 'Android',
                      osVersion: 'Unknown',
                      platform: 'Android',
                      brand: 'Unknown',
                      modelName: 'Unknown',
                      screenWidth: 0,
                      screenHeight: 0,
                      screenScale: 1
                    },
                    isOnline: true,
                    networkStatus: true
                  };
                  
                  await AnalyticsService.updateAnalytics(deviceId, materialId, slotNumber, analyticsData);
                  console.log(`✅ Analytics updated for tablet device: ${deviceId} -> Slot ${slotNumber} -> Ad ${slot.adId}`);
                }
              }
            }
          }
        } catch (analyticsError) {
          console.error('Error updating analytics for tablet:', analyticsError);
          // Don't fail the registration if analytics update fails
        }
        
        console.log('Tablet registered successfully:', { deviceId, materialId, slotNumber });
        return tablet;
        
      } catch (error) {
        console.error('Error in GraphQL registerTablet:', error);
        throw error;
      }
    },

    updateTabletStatus: async (_, { input }) => {
      try {
        const { deviceId, gps, isOnline } = input;
        
        
        // Find tablet by device ID in the tablets array
        const tablet = await Tablet.findOne({
          'tablets.deviceId': deviceId
        });
        
        if (!tablet) {
          throw new Error('Tablet not found');
        }
        
        // Find the specific tablet slot
        const tabletIndex = tablet.tablets.findIndex(t => t.deviceId === deviceId);
        if (tabletIndex === -1) {
          throw new Error('Tablet slot not found');
        }
        
        // Update tablet status
        const currentTablet = tablet.tablets[tabletIndex];
        tablet.tablets[tabletIndex] = {
          tabletNumber: currentTablet.tabletNumber,
          deviceId: currentTablet.deviceId,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastSeen: new Date(),
          gps: gps || currentTablet.gps || null
        };
        
        await tablet.save();
        
        // ScreenTracking collection deprecated: skip screen-level status sync
        
        console.log('Tablet status updated successfully:', { deviceId, status: isOnline ? 'ONLINE' : 'OFFLINE' });
        return tablet;
        
      } catch (error) {
        console.error('Error in GraphQL updateTabletStatus:', error);
        throw error;
      }
    },

    unregisterTablet: async (_, { input }) => {
      try {
        const { materialId, slotNumber, carGroupId } = input;
        
        console.log('Unregistering tablet for materialId:', materialId, 'slotNumber:', slotNumber);

        // Normalize materialId to handle accidental trailing commas/spaces
        const normalizedMaterialId = String(materialId).trim().replace(/,+$/, '');
        
        // Find tablet by materialId (as string)
        let tablet = await Tablet.findOne({ materialId: normalizedMaterialId });
        if (!tablet) {
          // Fallback: regex to match value with optional trailing comma stored in DB
          tablet = await Tablet.findOne({ materialId: { $regex: `^${normalizedMaterialId},?$` } });
        }
        console.log('Found tablet by materialId:', normalizedMaterialId, 'Tablet:', tablet ? 'Found' : 'Not found');
        
        if (!tablet) {
          return {
            success: false,
            message: 'Tablet configuration not found for this material'
          };
        }

        if (tablet.carGroupId !== carGroupId) {
          return {
            success: false,
            message: 'Car Group ID mismatch'
          };
        }

        const tabletIndex = slotNumber - 1; // slotNumber is 1-based
        const tabletUnit = tablet.tablets[tabletIndex];
        if (!tabletUnit) {
          return {
            success: false,
            message: 'Invalid slot number'
          };
        }

        if (!tabletUnit.deviceId) {
          return {
            success: false,
            message: 'No device connected to this slot'
          };
        }

        // Get the old deviceId before removing it
        const oldDeviceId = tabletUnit.deviceId;

        // Send WebSocket message to notify tablet it has been unregistered
        try {
          const deviceStatusService = require('../services/deviceStatusService');
          console.log(`📤 Sending unregister notification to device: ${oldDeviceId}`);
          deviceStatusService.sendUnregisterNotification(oldDeviceId);
        } catch (wsError) {
          console.error('Error sending unregister notification via WebSocket:', wsError);
          // Don't fail the unregister if WebSocket notification fails
        }

        // Clear the device connection by removing the deviceId field entirely from Tablet collection
        tabletUnit.deviceId = undefined; // Explicitly set to undefined
        tabletUnit.status = 'OFFLINE';
        tabletUnit.lastSeen = null;
        tabletUnit.gps = { lat: null, lng: null };
        
        // Use $unset to completely remove the deviceId field from MongoDB
        await tablet.updateOne(
          { _id: tablet._id },
          { $unset: { [`tablets.${tabletIndex}.deviceId`]: 1 } }
        );

        await tablet.save();

        // Update DeviceTracking collection - set deviceId to null while preserving historical data
        try {
          const deviceTracking = await DeviceTracking.findOne({ 
            materialId: normalizedMaterialId,
            'slots.slotNumber': slotNumber
          });

          if (deviceTracking) {
            // Find the slot in the slots array
            const slotIndex = deviceTracking.slots.findIndex(s => s.slotNumber === slotNumber);
            
            if (slotIndex !== -1) {
              console.log(`🔄 Setting deviceId to null for slot ${slotNumber} in DeviceTracking`);
              
              // Set deviceId to null and mark as offline, but keep all historical data intact
              await DeviceTracking.updateOne(
                { _id: deviceTracking._id },
                { 
                  $set: { 
                    [`slots.${slotIndex}.deviceId`]: null,
                    [`slots.${slotIndex}.isOnline`]: false,
                    [`slots.${slotIndex}.lastSeen`]: new Date()
                  }
                }
              );
              
              // Refresh the document to get updated slots
              const updatedTracking = await DeviceTracking.findById(deviceTracking._id);
              
              // Update root-level isOnline based on all slots
              const anySlotOnline = updatedTracking.slots.some(s => s.isOnline);
              if (!anySlotOnline) {
                updatedTracking.isOnline = false;
                // End the current session when device goes completely offline
                if (updatedTracking.currentSession && updatedTracking.currentSession.isActive) {
                  updatedTracking.currentSession.isActive = false;
                  updatedTracking.currentSession.endTime = new Date();
                }
                await updatedTracking.save();
                console.log(`📴 All slots offline - device marked as offline, session ended`);
              }
              
              console.log(`✅ DeviceTracking updated - deviceId set to null for slot ${slotNumber}`);
            }
          } else {
            console.log(`⚠️ No DeviceTracking record found for materialId: ${normalizedMaterialId}`);
          }
        } catch (deviceTrackingError) {
          console.error('Error updating DeviceTracking:', deviceTrackingError);
          // Don't fail the unregister if DeviceTracking update fails
        }

        return {
          success: true,
          message: 'Tablet unregistered successfully'
        };
      } catch (error) {
        console.error('Error unregistering tablet:', error);
        return {
          success: false,
          message: 'Failed to unregister tablet'
        };
      }
    },

    createTabletConfiguration: async (_, { input }) => {
      try {
        const { materialId, carGroupId } = input;
        
        console.log('Creating tablet configuration for materialId:', materialId);
        
        // Check if tablet configuration already exists
        let existingTablet = await Tablet.findOne({ materialId });
        
        if (existingTablet) {
          return {
            success: false,
            message: 'Tablet configuration already exists for this material'
          };
        }

        // Create new tablet configuration with 2 slots
        const tablet = new Tablet({
          materialId: materialId, // Store as string
          carGroupId,
          tablets: [
            {
              tabletNumber: 1,
              status: 'OFFLINE',
              gps: { lat: null, lng: null },
              lastSeen: null
              // deviceId is omitted - will be set when tablet is registered
            },
            {
              tabletNumber: 2,
              status: 'OFFLINE',
              gps: { lat: null, lng: null },
              lastSeen: null
              // deviceId is omitted - will be set when tablet is registered
            }
          ]
        });

        await tablet.save();

        return {
          success: true,
          message: 'Tablet configuration created successfully',
          tablet
        };
      } catch (error) {
        console.error('Error creating tablet configuration:', error);
        return {
          success: false,
          message: 'Failed to create tablet configuration'
        };
      }
    }
  }
};


