const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const Ad = require('../models/Ad');

/**
 * Ad Analytics API - Get analytics for a specific ad from DeviceDataHistoryV2
 * Note: No auth middleware to match pattern of other analytics routes (enhancedRouteAPI, deviceDataHistoryV2)
 */

// Health check endpoint
router.get('/health', (req, res) => {
  console.log('✅ [Ad Analytics] Health check endpoint hit');
  res.json({ success: true, message: 'Ad Analytics API is running', timestamp: new Date().toISOString() });
});

// GET /adAnalytics/:adId - Get analytics for a specific ad
router.get('/:adId', async (req, res) => {
  const startTime = Date.now(); // Track request duration
  console.log(`🔍 [Ad Analytics] Route hit! Ad ID: ${req.params.adId}`);
  console.log(`🔍 [Ad Analytics] Query params:`, req.query);
  
  try {
    const { adId } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`📊 [Ad Analytics] Fetching analytics for ad: ${adId}`);

    // Get the ad details to find associated materials (optimized query)
    const queryStart = Date.now();
    const ad = await Ad.findById(adId)
      .select('title description adFormat status startTime endTime adLengthSeconds materialId')
      .populate({
        path: 'materialId',
        select: 'materialId'
      })
      .lean();
    console.log(`⏱️ [Ad Analytics] Ad query took ${Date.now() - queryStart}ms`);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Get material IDs from the ad
    const materialIds = ad.materialId.map(m => m.materialId);
    
      if (materialIds.length === 0) {
        return res.json({
          success: true,
          data: {
            adId,
            adTitle: ad.title,
            totalPlays: 0,
            totalPlayTime: 0,
            totalQRScans: 0,
            devicePerformance: [],
            dailyPerformance: []
          }
        });
      }

    console.log(`📊 [Ad Analytics] Found ${materialIds.length} materials:`, materialIds);

    // Build date filter - default to last 30 days if not specified
    let queryStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let queryEndDate = endDate ? new Date(endDate) : new Date();

    console.log(`📊 [Ad Analytics] Date range: ${queryStartDate.toISOString().split('T')[0]} to ${queryEndDate.toISOString().split('T')[0]}`);

    // ✅ OPTIMIZED: Simple query with date range filter to reduce data
    const historyQueryStart = Date.now();
    const deviceHistoryRecords = await DeviceDataHistoryV2.find({
      materialId: { $in: materialIds },
      'dailyData.date': {
        $gte: queryStartDate,
        $lte: queryEndDate
      }
    })
      .select('materialId carGroupId dailyData.date dailyData.adPlaybacks dailyData.qrScansByAd')
      .lean()
      .maxTimeMS(30000);

    console.log(`⏱️ [Ad Analytics] History query took ${Date.now() - historyQueryStart}ms`);
    console.log(`📊 [Ad Analytics] Found ${deviceHistoryRecords.length} device history records`);

    // Calculate total data points for processing
    const totalDailyDataPoints = deviceHistoryRecords.reduce((sum, d) => sum + (d.dailyData?.length || 0), 0);
    console.log(`📊 [Ad Analytics] Processing ${totalDailyDataPoints} daily data points across ${deviceHistoryRecords.length} devices`);

    // Initialize aggregated metrics
    const processingStart = Date.now();
    let totalPlays = 0;
    let totalPlayTime = 0;
    let totalQRScans = 0;
    const devicePerformanceMap = new Map();
    const dailyPerformanceMap = new Map();

    // Process each device's history
    deviceHistoryRecords.forEach(deviceHistory => {
      const materialId = deviceHistory.materialId;
      
      // Initialize device performance if not exists
      if (!devicePerformanceMap.has(materialId)) {
        devicePerformanceMap.set(materialId, {
          materialId,
          carGroupId: deviceHistory.carGroupId,
          plays: 0,
          playTime: 0,
          qrScans: 0,
          lastPlayed: null
        });
      }

      const devicePerf = devicePerformanceMap.get(materialId);

      // Process each day's data
      deviceHistory.dailyData.forEach(day => {
        const dayDate = new Date(day.date);
        
        // Apply date filter
        if (dayDate < queryStartDate || dayDate > queryEndDate) return;

        // Filter ad playbacks for this specific ad
        const adPlaybacks = day.adPlaybacks ? day.adPlaybacks.filter(p => p.adId === adId) : [];
        
        if (adPlaybacks.length > 0) {
          adPlaybacks.forEach(playback => {
            // Update totals
            totalPlays += 1;
            totalPlayTime += playback.viewTime || 0;

            // Update device performance
            devicePerf.plays += 1;
            devicePerf.playTime += playback.viewTime || 0;

            // Track last played
            const playbackTime = new Date(playback.startTime);
            if (!devicePerf.lastPlayed || playbackTime > new Date(devicePerf.lastPlayed)) {
              devicePerf.lastPlayed = playback.startTime;
            }
          });

          // Check QR scans for this ad
          const qrScansForAd = day.qrScansByAd ? day.qrScansByAd.filter(q => q.adId === adId) : [];
          const adQRScans = qrScansForAd.reduce((sum, q) => sum + (q.scanCount || 0), 0);
          
          totalQRScans += adQRScans;
          devicePerf.qrScans += adQRScans;

          // Daily performance aggregation
          const dateKey = day.date.toISOString().split('T')[0];
          if (!dailyPerformanceMap.has(dateKey)) {
            dailyPerformanceMap.set(dateKey, {
              date: dateKey,
              plays: 0,
              playTime: 0,
              qrScans: 0
            });
          }

          const dailyPerf = dailyPerformanceMap.get(dateKey);
          adPlaybacks.forEach(playback => {
            dailyPerf.plays += 1;
            dailyPerf.playTime += playback.viewTime || 0;
          });
          dailyPerf.qrScans += adQRScans;
        }
      });
    });

    console.log(`⏱️ [Ad Analytics] Data processing took ${Date.now() - processingStart}ms`);

    // Format device performance
    const devicePerformance = Array.from(devicePerformanceMap.values()).map(device => ({
      materialId: device.materialId,
      carGroupId: device.carGroupId,
      plays: device.plays,
      playTime: device.playTime,
      qrScans: device.qrScans,
      lastPlayed: device.lastPlayed
    })).sort((a, b) => b.plays - a.plays); // Sort by plays descending

    // Format daily performance
    const dailyPerformance = Array.from(dailyPerformanceMap.values()).map(day => ({
      date: day.date,
      plays: day.plays,
      playTime: day.playTime,
      qrScans: day.qrScans
    })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending

    const responseData = {
      success: true,
      data: {
        adId,
        adTitle: ad.title,
        adDescription: ad.description,
        adFormat: ad.adFormat,
        status: ad.status,
        startTime: ad.startTime,
        endTime: ad.endTime,
        totalPlays,
        totalPlayTime,
        totalQRScans,
        devicePerformance,
        dailyPerformance,
        metadata: {
          dataSource: 'DeviceDataHistoryV2',
          totalDevices: devicePerformance.length,
          dateRange: {
            start: dailyPerformance[0]?.date,
            end: dailyPerformance[dailyPerformance.length - 1]?.date
          },
          generatedAt: new Date().toISOString()
        }
      }
    };

    const totalDuration = Date.now() - startTime;
    console.log(`✅ [Ad Analytics] Generated analytics in ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s):`, {
      adId,
      totalPlays,
      totalQRScans,
      totalDevices: devicePerformance.length,
      totalDays: dailyPerformance.length
    });

    res.json(responseData);

  } catch (error) {
    console.error('❌ [Ad Analytics] Error:', error);
    
    // Check if it's a MongoDB timeout error
    if (error.name === 'MongoNetworkTimeoutError' || error.message.includes('timed out')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again.',
        error: 'Database temporarily unavailable'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

