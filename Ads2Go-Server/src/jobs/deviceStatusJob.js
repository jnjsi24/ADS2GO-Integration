const cron = require('node-cron');
const ScreenTracking = require('../models/screenTracking');

// Run every 30 seconds to check for offline devices (much faster for real-time updates)
const checkDeviceStatus = cron.schedule('*/30 * * * * *', async () => {
  try {
    console.log('Running device status check...');
    const result = await ScreenTracking.updateOfflineStatus();
    console.log(`Updated ${result.modifiedCount} devices to offline status`);
  } catch (error) {
    console.error('Error in device status check:', error);
  }
});

// Start the job when the server starts
const startDeviceStatusJob = () => {
  checkDeviceStatus.start();
  console.log('Device status monitoring job started');
};

module.exports = {
  startDeviceStatusJob
};
