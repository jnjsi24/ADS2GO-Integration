
const mongoose = require('mongoose');
const Tablet = require('../models/Tablet');

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
      try {
        console.log('=== getTabletConnectionStatus called ===');
        console.log('Getting connection status for materialId:', materialId, 'slotNumber:', slotNumber);
        console.log('materialId type:', typeof materialId);
        
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
          return {
            isConnected: false,
            materialId,
            slotNumber,
            carGroupId: null
          };
        }

        const tabletUnit = tablet.tablets[slotNumber - 1]; // slotNumber is 1-based
        if (!tabletUnit) {
          return {
            isConnected: false,
            materialId,
            slotNumber,
            carGroupId: tablet.carGroupId || null
          };
        }

        const isConnected = tabletUnit.deviceId && tabletUnit.status === 'ONLINE';
        
        return {
          isConnected,
          connectedDevice: isConnected ? {
            deviceId: tabletUnit.deviceId,
            status: tabletUnit.status,
            lastSeen: tabletUnit.lastSeen,
            gps: tabletUnit.gps
          } : null,
          materialId,
          slotNumber,
          carGroupId: tablet.carGroupId || null
        };
      } catch (error) {
        console.error('Error getting tablet connection status:', error);
        throw new Error('Failed to get tablet connection status');
      }
    }
  },

  Mutation: {
    registerTablet: async (_, { input }) => {
      try {
        const { deviceId, materialId, slotNumber, carGroupId } = input;
        
        console.log('GraphQL registerTablet called with:', { deviceId, materialId, slotNumber, carGroupId });
        
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
        
        // Check if the slot is already occupied by another device
        const existingTablet = tablet.tablets.find(t => t.tabletNumber === slotNumber);
        if (existingTablet && existingTablet.deviceId && existingTablet.deviceId !== deviceId) {
          throw new Error(`Slot ${slotNumber} is already occupied by device ${existingTablet.deviceId}`);
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
        
        console.log('GraphQL updateTabletStatus called with:', { deviceId, gps, isOnline });
        
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

        // Replace the slot object entirely to ensure Mongoose persists removal of deviceId
        tablet.tablets[tabletIndex] = {
          tabletNumber: slotNumber,
          // deviceId intentionally omitted
          status: 'OFFLINE',
          lastSeen: null,
          gps: { lat: null, lng: null }
        };

        await tablet.save();

        // Handle ScreenTracking record - SHARED TRACKING approach
        // Update the specific device in the devices array
        const ScreenTracking = require('../models/screenTracking');
        const screenTracking = await ScreenTracking.findOne({ materialId: normalizedMaterialId });
        
        if (screenTracking) {
          console.log(`Updating SHARED ScreenTracking record for materialId: ${normalizedMaterialId} - device ${oldDeviceId} going offline`);
          
          // Update the specific device in the devices array
          if (screenTracking.devices && screenTracking.devices.length > 0) {
            const deviceIndex = screenTracking.devices.findIndex(d => d.deviceId === oldDeviceId);
            if (deviceIndex >= 0) {
              screenTracking.devices[deviceIndex].isOnline = false;
              screenTracking.devices[deviceIndex].lastSeen = new Date();
              console.log(`Updated device ${oldDeviceId} in devices array to offline`);
            }
          }
          
          // Update legacy fields (for backward compatibility)
          screenTracking.isOnline = false;
          screenTracking.lastSeen = new Date();
          await screenTracking.save();
          console.log(`SHARED ScreenTracking record preserved for materialId: ${normalizedMaterialId} (device ${oldDeviceId} unregistered)`);
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


