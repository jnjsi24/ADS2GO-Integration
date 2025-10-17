const express = require('express');
const router = express.Router();
const deviceHoursNotificationService = require('../services/deviceHoursNotificationService');
const DeviceTracking = require('../models/deviceTracking');

/**
 * Test endpoint to manually trigger 8-hour milestone notification
 * POST /api/device-hours/test-notification
 */
router.post('/test-notification', async (req, res) => {
  try {
    const { deviceId, hours = 8.0 } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Find device tracking record
    const deviceTracking = await DeviceTracking.findOne({ deviceId });
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    // Manually trigger 8-hour milestone check
    await deviceHoursNotificationService.checkAndNotify8HourMilestone(deviceId, hours);

    res.json({
      success: true,
      message: `8-hour milestone notification triggered for device ${deviceId} with ${hours} hours`,
      deviceId,
      hours
    });

  } catch (error) {
    console.error('Error triggering test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get today's notification statistics
 * GET /api/device-hours/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = deviceHoursNotificationService.getTodayNotificationStats();
    
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
 * Check all devices for 8-hour milestones (manual trigger)
 * POST /api/device-hours/check-all
 */
router.post('/check-all', async (req, res) => {
  try {
    await deviceHoursNotificationService.checkAllDevicesFor8HourMilestone();
    
    res.json({
      success: true,
      message: '8-hour milestone check completed for all devices'
    });

  } catch (error) {
    console.error('Error checking all devices:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Reset daily notification tracking (for testing)
 * POST /api/device-hours/reset-daily
 */
router.post('/reset-daily', async (req, res) => {
  try {
    deviceHoursNotificationService.resetDailyTracking();
    
    res.json({
      success: true,
      message: 'Daily notification tracking reset'
    });

  } catch (error) {
    console.error('Error resetting daily tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get device hours information
 * GET /api/device-hours/device/:deviceId
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const deviceTracking = await DeviceTracking.findOne({ deviceId });
    if (!deviceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Device tracking record not found'
      });
    }

    const currentHours = deviceTracking.currentHoursToday || 0;
    const wasNotificationSent = deviceHoursNotificationService.wasNotificationSentToday(deviceId);

    res.json({
      success: true,
      data: {
        deviceId,
        currentHours: Math.round(currentHours * 100) / 100,
        targetHours: 8,
        hoursRemaining: Math.max(0, 8 - currentHours),
        complianceStatus: deviceTracking.currentSession?.complianceStatus || 'PENDING',
        isOnline: deviceTracking.isOnline,
        lastSeen: deviceTracking.lastSeen,
        notificationSentToday: wasNotificationSent,
        driverInfo: deviceTracking.driverId ? {
          id: deviceTracking.driverId,
          name: `${deviceTracking.driverId.firstName || ''} ${deviceTracking.driverId.lastName || ''}`.trim()
        } : null
      }
    });

  } catch (error) {
    console.error('Error getting device hours:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
