const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tablet = require('../models/Tablet');
const Material = require('../models/Material');
const ScreenTracking = require('../models/screenTracking');
const AdsDeployment = require('../models/adsDeployment'); // Added AdsDeployment import

// Test route to verify tablet routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Tablet routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint for server accessibility
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy and accessible',
    timestamp: new Date().toISOString(),
    status: 'OK'
  });
});

// GET /tablet/list - List all tablets (for debugging) - MUST COME FIRST
router.get('/list', async (req, res) => {
  try {
    const tablets = await Tablet.find({}).populate('materialId');
    
    const simplifiedTablets = tablets.map(tab => ({
      id: tab._id,
      materialId: tab.materialId,
      carGroupId: tab.carGroupId,
      tablets: tab.tablets.map(t => ({
        tabletNumber: t.tabletNumber,
        deviceId: t.deviceId,
        status: t.status,
        lastSeen: t.lastSeen
      }))
    }));

    res.json({
      success: true,
      tablets: simplifiedTablets,
      message: `Found ${tablets.length} tablet configurations`
    });

  } catch (error) {
    console.error('Error fetching tablets:', error);
    res.status(500).json({
      success: false,
      tablets: [],
      message: 'Internal server error'
    });
  }
});

// POST /registerTablet
router.post('/registerTablet', async (req, res) => {
  try {
    const { deviceId, materialId, slotNumber, carGroupId } = req.body;

    // Validate required fields
    if (!deviceId || !materialId || !slotNumber || !carGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, materialId, slotNumber, carGroupId'
      });
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > 2) {
      return res.status(400).json({
        success: false,
        message: 'Slot number must be 1 or 2'
      });
    }

    // Check if material exists and is HEADDRESS type
    // Try to find material by materialId field first (string format)
    let material = await Material.findOne({ materialId });
    
    // If not found and materialId looks like an ObjectId, try finding by _id
    if (!material && mongoose.Types.ObjectId.isValid(materialId)) {
      console.log('Material not found by materialId, trying ObjectId:', materialId);
      material = await Material.findById(materialId);
    }
    
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (material.materialType !== 'HEADDRESS') {
      return res.status(400).json({
        success: false,
        message: 'Only HEADDRESS materials can have tablets registered'
      });
    }

    // Find the tablet document for this material
    // Try to find by materialId first (string format)
    let tablet = await Tablet.findOne({ materialId });
    
    // If not found and materialId looks like an ObjectId, try finding by ObjectId
    if (!tablet && mongoose.Types.ObjectId.isValid(materialId)) {
      console.log('Tablet not found by materialId, trying ObjectId:', materialId);
      tablet = await Tablet.findOne({ materialId: new mongoose.Types.ObjectId(materialId) });
    }
    
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'No tablet configuration found for this material'
      });
    }

    // Validate car group ID
    if (tablet.carGroupId !== carGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car group ID'
      });
    }

    // Check if the slot is already occupied by another device
    const existingTablet = tablet.tablets.find(t => t.tabletNumber === slotNumber);
    if (existingTablet && existingTablet.deviceId && existingTablet.deviceId !== deviceId) {
      return res.status(409).json({
        success: false,
        message: `Slot ${slotNumber} is already occupied by device ${existingTablet.deviceId}`
      });
    }

    // Update the tablet slot
    const tabletIndex = tablet.tablets.findIndex(t => t.tabletNumber === slotNumber);
    if (tabletIndex === -1) {
      return res.status(400).json({
        success: false,
        message: `Invalid slot number: ${slotNumber}`
      });
    }

    // Update the tablet slot with device information
    tablet.tablets[tabletIndex] = {
      tabletNumber: slotNumber, // Ensure tabletNumber is preserved
      deviceId,
      status: 'ONLINE',
      lastSeen: new Date(),
      gps: tablet.tablets[tabletIndex].gps || null
    };

    await tablet.save();

    // SHARED TRACKING: Create or update tablet tracking record per materialId (not per slot)
    // Look for existing record by materialId only (shared across all slots)
    let tabletTracking = await ScreenTracking.findOne({ materialId });
    
    if (!tabletTracking) {
      // Create new shared tracking record for this materialId
      console.log(`Creating new SHARED ScreenTracking record for materialId: ${materialId} with deviceId: ${deviceId} (Slot ${slotNumber})`);
      tabletTracking = new ScreenTracking({
        materialId,
        carGroupId,
        screenType: 'HEADDRESS',
        devices: [{
          deviceId,
          slotNumber,
          isOnline: true,
          lastSeen: new Date()
        }],
        // Legacy fields for backward compatibility
        deviceId,
        slotNumber,
        isOnline: true,
        lastSeen: new Date()
      });
      
      // Start daily session
      await tabletTracking.startDailySession();
    } else {
      // Update existing shared record - add or update device in devices array
      console.log(`Updating SHARED ScreenTracking record for materialId: ${materialId} with deviceId: ${deviceId} (Slot ${slotNumber})`);
      
      // Initialize devices array if it doesn't exist
      if (!tabletTracking.devices) {
        tabletTracking.devices = [];
      }
      
      // Find existing device in the array
      const existingDeviceIndex = tabletTracking.devices.findIndex(d => d.slotNumber === slotNumber);
      
      if (existingDeviceIndex >= 0) {
        // Update existing device
        console.log(`Updating existing device in slot ${slotNumber}`);
        tabletTracking.devices[existingDeviceIndex] = {
          deviceId,
          slotNumber,
          isOnline: true,
          lastSeen: new Date(),
          currentLocation: tabletTracking.devices[existingDeviceIndex].currentLocation,
          totalHoursOnline: tabletTracking.devices[existingDeviceIndex].totalHoursOnline,
          totalDistanceTraveled: tabletTracking.devices[existingDeviceIndex].totalDistanceTraveled
        };
      } else {
        // Add new device
        console.log(`Adding new device to slot ${slotNumber}`);
        tabletTracking.devices.push({
          deviceId,
          slotNumber,
          isOnline: true,
          lastSeen: new Date()
        });
      }
      
      // Update legacy fields (for backward compatibility)
      tabletTracking.deviceId = deviceId;
      tabletTracking.slotNumber = slotNumber;
      tabletTracking.isOnline = true;
      tabletTracking.lastSeen = new Date();
      
      // Check if we need to start a new daily session
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!tabletTracking.currentSession || 
          new Date(tabletTracking.currentSession.date).getTime() !== today.getTime()) {
        // End previous session if exists
        if (tabletTracking.currentSession && tabletTracking.currentSession.isActive) {
          await tabletTracking.endDailySession();
        }
        
        // Start new daily session
        await tabletTracking.startDailySession();
      }
    }

    await tabletTracking.save();

    // Return success response with tablet info
    res.json({
      success: true,
      message: 'Tablet registered successfully',
      tabletInfo: {
        deviceId,
        materialId,
        slotNumber,
        carGroupId,
        status: 'ONLINE',
        lastReportedAt: new Date().toISOString()
      },
      trackingInfo: {
        currentHours: tabletTracking.currentHoursToday,
        hoursRemaining: tabletTracking.hoursRemaining,
        isCompliant: tabletTracking.isCompliantToday,
        targetHours: 8
      },
      adsList: [] // TODO: Add actual ads list when ads system is implemented
    });

  } catch (error) {
    console.error('Error registering tablet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /updateTabletStatus
router.post('/updateTabletStatus', async (req, res) => {
  try {
    const { deviceId, isOnline, gps, lastReportedAt } = req.body;

    // Validate required fields
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    // Find tablet by device ID
    const tablet = await Tablet.findOne({
      'tablets.deviceId': deviceId
    });

    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Tablet not found'
      });
    }

    // Find the specific tablet slot
    const tabletIndex = tablet.tablets.findIndex(t => t.deviceId === deviceId);
    if (tabletIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Tablet slot not found'
      });
    }

    // Update tablet status
    const currentTablet = tablet.tablets[tabletIndex];
    tablet.tablets[tabletIndex] = {
      tabletNumber: currentTablet.tabletNumber, // Preserve tabletNumber
      deviceId: currentTablet.deviceId, // Preserve deviceId
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      lastSeen: new Date(),
      gps: gps || currentTablet.gps || null,
      ...(lastReportedAt && { lastReportedAt: new Date(lastReportedAt) })
    };

    await tablet.save();

    res.json({
      success: true,
      message: 'Tablet status updated successfully'
    });

  } catch (error) {
    console.error('Error updating tablet status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /tablet/:deviceId
router.get('/tablet/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const tablet = await Tablet.findOne({
      'tablets.deviceId': deviceId
    });

    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Tablet not found'
      });
    }

    const tabletSlot = tablet.tablets.find(t => t.deviceId === deviceId);

    res.json({
      success: true,
      tabletInfo: {
        deviceId,
        materialId: tablet.materialId,
        carGroupId: tablet.carGroupId,
        slotNumber: tabletSlot.tabletNumber,
        status: tabletSlot.status,
        gps: tabletSlot.gps,
        lastSeen: tabletSlot.lastSeen
      }
    });

  } catch (error) {
    console.error('Error getting tablet info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /checkExistingConnection
router.post('/checkExistingConnection', async (req, res) => {
  try {
    const { materialId, slotNumber } = req.body;

    // Validate required fields
    if (!materialId || !slotNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: materialId, slotNumber'
      });
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > 2) {
      return res.status(400).json({
        success: false,
        message: 'Slot number must be 1 or 2'
      });
    }

    // Find the tablet document for this material
    const tablet = await Tablet.findOne({ materialId });
    if (!tablet) {
      return res.json({
        success: true,
        hasExistingConnection: false,
        message: 'No tablet configuration found for this material'
      });
    }

    // Check if the slot has an existing connection
    const tabletUnit = tablet.tablets.find(t => t.tabletNumber === slotNumber);
    if (!tabletUnit) {
      return res.json({
        success: true,
        hasExistingConnection: false,
        message: 'Invalid slot number'
      });
    }

    const hasExistingConnection = tabletUnit.deviceId && tabletUnit.status === 'ONLINE';

    res.json({
      success: true,
      hasExistingConnection,
      existingDevice: hasExistingConnection ? {
        deviceId: tabletUnit.deviceId,
        status: tabletUnit.status,
        lastSeen: tabletUnit.lastSeen,
        gps: tabletUnit.gps
      } : null,
      message: hasExistingConnection 
        ? `Slot ${slotNumber} is already occupied by device ${tabletUnit.deviceId}`
        : `Slot ${slotNumber} is available for connection`
    });

  } catch (error) {
    console.error('Error checking existing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /unregisterTablet
router.post('/unregisterTablet', async (req, res) => {
  try {
    const { materialId, slotNumber, carGroupId } = req.body;

    // Validate required fields
    if (!materialId || !slotNumber || !carGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: materialId, slotNumber, carGroupId'
      });
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > 2) {
      return res.status(400).json({
        success: false,
        message: 'Slot number must be 1 or 2'
      });
    }

    // Find the tablet document for this material
    const tablet = await Tablet.findOne({ materialId });
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'No tablet configuration found for this material'
      });
    }

    // Validate car group ID
    if (tablet.carGroupId !== carGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car group ID'
      });
    }

    // Find the tablet slot
    const tabletIndex = tablet.tablets.findIndex(t => t.tabletNumber === slotNumber);
    if (tabletIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slot number'
      });
    }

    const tabletUnit = tablet.tablets[tabletIndex];
    if (!tabletUnit.deviceId) {
      return res.status(400).json({
        success: false,
        message: 'No device connected to this slot'
      });
    }

    // Clear the device connection
    tablet.tablets[tabletIndex] = {
      tabletNumber: slotNumber,
      // deviceId is omitted - will be undefined instead of null
      status: 'OFFLINE',
      lastSeen: null,
      gps: { lat: null, lng: null }
    };

    await tablet.save();

    res.json({
      success: true,
      message: 'Tablet unregistered successfully'
    });

  } catch (error) {
    console.error('Error unregistering tablet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

 module.exports = router;
