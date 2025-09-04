const express = require('express');
const router = express.Router();
const ScreenTracking = require('../models/screenTracking');
const OSMService = require('../services/osmService');

// POST /updateLocation - Update tablet location and start/continue daily session
router.post('/updateLocation', async (req, res) => {
  try {
    const { deviceId, lat, lng, speed = 0, heading = 0, accuracy = 0 } = req.body;

    // Validate required fields
    if (!deviceId || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, lat, lng'
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

    // Check if we need to start a new daily session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!screenTracking.currentSession || 
        new Date(screenTracking.currentSession.date).getTime() !== today.getTime()) {
      // End previous session if exists
      if (screenTracking.currentSession && screenTracking.currentSession.isActive) {
        await screenTracking.endDailySession();
      }
      
      // Start new daily session
      await screenTracking.startDailySession();
    }

    // Update location
    try {
      await screenTracking.updateLocation(lat, lng, speed, heading, accuracy, address);
      console.log('Location updated successfully for device:', deviceId);
    } catch (error) {
      console.error('Error updating location:', error);
      // Continue processing even if location update fails
    }

    // Check for alerts (optional - don't fail if alerts fail)
    try {
      const currentHours = screenTracking.currentHoursToday;
      const hoursRemaining = screenTracking.hoursRemaining;
      
      // Alert for low hours (less than 6 hours with 2 hours remaining) - Only for HEADDRESS
      if (screenTracking.screenType === 'HEADDRESS' && currentHours < 6 && hoursRemaining > 2) {
        await screenTracking.addAlert(
          'LOW_HOURS',
          `Driver has only ${currentHours} hours today. ${hoursRemaining} hours remaining to meet 8-hour target.`,
          'HIGH'
        );
      }

      // Alert for speed violations (over 80 km/h) - Only for HEADDRESS
      if (screenTracking.screenType === 'HEADDRESS' && speed > 80) {
        await screenTracking.addAlert(
          'SPEED_VIOLATION',
          `Speed violation detected: ${speed} km/h`,
          'MEDIUM'
        );
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

    const allTablets = await ScreenTracking.find({ isActive: true });
    
    const complianceReport = {
      date: targetDate,
      totalTablets: allTablets.length,
      onlineTablets: allTablets.filter(t => t.isOnline).length,
      compliantTablets: allTablets.filter(t => t.isCompliantToday).length,
      nonCompliantTablets: allTablets.filter(t => !t.isCompliantToday).length,
      averageHours: 0,
      averageDistance: 0,
      tablets: []
    };

    if (allTablets.length > 0) {
      const totalHours = allTablets.reduce((sum, t) => sum + t.currentHoursToday, 0);
      const totalDistance = allTablets.reduce((sum, t) => 
        sum + (t.currentSession?.totalDistanceTraveled || 0), 0
      );
      
      complianceReport.averageHours = Math.round((totalHours / allTablets.length) * 100) / 100;
      complianceReport.averageDistance = Math.round((totalDistance / allTablets.length) * 100) / 100;
    }

    complianceReport.screens = allTablets.map(tablet => ({
      deviceId: tablet.deviceId,
      materialId: tablet.materialId,
      screenType: tablet.screenType,
      carGroupId: tablet.carGroupId,
      slotNumber: tablet.slotNumber,
      isOnline: tablet.isOnline,
      currentLocation: tablet.getFormattedLocation(),
      lastSeen: tablet.lastSeen,
      currentHours: tablet.currentHoursToday,
      hoursRemaining: tablet.hoursRemaining,
      isCompliant: tablet.isCompliantToday,
      totalDistanceToday: tablet.currentSession?.totalDistanceTraveled || 0,
      averageDailyHours: tablet.averageDailyHours,
      complianceRate: tablet.complianceRate,
      totalHoursOnline: tablet.totalHoursOnline,
      totalDistanceTraveled: tablet.totalDistanceTraveled,
      displayStatus: tablet.displayStatus,
      screenMetrics: tablet.screenMetrics,
      alerts: tablet.alerts
    }));

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

// GET /adAnalytics - Get ad analytics for all devices
router.get('/adAnalytics', async (req, res) => {
  try {
    const { date, materialId } = req.query;

    let query = { isActive: true };
    if (materialId) {
      query.materialId = materialId;
    }

    const allTablets = await ScreenTracking.find(query);
    
    const analytics = allTablets.map(tablet => ({
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
router.get('/screens', async (req, res) => {
  try {
    const { screenType, status, materialId } = req.query;
    
    let query = {};
    
    if (screenType) query.screenType = screenType;
    if (materialId) query.materialId = materialId;
    if (status === 'online') query.isOnline = true;
    if (status === 'offline') query.isOnline = false;
    if (status === 'displaying') query['screenMetrics.isDisplaying'] = true;
    if (status === 'maintenance') query['screenMetrics.maintenanceMode'] = true;

    const screens = await ScreenTracking.find(query);
    
    const screensData = screens.map(screen => ({
      deviceId: screen.deviceId,
      materialId: screen.materialId,
      screenType: screen.screenType,
      carGroupId: screen.carGroupId,
      slotNumber: screen.slotNumber,
      isOnline: screen.isOnline,
      currentLocation: screen.getFormattedLocation(),
      lastSeen: screen.lastSeen,
      currentHours: screen.currentHoursToday,
      hoursRemaining: screen.hoursRemaining,
      isCompliant: screen.isCompliantToday,
      totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
      displayStatus: screen.displayStatus,
      screenMetrics: screen.screenMetrics
    }));

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

module.exports = router;
