const express = require('express');
const router = express.Router();
const deviceOfflineNotificationService = require('../services/deviceOfflineNotificationService');

/**
 * Test endpoint to manually trigger offline notification
 * POST /api/device-offline/test-offline
 */
router.post('/test-offline', async (req, res) => {
  try {
    const { deviceId, reason = 'websocket_disconnect' } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Manually trigger offline notification
    await deviceOfflineNotificationService.checkDeviceStatusChange(deviceId, false, reason);

    res.json({
      success: true,
      message: `Offline notification triggered for device ${deviceId}`,
      deviceId,
      reason
    });

  } catch (error) {
    console.error('Error triggering test offline notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Test endpoint to manually trigger online notification
 * POST /api/device-offline/test-online
 */
router.post('/test-online', async (req, res) => {
  try {
    const { deviceId, reason = 'websocket_connect' } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Manually trigger online notification
    await deviceOfflineNotificationService.checkDeviceStatusChange(deviceId, true, reason);

    res.json({
      success: true,
      message: `Online notification triggered for device ${deviceId}`,
      deviceId,
      reason
    });

  } catch (error) {
    console.error('Error triggering test online notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get notification statistics
 * GET /api/device-offline/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = deviceOfflineNotificationService.getNotificationStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get device status history
 * GET /api/device-offline/device/:deviceId
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const history = deviceOfflineNotificationService.getDeviceStatusHistory(deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId,
        history: history || null
      }
    });

  } catch (error) {
    console.error('Error getting device status history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get all device statuses
 * GET /api/device-offline/devices
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = deviceOfflineNotificationService.getAllDeviceStatuses();
    
    res.json({
      success: true,
      data: {
        devices,
        count: devices.length
      }
    });

  } catch (error) {
    console.error('Error getting all device statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Clean up old history (manual trigger)
 * POST /api/device-offline/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    deviceOfflineNotificationService.cleanupOldHistory();
    
    res.json({
      success: true,
      message: 'Old history cleaned up successfully'
    });

  } catch (error) {
    console.error('Error cleaning up old history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
