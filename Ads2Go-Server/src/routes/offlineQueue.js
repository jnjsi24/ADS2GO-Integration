const express = require('express');
const router = express.Router();

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

// Handle queued location data
router.post('/location-data', async (req, res) => {
  try {
    const { lat, lng, speed, heading, accuracy, isOffline, queuedTimestamp } = req.body;
    
    console.log('📦 [OfflineQueue] Received queued location data:', {
      lat,
      lng,
      speed,
      heading,
      accuracy,
      isOffline,
      queuedTimestamp
    });
    
    // For now, just acknowledge receipt
    // In a full implementation, you'd update the location in the database
    res.json({
      success: true,
      message: 'Queued location data received',
      data: {
        lat,
        lng,
        speed,
        heading,
        accuracy,
        isOffline,
        queuedTimestamp
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
