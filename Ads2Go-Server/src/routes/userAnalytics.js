const express = require('express');
const router = express.Router();
const UserAnalyticsService = require('../services/userAnalyticsService');
const UserAnalytics = require('../models/userAnalytics');

// GET /api/userAnalytics/:userId
// Get user analytics data
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const result = await UserAnalyticsService.getUserAnalytics(userId, startDate, endDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user analytics'
    });
  }
});

// GET /api/userAnalytics/:userId/ad-playbacks
// Get ad playback data for a specific user
router.get('/:userId/ad-playbacks', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const result = await UserAnalyticsService.getUserAdPlaybackData(userId, startDate, endDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting user ad playback data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user ad playback data'
    });
  }
});

// GET /api/userAnalytics/:userId/qr-scans
// Get QR scan data for a specific user
router.get('/:userId/qr-scans', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const result = await UserAnalyticsService.getUserQRScanData(userId, startDate, endDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting user QR scan data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user QR scan data'
    });
  }
});

// GET /api/userAnalytics/:userId/ads/:adId
// Get specific ad analytics for a user
router.get('/:userId/ads/:adId', async (req, res) => {
  try {
    const { userId, adId } = req.params;
    const { startDate, endDate } = req.query;
    
    const userAnalytics = await UserAnalytics.findOne({ userId });
    
    if (!userAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'User analytics not found'
      });
    }
    
    const adAnalytics = userAnalytics.ads.find(ad => ad.adId.toString() === adId);
    
    if (!adAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Ad analytics not found for this user'
      });
    }
    
    // Filter by date range if provided
    let filteredMaterials = adAnalytics.materials;
    if (startDate && endDate) {
      filteredMaterials = adAnalytics.materials.filter(material => {
        const materialDate = new Date(material.lastSeen);
        return materialDate >= new Date(startDate) && materialDate <= new Date(endDate);
      });
    }
    
    res.json({
      success: true,
      userId,
      adId,
      adTitle: adAnalytics.adTitle,
      totalMaterials: filteredMaterials.length,
      totalDevices: adAnalytics.totalDevices,
      totalAdPlayTime: adAnalytics.totalAdPlayTime,
      totalAdImpressions: adAnalytics.totalAdImpressions,
      totalQRScans: adAnalytics.totalQRScans,
      averageAdCompletionRate: adAnalytics.averageAdCompletionRate,
      qrScanConversionRate: adAnalytics.qrScanConversionRate,
      materials: filteredMaterials,
      lastUpdated: adAnalytics.lastUpdated,
      createdAt: adAnalytics.createdAt
    });
  } catch (error) {
    console.error('Error getting ad analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ad analytics'
    });
  }
});

// GET /api/userAnalytics/:userId/ads/:adId/materials/:materialId
// Get specific material analytics for a user's ad
router.get('/:userId/ads/:adId/materials/:materialId', async (req, res) => {
  try {
    const { userId, adId, materialId } = req.params;
    const { startDate, endDate } = req.query;
    
    const userAnalytics = await UserAnalytics.findOne({ userId });
    
    if (!userAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'User analytics not found'
      });
    }
    
    const adAnalytics = userAnalytics.ads.find(ad => ad.adId.toString() === adId);
    
    if (!adAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Ad analytics not found for this user'
      });
    }
    
    const materialAnalytics = adAnalytics.materials.find(m => m.materialId === materialId);
    
    if (!materialAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Material analytics not found for this ad'
      });
    }
    
    // Filter daily sessions by date range if provided
    let filteredSessions = materialAnalytics.dailySessions;
    if (startDate && endDate) {
      filteredSessions = materialAnalytics.dailySessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= new Date(startDate) && sessionDate <= new Date(endDate);
      });
    }
    
    res.json({
      success: true,
      userId,
      adId,
      adTitle: adAnalytics.adTitle,
      materialId,
      materialType: materialAnalytics.materialType,
      slotNumber: materialAnalytics.slotNumber,
      deviceId: materialAnalytics.deviceId,
      isOnline: materialAnalytics.isOnline,
      currentLocation: materialAnalytics.currentLocation,
      networkStatus: materialAnalytics.networkStatus,
      deviceInfo: materialAnalytics.deviceInfo,
      totalAdPlayTime: materialAnalytics.totalAdPlayTime,
      totalAdImpressions: materialAnalytics.totalAdImpressions,
      averageAdCompletionRate: materialAnalytics.averageAdCompletionRate,
      totalQRScans: materialAnalytics.totalQRScans,
      qrScanConversionRate: materialAnalytics.qrScanConversionRate,
      totalDistanceTraveled: materialAnalytics.totalDistanceTraveled,
      averageSpeed: materialAnalytics.averageSpeed,
      maxSpeed: materialAnalytics.maxSpeed,
      uptimePercentage: materialAnalytics.uptimePercentage,
      complianceRate: materialAnalytics.complianceRate,
      averageDailyHours: materialAnalytics.averageDailyHours,
      totalInteractions: materialAnalytics.totalInteractions,
      totalScreenTaps: materialAnalytics.totalScreenTaps,
      totalDebugActivations: materialAnalytics.totalDebugActivations,
      dailySessions: filteredSessions,
      locationHistory: materialAnalytics.locationHistory,
      adPlaybacks: materialAnalytics.adPlaybacks,
      qrScans: materialAnalytics.qrScans,
      qrScansByAd: materialAnalytics.qrScansByAd,
      isActive: materialAnalytics.isActive,
      lastSeen: materialAnalytics.lastSeen,
      createdAt: materialAnalytics.createdAt,
      updatedAt: materialAnalytics.updatedAt
    });
  } catch (error) {
    console.error('Error getting material analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get material analytics'
    });
  }
});

// GET /api/userAnalytics/:userId/fetch-from-history
// Fetch fresh data from DeviceDataHistoryV2 for a specific user
router.get('/:userId/fetch-from-history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const result = await UserAnalyticsService.fetchAndUpdateUserAnalyticsFromHistory(userId, startDate, endDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching user analytics from history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics from history'
    });
  }
});

// POST /api/userAnalytics/:userId/sync-from-history
// Sync UserAnalytics with fresh data from DeviceDataHistoryV2
router.post('/:userId/sync-from-history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(userId, startDate, endDate);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error syncing user analytics from history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user analytics from history'
    });
  }
});

// GET /api/userAnalytics
// Get all user analytics (for admin purposes)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, skip = 0, sortBy = 'lastUpdated', sortOrder = 'desc' } = req.query;
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const userAnalytics = await UserAnalytics.find({})
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('userId totalAds totalMaterials totalDevices totalAdPlayTime totalAdImpressions totalQRScans averageAdCompletionRate qrScanConversionRate lastUpdated createdAt');
    
    const total = await UserAnalytics.countDocuments();
    
    res.json({
      success: true,
      data: userAnalytics,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: (parseInt(skip) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Error getting all user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user analytics'
    });
  }
});

module.exports = router;
