const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const Ad = require('../models/Ad');
const { slowConnectionOptimizer, parsePagination, createSummary } = require('../middleware/slowConnectionOptimizer');

// Apply slow connection optimizer middleware
router.use(slowConnectionOptimizer({
  enablePagination: true,
  enableFieldSelection: true,
  enableCaching: true,
  enableETags: true,
  maxResponseSize: 5 * 1024 * 1024, // 5MB
  defaultLimit: 50,
  cacheMaxAge: 300 // 5 minutes
}));

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
      .select('title description adFormat status startTime endTime adLengthSeconds materialId isArchived')
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

    // ✅ Allow archived ads to show analytics (they're just archived, not deleted)
    // Archived ads should still be able to display historical analytics data

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

    // ✅ OPTIMIZED: Use aggregation pipeline for better performance with large datasets
    const historyQueryStart = Date.now();
    
    // Use aggregation instead of find() for better performance with nested arrays
    const aggregationPipeline = [
      {
        $match: {
          materialId: { $in: materialIds },
          'dailyData.date': {
            $gte: queryStartDate,
            $lte: queryEndDate
          }
        }
      },
      {
        $project: {
          materialId: 1,
          carGroupId: 1,
          dailyData: {
            $filter: {
              input: '$dailyData',
              as: 'day',
              cond: {
                $and: [
                  { $gte: ['$$day.date', queryStartDate] },
                  { $lte: ['$$day.date', queryEndDate] }
                ]
              }
            }
          }
        }
      }
    ];
    
    const deviceHistoryRecords = await DeviceDataHistoryV2.aggregate(aggregationPipeline, {
      maxTimeMS: 20000, // 20 seconds timeout (reduced from 30s)
      allowDiskUse: true // Allow disk use for large datasets
    });

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
    let devicePerformance = Array.from(devicePerformanceMap.values()).map(device => ({
      materialId: device.materialId,
      carGroupId: device.carGroupId,
      plays: device.plays,
      playTime: device.playTime,
      qrScans: device.qrScans,
      lastPlayed: device.lastPlayed
    })).sort((a, b) => b.plays - a.plays); // Sort by plays descending

    // Format daily performance
    let dailyPerformance = Array.from(dailyPerformanceMap.values()).map(day => ({
      date: day.date,
      plays: day.plays,
      playTime: day.playTime,
      qrScans: day.qrScans
    })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending

    // ✅ Apply pagination if requested (for slow connections)
    const { page, limit, skip } = parsePagination(req);
    let devicePagination = null;
    let dailyPagination = null;
    
    if (req.query.page || req.query.limit) {
      // Paginate device performance
      const deviceTotal = devicePerformance.length;
      const devicePaginated = devicePerformance.slice(skip, skip + limit);
      devicePagination = {
        page,
        limit,
        total: deviceTotal,
        totalPages: Math.ceil(deviceTotal / limit),
        hasMore: page < Math.ceil(deviceTotal / limit),
        hasPrevious: page > 1
      };
      devicePerformance = devicePaginated;
      
      // Paginate daily performance
      const dailyTotal = dailyPerformance.length;
      const dailyPaginated = dailyPerformance.slice(skip, skip + limit);
      dailyPagination = {
        page,
        limit,
        total: dailyTotal,
        totalPages: Math.ceil(dailyTotal / limit),
        hasMore: page < Math.ceil(dailyTotal / limit),
        hasPrevious: page > 1
      };
      dailyPerformance = dailyPaginated;
    }

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
        pagination: {
          devices: devicePagination,
          daily: dailyPagination
        },
        metadata: {
          dataSource: 'DeviceDataHistoryV2',
          totalDevices: devicePerformanceMap.size,
          totalDays: dailyPerformanceMap.size,
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

// GET /adAnalytics/:adId/summary - Get lightweight summary (optimized for slow connections)
router.get('/:adId/summary', async (req, res) => {
  const startTime = Date.now();
  console.log(`🔍 [Ad Analytics Summary] Route hit! Ad ID: ${req.params.adId}`);
  
  try {
    const { adId } = req.params;
    const { startDate, endDate } = req.query;

    // Get the ad details
    const ad = await Ad.findById(adId)
      .select('title description adFormat status isArchived')
      .lean();
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // ✅ Exclude archived/deleted ads from analytics
    if (ad.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found or has been deleted'
      });
    }

    // Get material IDs
    const materialIds = ad.materialId?.map(m => m.materialId) || [];
    
    if (materialIds.length === 0) {
      return res.json({
        success: true,
        data: {
          adId,
          adTitle: ad.title,
          totals: {
            totalPlays: 0,
            totalPlayTime: 0,
            totalQRScans: 0
          }
        }
      });
    }

    // Build date filter
    let queryStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let queryEndDate = endDate ? new Date(endDate) : new Date();

    // Quick aggregation for totals only
    const totalsPipeline = [
      {
        $match: {
          materialId: { $in: materialIds },
          'dailyData.date': {
            $gte: queryStartDate,
            $lte: queryEndDate
          }
        }
      },
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': {
            $gte: queryStartDate,
            $lte: queryEndDate
          }
        }
      },
      {
        $project: {
          adPlaybacks: {
            $filter: {
              input: { $ifNull: ['$dailyData.adPlaybacks', []] },
              as: 'playback',
              cond: {
                $or: [
                  { $eq: ['$$playback.adId', adId] },
                  { $eq: [{ $toString: '$$playback.adId' }, adId.toString()] }
                ]
              }
            }
          },
          qrScans: {
            $filter: {
              input: { $ifNull: ['$dailyData.qrScansByAd', []] },
              as: 'scan',
              cond: {
                $or: [
                  { $eq: ['$$scan.adId', adId] },
                  { $eq: [{ $toString: '$$scan.adId' }, adId.toString()] }
                ]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: { $size: '$adPlaybacks' } },
          totalPlayTime: { 
            $sum: { 
              $sum: { 
                $map: { 
                  input: '$adPlaybacks', 
                  as: 'p', 
                  in: { $ifNull: ['$$p.viewTime', 0] } 
                } 
              } 
            } 
          },
          totalQRScans: { 
            $sum: { 
              $sum: { 
                $map: { 
                  input: '$qrScans', 
                  as: 's', 
                  in: { $ifNull: ['$$s.scanCount', 0] } 
                } 
              } 
            } 
          }
        }
      }
    ];

    const [totals] = await DeviceDataHistoryV2.aggregate(totalsPipeline, {
      maxTimeMS: 15000,
      allowDiskUse: true
    });

    const summary = {
      adId,
      adTitle: ad.title,
      adFormat: ad.adFormat,
      status: ad.status,
      totals: {
        totalPlays: totals?.totalPlays || 0,
        totalPlayTime: totals?.totalPlayTime || 0,
        totalQRScans: totals?.totalQRScans || 0
      },
      dateRange: {
        start: queryStartDate.toISOString().split('T')[0],
        end: queryEndDate.toISOString().split('T')[0]
      }
    };

    const duration = Date.now() - startTime;
    console.log(`✅ [Ad Analytics Summary] Generated in ${duration}ms`);

    res.json({
      success: true,
      data: summary,
      metadata: {
        isSummary: true,
        generatedAt: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    console.error('❌ [Ad Analytics Summary] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

