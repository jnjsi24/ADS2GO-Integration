const cron = require('node-cron');
const dailyArchiveJobV2 = require('./dailyArchiveJobV2');
const hoursUpdateService = require('../services/hoursUpdateService');
const userAnalyticsSyncJob = require('./userAnalyticsSyncJob');

class CronJobs {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start all cron jobs
  start() {
    if (this.isRunning) {
      console.log('⚠️  Cron jobs are already running');
      return;
    }

    console.log('🚀 Starting cron jobs...');

    // Start the high-precision hours update service (30-second intervals)
    hoursUpdateService.start();

    // Start the user analytics sync job (every 10 minutes)
    userAnalyticsSyncJob.start();

    // Daily archive job - runs at 11:55 PM Philippines time (before reset)
    const dailyArchiveTask = cron.schedule('55 23 * * *', async () => {
      console.log('⏰ Daily archive job triggered at 11:55 PM (Philippines time)');
      try {
        // Use the new V2 archive job for array-based structure
        await dailyArchiveJobV2.archiveDailyData();
        console.log('✅ Daily archive job (V2) completed successfully');
      } catch (error) {
        console.error('❌ Daily archive job (V2) failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily reset job - runs at midnight Philippines time to reset DeviceTracking
    const dailyResetTask = cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Daily reset job triggered at midnight (Philippines time)');
      try {
        await this.resetAllDeviceTracking();
        console.log('✅ Daily reset job completed successfully');
      } catch (error) {
        console.error('❌ Daily reset job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('dailyReset', dailyResetTask);
    this.jobs.set('dailyArchive', dailyArchiveTask);

    // Hourly cleanup job - runs every hour to clean up old data
    const hourlyCleanupTask = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Hourly cleanup job triggered');
      try {
        await this.hourlyCleanup();
      } catch (error) {
        console.error('❌ Hourly cleanup job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('hourlyCleanup', hourlyCleanupTask);

    // Online hours update job - runs every 5 minutes (backup to high-precision service)
    const onlineHoursTask = cron.schedule('*/5 * * * *', async () => {
      console.log('⏰ Online hours update job triggered (every 5 minutes)');
      try {
        await this.updateOnlineHours();
        console.log('✅ Online hours update job completed successfully');
      } catch (error) {
        console.error('❌ Online hours update job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('onlineHours', onlineHoursTask);

    // Start all cron jobs
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started cron job: ${name}`);
    });

    this.isRunning = true;
    console.log('🎉 All cron jobs started successfully');
  }

  // Stop all cron jobs
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Cron jobs are not running');
      return;
    }

    console.log('🛑 Stopping cron jobs...');

    // Stop the hours update service
    hoursUpdateService.stop();

    // Stop the user analytics sync job
    userAnalyticsSyncJob.stop();

    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️  Stopped cron job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ All cron jobs stopped');
  }

  // Get job status
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: {},
      userAnalyticsSync: userAnalyticsSyncJob.getStatus()
    };

    this.jobs.forEach((job, name) => {
      status.jobs[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });

    return status;
  }

  // Manual trigger for daily archive
  async triggerDailyArchive() {
    console.log('🔄 Manual trigger for daily archive job');
    try {
      await dailyArchiveJobV2.archiveDailyData();
      console.log('✅ Manual daily archive (V2) completed');
    } catch (error) {
      console.error('❌ Manual daily archive (V2) failed:', error);
      throw error;
    }
  }

  // Manual trigger for specific date
  async triggerArchiveForDate(dateStr) {
    console.log(`🔄 Manual trigger for archive job - date: ${dateStr}`);
    try {
      await dailyArchiveJobV2.archiveDailyData();
      console.log(`✅ Manual archive (V2) completed for date: ${dateStr}`);
    } catch (error) {
      console.error(`❌ Manual archive (V2) failed for date ${dateStr}:`, error);
      throw error;
    }
  }

  // Manual trigger for daily reset
  async triggerDailyReset() {
    console.log('🔄 Manual trigger for daily reset job');
    try {
      await this.resetAllDeviceTracking();
      console.log('✅ Manual daily reset completed');
    } catch (error) {
      console.error('❌ Manual daily reset failed:', error);
      throw error;
    }
  }

  // Reset all DeviceTracking records for new day
  async resetAllDeviceTracking() {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      
      console.log('🔄 Starting daily reset of all DeviceTracking records...');
      
      // Get today's date in Philippines timezone
      const now = new Date();
      const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
      const year = philippinesTime.getFullYear();
      const month = String(philippinesTime.getMonth() + 1).padStart(2, '0');
      const day = String(philippinesTime.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      console.log(`📅 Resetting to date: ${todayStr}`);
      
      // Find all DeviceTracking records
      const devices = await DeviceTracking.find({});
      console.log(`📱 Found ${devices.length} DeviceTracking records to reset`);
      
      let resetCount = 0;
      
      for (const device of devices) {
        try {
          // Reset the daily session for the new day
          device.currentSession = {
            date: new Date(philippinesTime.getFullYear(), philippinesTime.getMonth(), philippinesTime.getDate()),
            startTime: new Date(),
            endTime: null,
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            isActive: true,
            targetHours: 8,
            complianceStatus: 'PENDING',
            locationHistory: []
          };
          
          // Reset daily counters
          device.totalAdPlays = 0;
          device.totalQRScans = 0;
          device.totalDistanceTraveled = 0;
          device.totalHoursOnline = 0;
          device.totalAdImpressions = 0;
          device.totalAdPlayTime = 0;
          
          // Clear daily data arrays
          device.adPlaybacks = [];
          device.qrScans = [];
          device.locationHistory = [];
          device.hourlyStats = [];
          device.adPerformance = [];
          device.qrScansByAd = [];
          
          // Reset current ad
          device.currentAd = null;
          
          // Reset compliance data
          device.complianceData = {
            offlineIncidents: 0,
            displayIssues: 0
          };
          
          // Update lastSeen to now
          device.lastSeen = new Date();
          
          // Update the date to today
          device.date = todayStr;
          
          // Save the updated record
          await device.save();
          resetCount++;
          
          console.log(`✅ Reset ${device.materialId}: ${device.totalAdPlays} plays, ${device.totalQRScans} QR scans`);
          
        } catch (error) {
          console.error(`❌ Error resetting device ${device.materialId}:`, error.message);
        }
      }
      
      console.log(`🎉 Daily reset completed: ${resetCount}/${devices.length} devices reset successfully`);
      
    } catch (error) {
      console.error('❌ Error in resetAllDeviceTracking:', error);
      throw error;
    }
  }

  // Hourly cleanup - remove old location history and optimize data
  async hourlyCleanup() {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      
      // Clean up location history (keep only last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const result = await DeviceTracking.updateMany(
        {},
        {
          $pull: {
            locationHistory: {
              timestamp: { $lt: oneDayAgo }
            }
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up location history for ${result.modifiedCount} devices`);
      }

      // Update hourly stats for current hour
      await this.updateCurrentHourStats();

    } catch (error) {
      console.error('❌ Hourly cleanup failed:', error);
    }
  }

  // Update current hour stats
  async updateCurrentHourStats() {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();

      // Get all devices for today
      const devices = await DeviceTracking.find({ date: today });

      for (const device of devices) {
        // Update online time for current hour
        if (device.isOnline) {
          await device.updateHourlyStats('onlineMinutes', 1);
        }
      }

    } catch (error) {
      console.error('❌ Error updating current hour stats:', error);
    }
  }

  // Update online hours for all active devices
  async updateOnlineHours() {
    try {
      const DeviceTracking = require('../models/deviceTracking');
      const today = new Date().toISOString().split('T')[0];

      console.log('🕐 [CRON] Updating online hours for all devices...');

      // Get all devices for today that are online
      const devices = await DeviceTracking.find({ 
        date: today,
        isOnline: true 
      });

      console.log(`📊 Found ${devices.length} online devices to update`);

      for (const device of devices) {
        try {
          // Calculate and update online hours
          await device.calculateAndUpdateOnlineHours();
          await device.save();
          
          console.log(`✅ Updated online hours for ${device.deviceId}: ${device.totalHoursOnline} hours`);
        } catch (deviceError) {
          console.error(`❌ Error updating device ${device.deviceId}:`, deviceError.message);
        }
      }

      console.log('✅ Online hours update completed');

    } catch (error) {
      console.error('❌ Error updating online hours:', error);
    }
  }

  // Get archive status
  async getArchiveStatus() {
    return await dailyArchiveJobV2.getArchiveStatus();
  }
}

// Create singleton instance
const cronJobs = new CronJobs();

module.exports = cronJobs;
