const express = require('express');
const router = express.Router();
const Tablet = require('../models/Tablet');
const Material = require('../models/Material');

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
    // Find material by materialId field (not by _id)
    const material = await Material.findOne({ materialId });
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
    let tablet = await Tablet.findOne({ materialId });
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
      deviceId: null,
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
