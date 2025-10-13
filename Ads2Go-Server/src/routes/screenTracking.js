const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');
const deviceStatusService = require('../services/deviceStatusService');
const OSMService = require('../services/osmService');
const { checkDriver } = require('../middleware/driverAuth');
const { checkAdminMiddleware } = require('../middleware/auth');
const Material = require('../models/Material');
const Driver = require('../models/Driver');

// POST /updateLocation - Update tablet location and start/continue daily session
router.post('/updateLocation', async (req, res) => {
  try {
    const { deviceId, lat, lng, speed = 0, heading = 0, accuracy = 0, speedLimit } = req.body;

    // Validate required fields
    if (!deviceId || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, lat, lng'
      });
    }

    // Check if device has active WebSocket connection (new source of truth)
    const deviceStatus = deviceStatusService.getDeviceStatus(deviceId);
    if (deviceStatus.source !== 'websocket' || !deviceStatus.isOnline) {
      console.log(`🚫 [LOCATION UPDATE] Skipping location update for ${deviceId} - No WebSocket connection (source: ${deviceStatus.source}, isOnline: ${deviceStatus.isOnline})`);
      return res.json({
        success: true,
        message: 'Location update skipped - no WebSocket connection',
        data: {
          deviceId,
          isOnline: false,
          reason: 'No active WebSocket connection',
          source: deviceStatus.source
        }
      });
    }

    // Find or create device tracking record
    let deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found. Please register device first.'
      });
    }

    // Get address from coordinates using OSM (optional - don't fail if geocoding fails)
    let address = '';
    try {
      address = await OSMService.reverseGeocode(lat, lng);
      console.log('Geocoding successful:', address);
    } catch (error) {
      console.warn('Geocoding failed, continuing without address:', error.message);
      address = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    // Check if we need to reset daily session (new day)
    const wasReset = deviceTracking.resetDailySession();
    if (wasReset) {
      console.log(`🔄 Daily session reset for ${deviceId} - new day started`);
      await deviceTracking.save();
    }
    
    // Enhanced session management for offline/online transitions
    const hasWebSocketConnection = deviceStatus.source === 'websocket' && deviceStatus.isOnline;
    const wasOffline = !deviceTracking.isOnline && hasWebSocketConnection;
    
    // Handle offline to online transition
    if (wasOffline) {
      console.log(`🔄 Device ${deviceId} reconnected after being offline - preserving session state`);
      deviceTracking.handleOfflineTransition(wasOffline, hasWebSocketConnection);
    }
    
    // Also check if this is a fresh connection (no recent location history or invalid coordinates)
    const hasInvalidLocationHistory = deviceTracking.currentSession?.locationHistory?.some(point => 
      point.coordinates && point.coordinates[0] === 0 && point.coordinates[1] === 0
    );
    
    if (hasInvalidLocationHistory) {
      console.log(`🔄 Device ${deviceId} has invalid location history - clearing to prevent invalid distance calculation`);
      deviceTracking.currentSession.locationHistory = [];
      deviceTracking.currentLocation = null;
      deviceTracking.currentSession.totalDistanceTraveled = 0;
      deviceTracking.totalDistanceTraveled = 0;
      await deviceTracking.save();
    }

    // Update location and online status
    try {
      await deviceTracking.updateLocation(lat, lng, speed, heading, accuracy, address);
      console.log('Location updated successfully for device:', deviceId);
      
      // Check if device has active WebSocket connection before marking as online
      const hasWebSocketConnection = deviceStatus.source === 'websocket' && deviceStatus.isOnline;
      
      // Only mark as online if device has active WebSocket connection
      await DeviceTracking.updateOne(
        { deviceId: deviceId },
        { 
          $set: { 
            isOnline: hasWebSocketConnection,
            lastSeen: new Date()
          } 
        }
      );
      
      console.log(`📱 Device ${deviceId} status: ${hasWebSocketConnection ? 'ONLINE (WebSocket connected)' : 'OFFLINE (no WebSocket connection)'}`);
      
      // Update the device tracking object
      deviceTracking.isOnline = hasWebSocketConnection;
      deviceTracking.lastSeen = new Date();
    } catch (error) {
      console.error('Error updating location and status:', error);
      // Continue processing even if update fails
    }

    // Check for alerts (optional - don't fail if alerts fail)
    try {
      const currentHours = deviceTracking.currentHoursToday;
      const hoursRemaining = deviceTracking.hoursRemaining;
      
      // Alert for low hours (less than 6 hours with 2 hours remaining) - Only for HEADDRESS
      // Only create alert if device is actually online and we don't already have a recent LOW_HOURS alert (within last hour)
      if (deviceTracking.screenType === 'HEADDRESS' && deviceTracking.isOnline && currentHours < 6 && hoursRemaining > 2) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentLowHoursAlert = deviceTracking.alerts.find(alert => 
          alert.type === 'LOW_HOURS' && 
          alert.timestamp > oneHourAgo && 
          !alert.isResolved
        );
        
        if (!recentLowHoursAlert) {
          await deviceTracking.addAlert(
            'LOW_HOURS',
            `Driver has only ${currentHours.toFixed(1)} hours today. ${hoursRemaining.toFixed(1)} hours remaining to meet 8-hour target.`,
            'HIGH'
          );
        }
      }

    } catch (error) {
      console.warn('Error processing alerts:', error.message);
      // Continue processing even if alerts fail
    }


    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        materialId: deviceTracking.materialId,
        screenType: deviceTracking.screenType,
        currentHours: deviceTracking.currentHoursToday,
        hoursRemaining: deviceTracking.hoursRemaining,
        isCompliant: deviceTracking.isCompliantToday,
        totalDistanceToday: deviceTracking.currentSession?.totalDistanceTraveled || 0,
        lastSeen: deviceTracking.lastSeen,
        displayStatus: deviceTracking.displayStatus
      }
    });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /route/:deviceId - Get GPS route data for a device
router.get('/route/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { date, limit = 1000 } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: deviceId'
      });
    }

    console.log(`🔍 [ROUTE API] Searching for route data - identifier: ${deviceId}, date: ${date}`);

    // Try to find device tracking record by deviceId first
    let deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    // If not found by deviceId, try by materialId
    if (!deviceTracking) {
      console.log(`⚠️ [ROUTE API] No device found by deviceId ${deviceId}, trying materialId...`);
      deviceTracking = await DeviceTracking.findOne({ materialId: deviceId });
    }
    
    if (!deviceTracking) {
      console.log(`❌ [ROUTE API] No device tracking record found for ${deviceId}`);
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    console.log(`✅ [ROUTE API] Found device tracking - materialId: ${deviceTracking.materialId}, deviceId: ${deviceTracking.deviceId}`);

    let locationHistory = [];
    let historicalData = null;
    
    // If date is provided, look in historical data first
    if (date) {
      
      // Import DeviceDataHistoryV2 model
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      
      // Find historical data for the specific date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      console.log(`🔍 [ROUTE] Searching for historical data - deviceId: ${deviceId}, materialId: ${deviceTracking.materialId}, date: ${date}`);
      
      // DeviceDataHistoryV2 uses materialId, not deviceId!
      // And the date is stored in dailyData array
      const deviceDataHistory = await DeviceDataHistoryV2.findOne({
        materialId: deviceTracking.materialId
      });
      
      if (deviceDataHistory && deviceDataHistory.dailyData && deviceDataHistory.dailyData.length > 0) {
        console.log(`✅ [ROUTE] Found DeviceDataHistoryV2 record for materialId ${deviceTracking.materialId}`);
        console.log(`📅 [ROUTE] Daily data entries: ${deviceDataHistory.dailyData.length}`);
        
        // Find the specific day's data
        const dayData = deviceDataHistory.dailyData.find(day => {
          const dayDate = new Date(day.date);
          dayDate.setHours(0, 0, 0, 0);
          return dayDate.getTime() === targetDate.getTime();
        });
        
        if (dayData && dayData.locationHistory && dayData.locationHistory.length > 0) {
          console.log(`✅ [ROUTE] Found location history for ${date}: ${dayData.locationHistory.length} points`);
          locationHistory = dayData.locationHistory;
          historicalData = dayData; // Store for metrics
        } else {
          console.log(`❌ [ROUTE] No location history found for ${date}`);
          // Debug: Show available dates
          if (deviceDataHistory.dailyData.length > 0) {
            const availableDates = deviceDataHistory.dailyData
              .map(d => d.date ? new Date(d.date).toISOString().split('T')[0] : 'null')
              .slice(0, 10);
            console.log(`📅 [ROUTE] Available dates (last 10): ${availableDates.join(', ')}`);
          }
        }
      } else {
        console.log(`❌ [ROUTE] No DeviceDataHistoryV2 record found for materialId ${deviceTracking.materialId}`);
        
        // Debug: Check what materialIds exist
        const allMaterials = await DeviceDataHistoryV2.find({}).select('materialId').limit(10);
        console.log(`📦 [ROUTE] Available materialIds in DB (first 10): ${allMaterials.map(m => m.materialId).join(', ')}`);
      }
    }
    
    // If no historical data found or no date provided, try current session
    if (locationHistory.length === 0 && deviceTracking.currentSession && deviceTracking.currentSession.locationHistory) {
      locationHistory = deviceTracking.currentSession.locationHistory;
      
      // Filter by date if provided
      if (date) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        locationHistory = locationHistory.filter(point => {
          const pointDate = new Date(point.timestamp);
          return pointDate >= targetDate && pointDate < nextDay;
        });
      }
    }
    
    // Limit results
    if (limit && parseInt(limit) > 0) {
      locationHistory = locationHistory.slice(-parseInt(limit));
    }

    // Convert to route format for frontend
    const routeData = locationHistory.map(point => ({
      lat: point.coordinates[1], // Convert from GeoJSON [lng, lat] to [lat, lng]
      lng: point.coordinates[0],
      timestamp: point.timestamp,
      speed: point.speed || 0,
      heading: point.heading || 0,
      accuracy: point.accuracy || 0,
      address: point.address || ''
    }));

    // Calculate route metrics
    let totalDistance = 0;
    let totalDuration = 0;
    let averageSpeed = 0;
    let totalAdPlays = 0;
    let totalQRScans = 0;
    let totalHoursOnline = 0;
    
    // If we have historical data, use the stored metrics first
    if (date && historicalData) {
      totalDistance = historicalData.totalDistanceTraveled || 0;
      totalAdPlays = historicalData.totalAdPlays || 0;
      totalQRScans = historicalData.totalQRScans || 0;
      totalHoursOnline = historicalData.totalHoursOnline || 0;
      
      console.log(`📊 [ROUTE] Using stored metrics from historical data:`, {
        totalDistance,
        totalAdPlays,
        totalQRScans,
        totalHoursOnline,
        locationPoints: locationHistory.length
      });
    }
    
    // If no stored distance or we need to calculate from route points
    if (totalDistance === 0 && routeData.length > 1) {
      console.log(`📊 [ROUTE] Calculating distance from ${routeData.length} route points`);
      
      // Calculate total distance using Haversine formula
      for (let i = 1; i < routeData.length; i++) {
        const prev = routeData[i - 1];
        const curr = routeData[i];
        const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        totalDistance += distance;
      }
      
      console.log(`📊 [ROUTE] Calculated distance from route points: ${totalDistance} km`);
    }
    
    // Calculate duration from route points
    if (routeData.length > 1) {
      const startTime = new Date(routeData[0].timestamp);
      const endTime = new Date(routeData[routeData.length - 1].timestamp);
      totalDuration = (endTime.getTime() - startTime.getTime()) / 1000; // seconds
      
      // Calculate average speed
      if (totalDuration > 0) {
        averageSpeed = (totalDistance / totalDuration) * 3600; // km/h
      }
    }

    // Get additional metrics from historical data if available
    let additionalMetrics = {};
    if (date && historicalData) {
      additionalMetrics = {
        totalAdPlays: historicalData.totalAdPlays || 0,
        totalQRScans: historicalData.totalQRScans || 0,
        totalHoursOnline: historicalData.totalHoursOnline || 0,
        totalAdImpressions: historicalData.totalAdImpressions || 0,
        totalAdPlayTime: historicalData.totalAdPlayTime || 0
      };
    }

    res.json({
      success: true,
      message: 'Route data retrieved successfully',
      data: {
        deviceId,
        materialId: deviceTracking.materialId,
        route: routeData,
        metrics: {
          totalDistance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
          totalDuration: Math.round(totalDuration),
          averageSpeed: Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
          pointCount: routeData.length,
          startTime: routeData.length > 0 ? routeData[0].timestamp : null,
          endTime: routeData.length > 0 ? routeData[routeData.length - 1].timestamp : null,
          totalAdPlays: totalAdPlays,
          totalQRScans: totalQRScans,
          totalHoursOnline: totalHoursOnline,
          ...additionalMetrics
        }
      }
    });

  } catch (error) {
    console.error('Error fetching route data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

// GET /deviceByMaterial/:materialId - Get device ID from material ID
router.get('/deviceByMaterial/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: materialId'
      });
    }

    // Find device tracking record by material ID
    const deviceTracking = await DeviceTracking.findByMaterial(materialId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'No device found for this material ID'
      });
    }

    // Get the device ID
    const deviceId = deviceTracking.deviceId;

    if (!deviceId) {
      return res.status(404).json({
        success: false,
        message: 'No device ID found for this material'
      });
    }

    res.json({
      success: true,
      message: 'Device ID retrieved successfully',
      data: {
        materialId,
        deviceId,
        screenType: deviceTracking.screenType,
        carGroupId: deviceTracking.carGroupId,
        isOnline: deviceTracking.isOnline,
        lastSeen: deviceTracking.lastSeen
      }
    });

  } catch (error) {
    console.error('Error fetching device by material ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /startSession - Manually start daily session
router.post('/startSession', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    await deviceTracking.startDailySession();

    res.json({
      success: true,
      message: 'Daily session started successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        startTime: deviceTracking.currentSession.startTime,
        targetHours: deviceTracking.currentSession.targetHours
      }
    });

  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /endSession - Manually end daily session
router.post('/endSession', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    await deviceTracking.endDailySession();

    res.json({
      success: true,
      message: 'Daily session ended successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        totalHours: deviceTracking.currentSession.totalHoursOnline,
        totalDistance: deviceTracking.currentSession.totalDistanceTraveled,
        complianceStatus: deviceTracking.currentSession.complianceStatus
      }
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

  // GET /status/:deviceId - Get current tablet status
  router.get('/status/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;

      const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
      
      if (!deviceTracking) {
        return res.status(404).json({
          success: false,
          message: 'Device tracking record not found'
        });
      }

      // Use centralized status manager for real-time online state
      const statusInfo = deviceStatusService.getDeviceStatus(deviceId);
      const isOnline = !!statusInfo.isOnline;
      const lastSeen = statusInfo.lastSeen || deviceTracking.lastSeen;

    // Get slot information for this device
    const slot = deviceTracking.slots.find(s => s.deviceId === deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId: deviceId,
        materialId: deviceTracking.materialId,
        carGroupId: deviceTracking.carGroupId,
        deviceSlot: slot?.slotNumber,
        isOnline,
        currentLocation: deviceTracking.currentLocation,
        lastSeen,
        currentHours: deviceTracking.currentHoursToday,
        hoursRemaining: deviceTracking.hoursRemaining,
        isCompliant: deviceTracking.isCompliantToday,
        totalDistanceToday: deviceTracking.currentSession?.totalDistanceTraveled || 0,
        averageDailyHours: deviceTracking.averageDailyHours,
        complianceRate: deviceTracking.complianceRate,
        totalHoursOnline: deviceTracking.totalHoursOnline,
        totalDistanceTraveled: deviceTracking.totalDistanceTraveled,
        alerts: deviceTracking.alerts.filter(alert => !alert.isResolved)
      }
    });

  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /material/:materialId - Get all tablets for a material
router.get('/material/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    const devices = await DeviceTracking.findByMaterial(materialId);
    
    const devicesData = devices.map(device => ({
      deviceId: device.deviceId,
      deviceSlot: device.deviceSlot,
      isOnline: device.isOnline,
      currentLocation: device.currentLocation,
      lastSeen: device.lastSeen,
      currentHours: device.currentHoursToday,
      hoursRemaining: device.hoursRemaining,
      isCompliant: device.isCompliantToday,
      totalDistanceToday: device.currentSession?.totalDistanceTraveled || 0
    }));

    res.json({
      success: true,
      data: {
        materialId,
        devices: devicesData,
        totalDevices: devices.length,
        onlineDevices: devices.filter(d => d.isOnline).length,
        compliantDevices: devices.filter(d => d.isCompliantToday).length
      }
    });

  } catch (error) {
    console.error('Error getting material tablets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /path/:deviceId - Get location history for a tablet
router.get('/path/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { date } = req.query; // Optional: specific date

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    let locationHistory = [];
    
    if (date) {
      // Get history for specific date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const session = deviceTracking.currentSession;
      
      if (session && new Date(session.date).getTime() === targetDate.getTime()) {
        locationHistory = session.locationHistory;
      }
    } else {
      // Get current session history
      if (deviceTracking.currentSession && deviceTracking.currentSession.locationHistory) {
        locationHistory = deviceTracking.currentSession.locationHistory;
      }
    }

    res.json({
      success: true,
      data: {
        deviceId: deviceTracking.deviceId,
        materialId: deviceTracking.materialId,
        locationHistory,
        totalPoints: locationHistory.length,
        totalDistance: locationHistory.length > 0 ? 
          deviceTracking.currentSession?.totalDistanceTraveled || 0 : 0
      }
    });

  } catch (error) {
    console.error('Error getting path:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /compliance - Get compliance report
router.get('/compliance', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // First, get all registered devices from tablet system
    const Tablet = require('../models/Tablet');
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
    registeredDevices.forEach((info, deviceId) => {
      console.log(`   - ${deviceId} -> ${info.materialId} (Slot ${info.slotNumber})`);
    });

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
    
    allDevices.forEach((device, index) => {
      console.log(`  Device ${index + 1}: ${device.materialId} (${device.slots?.length || 0} slots)`);
    });
    
    // Initialize screens array to collect individual device records
    const individualScreens = [];
    const seenDisplayIds = new Set(); // Track unique display IDs to prevent duplicates
    let totalOnlineScreens = 0;
    let totalCompliantScreens = 0;
    let totalHours = 0;
    let totalDistance = 0;
    
    // Group devices by material ID to consolidate display
    const materialGroups = new Map();
    
    
    // First, group all devices by material
    allDevices.forEach(device => {
      // For new schema, device is a car record with slots
      const materialId = device.materialId;
      
      if (!materialId) {
        console.log(`⚠️ Skipping device ${device._id} - no materialId`);
        return;
      }
      
      if (!materialGroups.has(materialId)) {
        materialGroups.set(materialId, {
          materialId: materialId,
          carGroupId: device.carGroupId,
          devices: [],
          totalAdPlays: 0,
          totalQRScans: 0,
          totalDistanceTraveled: 0,
          totalHoursOnline: 0,
          totalAdImpressions: 0,
          totalAdPlayTime: 0,
          isOnline: false,
          lastSeen: null,
          currentLocation: null,
          screenMetrics: {},
          adPlaybacks: [],
          qrScans: [],
          locationHistory: [],
          hourlyStats: [],
          adPerformance: [],
          alerts: [],
          slotStatus: {
            slot1: { online: false, deviceId: null, lastSeen: null },
            slot2: { online: false, deviceId: null, lastSeen: null }
          }
        });
      }
      
      const group = materialGroups.get(materialId);
      
      // Process each slot in the car record
      if (device.slots && device.slots.length > 0) {
        device.slots.forEach(slot => {
          // Skip slots without deviceId
          if (!slot.deviceId) {
            console.log(`⚠️ Skipping slot without deviceId in material ${materialId}`);
            return;
          }
          
          // Find registration info for this slot
          const registrationInfo = registeredDevices.get(slot.deviceId);
          if (registrationInfo) {
            group.devices.push({
              device: slot,
              registrationInfo,
              carRecord: device
            });
            
            // Update slot status - use activeConnections directly for real-time status
            const connection = deviceStatusService.activeConnections.get(slot.deviceId);
            const deviceStatusOnline = !!(connection && connection.readyState === 1); // WebSocket.OPEN = 1
            
            // Debug logging
            console.log(`🔍 [compliance] Slot ${slot.deviceId}: connection=`, !!connection, 'readyState=', connection?.readyState, 'deviceStatusOnline=', deviceStatusOnline);
            
            // Check if tablet registration status is recent (within last 30 seconds)
            const now = new Date();
            const lastSeen = new Date(slot.lastSeen);
            const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
            const isRecentActivity = timeSinceLastSeen <= 30; // 30 seconds timeout
            
            // Use tablet registration status if recent, otherwise use device status
            const isDeviceOnline = isRecentActivity ? deviceStatusOnline : false;
            
            // Update slot status based on the actual slot number
            const slotNumber = slot.slotNumber;
            if (slotNumber === 1) {
              group.slotStatus.slot1 = {
                online: isDeviceOnline,
                deviceId: slot.deviceId,
                lastSeen: slot.lastSeen
              };
            } else if (slotNumber === 2) {
              group.slotStatus.slot2 = {
                online: isDeviceOnline,
                deviceId: slot.deviceId,
                lastSeen: slot.lastSeen
              };
            }
          }
        });
      }
      
      // Sum up all metrics from the car record
      group.totalAdPlays += device.totalAdPlays || 0;
      group.totalQRScans += device.totalQRScans || 0;
      group.totalDistanceTraveled += device.totalDistanceTraveled || 0;
      group.totalHoursOnline += device.totalHoursOnline || 0;
      group.totalAdImpressions += device.totalAdImpressions || 0;
      group.totalAdPlayTime += device.totalAdPlayTime || 0;
      
      // Use the most recent lastSeen
      if (!group.lastSeen || (device.lastSeen && device.lastSeen > group.lastSeen)) {
        group.lastSeen = device.lastSeen;
      }
      
      // Use the most recent location
      if (device.currentLocation && (!group.currentLocation || 
          (device.lastSeen && group.lastSeen && device.lastSeen > group.lastSeen))) {
        group.currentLocation = device.currentLocation;
      }
      
      // Merge arrays
      if (device.adPlaybacks) group.adPlaybacks.push(...device.adPlaybacks);
      if (device.qrScans) group.qrScans.push(...device.qrScans);
      if (device.locationHistory) group.locationHistory.push(...device.locationHistory);
      if (device.hourlyStats) group.hourlyStats.push(...device.hourlyStats);
      if (device.adPerformance) group.adPerformance.push(...device.adPerformance);
      if (device.alerts) group.alerts.push(...device.alerts);
      
      // Use the most recent screen metrics
      if (device.screenMetrics && Object.keys(device.screenMetrics).length > 0) {
        group.screenMetrics = { ...group.screenMetrics, ...device.screenMetrics };
      }
      
      // If any device is online, mark the group as online (use real-time status)
      if (device.slots && device.slots.length > 0) {
        const hasOnlineSlot = device.slots.some(slot => {
          if (!slot.deviceId) return false;
          const connection = deviceStatusService.activeConnections.get(slot.deviceId);
          return !!(connection && connection.readyState === 1); // WebSocket.OPEN = 1
        });
        if (hasOnlineSlot) {
          group.isOnline = true;
        }
      } else if (device.isOnline) {
        // Fallback for old schema
        group.isOnline = true;
      }
    });
    
    // Process each material group and create consolidated display
    materialGroups.forEach((group, materialId) => {
      // Skip groups with no devices
      if (!group.devices || group.devices.length === 0) {
        console.log(`⚠️ Skipping material ${materialId} - no devices found`);
        return;
      }
      
      // Calculate totals
      const deviceHours = group.totalHoursOnline || 0;
      const deviceDistance = group.totalDistanceTraveled || 0;
      const isDeviceOnline = group.isOnline;
      const isDeviceCompliant = deviceHours >= 8; // 8 hours target for compliance
      
      totalHours += deviceHours;
      totalDistance += deviceDistance;
      if (isDeviceOnline) totalOnlineScreens++;
      if (isDeviceCompliant) totalCompliantScreens++;
      
      // Create display ID (just material ID, no slot suffix)
      const displayId = materialId;
      
      // Skip if we've already seen this display ID (deduplication)
      if (seenDisplayIds.has(displayId)) {
        console.log(`Skipping duplicate display ID: ${displayId}`);
        return;
      }
      seenDisplayIds.add(displayId);
      
      // Convert coordinates format for individual screens
      let deviceLocation = group.currentLocation;
      let frontendDeviceLocation = null;
      
      
      if (deviceLocation) {
        if (deviceLocation.coordinates && Array.isArray(deviceLocation.coordinates)) {
          frontendDeviceLocation = {
            lat: deviceLocation.coordinates[1],
            lng: deviceLocation.coordinates[0],
            timestamp: deviceLocation.timestamp,
            speed: deviceLocation.speed,
            heading: deviceLocation.heading,
            accuracy: deviceLocation.accuracy,
            address: deviceLocation.address
          };
        } else if (deviceLocation.lat !== undefined && deviceLocation.lng !== undefined) {
          // Already in correct format
          frontendDeviceLocation = deviceLocation;
        }
      } else {
        // If no location data, create a default location
        frontendDeviceLocation = {
          lat: 0,
          lng: 0,
          address: 'Location not available'
        };
      }

      // Create status text showing both slots explicitly
      let slot1Status = group.slotStatus.slot1.online ? 'ONLINE' : 'OFFLINE';
      let slot2Status = group.slotStatus.slot2.online ? 'ONLINE' : 'OFFLINE';
      let statusText = `SLOT 1: ${slot1Status} | SLOT 2: ${slot2Status}`;
      
      // Also create a combined status for overall device status
      let combinedStatus = 'OFFLINE';
      if (group.slotStatus.slot1.online && group.slotStatus.slot2.online) {
        combinedStatus = 'BOTH SLOTS ONLINE';
      } else if (group.slotStatus.slot1.online || group.slotStatus.slot2.online) {
        const onlineSlots = [];
        if (group.slotStatus.slot1.online) onlineSlots.push('1');
        if (group.slotStatus.slot2.online) onlineSlots.push('2');
        combinedStatus = `SLOT ${onlineSlots.join(' & ')} ONLINE`;
      } else {
        combinedStatus = 'BOTH SLOTS OFFLINE';
      }

      individualScreens.push({
        deviceId: group.devices[0].device.deviceId, // Use first device as primary
        displayId: displayId, // Just material ID, no slot suffix
        materialId: materialId, // Use the materialId from tablet registration
        screenType: 'HEADDRESS',
        carGroupId: group.carGroupId,
        deviceSlot: undefined, // Don't show slot for consolidated entries
        slotNumber: undefined, // Don't show slot for consolidated entries
        isOnline: isDeviceOnline,
        currentLocation: frontendDeviceLocation,
        lastSeen: group.lastSeen,
        currentHours: deviceHours,
        hoursRemaining: Math.max(0, 8 - deviceHours), // 8 hours target
        isCompliant: isDeviceCompliant,
        totalDistanceToday: deviceDistance,
        averageDailyHours: deviceHours,
        complianceRate: Math.min(100, (deviceHours / 8) * 100), // Percentage of 8-hour target
        totalHoursOnline: group.totalHoursOnline,
        totalDistanceTraveled: group.totalDistanceTraveled,
        displayStatus: isDeviceOnline ? 'ACTIVE' : 'OFFLINE',
        statusText: statusText, // Show both slot statuses explicitly
        combinedStatus: combinedStatus, // Show combined status
        slot1Status: slot1Status, // Individual slot 1 status
        slot2Status: slot2Status, // Individual slot 2 status
        slotStatus: group.slotStatus, // Include detailed slot status
        screenMetrics: {
          ...group.screenMetrics,
          displayHours: deviceHours,
          adPlayCount: group.screenMetrics?.adPlayCount || 0,
          lastAdPlayed: group.lastAdPlayed || null,
          brightness: group.brightness || 100,
          volume: group.volume || 50,
          isDisplaying: isDeviceOnline,
          maintenanceMode: group.maintenanceMode || false,
          currentAd: group.currentAd || null
        },
        alerts: group.alerts,
        // Add consolidated totals for display
        totalAdPlays: group.totalAdPlays,
        totalQRScans: group.totalQRScans,
        totalAdImpressions: group.totalAdImpressions,
        totalAdPlayTime: group.totalAdPlayTime
      });
    });

    // Create material-level records for map display (one per material)
    const materialScreens = [];
    materialGroups.forEach((group, materialId) => {
      // Skip groups with no devices
      if (!group.devices || group.devices.length === 0) {
        console.log(`⚠️ Skipping material ${materialId} in materialScreens - no devices found`);
        return;
      }
      
      // Use the group's location
      let displayLocation = group.currentLocation;
      // Use real-time slot status to determine if any device is online
      let hasOnlineDevice = group.slotStatus.slot1.online || group.slotStatus.slot2.online;
      let displayStatus = hasOnlineDevice ? 'ACTIVE' : 'OFFLINE';
      
      // Convert coordinates format from [lng, lat] to {lat, lng} for frontend compatibility
      let frontendLocation = null;
      if (displayLocation) {
        if (displayLocation.coordinates && Array.isArray(displayLocation.coordinates)) {
          // MongoDB GeoJSON format: coordinates: [lng, lat]
          frontendLocation = {
            lat: displayLocation.coordinates[1],
            lng: displayLocation.coordinates[0],
            timestamp: displayLocation.timestamp,
            speed: displayLocation.speed,
            heading: displayLocation.heading,
            accuracy: displayLocation.accuracy,
            address: displayLocation.address
          };
        } else if (displayLocation.lat !== undefined && displayLocation.lng !== undefined) {
          // Already in correct format
          frontendLocation = displayLocation;
        }
      }

      // Create status text for material screens
      let materialSlot1Status = group.slotStatus.slot1.online ? 'ONLINE' : 'OFFLINE';
      let materialSlot2Status = group.slotStatus.slot2.online ? 'ONLINE' : 'OFFLINE';
      let materialStatusText = `SLOT 1: ${materialSlot1Status} | SLOT 2: ${materialSlot2Status}`;

      materialScreens.push({
        materialId: materialId,
        deviceId: group.devices[0].device.deviceId, // Use first device as primary
        screenType: 'HEADDRESS',
        carGroupId: group.carGroupId,
        isOnline: hasOnlineDevice,
        currentLocation: frontendLocation,
        lastSeen: group.lastSeen,
        displayStatus: displayStatus,
        statusText: materialStatusText, // Show both slot statuses
        totalDevices: group.devices.length, // Show total devices in this material
        onlineDevices: group.slotStatus.slot1.online + group.slotStatus.slot2.online ? 1 : 0, // Count online slots
        slot1Status: materialSlot1Status, // Individual slot 1 status
        slot2Status: materialSlot2Status, // Individual slot 2 status
        slotStatus: group.slotStatus, // Include slot status
        // Aggregate data for display
        totalHours: group.totalHoursOnline || 0,
        totalDistance: group.totalDistanceTraveled || 0,
        screenMetrics: group.screenMetrics,
        alerts: group.alerts
      });
    });

    const complianceReport = {
      date: targetDate,
      totalDevices: individualScreens.length,
      onlineDevices: totalOnlineScreens,
      compliantDevices: totalCompliantScreens,
      nonCompliantDevices: individualScreens.length - totalCompliantScreens,
      averageHours: individualScreens.length > 0 ? Math.round((totalHours / individualScreens.length) * 100) / 100 : 0,
      averageDistance: individualScreens.length > 0 ? Math.round((totalDistance / individualScreens.length) * 100) / 100 : 0,
      screens: individualScreens, // Individual device records for screen list (renamed from devices)
      materialScreens: materialScreens // Material-level records for map display
    };

    res.json({
      success: true,
      data: complianceReport
    });

  } catch (error) {
    console.error('Error getting compliance report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /trackAd - Track ad playback
router.post('/trackAd', async (req, res) => {
  try {
    const { deviceId, adId, adTitle, adDuration, viewTime = 0, slotNumber = 1 } = req.body;

    // Validate required fields
    if (!deviceId || !adId || !adTitle) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, adId, adTitle'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    // Track ad playback
    await deviceTracking.trackAdPlayback(adId, adTitle, adDuration, viewTime, slotNumber);

    res.json({
      success: true,
      message: 'Ad playback tracked successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        currentAd: deviceTracking.currentAd,
        totalAdsPlayed: deviceTracking.totalAdPlays,
        totalAdImpressions: deviceTracking.totalAdImpressions,
        totalAdPlayTime: deviceTracking.totalAdPlayTime
      }
    });

  } catch (error) {
    console.error('Error tracking ad playback:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /endAd - End ad playback
router.post('/endAd', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    // End ad playback
    await deviceTracking.endAdPlayback();

    res.json({
      success: true,
      message: 'Ad playback ended successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        completedAd: deviceTracking.currentAd
      }
    });

  } catch (error) {
    console.error('Error ending ad playback:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /updateDriverActivity - Update driver activity status
router.post('/updateDriverActivity', async (req, res) => {
  try {
    const { deviceId, isActive = true } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    // Update driver activity
    await deviceTracking.updateDriverActivity(isActive);

    res.json({
      success: true,
      message: 'Driver activity updated successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        displayHours: deviceTracking.screenMetrics.displayHours,
        currentHours: deviceTracking.currentHoursToday,
        totalHours: deviceTracking.totalHoursOnline,
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('Error updating driver activity:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /adAnalytics/:deviceId - Get ad analytics for a specific device
router.get('/adAnalytics/:deviceId', checkAdminMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { date } = req.query;

    console.log(`🔍 Getting device analytics for device ${deviceId} and user ${req.user.id}`);

    // Get user analytics data
    const UserAnalytics = require('../models/userAnalytics');
    const userAnalytics = await UserAnalytics.findOne({ userId: req.user.id });
    
    if (!userAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'User analytics not found'
      });
    }

    // Check if user has any ads on this device
    const userAdsOnDevice = [];
    userAnalytics.ads.forEach(ad => {
      const deviceMaterials = ad.materials.filter(material => material.materialId === deviceId);
      if (deviceMaterials.length > 0) {
        userAdsOnDevice.push({
          adId: ad.adId,
          adTitle: ad.adTitle,
          materials: deviceMaterials
        });
      }
    });

    if (userAdsOnDevice.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No ads found for this user on this device'
      });
    }

    // Calculate material breakdown from user's actual ads only
    let materialBreakdown = {
      materialId: deviceId,
      carGroupId: userAdsOnDevice[0].materials[0].carGroupId,
      totalAdPlays: 0,
      totalAdPlayTime: 0,
      totalAdImpressions: 0,
      totalQRScans: 0,
      totalDays: 0,
      lastActivity: null,
      isOnline: false
    };

    // Calculate totals from user's actual ads only
    const userAds = [];
    const adPerformance = [];

    userAdsOnDevice.forEach(adData => {
      userAds.push({
        adId: adData.adId,
        adTitle: adData.adTitle
      });

      // Aggregate performance data for this ad on this device
      let adTotalPlays = 0;
      let adTotalImpressions = 0;
      let adTotalPlayTime = 0;
      let adTotalQRScans = 0;
      let adCompletionRate = 0;
      let lastPlayed = null;

      adData.materials.forEach(material => {
        adTotalPlays += material.adPlaybacks ? material.adPlaybacks.length : 0;
        adTotalImpressions += material.totalAdImpressions || 0;
        adTotalPlayTime += material.totalAdPlayTime || 0;
        adTotalQRScans += material.totalQRScans || 0;
        adCompletionRate += material.averageAdCompletionRate || 0;
        
        // Update material breakdown totals (user's ads only)
        materialBreakdown.totalAdPlays += material.totalAdImpressions || 0; // Use impressions as play count
        materialBreakdown.totalAdImpressions += material.totalAdImpressions || 0;
        materialBreakdown.totalAdPlayTime += material.totalAdPlayTime || 0;
        materialBreakdown.totalQRScans += material.totalQRScans || 0;
        
        // Update last activity
        if (material.lastSeen && (!materialBreakdown.lastActivity || new Date(material.lastSeen) > new Date(materialBreakdown.lastActivity))) {
          materialBreakdown.lastActivity = material.lastSeen;
        }
        
        // Update online status
        if (material.isOnline) {
          materialBreakdown.isOnline = true;
        }
        
        // Find latest playback
        if (material.adPlaybacks && material.adPlaybacks.length > 0) {
          const latestPlayback = material.adPlaybacks.reduce((latest, playback) => {
            return (!latest || new Date(playback.startTime) > new Date(latest.startTime)) ? playback : latest;
          });
          if (!lastPlayed || new Date(latestPlayback.startTime) > new Date(lastPlayed)) {
            lastPlayed = latestPlayback.startTime;
          }
        }
      });

      adPerformance.push({
        adId: adData.adId.toString(),
        adTitle: adData.adTitle,
        playCount: adTotalPlays,
        impressions: adTotalImpressions,
        totalViewTime: adTotalPlayTime,
        completionRate: adData.materials.length > 0 ? adCompletionRate / adData.materials.length : 0,
        qrScans: adTotalQRScans,
        lastPlayed: lastPlayed
      });
    });

    // Sort ad performance by impressions (descending)
    adPerformance.sort((a, b) => b.impressions - a.impressions);

    // Get current ad (if any) - only from user's ads
    let currentAd = null;
    userAdsOnDevice.forEach(adData => {
      adData.materials.forEach(material => {
        if (material.currentAd && material.currentAd.adId) {
          currentAd = {
            adId: material.currentAd.adId,
            adTitle: material.currentAd.adTitle,
            slotNumber: material.currentAd.slotNumber,
            startTime: material.currentAd.startTime
          };
        }
      });
    });

    // Use calculated material breakdown totals (user's ads only)
    const totals = {
      totalAdsPlayed: materialBreakdown.totalAdPlays || 0,
      totalAdImpressions: materialBreakdown.totalAdImpressions || 0,
      totalAdPlayTime: materialBreakdown.totalAdPlayTime || 0,
      totalQRScans: materialBreakdown.totalQRScans || 0
    };

    console.log(`📊 Found ${userAds.length} ads and ${adPerformance.length} performance entries for device ${deviceId}`);

    res.json({
      success: true,
      data: {
        deviceId: deviceId,
        materialId: deviceId, // Using deviceId as materialId for consistency
        currentAd: currentAd,
        dailyStats: {}, // Can be populated from dailySessions if needed
        adPerformance: adPerformance,
        totalAdsPlayed: totals.totalAdsPlayed,
        totalAdImpressions: totals.totalAdImpressions,
        totalAdPlayTime: totals.totalAdPlayTime,
        totalQRScans: totals.totalQRScans,
        materialBreakdown: materialBreakdown,
        userAds: userAds
      }
    });

  } catch (error) {
    console.error('Error getting device analytics from UserAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /adAnalytics - Get ad analytics for all devices (filtered by user if provided)
router.get('/adAnalytics', checkAdminMiddleware, async (req, res) => {
  try {
    const { date, materialId, userId } = req.query;
    
    // Use authenticated user's ID if no userId is provided in query
    const effectiveUserId = userId || req.user.id;

    let query = { isActive: true };
    if (materialId) {
      query.materialId = materialId;
    }

    const allDevices = await DeviceTracking.find(query);
    
    // Get real-time device status service
    const deviceStatusService = require('../services/deviceStatusService');
    
    let analytics = allDevices.map(device => {
      // Use activeConnections directly for real-time status (more reliable)
      const connection = deviceStatusService.activeConnections.get(device.deviceId);
      const isOnline = !!(connection && connection.readyState === 1); // WebSocket.OPEN = 1
      const lastSeen = connection?.lastSeen || device.lastSeen;
      
      // Debug logging
      console.log(`🔍 [adAnalytics] Device ${device.deviceId}: connection=`, !!connection, 'readyState=', connection?.readyState, 'isOnline=', isOnline);
      
      return {
        deviceId: device.deviceId,
        materialId: device.materialId,
        screenType: device.screenType,
        currentAd: device.currentAd,
        dailyStats: device.dailySummary || {},
        totalAdsPlayed: device.totalAdPlays,
        totalAdImpressions: device.totalAdImpressions,
        totalAdPlayTime: device.totalAdPlayTime,
        adPerformance: device.adPerformance || [],
        isOnline: isOnline, // Use real-time status
        lastSeen: lastSeen // Use real-time lastSeen
      };
    });

    // Filter by user (always filter by authenticated user unless admin specifies different user)
    if (effectiveUserId) {
      console.log(`🔍 Filtering ad analytics for user: ${effectiveUserId}`);
      
      // Get all ads created by this user
      const Ad = require('../models/Ad');
      const userAds = await Ad.find({ userId: effectiveUserId });
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      console.log(`📊 Found ${userAdIds.length} ads for user ${effectiveUserId}:`, userAdIds);
      
      // Filter analytics to only include devices playing ads from this user
      analytics = analytics.filter(tablet => {
        const currentAdId = tablet.currentAd?.adId;
        return currentAdId && userAdIds.includes(currentAdId);
      });
      
      console.log(`📱 Filtered to ${analytics.length} devices playing user's ads`);
    }

    // Calculate summary statistics
    const summary = {
      totalDevices: analytics.length,
      onlineDevices: analytics.filter(a => a.isOnline).length,
      totalAdsPlayed: analytics.reduce((sum, a) => sum + a.totalAdsPlayed, 0),
      totalDisplayHours: analytics.reduce((sum, a) => sum + a.displayHours, 0),
      averageAdsPerDevice: analytics.length > 0 ? analytics.reduce((sum, a) => sum + a.totalAdsPlayed, 0) / analytics.length : 0,
      averageDisplayHours: analytics.length > 0 ? analytics.reduce((sum, a) => sum + a.displayHours, 0) / analytics.length : 0
    };

    res.json({
      success: true,
      data: {
        summary: summary,
        devices: analytics
      }
    });

  } catch (error) {
    console.error('Error getting ad analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /resolveAlert - Resolve an alert
router.post('/resolveAlert', async (req, res) => {
  try {
    const { deviceId, alertIndex } = req.body;

    if (!deviceId || alertIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, alertIndex'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    if (alertIndex >= 0 && alertIndex < deviceTracking.alerts.length) {
      deviceTracking.alerts[alertIndex].isResolved = true;
      await deviceTracking.save();
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /updateScreenMetrics - Update screen display metrics
router.post('/updateScreenMetrics', async (req, res) => {
  try {
    const { 
      deviceId, 
      isDisplaying, 
      brightness, 
      volume, 
      adPlayCount, 
      maintenanceMode 
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: deviceId'
      });
    }

    const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    // Update screen metrics
    if (isDisplaying !== undefined) deviceTracking.screenMetrics.isDisplaying = isDisplaying;
    if (brightness !== undefined) deviceTracking.screenMetrics.brightness = brightness;
    if (volume !== undefined) deviceTracking.screenMetrics.volume = volume;
    if (adPlayCount !== undefined) deviceTracking.screenMetrics.adPlayCount = adPlayCount;
    if (maintenanceMode !== undefined) deviceTracking.screenMetrics.maintenanceMode = maintenanceMode;
    
    deviceTracking.screenMetrics.lastAdPlayed = new Date();
    deviceTracking.lastSeen = new Date();

    // Add alerts for display issues
    if (!isDisplaying && deviceTracking.screenMetrics.isDisplaying) {
      await deviceTracking.addAlert(
        'DISPLAY_OFFLINE',
        'Screen display has been turned off',
        'HIGH'
      );
    }

    if (brightness < 50) {
      await deviceTracking.addAlert(
        'LOW_BRIGHTNESS',
        `Screen brightness is low: ${brightness}%`,
        'MEDIUM'
      );
    }

    if (maintenanceMode) {
      await deviceTracking.addAlert(
        'MAINTENANCE_NEEDED',
        'Screen is in maintenance mode',
        'MEDIUM'
      );
    }

    await deviceTracking.save();

    res.json({
      success: true,
      message: 'Screen metrics updated successfully',
      data: {
        deviceId: deviceTracking.deviceId,
        screenType: deviceTracking.screenType,
        displayStatus: deviceTracking.displayStatus,
        brightness: deviceTracking.screenMetrics.brightness,
        volume: deviceTracking.screenMetrics.volume,
        adPlayCount: deviceTracking.screenMetrics.adPlayCount,
        lastSeen: deviceTracking.lastSeen
      }
    });

  } catch (error) {
    console.error('Error updating screen metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /screens - Get all screens with filtering
// POST /syncStatus - Sync root isOnline with devices array
router.post('/syncStatus', async (req, res) => {
  try {
    console.log('🔄 Syncing root isOnline status with devices array...');
    
    // Find all devices and sync their status
    const devices = await DeviceTracking.find({});
    let syncedCount = 0;
    
    for (const device of devices) {
      // Update device status based on lastSeen
      const now = new Date();
      const lastSeen = new Date(device.lastSeen);
      const timeSinceLastSeen = (now - lastSeen) / 1000; // in seconds
      const shouldBeOnline = timeSinceLastSeen <= 120; // 2 minutes timeout
      
      if (device.isOnline !== shouldBeOnline) {
        console.log(`🔄 Syncing ${device.deviceId}: ${device.isOnline} -> ${shouldBeOnline}`);
        await DeviceTracking.findByIdAndUpdate(
          device._id,
          { 
            $set: { 
              isOnline: shouldBeOnline,
              lastSeen: new Date()
            }
          }
        );
        syncedCount++;
      }
    }
    
    console.log(`✅ Synced ${syncedCount} screens`);
    
    res.json({
      success: true,
      message: `Synced ${syncedCount} screens`,
      syncedCount
    });
  } catch (error) {
    console.error('Error syncing status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /deviceStatus/:deviceId - Get device status using DeviceStatusManager
router.get('/deviceStatus/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const status = deviceStatusService.getDeviceStatus(deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId,
        ...status
      }
    });
  } catch (error) {
    console.error('Error getting device status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /deviceStatuses - Get all device statuses using DeviceStatusManager
router.get('/deviceStatuses', (req, res) => {
  try {
    const allStatuses = deviceStatusService.getAllDeviceStatuses();
    const summary = deviceStatusService.getStatusSummary();
    
    res.json({
      success: true,
      data: {
        devices: allStatuses,
        summary
      }
    });
  } catch (error) {
    console.error('Error getting device statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /statusDebug - Debug endpoint to see all status sources
router.get('/statusDebug', (req, res) => {
  try {
    const allStatuses = deviceStatusService.getAllDeviceStatuses();
    const summary = deviceStatusService.getStatusSummary();
    
    // Get WebSocket connections from deviceStatusService
    const webSocketConnections = Array.from(deviceStatusService.activeConnections.entries()).map(([deviceId, ws]) => ({
      deviceId,
      readyState: ws.readyState,
      isAlive: ws.isAlive
    }));
    
    res.json({
      success: true,
      data: {
        deviceStatuses: allStatuses,
        summary,
        webSocketConnections,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting status debug info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /forceOffline/:deviceId - Force a device to be marked as offline
router.post('/forceOffline/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`🔄 [FORCE OFFLINE] Manually marking device ${deviceId} as offline`);
    
    // Update DeviceStatusManager
    deviceStatusService.getDeviceStatus(deviceId); // This will trigger the status calculation
    
    // Force update the database
    await DeviceTracking.updateMany(
      { deviceId: deviceId },
      { 
        $set: { 
          isOnline: false
        } 
      }
    );
    
    console.log(`✅ [FORCE OFFLINE] Device ${deviceId} marked as offline`);
    
    res.json({
      success: true,
      message: `Device ${deviceId} marked as offline`,
      deviceId
    });
  } catch (error) {
    console.error('Error forcing device offline:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /syncDeviceStatus/:deviceId - Sync device status from DeviceStatusManager
router.post('/syncDeviceStatus/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`🔄 [SYNC DEVICE STATUS] Syncing device status for ${deviceId}`);
    
    // Get all device statuses from DeviceStatusManager
    const allStatuses = deviceStatusService.getAllDeviceStatuses();
    console.log(`📊 [SYNC DEVICE STATUS] Available statuses:`, allStatuses.map(s => ({ deviceId: s.deviceId, isOnline: s.isOnline, source: s.source })));
    
    // Find matching status by device ID or material ID
    const foundStatus = allStatuses.find(status => {
      return status.deviceId === deviceId || 
             status.deviceId.includes(deviceId) ||
             deviceId.includes(status.deviceId);
    });
    
    if (foundStatus) {
      console.log(`✅ [SYNC DEVICE STATUS] Found matching status: ${foundStatus.deviceId} -> ${foundStatus.isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      // Update the DeviceStatusManager with the full device ID
      deviceStatusService.updateDeviceStatus(deviceId, foundStatus.isOnline, new Date());
      
      // Update the database
      await DeviceTracking.updateMany(
        { deviceId: deviceId },
        { 
          $set: { 
            isOnline: foundStatus.isOnline
          } 
        }
      );
      
      res.json({
        success: true,
        message: `Device ${deviceId} synced with status: ${foundStatus.isOnline ? 'ONLINE' : 'OFFLINE'}`,
        deviceId,
        isOnline: foundStatus.isOnline,
        source: foundStatus.source
      });
    } else {
      console.log(`⚠️ [SYNC DEVICE STATUS] No matching status found for ${deviceId}`);
      res.json({
        success: false,
        message: `No matching status found for device ${deviceId}`,
        deviceId
      });
    }
  } catch (error) {
    console.error('Error syncing device status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/screens', async (req, res) => {
  try {
    const { screenType, status, materialId } = req.query;
    const now = new Date();
    
    // Update any devices that should be marked as offline
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
    
    // Mark devices as offline if lastSeen is older than 2 minutes (less aggressive)
    await DeviceTracking.updateMany(
      { 
        isOnline: true,
        lastSeen: { $lt: twoMinutesAgo }
      },
      { 
        $set: { 
          isOnline: false
        } 
      },
      { multi: true }
    );
    
    // Clean up any stale sessions (older than 5 minutes)
    await DeviceTracking.updateMany(
      { 
        lastSeen: { $lt: fiveMinutesAgo },
        'currentSession.isActive': true
      },
      { 
        $set: { 
          'currentSession.isActive': false,
          'currentSession.endTime': new Date()
        } 
      },
      { multi: true }
    );
    
    let query = {
      // Only fetch devices that have actual connected devices (new system)
      $and: [
        {
          $or: [
            { 'slots.deviceId': { $not: { $regex: /^TEMP-/ }, $exists: true, $ne: null } }, // Not a temporary device ID
            { materialId: { $exists: true, $ne: null } } // Or has materialId (new system)
          ]
        },
        {
          $or: [
            { 'slots.deviceId': { $regex: /TABLET/ } }, // Only include devices with TABLET in name
            { screenType: { $exists: true } }, // Or has screen type (legacy records)
            { materialId: { $exists: true } } // Or has materialId (new system)
          ]
        }
      ]
    };
    
    if (screenType) query.screenType = screenType;
    if (materialId) query.materialId = materialId;
    
    // Update status query to check lastSeen for online status (less aggressive)
    if (status === 'online') {
      query.isOnline = true;
      query.lastSeen = { $gte: twoMinutesAgo };
    }
    if (status === 'offline') {
      query['$or'] = [
        { isOnline: false },
        { lastSeen: { $lt: twoMinutesAgo } }
      ];
    }
    if (status === 'displaying') query['screenMetrics.isDisplaying'] = true;
    if (status === 'maintenance') query['screenMetrics.maintenanceMode'] = true;

    const screens = await DeviceTracking.find(query);
    
    // Sync with DeviceStatusManager - check if we have a WebSocket connection for this materialId
    for (const screen of screens) {
      const allStatuses = deviceStatusService.getAllDeviceStatuses();
      const materialStatus = allStatuses.find(status => {
        // Check if this device ID matches the materialId pattern
        return status.deviceId && screen.materialId && (
          status.deviceId === screen.materialId || 
          status.deviceId.includes(screen.materialId) ||
          screen.materialId.includes(status.deviceId)
        );
      });
      
      if (materialStatus) {
        console.log(`🔄 [AUTO-SYNC] Found WebSocket status for material ${screen.materialId}: ${materialStatus.deviceId} -> ${materialStatus.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        // Update the DeviceStatusManager with the full device ID
        deviceStatusService.updateDeviceStatus(screen.deviceId, materialStatus.isOnline, new Date());
      }
    }
    
    // Log the raw data for debugging
    console.log('📋 Raw screens data from database:');
    screens.forEach(screen => {
      const lastSeen = new Date(screen.lastSeen);
      const secondsAgo = (now - lastSeen) / 1000;
      console.log(`  - ${screen.deviceId} (${screen.materialId}):`);
      console.log(`    isOnline: ${screen.isOnline}`);
      console.log(`    lastSeen: ${lastSeen} (${secondsAgo}s ago)`);
    });
    
    // Update the isOnline status based on lastSeen
    const THIRTY_SECONDS = 30 * 1000; // 30 seconds in milliseconds
    
    const screensData = screens.map(screen => {
      // For the new schema, screen is a car record with slots
      // We need to create individual entries for each slot
      const carData = [];
      
      if (screen.slots && screen.slots.length > 0) {
        screen.slots.forEach(slot => {
          // Use DeviceStatusManager as the new source of truth for each slot
          let deviceStatus = deviceStatusService.getDeviceStatus(slot.deviceId);
          let isActuallyOnline = deviceStatus.isOnline;
          
          // If DeviceStatusManager doesn't have this device, use slot status
          if (deviceStatus.source === 'timeout' && deviceStatus.confidence === 'low') {
            isActuallyOnline = slot.isOnline;
          } else {
            // Use the status from DeviceStatusManager
            isActuallyOnline = deviceStatus.isOnline;
          }
          
          // Log the status source for debugging
          console.log(`🎯 [SCREEN TRACKING] Slot ${slot.slotNumber} (${slot.deviceId}) in ${screen.materialId}:`);
          console.log(`  - Status: ${isActuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
          console.log(`  - Source: ${deviceStatus.source}`);
          console.log(`  - Confidence: ${deviceStatus.confidence}`);
          console.log(`  - Last Seen: ${deviceStatus.lastSeen ? deviceStatus.lastSeen.toISOString() : 'Never'}`);
          
          const lastSeen = new Date(slot.lastSeen);
          const timeSinceLastSeen = (now - lastSeen) / 1000; // in seconds
          
          // Override online status if timeout threshold is exceeded
          if (timeSinceLastSeen > 120) {
            isActuallyOnline = false;
            console.log(`  - Overriding to OFFLINE due to timeout: ${timeSinceLastSeen}s > 120s`);
          }
          
          // Check device status based on last seen time
          console.log(`  - Final isOnline: ${isActuallyOnline}`);
          console.log(`  - Timeout check: ${timeSinceLastSeen} <= 120 = ${timeSinceLastSeen <= 120}`);
          
          // Determine display status based on actual online status
          let displayStatus;
          if (isActuallyOnline) {
            displayStatus = 'ONLINE';
          } else {
            displayStatus = 'OFFLINE';
          }
          
          carData.push({
            deviceId: slot.deviceId,
            materialId: screen.materialId,
            screenType: screen.screenType,
            carGroupId: screen.carGroupId,
            deviceSlot: slot.slotNumber,
            isOnline: isActuallyOnline,
            currentLocation: screen.currentLocation,
            lastSeen: slot.lastSeen,
            currentHours: screen.currentHoursToday,
            hoursRemaining: screen.hoursRemaining,
            totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
            displayStatus: displayStatus,
            screenMetrics: slot.screenMetrics || screen.screenMetrics
          });
        });
      } else {
        // Fallback for records without slots (legacy)
        carData.push({
          deviceId: 'Unknown',
          materialId: screen.materialId,
          screenType: screen.screenType,
          carGroupId: screen.carGroupId,
          deviceSlot: 0,
          isOnline: screen.isOnline,
          currentLocation: screen.currentLocation,
          lastSeen: screen.lastSeen,
          currentHours: screen.currentHoursToday,
          hoursRemaining: screen.hoursRemaining,
          totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
          displayStatus: screen.isOnline ? 'ONLINE' : 'OFFLINE',
          screenMetrics: screen.screenMetrics
        });
      }
      
      return carData;
    }).flat(); // Flatten the array of arrays
    
    console.log('Screens data mapping result:', screensData);
    console.log('Screens data mapping result length:', screensData.length);
    
    // Debug: Log the processed screens data
    console.log('Processed screens data:', JSON.stringify(screensData, null, 2));

    res.json({
      success: true,
      data: {
        screens: screensData,
        totalScreens: screensData.length,
        onlineScreens: screensData.filter(s => s.isOnline).length,
        displayingScreens: screensData.filter(s => s.screenMetrics?.isDisplaying).length,
        maintenanceScreens: screensData.filter(s => s.screenMetrics?.maintenanceMode).length
      }
    });

  } catch (error) {
    console.error('Error getting screens:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Debug endpoint to check device status
router.get('/debug/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Find the device in the database
    const device = await DeviceTracking.findOne({ deviceId: deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in database'
      });
    }
    
    res.json({
      success: true,
      data: {
        deviceId: device.deviceId,
        materialId: device.materialId,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
        isActive: device.currentSession?.isActive,
        screenType: device.screenType,
        displayStatus: device.displayStatus,
        screenMetrics: device.screenMetrics
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking device status',
      error: error.message
    });
  }
});

// GET /screen-tracking/driver/:driverId - Get real-time DeviceTracking data for a driver
router.get('/driver/:driverId', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { period = 'realtime', startDate, endDate } = req.query;
    
    // Validate driver access
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own data.'
      });
    }
    
    // Find the material assigned to this driver
    const material = await Material.findOne({ driverId: driverId });
    
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'No material assigned to this driver'
      });
    }
    
    // Find DeviceTracking record for this material
    const deviceTracking = await DeviceTracking.findOne({ 
      materialId: material.materialId 
    });
    
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'No device tracking data found for this driver'
      });
    }
    
    // Get driver details
    const driver = await Driver.findOne({ driverId: driverId });
    
    // Base response data
    const baseData = {
      driverId: driverId,
      vehiclePlateNumber: driver?.vehiclePlateNumber || 'Unknown',
      vehicleType: driver?.vehicleType || 'Unknown',
      materialId: material.materialId,
      materialType: material.materialType,
      isOnline: deviceTracking.isOnline,
      lastSeen: deviceTracking.lastSeen,
      currentLocation: deviceTracking.currentLocation,
      
      // Real-time data from DeviceTracking
      currentHours: deviceTracking.currentHoursToday || 0,
      hoursRemaining: deviceTracking.hoursRemaining || 0,
      totalDistanceToday: deviceTracking.currentSession?.totalDistanceTraveled || 0,
      averageSpeed: deviceTracking.currentSession?.averageSpeed || 0,
      maxSpeed: deviceTracking.currentSession?.maxSpeed || 0,
      
      // Compliance
      complianceRate: deviceTracking.complianceRate || 0,
      
      // Daily performance
      dailyPerformance: deviceTracking.dailyPerformance || [],
      
      // Device info - get from slot, or use materialId as fallback
      deviceId: deviceTracking.slots?.[0]?.deviceId || deviceTracking.deviceId || material.materialId,
      screenType: deviceTracking.screenType,
      displayStatus: deviceTracking.isOnline ? 'ONLINE' : 'OFFLINE',
      
      // Alerts
      totalAlerts: deviceTracking.alerts?.length || 0,
      recentAlerts: deviceTracking.alerts?.slice(-5) || []
    };

    // If period is 'daily' or 'monthly', fetch historical data from DeviceDataHistoryV2
    if (period === 'daily' || period === 'monthly') {
      try {
        const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
        
        // Set default date range based on period
        let defaultStartDate, defaultEndDate;
        if (period === 'daily') {
          // Last 30 days for daily view
          defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          defaultEndDate = endDate || new Date();
        } else if (period === 'monthly') {
          // Last 12 months for monthly view
          defaultStartDate = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
          defaultEndDate = endDate || new Date();
        }
        
        // Find historical data for this material
        const historicalData = await DeviceDataHistoryV2.findOne({ 
          materialId: material.materialId 
        });
        
        if (historicalData && historicalData.dailyData) {
          // Filter daily data by date range
          const filteredDailyData = historicalData.dailyData.filter(day => {
            const dayDate = new Date(day.date);
            return dayDate >= new Date(defaultStartDate) && dayDate <= new Date(defaultEndDate);
          }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
          
          if (period === 'daily') {
            // Calculate aggregated daily metrics
            const dailyMetrics = filteredDailyData.reduce((acc, day) => {
              acc.totalDistance += day.totalDistanceTraveled || 0;
              acc.totalHours += day.totalHoursOnline || 0;
              acc.totalQRImpressions += day.totalQRScans || 0;
              acc.totalAdImpressions += day.totalAdImpressions || 0;
              acc.totalAdPlayTime += day.totalAdPlayTime || 0;
              acc.totalAdPlays += day.totalAdPlays || 0;
              return acc;
            }, {
              totalDistance: 0,
              totalHours: 0,
              totalQRImpressions: 0,
              totalAdImpressions: 0,
              totalAdPlayTime: 0,
              totalAdPlays: 0
            });
            
            // Add daily data to response
            baseData.dailyData = {
              period: 'daily',
              dateRange: {
                startDate: defaultStartDate,
                endDate: defaultEndDate
              },
              aggregatedMetrics: dailyMetrics,
              dailyBreakdown: filteredDailyData.map(day => ({
                date: day.date,
                totalDistance: day.totalDistanceTraveled || 0,
                totalHours: day.totalHoursOnline || 0,
                totalQRImpressions: day.totalQRScans || 0,
                totalAdImpressions: day.totalAdImpressions || 0,
                totalAdPlayTime: day.totalAdPlayTime || 0,
                totalAdPlays: day.totalAdPlays || 0,
                isDisplaying: day.isDisplaying !== false,
                maintenanceMode: day.maintenanceMode || false,
                hourlyStats: day.hourlyStats || [],
                adPerformance: day.adPerformance || [],
                qrScansByAd: day.qrScansByAd || []
              })),
              totalDays: filteredDailyData.length
            };
            
            // Update current metrics with daily aggregated data
            baseData.totalDistanceToday = dailyMetrics.totalDistance;
            baseData.currentHours = dailyMetrics.totalHours;
            baseData.qrImpressions = dailyMetrics.totalQRImpressions;
            baseData.totalAdImpressions = dailyMetrics.totalAdImpressions;
            baseData.totalAdPlayTime = dailyMetrics.totalAdPlayTime;
            baseData.totalAdPlays = dailyMetrics.totalAdPlays;
            
          } else if (period === 'monthly') {
            // Group daily data by month and calculate monthly metrics
            const monthlyData = {};
            
            filteredDailyData.forEach(day => {
              const dayDate = new Date(day.date);
              const monthKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}`;
              const monthName = dayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
              
              if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                  month: monthName,
                  monthKey: monthKey,
                  totalDistance: 0,
                  totalHours: 0,
                  totalQRImpressions: 0,
                  totalAdImpressions: 0,
                  totalAdPlayTime: 0,
                  totalAdPlays: 0,
                  totalDays: 0,
                  averageSpeed: 0,
                  compliance: 0
                };
              }
              
              monthlyData[monthKey].totalDistance += day.totalDistanceTraveled || 0;
              monthlyData[monthKey].totalHours += day.totalHoursOnline || 0;
              monthlyData[monthKey].totalQRImpressions += day.totalQRScans || 0;
              monthlyData[monthKey].totalAdImpressions += day.totalAdImpressions || 0;
              monthlyData[monthKey].totalAdPlayTime += day.totalAdPlayTime || 0;
              monthlyData[monthKey].totalAdPlays += day.totalAdPlays || 0;
              monthlyData[monthKey].totalDays += 1;
            });
            
            // Convert to array and sort by month
            const monthlyBreakdown = Object.values(monthlyData)
              .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
            
            // Calculate total aggregated metrics
            const monthlyMetrics = monthlyBreakdown.reduce((acc, month) => {
              acc.totalDistance += month.totalDistance;
              acc.totalHours += month.totalHours;
              acc.totalQRImpressions += month.totalQRImpressions;
              acc.totalAdImpressions += month.totalAdImpressions;
              acc.totalAdPlayTime += month.totalAdPlayTime;
              acc.totalAdPlays += month.totalAdPlays;
              return acc;
            }, {
              totalDistance: 0,
              totalHours: 0,
              totalQRImpressions: 0,
              totalAdImpressions: 0,
              totalAdPlayTime: 0,
              totalAdPlays: 0
            });
            
            // Add monthly data to response
            baseData.monthlyData = {
              period: 'monthly',
              dateRange: {
                startDate: defaultStartDate,
                endDate: defaultEndDate
              },
              aggregatedMetrics: monthlyMetrics,
              monthlyBreakdown: monthlyBreakdown,
              totalMonths: monthlyBreakdown.length
            };
            
            // Update current metrics with monthly aggregated data
            baseData.totalDistanceToday = monthlyMetrics.totalDistance;
            baseData.currentHours = monthlyMetrics.totalHours;
            baseData.qrImpressions = monthlyMetrics.totalQRImpressions;
            baseData.totalAdImpressions = monthlyMetrics.totalAdImpressions;
            baseData.totalAdPlayTime = monthlyMetrics.totalAdPlayTime;
            baseData.totalAdPlays = monthlyMetrics.totalAdPlays;
            
            // Update monthlyTrends for backward compatibility
            baseData.monthlyTrends = monthlyBreakdown.map(month => ({
              month: month.month,
              distance: month.totalDistance,
              hours: month.totalHours,
              averageSpeed: month.totalHours > 0 ? month.totalDistance / month.totalHours : 0,
              maxSpeed: 0, // Not available in historical data
              qrImpressions: month.totalQRImpressions,
              earnings: 0, // Not calculated in this context
              compliance: month.totalDays > 0 ? (month.totalHours / (month.totalDays * 8)) * 100 : 0 // 8 hours target per day
            }));
          }
        } else {
          // No historical data found, use current data
          if (period === 'daily') {
            baseData.dailyData = {
              period: 'daily',
              dateRange: {
                startDate: defaultStartDate,
                endDate: defaultEndDate
              },
              aggregatedMetrics: {
                totalDistance: baseData.totalDistanceToday,
                totalHours: baseData.currentHours,
                totalQRImpressions: 0,
                totalAdImpressions: 0,
                totalAdPlayTime: 0,
                totalAdPlays: 0
              },
              dailyBreakdown: [],
              totalDays: 0,
              message: 'No historical data available for the specified period'
            };
          } else if (period === 'monthly') {
            baseData.monthlyData = {
              period: 'monthly',
              dateRange: {
                startDate: defaultStartDate,
                endDate: defaultEndDate
              },
              aggregatedMetrics: {
                totalDistance: baseData.totalDistanceToday,
                totalHours: baseData.currentHours,
                totalQRImpressions: 0,
                totalAdImpressions: 0,
                totalAdPlayTime: 0,
                totalAdPlays: 0
              },
              monthlyBreakdown: [],
              totalMonths: 0,
              message: 'No historical data available for the specified period'
            };
            baseData.monthlyTrends = [];
          }
        }
      } catch (historicalError) {
        console.error('Error fetching historical data:', historicalError);
        // Continue with real-time data if historical fetch fails
        if (period === 'daily') {
          baseData.dailyData = {
            period: 'daily',
            error: 'Failed to fetch historical data',
            fallbackToRealtime: true
          };
        } else if (period === 'monthly') {
          baseData.monthlyData = {
            period: 'monthly',
            error: 'Failed to fetch historical data',
            fallbackToRealtime: true
          };
        }
      }
    }
    
    // Format the response to match mobile app expectations
    const response = {
      success: true,
      data: baseData
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting driver screen tracking data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching screen tracking data',
      error: error.message
    });
  }
});

module.exports = router;
