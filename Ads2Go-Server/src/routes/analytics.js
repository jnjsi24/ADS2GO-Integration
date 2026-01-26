const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AnalyticsService = require('../services/analyticsService');
const UserAnalyticsService = require('../services/userAnalyticsService');
const Analytics = require('../models/analytics');
const { slowConnectionOptimizer, createSummary, parsePagination } = require('../middleware/slowConnectionOptimizer');
const { AnalyticsOptimizer, optimizer } = require('../utils/analyticsOptimizer');

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

// GET /analytics/ad/:adId/current-devices - Get current device assignments from AdsDeployment
// This returns the ACTUAL current devices where an ad is deployed (not the stale Ad.materialId field)
router.get('/ad/:adId/current-devices', async (req, res) => {
  try {
    const { adId } = req.params;
    
    console.log(`📱 [Analytics] Getting current devices for ad ${adId}`);
    
    const AdsDeployment = require('../models/adsDeployment');
    
    // Find all active deployments for this ad across all materials
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': new mongoose.Types.ObjectId(adId),
      'lcdSlots.status': { $in: ['SCHEDULED', 'RUNNING'] },
      isArchived: { $ne: true }
    }).lean();
    
    // Extract unique materialIds (device ID strings like "DGL-HEADDRESS-CAR-004")
    const materialIds = [...new Set(activeDeployments.map(d => d.materialId))].filter(Boolean);
    
    console.log(`📱 [Analytics] Found ${materialIds.length} active devices for ad ${adId}:`, materialIds);
    
    res.json({
      success: true,
      data: {
        adId,
        materialIds,
        deviceCount: materialIds.length
      },
      message: `Found ${materialIds.length} active device(s) for this ad`
    });
  } catch (error) {
    console.error('Error getting current devices for ad:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current devices for ad',
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

// ===========================================
// PHASE 1 OPTIMIZATION: NEW ENDPOINT
// ===========================================

// GET /analytics/user/:userId/direct-v2 - OPTIMIZED version using MongoDB aggregation
// ✅ Uses database-level filtering (10-50x faster than JavaScript filtering)
// ✅ Supports pagination (prevents loading 365+ days at once)
// ✅ Pre-filters archived ads at database level
// ✅ Calculates totals in MongoDB (not JavaScript)
router.get('/user/:userId/direct-v2', async (req, res) => {
  console.log('🔥 [DIRECT-V2] ===== ENDPOINT HIT! =====', req.method, req.originalUrl);
  console.log('🔥 [DIRECT-V2] Query params:', req.query);
  console.log('🔥 [DIRECT-V2] Route params:', req.params);
  
  const requestStartTime = Date.now();
  const { userId } = req.params;
  const { startDate, endDate, period, adId, page = 1, limit = 90 } = req.query;
  
  try {
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log('❌ [DIRECT-V2] Invalid userId:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid userId'
      });
    }
    
    console.log('🚀 [OPTIMIZED] Direct API v2 for user:', userId, 'period:', period, 'page:', page);
    
    // Validate and normalize date range
    let dateRange;
    try {
      dateRange = AnalyticsOptimizer.validateAndNormalizeDateRange(startDate, endDate, period);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Invalid date range'
      });
    }
    
    const startDateStr = dateRange.startDateStr;
    const endDateStr = dateRange.endDateStr;
    
    // ✅ CRITICAL FIX: Calculate today's date in Philippine timezone for filtering
    // dailyStats dates are stored in Philippine timezone (YYYY-MM-DD), so we must compare with Philippine timezone
    const getTodayInPhilippineTime = () => {
      const now = new Date();
      const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      const phTime = new Date(now.getTime() + phOffset);
      return phTime.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    const todayStrPH = getTodayInPhilippineTime();
    
    console.log('🔍 [DIRECT-V2] Date range processing:', {
      rawStartDate: startDate,
      rawEndDate: endDate,
      rawPeriod: period,
      normalizedStartDateStr: startDateStr,
      normalizedEndDateStr: endDateStr,
      hasStartDate: !!startDateStr,
      hasEndDate: !!endDateStr,
      todayInPH: todayStrPH
    });
    
    // Get valid (non-archived) ad IDs
    const Ad = require('../models/Ad');
    const allUserAds = await Ad.find({ 
      userId: userId,
      paymentStatus: 'PAID',
      adStatus: 'ACTIVE',
      isArchived: false,
      status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
    }).select('_id title createdAt materialId targetDevices').lean();
    
    if (allUserAds.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            totalAdsPlayed: 0,
            totalDisplayTime: 0,
            totalQRScans: 0,
            totalAds: 0,
            activeAds: 0,
            totalDevices: 0
          },
          dailyStats: [],
          adPerformance: [],
          deviceStats: [],
          ads: [],
          period: period || 'all'
        }
      });
    }
    
    const validAdIds = allUserAds.map(ad => ad._id.toString());
    const firstAdDate = allUserAds[0]?.createdAt 
      ? new Date(allUserAds[0].createdAt).toISOString().split('T')[0]
      : null;
    
    // Build aggregation pipeline
    const UserAnalytics = require('../models/userAnalytics');
    const pipeline = [
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) }
      },
      {
        $project: {
          userId: 1,
          totalAdPlays: 1,
          totalAdPlayTime: 1,
          totalQRScans: 1,
          totalAds: 1,
          totalDevices: 1,
          ads: 1,
          materialBreakdown: 1,
          lastUpdated: 1,
          updatedAt: 1,
          // ✅ OPTIMIZED: Filter dailyStats in database, not JavaScript
          dailyStats: {
            $filter: {
              input: '$dailyStats',
              as: 'day',
              cond: {
                $and: [
                  // Filter by date range (if provided)
                  ...(startDateStr ? [{ $gte: ['$$day.date', startDateStr] }] : []),
                  ...(endDateStr ? [{ $lte: ['$$day.date', endDateStr] }] : []),
                  // ✅ CRITICAL FIX: Use Philippine timezone for "today" comparison
                  // Dates in dailyStats are stored in Philippine timezone (YYYY-MM-DD), so we must compare with Philippine timezone date
                  // MongoDB aggregation doesn't support functions, so we pass the pre-calculated todayStrPH
                  { $lte: ['$$day.date', todayStrPH] },
                  // Filter out dates before first ad (if known)
                  ...(firstAdDate ? [{ $gte: ['$$day.date', firstAdDate] }] : [])
                ]
              }
            }
          }
        }
      },
      {
        // ✅ OPTIMIZED: Sort and paginate dailyStats in database
        $project: {
          userId: 1,
          totalAdPlays: 1,
          totalAdPlayTime: 1,
          totalQRScans: 1,
          totalAds: 1,
          totalDevices: 1,
          ads: 1,
          materialBreakdown: 1,
          lastUpdated: 1,
          updatedAt: 1,
          dailyStats: {
            $slice: [
              { $reverseArray: '$dailyStats' }, // Most recent first
              (parseInt(page) - 1) * parseInt(limit),
              parseInt(limit)
            ]
          },
          totalDailyStatsCount: { $size: '$dailyStats' }
        }
      }
    ];
    
    const result = await UserAnalytics.aggregate(pipeline);
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'UserAnalytics not found'
      });
    }
    
    const userAnalytics = result[0];
    const totalDailyStatsCount = userAnalytics.totalDailyStatsCount || 0;
    
    // ✅ FIX: For period=all, use UserAnalyticsSummary for accurate all-time totals
    // This collection has pre-aggregated all-time totals per ad (updated by sync job)
    let filteredAds;
    let summaryLastUpdated = null; // Track when summary was last updated
    if (period === 'all' || !period) {
      try {
        const UserAnalyticsSummary = require('../models/userAnalyticsSummary');
        const summary = await UserAnalyticsSummary.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
        
        if (summary && summary.ads && summary.ads.length > 0) {
          summaryLastUpdated = summary.lastUpdated || summary.lastSyncTimestamp;
          
          // Use summary.ads which has accurate all-time totals
          filteredAds = summary.ads
            .filter(ad => ad.adId && validAdIds.includes(ad.adId.toString()))
            .map(ad => ({
              adId: ad.adId,
              adTitle: ad.adTitle,
              totalAdPlayTime: ad.totalDisplayTime || 0,
              totalAdPlays: ad.totalPlays || 0,
              totalQRScans: ad.totalQRScans || 0, // ✅ All-time totals from summary
              totalAdImpressions: ad.totalImpressions || 0,
              averageAdCompletionRate: ad.averageCompletionRate || 0,
              materials: [] // Summary doesn't have materials
            }));
          
          // Filter by specific adId if requested
          if (adId && adId !== 'all') {
            filteredAds = filteredAds.filter(ad => ad.adId.toString() === adId);
          }
          
          console.log(`✅ [direct-v2] Using UserAnalyticsSummary for all-time totals: ${filteredAds.length} ads, lastUpdated: ${summaryLastUpdated}`);
        } else {
          // Fallback to userAnalytics.ads if summary not available
          filteredAds = (userAnalytics.ads || []).filter(ad => 
            ad.adId && validAdIds.includes(ad.adId.toString())
          );
          if (adId && adId !== 'all') {
            filteredAds = filteredAds.filter(ad => ad.adId.toString() === adId);
          }
          console.log(`⚠️ [direct-v2] UserAnalyticsSummary not found, using userAnalytics.ads: ${filteredAds.length} ads`);
        }
      } catch (summaryError) {
        console.warn('⚠️ [direct-v2] Error fetching UserAnalyticsSummary, using userAnalytics.ads:', summaryError.message);
        // Fallback to userAnalytics.ads
        filteredAds = (userAnalytics.ads || []).filter(ad => 
          ad.adId && validAdIds.includes(ad.adId.toString())
        );
        if (adId && adId !== 'all') {
          filteredAds = filteredAds.filter(ad => ad.adId.toString() === adId);
        }
      }
    } else {
      // For date-filtered periods, use userAnalytics.ads (will be calculated from dailyStats)
      filteredAds = (userAnalytics.ads || []).filter(ad => 
        ad.adId && validAdIds.includes(ad.adId.toString())
      );
      
      // Filter by specific adId if requested
      if (adId && adId !== 'all') {
        filteredAds = filteredAds.filter(ad => ad.adId.toString() === adId);
      }
    }
    
    // 🔥 FIX: Fetch dailyStats from new flat DailyUserAnalytics collection
    // The old UserAnalytics.dailyStats is no longer being populated by the sync job
    const DailyUserAnalytics = require('../models/dailyUserAnalytics');
    const dailyStatsQuery = {
      userId: new mongoose.Types.ObjectId(userId),
      date: {}
    };
    
    if (startDateStr) dailyStatsQuery.date.$gte = startDateStr;
    if (endDateStr) dailyStatsQuery.date.$lte = endDateStr;
    if (Object.keys(dailyStatsQuery.date).length === 0) delete dailyStatsQuery.date;
    if (adId && adId !== 'all') dailyStatsQuery.adId = new mongoose.Types.ObjectId(adId);
    
    let flatDailyStats = await DailyUserAnalytics.find(dailyStatsQuery)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .lean();
    
    console.log(`📊 [direct-v2] Fetched ${flatDailyStats.length} daily stats from flat collection`);
    console.log(`📊 [direct-v2] Query used:`, JSON.stringify(dailyStatsQuery, null, 2));
    console.log(`📊 [direct-v2] Date range:`, { startDateStr, endDateStr, period });
    
    // Log sample of fetched data
    if (flatDailyStats.length > 0) {
      console.log(`📊 [direct-v2] Sample record:`, {
        date: flatDailyStats[0].date,
        adId: flatDailyStats[0].adId,
        adsPlayed: flatDailyStats[0].adsPlayed,
        qrScans: flatDailyStats[0].qrScans
      });
    }
    
    // ✅ CRITICAL FIX: Always merge today's data from DeviceTracking for real-time accuracy
    // This ensures QR scans and ad plays from today appear immediately, even if sync job hasn't run
    // ✅ FIX: Use Philippine timezone date string to match dailyStats format
    // Note: DeviceTracking uses UTC dates, but we convert to Philippine timezone for consistency with dailyStats
    const todayStr = todayStrPH; // Use Philippine timezone date string (already calculated above)
    const includesToday = (!startDateStr || startDateStr <= todayStr) && (!endDateStr || endDateStr >= todayStr);
    
    // ✅ Declare todayDataByAd outside if block so it's accessible when building adPerformance
    let todayDataByAd = new Map();
    
    if (includesToday) {
      try {
        console.log('⚡ [direct-v2] Merging today\'s real-time data from DeviceTracking...');
        const DeviceTracking = require('../models/deviceTracking');
        const Material = require('../models/Material');
        
        // ✅ CRITICAL FIX: Get materialIds from AdsDeployment collection, NOT from Ad's stale materialId/targetDevices fields
        // The Ad fields may be outdated when admin manually changes deployments
        let materialIds = [];
        const AdsDeployment = require('../models/adsDeployment');
        
        // If a specific ad is selected, only get materials where that ad is deployed
        if (adId && adId !== 'all') {
          // Query AdsDeployment to find all materials that have this ad in their slots
          const deployments = await AdsDeployment.find({
            'lcdSlots.adId': new mongoose.Types.ObjectId(adId),
            'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] },
            isArchived: false
          }).select('materialId').lean();
          
          materialIds = deployments.map(d => d.materialId);
        } else {
          // Get all materials where user's ads are deployed
          const adObjectIds = validAdIds.map(id => new mongoose.Types.ObjectId(id));
          const deployments = await AdsDeployment.find({
            'lcdSlots.adId': { $in: adObjectIds },
            'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] },
            isArchived: false
          }).select('materialId').lean();
          
          materialIds = [...new Set(deployments.map(d => d.materialId))];
        }
        
        if (materialIds.length > 0) {
          // ✅ Get today's DeviceTracking records
          // DeviceTracking stores dates in UTC, so we need to query using UTC date
          // But we'll merge the results using Philippine timezone date string to match dailyStats format
          const { getUTCMidnight } = require('../utils/dateUtils');
          const todayUTC = getUTCMidnight(); // UTC midnight for DeviceTracking query
          
          const todayRecords = await DeviceTracking.find({
            materialId: { $in: materialIds },
            date: todayUTC
          }).lean();
          
          console.log(`📊 [direct-v2] Found ${todayRecords.length} DeviceTracking records for today`);
          
          // Aggregate today's data by ad
          // ✅ Reinitialize the Map (it was declared outside the if block)
          todayDataByAd = new Map();
          
          todayRecords.forEach(record => {
            // Process adPerformance
            if (record.adPerformance && record.adPerformance.length > 0) {
              record.adPerformance.forEach(adPerf => {
                const adIdStr = adPerf.adId ? adPerf.adId.toString() : '';
                if (validAdIds.includes(adIdStr) && (!adId || adId === 'all' || adIdStr === adId)) {
                  if (!todayDataByAd.has(adIdStr)) {
                    todayDataByAd.set(adIdStr, {
                      adId: adPerf.adId,
                      adTitle: adPerf.adTitle || 'Unknown',
                      adsPlayed: 0,
                      displayTime: 0,
                      qrScans: 0,
                      impressions: 0
                    });
                  }
                  const adData = todayDataByAd.get(adIdStr);
                  adData.adsPlayed += adPerf.playCount || 0;
                  adData.displayTime += adPerf.totalViewTime || 0;
                  adData.impressions += adPerf.impressionCount || 0;
                }
              });
            }
            
            // Process QR scans (prefer qrScansByAd, fallback to qrScans array)
            if (record.qrScansByAd && record.qrScansByAd.length > 0) {
              record.qrScansByAd.forEach(adScan => {
                const adIdStr = adScan.adId ? adScan.adId.toString() : '';
                if (validAdIds.includes(adIdStr) && (!adId || adId === 'all' || adIdStr === adId)) {
                  if (!todayDataByAd.has(adIdStr)) {
                    todayDataByAd.set(adIdStr, {
                      adId: adScan.adId,
                      adTitle: adScan.adTitle || 'Unknown',
                      adsPlayed: 0,
                      displayTime: 0,
                      qrScans: 0,
                      impressions: 0
                    });
                  }
                  const adData = todayDataByAd.get(adIdStr);
                  adData.qrScans += adScan.scanCount || 0;
                }
              });
            } else if (record.qrScans && record.qrScans.length > 0) {
              // Fallback to counting from array
              record.qrScans.forEach(scan => {
                const adIdStr = scan.adId ? scan.adId.toString() : '';
                if (validAdIds.includes(adIdStr) && (!adId || adId === 'all' || adIdStr === adId)) {
                  if (!todayDataByAd.has(adIdStr)) {
                    todayDataByAd.set(adIdStr, {
                      adId: scan.adId,
                      adTitle: scan.adTitle || 'Unknown',
                      adsPlayed: 0,
                      displayTime: 0,
                      qrScans: 0,
                      impressions: 0
                    });
                  }
                  todayDataByAd.get(adIdStr).qrScans += 1;
                }
              });
            }
          });
          
          // Merge today's data into flatDailyStats
          todayDataByAd.forEach((adData, adIdStr) => {
            // Check if today's data already exists in flatDailyStats
            const existingTodayIndex = flatDailyStats.findIndex(stat => 
              stat.date === todayStr && stat.adId && stat.adId.toString() === adIdStr
            );
            
            if (existingTodayIndex >= 0) {
              // Merge: add today's real-time data to existing entry
              const existing = flatDailyStats[existingTodayIndex];
              existing.adsPlayed = (existing.adsPlayed || 0) + adData.adsPlayed;
              existing.displayTime = (existing.displayTime || 0) + adData.displayTime;
              existing.qrScans = (existing.qrScans || 0) + adData.qrScans;
              existing.impressions = (existing.impressions || 0) + adData.impressions;
              console.log(`✅ [direct-v2] Merged today's data for ad ${adIdStr}: +${adData.adsPlayed} plays, +${adData.qrScans} QR scans`);
            } else {
              // Add new entry for today
              flatDailyStats.push({
                userId: new mongoose.Types.ObjectId(userId),
                date: todayStr,
                adId: adData.adId,
                adTitle: adData.adTitle,
                adsPlayed: adData.adsPlayed,
                displayTime: adData.displayTime,
                qrScans: adData.qrScans,
                impressions: adData.impressions,
                completionRate: 0,
                materialStats: []
              });
              console.log(`✅ [direct-v2] Added today's data for ad ${adIdStr}: ${adData.adsPlayed} plays, ${adData.qrScans} QR scans`);
            }
          });
        }
      } catch (todayError) {
        console.error('❌ [direct-v2] Error merging today\'s data:', todayError);
        // Continue without today's data - fallback to sync job data
      }
    }
    
    // 🔥 FALLBACK: If flat collection is empty, generate data in real-time from DeviceDataHistoryV2
    if (flatDailyStats.length === 0) {
      console.log('⚠️ [direct-v2] DailyUserAnalytics is empty, falling back to real-time generation from DeviceDataHistoryV2');
      
      try {
        // Use the service method to generate data from DeviceDataHistoryV2
        const realtimeData = await UserAnalyticsService.getPerAdDailyStatsFromHistory(
          userId, 
          dateRange.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year back if no start date
          dateRange.endDate || new Date()
        );
        
        // Convert real-time data to flat format
        if (realtimeData && realtimeData.dailyStats) {
          flatDailyStats = [];
          realtimeData.dailyStats.forEach(dayEntry => {
            (dayEntry.ads || []).forEach(ad => {
              // Filter by validAdIds
              if (validAdIds.includes(ad.adId.toString())) {
                // Filter by adId if specified
                if (!adId || adId === 'all' || ad.adId.toString() === adId) {
                  flatDailyStats.push({
                    userId: new mongoose.Types.ObjectId(userId),
                    date: dayEntry.date,
                    adId: ad.adId,
                    adTitle: ad.adTitle || 'Unknown',
                    adsPlayed: ad.totals?.adsPlayed || 0,
                    displayTime: ad.totals?.displayTime || 0,
                    qrScans: ad.totals?.qrScans || 0,
                    impressions: ad.totals?.impressions || 0,
                    completionRate: ad.totals?.completionRate || 0,
                    materialStats: ad.materials || []
                  });
                }
              }
            });
          });
          
          // Sort by date descending and limit
          flatDailyStats.sort((a, b) => b.date.localeCompare(a.date));
          flatDailyStats = flatDailyStats.slice(0, parseInt(limit));
          
          console.log(`✅ [direct-v2] Generated ${flatDailyStats.length} daily stats from DeviceDataHistoryV2 in real-time`);
        }
      } catch (fallbackError) {
        console.error('❌ [direct-v2] Error in fallback data generation:', fallbackError);
        // Continue with empty array - will show "no data" message to user
      }
    }
    
    // Convert flat dailyStats to nested format expected by the rest of the code
    const dailyStatsMap = new Map();
    flatDailyStats.forEach(record => {
      if (!dailyStatsMap.has(record.date)) {
        dailyStatsMap.set(record.date, { date: record.date, ads: [], totals: { adsPlayed: 0, displayTime: 0, qrScans: 0, impressions: 0 } });
      }
      const dateEntry = dailyStatsMap.get(record.date);
      dateEntry.ads.push({
        adId: record.adId,
        totals: {
          adsPlayed: record.adsPlayed,
          displayTime: record.displayTime,
          qrScans: record.qrScans,
          impressions: record.impressions,
          completionRate: record.completionRate
        },
        materials: record.materialStats
      });
      dateEntry.totals.adsPlayed += record.adsPlayed;
      dateEntry.totals.displayTime += record.displayTime;
      dateEntry.totals.qrScans += record.qrScans;
      dateEntry.totals.impressions += record.impressions;
    });
    
    // Convert map to array and use instead of old dailyStats
    const dailyStatsFromFlat = Array.from(dailyStatsMap.values());
    
    // Process dailyStats to filter nested ads
    const processedDailyStats = (dailyStatsFromFlat || []).map(dateEntry => {
      // Filter ads within this date to only valid (non-archived) ads
      const validAdsForDate = (dateEntry.ads || []).filter(ad => 
        ad.adId && validAdIds.includes(ad.adId.toString())
      );
      
      // Recalculate totals from valid ads only
      const recalculatedTotals = validAdsForDate.reduce((acc, ad) => {
        const adTotals = ad.totals || {};
        return {
          impressions: acc.impressions + (adTotals.impressions || 0),
          adsPlayed: acc.adsPlayed + (adTotals.adsPlayed || 0),
          displayTime: acc.displayTime + (adTotals.displayTime || 0),
          qrScans: acc.qrScans + (adTotals.qrScans || 0)
        };
      }, { impressions: 0, adsPlayed: 0, displayTime: 0, qrScans: 0 });
      
      return {
        date: dateEntry.date,
        ads: validAdsForDate,
        totals: recalculatedTotals
      };
    });
    
    // Format dailyStats for frontend
    const formattedDailyStats = processedDailyStats.flatMap(dateEntry => {
      if (adId && adId !== 'all') {
        // Return per-ad stats for the selected ad
        const matchingAd = dateEntry.ads.find(ad => ad.adId.toString() === adId);
        if (!matchingAd) return [];
        
        return [{
          date: dateEntry.date,
          adsPlayed: matchingAd.totals?.adsPlayed || 0,
          displayTime: matchingAd.totals?.displayTime || 0,
          qrScans: matchingAd.totals?.qrScans || 0,
          completionRate: matchingAd.totals?.completionRate || 0,
          impressions: matchingAd.totals?.impressions || 0
        }];
      } else {
        // Return aggregated daily stats
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
    
    // Calculate summary from processed data
    const summary = {
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      totalQRScans: 0,
      totalAds: userAnalytics.totalAds || 0,
      activeAds: filteredAds.length,
      totalDevices: userAnalytics.totalDevices || 0
    };
    
    // Calculate totals from dailyStats
    if (formattedDailyStats.length > 0) {
      const calculatedTotals = formattedDailyStats.reduce((acc, stat) => ({
        adsPlayed: acc.adsPlayed + (stat.adsPlayed || 0),
        displayTime: acc.displayTime + (stat.displayTime || 0),
        qrScans: acc.qrScans + (stat.qrScans || 0)
      }), { adsPlayed: 0, displayTime: 0, qrScans: 0 });
      
      summary.totalAdsPlayed = calculatedTotals.adsPlayed;
      summary.totalDisplayTime = calculatedTotals.displayTime;
      summary.totalQRScans = calculatedTotals.qrScans;
    }
    
    // Format adPerformance
    // ✅ FIX: Make map callback async to support await for DeviceDataHistoryV2 queries
    const adPerformance = await Promise.all(filteredAds.map(async (ad) => {
      try {
        const adIdStr = ad.adId ? ad.adId.toString() : '';
        let totalPlays = 0;
        let totalQRScans = 0;
      
      // ✅ FIX: For period=all, use pre-aggregated all-time totals (from UserAnalyticsSummary or userAnalytics.ads)
      // For date-filtered periods, calculate from dailyStats
      if (period === 'all' || !period) {
        // All-time: Use pre-aggregated totals (most accurate, includes all historical data)
        totalPlays = ad.totalAdPlays || 0;
        totalQRScans = ad.totalQRScans || 0;
        
        // ✅ CRITICAL FIX: Replace today's portion with real-time data from DeviceTracking
        // UserAnalyticsSummary has all-time totals that include today's data from last sync
        // Since DailyUserAnalytics might not have today's entry, we need to handle this carefully
        // ✅ SAFETY: If summary was updated very recently (within 5 minutes), trust it completely to avoid double-counting
        const RECENT_UPDATE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        const summaryAge = summaryLastUpdated ? (Date.now() - new Date(summaryLastUpdated).getTime()) : Infinity;
        const isSummaryVeryRecent = summaryAge < RECENT_UPDATE_THRESHOLD;
        
        if (includesToday) {
          // ✅ SAFETY: If summary was updated very recently, trust it completely
          if (isSummaryVeryRecent) {
            console.log(`✅ [direct-v2] Summary updated ${Math.round(summaryAge / 1000)}s ago - using summary total as-is to prevent double-counting: ${totalQRScans}`);
            // Use summary total as-is, don't try to merge today's data
          } else {
            const beforeQRScans = totalQRScans;
          const beforePlays = totalPlays;
          
          // ✅ Get today's portion from dailyStats (what UserAnalyticsSummary has for today)
          // This is needed to avoid double-counting when we add real-time data
          let todayPortionFromDailyStats = { qrScans: 0, adsPlayed: 0 };
          const todayDailyStat = processedDailyStats.find(stat => stat.date === todayStr);
          if (todayDailyStat) {
            const todayAdEntry = todayDailyStat.ads?.find(a => a.adId && a.adId.toString() === adIdStr);
            if (todayAdEntry && todayAdEntry.totals) {
              todayPortionFromDailyStats.qrScans = todayAdEntry.totals.qrScans || 0;
              todayPortionFromDailyStats.adsPlayed = todayAdEntry.totals.adsPlayed || 0;
            }
          }
          
          // ✅ Get today's real-time data (from todayDataByAd if available, or query DeviceTracking directly)
          let todayData = null;
          if (typeof todayDataByAd !== 'undefined' && todayDataByAd.has(adIdStr)) {
            todayData = todayDataByAd.get(adIdStr);
          } else {
            // todayDataByAd is empty - query DeviceTracking directly for this ad
            try {
              const DeviceTracking = require('../models/deviceTracking');
              const Ad = require('../models/Ad');
              
              // ✅ FIX: Get materials from the Ad model, not Material.find with userId
              // Materials are linked to ads via ad.materialId array
              const adDoc = await Ad.findById(adIdStr)
                .select('materialId')
                .lean();
              
              let materialIds = [];
              if (adDoc && adDoc.materialId && Array.isArray(adDoc.materialId)) {
                materialIds = adDoc.materialId.map(m => {
                  // Handle both direct materialId strings and objects with materialId property
                  return typeof m === 'string' ? m : (m.materialId || m);
                }).filter(Boolean);
              }
              
              if (materialIds.length > 0) {
                const todayRecords = await DeviceTracking.find({
                  materialId: { $in: materialIds },
                  date: today
                }).lean();
                
                // Aggregate QR scans for this ad from today's records
                let todayQRScans = 0;
                let todayAdsPlayed = 0;
                let todayDisplayTime = 0;
                
                todayRecords.forEach(record => {
                  // Process qrScansByAd
                  if (record.qrScansByAd && record.qrScansByAd.length > 0) {
                    record.qrScansByAd.forEach(adScan => {
                      const scanAdIdStr = adScan.adId ? adScan.adId.toString() : '';
                      if (scanAdIdStr === adIdStr) {
                        todayQRScans += adScan.scanCount || 0;
                      }
                    });
                  } else if (record.qrScans && record.qrScans.length > 0) {
                    // Fallback to counting from array
                    record.qrScans.forEach(scan => {
                      const scanAdIdStr = scan.adId ? scan.adId.toString() : '';
                      if (scanAdIdStr === adIdStr) {
                        todayQRScans += 1;
                      }
                    });
                  }
                  
                  // Process adPerformance
                  if (record.adPerformance && record.adPerformance.length > 0) {
                    record.adPerformance.forEach(adPerf => {
                      const perfAdIdStr = adPerf.adId ? adPerf.adId.toString() : '';
                      if (perfAdIdStr === adIdStr) {
                        todayAdsPlayed += adPerf.playCount || 0;
                        todayDisplayTime += adPerf.totalViewTime || 0;
                      }
                    });
                  }
                });
                
                if (todayQRScans > 0 || todayAdsPlayed > 0) {
                  todayData = {
                    adId: new mongoose.Types.ObjectId(adIdStr),
                    adTitle: ad.adTitle || 'Unknown',
                    qrScans: todayQRScans,
                    adsPlayed: todayAdsPlayed,
                    displayTime: todayDisplayTime,
                    impressions: 0
                  };
                }
              }
            } catch (todayQueryError) {
              console.error('❌ [direct-v2] Error querying DeviceTracking for today:', todayQueryError);
            }
          }
          
          // ✅ CRITICAL FIX: If DailyUserAnalytics has no entry for today, UserAnalyticsSummary already includes today's data
          // In this case, we need to estimate today's portion from the summary
          // If summary was updated today, it likely includes today's data up to the sync time
          // We'll use a conservative approach: if no dailyStats entry, assume summary includes today's real-time data
          // So we subtract today's real-time data and add it back (net: use real-time as source of truth)
          if (todayPortionFromDailyStats.qrScans === 0 && summaryLastUpdated) {
            const summaryUpdateDate = new Date(summaryLastUpdated);
            summaryUpdateDate.setHours(0, 0, 0, 0);
            const todayDate = new Date(today);
            todayDate.setHours(0, 0, 0, 0);
            
            if (summaryUpdateDate.getTime() === todayDate.getTime()) {
              // Summary was updated today but no DailyUserAnalytics entry
              // This means UserAnalyticsSummary's total already includes today's data from the sync
              // We can't know exactly how much, so we'll use today's real-time data as the source of truth
              // Calculate: historical = summary total - today's real-time (approximation)
              // Then add today's real-time back = historical + today's real-time
              // This is: totalQRScans - todayData.qrScans + todayData.qrScans = totalQRScans (no change)
              // But that's wrong if summary has different today's data
              // Better: Use DeviceDataHistoryV2 for historical, but that's expensive
              // Simplest: Assume summary's total is correct for historical, and just use real-time for today
              // This means: total = (summary total - estimated today from summary) + real-time today
              // But we don't know estimated today from summary...
              // ACTUAL FIX: If no dailyStats entry, don't subtract anything, just use summary total
              // This means we're trusting the summary for historical, and only updating if dailyStats exists
              console.log(`⚠️ [direct-v2] No DailyUserAnalytics entry for today, but summary was updated today. Using summary total as-is (may include stale today data).`);
            }
          }
          
          // ✅ Replace today's portion: subtract what's in dailyStats (from UserAnalyticsSummary), add real-time data
          if (todayData && todayPortionFromDailyStats.qrScans > 0) {
            // We have dailyStats entry, so we can safely replace
            // ✅ FIX: Ensure we don't subtract more than we have, and verify todayData is valid
            const todayQRScansFromStats = todayPortionFromDailyStats.qrScans || 0;
            const todayQRScansRealTime = todayData.qrScans || 0;
            
            // ✅ SAFETY CHECK: If real-time count is 0 or missing, don't subtract - use DeviceDataHistoryV2 calculation instead
            if (!todayData || todayQRScansRealTime === 0) {
              console.log(`⚠️ [direct-v2] Real-time today data is missing or 0. Using DeviceDataHistoryV2 calculation instead to avoid count decrease.`);
              // Fall through to DeviceDataHistoryV2 calculation path by setting todayPortionFromDailyStats.qrScans to 0
              // This will trigger the else if condition below
              todayPortionFromDailyStats.qrScans = 0;
            } else {
              // ✅ FIX: Calculate the replacement carefully
              const replacementResult = Math.max(0, totalQRScans - todayQRScansFromStats + todayQRScansRealTime);
              
              // ✅ SAFETY CHECK: If replacement would increase count significantly more than expected, it might be double-counting
              // Expected increase: todayQRScansRealTime - todayQRScansFromStats
              // If the result is more than 2 scans higher than beforeQRScans, something's wrong
              const expectedIncrease = todayQRScansRealTime - todayQRScansFromStats;
              if (expectedIncrease > 0 && replacementResult > beforeQRScans + expectedIncrease + 2) {
                console.log(`⚠️ [direct-v2] Replacement result (${replacementResult}) is suspiciously higher than expected. Using summary total to prevent double-counting.`);
                totalQRScans = beforeQRScans; // Use summary as-is
              } else {
                totalQRScans = replacementResult;
              }
              
              totalPlays = Math.max(0, totalPlays - todayPortionFromDailyStats.adsPlayed + (todayData.adsPlayed || 0));
              console.log(`⚡ [direct-v2] Replaced today's data for "${ad.adTitle}": QR scans ${beforeQRScans} → ${totalQRScans} (dailyStats had ${todayQRScansFromStats} for today, real-time has ${todayQRScansRealTime})`);
            }
          }
          
          // ✅ FIX: If we need to use DeviceDataHistoryV2 calculation (either no dailyStats entry or todayData is invalid)
          if (summaryLastUpdated && todayPortionFromDailyStats.qrScans === 0) {
            // No dailyStats entry - get historical from DeviceDataHistoryV2 (excluding today), then add today's real-time
            // ✅ FIX: Always use DeviceDataHistoryV2 calculation when we have today's real-time data to avoid double-counting
            // This ensures accurate counts by calculating historical separately and adding today's real-time data
            if (todayData && (todayData.qrScans || 0) > 0) {
              try {
                const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
                const Ad = require('../models/Ad');
                const { getUTCMidnight } = require('../utils/dateUtils');
                
                // ✅ FIX: Get materials from the Ad model, not Material.find with userId
                // Materials are linked to ads via ad.materialId array
                const adDoc = await Ad.findById(adIdStr)
                  .select('materialId')
                  .lean();
                
                let materialIds = [];
                if (adDoc && adDoc.materialId && Array.isArray(adDoc.materialId)) {
                  materialIds = adDoc.materialId.map(m => {
                    // Handle both direct materialId strings and objects with materialId property
                    return typeof m === 'string' ? m : (m.materialId || m);
                  }).filter(Boolean);
                }
                
                if (materialIds.length > 0) {
                  // Get historical QR scans from DeviceDataHistoryV2 (all days except today)
                  // ✅ FIX: Use getUTCMidnight to ensure consistent date comparison
                  const todayMidnight = getUTCMidnight(today);
                  const historicalQRScans = await DeviceDataHistoryV2.aggregate([
                    { $match: { materialId: { $in: materialIds } } },
                    { $unwind: '$dailyData' },
                    { 
                      $match: { 
                        'dailyData.date': { $lt: todayMidnight } // Exclude today - use midnight for consistency
                      } 
                    },
                    { $unwind: { path: '$dailyData.qrScansByAd', preserveNullAndEmptyArrays: true } },
                    {
                      $match: {
                        'dailyData.qrScansByAd.adId': new mongoose.Types.ObjectId(adIdStr)
                      }
                    },
                    {
                      $group: {
                        _id: null,
                        totalQRScans: { $sum: '$dailyData.qrScansByAd.scanCount' }
                      }
                    }
                  ]);
                  
                  const historicalCount = historicalQRScans.length > 0 ? (historicalQRScans[0].totalQRScans || 0) : 0;
                  
                  // Use historical count + today's real-time data
                  const todayQRScans = todayData ? (todayData.qrScans || 0) : 0;
                  const calculatedTotal = historicalCount + todayQRScans;
                  
                  // ✅ CRITICAL FIX: Never return a count lower than the summary total (unless we're absolutely sure)
                  // Also check if calculated is suspiciously higher (might be double-counting)
                  // This prevents the count from mysteriously decreasing or increasing incorrectly
                  if (calculatedTotal < beforeQRScans && beforeQRScans > 0) {
                    console.log(`⚠️ [direct-v2] Calculated total (${calculatedTotal}) is lower than summary (${beforeQRScans}). Using summary total to prevent count decrease.`);
                    totalQRScans = beforeQRScans;
                  } else if (calculatedTotal > beforeQRScans + 5) {
                    // If calculated is significantly higher (more than 5 scans difference), something's wrong
                    // Use summary total to prevent incorrect increases
                    console.log(`⚠️ [direct-v2] Calculated total (${calculatedTotal}) is suspiciously higher than summary (${beforeQRScans}). Difference: ${calculatedTotal - beforeQRScans}. Using summary total to prevent double-counting.`);
                    totalQRScans = beforeQRScans;
                  } else {
                    totalQRScans = calculatedTotal;
                  }
                  
                  console.log(`⚡ [direct-v2] Calculated from DeviceDataHistoryV2 for "${ad.adTitle}": Historical=${historicalCount}, Today=${todayQRScans}, Calculated=${calculatedTotal}, Final=${totalQRScans} (was ${beforeQRScans} from summary)`);
                } else {
                  // No materials - use summary total as-is
                  console.log(`⚠️ [direct-v2] No materials found, using summary total as-is: ${totalQRScans}`);
                }
              } catch (historyError) {
                console.error('❌ [direct-v2] Error getting historical data from DeviceDataHistoryV2:', historyError);
                // Fallback: Use summary total as-is (might be slightly inaccurate)
                console.log(`⚠️ [direct-v2] Using summary total as-is: ${totalQRScans} (real-time has ${todayData?.qrScans || 0} but not adding to avoid double-counting)`);
              }
            } else {
              // No today's real-time data or todayData.qrScans is 0
              // ✅ FIX: Don't subtract or modify the summary total if we don't have valid todayData
              // The summary should be correct, so use it as-is to prevent count decreasing
              console.log(`⚠️ [direct-v2] No valid today's real-time data (todayData.qrScans=${todayData?.qrScans || 0}). Using summary total as-is to prevent count decrease: ${totalQRScans}`);
            }
          } else {
            // No summaryLastUpdated - use summary total as-is
            console.log(`⚠️ [direct-v2] No summary lastUpdated, using summary total as-is: ${totalQRScans}`);
          }
          
          console.log(`⚡ [direct-v2] Processed today's data for "${ad.adTitle}": QR scans ${beforeQRScans} → ${totalQRScans} (dailyStats had ${todayPortionFromDailyStats.qrScans} for today, real-time has ${todayData?.qrScans || 0}), Plays ${beforePlays} → ${totalPlays} (dailyStats had ${todayPortionFromDailyStats.adsPlayed} for today, real-time has ${todayData?.adsPlayed || 0})`);
          }
        }
        
        // Fallback calculation if not available
        if (totalPlays === 0 && ad.totalAdPlayTime) {
          totalPlays = Math.round(ad.totalAdPlayTime / 35);
        }
        
        console.log(`📊 [direct-v2] Ad "${ad.adTitle}" all-time totals (with today's real-time): ${totalPlays} plays, ${totalQRScans} QR scans`);
      } else {
        // Date-filtered: Calculate from dailyStats for this ad
        processedDailyStats.forEach(dateEntry => {
          const adEntry = dateEntry.ads?.find(a => 
            a.adId && a.adId.toString() === ad.adId.toString()
          );
          if (adEntry && adEntry.totals) {
            totalPlays += adEntry.totals.adsPlayed || 0;
            totalQRScans += adEntry.totals.qrScans || 0;
          }
        });
        
        // Fallback to ad totals if no dailyStats data
        if (totalPlays === 0 && ad.totalAdPlayTime) {
          totalPlays = Math.round(ad.totalAdPlayTime / 35);
        }
        if (totalQRScans === 0) {
          totalQRScans = ad.totalQRScans || 0;
        }
      }
      
        return {
          adId: ad.adId,
          adTitle: ad.adTitle,
          totalPlays: totalPlays, // Frontend uses: ad.totalAdPlays || ad.totalPlays
          totalAdPlays: totalPlays, // ✅ Also include for frontend compatibility
          totalViewTime: ad.totalAdPlayTime || 0, // Frontend uses: ad.totalAdPlayTime || ad.totalViewTime
          totalAdPlayTime: ad.totalAdPlayTime || 0, // ✅ Also include for frontend compatibility
          averageViewTime: totalPlays > 0 ? (ad.totalAdPlayTime || 0) / totalPlays : 0,
          completionRate: ad.averageAdCompletionRate || 0,
          averageAdCompletionRate: ad.averageAdCompletionRate || 0, // ✅ Also include for frontend compatibility
          impressions: ad.totalAdImpressions || 0,
          totalAdImpressions: ad.totalAdImpressions || 0, // ✅ Also include for frontend compatibility
          totalQRScans: totalQRScans // ✅ Use all-time totals when period=all
        };
      } catch (adError) {
        console.error(`❌ [direct-v2] Error processing ad ${ad.adId}:`, adError);
        // Return a fallback object to prevent Promise.all from failing
        return {
          adId: ad.adId,
          adTitle: ad.adTitle || 'Unknown',
          totalPlays: ad.totalAdPlays || ad.totalPlays || 0,
          totalAdPlays: ad.totalAdPlays || ad.totalPlays || 0,
          totalViewTime: ad.totalAdPlayTime || ad.totalViewTime || 0,
          totalAdPlayTime: ad.totalAdPlayTime || ad.totalViewTime || 0,
          averageViewTime: 0,
          completionRate: ad.averageAdCompletionRate || ad.completionRate || 0,
          averageAdCompletionRate: ad.averageAdCompletionRate || ad.completionRate || 0,
          impressions: ad.totalAdImpressions || ad.impressions || 0,
          totalAdImpressions: ad.totalAdImpressions || ad.impressions || 0,
          totalQRScans: ad.totalQRScans || 0
        };
      }
    }));
    
    // ✅ FIX: Get fresh deviceStats from getDeviceStatsFromHistory instead of stale materialBreakdown
    // This ensures device stats reflect the latest ad plays and QR scans from individual devices
    const UserAnalyticsService = require('../services/userAnalyticsService');
    let deviceStats = [];
    try {
      // Get fresh device stats using the same date range as the query
      const freshDeviceStats = await UserAnalyticsService.getDeviceStatsFromHistory(
        userId,
        dateRange.startDate,
        dateRange.endDate,
        adId || null
      );
      
      // Format deviceStats to match expected structure
      deviceStats = freshDeviceStats.map(device => ({
        deviceId: device.materialId,
        materialId: device.materialId,
        deviceName: device.materialId,
        adsPlayed: device.adsPlayed || 0,
        displayTime: device.displayTime || 0,
        qrScans: device.qrScans || 0,
        impressions: 0, // Not available from getDeviceStatsFromHistory
        isOnline: device.isOnline || false,
        lastSeen: device.lastActivity || null
      }));
      
      console.log(`✅ [direct-v2] Fetched fresh deviceStats: ${deviceStats.length} devices`);
      
      // ✅ CRITICAL FIX: Recalculate summary from fresh deviceStats when "all devices" filter is selected
      // This ensures totals reflect the latest ad plays from individual devices, not just cached data
      if (deviceStats.length > 0) {
        const calculatedFromDeviceStats = {
          totalAdsPlayed: deviceStats.reduce((sum, device) => sum + (device.adsPlayed || 0), 0),
          totalDisplayTime: deviceStats.reduce((sum, device) => sum + (device.displayTime || 0), 0),
          totalQRScans: deviceStats.reduce((sum, device) => sum + (device.qrScans || 0), 0),
          totalDevices: deviceStats.length
        };
        
        console.log(`📊 [direct-v2] Recalculating summary from fresh deviceStats:`, {
          fromDailyStats: {
            totalAdsPlayed: summary.totalAdsPlayed,
            totalDisplayTime: summary.totalDisplayTime,
            totalQRScans: summary.totalQRScans
          },
          fromDeviceStats: calculatedFromDeviceStats
        });
        
        // ✅ Override summary totals with fresh deviceStats totals (more accurate for "all devices" view)
        // This ensures the summary updates immediately when individual devices have new ad plays
        summary.totalAdsPlayed = calculatedFromDeviceStats.totalAdsPlayed;
        summary.totalDisplayTime = calculatedFromDeviceStats.totalDisplayTime;
        summary.totalQRScans = calculatedFromDeviceStats.totalQRScans;
        summary.totalDevices = calculatedFromDeviceStats.totalDevices;
        
        console.log(`✅ [direct-v2] Summary updated from fresh deviceStats:`, {
          totalAdsPlayed: summary.totalAdsPlayed,
          totalDisplayTime: summary.totalDisplayTime,
          totalQRScans: summary.totalQRScans,
          totalDevices: summary.totalDevices
        });
      }
    } catch (deviceStatsError) {
      console.error('❌ [direct-v2] Error fetching fresh deviceStats, falling back to materialBreakdown:', deviceStatsError);
      // Fallback to materialBreakdown if getDeviceStatsFromHistory fails
      deviceStats = (userAnalytics.materialBreakdown || []).map(material => ({
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
    }
    
    const duration = Date.now() - requestStartTime;
    
    console.log('✅ [OPTIMIZED] Query completed in', duration, 'ms');
    console.log('📊 [DIRECT-V2] Returning data:', {
      summaryTotalAdsPlayed: summary.totalAdsPlayed,
      dailyStatsCount: formattedDailyStats.length,
      adPerformanceCount: adPerformance.length,
      deviceStatsCount: deviceStats.length,
      sampleDailyStats: formattedDailyStats.slice(0, 2)
    });
    
    res.json({
      success: true,
      data: {
        summary,
        dailyStats: formattedDailyStats,
        adPerformance,
        deviceStats,
        ads: filteredAds,
        period: period || 'all',
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        lastUpdated: userAnalytics.lastUpdated || userAnalytics.updatedAt,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalDailyStatsCount,
          pages: Math.ceil(totalDailyStatsCount / parseInt(limit))
        }
      },
      metadata: {
        queryTime: `${duration}ms`,
        optimized: true,
        version: 'v2'
      }
    });
    
  } catch (error) {
    const duration = Date.now() - requestStartTime;
    console.error('❌ [DIRECT-V2] Error in direct-v2 API:', error);
    console.error('❌ [DIRECT-V2] Error stack:', error.stack);
    console.error('❌ [DIRECT-V2] Request details:', {
      userId,
      startDate,
      endDate,
      period,
      adId,
      page,
      limit
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /analytics/user/:userId/direct - Direct API endpoint that fetches from UserAnalytics collection
// ✅ NEW: Fetches directly from UserAnalytics collection for the logged-in user
// ✅ Supports filtering by date range, period, adId, and deviceId
// ✅ OPTIMIZED: Future-proof with performance improvements
// ⚠️ NOTE: This is the OLD version - consider using /direct-v2 for better performance
router.get('/user/:userId/direct', async (req, res) => {
  const requestStartTime = Date.now();
  // ✅ Declare variables outside try block so they're available in finally
  const { userId } = req.params;
  const { startDate, endDate, period, adId, deviceId, realtime } = req.query;
  
  try {
    
    // ✅ Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId'
      });
    }
    
    // ✅ NEW: Check for real-time mode parameter (overrides environment variable)
    const forceRealtime = realtime === 'true' || realtime === '1';
    
    // ✅ OPTIMIZED: Validate and normalize date range
    let dateRange;
    try {
      dateRange = AnalyticsOptimizer.validateAndNormalizeDateRange(startDate, endDate, period);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Invalid date range'
      });
    }
    
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
      
      // ✅ OPTIMIZED: Use normalized date range from optimizer
      const defaultStartDate = dateRange.startDate;
      const defaultEndDate = dateRange.endDate;
      
      // ✅ OPTIMIZED: Get valid (non-archived) ad IDs with caching
      const Ad = require('../models/Ad');
      const adCacheKey = `user_ads_${userId}`;
      let validAdIds = optimizer.getCached(adCacheKey);
      let firstAdCreationDate = null;
      
      if (!validAdIds) {
        const allUserAds = await Ad.find({ 
          userId: userId,
          paymentStatus: 'PAID',
          adStatus: 'ACTIVE',
          isArchived: false,  // ✅ Exclude archived/deleted ads
          status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
        }).select('_id createdAt').lean().sort({ createdAt: 1 }); // Sort to get first ad date
        
        validAdIds = new Set(allUserAds.map(ad => ad._id.toString()));
        
        // Get the earliest ad creation date to filter out data before ads existed
        if (allUserAds.length > 0 && allUserAds[0].createdAt) {
          firstAdCreationDate = new Date(allUserAds[0].createdAt);
          firstAdCreationDate.setUTCHours(0, 0, 0, 0);
        }
        
        optimizer.setCached(adCacheKey, validAdIds);
      } else {
        // If cached, still need to get first ad date
        const firstAd = await Ad.findOne({ 
          userId: userId,
          isArchived: false
        }).select('createdAt').lean().sort({ createdAt: 1 });
        
        if (firstAd && firstAd.createdAt) {
          firstAdCreationDate = new Date(firstAd.createdAt);
          firstAdCreationDate.setUTCHours(0, 0, 0, 0);
        }
      }
      
      // ✅ OPTIMIZED: Filter dailyStats by date range with strict filtering
      let filteredDailyStats = userAnalytics.dailyStats || [];
      
      // ✅ CRITICAL: Filter out future dates and dates before first ad creation
      // ✅ FIX: Use Philippine timezone for "today" comparison (dates in dailyStats are in Philippine timezone)
      const getTodayInPhilippineTime = () => {
        const now = new Date();
        const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        const phTime = new Date(now.getTime() + phOffset);
        return phTime.toISOString().split('T')[0]; // YYYY-MM-DD
      };
      const todayStr = getTodayInPhilippineTime();
      
      const beforeFilterCount = filteredDailyStats.length;
      filteredDailyStats = filteredDailyStats.filter(dateEntry => {
        const entryDateStr = dateEntry.date;
        
        // Filter out future dates (data shouldn't exist for future dates)
        // Compare using Philippine timezone date strings
        if (entryDateStr > todayStr) {
          console.log(`🚫 [UserAnalytics] Filtering out future date: ${entryDateStr} (today in PH: ${todayStr})`);
          return false;
        }
        
        // Filter out dates before first ad was created (no ads existed yet)
        if (firstAdCreationDate) {
          const firstAdDateStr = firstAdCreationDate.toISOString().split('T')[0];
          if (entryDateStr < firstAdDateStr) {
            console.log(`🚫 [UserAnalytics] Filtering out date before first ad: ${entryDateStr} (first ad: ${firstAdDateStr})`);
            return false;
          }
        }
        
        return true;
      });
      
      if (beforeFilterCount > filteredDailyStats.length) {
        console.log(`✅ [UserAnalytics] Filtered out ${beforeFilterCount - filteredDailyStats.length} invalid date entries (future dates or before first ad creation)`);
      }
      
      // Apply date range filtering if provided
      if (defaultStartDate && defaultEndDate) {
        const startDateStr = dateRange.startDateStr;
        const endDateStr = dateRange.endDateStr;
        
        // ✅ STRICT FILTERING: If startDate and endDate are the same (single date selection),
        // only return data for that exact date. Otherwise, return data within the range.
        if (dateRange.isSingleDate) {
          // Single date selection - only return exact match
          filteredDailyStats = filteredDailyStats.filter(dateEntry => {
            return dateEntry.date === startDateStr;
          });
        } else {
          // Date range selection - return data within range
          filteredDailyStats = filteredDailyStats.filter(dateEntry => {
            return dateEntry.date >= startDateStr && dateEntry.date <= endDateStr;
          });
        }
      }
      // When period='all' (defaultStartDate and defaultEndDate are null), use all dailyStats
      
      // ✅ Filter out archived ads from dailyStats before calculating totals
      filteredDailyStats = filteredDailyStats.map(dateEntry => {
        // Filter ads array to exclude archived ads
        const validAds = (dateEntry.ads || []).filter(ad => {
          if (!ad.adId) return false;
          return validAdIds.has(ad.adId.toString());
        });
        
        // Recalculate totals from only valid (non-archived) ads
        const recalculatedTotals = validAds.reduce((acc, ad) => {
          const adTotals = ad.totals || {};
          return {
            impressions: acc.impressions + (adTotals.impressions || 0),
            adsPlayed: acc.adsPlayed + (adTotals.adsPlayed || 0),
            displayTime: acc.displayTime + (adTotals.displayTime || 0),
            qrScans: acc.qrScans + (adTotals.qrScans || 0),
            completionRate: 0 // Will be calculated separately if needed
          };
        }, { impressions: 0, adsPlayed: 0, displayTime: 0, qrScans: 0, completionRate: 0 });
        
        return {
          date: dateEntry.date,
          ads: validAds,
          totals: recalculatedTotals
        };
      });
      
      console.log('📊 [UserAnalytics] Processing dailyStats:', {
        totalDailyStats: userAnalytics.dailyStats?.length || 0,
        filteredCount: filteredDailyStats.length,
        period: period || 'all',
        hasDateFilter: !!(defaultStartDate && defaultEndDate),
        adId: adId || 'all',
        validAdIdsCount: validAdIds.size,
        firstAdDate: firstAdCreationDate ? firstAdCreationDate.toISOString().split('T')[0] : 'none',
        today: todayStr,
        datesInData: filteredDailyStats.map(d => d.date).slice(0, 5),
        datesFilteredOut: userAnalytics.dailyStats?.filter(d => {
          const entryDateStr = d.date;
          // ✅ Use Philippine timezone date for comparison (already calculated above as todayStr)
          if (entryDateStr > todayStr) return true;
          if (firstAdCreationDate) {
            const firstAdDateStr = firstAdCreationDate.toISOString().split('T')[0];
            if (entryDateStr < firstAdDateStr) return true;
          }
          return false;
        }).map(d => d.date) || []
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
      // When adId='all', use all valid (non-archived) ads
      
      // ✅ IMPORTANT: formattedDailyStats is created from filteredDailyStats
      // filteredDailyStats has already been filtered for invalid dates, future dates, and date ranges
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
      // ✅ Use the same validAdIds Set from above (already filtered for archived ads)
      let filteredAds = (userAnalytics.ads || []).filter(ad => {
        if (!ad.adId) return false;
        const adIdStr = ad.adId.toString();
        // ✅ Exclude archived ads
        if (!validAdIds.has(adIdStr)) return false;
        // Filter by adId if provided
        if (adId && adId !== 'all') {
          return adIdStr === adId;
        }
        return true;
      });
      
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
      // 🔧 FIX: Only show ads currently assigned to this device to prevent showing stale data
      if (deviceId && deviceId !== 'all') {
        // Get material reference for this device
        const Material = require('../models/Material');
        const material = await Material.findOne({ materialId: deviceId }).select('_id').lean();
        
        if (material) {
          // Find ads currently assigned to this device
          const currentDeviceAds = await Ad.find({
            $or: [
              { materialId: material._id },
              { targetDevices: material._id }
            ],
            userId: userId,
            isArchived: false,
            paymentStatus: 'PAID',
            adStatus: 'ACTIVE'
          }).select('_id').lean();
          
          const currentAdIds = new Set(currentDeviceAds.map(ad => ad._id.toString()));
          
          // Filter ads array to only currently assigned ads
          filteredAds = filteredAds.filter(ad => 
            ad.adId && currentAdIds.has(ad.adId.toString())
          );
          
          // Filter daily stats to only include currently assigned ads
          filteredDailyStats = filteredDailyStats.map(dateEntry => {
            const validAds = (dateEntry.ads || []).filter(ad => 
              ad.adId && currentAdIds.has(ad.adId.toString())
            );
            
            // Recalculate totals from only currently assigned ads
            const recalculatedTotals = validAds.reduce((acc, ad) => {
              const adTotals = ad.totals || {};
              return {
                impressions: acc.impressions + (adTotals.impressions || 0),
                adsPlayed: acc.adsPlayed + (adTotals.adsPlayed || 0),
                displayTime: acc.displayTime + (adTotals.displayTime || 0),
                qrScans: acc.qrScans + (adTotals.qrScans || 0),
                completionRate: 0
              };
            }, { impressions: 0, adsPlayed: 0, displayTime: 0, qrScans: 0, completionRate: 0 });
            
            return {
              date: dateEntry.date,
              ads: validAds,
              totals: recalculatedTotals
            };
          });
          
          // Recalculate summary from filtered data
          summary.totalAdsPlayed = filteredDailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.adsPlayed || 0), 0);
          summary.totalDisplayTime = filteredDailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.displayTime || 0), 0);
          summary.totalQRScans = filteredDailyStats.reduce((sum, dateEntry) => 
            sum + (dateEntry.totals?.qrScans || 0), 0);
          summary.totalAds = filteredAds.length;
          summary.activeAds = filteredAds.filter(ad => ad.status === 'RUNNING' || ad.status === 'APPROVED').length;
          summary.totalDevices = 1;
          
          console.log('🔧 [DeviceFilter] Applied device filter:', {
            deviceId,
            currentlyAssignedAds: currentAdIds.size,
            filteredAdsCount: filteredAds.length,
            summary: {
              totalAdsPlayed: summary.totalAdsPlayed,
              totalQRScans: summary.totalQRScans,
              totalDisplayTime: summary.totalDisplayTime
            }
          });
        } else {
          console.warn('⚠️ [DeviceFilter] Material not found for deviceId:', deviceId);
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
        deviceId: deviceId || 'all',
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
        hasDeviceFilter: !!(deviceId && deviceId !== 'all'),
        dateRange: defaultStartDate && defaultEndDate ? {
          start: defaultStartDate.toISOString(),
          end: defaultEndDate.toISOString()
        } : 'all dates'
      });
      
      // 🔧 Add device filter context to response
      const deviceFilterNote = (deviceId && deviceId !== 'all') 
        ? "Showing analytics for ads currently assigned to this device only. Historical data from previous device assignments is not included. Use 'All Devices' to see complete ad history."
        : null;
      
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
          lastUpdated: userAnalytics.lastUpdated || userAnalytics.updatedAt,
          deviceFilterNote  // 🔧 Add context about device filtering
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
    const duration = Date.now() - requestStartTime;
    optimizer.trackPerformance('user_analytics_direct_error', duration, { 
      error: error.message,
      userId: userId || 'unknown',
      period: period || 'all'
    });
    
    console.error('❌ Error in direct API:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    const duration = Date.now() - requestStartTime;
    optimizer.trackPerformance('user_analytics_direct', duration, {
      userId: userId || 'unknown',
      period: period || 'all',
      hasDateFilter: !!(startDate && endDate)
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
