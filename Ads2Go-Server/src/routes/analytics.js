const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');
const UserAnalyticsService = require('../services/userAnalyticsService');
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

// GET /analytics/device/:deviceId - Get analytics for specific device (DEPRECATED - use UserAnalyticsService version)
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate, userId } = req.query;
    
    // userId is required to filter ads to only show user's created ads
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId query parameter is required to filter device analytics by user. This endpoint is deprecated - use the UserAnalyticsService version instead.'
      });
    }
    
    // Use the UserAnalyticsService version which has proper user filtering
    const analytics = await UserAnalyticsService.getDeviceAnalytics(deviceId, startDate, endDate, userId);
    
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

// POST /analytics/user-sync - Manually trigger UserAnalytics sync job
router.post('/user-sync', async (req, res) => {
  try {
    const userAnalyticsSyncJob = require('../jobs/userAnalyticsSyncJob');
    
    console.log('🔄 Manual UserAnalytics sync triggered');
    await userAnalyticsSyncJob.syncAllUsers();
    
    res.json({
      success: true,
      message: 'UserAnalytics sync completed successfully'
    });
  } catch (error) {
    console.error('Error in manual UserAnalytics sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync UserAnalytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user-analytics/:userId - Check UserAnalytics data for debugging
router.get('/user-analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const UserAnalytics = require('../models/userAnalytics');
    
    const userAnalytics = await UserAnalytics.findOne({ userId });
    
    if (!userAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'UserAnalytics not found'
      });
    }
    
    // Return summary data for debugging
    res.json({
      success: true,
      data: {
        userId: userAnalytics.userId,
        totalAdPlays: userAnalytics.totalAdPlays,
        totalAdImpressions: userAnalytics.totalAdImpressions,
        totalAdPlayTime: userAnalytics.totalAdPlayTime,
        totalQRScans: userAnalytics.totalQRScans,
        totalMaterials: userAnalytics.totalMaterials,
        adsCount: userAnalytics.ads?.length || 0,
        materialBreakdownCount: userAnalytics.materialBreakdown?.length || 0,
        lastUpdated: userAnalytics.updatedAt,
        // Show first few materials for debugging
        sampleMaterials: userAnalytics.materialBreakdown?.slice(0, 3).map(m => ({
          materialId: m.materialId,
          totalAdPlays: m.totalAdPlays,
          totalQRScans: m.totalQRScans,
          lastActivity: m.lastActivity
        })) || []
      }
    });
  } catch (error) {
    console.error('Error getting UserAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get UserAnalytics',
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

// ===========================================
// DETAILED ANALYTICS ROUTES
// ===========================================

// GET /analytics/user/:userId/total-plays - Get total plays of ads for a user
router.get('/user/:userId/total-plays', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await UserAnalyticsService.getTotalAdPlays(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Total ad plays retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting total ad plays:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get total ad plays',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/total-qr-scans - Get total QR scans of ads for a user
router.get('/user/:userId/total-qr-scans', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await UserAnalyticsService.getTotalQRScans(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Total QR scans retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting total QR scans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get total QR scans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/active-materials - Get active total materials for a user
router.get('/user/:userId/active-materials', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const analytics = await UserAnalyticsService.getActiveTotalMaterials(userId);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Active materials retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting active materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active materials',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/total-display-time - Get total display time of ads for a user
router.get('/user/:userId/total-display-time', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await UserAnalyticsService.getTotalDisplayTime(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Total display time retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting total display time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get total display time',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/device/:deviceId - Get analytics data for a specific device
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate, userId } = req.query;
    
    // userId is required to filter ads to only show user's created ads
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId query parameter is required to filter device analytics by user'
      });
    }
    
    const analytics = await UserAnalyticsService.getDeviceAnalytics(deviceId, startDate, endDate, userId);
    
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

// GET /analytics/user/:userId/comprehensive - Get comprehensive analytics summary for a user
router.get('/user/:userId/comprehensive', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await UserAnalyticsService.getComprehensiveAnalytics(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Comprehensive analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting comprehensive analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comprehensive analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/initialize-user/:userId - Initialize UserAnalytics for a user
router.post('/initialize-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userAnalytics = await UserAnalyticsService.initializeUserAnalytics(userId);
    
    res.json({
      success: true,
      data: userAnalytics,
      message: 'User analytics initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize user analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/user/:userId/sync - Manual sync endpoint for testing
router.post('/user/:userId/sync', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.body;
    
    console.log('🔄 Manual sync requested for user:', userId);
    
    const syncResult = await UserAnalyticsService.syncUserAnalyticsFromHistory(
      userId, 
      startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to 7 days ago
      endDate || new Date()
    );
    
    if (!syncResult.success) {
      return res.status(400).json({ success: false, message: syncResult.message });
    }
    
    res.json({ 
      success: true, 
      message: 'Analytics synced successfully',
      data: syncResult.userAnalytics
    });
  } catch (error) {
    console.error('Error syncing user analytics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /analytics/cache/stats - Get cache statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const cacheStats = UserAnalyticsService.getCacheStats();
    
    res.json({
      success: true,
      data: cacheStats,
      message: 'Cache statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/cache/clear/:userId - Clear cache for specific user
router.post('/cache/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    UserAnalyticsService.clearUserCache(userId);
    
    res.json({
      success: true,
      message: `Cache cleared for user ${userId}`
    });
  } catch (error) {
    console.error('Error clearing user cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear user cache',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /analytics/cache/clear-all - Clear all cache
router.post('/cache/clear-all', async (req, res) => {
  try {
    UserAnalyticsService.clearAllCache();
    
    res.json({
      success: true,
      message: 'All cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear all cache',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/direct - Direct API endpoint bypassing GraphQL
router.get('/user/:userId/direct', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, period } = req.query;
    
    console.log('🔍 Direct API call for user:', userId, 'period:', period);
    
    const analytics = await UserAnalyticsService.getUserAnalytics(
      userId,
      startDate,
      endDate,
      period
    );
    
    if (!analytics.success) {
      return res.status(400).json({ success: false, message: analytics.message });
    }
    
    console.log('✅ Direct API returning data:', JSON.stringify(analytics.data.summary, null, 2));
    
    res.json({ 
      success: true, 
      data: analytics.data
    });
  } catch (error) {
    console.error('Error in direct API:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ===========================================
// DEVICE-SPECIFIC ANALYTICS ROUTES
// ===========================================

// GET /analytics/user/:userId/device/:deviceId - Get detailed analytics for a specific device
router.get('/user/:userId/device/:deviceId', async (req, res) => {
  try {
    const { userId, deviceId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await UserAnalyticsService.getDeviceSpecificAnalytics(userId, deviceId, startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Device-specific analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting device-specific analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device-specific analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/devices - Get analytics summary for multiple devices
router.get('/user/:userId/devices', async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceIds, startDate, endDate, useAllDevices } = req.query;
    
    // Parse deviceIds if provided as comma-separated string
    const parsedDeviceIds = deviceIds ? deviceIds.split(',') : [];
    
    // Convert useAllDevices string to boolean
    const shouldUseAllDevices = useAllDevices === 'true' || useAllDevices === '1';
    
    const analytics = await UserAnalyticsService.getMultipleDevicesAnalytics(userId, parsedDeviceIds, startDate, endDate, shouldUseAllDevices);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Multiple devices analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting multiple devices analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get multiple devices analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
