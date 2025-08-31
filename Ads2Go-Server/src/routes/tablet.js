const express = require('express');
const router = express.Router();
const Tablet = require('../models/Tablet');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment'); // Added AdsDeployment import

// Test route to verify tablet routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Tablet routes are working!',
    timestamp: new Date().toISOString()
  });
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

// Get ads for a specific tablet
router.get('/ads/:materialId/:slotNumber', async (req, res) => {
  try {
    const { materialId, slotNumber } = req.params;
    
    console.log('🔍 Fetching ads for:', { materialId, slotNumber });

    // Check if AdsDeployment model is available
    if (!AdsDeployment) {
      console.error('❌ AdsDeployment model not found');
      return res.status(500).json({
        success: false,
        message: 'AdsDeployment model not available'
      });
    }

    console.log('✅ AdsDeployment model found, searching...');

    // Find AdsDeployment documents that match the materialId
    console.log('🔍 Searching for materialId:', materialId);
    const adDeployments = await AdsDeployment.find({ materialId })
      .populate('lcdSlots.adId') // Populate the ad details
      .sort({ createdAt: -1 }); // Get the most recent deployment

    console.log('📊 Found deployments:', adDeployments.length);

    if (!adDeployments || adDeployments.length === 0) {
      console.log('❌ No deployments found');
      return res.json({
        success: true,
        ads: [],
        message: 'No ad deployments found for this material'
      });
    }

    const ads = [];
    const currentTime = new Date();

    console.log('🕐 Current time:', currentTime);

    // Process each deployment
    for (const deployment of adDeployments) {
      console.log('📋 Processing deployment:', deployment._id);
      console.log('📺 LCD slots count:', deployment.lcdSlots.length);
      
             // Find LCD slots that match the requested slot number
       let matchingSlots = deployment.lcdSlots.filter(slot => 
         slot.slotNumber === parseInt(slotNumber) && 
         slot.status === 'RUNNING' &&
         new Date(slot.startTime) <= currentTime &&
         new Date(slot.endTime) >= currentTime
       );

       // If no ads found in the requested slot, try to find ads in any available slot
       if (matchingSlots.length === 0) {
         console.log(`🎯 No ads found in slot ${slotNumber}, searching for ads in any available slot...`);
         matchingSlots = deployment.lcdSlots.filter(slot => 
           slot.status === 'RUNNING' &&
           new Date(slot.startTime) <= currentTime &&
           new Date(slot.endTime) >= currentTime
         );
         
         if (matchingSlots.length > 0) {
           console.log(`🎯 Found ${matchingSlots.length} ads in other slots, using first available`);
         }
       }

      console.log('🎯 Matching slots:', matchingSlots.length);

      // Add matching ads to the result
      for (const slot of matchingSlots) {
        if (slot.adId) {
          ads.push({
            adId: slot.adId._id || slot.adId,
            adDeploymentId: deployment._id,
            slotNumber: slot.slotNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            mediaFile: slot.mediaFile,
            adTitle: slot.adId.title || 'Untitled Ad',
            adDescription: slot.adId.description || '',
            duration: slot.adId.duration || 30,
            createdAt: slot.createdAt,
            updatedAt: slot.updatedAt
          });
        }
      }
    }

    console.log('✅ Found ads:', ads.length);

    res.json({
      success: true,
      ads: ads,
      message: `Found ${ads.length} active ads for material ${materialId}, slot ${slotNumber}`
    });

  } catch (error) {
    console.error('❌ Error fetching ads:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching ads',
      error: error.message
    });
  }
});

module.exports = router;
