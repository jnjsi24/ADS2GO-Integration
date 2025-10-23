const cron = require('node-cron');
const dailyArchiveJobV2 = require('./dailyArchiveJobV2');
const hoursUpdateService = require('../services/hoursUpdateService');
const userAnalyticsSyncJob = require('./userAnalyticsSyncJob');
const driverSalaryJob = require('./driverSalaryJob');
const deviceHoursNotificationService = require('../services/deviceHoursNotificationService');
const adSchedulingJob = require('./adSchedulingJob');
const logger = require('../utils/logger');

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

    // Start the user analytics sync job (every 3 minutes)
    userAnalyticsSyncJob.start();

    // Start the driver salary job (monthly generation and daily updates)
    driverSalaryJob.start();

    // Start the ad scheduling job (hourly checks for scheduled ads and expired reservations)
    adSchedulingJob.start();

    // Frequent archive job - runs every 3 minutes to capture real-time updates
    const frequentArchiveTask = cron.schedule('*/3 * * * *', async () => {
      logger.database('⏰ Frequent archive job triggered (every 3 minutes)');
      try {
        await dailyArchiveJobV2.archiveDailyData();
        logger.database('✅ Frequent archive job completed successfully');
      } catch (error) {
        console.error('❌ Frequent archive job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Hourly archive job - runs every hour to capture real-time updates
    const hourlyArchiveTask = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Hourly archive job triggered');
      try {
        await dailyArchiveJobV2.archiveDailyData();
        logger.database('✅ Hourly archive job completed successfully');
      } catch (error) {
        console.error('❌ Hourly archive job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily archive job - runs at 11:55 PM Philippines time (archives previous day)
    const dailyArchiveTask = cron.schedule('55 23 * * *', async () => {
      console.log('⏰ Daily archive job triggered at 11:55 PM (Philippines time)');
      try {
        // Archive the current day's data before reset
        await dailyArchiveJobV2.archiveDailyData();
        logger.database('✅ Daily archive job (V2) completed successfully');
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
        // Reset daily notification tracking
        deviceHoursNotificationService.resetDailyTracking();
        console.log('✅ Daily reset job completed successfully');
      } catch (error) {
        console.error('❌ Daily reset job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily fresh data archive job - runs at 12:05 AM to archive fresh reset data
    const dailyFreshArchiveTask = cron.schedule('5 0 * * *', async () => {
      console.log('⏰ Daily fresh data archive job triggered at 12:05 AM (Philippines time)');
      try {
        // Archive the fresh reset data for the new day
        await dailyArchiveJobV2.archiveDailyData();
        logger.database('✅ Daily fresh data archive job completed successfully');
      } catch (error) {
        console.error('❌ Daily fresh data archive job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily job to create missing DeviceTracking records - runs every day at 2 AM
    const createMissingDeviceTrackingTask = cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Daily missing DeviceTracking creation job triggered');
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        await execAsync('node scripts/create-missing-device-tracking.js');
        console.log('✅ Missing DeviceTracking creation job completed');
      } catch (error) {
        console.error('❌ Error in missing DeviceTracking creation job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('frequentArchive', frequentArchiveTask);
    this.jobs.set('hourlyArchive', hourlyArchiveTask);
    this.jobs.set('dailyReset', dailyResetTask);
    this.jobs.set('dailyArchive', dailyArchiveTask);
    this.jobs.set('dailyFreshArchive', dailyFreshArchiveTask);
    this.jobs.set('createMissingDeviceTracking', createMissingDeviceTrackingTask);

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

    // Online hours update job - runs every 10 seconds for real-time tracking
    const onlineHoursTask = cron.schedule('*/10 * * * * *', async () => {
      try {
        await this.updateOnlineHours();
        // Reduced logging frequency for performance
      } catch (error) {
        console.error('❌ Online hours update job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // 8-hour milestone check job - runs every 30 minutes to check for 8-hour achievements
    const eightHourCheckTask = cron.schedule('*/30 * * * *', async () => {
      console.log('🎯 8-hour milestone check job triggered');
      try {
        await deviceHoursNotificationService.checkAllDevicesFor8HourMilestone();
        console.log('✅ 8-hour milestone check completed');
      } catch (error) {
        console.error('❌ 8-hour milestone check job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('onlineHours', onlineHoursTask);
    this.jobs.set('eightHourCheck', eightHourCheckTask);

    // Daily driver compliance reminder - runs every day at 10:00 AM PH time
    const complianceReminderTask = cron.schedule('0 10 * * *', async () => {
      try {
        const DeviceCompliance = require('../models/deviceCompliance');
        const Driver = require('../models/Driver');
        const DriverNotificationService = require('../services/notifications/DriverNotificationService');
        const now = new Date();
        const phNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const tomorrow = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate() + 1);
        const dayAfter = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate() + 2);

        // Find materials whose nextInspectionDue is tomorrow (within [tomorrow, dayAfter))
        const dueSoon = await DeviceCompliance.find({
          nextInspectionDue: { $gte: tomorrow, $lt: dayAfter }
        }).lean();

        for (const dc of dueSoon) {
          // dc.driverId may be ObjectId or null; look up by material to find current driver if needed
          let driver = null;
          if (dc.driverId) {
            driver = await Driver.findById(dc.driverId);
          } else {
            const Material = require('../models/Material');
            const mat = await Material.findById(dc.materialId);
            if (mat?.driverId) driver = await Driver.findOne({ driverId: mat.driverId });
          }
          if (!driver) continue;

          try {
            await DriverNotificationService.sendGenericNotification(
              driver._id,
              'Monthly Photo Due Tomorrow',
              'Your monthly inspection photo is due tomorrow. Please prepare to upload your compliance photo.',
              { type: 'COMPLIANCE_DUE_SOON', materialId: String(dc.materialId), nextInspectionDue: dc.nextInspectionDue }
            );
          } catch (notifyErr) {
            console.error('❌ Error sending driver compliance reminder:', notifyErr);
          }
        }
      } catch (error) {
        console.error('❌ Compliance reminder job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('complianceReminder', complianceReminderTask);

    // Start all cron jobs
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started cron job: ${name}`);
    });

    // Start the hours update service
    hoursUpdateService.start();
    console.log('✅ Started hours update service');

    // Start the driver salary job
    driverSalaryJob.start();
    console.log('✅ Started driver salary job');

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

    // Stop the ad scheduling job
    adSchedulingJob.stop();

    // Stop the driver salary job
    driverSalaryJob.stop();

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
      logger.database(`📱 Found ${devices.length} DeviceTracking records to reset`);
      
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

      // Get all devices for today that are online
      const devices = await DeviceTracking.find({ 
        date: today,
        isOnline: true 
      });

      // Only log if there are devices to update (reduces noise)
      if (devices.length > 0) {
        // Only log every 2 minutes to reduce console spam
        const now = new Date();
        if (now.getSeconds() < 10) { // Only log when seconds < 10 (roughly every 2 minutes)
          console.log(`🕐 [CRON] Updating online hours for ${devices.length} online devices`);
        }
      }

      for (const device of devices) {
        try {
          // Calculate and update online hours
          await device.calculateAndUpdateOnlineHours();
          await device.save();
          
          // Only log significant updates (every 30 minutes or more)
          const hours = device.totalHoursOnline;
          if (hours > 0 && Math.floor(hours * 2) % 2 === 0 && hours >= 0.5) { // Every 30 minutes
            console.log(`✅ Updated online hours for ${device.materialId}: ${hours.toFixed(2)} hours`);
          }
        } catch (deviceError) {
          console.error(`❌ Error updating device ${device.materialId}:`, deviceError.message);
        }
      }

    } catch (error) {
      console.error('❌ Error updating online hours:', error);
    }
  }

  // Manual trigger for cleanup of invalid coordinates
  async triggerCleanupInvalidCoordinates() {
    console.log('🧹 Manual trigger for cleanup of invalid coordinates');
    try {
      const result = await dailyArchiveJobV2.cleanExistingArchivedData();
      console.log('✅ Manual cleanup of invalid coordinates completed');
      console.log(`📊 Results: ${result.totalCleaned} QR scans cleaned across ${result.documentsProcessed} documents`);
      return result;
    } catch (error) {
      console.error('❌ Manual cleanup of invalid coordinates failed:', error);
      throw error;
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
