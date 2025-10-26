/**
 * Diagnostic endpoint to check why device hours are not updating
 */

const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');

// GET /api/diagnostic/device-hours/:materialId
router.get('/device-hours/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    
    console.log(`🔍 [Diagnostic] Checking hours for ${materialId}`);
    
    // Find the device tracking record
    const device = await DeviceTracking.findOne({ materialId });
    
    if (!device) {
      return res.json({
        success: false,
        error: 'Device not found',
        materialId
      });
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const deviceDate = new Date(device.date).toISOString().split('T')[0];
    
    // Check all conditions
    const diagnostic = {
      materialId: device.materialId,
      currentTime: now.toISOString(),
      
      // Basic status
      isOnline: device.isOnline,
      lastSeen: device.lastSeen,
      
      // Date check
      deviceDate: deviceDate,
      todayDate: today,
      dateMatches: deviceDate === today,
      
      // Session check
      hasCurrentSession: !!device.currentSession,
      sessionIsActive: device.currentSession?.isActive,
      sessionStartTime: device.currentSession?.startTime,
      sessionDate: device.currentSession?.date,
      sessionLastOnlineUpdate: device.currentSession?.lastOnlineUpdate,
      
      // Hours data
      sessionTotalHours: device.currentSession?.totalHoursOnline,
      deviceTotalHours: device.totalHoursOnline,
      currentHoursToday: device.currentHoursToday, // Virtual property
      targetHours: device.currentSession?.targetHours || 8,
      complianceStatus: device.currentSession?.complianceStatus,
      
      // Slot status
      slots: device.slots?.map(slot => ({
        slotNumber: slot.slotNumber,
        deviceId: slot.deviceId,
        isOnline: slot.isOnline,
        lastSeen: slot.lastSeen
      })),
      
      // Conditions for hour updates
      willUpdateHours: {
        isOnline: device.isOnline,
        dateMatches: deviceDate === today,
        sessionActive: device.currentSession?.isActive || false,
        allConditionsMet: device.isOnline && (deviceDate === today) && (device.currentSession?.isActive || false)
      },
      
      // Reasons hours might be frozen
      possibleIssues: []
    };
    
    // Diagnose issues
    if (!device.isOnline) {
      diagnostic.possibleIssues.push('Device is OFFLINE - hours only accumulate when device is online');
    }
    
    if (deviceDate !== today) {
      diagnostic.possibleIssues.push(`Device date (${deviceDate}) does not match today (${today}) - needs daily reset`);
    }
    
    if (!device.currentSession) {
      diagnostic.possibleIssues.push('No current session exists');
    } else if (!device.currentSession.isActive) {
      diagnostic.possibleIssues.push('Current session is INACTIVE - session may have been ended (possibly reached 8 hours)');
    }
    
    if (device.currentSession?.totalHoursOnline >= 8) {
      diagnostic.possibleIssues.push('Device has reached 8-hour target - session auto-ended, hours capped at 8');
    }
    
    // Calculate time since last update
    if (device.currentSession?.lastOnlineUpdate) {
      const timeSinceUpdate = (now - new Date(device.currentSession.lastOnlineUpdate)) / 1000 / 60; // minutes
      diagnostic.timeSinceLastUpdate = `${timeSinceUpdate.toFixed(1)} minutes ago`;
      
      if (timeSinceUpdate > 60) {
        diagnostic.possibleIssues.push(`Last online update was ${timeSinceUpdate.toFixed(0)} minutes ago - hoursUpdateService may not be running`);
      }
    }
    
    console.log(`✅ [Diagnostic] Analysis complete for ${materialId}:`, diagnostic.possibleIssues);
    
    res.json({
      success: true,
      diagnostic
    });
    
  } catch (error) {
    console.error('❌ [Diagnostic] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagnostic/ad-plays/:adId
 * @desc Verify ad play counts for a specific ad
 * @access Public (for debugging)
 */
router.get('/ad-plays/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const { period = '7d' } = req.query;
    
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    const mongoose = require('mongoose');
    
    // Calculate date range based on period (calendar days)
    const now = new Date();
    const endDate = now;
    const startDate = new Date(now);
    
    if (period === '1d') {
      // Today only (from midnight UTC to now)
      startDate.setUTCHours(0, 0, 0, 0);
    } else if (period === '7d') {
      // Last 7 calendar days (including today) in UTC
      startDate.setUTCDate(startDate.getUTCDate() - 6); // 6 days ago + today = 7 days
      startDate.setUTCHours(0, 0, 0, 0);
    } else if (period === '30d') {
      // Last 30 calendar days (including today) in UTC
      startDate.setUTCDate(startDate.getUTCDate() - 29); // 29 days ago + today = 30 days
      startDate.setUTCHours(0, 0, 0, 0);
    }
    
    console.log(`🔍 [Diagnostic] Checking ad plays for adId: ${adId}, period: ${period}`);
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Query 1: Get raw data from DeviceDataHistoryV2
    const rawData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'dailyData.adPerformance.adId': adId },
            { 'dailyData.adPerformance.adId': new mongoose.Types.ObjectId(adId) }
          ]
        }
      },
      {
        $group: {
          _id: {
            materialId: '$materialId',
            date: '$dailyData.date'
          },
          materialId: { $first: '$materialId' },
          date: { $first: '$dailyData.date' },
          playCount: { $sum: '$dailyData.adPerformance.playCount' },
          impressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' }
        }
      },
      { $sort: { date: -1 } }
    ]);
    
    // Query 2: Get aggregated totals
    const totals = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'dailyData.adPerformance.adId': adId },
            { 'dailyData.adPerformance.adId': new mongoose.Types.ObjectId(adId) }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
          uniqueDevices: { $addToSet: '$materialId' },
          uniqueDays: { $addToSet: '$dailyData.date' }
        }
      }
    ]);
    
    const result = {
      adId,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: totals.length > 0 ? {
        totalPlays: totals[0].totalPlays || 0,
        totalImpressions: totals[0].totalImpressions || 0,
        totalViewTime: totals[0].totalViewTime || 0,
        uniqueDevices: totals[0].uniqueDevices.length,
        uniqueDays: totals[0].uniqueDays.length
      } : {
        totalPlays: 0,
        totalImpressions: 0,
        totalViewTime: 0,
        uniqueDevices: 0,
        uniqueDays: 0
      },
      breakdown: rawData.map(item => ({
        materialId: item.materialId,
        date: item.date.toISOString().split('T')[0],
        playCount: item.playCount,
        impressions: item.impressions,
        totalViewTime: Math.round(item.totalViewTime * 100) / 100
      })),
      verificationNote: 'This shows the raw database counts. Compare with the dashboard display to verify accuracy.'
    };
    
    console.log(`✅ [Diagnostic] Found ${result.summary.totalPlays} plays across ${result.summary.uniqueDevices} devices over ${result.summary.uniqueDays} days`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ [Diagnostic] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostic data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagnostic/verify-total-plays/:userId
 * @desc Verify total ad plays for a user across all ads
 * @access Public (for debugging)
 */
router.get('/verify-total-plays/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = '7d' } = req.query;
    
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    
    // Calculate date range (calendar days)
    const now = new Date();
    const endDate = now;
    const startDate = new Date(now);
    
    if (period === '1d') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      startDate.setDate(startDate.getDate() - 6); // 6 days ago + today = 7 days
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 29); // 29 days ago + today = 30 days
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log(`🔍 [Verify] Checking total plays for userId: ${userId}, period: ${period}`);
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Query 1: Get ALL ad plays for this user (all ads combined)
    const allAdsData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
          uniqueDevices: { $addToSet: '$materialId' },
          uniqueAds: { $addToSet: '$dailyData.adPerformance.adId' },
          uniqueDays: { $addToSet: '$dailyData.date' }
        }
      }
    ]);
    
    // Query 2: Get breakdown by each ad
    const byAdData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: '$dailyData.adPerformance.adId',
          adTitle: { $first: '$dailyData.adPerformance.adTitle' },
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
          uniqueDevices: { $addToSet: '$materialId' }
        }
      },
      { $sort: { totalPlays: -1 } }
    ]);
    
    // Query 3: Get daily breakdown
    const dailyData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: '$dailyData.date',
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          uniqueAds: { $addToSet: '$dailyData.adPerformance.adId' },
          uniqueDevices: { $addToSet: '$materialId' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const summary = allAdsData.length > 0 ? allAdsData[0] : {
      totalPlays: 0,
      totalImpressions: 0,
      totalViewTime: 0,
      uniqueAds: [],
      uniqueDevices: [],
      uniqueDays: []
    };
    
    const result = {
      userId,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalPlays: summary.totalPlays,
        totalImpressions: summary.totalImpressions,
        totalViewTime: Math.round(summary.totalViewTime * 100) / 100,
        uniqueAds: summary.uniqueAds.length,
        uniqueDevices: summary.uniqueDevices.length,
        uniqueDays: summary.uniqueDays.length
      },
      breakdownByAd: byAdData.map(ad => ({
        adId: ad._id.toString(),
        adTitle: ad.adTitle || 'Unknown Ad',
        totalPlays: ad.totalPlays,
        totalImpressions: ad.totalImpressions,
        totalViewTime: Math.round(ad.totalViewTime * 100) / 100,
        uniqueDevices: ad.uniqueDevices.length
      })),
      dailyBreakdown: dailyData.map(day => ({
        date: new Date(day._id).toISOString().split('T')[0],
        totalPlays: day.totalPlays,
        uniqueAds: day.uniqueAds.length,
        uniqueDevices: day.uniqueDevices.length
      })),
      note: 'This shows raw database counts. The total plays is the sum across ALL ads for this user.'
    };
    
    console.log(`✅ [Verify] Total plays for user ${userId}: ${summary.totalPlays}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ [Verify] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify ad plays',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagnostic/clear-analytics-cache/:userId
 * @desc Clear analytics cache for a specific user
 * @access Public (for debugging)
 */
router.post('/clear-analytics-cache/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const UserAnalyticsService = require('../services/userAnalyticsService');
    
    // Clear cache for this user
    UserAnalyticsService.clearUserCache(userId);
    
    console.log(`✅ [Cache] Cleared analytics cache for user: ${userId}`);
    
    res.json({
      success: true,
      message: `Analytics cache cleared for user ${userId}`
    });
    
  } catch (error) {
    console.error('❌ [Cache] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diagnostic/clear-all-analytics-cache
 * @desc Clear ALL analytics cache
 * @access Public (for debugging)
 */
router.post('/clear-all-analytics-cache', async (req, res) => {
  try {
    const UserAnalyticsService = require('../services/userAnalyticsService');
    
    // Clear all cache
    UserAnalyticsService.clearAllCache();
    
    console.log(`✅ [Cache] Cleared ALL analytics cache`);
    
    res.json({
      success: true,
      message: 'All analytics cache cleared'
    });
    
  } catch (error) {
    console.error('❌ [Cache] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diagnostic/check-analytics-call/:userId
 * @desc Debug what the getUserAnalytics function would return
 * @access Public (for debugging)
 */
router.get('/check-analytics-call/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = '7d', adId = null } = req.query;
    
    console.log(`\n🔍 [DEBUG] Testing getUserAnalytics for userId: ${userId}, period: ${period}, adId: ${adId || 'null (All Ads)'}`);
    
    const UserAnalyticsService = require('../services/userAnalyticsService');
    
    // Call the ACTUAL getUserAnalytics function
    const result = await UserAnalyticsService.getUserAnalytics(userId, null, null, period, adId || null);
    
    console.log(`✅ [DEBUG] getUserAnalytics returned:`, {
      success: result.success,
      totalAdsPlayed: result.data?.summary?.totalAdsPlayed,
      totalAdImpressions: result.data?.summary?.totalAdImpressions,
      totalDevices: result.data?.summary?.totalDevices,
      adPerformanceCount: result.data?.adPerformance?.length
    });
    
    res.json({
      success: true,
      debug: {
        userId,
        period,
        adId: adId || 'null (All Ads)',
        note: 'This is the ACTUAL data returned by getUserAnalytics'
      },
      result: {
        totalAdsPlayed: result.data?.summary?.totalAdsPlayed,
        totalAdImpressions: result.data?.summary?.totalAdImpressions,
        totalQRScans: result.data?.summary?.totalQRScans,
        totalDevices: result.data?.summary?.totalDevices,
        totalAds: result.data?.summary?.totalAds,
        dateRange: {
          start: result.data?.startDate,
          end: result.data?.endDate
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/diagnostic/user-ads-by-email/:email
 * @desc Get all ads for a user by email with play counts
 * @access Public (for debugging)
 */
router.get('/user-ads-by-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { period = '7d' } = req.query;
    
    const User = require('../models/User');
    const Ad = require('../models/Ad');
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with email: ${email}`
      });
    }
    
    const userId = user._id.toString();
    
    console.log(`🔍 [User Ads] Checking ads for user: ${user.firstName} ${user.lastName} (${email})`);
    
    // Get all ads for this user
    const userAds = await Ad.find({ userId: user._id }).select('_id adTitle status paymentStatus startTime endTime');
    
    // Calculate date range (calendar days)
    const now = new Date();
    const endDate = now;
    const startDate = new Date(now);
    
    if (period === '1d') {
      startDate.setUTCHours(0, 0, 0, 0);
    } else if (period === '7d') {
      startDate.setUTCDate(startDate.getUTCDate() - 6);
      startDate.setUTCHours(0, 0, 0, 0);
    } else if (period === '30d') {
      startDate.setUTCDate(startDate.getUTCDate() - 29);
      startDate.setUTCHours(0, 0, 0, 0);
    }
    
    // Get play counts for each ad
    const adPlayCounts = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: '$dailyData.adPerformance.adId',
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          uniqueDevices: { $addToSet: '$materialId' }
        }
      }
    ]);
    
    // Map play counts to ads
    const playCountMap = new Map();
    adPlayCounts.forEach(item => {
      playCountMap.set(item._id.toString(), {
        totalPlays: item.totalPlays,
        totalImpressions: item.totalImpressions,
        uniqueDevices: item.uniqueDevices.length
      });
    });
    
    // Build result
    const adsWithCounts = userAds.map(ad => {
      const adId = ad._id.toString();
      const playCounts = playCountMap.get(adId) || { totalPlays: 0, totalImpressions: 0, uniqueDevices: 0 };
      
      return {
        adId: adId,
        adTitle: ad.adTitle,
        status: ad.status,
        paymentStatus: ad.paymentStatus,
        startTime: ad.startTime,
        endTime: ad.endTime,
        totalPlays: playCounts.totalPlays,
        totalImpressions: playCounts.totalImpressions,
        uniqueDevices: playCounts.uniqueDevices
      };
    });
    
    // Calculate total
    const totalPlays = adsWithCounts.reduce((sum, ad) => sum + ad.totalPlays, 0);
    
    const result = {
      user: {
        userId: userId,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role
      },
      period: period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalAds: userAds.length,
        totalPlaysAcrossAllAds: totalPlays,
        adsWithPlays: adsWithCounts.filter(ad => ad.totalPlays > 0).length
      },
      ads: adsWithCounts.sort((a, b) => b.totalPlays - a.totalPlays)
    };
    
    console.log(`✅ [User Ads] Found ${userAds.length} ads, ${totalPlays} total plays in period ${period}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ [User Ads] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user ads',
      error: error.message
    });
  }
});

module.exports = router;

