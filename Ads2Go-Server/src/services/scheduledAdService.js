const CompanyAd = require('../models/CompanyAd');
const cron = require('node-cron');
const logger = require('../utils/logger');

class ScheduledAdService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Check and update scheduled ads based on current time
   */
  async checkScheduledAds() {
    try {
      logger.database('📅 [ScheduledAdService] Checking scheduled ads...');
      
      const now = new Date();
      const scheduledAds = await CompanyAd.find({ 
        isScheduled: true,
        scheduleType: 'SCHEDULED'
      });

      let activatedCount = 0;
      let deactivatedCount = 0;

      for (const ad of scheduledAds) {
        const shouldBeActive = this.shouldAdBeActive(ad, now);
        const isCurrentlyActive = ad.isActive;

        if (shouldBeActive && !isCurrentlyActive) {
          // Activate the ad
          ad.isActive = true;
          await ad.save();
          activatedCount++;
          console.log(`✅ [ScheduledAdService] Activated scheduled ad: "${ad.title}" (${ad.scheduleType})`);
        } else if (!shouldBeActive && isCurrentlyActive) {
          // Deactivate the ad
          ad.isActive = false;
          await ad.save();
          deactivatedCount++;
          console.log(`❌ [ScheduledAdService] Deactivated scheduled ad: "${ad.title}" (${ad.scheduleType})`);
        }
      }

      if (activatedCount > 0 || deactivatedCount > 0) {
        logger.database(`📊 [ScheduledAdService] Updated ${activatedCount} activated, ${deactivatedCount} deactivated ads`);
      } else {
        logger.database('📅 [ScheduledAdService] No scheduled ads needed updates');
      }

    } catch (error) {
      console.error('❌ [ScheduledAdService] Error checking scheduled ads:', error);
    }
  }

  /**
   * Check if an ad should be active based on scheduling
   */
  shouldAdBeActive(ad, now = new Date()) {
    // If not scheduled, use the isActive field
    if (!ad.isScheduled || ad.scheduleType === 'IMMEDIATE') {
      return ad.isActive;
    }
    
    // For scheduled ads, check date ranges
    if (ad.scheduleType === 'SCHEDULED') {
      const startDate = ad.startDate ? new Date(ad.startDate) : null;
      const endDate = ad.endDate ? new Date(ad.endDate) : null;
      
      // If no dates set, use isActive
      if (!startDate && !endDate) {
        return ad.isActive;
      }
      
      // Check if current time is within the scheduled range
      const isAfterStart = !startDate || now >= startDate;
      const isBeforeEnd = !endDate || now <= endDate;
      
      return isAfterStart && isBeforeEnd;
    }
    
    
    return ad.isActive;
  }

  /**
   * Start the scheduled ad monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ [ScheduledAdService] Service is already running');
      return;
    }

    console.log('🚀 [ScheduledAdService] Starting scheduled ad monitoring...');
    
    // Run every minute to check for scheduled ads
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkScheduledAds();
    });

    // Also run immediately on startup
    this.checkScheduledAds();

    this.isRunning = true;
    console.log('✅ [ScheduledAdService] Scheduled ad monitoring started (runs every minute)');
  }

  /**
   * Stop the scheduled ad monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ [ScheduledAdService] Service is not running');
      return;
    }

    if (this.cronJob) {
      this.cronJob.destroy();
    }

    this.isRunning = false;
    console.log('🛑 [ScheduledAdService] Scheduled ad monitoring stopped');
  }

  /**
   * Get status of the service
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const scheduledAdService = new ScheduledAdService();

module.exports = scheduledAdService;
