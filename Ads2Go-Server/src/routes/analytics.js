const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');
const UserAnalyticsService = require('../services/userAnalyticsService');
const Analytics = require('../models/analytics');
const { slowConnectionOptimizer, createSummary, parsePagination } = require('../middleware/slowConnectionOptimizer');

// Apply slow connection optimizer middleware to all routes
router.use(slowConnectionOptimizer({
  enablePagination: true,
  enableFieldSelection: true,
  enableCaching: true,
  enableETags: true,
  maxResponseSize: 5 * 1024 * 1024, // 5MB
  defaultLimit: 50,
  cacheMaxAge: 300 // 5 minutes
}));

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

// ===========================================
// LIGHTWEIGHT SUMMARY ENDPOINTS (for slow connections)
// ===========================================

// GET /analytics/user/:userId/summary - Get lightweight summary (optimized for slow connections)
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, period = '7d' } = req.query;
    
    console.log(`📊 [Summary] Fetching lightweight summary for user ${userId}`);
    const startTime = Date.now();
    
    // Get full analytics
    const analytics = await UserAnalyticsService.getUserAnalytics(
      userId, 
      startDate, 
      endDate, 
      period
    );
    
    // Create lightweight summary
    const summary = createSummary(analytics);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Summary] Generated summary in ${duration}ms`);
    
    res.json({
      success: true,
      data: summary,
      message: 'Analytics summary retrieved successfully',
      metadata: {
        isSummary: true,
        generatedAt: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/totals-only - Get only totals (minimal data for slow connections)
router.get('/user/:userId/totals-only', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, period = '7d' } = req.query;
    
    console.log(`📊 [Totals Only] Fetching totals for user ${userId}`);
    const startTime = Date.now();
    
    // Get full analytics
    const analytics = await UserAnalyticsService.getUserAnalytics(
      userId, 
      startDate, 
      endDate, 
      period
    );
    
    // Return only totals
    const totals = {
      totals: analytics.totals || {},
      period: analytics.period,
      dateRange: analytics.dateRange
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Totals Only] Generated in ${duration}ms`);
    
    res.json({
      success: true,
      data: totals,
      message: 'Analytics totals retrieved successfully',
      metadata: {
        isMinimal: true,
        generatedAt: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });
  } catch (error) {
    console.error('Error getting analytics totals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics totals',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /analytics/user/:userId/direct - Direct API endpoint that fetches from UserAnalytics collection
// ✅ NEW: Fetches directly from UserAnalytics collection for the logged-in user
// ✅ Supports filtering by date range, period, adId, and deviceId
router.get('/user/:userId/direct', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, period, adId, deviceId, realtime } = req.query;
    
    // ✅ NEW: Check for real-time mode parameter (overrides environment variable)
    const forceRealtime = realtime === 'true' || realtime === '1';
    
    console.log('🔍 [UserAnalytics] Direct API call for user:', userId, 'period:', period, 'adId:', adId || 'all', 'deviceId:', deviceId || 'all', forceRealtime ? '(REALTIME MODE)' : '(FROM USERANALYTICS COLLECTION)');
    
    // ✅ If real-time mode is disabled, fetch directly from UserAnalytics collection
    if (!forceRealtime) {
      const UserAnalytics = require('../models/userAnalytics');
      const mongoose = require('mongoose');
      
      // Find UserAnalytics document for this user (or initialize if it doesn't exist)
      let userAnalytics = await UserAnalytics.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      
      if (!userAnalytics) {
        // ✅ Initialize UserAnalytics if it doesn't exist
        console.log('⚠️ [UserAnalytics] UserAnalytics not found, initializing...');
        await UserAnalyticsService.initializeUserAnalytics(userId);
        userAnalytics = await UserAnalytics.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
        
        if (!userAnalytics) {
          return res.status(404).json({ 
            success: false, 
            message: 'UserAnalytics not found and could not be initialized' 
          });
        }
      }
      
      // ✅ Log UserAnalytics document structure for debugging
      console.log('📊 [UserAnalytics] Found document:', {
        userId,
        hasDailyStats: !!userAnalytics.dailyStats,
        dailyStatsCount: userAnalytics.dailyStats?.length || 0,
        totalAdPlays: userAnalytics.totalAdPlays,
        totalQRScans: userAnalytics.totalQRScans,
        totalAds: userAnalytics.totalAds,
        adsCount: userAnalytics.ads?.length || 0,
        sampleDailyStats: userAnalytics.dailyStats?.slice(0, 1).map((ds) => ({
          date: ds.date,
          hasTotals: !!ds.totals,
          totals: ds.totals,
          adsCount: ds.ads?.length || 0
        }))
      });
      
      // Calculate date range
      let defaultStartDate, defaultEndDate;
      const now = new Date();
      
      if (startDate && endDate) {
        defaultStartDate = new Date(startDate);
        defaultEndDate = new Date(endDate);
      } else if (period) {
        switch (period) {
          case '1d':
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          case '7d':
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 6);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          case '30d':
            defaultStartDate = new Date(now);
            defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 29);
            defaultStartDate.setUTCHours(0, 0, 0, 0);
            defaultEndDate = now;
            break;
          case 'all':
          default:
            // For 'all', use all available dailyStats (no date filtering)
            // Set dates to cover all possible data (but we won't filter by them)
            defaultStartDate = null;
            defaultEndDate = null;
            break;
        }
      } else {
        // Default to last 7 days
        defaultStartDate = new Date(now);
        defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 6);
        defaultStartDate.setUTCHours(0, 0, 0, 0);
        defaultEndDate = now;
      }
      
      // Filter dailyStats by date range if provided
      // ✅ When period='all', use ALL dailyStats (no date filtering)
      let filteredDailyStats = userAnalytics.dailyStats || [];
      if (defaultStartDate && defaultEndDate) {
        const startDateStr = defaultStartDate.toISOString().split('T')[0];
        const endDateStr = defaultEndDate.toISOString().split('T')[0];
        
        filteredDailyStats = filteredDailyStats.filter(dateEntry => {
          return dateEntry.date >= startDateStr && dateEntry.date <= endDateStr;
        });
      }
      // When period='all' (defaultStartDate and defaultEndDate are null), use all dailyStats
      
      console.log('📊 [UserAnalytics] Processing dailyStats:', {
        totalDailyStats: userAnalytics.dailyStats?.length || 0,
        filteredCount: filteredDailyStats.length,
        period: period || 'all',
        hasDateFilter: !!(defaultStartDate && defaultEndDate),
        adId: adId || 'all'
      });
      
      // Filter by adId if provided
      if (adId && adId !== 'all') {
        filteredDailyStats = filteredDailyStats.map(dateEntry => {
          const matchingAd = dateEntry.ads?.find(ad => 
            ad.adId && ad.adId.toString() === adId
          );
          
          if (matchingAd) {
            return {
              date: dateEntry.date,
              ads: [matchingAd],
              totals: matchingAd.totals || dateEntry.totals
            };
          }
          return {
            date: dateEntry.date,
            ads: [],
            totals: {
              impressions: 0,
              adsPlayed: 0,
              displayTime: 0,
              qrScans: 0,
              completionRate: 0
            }
          };
        }).filter(dateEntry => dateEntry.ads.length > 0);
      }
      // When adId='all', use all ads (no filtering needed)
      
      // Format dailyStats for frontend (convert nested structure to flat array)
      const formattedDailyStats = filteredDailyStats.flatMap(dateEntry => {
        if (adId && adId !== 'all') {
          // Return per-ad stats for the selected ad
          return dateEntry.ads.map(ad => ({
            date: dateEntry.date,
            adsPlayed: ad.totals?.adsPlayed || 0,
            displayTime: ad.totals?.displayTime || 0,
            qrScans: ad.totals?.qrScans || 0,
            completionRate: ad.totals?.completionRate || 0,
            impressions: ad.totals?.impressions || 0
          }));
        } else {
          // Return aggregated daily stats (sum across all ads for this date)
          // ✅ This is correct for "all" ads - uses dateEntry.totals which is the sum of all ads
          return [{
            date: dateEntry.date,
            adsPlayed: dateEntry.totals?.adsPlayed || 0,
            displayTime: dateEntry.totals?.displayTime || 0,
            qrScans: dateEntry.totals?.qrScans || 0,
            completionRate: dateEntry.totals?.completionRate || 0,
            impressions: dateEntry.totals?.impressions || 0
          }];
        }
      });
      
      // Filter ads array by adId if provided
      let filteredAds = userAnalytics.ads || [];
      if (adId && adId !== 'all') {
        filteredAds = filteredAds.filter(ad => 
          ad.adId && ad.adId.toString() === adId
        );
      }
      
      // Calculate summary from UserAnalytics data
      // ✅ Always prefer dailyStats totals when available (more accurate)
      // ✅ For "all" period, sum ALL dailyStats totals (no date filtering)
      // ✅ For date-filtered periods, sum only filtered dailyStats totals
      let summary = {
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        totalQRScans: 0,
        totalAds: userAnalytics.totalAds || 0,
        activeAds: filteredAds.length,
        totalDevices: userAnalytics.totalDevices || 0,
        averageCompletionRate: userAnalytics.averageAdCompletionRate || 0
      };
      
      // ✅ Calculate summary from formattedDailyStats (aggregated from nested structure)
      // This works for both date-filtered and "all" period queries
      if (formattedDailyStats.length > 0) {
        const calculatedTotals = formattedDailyStats.reduce((acc, stat) => ({
          adsPlayed: acc.adsPlayed + (stat.adsPlayed || 0),
          displayTime: acc.displayTime + (stat.displayTime || 0),
          qrScans: acc.qrScans + (stat.qrScans || 0),
          impressions: acc.impressions + (stat.impressions || 0)
        }), { adsPlayed: 0, displayTime: 0, qrScans: 0, impressions: 0 });
        
        // ✅ ALWAYS use calculated totals from dailyStats when available (more accurate)
        // This ensures we get the correct totals even if top-level totals are outdated
        summary.totalAdsPlayed = calculatedTotals.adsPlayed;
        summary.totalDisplayTime = calculatedTotals.displayTime;
        summary.totalQRScans = calculatedTotals.qrScans;
        
        console.log('✅ [UserAnalytics] Using calculated totals from dailyStats:', {
          dailyStatsEntries: formattedDailyStats.length,
          calculatedTotals: {
            adsPlayed: calculatedTotals.adsPlayed,
            displayTime: calculatedTotals.displayTime,
            qrScans: calculatedTotals.qrScans,
            impressions: calculatedTotals.impressions
          },
          period: period || 'all',
          adId: adId || 'all',
          topLevelTotals: {
            totalAdPlays: userAnalytics.totalAdPlays,
            totalAdPlayTime: userAnalytics.totalAdPlayTime,
            totalQRScans: userAnalytics.totalQRScans
          },
          sampleDailyStats: formattedDailyStats.slice(0, 3).map(stat => ({
            date: stat.date,
            adsPlayed: stat.adsPlayed,
            qrScans: stat.qrScans
          }))
        });
      } else {
        // Fallback to top-level totals if no dailyStats available
        // This happens when UserAnalytics has no dailyStats data yet
        summary.totalAdsPlayed = userAnalytics.totalAdPlays || 0;
        summary.totalDisplayTime = userAnalytics.totalAdPlayTime || 0;
        summary.totalQRScans = userAnalytics.totalQRScans || 0;
        
        console.log('⚠️ [UserAnalytics] No dailyStats entries found, using top-level totals:', {
          totalAdPlays: userAnalytics.totalAdPlays,
          totalAdPlayTime: userAnalytics.totalAdPlayTime,
          totalQRScans: userAnalytics.totalQRScans,
          dailyStatsCount: userAnalytics.dailyStats?.length || 0,
          period: period || 'all',
          adId: adId || 'all'
        });
      }
      
      // ✅ If adId filter is applied, ensure we're using the correct ad data
      if (adId && adId !== 'all') {
        const adData = filteredAds[0];
        if (adData) {
          // Use calculated totals from formattedDailyStats (already filtered by adId)
          // If formattedDailyStats is empty, fallback to ad totals
          if (formattedDailyStats.length === 0) {
            summary.totalAdsPlayed = adData.totalAdPlayTime ? Math.round((adData.totalAdPlayTime || 0) / 35) : 0;
            summary.totalDisplayTime = adData.totalAdPlayTime || 0;
            summary.totalQRScans = adData.totalQRScans || 0;
          }
          // formattedDailyStats already has the correct totals for this ad
          summary.activeAds = 1;
        }
      }
      
      // ✅ If deviceId filter is applied, calculate from deviceStats
      if (deviceId && deviceId !== 'all') {
        const deviceData = filteredDeviceStats[0];
        if (deviceData) {
          summary.totalAdsPlayed = deviceData.adsPlayed || 0;
          summary.totalDisplayTime = deviceData.displayTime || 0;
          summary.totalQRScans = deviceData.qrScans || 0;
          summary.totalDevices = 1;
        }
      }
      
      // Format adPerformance from ads array
      // ✅ Calculate totalPlays from nested dailyStats structure for each ad
      const adPerformance = filteredAds.map(ad => {
        // Calculate totalPlays from nested dailyStats for this specific ad
        let totalPlays = 0;
        if (filteredDailyStats.length > 0) {
          // Sum adsPlayed from all dailyStats entries for this ad
          filteredDailyStats.forEach(dateEntry => {
            const adEntry = dateEntry.ads?.find(a => 
              a.adId && a.adId.toString() === ad.adId.toString()
            );
            if (adEntry && adEntry.totals) {
              totalPlays += adEntry.totals.adsPlayed || 0;
            }
          });
        }
        
        // Fallback to estimate from play time if no dailyStats data
        if (totalPlays === 0) {
          totalPlays = ad.totalAdPlayTime ? Math.round(ad.totalAdPlayTime / 35) : 0;
        }
        
        return {
          adId: ad.adId,
          adTitle: ad.adTitle,
          totalPlays: totalPlays,
          totalViewTime: ad.totalAdPlayTime || 0,
          averageViewTime: totalPlays > 0 ? (ad.totalAdPlayTime || 0) / totalPlays : 0,
          completionRate: ad.averageAdCompletionRate || 0,
          impressions: ad.totalAdImpressions || 0,
          totalQRScans: ad.totalQRScans || 0
        };
      });
      
      // Format deviceStats from materialBreakdown
      const deviceStats = (userAnalytics.materialBreakdown || []).map(material => ({
        deviceId: material.materialId,
        materialId: material.materialId,
        deviceName: material.materialId,
        adsPlayed: material.totalAdPlays || 0,
        displayTime: material.totalAdPlayTime || 0,
        qrScans: material.totalQRScans || 0,
        impressions: material.totalAdImpressions || 0,
        isOnline: material.isOnline || false,
        lastSeen: material.lastActivity || null
      }));
      
      // Filter deviceStats by deviceId if provided
      let filteredDeviceStats = deviceStats;
      if (deviceId && deviceId !== 'all') {
        filteredDeviceStats = deviceStats.filter(device => 
          device.deviceId === deviceId || device.materialId === deviceId
        );
      }
      
      console.log('✅ [UserAnalytics] Returning data from UserAnalytics collection:', {
        userId,
        period: period || 'all',
        adId: adId || 'all',
        summary: {
          totalAdsPlayed: summary.totalAdsPlayed,
          totalDisplayTime: summary.totalDisplayTime,
          totalQRScans: summary.totalQRScans,
          totalAds: summary.totalAds,
          activeAds: summary.activeAds,
          totalDevices: summary.totalDevices
        },
        dailyStatsCount: formattedDailyStats.length,
        adsCount: filteredAds.length,
        deviceStatsCount: filteredDeviceStats.length,
        hasDateFilter: !!(defaultStartDate && defaultEndDate),
        dateRange: defaultStartDate && defaultEndDate ? {
          start: defaultStartDate.toISOString(),
          end: defaultEndDate.toISOString()
        } : 'all dates'
      });
      
      return res.json({
        success: true,
        data: {
          summary,
          dailyStats: formattedDailyStats,
          adPerformance,
          deviceStats: filteredDeviceStats,
          ads: filteredAds,
          period: period || 'all',
          startDate: defaultStartDate?.toISOString(),
          endDate: defaultEndDate?.toISOString(),
          lastUpdated: userAnalytics.lastUpdated || userAnalytics.updatedAt
        }
      });
    } else {
      // Real-time mode: Use the service method (queries DeviceDataHistoryV2 directly)
      console.log('⚡ [REALTIME] Using real-time mode - querying DeviceDataHistoryV2 directly');
      const analytics = await UserAnalyticsService.getUserAnalytics(
        userId,
        startDate,
        endDate,
        period,
        adId || null,
        forceRealtime
      );
      
      if (!analytics.success) {
        return res.status(400).json({ success: false, message: analytics.message });
      }
      
      return res.json({ 
        success: true, 
        data: analytics.data
      });
    }
  } catch (error) {
    console.error('❌ Error in direct API:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================================
// DEVICE-SPECIFIC ANALYTICS ROUTES
// ===========================================

// GET /analytics/user/:userId/device/:deviceId - Get detailed analytics for a specific device
// ✅ Updated to accept adId and period query parameters for filtering
router.get('/user/:userId/device/:deviceId', async (req, res) => {
  try {
    const { userId, deviceId } = req.params;
    const { startDate, endDate, adId, period } = req.query;
    
    // ✅ Calculate date range from period if dates are not provided
    // Query parameters are strings, so check for truthy values and 'undefined'
    let calculatedStartDate = null;
    let calculatedEndDate = null;
    
    // If explicit dates are provided, use them (they take priority over period)
    if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
      calculatedStartDate = new Date(startDate);
      calculatedEndDate = new Date(endDate);
    } 
    // If period is provided and dates are not, calculate dates from period
    else if (period) {
      const now = new Date();
      
      switch (period) {
        case '1d':
          calculatedStartDate = new Date(now);
          calculatedStartDate.setUTCHours(0, 0, 0, 0);
          calculatedEndDate = now;
          break;
        case '7d':
          calculatedStartDate = new Date(now);
          calculatedStartDate.setUTCDate(calculatedStartDate.getUTCDate() - 6);
          calculatedStartDate.setUTCHours(0, 0, 0, 0);
          calculatedEndDate = now;
          break;
        case '30d':
          calculatedStartDate = new Date(now);
          calculatedStartDate.setUTCDate(calculatedStartDate.getUTCDate() - 29);
          calculatedStartDate.setUTCHours(0, 0, 0, 0);
          calculatedEndDate = now;
          break;
        case 'all':
          // For 'all' period, explicitly pass null to get all available data
          calculatedStartDate = null;
          calculatedEndDate = null;
          console.log('📅 [Device Route] Period=all, using all available data (no date filter)');
          break;
        default:
          // Default to last 30 days if period is invalid
          calculatedStartDate = new Date(now);
          calculatedStartDate.setUTCDate(calculatedStartDate.getUTCDate() - 29);
          calculatedStartDate.setUTCHours(0, 0, 0, 0);
          calculatedEndDate = now;
          break;
      }
    }
    // If neither dates nor period are provided, default to last 30 days
    else {
      const now = new Date();
      calculatedStartDate = new Date(now);
      calculatedStartDate.setUTCDate(calculatedStartDate.getUTCDate() - 29);
      calculatedStartDate.setUTCHours(0, 0, 0, 0);
      calculatedEndDate = now;
    }
    
    const analytics = await UserAnalyticsService.getDeviceSpecificAnalytics(
      userId, 
      deviceId, 
      calculatedStartDate, 
      calculatedEndDate, 
      adId || null
    );
    
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
