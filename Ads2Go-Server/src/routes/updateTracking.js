const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

// GET /updateTracking/:recordId - Get update tracking info for a specific record
router.get('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const record = await DeviceDataHistoryV2.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }
    
    // Get the latest daily data for tracking info
    const latestDailyData = record.dailyData && record.dailyData.length > 0 
      ? record.dailyData[record.dailyData.length - 1] 
      : null;
    
    // Calculate time since last update
    const mostRecentUpdate = new Date(Math.max(
      new Date(record.updatedAt || 0),
      new Date(latestDailyData?.lastArchiveUpdate || 0),
      new Date(latestDailyData?.lastDataUpdate || 0)
    ));
    
    const now = new Date();
    const timeDiff = now - mostRecentUpdate;
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    let timeSinceUpdate;
    if (minutesAgo < 1) {
      timeSinceUpdate = 'Just now';
    } else if (minutesAgo < 60) {
      timeSinceUpdate = `${minutesAgo} minutes ago`;
    } else if (hoursAgo < 24) {
      timeSinceUpdate = `${hoursAgo} hours ago`;
    } else {
      timeSinceUpdate = `${daysAgo} days ago`;
    }
    
    res.json({
      success: true,
      recordId: record._id,
      materialId: record.materialId,
      updateTracking: {
        // Mongoose automatic timestamps
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        
        // Latest daily data timestamps
        latestDailyData: latestDailyData ? {
          date: latestDailyData.date,
          archivedAt: latestDailyData.archivedAt,
          lastDataUpdate: latestDailyData.lastDataUpdate,
          lastArchiveUpdate: latestDailyData.lastArchiveUpdate,
          updateCount: latestDailyData.updateCount,
          lastUpdateSource: latestDailyData.lastUpdateSource,
          lastUpdateType: latestDailyData.lastUpdateType
        } : null,
        
        // Calculated fields
        timeSinceUpdate: timeSinceUpdate,
        mostRecentUpdate: mostRecentUpdate,
        
        // Data summary
        totalDailyRecords: record.dailyData?.length || 0,
        lifetimeTotals: record.lifetimeTotals,
        latestDailyDataSummary: latestDailyData ? {
          totalAdPlays: latestDailyData.totalAdPlays,
          totalQRScans: latestDailyData.totalQRScans,
          totalHoursOnline: latestDailyData.totalHoursOnline,
          locationHistoryCount: latestDailyData.locationHistory?.length || 0,
          adPlaybacksCount: latestDailyData.adPlaybacks?.length || 0,
          qrScansCount: latestDailyData.qrScans?.length || 0
        } : null
      }
    });
    
  } catch (error) {
    console.error('Error fetching update tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /updateTracking/material/:materialId/date/:date - Get update tracking for specific material and date
router.get('/material/:materialId/date/:date', async (req, res) => {
  try {
    const { materialId, date } = req.params;
    
    const record = await DeviceDataHistoryV2.findOne({ materialId });
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }
    
    // Find daily data for the specific date
    const targetDate = new Date(date);
    const dailyData = record.dailyData.find(day => 
      day.date.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]
    );
    
    if (!dailyData) {
      return res.status(404).json({
        success: false,
        message: 'Daily data not found for the specified date'
      });
    }
    
    // Calculate time since last update for this specific day
    const mostRecentUpdate = new Date(Math.max(
      new Date(dailyData.lastArchiveUpdate || 0),
      new Date(dailyData.lastDataUpdate || 0)
    ));
    
    const now = new Date();
    const timeDiff = now - mostRecentUpdate;
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    let timeSinceUpdate;
    if (minutesAgo < 1) {
      timeSinceUpdate = 'Just now';
    } else if (minutesAgo < 60) {
      timeSinceUpdate = `${minutesAgo} minutes ago`;
    } else if (hoursAgo < 24) {
      timeSinceUpdate = `${hoursAgo} hours ago`;
    } else {
      timeSinceUpdate = `${daysAgo} days ago`;
    }
    
    res.json({
      success: true,
      materialId: record.materialId,
      date: dailyData.date,
      updateTracking: {
        // Daily data timestamps
        archivedAt: dailyData.archivedAt,
        lastDataUpdate: dailyData.lastDataUpdate,
        lastArchiveUpdate: dailyData.lastArchiveUpdate,
        updateCount: dailyData.updateCount,
        lastUpdateSource: dailyData.lastUpdateSource,
        lastUpdateType: dailyData.lastUpdateType,
        
        // Calculated fields
        timeSinceUpdate: timeSinceUpdate,
        mostRecentUpdate: mostRecentUpdate,
        
        // Data summary for this day
        totalAdPlays: dailyData.totalAdPlays,
        totalQRScans: dailyData.totalQRScans,
        totalHoursOnline: dailyData.totalHoursOnline,
        locationHistoryCount: dailyData.locationHistory?.length || 0,
        adPlaybacksCount: dailyData.adPlaybacks?.length || 0,
        qrScansCount: dailyData.qrScans?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching update tracking for specific date:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /updateTracking/recent - Get recent update tracking info
router.get('/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const records = await DeviceDataHistoryV2.find({})
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .select('materialId dailyData lifetimeTotals updatedAt');
    
    const recentUpdates = records.map(record => {
      const latestDailyData = record.dailyData && record.dailyData.length > 0 
        ? record.dailyData[record.dailyData.length - 1] 
        : null;
      
      return {
        materialId: record.materialId,
        totalDailyRecords: record.dailyData?.length || 0,
        latestDate: latestDailyData?.date,
        latestUpdate: latestDailyData?.lastArchiveUpdate || record.updatedAt,
        latestAdPlays: latestDailyData?.totalAdPlays || 0,
        lifetimeAdPlays: record.lifetimeTotals?.totalAdPlays || 0
      };
    });
    
    res.json({
      success: true,
      recentUpdates
    });
    
  } catch (error) {
    console.error('Error fetching recent update tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;