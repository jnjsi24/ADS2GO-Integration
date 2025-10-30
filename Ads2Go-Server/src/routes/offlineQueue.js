const express = require('express');
const router = express.Router();
const GPSValidation = require('../utils/gpsValidation');

// Handle queued device status updates
router.post('/device-status', async (req, res) => {
  try {
    const { isOnline, lastSeen, isOffline, queuedTimestamp } = req.body;
    
    console.log('📦 [OfflineQueue] Received queued device status:', {
      isOnline,
      lastSeen,
      isOffline,
      queuedTimestamp
    });
    
    // For now, just acknowledge receipt
    // In a full implementation, you'd update the device status in the database
    res.json({
      success: true,
      message: 'Queued device status received',
      data: {
        isOnline,
        lastSeen,
        isOffline,
        queuedTimestamp
      }
    });
  } catch (error) {
    console.error('❌ [OfflineQueue] Error processing device status:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing queued device status',
      error: error.message
    });
  }
});

// ✅ FIX: In-memory deduplication for queued location data
const processedTimestamps = new Map(); // materialId -> Set of timestamps

// Helper to clean old timestamps (keep last 1 hour)
function cleanOldTimestamps(materialId, currentTimestamp) {
  const timestamps = processedTimestamps.get(materialId);
  if (!timestamps) return;
  
  const oneHourAgo = currentTimestamp - (60 * 60 * 1000);
  
  for (const ts of timestamps) {
    if (ts < oneHourAgo) {
      timestamps.delete(ts);
    }
  }
}

// Handle queued location data
router.post('/location-data', async (req, res) => {
  try {
    const { lat, lng, speed, heading, accuracy, isOffline, queuedTimestamp, deviceId, materialId, deviceSlot } = req.body;
    
    // ✅ CHECK IF ALREADY PROCESSED
    if (queuedTimestamp && materialId) {
      if (processedTimestamps.has(materialId)) {
        const timestamps = processedTimestamps.get(materialId);
        if (timestamps.has(queuedTimestamp)) {
          console.log(`⏭️ [OfflineQueue] Duplicate timestamp ${queuedTimestamp} for ${materialId}, skipping`);
          return res.json({
            success: true,
            message: 'Duplicate timestamp, already processed',
            skipped: true
          });
        }
        timestamps.add(queuedTimestamp);
      } else {
        processedTimestamps.set(materialId, new Set([queuedTimestamp]));
      }
      
      // Clean old timestamps
      cleanOldTimestamps(materialId, queuedTimestamp);
    }
    
    console.log('📦 [OfflineQueue] Received queued location data:', {
      lat,
      lng,
      speed,
      heading,
      accuracy,
      isOffline,
      queuedTimestamp,
      deviceId,
      materialId,
      deviceSlot
    });
    
    // Process the location update through the device tracking system
    const DeviceTracking = require('../models/deviceTracking');
    
    // Find the device by materialId or deviceId
    let carTracking = null;
    if (materialId) {
      carTracking = await DeviceTracking.findByMaterialId(materialId);
    } else if (deviceId) {
      carTracking = await DeviceTracking.findByDeviceId(deviceId);
    }
    
    if (!carTracking) {
      console.log('⚠️ [OfflineQueue] No device found for location update');
      return res.json({
        success: false,
        message: 'Device not found for location update'
      });
    }

    // Helper function to determine if location should be updated
    const shouldUpdateLocation = async (materialTracking, lat, lng, accuracy, timestamp) => {
      // Validate GPS coordinates using centralized validation
      const coordValidation = GPSValidation.validateCoordinates(lat, lng);
      if (!coordValidation.isValid) {
        return false;
      }
      
      // Filter out poor GPS accuracy (more than 100 meters)
      if (accuracy > 100) {
        return false;
      }
      
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
      const distance = GPSValidation.calculateDistance(currentLat, currentLng, lat, lng);
      
      if (distance > 0.01) { // 0.01 km = 10 meters
        return true;
      }

      return false;
    };

    const shouldUpdate = await shouldUpdateLocation(carTracking, lat, lng, accuracy, queuedTimestamp);
    
    if (shouldUpdate) {
      // Use the updateLocation method which handles distance calculation and version conflicts
      const updatedDevice = await carTracking.updateLocation(lat, lng, speed, heading, accuracy, '', queuedTimestamp);
      
      if (updatedDevice) {
        console.log(`✅ [OfflineQueue] Updated location for ${updatedDevice.materialId}`);
      }
    }
    
    res.json({
      success: true,
      message: 'Queued location data processed',
      data: {
        lat,
        lng,
        speed,
        heading,
        accuracy,
        isOffline,
        queuedTimestamp,
        totalDistanceTraveled: carTracking.totalDistanceTraveled
      }
    });
  } catch (error) {
    console.error('❌ [OfflineQueue] Error processing location data:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing queued location data',
      error: error.message
    });
  }
});

// Handle queued ad playbacks
router.post('/ad-playback', async (req, res) => {
  try {
    const { 
      adId, 
      adTitle, 
      adDuration, 
      startTime, 
      endTime, 
      viewTime, 
      completionRate, 
      impressions, 
      slotNumber, 
      isOffline, 
      queuedTimestamp 
    } = req.body;
    
    console.log('📦 [OfflineQueue] Received queued ad playback:', {
      adId,
      adTitle,
      adDuration,
      startTime,
      endTime,
      viewTime,
      completionRate,
      impressions,
      slotNumber,
      isOffline,
      queuedTimestamp
    });
    
    // For now, just acknowledge receipt
    // In a full implementation, you'd process the ad playback data
    res.json({
      success: true,
      message: 'Queued ad playback received',
      data: {
        adId,
        adTitle,
        adDuration,
        startTime,
        endTime,
        viewTime,
        completionRate,
        impressions,
        slotNumber,
        isOffline,
        queuedTimestamp
      }
    });
  } catch (error) {
    console.error('❌ [OfflineQueue] Error processing ad playback:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing queued ad playback',
      error: error.message
    });
  }
});

// Handle queued QR scans
router.post('/qr-scan', async (req, res) => {
  try {
    const { adId, adTitle, qrCode, isOffline, queuedTimestamp } = req.body;
    
    console.log('📦 [OfflineQueue] Received queued QR scan:', {
      adId,
      adTitle,
      qrCode,
      isOffline,
      queuedTimestamp
    });
    
    // For now, just acknowledge receipt
    // In a full implementation, you'd process the QR scan data
    res.json({
      success: true,
      message: 'Queued QR scan received',
      data: {
        adId,
        adTitle,
        qrCode,
        isOffline,
        queuedTimestamp
      }
    });
  } catch (error) {
    console.error('❌ [OfflineQueue] Error processing QR scan:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing queued QR scan',
      error: error.message
    });
  }
});

module.exports = router;
