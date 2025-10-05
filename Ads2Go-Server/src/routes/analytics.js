const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');
const Analytics = require('../models/analytics');

// GET /analytics/admin - Get comprehensive admin analytics
router.get('/admin', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const analytics = await AnalyticsService.getAdminAnalytics(startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Admin analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting admin analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/driver/:driverId - Get analytics for specific driver
router.get('/driver/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await AnalyticsService.getDriverAnalytics(driverId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Driver analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting driver analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get driver analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId - Get analytics for specific user's ads
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await AnalyticsService.getUserAdAnalytics(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'User ad analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting user ad analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user ad analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/ad/:adId - Get analytics for specific ad
router.get('/ad/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await AnalyticsService.getAdAnalytics(adId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Ad analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting ad analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ad analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/material/:materialId - Get analytics for specific material
router.get('/material/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await AnalyticsService.getMaterialAnalytics(materialId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Material analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting material analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get material analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/device/:deviceId - Get analytics for specific device
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await Analytics.getDeviceAnalytics(deviceId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Device analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting device analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/realtime - Get real-time analytics
router.get('/realtime', async (req, res) => {
  try {
    const analytics = await AnalyticsService.getRealTimeAnalytics();
    
    res.json({
      success: true,
      data: analytics,
      message: 'Real-time analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting real-time analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get real-time analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/performance/:deviceId - Get performance metrics for device
router.get('/performance/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;
    
    const metrics = await AnalyticsService.getPerformanceMetrics(deviceId, startDate, endDate);
    
    res.json({
      success: true,
      data: metrics,
      message: 'Performance metrics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/top-ads - Get top performing ads
router.get('/top-ads', async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    
    const topAds = await Analytics.getTopPerformingAds(parseInt(limit), startDate, endDate);
    
    res.json({
      success: true,
      data: topAds,
      message: 'Top performing ads retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting top performing ads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top performing ads',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/locations - Get location-based analytics
router.get('/locations', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const locationAnalytics = await Analytics.getLocationAnalytics(startDate, endDate);
    
    res.json({
      success: true,
      data: locationAnalytics,
      message: 'Location analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting location analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get location analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/sync - Sync data from existing collections
router.post('/sync', async (req, res) => {
  try {
    const result = await AnalyticsService.syncFromExistingCollections();
    
    res.json({
      success: true,
      data: result,
      message: 'Analytics sync completed successfully'
    });
  } catch (error) {
    console.error('Error syncing analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/update - Update analytics from Android player
router.post('/update', async (req, res) => {
  try {
    const { deviceId, materialId, slotNumber, data } = req.body;
    
    if (!deviceId || !materialId || !slotNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, materialId, slotNumber'
      });
    }
    
    const analytics = await AnalyticsService.updateAnalytics(deviceId, materialId, slotNumber, data);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Analytics updated successfully'
    });
  } catch (error) {
    console.error('Error updating analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/get-ad-data - Get ad playback data from deviceTracking
router.post('/get-ad-data', async (req, res) => {
  try {
    const { materialId, startDate, endDate } = req.body;
    
    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: materialId'
      });
    }
    
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
    const end = endDate || new Date();
    
    const adData = await AnalyticsService.getAdPlaybackData(materialId, start, end);
    
    res.json({
      success: true,
      data: adData,
      message: 'Ad playback data retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting ad playback data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ad playback data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/get-qr-data - Get QR scan data from deviceTracking
router.post('/get-qr-data', async (req, res) => {
  try {
    const { materialId, startDate, endDate } = req.body;
    
    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: materialId'
      });
    }
    
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
    const end = endDate || new Date();
    
    const qrData = await AnalyticsService.getQRScanData(materialId, start, end);
    
    res.json({
      success: true,
      data: qrData,
      message: 'QR scan data retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting QR scan data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR scan data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/track-qr - Track QR scan (DEPRECATED - now handled by /ads/qr-scan)
router.post('/track-qr', async (req, res) => {
  try {
    const { deviceId, materialId, slotNumber, qrScanData } = req.body;
    
    if (!deviceId || !materialId || !slotNumber || !qrScanData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, materialId, slotNumber, qrScanData'
      });
    }
    
    const analytics = await AnalyticsService.trackQRScan(deviceId, materialId, slotNumber, qrScanData);
    
    res.json({
      success: true,
      data: analytics,
      message: 'QR scan tracked successfully'
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

module.exports = router;
