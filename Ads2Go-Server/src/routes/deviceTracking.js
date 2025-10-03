const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');
const cronJobs = require('../jobs/cronJobs');

// Helper function to determine if location should be updated
async function shouldUpdateLocation(materialTracking, lat, lng, accuracy, timestamp) {
  // Always update if no current location
  if (!materialTracking.currentLocation) {
    return true;
  }

  // Update if this is a more accurate reading (lower accuracy number = better)
  if (accuracy < (materialTracking.currentLocation.accuracy || 999)) {
    return true;
  }

  // Update if this is a significantly newer timestamp
  const currentTime = new Date(materialTracking.lastSeen);
  const newTime = new Date(timestamp || new Date());
  const timeDiff = (newTime - currentTime) / 1000; // seconds
  
  if (timeDiff > 30) { // Update if more than 30 seconds newer
    return true;
  }

  // Update if location has moved significantly (more than 10 meters)
  const currentLat = materialTracking.currentLocation.coordinates[1];
  const currentLng = materialTracking.currentLocation.coordinates[0];
  const distance = calculateDistance(currentLat, currentLng, lat, lng);
  
  if (distance > 10) { // 10 meters
    return true;
  }

  return false;
}

// POST /deviceTracking/location-update - Update material/car location
router.post('/location-update', async (req, res) => {
  try {
    const { deviceId, materialId, deviceSlot, lat, lng, speed = 0, heading = 0, accuracy = 0, timestamp } = req.body;

    // Validate required fields
    if (!deviceId || !materialId || !deviceSlot || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, materialId, deviceSlot, lat, lng'
      });
    }

    // Track by material (car) instead of individual device
    console.log(`📍 Processing location update from Slot ${deviceSlot} for material ${materialId} (device: ${deviceId})`);
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));

    // Find or create car tracking record for today
    let carTracking = await DeviceTracking.findByMaterialId(materialId);
    console.log(`🔍 Found existing car record by materialId: ${carTracking ? 'YES' : 'NO'}`);
    
    // If not found by materialId, try to find by deviceId (fallback for restart scenarios)
    if (!carTracking) {
      console.log(`🔍 Trying to find car record by deviceId: ${deviceId}`);
      carTracking = await DeviceTracking.findByDeviceId(deviceId);
      console.log(`🔍 Found existing car record by deviceId: ${carTracking ? 'YES' : 'NO'}`);
      
      if (carTracking) {
        console.log(`🔄 Found car record by deviceId, updating materialId to: ${materialId}`);
        carTracking.materialId = materialId;
        carTracking.carGroupId = req.body.carGroupId || carTracking.carGroupId;
        await carTracking.save();
      }
    }
    
    if (!carTracking) {
      // Check if materialId looks like a deviceId (starts with "TABLET-")
      if (materialId.startsWith('TABLET-')) {
        console.log(`⚠️ MaterialId looks like deviceId: ${materialId}. Skipping location update to prevent duplicate records.`);
        return res.json({
          success: false,
          message: 'Invalid materialId - appears to be deviceId. Please ensure device is properly registered first.'
        });
      }
      
      // Create new car record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      carTracking = new DeviceTracking({
        materialId,
        carGroupId: req.body.carGroupId || 'UNKNOWN',
        screenType: 'HEADDRESS',
        date: today,
        isOnline: true,
        lastSeen: new Date(),
        slots: [{
          slotNumber: parseInt(deviceSlot),
          deviceId,
          isOnline: true,
          lastSeen: new Date(),
          deviceInfo: req.body.deviceInfo || {}
        }],
        currentSession: {
          date: today,
          startTime: new Date(),
          totalHoursOnline: 0,
          totalDistanceTraveled: 0,
          targetHours: 8,
          complianceStatus: 'NON_COMPLIANT',
          isActive: true
        }
      });
      await carTracking.save();
    } else {
      // Update the specific slot in the car record
      await carTracking.updateSlot(deviceSlot, {
        deviceId,
        isOnline: true,
        deviceInfo: req.body.deviceInfo || {}
      });
    }

    // Update location (only if this is a newer/better GPS reading)
    const shouldUpdate = await shouldUpdateLocation(carTracking, lat, lng, accuracy, timestamp);
    if (shouldUpdate) {
      await carTracking.updateLocation(lat, lng, speed, heading, accuracy, '', timestamp);

      // Update distance traveled
      if (carTracking.currentLocation && carTracking.locationHistory.length > 1) {
        const prevLocation = carTracking.locationHistory[carTracking.locationHistory.length - 2];
        const distance = calculateDistance(
          prevLocation.coordinates[1], prevLocation.coordinates[0], // lat, lng
          lat, lng
        );
        carTracking.totalDistanceTraveled += distance;
      }
    }

    // Get slot status for response
    const slotStatus = carTracking.getSlotStatus();
    const currentSlot = carTracking.getSlot(parseInt(deviceSlot));

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        materialId: carTracking.materialId,
        deviceId: currentSlot?.deviceId || deviceId,
        deviceSlot: parseInt(deviceSlot),
        currentLocation: carTracking.currentLocation,
        totalDistanceTraveled: carTracking.totalDistanceTraveled,
        lastSeen: carTracking.lastSeen,
        slotStatus: slotStatus
      }
    });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /deviceTracking/status-update - Update device status
router.post('/status-update', async (req, res) => {
  try {
    const { deviceId, deviceSlot, isOnline, deviceInfo, networkStatus } = req.body;

    if (!deviceId || !deviceSlot) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, deviceSlot'
      });
    }

    // Find the materialId and carGroupId from the Tablet collection
    const Tablet = require('../models/Tablet');
    const tablet = await Tablet.findOne({ 'tablets.deviceId': deviceId });
    
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in tablet registry. Please register the device first.'
      });
    }

    const materialId = tablet.materialId;
    const carGroupId = tablet.carGroupId;

    // Find or create device tracking record using the new schema
    let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
    
    if (!deviceTracking) {
      // Create new car record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      deviceTracking = new DeviceTracking({
        materialId,
        carGroupId,
        screenType: 'HEADDRESS',
        date: today,
        isOnline: isOnline || false,
        lastSeen: new Date(),
        slots: [{
          slotNumber: parseInt(deviceSlot),
          deviceId,
          isOnline: isOnline || false,
          lastSeen: new Date(),
          deviceInfo: deviceInfo || {}
        }],
        currentSession: {
          date: today,
          startTime: new Date(),
          totalHoursOnline: 0,
          totalDistanceTraveled: 0,
          targetHours: 8,
          complianceStatus: 'NON_COMPLIANT',
          isActive: true
        }
      });
      await deviceTracking.save();
    } else {
      // Update existing car record with new slot
      await deviceTracking.updateSlot(parseInt(deviceSlot), {
        deviceId,
        isOnline: isOnline || false,
        deviceInfo: deviceInfo || {}
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: {
        deviceId: deviceId,
        deviceSlot: parseInt(deviceSlot),
        materialId: materialId,
        isOnline: isOnline || false,
        lastSeen: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /deviceTracking/ad-playback - Track ad playback
router.post('/ad-playback', async (req, res) => {
  try {
    const { deviceId, deviceSlot, adId, adTitle, adDuration, viewTime = 0 } = req.body;

    if (!deviceId || !deviceSlot || !adId || !adTitle || !adDuration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, deviceSlot, adId, adTitle, adDuration'
      });
    }

    // Find the materialId and carGroupId from the Tablet collection
    const Tablet = require('../models/Tablet');
    const tablet = await Tablet.findOne({ 'tablets.deviceId': deviceId });
    
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in tablet registry. Please register the device first.'
      });
    }

    const materialId = tablet.materialId;
    const carGroupId = tablet.carGroupId;

    // Find or create device tracking record using the new schema
    let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
    
    if (!deviceTracking) {
      // Create new car record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      deviceTracking = new DeviceTracking({
        materialId,
        carGroupId,
        screenType: 'HEADDRESS',
        date: today,
        isOnline: true,
        lastSeen: new Date(),
        slots: [{
          slotNumber: parseInt(deviceSlot),
          deviceId,
          isOnline: true,
          lastSeen: new Date(),
          deviceInfo: {}
        }],
        currentSession: {
          date: today,
          startTime: new Date(),
          totalHoursOnline: 0,
          totalDistanceTraveled: 0,
          targetHours: 8,
          complianceStatus: 'NON_COMPLIANT',
          isActive: true
        }
      });
      await deviceTracking.save();
    } else {
      // Update existing car record with new slot if needed
      await deviceTracking.updateSlot(parseInt(deviceSlot), {
        deviceId,
        isOnline: true,
        deviceInfo: {}
      });
    }

    // Track ad playback using the new schema
    const slot = deviceTracking.getSlot(parseInt(deviceSlot));
    if (slot) {
      // Add ad playback to the slot
      const adPlayback = {
        adId,
        adTitle,
        materialId: materialId,
        slotNumber: parseInt(deviceSlot),
        adDuration: parseInt(adDuration),
        startTime: new Date(),
        endTime: null,
        viewTime: Math.round(parseInt(viewTime) * 100) / 100,
        completionRate: Math.round((parseInt(viewTime) / parseInt(adDuration)) * 10000) / 100,
        impressions: 1
      };
      
      deviceTracking.adPlaybacks.push(adPlayback);
      deviceTracking.totalAdPlays += 1;
      deviceTracking.totalAdPlayTime += parseInt(viewTime);
      deviceTracking.totalAdImpressions += 1;
      
      // Clean up old ad playbacks (keep only last 800)
      deviceTracking.cleanupAdPlaybacks();
      
      await deviceTracking.save();
    }

    res.json({
      success: true,
      message: 'Ad playback tracked successfully',
      data: {
        deviceId: deviceId,
        deviceSlot: parseInt(deviceSlot),
        materialId: materialId,
        totalAdPlays: deviceTracking.totalAdPlays,
        totalAdPlayTime: deviceTracking.totalAdPlayTime
      }
    });

  } catch (error) {
    console.error('Error tracking ad playback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track ad playback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /deviceTracking/qr-scan - Track QR scan
router.post('/qr-scan', async (req, res) => {
  try {
    const { deviceId, deviceSlot, qrScanData } = req.body;

    if (!deviceId || !deviceSlot || !qrScanData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, deviceSlot, qrScanData'
      });
    }

    // Accept data from both Slot 1 and Slot 2 since they are different physical devices
    console.log(`📱 Processing QR scan from Slot ${deviceSlot} for device ${deviceId}`);

    // Find the materialId and carGroupId from the Tablet collection
    const Tablet = require('../models/Tablet');
    const tablet = await Tablet.findOne({ 'tablets.deviceId': deviceId });
    
    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in tablet registry. Please register the device first.'
      });
    }

    const materialId = tablet.materialId;
    const carGroupId = tablet.carGroupId;

    // Find or create device tracking record using the new schema
    let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
    
    if (!deviceTracking) {
      // Create new car record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      deviceTracking = new DeviceTracking({
        materialId,
        carGroupId,
        screenType: 'HEADDRESS',
        date: today,
        isOnline: true,
        lastSeen: new Date(),
        slots: [{
          slotNumber: parseInt(deviceSlot),
          deviceId,
          isOnline: true,
          lastSeen: new Date(),
          deviceInfo: {}
        }],
        currentSession: {
          date: today,
          startTime: new Date(),
          totalHoursOnline: 0,
          totalDistanceTraveled: 0,
          targetHours: 8,
          complianceStatus: 'NON_COMPLIANT',
          isActive: true
        }
      });
      await deviceTracking.save();
    } else {
      // Update existing car record with new slot if needed
      await deviceTracking.updateSlot(parseInt(deviceSlot), {
        deviceId,
        isOnline: true,
        deviceInfo: {}
      });
    }

    // Track QR scan using the new schema
    const slot = deviceTracking.getSlot(parseInt(deviceSlot));
    if (slot) {
      // Add QR scan to the device tracking
      deviceTracking.qrScans.push({
        ...qrScanData,
        slotNumber: parseInt(deviceSlot)
      });
      deviceTracking.totalQRScans += 1;
      
      await deviceTracking.save();
    }

    res.json({
      success: true,
      message: 'QR scan tracked successfully',
      data: {
        deviceId: deviceId,
        deviceSlot: parseInt(deviceSlot),
        materialId: materialId,
        totalQRScans: deviceTracking.totalQRScans
      }
    });

  } catch (error) {
    console.error('Error tracking QR scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track QR scan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /deviceTracking/current-day - Get current day data
router.get('/current-day', async (req, res) => {
  try {
    const { deviceId, deviceSlot } = req.query;
    
    let query = {};
    if (deviceId) query.deviceId = deviceId;
    if (deviceSlot) query.deviceSlot = parseInt(deviceSlot);

    const devices = await DeviceTracking.find(query);
    
    res.json({
      success: true,
      data: devices,
      count: devices.length,
      message: `Found ${devices.length} devices for current day`
    });

  } catch (error) {
    console.error('Error getting current day data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current day data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /deviceTracking/history - Get historical data
router.get('/history', async (req, res) => {
  try {
    const { deviceId, deviceSlot, startDate, endDate, limit = 100 } = req.query;

    let query = {};
    if (deviceId) query.deviceId = deviceId;
    if (deviceSlot) query.deviceSlot = parseInt(deviceSlot);
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const history = await DeviceDataHistoryV2.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: history,
      count: history.length,
      message: `Found ${history.length} historical records`
    });

  } catch (error) {
    console.error('Error getting historical data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get historical data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /deviceTracking/route/:deviceId - Get historical route data from DeviceDataHistory
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

    // Build query for DeviceDataHistory
    let query = { deviceId };
    
    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.date = {
        $gte: targetDate,
        $lt: nextDay
      };
    }

    console.log(`🔍 [DEVICE_TRACKING_ROUTE] Searching for deviceId: ${deviceId}, date: ${date}`);
    console.log(`🔍 [DEVICE_TRACKING_ROUTE] Query:`, JSON.stringify(query, null, 2));

    // Find historical records
    const historyRecords = await DeviceDataHistoryV2.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log(`📊 [DEVICE_TRACKING_ROUTE] Found ${historyRecords.length} historical records`);
    
    if (historyRecords.length === 0) {
      // Debug: List all available records for this device
      const allRecords = await DeviceDataHistoryV2.find({ materialId: deviceId }).select('dailyData.date dailyData.totalDistanceTraveled dailyData.locationHistory').sort({ 'dailyData.date': -1 }).limit(10);
      console.log(`🔍 [DEVICE_TRACKING_ROUTE] Available records for device ${deviceId}:`, allRecords.map(r => ({
        date: r.date,
        totalDistanceTraveled: r.totalDistanceTraveled,
        locationHistoryLength: r.locationHistory ? r.locationHistory.length : 0
      })));
      
      return res.status(404).json({
        success: false,
        message: 'No historical route data found for this device'
      });
    }

    // Combine location history from all records
    let allLocationHistory = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalAdPlays = 0;
    let totalHoursOnline = 0;

    historyRecords.forEach(record => {
      if (record.locationHistory && record.locationHistory.length > 0) {
        console.log(`📍 [DEVICE_TRACKING_ROUTE] Record from ${record.date.toISOString().split('T')[0]} has ${record.locationHistory.length} location points`);
        console.log(`📍 [DEVICE_TRACKING_ROUTE] First stored point:`, {
          coordinates: record.locationHistory[0].coordinates,
          timestamp: record.locationHistory[0].timestamp,
          address: record.locationHistory[0].address
        });
        console.log(`📍 [DEVICE_TRACKING_ROUTE] Last stored point:`, {
          coordinates: record.locationHistory[record.locationHistory.length - 1].coordinates,
          timestamp: record.locationHistory[record.locationHistory.length - 1].timestamp,
          address: record.locationHistory[record.locationHistory.length - 1].address
        });
        allLocationHistory = allLocationHistory.concat(record.locationHistory);
      }
      totalDistance += record.totalDistanceTraveled || 0;
      totalAdPlays += record.totalAdPlays || 0;
      totalHoursOnline += record.totalHoursOnline || 0;
    });

    // Sort by timestamp
    allLocationHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Convert to route format for frontend
    const routeData = allLocationHistory.map(point => ({
      lat: point.coordinates[1], // Convert from GeoJSON [lng, lat] to [lat, lng]
      lng: point.coordinates[0],
      timestamp: point.timestamp,
      speed: point.speed || 0,
      heading: point.heading || 0,
      accuracy: point.accuracy || 0,
      address: point.address || ''
    }));

    // Calculate route metrics
    let averageSpeed = 0;
    
    if (routeData.length > 1) {
      // Calculate duration
      const startTime = new Date(routeData[0].timestamp);
      const endTime = new Date(routeData[routeData.length - 1].timestamp);
      totalDuration = (endTime.getTime() - startTime.getTime()) / 1000; // seconds
      
      // Calculate average speed
      if (totalDuration > 0) {
        averageSpeed = (totalDistance / totalDuration) * 3600; // km/h
      }
    }

    const responseData = {
      deviceId,
      materialId: historyRecords[0].materialId || 'Unknown',
      route: routeData,
      metrics: {
        totalDistance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
        totalDuration: Math.round(totalDuration),
        averageSpeed: Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
        pointCount: routeData.length,
        startTime: routeData.length > 0 ? routeData[0].timestamp : null,
        endTime: routeData.length > 0 ? routeData[routeData.length - 1].timestamp : null,
        totalAdPlays,
        totalHoursOnline: Math.round(totalHoursOnline * 100) / 100,
        recordCount: historyRecords.length,
        dateRange: {
          start: historyRecords[historyRecords.length - 1].date,
          end: historyRecords[0].date
        }
      }
    };

    console.log(`✅ [DEVICE_TRACKING_ROUTE] Returning data:`, {
      deviceId: responseData.deviceId,
      materialId: responseData.materialId,
      routeLength: responseData.route.length,
      totalDistance: responseData.metrics.totalDistance,
      totalAdPlays: responseData.metrics.totalAdPlays,
      totalHoursOnline: responseData.metrics.totalHoursOnline
    });

    // Debug: Log the actual coordinates being returned
    if (responseData.route.length > 0) {
      console.log(`🗺️ [DEVICE_TRACKING_ROUTE] First coordinate:`, {
        lat: responseData.route[0].lat,
        lng: responseData.route[0].lng,
        address: responseData.route[0].address,
        timestamp: responseData.route[0].timestamp
      });
      console.log(`🗺️ [DEVICE_TRACKING_ROUTE] Last coordinate:`, {
        lat: responseData.route[responseData.route.length - 1].lat,
        lng: responseData.route[responseData.route.length - 1].lng,
        address: responseData.route[responseData.route.length - 1].address,
        timestamp: responseData.route[responseData.route.length - 1].timestamp
      });
    }

    res.json({
      success: true,
      message: 'Historical route data retrieved successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching historical route data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /deviceTracking/archive - Manual archive trigger
router.post('/archive', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (date) {
      await cronJobs.triggerArchiveForDate(date);
      res.json({
        success: true,
        message: `Manual archive completed for date: ${date}`
      });
    } else {
      await cronJobs.triggerDailyArchive();
      res.json({
        success: true,
        message: 'Manual daily archive completed'
      });
    }

  } catch (error) {
    console.error('Error triggering manual archive:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger archive',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /deviceTracking/archive-status - Get archive status
router.get('/archive-status', async (req, res) => {
  try {
    const status = await cronJobs.getArchiveStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting archive status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get archive status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
