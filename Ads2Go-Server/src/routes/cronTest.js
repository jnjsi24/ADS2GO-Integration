const express = require('express');
const router = express.Router();
const cronJobs = require('../jobs/cronJobs');

// Test endpoint to manually trigger cron jobs
router.post('/trigger-online-hours', async (req, res) => {
  try {
    console.log('🧪 Manual trigger for online hours update');
    await cronJobs.updateOnlineHours();
    res.json({
      success: true,
      message: 'Online hours update triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual online hours update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger online hours update',
      error: error.message
    });
  }
});

// Test endpoint to manually trigger daily archive
router.post('/trigger-daily-archive', async (req, res) => {
  try {
    console.log('🧪 Manual trigger for daily archive');
    await cronJobs.triggerDailyArchive();
    res.json({
      success: true,
      message: 'Daily archive triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual daily archive failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger daily archive',
      error: error.message
    });
  }
});

// Test endpoint to manually trigger cleanup of invalid coordinates
router.post('/trigger-cleanup-invalid-coordinates', async (req, res) => {
  try {
    console.log('🧪 Manual trigger for cleanup of invalid coordinates');
    const result = await cronJobs.triggerCleanupInvalidCoordinates();
    res.json({
      success: true,
      message: 'Cleanup of invalid coordinates triggered successfully',
      result: {
        totalCleaned: result.totalCleaned,
        documentsProcessed: result.documentsProcessed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual cleanup of invalid coordinates failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger cleanup of invalid coordinates',
      error: error.message
    });
  }
});

// Get cron job status
router.get('/status', (req, res) => {
  try {
    const status = cronJobs.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to get cron status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cron status',
      error: error.message
    });
  }
});

// Test endpoint to trigger all cron jobs
router.post('/trigger-all', async (req, res) => {
  try {
    console.log('🧪 Manual trigger for all cron jobs');
    
    const results = {
      onlineHours: null,
      dailyArchive: null,
      timestamp: new Date().toISOString()
    };

    // Trigger online hours update
    try {
      await cronJobs.updateOnlineHours();
      results.onlineHours = { success: true, message: 'Online hours updated' };
    } catch (error) {
      results.onlineHours = { success: false, error: error.message };
    }

    // Trigger daily archive
    try {
      await cronJobs.triggerDailyArchive();
      results.dailyArchive = { success: true, message: 'Daily archive completed' };
    } catch (error) {
      results.dailyArchive = { success: false, error: error.message };
    }

    res.json({
      success: true,
      message: 'All cron jobs triggered',
      results: results
    });
  } catch (error) {
    console.error('❌ Manual trigger all failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger all cron jobs',
      error: error.message
    });
  }
});

module.exports = router;
