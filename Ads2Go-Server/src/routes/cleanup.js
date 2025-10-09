const express = require('express');
const router = express.Router();
const dailyArchiveJobV2 = require('../jobs/dailyArchiveJobV2');
const cronJobs = require('../jobs/cronJobs');

// Basic cleanup routes placeholder
// Add your cleanup functionality here

router.get('/', (req, res) => {
  res.json({ message: 'Cleanup routes are working' });
});

// Route to clean invalid coordinates in archived data
router.post('/invalid-coordinates', async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of invalid coordinates via API...');
    const result = await cronJobs.triggerCleanupInvalidCoordinates();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      result: {
        totalCleaned: result.totalCleaned,
        documentsProcessed: result.documentsProcessed
      }
    });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

module.exports = router;

