const express = require('express');
const router = express.Router();
const ScreenTracking = require('../models/screenTracking');
const deviceStatusService = require('../services/deviceStatusService');
const OSMService = require('../services/osmService');
const { checkDriver } = require('../middleware/driverAuth');
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

    // Find or create screen tracking record
    let screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found. Please register screen first.'
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
    const wasReset = screenTracking.resetDailySession();
    if (wasReset) {
      console.log(`🔄 Daily session reset for ${deviceId} - new day started`);
      await screenTracking.save();
    }
    
    // Check if device was offline and just reconnected - clear location history to prevent invalid distance calculation
    const hasWebSocketConnection = deviceStatus.source === 'websocket' && deviceStatus.isOnline;
    const wasOffline = !screenTracking.isOnline && hasWebSocketConnection;
    
    // Also check if this is a fresh connection (no recent location history or invalid coordinates)
    const hasInvalidLocationHistory = screenTracking.currentSession?.locationHistory?.some(point => 
      point.coordinates && point.coordinates[0] === 0 && point.coordinates[1] === 0
    );
    
    if (wasOffline || hasInvalidLocationHistory) {
      console.log(`🔄 Device ${deviceId} reconnected after being offline or has invalid location history - clearing location history to prevent invalid distance calculation`);
      screenTracking.currentSession.locationHistory = [];
      screenTracking.currentLocation = null;
      screenTracking.currentSession.totalDistanceTraveled = 0;
      screenTracking.totalDistanceTraveled = 0;
      await screenTracking.save();
    }

    // Update location and online status
    try {
      await screenTracking.updateLocation(lat, lng, speed, heading, accuracy, address);
      console.log('Location updated successfully for device:', deviceId);
      
      // Check if device has active WebSocket connection before marking as online
      const hasWebSocketConnection = deviceStatus.source === 'websocket' && deviceStatus.isOnline;
      
      // Only mark as online if device has active WebSocket connection
      await ScreenTracking.updateOne(
        { 'devices.deviceId': deviceId },
        { 
          $set: { 
            'devices.$.isOnline': hasWebSocketConnection,
            'devices.$.lastSeen': new Date()
          } 
        }
      );
      
      console.log(`📱 Device ${deviceId} status: ${hasWebSocketConnection ? 'ONLINE (WebSocket connected)' : 'OFFLINE (no WebSocket connection)'}`);
      
      // Also update root level isOnline status based on WebSocket connection
      const hasAnyOnlineDevice = screenTracking.devices?.some(d => d.isOnline) || false;
      if (screenTracking.isOnline !== hasAnyOnlineDevice) {
        console.log(`🔄 Updating root status for ${screenTracking.materialId}: ${screenTracking.isOnline} -> ${hasAnyOnlineDevice}`);
        await ScreenTracking.updateOne(
          { _id: screenTracking._id },
          { $set: { isOnline: hasAnyOnlineDevice } }
        );
      }
    } catch (error) {
      console.error('Error updating location and status:', error);
      // Continue processing even if update fails
    }

    // Check for alerts (optional - don't fail if alerts fail)
    try {
      const currentHours = screenTracking.currentHoursToday;
      const hoursRemaining = screenTracking.hoursRemaining;
      
      // Alert for low hours (less than 6 hours with 2 hours remaining) - Only for HEADDRESS
      // Only create alert if device is actually online and we don't already have a recent LOW_HOURS alert (within last hour)
      if (screenTracking.screenType === 'HEADDRESS' && screenTracking.isOnline && currentHours < 6 && hoursRemaining > 2) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentLowHoursAlert = screenTracking.alerts.find(alert => 
          alert.type === 'LOW_HOURS' && 
          alert.timestamp > oneHourAgo && 
          !alert.isResolved
        );
        
        if (!recentLowHoursAlert) {
          await screenTracking.addAlert(
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
        deviceId: screenTracking.deviceId,
        materialId: screenTracking.materialId,
        screenType: screenTracking.screenType,
        currentHours: screenTracking.currentHoursToday,
        hoursRemaining: screenTracking.hoursRemaining,
        isCompliant: screenTracking.isCompliantToday,
        totalDistanceToday: screenTracking.currentSession?.totalDistanceTraveled || 0,
        lastSeen: screenTracking.lastSeen,
        displayStatus: screenTracking.displayStatus
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

    // Find screen tracking record
    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    // Get location history from current session
    let locationHistory = [];
    
    if (screenTracking.currentSession && screenTracking.currentSession.locationHistory) {
      locationHistory = screenTracking.currentSession.locationHistory;
      
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
      
      // Limit results
      if (limit && parseInt(limit) > 0) {
        locationHistory = locationHistory.slice(-parseInt(limit));
      }
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
    
    if (routeData.length > 1) {
      // Calculate total distance using Haversine formula
      for (let i = 1; i < routeData.length; i++) {
        const prev = routeData[i - 1];
        const curr = routeData[i];
        const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        totalDistance += distance;
      }
      
      // Calculate duration
      const startTime = new Date(routeData[0].timestamp);
      const endTime = new Date(routeData[routeData.length - 1].timestamp);
      totalDuration = (endTime.getTime() - startTime.getTime()) / 1000; // seconds
      
      // Calculate average speed
      if (totalDuration > 0) {
        averageSpeed = (totalDistance / totalDuration) * 3600; // km/h
      }
    }

    res.json({
      success: true,
      message: 'Route data retrieved successfully',
      data: {
        deviceId,
        materialId: screenTracking.materialId,
        route: routeData,
        metrics: {
          totalDistance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
          totalDuration: Math.round(totalDuration),
          averageSpeed: Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
          pointCount: routeData.length,
          startTime: routeData.length > 0 ? routeData[0].timestamp : null,
          endTime: routeData.length > 0 ? routeData[routeData.length - 1].timestamp : null
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

    // Find screen tracking record by material ID
    const screenTracking = await ScreenTracking.findOne({ materialId });
    
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'No device found for this material ID'
      });
    }

    // Get the primary device ID (first device in the devices array or legacy deviceId)
    const deviceId = screenTracking.devices && screenTracking.devices.length > 0 
      ? screenTracking.devices[0].deviceId 
      : screenTracking.deviceId;

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
        screenType: screenTracking.screenType,
        carGroupId: screenTracking.carGroupId,
        isOnline: screenTracking.isOnline,
        lastSeen: screenTracking.lastSeen
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

    const tabletTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!tabletTracking) {
      return res.status(404).json({
        success: false,
        message: 'Tablet tracking record not found'
      });
    }

    await tabletTracking.startDailySession();

    res.json({
      success: true,
      message: 'Daily session started successfully',
      data: {
        deviceId: tabletTracking.deviceId,
        startTime: tabletTracking.currentSession.startTime,
        targetHours: tabletTracking.currentSession.targetHours
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

    const tabletTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!tabletTracking) {
      return res.status(404).json({
        success: false,
        message: 'Tablet tracking record not found'
      });
    }

    await tabletTracking.endDailySession();

    res.json({
      success: true,
      message: 'Daily session ended successfully',
      data: {
        deviceId: tabletTracking.deviceId,
        totalHours: tabletTracking.currentSession.totalHoursOnline,
        totalDistance: tabletTracking.currentSession.totalDistanceTraveled,
        complianceStatus: tabletTracking.currentSession.complianceStatus
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

      const tabletTracking = await ScreenTracking.findByDeviceId(deviceId);
      
      if (!tabletTracking) {
        return res.status(404).json({
          success: false,
          message: 'Tablet tracking record not found'
        });
      }

    res.json({
      success: true,
      data: {
        deviceId: tabletTracking.deviceId,
        materialId: tabletTracking.materialId,
        carGroupId: tabletTracking.carGroupId,
        slotNumber: tabletTracking.slotNumber,
        isOnline: tabletTracking.isOnline,
        currentLocation: tabletTracking.getFormattedLocation(),
        lastSeen: tabletTracking.lastSeen,
        currentHours: tabletTracking.currentHoursToday,
        hoursRemaining: tabletTracking.hoursRemaining,
        isCompliant: tabletTracking.isCompliantToday,
        totalDistanceToday: tabletTracking.currentSession?.totalDistanceTraveled || 0,
        averageDailyHours: tabletTracking.averageDailyHours,
        complianceRate: tabletTracking.complianceRate,
        totalHoursOnline: tabletTracking.totalHoursOnline,
        totalDistanceTraveled: tabletTracking.totalDistanceTraveled,
        alerts: tabletTracking.alerts.filter(alert => !alert.isResolved)
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

    const tablets = await ScreenTracking.findByMaterial(materialId);
    
    const tabletsData = tablets.map(tablet => ({
      deviceId: tablet.deviceId,
      slotNumber: tablet.slotNumber,
      isOnline: tablet.isOnline,
      currentLocation: tablet.getFormattedLocation(),
      lastSeen: tablet.lastSeen,
      currentHours: tablet.currentHoursToday,
      hoursRemaining: tablet.hoursRemaining,
      isCompliant: tablet.isCompliantToday,
      totalDistanceToday: tablet.currentSession?.totalDistanceTraveled || 0
    }));

    res.json({
      success: true,
      data: {
        materialId,
        tablets: tabletsData,
        totalTablets: tablets.length,
        onlineTablets: tablets.filter(t => t.isOnline).length,
        compliantTablets: tablets.filter(t => t.isCompliantToday).length
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

    const tabletTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!tabletTracking) {
      return res.status(404).json({
        success: false,
        message: 'Tablet tracking record not found'
      });
    }

    let locationHistory = [];
    
    if (date) {
      // Get history for specific date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const session = tabletTracking.dailySessions.find(s => 
        new Date(s.date).getTime() === targetDate.getTime()
      );
      
      if (session) {
        locationHistory = session.locationHistory;
      }
    } else {
      // Get current session history
      if (tabletTracking.currentSession && tabletTracking.currentSession.locationHistory) {
        locationHistory = tabletTracking.currentSession.locationHistory;
      }
    }

    res.json({
      success: true,
      data: {
        deviceId: tabletTracking.deviceId,
        materialId: tabletTracking.materialId,
        locationHistory,
        totalPoints: locationHistory.length,
        totalDistance: locationHistory.length > 0 ? 
          tabletTracking.currentSession?.totalDistanceTraveled || 0 : 0
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

    // Only fetch materials that have actual connected devices (not just temporary records)
    const allTablets = await ScreenTracking.find({ 
      isActive: true,
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
    });
    
    // Initialize screens array to collect individual device records
    const individualScreens = [];
    const seenDisplayIds = new Set(); // Track unique display IDs to prevent duplicates
    let totalOnlineScreens = 0;
    let totalCompliantScreens = 0;
    let totalHours = 0;
    let totalDistance = 0;
    
    // Process each tablet and create individual device records
    allTablets.forEach(tablet => {
      if (tablet.devices && tablet.devices.length > 0) {
        // New multi-device structure: create individual records per device
        tablet.devices.forEach((device, index) => {
          // Use device-specific values if available, otherwise fall back to legacy values
          // Count hours if device is online (WebSocket or database status)
          const deviceHours = device.isOnline ? (device.totalHoursOnline || tablet.currentHoursToday || 0) : (tablet.currentHoursToday || 0);
          const deviceDistance = device.totalDistanceTraveled || tablet.currentSession?.totalDistanceTraveled || 0;
          const isDeviceOnline = device.isOnline;
          const isDeviceCompliant = deviceHours >= 8; // 8 hours target for compliance
          
          totalHours += deviceHours;
          totalDistance += deviceDistance;
          if (isDeviceOnline) totalOnlineScreens++;
          if (isDeviceCompliant) totalCompliantScreens++;
          
          // Create unique display ID by combining materialId with slot info
          const displayId = `${tablet.materialId}-SLOT-${device.slotNumber || (index + 1)}`;
          
          // Skip if we've already seen this display ID (deduplication)
          if (seenDisplayIds.has(displayId)) {
            console.log(`Skipping duplicate display ID: ${displayId}`);
            return;
          }
          seenDisplayIds.add(displayId);
          
          // Convert coordinates format for individual screens
          let deviceLocation = device.currentLocation || tablet.currentLocation;
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
              frontendDeviceLocation = deviceLocation;
            }
          }

          individualScreens.push({
            deviceId: device.deviceId,
            displayId: displayId, // Unique identifier for frontend display
            materialId: tablet.materialId,
            screenType: tablet.screenType,
            carGroupId: tablet.carGroupId,
            slotNumber: device.slotNumber || (index + 1),
            isOnline: isDeviceOnline,
            currentLocation: frontendDeviceLocation,
            lastSeen: device.lastSeen || tablet.lastSeen,
            currentHours: deviceHours,
            hoursRemaining: Math.max(0, 8 - deviceHours), // 8 hours target
            isCompliant: isDeviceCompliant,
            totalDistanceToday: deviceDistance,
            averageDailyHours: deviceHours,
            complianceRate: Math.min(100, (deviceHours / 8) * 100), // Percentage of 8-hour target
            totalHoursOnline: deviceHours,
            totalDistanceTraveled: deviceDistance,
            displayStatus: isDeviceOnline ? 'ACTIVE' : 'OFFLINE',
            screenMetrics: {
              ...(tablet.screenMetrics || {}),
              displayHours: deviceHours,
              adPlayCount: tablet.screenMetrics?.adPlayCount || 0,
              lastAdPlayed: tablet.screenMetrics?.lastAdPlayed || null,
              brightness: tablet.screenMetrics?.brightness || 100,
              volume: tablet.screenMetrics?.volume || 50,
              isDisplaying: isDeviceOnline,
              maintenanceMode: tablet.screenMetrics?.maintenanceMode || false,
              currentAd: tablet.screenMetrics?.currentAd || null
            },
            alerts: tablet.alerts || []
          });
        });
      } else {
        // Legacy single-device structure: use root-level fields for backward compatibility
        // Only process if there are NO devices in the devices array
        const legacyDisplayId = `${tablet.materialId}-SLOT-${tablet.slotNumber || 1}`;
        
        // Skip if we've already seen this display ID (deduplication)
        if (seenDisplayIds.has(legacyDisplayId)) {
          console.log(`Skipping duplicate legacy display ID: ${legacyDisplayId}`);
          return;
        }
        seenDisplayIds.add(legacyDisplayId);
        
        const legacyHours = tablet.currentHoursToday || 0;
        const legacyDistance = tablet.currentSession?.totalDistanceTraveled || 0;
        const isLegacyOnline = tablet.isOnline;
        const isLegacyCompliant = tablet.isCompliantToday || (legacyHours >= 8);
        
        totalHours += legacyHours;
        totalDistance += legacyDistance;
        if (isLegacyOnline) totalOnlineScreens++;
        if (isLegacyCompliant) totalCompliantScreens++;
        
        // Convert coordinates format for legacy structure
        let legacyLocation = tablet.getFormattedLocation ? tablet.getFormattedLocation() : tablet.currentLocation;
        let frontendLegacyLocation = null;
        if (legacyLocation) {
          if (legacyLocation.coordinates && Array.isArray(legacyLocation.coordinates)) {
            frontendLegacyLocation = {
              lat: legacyLocation.coordinates[1],
              lng: legacyLocation.coordinates[0],
              timestamp: legacyLocation.timestamp,
              speed: legacyLocation.speed,
              heading: legacyLocation.heading,
              accuracy: legacyLocation.accuracy,
              address: legacyLocation.address
            };
          } else if (legacyLocation.lat !== undefined && legacyLocation.lng !== undefined) {
            frontendLegacyLocation = legacyLocation;
          }
        }

        individualScreens.push({
          deviceId: tablet.deviceId,
          displayId: legacyDisplayId,
          materialId: tablet.materialId,
          screenType: tablet.screenType,
          carGroupId: tablet.carGroupId,
          slotNumber: tablet.slotNumber,
          isOnline: isLegacyOnline,
          currentLocation: frontendLegacyLocation,
          lastSeen: tablet.lastSeen,
          currentHours: legacyHours,
          hoursRemaining: tablet.hoursRemaining || Math.max(0, 8 - legacyHours),
          isCompliant: isLegacyCompliant,
          totalDistanceToday: legacyDistance,
          averageDailyHours: tablet.averageDailyHours || legacyHours,
          complianceRate: tablet.complianceRate || Math.min(100, (legacyHours / 8) * 100),
          totalHoursOnline: tablet.totalHoursOnline || legacyHours,
          totalDistanceTraveled: tablet.totalDistanceTraveled || legacyDistance,
          displayStatus: tablet.displayStatus || (isLegacyOnline ? 'ACTIVE' : 'OFFLINE'),
          screenMetrics: tablet.screenMetrics,
          alerts: tablet.alerts
        });
      }
    });

    // Create material-level records for map display (one per material)
    const materialScreens = [];
    allTablets.forEach(tablet => {
      // Use the first online device's location, or first device's location if none online
      let displayLocation = null;
      let displayStatus = 'OFFLINE';
      let hasOnlineDevice = false;
      
      if (tablet.devices && tablet.devices.length > 0) {
        const onlineDevice = tablet.devices.find(d => d.isOnline);
        if (onlineDevice) {
          displayLocation = onlineDevice.currentLocation || tablet.currentLocation;
          displayStatus = 'ACTIVE';
          hasOnlineDevice = true;
        } else {
          displayLocation = tablet.devices[0].currentLocation || tablet.currentLocation;
          displayStatus = 'OFFLINE';
        }
      } else {
        displayLocation = tablet.currentLocation;
        displayStatus = tablet.isOnline ? 'ACTIVE' : 'OFFLINE';
        hasOnlineDevice = tablet.isOnline;
      }
      
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

      materialScreens.push({
        materialId: tablet.materialId,
        deviceId: tablet.deviceId, // Legacy deviceId for compatibility
        screenType: tablet.screenType,
        carGroupId: tablet.carGroupId,
        isOnline: hasOnlineDevice,
        currentLocation: frontendLocation,
        lastSeen: tablet.lastSeen,
        displayStatus: displayStatus,
        totalDevices: tablet.devices?.length || 1,
        onlineDevices: tablet.devices?.filter(d => d.isOnline).length || (tablet.isOnline ? 1 : 0),
        // Aggregate data for display
        totalHours: tablet.devices?.reduce((sum, d) => sum + (d.totalHoursOnline || 0), 0) || (tablet.currentHoursToday || 0),
        totalDistance: tablet.devices?.reduce((sum, d) => sum + (d.totalDistanceTraveled || 0), 0) || (tablet.currentSession?.totalDistanceTraveled || 0),
        screenMetrics: tablet.screenMetrics,
        alerts: tablet.alerts
      });
    });

    const complianceReport = {
      date: targetDate,
      totalTablets: individualScreens.length,
      onlineTablets: totalOnlineScreens,
      compliantTablets: totalCompliantScreens,
      nonCompliantTablets: individualScreens.length - totalCompliantScreens,
      averageHours: individualScreens.length > 0 ? Math.round((totalHours / individualScreens.length) * 100) / 100 : 0,
      averageDistance: individualScreens.length > 0 ? Math.round((totalDistance / individualScreens.length) * 100) / 100 : 0,
      screens: individualScreens, // Individual device records for screen list
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
    const { deviceId, adId, adTitle, adDuration, viewTime = 0 } = req.body;

    // Validate required fields
    if (!deviceId || !adId || !adTitle) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, adId, adTitle'
      });
    }

    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    // Track ad playback
    await screenTracking.trackAdPlayback(adId, adTitle, adDuration, viewTime);

    res.json({
      success: true,
      message: 'Ad playback tracked successfully',
      data: {
        deviceId: screenTracking.deviceId,
        currentAd: screenTracking.screenMetrics.currentAd,
        totalAdsPlayed: screenTracking.screenMetrics.adPlayCount,
        dailyStats: screenTracking.screenMetrics.dailyAdStats
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

    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    // End ad playback
    await screenTracking.endAdPlayback();

    res.json({
      success: true,
      message: 'Ad playback ended successfully',
      data: {
        deviceId: screenTracking.deviceId,
        completedAd: screenTracking.screenMetrics.currentAd
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

    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    // Update driver activity
    await screenTracking.updateDriverActivity(isActive);

    res.json({
      success: true,
      message: 'Driver activity updated successfully',
      data: {
        deviceId: screenTracking.deviceId,
        displayHours: screenTracking.screenMetrics.displayHours,
        currentHours: screenTracking.currentHoursToday,
        totalHours: screenTracking.totalHoursOnline,
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
router.get('/adAnalytics/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { date } = req.query;

    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    let adPerformance = screenTracking.screenMetrics.adPerformance || [];
    let dailyStats = screenTracking.screenMetrics.dailyAdStats || {};

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date);
      // You can add date filtering logic here if needed
    }

    res.json({
      success: true,
      data: {
        deviceId: screenTracking.deviceId,
        materialId: screenTracking.materialId,
        currentAd: screenTracking.screenMetrics.currentAd,
        dailyStats: dailyStats,
        adPerformance: adPerformance,
        totalAdsPlayed: screenTracking.screenMetrics.adPlayCount,
        displayHours: screenTracking.screenMetrics.displayHours,
        lastAdPlayed: screenTracking.screenMetrics.lastAdPlayed
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

// GET /adAnalytics - Get ad analytics for all devices (filtered by user if provided)
router.get('/adAnalytics', async (req, res) => {
  try {
    const { date, materialId, userId } = req.query;

    let query = { isActive: true };
    if (materialId) {
      query.materialId = materialId;
    }

    const allTablets = await ScreenTracking.find(query);
    
    let analytics = allTablets.map(tablet => ({
      deviceId: tablet.deviceId,
      materialId: tablet.materialId,
      screenType: tablet.screenType,
      currentAd: tablet.screenMetrics.currentAd,
      dailyStats: tablet.screenMetrics.dailyAdStats,
      totalAdsPlayed: tablet.screenMetrics.adPlayCount,
      displayHours: tablet.screenMetrics.displayHours,
      adPerformance: tablet.screenMetrics.adPerformance || [],
      lastAdPlayed: tablet.screenMetrics.lastAdPlayed,
      isOnline: tablet.isOnline,
      lastSeen: tablet.lastSeen
    }));

    // Filter by user if userId is provided
    if (userId) {
      console.log(`🔍 Filtering ad analytics for user: ${userId}`);
      
      // Get all ads created by this user
      const Ad = require('../models/Ad');
      const userAds = await Ad.find({ userId: userId });
      const userAdIds = userAds.map(ad => ad._id.toString());
      
      console.log(`📊 Found ${userAdIds.length} ads for user ${userId}:`, userAdIds);
      
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

    const tabletTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!tabletTracking) {
      return res.status(404).json({
        success: false,
        message: 'Tablet tracking record not found'
      });
    }

    if (alertIndex >= 0 && alertIndex < tabletTracking.alerts.length) {
      tabletTracking.alerts[alertIndex].isResolved = true;
      await tabletTracking.save();
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

    const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
    
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'Screen tracking record not found'
      });
    }

    // Update screen metrics
    if (isDisplaying !== undefined) screenTracking.screenMetrics.isDisplaying = isDisplaying;
    if (brightness !== undefined) screenTracking.screenMetrics.brightness = brightness;
    if (volume !== undefined) screenTracking.screenMetrics.volume = volume;
    if (adPlayCount !== undefined) screenTracking.screenMetrics.adPlayCount = adPlayCount;
    if (maintenanceMode !== undefined) screenTracking.screenMetrics.maintenanceMode = maintenanceMode;
    
    screenTracking.screenMetrics.lastAdPlayed = new Date();
    screenTracking.lastSeen = new Date();

    // Add alerts for display issues
    if (!isDisplaying && screenTracking.screenMetrics.isDisplaying) {
      await screenTracking.addAlert(
        'DISPLAY_OFFLINE',
        'Screen display has been turned off',
        'HIGH'
      );
    }

    if (brightness < 50) {
      await screenTracking.addAlert(
        'LOW_BRIGHTNESS',
        `Screen brightness is low: ${brightness}%`,
        'MEDIUM'
      );
    }

    if (maintenanceMode) {
      await screenTracking.addAlert(
        'MAINTENANCE_NEEDED',
        'Screen is in maintenance mode',
        'MEDIUM'
      );
    }

    await screenTracking.save();

    res.json({
      success: true,
      message: 'Screen metrics updated successfully',
      data: {
        deviceId: screenTracking.deviceId,
        screenType: screenTracking.screenType,
        displayStatus: screenTracking.displayStatus,
        brightness: screenTracking.screenMetrics.brightness,
        volume: screenTracking.screenMetrics.volume,
        adPlayCount: screenTracking.screenMetrics.adPlayCount,
        lastSeen: screenTracking.lastSeen
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
    
    // Find all screens and sync their root isOnline with devices array
    const screens = await ScreenTracking.find({});
    let syncedCount = 0;
    
    for (const screen of screens) {
      if (screen.devices && screen.devices.length > 0) {
        // Check if any device in the array is online
        const hasOnlineDevice = screen.devices.some(device => device.isOnline);
        
        // Update root level isOnline to match the devices array
        if (screen.isOnline !== hasOnlineDevice) {
          console.log(`🔄 Syncing ${screen.deviceId}: ${screen.isOnline} -> ${hasOnlineDevice}`);
          await ScreenTracking.findByIdAndUpdate(
            screen._id,
            { 
              $set: { 
                isOnline: hasOnlineDevice,
                lastSeen: new Date()
              }
            }
          );
          syncedCount++;
        }
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
    await ScreenTracking.updateMany(
      { 
        $or: [
          { deviceId: deviceId },
          { 'devices.deviceId': deviceId }
        ]
      },
      { 
        $set: { 
          isOnline: false,
          'devices.$.isOnline': false
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
      await ScreenTracking.updateMany(
        { 
          $or: [
            { deviceId: deviceId },
            { 'devices.deviceId': deviceId }
          ]
        },
        { 
          $set: { 
            isOnline: foundStatus.isOnline,
            'devices.$.isOnline': foundStatus.isOnline
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
    
    // Clean up any stale sessions (older than 5 minutes)
    await ScreenTracking.updateMany(
      { 
        'devices.lastSeen': { $lt: fiveMinutesAgo },
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
    
    if (screenType) query.screenType = screenType;
    if (materialId) query.materialId = materialId;
    
    // Update status query to check lastSeen for online status (less aggressive)
    if (status === 'online') {
      query['devices.isOnline'] = true;
      query['devices.lastSeen'] = { $gte: twoMinutesAgo };
      query.isOnline = true;
      
      console.log('🔍 Online devices query:', JSON.stringify({
        'devices.isOnline': true,
        'devices.lastSeen': { $gte: twoMinutesAgo },
        isOnline: true
      }, null, 2));
    }
    if (status === 'offline') {
      query['$or'] = [
        { 'devices.isOnline': false },
        { 'devices.lastSeen': { $lt: twoMinutesAgo } },
        { 'devices': { $exists: false } },
        { isOnline: false }
      ];
    }
    if (status === 'displaying') query['screenMetrics.isDisplaying'] = true;
    if (status === 'maintenance') query['screenMetrics.maintenanceMode'] = true;

    console.log('🔍 Running query:', JSON.stringify(query, null, 2));
    const screens = await ScreenTracking.find(query);
    
    // Auto-sync root isOnline with devices array before processing
    for (const screen of screens) {
      if (screen.devices && screen.devices.length > 0) {
        const hasOnlineDevice = screen.devices.some(device => device.isOnline);
        if (screen.isOnline !== hasOnlineDevice) {
          console.log(`🔄 Auto-syncing ${screen.deviceId}: ${screen.isOnline} -> ${hasOnlineDevice}`);
          screen.isOnline = hasOnlineDevice;
          await screen.save();
        }
      }
      
      // Sync with DeviceStatusManager - check if we have a WebSocket connection for this materialId
      const allStatuses = deviceStatusService.getAllDeviceStatuses();
      const materialStatus = allStatuses.find(status => {
        // Check if this device ID matches the materialId pattern
        return status.deviceId === screen.materialId || 
               status.deviceId.includes(screen.materialId) ||
               screen.materialId.includes(status.deviceId);
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
      console.log('    devices:', screen.devices?.map(d => ({
        deviceId: d.deviceId,
        isOnline: d.isOnline,
        lastSeen: d.lastSeen,
        secondsAgo: d.lastSeen ? (now - new Date(d.lastSeen)) / 1000 : 'N/A'
      })));
    });
    
    // Update the isOnline status based on lastSeen
    const THIRTY_SECONDS = 30 * 1000; // 30 seconds in milliseconds
    
    const screensData = screens.map(screen => {
      // Use DeviceStatusManager as the new source of truth
      let deviceStatus = deviceStatusService.getDeviceStatus(screen.deviceId);
      let isActuallyOnline = deviceStatus.isOnline;
      
      // If DeviceStatusManager doesn't have this device, try to find it by materialId
      if (deviceStatus.source === 'timeout' && deviceStatus.confidence === 'low') {
        console.log(`🔍 [SCREEN TRACKING] DeviceStatusManager doesn't have ${screen.deviceId}, checking by materialId: ${screen.materialId}`);
        
        // Try to find the device by materialId in the DeviceStatusManager
        const allStatuses = deviceStatusService.getAllDeviceStatuses();
        const foundStatus = allStatuses.find(status => {
          // Check if this device ID matches the materialId pattern
          return status.deviceId === screen.materialId || 
                 status.deviceId.includes(screen.materialId) ||
                 screen.materialId.includes(status.deviceId);
        });
        
        if (foundStatus) {
          console.log(`🔍 [SCREEN TRACKING] Found matching device in DeviceStatusManager: ${foundStatus.deviceId} -> ${foundStatus.isOnline ? 'ONLINE' : 'OFFLINE'}`);
          // Update the DeviceStatusManager with the full device ID
          deviceStatusService.updateDeviceStatus(screen.deviceId, foundStatus.isOnline, new Date());
          // Re-get the status after updating
          deviceStatus = deviceStatusService.getDeviceStatus(screen.deviceId);
          isActuallyOnline = deviceStatus.isOnline;
        }
      }
      
      // Log the status source for debugging
      console.log(`🎯 [SCREEN TRACKING] Device ${screen.deviceId} (${screen.materialId}):`);
      console.log(`  - Status: ${isActuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`  - Source: ${deviceStatus.source}`);
      console.log(`  - Confidence: ${deviceStatus.confidence}`);
      console.log(`  - Last Seen: ${deviceStatus.lastSeen ? deviceStatus.lastSeen.toISOString() : 'Never'}`);
      
      // Legacy fallback logic (kept for compatibility)
      const hasOnlineDevice = screen.devices && screen.devices.some(device => {
        const deviceLastSeen = new Date(device.lastSeen);
        const deviceTimeSinceLastSeen = (now - deviceLastSeen) / 1000;
        return device.isOnline && deviceTimeSinceLastSeen <= 120; // 2 minutes timeout
      });
      
      const lastSeen = new Date(screen.lastSeen);
      const timeSinceLastSeen = (now - lastSeen) / 1000; // in seconds
      
      // Check device status based on last seen time
      console.log(`  - Has online device: ${hasOnlineDevice}`);
      console.log(`  - Final isOnline: ${isActuallyOnline}`);
      console.log(`  - Timeout check: ${timeSinceLastSeen} <= 120 = ${timeSinceLastSeen <= 120}`);
      
      // Determine display status based on actual online status
      let displayStatus;
      if (isActuallyOnline) {
        displayStatus = 'ONLINE';
      } else {
        displayStatus = 'OFFLINE';
      }
      
      return {
        deviceId: screen.deviceId,
        materialId: screen.materialId,
        screenType: screen.screenType,
        carGroupId: screen.carGroupId,
        slotNumber: screen.slotNumber,
        isOnline: isActuallyOnline,
        currentLocation: screen.getFormattedLocation(),
        lastSeen: screen.lastSeen,
        currentHours: screen.currentHoursToday,
        hoursRemaining: screen.hoursRemaining,
        totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
        displayStatus: displayStatus, // Use the determined status instead of screen.displayStatus
        screenMetrics: screen.screenMetrics
      };
    });
    
    console.log('Screens data mapping result:', screensData);
    console.log('Screens data mapping result length:', screensData.length);
    
    // Debug: Log the processed screens data
    console.log('Processed screens data:', JSON.stringify(screensData, null, 2));

    res.json({
      success: true,
      data: {
        screens: screensData,
        totalScreens: screens.length,
        onlineScreens: screens.filter(s => s.isOnline).length,
        displayingScreens: screens.filter(s => s.screenMetrics?.isDisplaying).length,
        maintenanceScreens: screens.filter(s => s.screenMetrics?.maintenanceMode).length
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
    const device = await ScreenTracking.findOne({ 'devices.deviceId': deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in database'
      });
    }
    
    // Find the specific device in the devices array
    const deviceInfo = device.devices.find(d => d.deviceId === deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId: deviceInfo?.deviceId,
        materialId: device.materialId,
        isOnline: deviceInfo?.isOnline,
        lastSeen: deviceInfo?.lastSeen,
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

// GET /screen-tracking/driver/:driverId - Get real-time ScreenTracking data for a driver
router.get('/driver/:driverId', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    
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
    
    // Find ScreenTracking record for this material
    const screenTracking = await ScreenTracking.findOne({ 
      materialId: material.materialId 
    });
    
    if (!screenTracking) {
      return res.status(404).json({
        success: false,
        message: 'No screen tracking data found for this driver'
      });
    }
    
    // Get driver details
    const driver = await Driver.findOne({ driverId: driverId });
    
    // Format the response to match mobile app expectations
    const response = {
      success: true,
      data: {
        driverId: driverId,
        vehiclePlateNumber: driver?.vehiclePlateNumber || 'Unknown',
        vehicleType: driver?.vehicleType || 'Unknown',
        materialId: material.materialId,
        materialType: material.materialType,
        isOnline: screenTracking.isOnline,
        lastSeen: screenTracking.lastSeen,
        currentLocation: screenTracking.currentLocation,
        
        // Real-time data from ScreenTracking
        currentHours: screenTracking.currentHoursToday || 0,
        hoursRemaining: screenTracking.hoursRemaining || 0,
        totalDistanceToday: screenTracking.currentSession?.totalDistanceTraveled || 0,
        averageSpeed: screenTracking.currentSession?.averageSpeed || 0,
        maxSpeed: screenTracking.currentSession?.maxSpeed || 0,
        
        // Compliance
        complianceRate: screenTracking.complianceRate || 0
        
        
        // Daily performance
        dailyPerformance: screenTracking.dailyPerformance || [],
        
        // Device info
        deviceId: screenTracking.deviceId,
        screenType: screenTracking.screenType,
        displayStatus: screenTracking.displayStatus,
        
        // Alerts
        totalAlerts: screenTracking.alerts?.length || 0,
        recentAlerts: screenTracking.alerts?.slice(-5) || []
      }
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
