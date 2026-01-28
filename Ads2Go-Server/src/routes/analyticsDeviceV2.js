/**
 * Device Analytics V2 - OPTIMIZED
 * 
 * Fast device-specific analytics using flat DailyUserAnalytics structure
 * - Uses MongoDB aggregation for speed
 * - Filters at database level
 * - 100x faster than old implementation
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DailyUserAnalytics = require('../models/dailyUserAnalytics');
const UserAnalyticsSummary = require('../models/userAnalyticsSummary');

// GET /user/:userId/device/:deviceId - OPTIMIZED device analytics
router.get('/user/:userId/device/:deviceId', async (req, res) => {
  const startTime = Date.now();
  const { userId, deviceId } = req.params;
  const { startDate, endDate, period, adId } = req.query;
  
  // #region agent log
  // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:18',message:'Device analytics endpoint called',data:{userId,deviceId,startDate,endDate,period,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  try {
    console.log(`⚡ [Device V2] Fetching analytics for device ${deviceId}, user ${userId}`);
    
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId'
      });
    }
    
    // Calculate date range based on period
    let startDateObj, endDateObj;
    if (period) {
      const now = new Date();
      switch (period) {
        case '1d':
        case 'TODAY':
          startDateObj = require('../utils/dateUtils').getPhilippinesMidnight(now);
          endDateObj = now;
          break;
        case '7d':
          startDateObj = new Date(now);
          startDateObj.setUTCDate(startDateObj.getUTCDate() - 6);
          startDateObj.setUTCHours(0, 0, 0, 0);
          endDateObj = now;
          break;
        case '30d':
          startDateObj = new Date(now);
          startDateObj.setUTCDate(startDateObj.getUTCDate() - 29);
          startDateObj.setUTCHours(0, 0, 0, 0);
          endDateObj = now;
          break;
        case 'all':
          startDateObj = null;
          endDateObj = null;
          break;
        default:
          startDateObj = new Date(now);
          startDateObj.setUTCDate(startDateObj.getUTCDate() - 6);
          startDateObj.setUTCHours(0, 0, 0, 0);
          endDateObj = now;
      }
    } else if (startDate && endDate) {
      startDateObj = new Date(startDate);
      endDateObj = new Date(endDate);
    } else {
      // Default to last 7 days
      const now = new Date();
      startDateObj = new Date(now);
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 6);
      startDateObj.setUTCHours(0, 0, 0, 0);
      endDateObj = now;
    }
    
    const startDateStr = startDateObj ? startDateObj.toISOString().split('T')[0] : '2000-01-01';
    const endDateStr = endDateObj ? endDateObj.toISOString().split('T')[0] : '2099-12-31';
    
    // Build aggregation pipeline to get device-specific data
    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: startDateStr, $lte: endDateStr }
    };
    
    if (adId && adId !== 'all') {
      matchStage.adId = new mongoose.Types.ObjectId(adId);
    }
    
    // Aggregation pipeline to filter by device in materialStats
    const pipeline = [
      { $match: matchStage },
      // Unwind materialStats to filter by specific device
      { $unwind: { path: '$materialStats', preserveNullAndEmptyArrays: true } },
      // Filter for specific device
      { $match: { 'materialStats.materialId': deviceId } },
      // Group back to get totals
      {
        $group: {
          _id: null,
          totalAdsPlayed: { $sum: '$materialStats.adsPlayed' },
          totalDisplayTime: { $sum: '$materialStats.displayTime' },
          totalQRScans: { $sum: '$materialStats.qrScans' },
          avgCompletionRate: { $avg: '$completionRate' },
          daysWithData: { $sum: 1 },
          // Collect daily stats
          dailyStats: {
            $push: {
              date: '$date',
              adId: '$adId',
              adTitle: '$adTitle',
              adsPlayed: '$materialStats.adsPlayed',
              displayTime: '$materialStats.displayTime',
              qrScans: '$materialStats.qrScans',
              completionRate: '$completionRate'
            }
          }
        }
      }
    ];
    
    let result = await DailyUserAnalytics.aggregate(pipeline);
    
    // ✅ CRITICAL FIX: Always merge today's data from DeviceTracking for real-time accuracy
    // Use Philippines "today" (business day - single source of truth)
    const { getPhilippinesDateString } = require('../utils/dateUtils');
    const todayStr = getPhilippinesDateString();
    const includesToday = (!startDateStr || startDateStr <= todayStr) && (!endDateStr || endDateStr >= todayStr);
    
    if (includesToday) {
      try {
        console.log('⚡ [Device V2] Merging today\'s real-time data from DeviceTracking for device:', deviceId);
        const DeviceTracking = require('../models/deviceTracking');
        
        // Get today's DeviceTracking record for this device
        const todayRecord = await DeviceTracking.findOne({
          materialId: deviceId,
          date: todayStr
        }).lean();
        
        // #region agent log
        // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:141',message:'Fetched today DeviceTracking record (POST-FIX)',data:{deviceId,date:todayStr,todayISO:today.toISOString(),found:!!todayRecord,hasQrScansByAd:!!todayRecord?.qrScansByAd,qrScansByAdCount:todayRecord?.qrScansByAd?.length||0,hasQrScans:!!todayRecord?.qrScans,qrScansCount:todayRecord?.qrScans?.length||0,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (todayRecord) {
          // #region agent log
          if (todayRecord.qrScansByAd && todayRecord.qrScansByAd.length > 0) {
            const qrScansByAdDetails = todayRecord.qrScansByAd.map(scan => ({
              adId: scan.adId ? scan.adId.toString() : 'null',
              adTitle: scan.adTitle,
              scanCount: scan.scanCount
            }));
            // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:145',message:'qrScansByAd details',data:{qrScansByAdDetails,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }
          if (todayRecord.qrScans && todayRecord.qrScans.length > 0) {
            const qrScansDetails = todayRecord.qrScans.map(scan => ({
              adId: scan.adId ? scan.adId.toString() : 'null',
              adTitle: scan.adTitle
            }));
            // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:152',message:'qrScans array details',data:{qrScansDetails,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          }
          // #endregion
          let todayAdsPlayed = 0;
          let todayDisplayTime = 0;
          let todayQRScans = 0;
          
          // Process adPerformance
          if (todayRecord.adPerformance && todayRecord.adPerformance.length > 0) {
            todayRecord.adPerformance.forEach(adPerf => {
              const adIdStr = adPerf.adId ? adPerf.adId.toString() : '';
              if (!adId || adId === 'all' || adIdStr === adId) {
                todayAdsPlayed += adPerf.playCount || 0;
                todayDisplayTime += adPerf.totalViewTime || 0;
              }
            });
          }
          
          // Process QR scans (prefer qrScansByAd, fallback to qrScans array)
          // #region agent log
          // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:159',message:'Processing QR scans for today',data:{deviceId,adId,hasQrScansByAd:!!todayRecord.qrScansByAd,qrScansByAdCount:todayRecord.qrScansByAd?.length||0,hasQrScans:!!todayRecord.qrScans,qrScansCount:todayRecord.qrScans?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          if (todayRecord.qrScansByAd && todayRecord.qrScansByAd.length > 0) {
            // #region agent log
            // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:162',message:'Using qrScansByAd for QR scan counting',data:{qrScansByAdCount:todayRecord.qrScansByAd.length,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            todayRecord.qrScansByAd.forEach(adScan => {
              const adIdStr = adScan.adId ? adScan.adId.toString() : '';
              const matches = !adId || adId === 'all' || adIdStr === adId;
              
              // #region agent log
              // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:165',message:'Checking qrScansByAd entry',data:{adScanAdId:adIdStr,filterAdId:adId||'all',matches,scanCount:adScan.scanCount||0,adTitle:adScan.adTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
              if (matches) {
                todayQRScans += adScan.scanCount || 0;
                
                // #region agent log
                // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:170',message:'Added QR scans from qrScansByAd',data:{adIdStr,scanCount:adScan.scanCount||0,todayQRScansAfter:todayQRScans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
              }
            });
          } else if (todayRecord.qrScans && todayRecord.qrScans.length > 0) {
            // #region agent log
            // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:175',message:'Using qrScans array (fallback)',data:{qrScansCount:todayRecord.qrScans.length,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            todayRecord.qrScans.forEach(scan => {
              const adIdStr = scan.adId ? scan.adId.toString() : '';
              const matches = !adId || adId === 'all' || adIdStr === adId;
              
              // #region agent log
              // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:180',message:'Checking qrScans array entry',data:{scanAdId:adIdStr,filterAdId:adId||'all',matches,adTitle:scan.adTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
              if (matches) {
                todayQRScans += 1;
                
                // #region agent log
                // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:186',message:'Added QR scan from array',data:{adIdStr,todayQRScansAfter:todayQRScans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }
            });
          }
          
          // #region agent log
          // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:192',message:'QR scan processing complete',data:{todayQRScans,todayAdsPlayed,todayDisplayTime,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          if (todayAdsPlayed > 0 || todayQRScans > 0 || todayDisplayTime > 0) {
            console.log(`✅ [Device V2] Found today's data: ${todayAdsPlayed} plays, ${todayQRScans} QR scans, ${todayDisplayTime}s display time`);
            
            // Merge with existing result or create new
            if (result && result.length > 0) {
              const existing = result[0];
              // Ensure dailyStats array exists
              if (!existing.dailyStats) {
                existing.dailyStats = [];
              }
              
              // Check if today's data already exists in dailyStats
              // ✅ FIX: When filtering by adId, we need to check both date AND adId match
              const todayStatIndex = existing.dailyStats.findIndex(stat => {
                const statDate = stat.date === todayStr;
                if (adId && adId !== 'all') {
                  const statAdId = stat.adId ? stat.adId.toString() : '';
                  return statDate && statAdId === adId;
                }
                return statDate;
              });
              
              if (todayStatIndex >= 0) {
                // ✅ FIX: REPLACE today's entry with real-time data from DeviceTracking (not add)
                // DeviceTracking is the source of truth for today's real-time data
                // Adding would cause double-counting if DailyUserAnalytics already has today's data
                const oldQrScans = existing.dailyStats[todayStatIndex].qrScans || 0;
                const oldAdsPlayed = existing.dailyStats[todayStatIndex].adsPlayed || 0;
                existing.dailyStats[todayStatIndex].adsPlayed = todayAdsPlayed;
                existing.dailyStats[todayStatIndex].displayTime = todayDisplayTime;
                existing.dailyStats[todayStatIndex].qrScans = todayQRScans;
                console.log(`✅ [Device V2] REPLACED today's data with real-time DeviceTracking: QR scans ${oldQrScans} → ${todayQRScans}, Plays ${oldAdsPlayed} → ${todayAdsPlayed}`);
              } else {
                // Add new entry for today
                existing.dailyStats.push({
                  date: todayStr,
                  adId: adId ? new mongoose.Types.ObjectId(adId) : null,
                  adTitle: adId ? 'Today' : 'All Ads',
                  adsPlayed: todayAdsPlayed,
                  displayTime: todayDisplayTime,
                  qrScans: todayQRScans,
                  completionRate: 0
                });
                console.log(`✅ [Device V2] Added new today's entry: ${todayQRScans} QR scans`);
              }
              
              // ✅ FIX: Recalculate totals from dailyStats instead of adding
              // This ensures totals match the actual dailyStats data (prevents double-counting)
              existing.totalAdsPlayed = existing.dailyStats.reduce((sum, stat) => sum + (stat.adsPlayed || 0), 0);
              existing.totalDisplayTime = existing.dailyStats.reduce((sum, stat) => sum + (stat.displayTime || 0), 0);
              existing.totalQRScans = existing.dailyStats.reduce((sum, stat) => sum + (stat.qrScans || 0), 0);
              console.log(`✅ [Device V2] Recalculated totals from dailyStats: ${existing.totalQRScans} QR scans, ${existing.totalAdsPlayed} plays`);
            } else {
              // Create new result with today's data
              result = [{
                totalAdsPlayed: todayAdsPlayed,
                totalDisplayTime: todayDisplayTime,
                totalQRScans: todayQRScans,
                avgCompletionRate: 0,
                daysWithData: 1,
                dailyStats: [{
                  date: todayStr,
                  adId: adId ? new mongoose.Types.ObjectId(adId) : null,
                  adTitle: adId ? 'Today' : 'All Ads',
                  adsPlayed: todayAdsPlayed,
                  displayTime: todayDisplayTime,
                  qrScans: todayQRScans,
                  completionRate: 0
                }]
              }];
              console.log(`✅ [Device V2] Created new result with today's data: ${todayQRScans} QR scans, ${todayAdsPlayed} plays`);
            }
          } else {
            console.log(`⚠️ [Device V2] Today's record exists but no data found (filtered by adId: ${adId || 'all'})`);
          }
        }
      } catch (todayError) {
        console.error('❌ [Device V2] Error merging today\'s data:', todayError);
        // Continue without today's data
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (!result || result.length === 0) {
      console.log(`⚠️ [Device V2] No data found for device ${deviceId} in ${duration}ms`);
      return res.json({
        success: true,
        data: {
          deviceAnalytics: {
            deviceInfo: {
              materialId: deviceId,
              deviceName: deviceId
            },
            totals: {
              totalAdPlays: 0,
              totalAdPlayTime: 0,
              totalQRScans: 0
            },
            averages: {
              averageCompletionRate: 0
            },
            dailyStats: [],
            adPerformance: [],
            dateRange: {
              startDate: startDateStr,
              endDate: endDateStr
            }
          }
        },
        metadata: {
          queryTime: `${duration}ms`,
          optimized: true,
          version: 'device-v2'
        }
      });
    }
    
    const data = result[0];
    
    // ✅ CRITICAL FIX: Always recalculate totals from dailyStats to ensure accuracy
    // This is especially important when filtering by adId or date, as aggregation might not include filtered data
    // #region agent log
    // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:285',message:'Starting totals recalculation',data:{hasDailyStats:!!data.dailyStats,dailyStatsCount:data.dailyStats?.length||0,originalTotalQRScans:data.totalQRScans||0,originalTotalAdsPlayed:data.totalAdsPlayed||0,adId,filterAdId:adId||'all'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (data.dailyStats && data.dailyStats.length > 0) {
      // Filter dailyStats by adId if provided
      let filteredDailyStats = data.dailyStats;
      if (adId && adId !== 'all') {
        filteredDailyStats = data.dailyStats.filter(stat => {
          const statAdId = stat.adId ? stat.adId.toString() : '';
          const matches = statAdId === adId;
          
          // #region agent log
          // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:293',message:'Filtering dailyStat by adId',data:{statAdId,filterAdId:adId,matches,statQrScans:stat.qrScans||0,statAdsPlayed:stat.adsPlayed||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          return matches;
        });
        console.log(`🔍 [Device V2] Filtered dailyStats by adId ${adId}: ${data.dailyStats.length} → ${filteredDailyStats.length} entries`);
      }
      
      // Recalculate totals from filtered dailyStats
      const recalculatedPlays = filteredDailyStats.reduce((sum, stat) => sum + (stat.adsPlayed || 0), 0);
      const recalculatedDisplayTime = filteredDailyStats.reduce((sum, stat) => sum + (stat.displayTime || 0), 0);
      const recalculatedQRScans = filteredDailyStats.reduce((sum, stat) => sum + (stat.qrScans || 0), 0);
      
      // #region agent log
      // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:304',message:'Recalculated totals from dailyStats',data:{originalPlays:data.totalAdsPlayed||0,originalQRScans:data.totalQRScans||0,recalculatedPlays,recalculatedQRScans,filteredDailyStatsCount:filteredDailyStats.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Update totals (use recalculated values if they differ, or if original totals are missing)
      if (data.totalAdsPlayed !== recalculatedPlays || data.totalQRScans !== recalculatedQRScans) {
        console.log(`🔧 [Device V2] Recalculated totals from dailyStats:`, {
          original: { plays: data.totalAdsPlayed, qrScans: data.totalQRScans },
          recalculated: { plays: recalculatedPlays, qrScans: recalculatedQRScans },
          dailyStatsCount: filteredDailyStats.length
        });
        data.totalAdsPlayed = recalculatedPlays;
        data.totalDisplayTime = recalculatedDisplayTime;
        data.totalQRScans = recalculatedQRScans;
        
        // #region agent log
        // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:315',message:'Updated totals after recalculation',data:{finalTotalQRScans:data.totalQRScans,finalTotalAdsPlayed:data.totalAdsPlayed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }
    } else if (!data.totalAdsPlayed && !data.totalQRScans) {
      // If no dailyStats and no totals, set to 0
      data.totalAdsPlayed = 0;
      data.totalDisplayTime = 0;
      data.totalQRScans = 0;
      console.log(`⚠️ [Device V2] No dailyStats and no totals, setting to 0`);
      
      // #region agent log
      // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:323',message:'No dailyStats found, set totals to 0',data:{hasDailyStats:!!data.dailyStats},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }
    
    // Get ad performance breakdown
    const adPerformanceMap = new Map();
    if (data.dailyStats && data.dailyStats.length > 0) {
      data.dailyStats.forEach(stat => {
        const adIdStr = stat.adId ? stat.adId.toString() : 'all';
        if (!adPerformanceMap.has(adIdStr)) {
          adPerformanceMap.set(adIdStr, {
            adId: stat.adId || null,
            adTitle: stat.adTitle || 'Unknown',
            totalPlays: 0,
            totalViewTime: 0,
            totalQRScans: 0
          });
        }
        const adPerf = adPerformanceMap.get(adIdStr);
        adPerf.totalPlays += stat.adsPlayed || 0;
        adPerf.totalViewTime += stat.displayTime || 0;
        adPerf.totalQRScans += stat.qrScans || 0;
      });
    }
    
    console.log(`✅ [Device V2] Fetched device analytics in ${duration}ms`, {
      totalAdsPlayed: data.totalAdsPlayed || 0,
      totalQRScans: data.totalQRScans || 0,
      dailyStatsCount: data.dailyStats?.length || 0
    });
    
    // #region agent log
    // DISABLED: Debug logging
  // fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyticsDeviceV2.js:348',message:'Sending response to frontend',data:{deviceId,adId,filterAdId:adId||'all',totalQRScans:data.totalQRScans||0,totalAdPlays:data.totalAdsPlayed||0,dailyStatsCount:data.dailyStats?.length||0,dailyStatsSample:data.dailyStats?.[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    res.json({
      success: true,
      data: {
        deviceAnalytics: {
          deviceInfo: {
            materialId: deviceId,
            deviceName: deviceId
          },
          totals: {
            totalAdPlays: data.totalAdsPlayed || 0,
            totalAdPlayTime: data.totalDisplayTime || 0,
            totalQRScans: data.totalQRScans || 0
          },
          averages: {
            averageCompletionRate: data.avgCompletionRate || 0
          },
          dailyStats: (() => {
            // Filter dailyStats by adId if provided
            let statsToReturn = data.dailyStats || [];
            if (adId && adId !== 'all') {
              statsToReturn = statsToReturn.filter(stat => {
                const statAdId = stat.adId ? stat.adId.toString() : '';
                return statAdId === adId;
              });
              console.log(`🔍 [Device V2] Filtered dailyStats by adId ${adId}: ${(data.dailyStats || []).length} → ${statsToReturn.length} entries`);
            }
            
            return statsToReturn.map(stat => ({
              date: stat.date,
              adId: stat.adId,
              adTitle: stat.adTitle || 'Unknown',
              totalAdPlays: stat.adsPlayed || 0,
              totalQRScans: stat.qrScans || 0,
              qrScans: stat.qrScans || 0, // ✅ Add both field names for compatibility
              adsPlayed: stat.adsPlayed || 0, // ✅ Add both field names for compatibility
              adCompletionRate: stat.completionRate || 0,
              completionRate: stat.completionRate || 0 // ✅ Add both field names for compatibility
            })).sort((a, b) => b.date.localeCompare(a.date));
          })(),
          adPerformance: Array.from(adPerformanceMap.values()),
          dateRange: {
            startDate: startDateStr,
            endDate: endDateStr,
            totalDays: data.daysWithData
          }
        }
      },
      metadata: {
        queryTime: `${duration}ms`,
        optimized: true,
        version: 'device-v2'
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Device V2] Error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

