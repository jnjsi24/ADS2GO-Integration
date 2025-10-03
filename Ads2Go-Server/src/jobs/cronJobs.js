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

    // Daily archive job - runs every 5 minutes for testing (normally at midnight)
    const dailyArchiveTask = cron.schedule('*/5 * * * *', async () => {
      console.log('⏰ Daily archive job triggered (TESTING: every 5 minutes)');
      try {
        // Use the new V2 archive job for array-based structure
        await dailyArchiveJobV2.archiveDailyData();
        console.log('✅ Daily archive job (V2) completed successfully');
      } catch (error) {
        console.error('❌ Daily archive job (V2) failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

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
