const cron = require('node-cron');
const dailyArchiveJobV2 = require('./dailyArchiveJobV2');
const hoursUpdateService = require('../services/hoursUpdateService');
const userAnalyticsSyncJob = require('./userAnalyticsSyncJob');
const driverSalaryJob = require('./driverSalaryJob');
const deviceHoursNotificationService = require('../services/deviceHoursNotificationService');
const adSchedulingJob = require('./adSchedulingJob');
const userDeletionJob = require('./userDeletionJob');
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

    this.jobs.set('frequentArchive', frequentArchiveTask);
    this.jobs.set('hourlyArchive', hourlyArchiveTask);
    this.jobs.set('dailyReset', dailyResetTask);
    this.jobs.set('dailyArchive', dailyArchiveTask);
    this.jobs.set('dailyFreshArchive', dailyFreshArchiveTask);

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

    // Daily compliance missed check - runs every day at 11:00 PM PH time to check for devices that didn't reach 8 hours
    const dailyComplianceCheckTask = cron.schedule('0 23 * * *', async () => {
      console.log('⚠️ Daily compliance missed check job triggered');
      try {
        await deviceHoursNotificationService.checkAllDevicesForMissedCompliance();
        console.log('✅ Daily compliance missed check completed');
      } catch (error) {
        console.error('❌ Daily compliance missed check job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('onlineHours', onlineHoursTask);
    this.jobs.set('eightHourCheck', eightHourCheckTask);
    this.jobs.set('dailyComplianceCheck', dailyComplianceCheckTask);

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

    // Daily user deletion job - runs at 2:00 AM PH time to permanently delete archived users
    const userDeletionTask = cron.schedule('0 2 * * *', async () => {
      console.log('🗑️ User deletion job triggered at 2:00 AM (Philippines time)');
      try {
        const result = await userDeletionJob.deleteExpiredUsers();
        console.log(`✅ User deletion job completed: ${result.deletedCount} users permanently deleted`);
      } catch (error) {
        console.error('❌ User deletion job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily ad deletion job - runs at 2:15 AM PH time to permanently delete archived ads
    const adDeletionTask = cron.schedule('15 2 * * *', async () => {
      console.log('🗑️ Ad deletion job triggered at 2:15 AM (Philippines time)');
      try {
        const result = await userDeletionJob.deleteExpiredAds();
        console.log(`✅ Ad deletion job completed: ${result.deletedCount} ads permanently deleted`);
      } catch (error) {
        console.error('❌ Ad deletion job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    // Daily driver deletion job - runs at 2:30 AM PH time to permanently delete archived drivers
    const driverDeletionTask = cron.schedule('30 2 * * *', async () => {
      console.log('🗑️ Driver deletion job triggered at 2:30 AM (Philippines time)');
      try {
        const result = await userDeletionJob.deleteExpiredDrivers();
        console.log(`✅ Driver deletion job completed: ${result.deletedCount} drivers permanently deleted`);
      } catch (error) {
        console.error('❌ Driver deletion job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    this.jobs.set('userDeletion', userDeletionTask);
    this.jobs.set('adDeletion', adDeletionTask);
    this.jobs.set('driverDeletion', driverDeletionTask);

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
      const { getUTCMidnight, formatDateString } = require('../utils/dateUtils');
      
      console.log('🔄 Starting daily reset of all DeviceTracking records...');
      
      // ✅ FIX: Use standardized UTC midnight Date format
      const todayUTC = getUTCMidnight();
      const todayStr = formatDateString(todayUTC);
      
      console.log(`📅 Resetting to date: ${todayStr} (UTC: ${todayUTC.toISOString()})`);
      
      // ✅ FIX: Add simple lock mechanism to prevent concurrent resets
      if (this._isResetting) {
        console.log('⚠️ Reset already in progress, skipping...');
        return;
      }
      this._isResetting = true;
      
      try {
        // Find all DeviceTracking records
        const devices = await DeviceTracking.find({});
        logger.database(`📱 Found ${devices.length} DeviceTracking records to reset`);
        
        let resetCount = 0;
        
        for (const device of devices) {
          try {
            // ✅ Preserve completedAt from yesterday for 8 AM lock enforcement
            const previousCompletedAt = device.currentSession?.completedAt;
            
            // Reset the daily session for the new day
            // ✅ FIX: Set startTime far in future as sentinel - will be updated when device actually comes online
            // This prevents counting hours from midnight for offline devices
            const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value
            device.currentSession = {
              date: todayUTC,  // ✅ FIX: Standardized UTC midnight Date (not local PH date)
              startTime: farFuture, // ✅ Sentinel: will be set to actual time when device comes online
              endTime: null,
              completedAt: previousCompletedAt, // ✅ Preserve for 8 AM lock (12 AM - 7:59 AM)
              totalHoursOnline: 0,
              totalDistanceTraveled: 0,
              isActive: true,
              targetHours: 8,
              complianceStatus: 'PENDING',
              locationHistory: []
            };
            
            // ✅ FIX: Set all devices to offline at midnight - they'll report online when they connect
            device.isOnline = false;
            if (device.slots && device.slots.length > 0) {
              device.slots.forEach(slot => {
                slot.isOnline = false;
              });
            }
            
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
            
            // ✅ DON'T reset lastSeen - preserve actual last online time for admin tracking
            // lastSeen will only update when device is actually online and sending data
            
            // ✅ FIX: Use standardized UTC midnight Date (not string)
            device.date = todayUTC;
            
            // Save the updated record
            await device.save();
            resetCount++;
            
            console.log(`✅ Reset ${device.materialId}: ${device.totalAdPlays} plays, ${device.totalQRScans} QR scans`);
            
          } catch (error) {
            console.error(`❌ Error resetting device ${device.materialId}:`, error.message);
            }
        }
        
        console.log(`🎉 Daily reset completed: ${resetCount}/${devices.length} devices reset successfully`);
      } finally {
        // ✅ FIX: Release lock
        this._isResetting = false;
      }
      
    } catch (error) {
      console.error('❌ Error in resetAllDeviceTracking:', error);
      this._isResetting = false; // Release lock on error
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

  // Manual trigger for user deletion job
  async triggerUserDeletion() {
    console.log('🔄 Manual trigger for user deletion job');
    try {
      const result = await userDeletionJob.deleteExpiredUsers();
      console.log('✅ Manual user deletion completed');
      return result;
    } catch (error) {
      console.error('❌ Manual user deletion failed:', error);
      throw error;
    }
  }

  // Get archived users statistics
  async getArchivedUsersStats() {
    return await userDeletionJob.getArchivedUsersStats();
  }

  // Restore an archived user (cancel deletion)
  async restoreArchivedUser(userId) {
    return await userDeletionJob.restoreUser(userId);
  }

  // Manually trigger ad deletion (for testing or admin purposes)
  async triggerAdDeletion() {
    console.log('🔄 Manual trigger for ad deletion job');
    try {
      const result = await userDeletionJob.deleteExpiredAds();
      console.log('✅ Manual ad deletion completed');
      return result;
    } catch (error) {
      console.error('❌ Manual ad deletion failed:', error);
      throw error;
    }
  }

  // Manually trigger driver deletion (for testing or admin purposes)
  async triggerDriverDeletion() {
    console.log('🔄 Manual trigger for driver deletion job');
    try {
      const result = await userDeletionJob.deleteExpiredDrivers();
      console.log('✅ Manual driver deletion completed');
      return result;
    } catch (error) {
      console.error('❌ Manual driver deletion failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const cronJobs = new CronJobs();

module.exports = cronJobs;
