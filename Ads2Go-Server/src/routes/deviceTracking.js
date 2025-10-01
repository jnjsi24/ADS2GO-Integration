const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistory = require('../models/deviceDataHistory');
const dailyArchiveJob = require('../jobs/dailyArchiveJob');
const cronJobs = require('../jobs/cronJobs');

// POST /deviceTracking/location-update - Update device location
router.post('/location-update', async (req, res) => {
  try {
    const { deviceId, deviceSlot, lat, lng, speed = 0, heading = 0, accuracy = 0 } = req.body;

    // Validate required fields
    if (!deviceId || !deviceSlot || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, deviceSlot, lat, lng'
      });
    }

    // Find or create device tracking record for today
    let device = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!device) {
      // Create new device record for today
      device = new DeviceTracking({
        deviceId,
        deviceSlot,
        date: new Date().toISOString().split('T')[0],
        deviceInfo: req.body.deviceInfo || {},
        isOnline: true,
        lastSeen: new Date()
      });
      await device.save(); // Save the new device first
    }

    // Update location
    await device.updateLocation(lat, lng, speed, heading, accuracy);

    // Update distance traveled
    if (device.currentLocation && device.locationHistory.length > 1) {
      const prevLocation = device.locationHistory[device.locationHistory.length - 2];
      const distance = calculateDistance(
        prevLocation.coordinates[1], prevLocation.coordinates[0], // lat, lng
        lat, lng
      );
      device.totalDistanceTraveled += distance;
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        deviceId: device.deviceId,
        deviceSlot: device.deviceSlot,
        currentLocation: device.currentLocation,
        totalDistanceTraveled: device.totalDistanceTraveled,
        lastSeen: device.lastSeen
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

    // Find or create device tracking record
    let device = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!device) {
      device = new DeviceTracking({
        deviceId,
        deviceSlot,
        date: new Date().toISOString().split('T')[0],
        deviceInfo: deviceInfo || {},
        isOnline: isOnline || false,
        lastSeen: new Date()
      });
      await device.save(); // Save the new device first
    }

    // Update status
    await device.setOnlineStatus(isOnline);
    
    if (deviceInfo) {
      device.deviceInfo = { ...device.deviceInfo, ...deviceInfo };
    }
    
    if (networkStatus) {
      device.networkStatus = { ...device.networkStatus, ...networkStatus };
    }

    await device.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: {
        deviceId: device.deviceId,
        deviceSlot: device.deviceSlot,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
        networkStatus: device.networkStatus
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

    // Find or create device tracking record
    let device = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!device) {
      device = new DeviceTracking({
        deviceId,
        deviceSlot,
        date: new Date().toISOString().split('T')[0],
        isOnline: true,
        lastSeen: new Date()
      });
      await device.save(); // Save the new device first
    }

    // Track ad playback
    await device.trackAdPlayback(adId, adTitle, adDuration, viewTime);

    res.json({
      success: true,
      message: 'Ad playback tracked successfully',
      data: {
        deviceId: device.deviceId,
        deviceSlot: device.deviceSlot,
        currentAd: device.currentAd,
        totalAdPlays: device.totalAdPlays,
        totalAdPlayTime: device.totalAdPlayTime
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

    // Find or create device tracking record
    let device = await DeviceTracking.findByDeviceId(deviceId);
    
    if (!device) {
      device = new DeviceTracking({
        deviceId,
        deviceSlot,
        date: new Date().toISOString().split('T')[0],
        isOnline: true,
        lastSeen: new Date()
      });
      await device.save(); // Save the new device first
    }

    // Track QR scan
    await device.trackQRScan(qrScanData);

    res.json({
      success: true,
      message: 'QR scan tracked successfully',
      data: {
        deviceId: device.deviceId,
        deviceSlot: device.deviceSlot,
        totalQRScans: device.totalQRScans,
        qrScansByAd: device.qrScansByAd
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

    const history = await DeviceDataHistory.find(query)
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
