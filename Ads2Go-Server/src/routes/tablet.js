const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tablet = require('../models/Tablet');
const Material = require('../models/Material');
// ScreenTracking model removed; tablet routes will not update ScreenTracking
const AdsDeployment = require('../models/adsDeployment'); // Added AdsDeployment import
const AnalyticsService = require('../services/analyticsService');

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

    // Find the tablet document for this material (need to check if device has been connected before)
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

    // ✅ Check if material has an ad deployment
    // Time lock only applies to devices that have an existing ad deployment to that device/material
    const existingDeployment = await AdsDeployment.findOne({ materialId });
    
    const now = new Date();
    const currentHour = now.getHours(); // 0-23
    const isBeforeEightAM = currentHour >= 0 && currentHour < 8;
    
    // ✅ TIME-BASED LOCK: Only apply if material has ad deployment
    // If material has no ad deployment, allow registration regardless of time
    if (existingDeployment && isBeforeEightAM) {
      console.log(`🔒 [Registration Blocked] ${materialId} cannot start before 8:00 AM`);
      console.log(`   Current time: ${now.toISOString()}, Hour: ${currentHour}`);
      console.log(`   Reason: Drivers are not allowed to work between 12:00 AM - 7:59 AM`);
      console.log(`   Material has ad deployment: ${existingDeployment.adDeploymentId || existingDeployment._id}`);
      
      return res.status(403).json({
        success: false,
        blocked: true,
        message: 'Ad player is locked until 8:00 AM. Drivers cannot work during midnight hours.',
        reason: 'TIME_BASED_LOCK',
        details: {
          currentHour: currentHour,
          currentTime: now.toISOString(),
          unlockTime: '8:00 AM',
          lockPeriod: '12:00 AM - 7:59 AM'
        }
      });
    }
    
    // ✅ Clear completedAt when device registers at or after 8 AM (start of allowed work period)
    const DeviceTracking = require('../models/deviceTracking');
    const existingTracking = await DeviceTracking.findOne({ materialId });
    if (existingTracking && existingTracking.currentSession && existingTracking.currentSession.completedAt) {
      console.log(`🔓 [Registration Unlocked] ${materialId} registering at ${currentHour}:00 - clearing completedAt from previous day`);
      existingTracking.currentSession.completedAt = undefined;
      await existingTracking.save();
    }

    // ✅ If material has no ad deployment, log that we're allowing first-time registration
    if (!existingDeployment) {
      console.log(`✅ [First Time Registration - No Ad Deployment] ${materialId} has no ad deployment - allowing registration regardless of time`);
      console.log(`   Current time: ${now.toISOString()}, Hour: ${currentHour}`);
    }

    // Validate car group ID
    if (tablet.carGroupId !== carGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car group ID'
      });
    }

    // Validate device ID contains "TABLET"
    if (!deviceId.includes('TABLET')) {
      return res.status(400).json({
        success: false,
        message: 'Only devices with TABLET in their device ID can be registered'
      });
    }

    // Check if the device ID is already in use by any tablet in the system
    const existingDevice = await Tablet.findOne({ 'tablets.deviceId': deviceId });
    if (existingDevice) {
      return res.status(409).json({
        success: false,
        message: `Device ID ${deviceId} is already registered to another tablet`
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

    // ✅ MASTER-SLAVE VALIDATION: Slot 1 must be registered before Slot 2
    // Slot 1 is the master, Slot 2 is the slave - enforce strict ordering
    if (slotNumber === 2) {
      const slot1 = tablet.tablets.find(t => t.tabletNumber === 1);
      
      // ✅ FIX: Only check if Slot 1 has a deviceId (not if it's offline)
      // Slot 2 can register even if Slot 1 is temporarily offline
      if (!slot1 || !slot1.deviceId) {
        console.log(`🚫 [Registration Blocked] Cannot register Slot 2 - Slot 1 must have a registered device first`);
        console.log(`   Slot 1 status: ${slot1 ? 'Not registered' : 'Not configured'}`);
        
        return res.status(400).json({
          success: false,
          blocked: true,
          message: 'Cannot register Slot 2 before Slot 1 has a registered device',
          reason: 'MASTER_SLAVE_ORDER',
          details: {
            slotNumber: 2,
            requiredSlot: 1,
            slot1Status: slot1 ? 'NOT_REGISTERED' : 'NOT_CONFIGURED',
            explanation: 'Slot 1 must have a registered device (deviceId) before Slot 2 can register'
          }
        });
      }
      
      console.log(`✅ [Registration] Slot 1 has deviceId (${slot1.deviceId}) - allowing Slot 2 registration`);
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

    // Create deviceTracking record for this device
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
          existingDeviceTracking.carGroupId = carGroupId;
          await existingDeviceTracking.save();
        }
      }
      
      if (!existingDeviceTracking) {
        const { getUTCMidnight } = require('../utils/dateUtils');
        const today = getUTCMidnight();
        
        const deviceTracking = new DeviceTracking({
          materialId,
          carGroupId,
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
            complianceStatus: 'PENDING', // ✅ Start as PENDING - will become COMPLIANT at 8hrs or NON_COMPLIANT if session ends early
            isActive: true
          }
        });
        await deviceTracking.save();
        console.log(`✅ Created deviceTracking record for material: ${materialId} with slot ${slotNumber}`);
        
        // AUTO-SET MOUNTED DATE: When device connects, automatically set mountedAt
        try {
          const Material = require('../models/Material');
          const material = await Material.findOne({ materialId: materialId });
          if (material) {
            // Set mountedAt if not already set
            if (!material.mountedAt) {
              material.mountedAt = new Date();
              console.log(`🎯 Auto-set mountedAt date for material ${materialId} when device connected`);
            }
            // Clear dismountedAt when device reconnects
            if (material.dismountedAt) {
              material.dismountedAt = null;
              console.log(`🔧 Auto-cleared dismountedAt date for material ${materialId} when device reconnected`);
            }
            await material.save();
          }
        } catch (mountError) {
          console.error('Error auto-setting mountedAt date:', mountError);
          // Don't fail the registration if mountedAt setting fails
        }
      } else {
        // Check if this is a new day
        const { getUTCMidnight } = require('../utils/dateUtils');
        const today = getUTCMidnight();
        const sessionDate = getUTCMidnight(new Date(existingDeviceTracking.currentSession?.date || 0));
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
        
        // Update existing car record with new slot
        await existingDeviceTracking.updateSlot(parseInt(slotNumber), {
          deviceId,
          isOnline: true,
          deviceInfo: {}
        });
        
        existingDeviceTracking.isOnline = true;
        existingDeviceTracking.lastSeen = new Date();
        await existingDeviceTracking.save();
        
        console.log(`✅ Updated deviceTracking record for material: ${materialId} with slot ${slotNumber}`);
        
        // AUTO-SET MOUNTED DATE: When device connects, automatically set mountedAt
        try {
          const Material = require('../models/Material');
          const material = await Material.findOne({ materialId: materialId });
          if (material) {
            // Set mountedAt if not already set
            if (!material.mountedAt) {
              material.mountedAt = new Date();
              console.log(`🎯 Auto-set mountedAt date for material ${materialId} when device connected`);
            }
            // Clear dismountedAt when device reconnects
            if (material.dismountedAt) {
              material.dismountedAt = null;
              console.log(`🔧 Auto-cleared dismountedAt date for material ${materialId} when device reconnected`);
            }
            await material.save();
          }
        } catch (mountError) {
          console.error('Error auto-setting mountedAt date:', mountError);
          // Don't fail the registration if mountedAt setting fails
        }
      }
    } catch (deviceTrackingError) {
      console.error('Error creating deviceTracking record:', deviceTrackingError);
      // Don't fail the registration if deviceTracking creation fails
    }

    // ScreenTracking collection deprecated: skip shared tracking creation/update

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
          const Ad = require('../models/Ad');
          const ad = await Ad.findById(slot.adId);
          
          if (ad) {
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
    } catch (analyticsError) {
      console.error('Error updating analytics for tablet:', analyticsError);
      // Don't fail the registration if analytics update fails
    }

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
        currentHours: 0,
        hoursRemaining: 8,
        isCompliant: true,
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

    // ScreenTracking collection deprecated: skip status sync

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

    // Clear the device connection by removing the deviceId field entirely
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

    // ✅ NEW: Check if ALL slots are empty - if so, set dismountedAt
    try {
      const Material = require('../models/Material');
      const material = await Material.findOne({ materialId });
      
      if (material) {
        // Check if any slot still has a device registered
        const hasAnyDevice = tablet.tablets.some(t => t.deviceId && t.deviceId !== '');
        
        if (!hasAnyDevice) {
          // ALL slots are empty - mark as dismounted
          if (material.mountedAt && !material.dismountedAt) {
            material.dismountedAt = new Date();
            await material.save();
            console.log(`🔧 [Unregistration] Material ${materialId} marked as DISMOUNTED - all slots empty`);
          }
        }
      }
    } catch (mountCheckError) {
      console.error('Error checking mounted status on unregister:', mountCheckError);
      // Don't fail the unregister if mount check fails
    }

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

// GET /tablet/configuration/:materialId
router.get('/configuration/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    // Find the tablet document for this material
    const tablet = await Tablet.findOne({ materialId });
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'No tablet configuration found for this material'
      });
    }

    res.json({
      success: true,
      tablet: {
        materialId: tablet.materialId,
        carGroupId: tablet.carGroupId,
        tablets: tablet.tablets.map(t => ({
          tabletNumber: t.tabletNumber,
          deviceId: t.deviceId,
          status: t.status,
          lastSeen: t.lastSeen,
          gps: t.gps
        }))
      }
    });

  } catch (error) {
    console.error('Error getting tablet configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

 module.exports = router;
