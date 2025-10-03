const express = require('express');
const router = express.Router();
const DeviceDataHistory = require('../models/deviceDataHistory');

// GET /updateTracking/:recordId - Get update tracking info for a specific record
router.get('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const record = await DeviceDataHistory.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }
    
    // Calculate time since last update
    const mostRecentUpdate = new Date(Math.max(
      new Date(record.updatedAt || 0),
      new Date(record.archivedAt || 0),
      new Date(record.lastDataUpdate || 0),
      new Date(record.lastArchiveUpdate || 0)
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
      materialId: record.materialId || record.deviceId,
      updateTracking: {
        // Mongoose automatic timestamps
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        
        // Archive-specific timestamps
        archivedAt: record.archivedAt,
        
        // Enhanced tracking timestamps
        lastDataUpdate: record.lastDataUpdate,
        lastArchiveUpdate: record.lastArchiveUpdate,
        updateCount: record.updateCount,
        lastUpdateSource: record.lastUpdateSource,
        lastUpdateType: record.lastUpdateType,
        
        // Device-specific timestamps
        lastSeen: record.lastSeen,
        networkLastSeen: record.networkStatus?.lastSeen,
        
        // Hours tracking timestamps
        sessionStartTime: record.hoursTracking?.sessionStartTime,
        sessionEndTime: record.hoursTracking?.sessionEndTime,
        lastOnlineUpdate: record.hoursTracking?.lastOnlineUpdate,
        
        // Recent activity
        latestAdPlayback: record.adPlaybacks?.length > 0 ? 
          record.adPlaybacks[record.adPlaybacks.length - 1].startTime : null,
        latestQrScan: record.qrScans?.length > 0 ? 
          record.qrScans[record.qrScans.length - 1].scanTimestamp : null,
        latestLocation: record.locationHistory?.length > 0 ? 
          record.locationHistory[record.locationHistory.length - 1].timestamp : null,
        
        // Summary
        mostRecentUpdate: mostRecentUpdate,
        timeSinceUpdate: timeSinceUpdate,
        isStale: timeDiff > 24 * 60 * 60 * 1000 // More than 24 hours old
      }
    });
    
  } catch (error) {
    console.error('Error getting update tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get update tracking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /updateTracking/material/:materialId/date/:date - Get update tracking for material on specific date
router.get('/material/:materialId/date/:date', async (req, res) => {
  try {
    const { materialId, date } = req.params;
    
    const record = await DeviceDataHistory.findOne({
      materialId: materialId,
      date: new Date(date)
    });
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found for the specified material and date'
      });
    }
    
    // Redirect to the specific record endpoint
    res.redirect(`/updateTracking/${record._id}`);
    
  } catch (error) {
    console.error('Error getting update tracking by material/date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get update tracking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /updateTracking/recent - Get recently updated records
router.get('/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const records = await DeviceDataHistory.find({})
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .select('_id materialId deviceId updatedAt archivedAt lastDataUpdate updateCount lastUpdateSource');
    
    const recentRecords = records.map(record => {
      const mostRecentUpdate = new Date(Math.max(
        new Date(record.updatedAt || 0),
        new Date(record.archivedAt || 0),
        new Date(record.lastDataUpdate || 0)
      ));
      
      const now = new Date();
      const timeDiff = now - mostRecentUpdate;
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      
      let timeSinceUpdate;
      if (minutesAgo < 1) {
        timeSinceUpdate = 'Just now';
      } else if (minutesAgo < 60) {
        timeSinceUpdate = `${minutesAgo} minutes ago`;
      } else {
        timeSinceUpdate = `${hoursAgo} hours ago`;
      }
      
      return {
        recordId: record._id,
        materialId: record.materialId || record.deviceId,
        mostRecentUpdate: mostRecentUpdate,
        timeSinceUpdate: timeSinceUpdate,
        updateCount: record.updateCount,
        lastUpdateSource: record.lastUpdateSource
      };
    });
    
    res.json({
      success: true,
      recentRecords: recentRecords
    });
    
  } catch (error) {
    console.error('Error getting recent records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent records',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
