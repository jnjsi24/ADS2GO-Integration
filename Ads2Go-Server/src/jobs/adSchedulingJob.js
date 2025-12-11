const cron = require('node-cron');
const Ad = require('../models/Ad');
const MaterialAvailability = require('../models/MaterialAvailability');
const BaseNotificationService = require('../services/notifications/BaseNotificationService');
const logger = require('../utils/logger');

/**
 * ✅ NEW: Cron job to manage ad scheduling and slot reservations
 * 
 * This job runs every hour and handles:
 * 1. Release expired slot reservations (unpaid ads after 7 days)
 * 2. Start SCHEDULED ads when their start time arrives
 * 3. End RUNNING ads when their end time passes
 * 4. Move scheduled ads to current ads in MaterialAvailability
 */

class AdSchedulingJob {
  constructor() {
    this.isRunning = false;
    this.job = null;
  }

  /**
   * ✅ NEW: Send reminder notifications for reservations expiring soon (2 days before)
   */
  async sendExpirationReminders() {
    try {
      logger.database('⏰ [AdSchedulingJob] Checking for reservations expiring soon...');
      
      const now = new Date();
      const twoDaysFromNow = new Date(now);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      
      // Find ads with reservations expiring in ~2 days (within 2-3 days range to catch them once)
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const expiringAds = await Ad.find({
        status: { $in: ['PENDING', 'APPROVED'] },
        paymentStatus: { $ne: 'PAID' },
        reservationExpires: { 
          $gte: twoDaysFromNow,
          $lt: threeDaysFromNow
        }
      }).populate('userId', 'firstName lastName email');
      
      logger.database(`📊 [AdSchedulingJob] Found ${expiringAds.length} ads with reservations expiring in 2 days`);
      
      let remindersSent = 0;
      
      for (const ad of expiringAds) {
        try {
          if (!ad.userId) {
            console.warn(`⚠️ Ad ${ad._id} has no userId, skipping notification`);
            continue;
          }
          
          const daysRemaining = Math.ceil((new Date(ad.reservationExpires) - now) / (1000 * 60 * 60 * 24));
          const expirationDate = new Date(ad.reservationExpires).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Send in-app notification
          await BaseNotificationService.createNotification(
            ad.userId._id,
            '⏰ Payment Reminder: Ad Slot Reservation Expiring Soon',
            `Your ad "${ad.title}" has a reserved slot that expires in ${daysRemaining} days (${expirationDate}). Complete payment to secure your slot.`,
            'WARNING',
            {
              category: 'AD_RESERVATION_EXPIRING',
              priority: 'HIGH',
              adId: ad._id,
              adTitle: ad.title,
              data: {
                expirationDate: ad.reservationExpires,
                daysRemaining,
                adId: ad._id.toString(),
                action: 'PAYMENT_REQUIRED'
              }
            }
          );
          
          remindersSent++;
          console.log(`⏰ Sent expiration reminder for ad ${ad._id} (${ad.title}) to user ${ad.userId.email}`);
          
        } catch (error) {
          console.error(`❌ Error sending reminder for ad ${ad._id}:`, error);
        }
      }
      
      if (remindersSent > 0) {
        logger.database(`✅ [AdSchedulingJob] Sent ${remindersSent} expiration reminders`);
      } else {
        logger.database('✅ [AdSchedulingJob] No expiration reminders to send');
      }
      
      return remindersSent;
    } catch (error) {
      console.error('❌ [AdSchedulingJob] Error sending expiration reminders:', error);
      return 0;
    }
  }

  /**
   * Release expired slot reservations
   */
  async releaseExpiredReservations() {
    try {
      logger.database('🧹 [AdSchedulingJob] Checking for expired slot reservations...');
      
      const now = new Date();
      
      // Find ads with expired reservations that haven't been paid
      const expiredAds = await Ad.find({
        status: { $in: ['PENDING', 'APPROVED'] },
        paymentStatus: { $ne: 'PAID' },
        reservationExpires: { $lt: now }
      }).populate('userId', 'firstName lastName email');
      
      logger.database(`📊 [AdSchedulingJob] Found ${expiredAds.length} ads with expired reservations`);
      
      let releasedCount = 0;
      
      for (const ad of expiredAds) {
        try {
          // Release slots from all materials
          const materialIds = Array.isArray(ad.materialId) ? ad.materialId : (ad.materialId ? [ad.materialId] : []);
          const targetDeviceIds = ad.targetDevices || materialIds;
          
          for (const materialId of targetDeviceIds) {
            const availability = await MaterialAvailability.findOne({ materialId });
            
            if (availability) {
              // Remove from scheduledAds
              const beforeCount = availability.scheduledAds.length;
              availability.scheduledAds = availability.scheduledAds.filter(
                slot => slot.adId.toString() !== ad._id.toString()
              );
              
              if (availability.scheduledAds.length < beforeCount) {
                await availability.save();
                console.log(`🧹 Released slot reservation for ad ${ad._id} from material ${materialId}`);
              }
            }
          }
          
          // Cancel the ad
          ad.status = 'CANCELLED';
          ad.reasonForReject = 'Slot reservation expired - Payment not received within 7 days';
          await ad.save();
          
          // ✅ Send notification to user
          if (ad.userId) {
            try {
              await BaseNotificationService.createNotification(
                ad.userId._id,
                '❌ Ad Slot Reservation Expired',
                `Your ad "${ad.title}" slot reservation has expired due to incomplete payment. You can create a new ad to reserve another slot.`,
                'ERROR',
                {
                  category: 'AD_RESERVATION_EXPIRED',
                  priority: 'MEDIUM',
                  adId: ad._id,
                  adTitle: ad.title,
                  data: {
                    expirationDate: ad.reservationExpires,
                    adId: ad._id.toString(),
                    action: 'CREATE_NEW_AD'
                  }
                }
              );
              console.log(`📧 Sent expiration notification for ad ${ad._id} to user ${ad.userId.email}`);
            } catch (notifError) {
              console.error(`❌ Error sending expiration notification for ad ${ad._id}:`, notifError);
            }
          }
          
          releasedCount++;
          console.log(`❌ Cancelled ad ${ad._id} (${ad.title}) - Reservation expired`);
          
        } catch (error) {
          console.error(`❌ Error releasing reservation for ad ${ad._id}:`, error);
        }
      }
      
      if (releasedCount > 0) {
        logger.database(`✅ [AdSchedulingJob] Released ${releasedCount} expired reservations`);
      } else {
        logger.database('✅ [AdSchedulingJob] No expired reservations to release');
      }
      
      return releasedCount;
    } catch (error) {
      console.error('❌ [AdSchedulingJob] Error releasing expired reservations:', error);
      return 0;
    }
  }

  /**
   * Start scheduled ads when their start time arrives
   */
  async startScheduledAds() {
    try {
      logger.database('▶️  [AdSchedulingJob] Checking for scheduled ads to start...');
      
      const now = new Date();
      
      // Find SCHEDULED ads whose start time has arrived
      const adsToStart = await Ad.find({
        status: 'SCHEDULED',
        paymentStatus: 'PAID',
        startTime: { $lte: now }
      }).populate('userId', 'firstName lastName email');
      
      logger.database(`📊 [AdSchedulingJob] Found ${adsToStart.length} ads ready to start`);
      
      let startedCount = 0;
      
      for (const ad of adsToStart) {
        try {
          // Update ad status to RUNNING
          ad.status = 'RUNNING';
          await ad.save();
          
          // Move from scheduledAds to currentAds in MaterialAvailability
          const materialIds = Array.isArray(ad.materialId) ? ad.materialId : (ad.materialId ? [ad.materialId] : []);
          const targetDeviceIds = ad.targetDevices || materialIds;
          
          for (const materialId of targetDeviceIds) {
            const availability = await MaterialAvailability.findOne({ materialId });
            
            if (availability) {
              // Use the activateScheduledAds method
              await availability.activateScheduledAds();
              await availability.save();
            }
            
            // ✅ NEW: Also update AdsDeployment.lcdSlots[].status to RUNNING
            const AdsDeployment = require('../models/adsDeployment');
            const deployment = await AdsDeployment.findOne({ materialId });
            
            if (deployment) {
              // Find the slot for this ad and update status to RUNNING
              const slot = deployment.lcdSlots.find(s => s.adId.toString() === ad._id.toString());
              if (slot && slot.status === 'SCHEDULED') {
                slot.status = 'RUNNING';
                slot.deployedAt = new Date();
                await deployment.save();
                console.log(`✅ Updated AdsDeployment slot status to RUNNING for ad ${ad._id} on material ${materialId}`);
              }
            }
          }
          
          // ✅ Send notification to user (includes email)
          if (ad.userId) {
            try {
              const NotificationService = require('../services/notifications/NotificationService');
              await NotificationService.sendAdDeployedNotification(ad._id);
              console.log(`📧 Sent ad deployed notification (with email) for ad ${ad._id} to user ${ad.userId.email}`);
            } catch (notifError) {
              console.error(`❌ Error sending ad deployed notification for ad ${ad._id}:`, notifError);
            }
          }
          
          // ✅ Send notification to admins about campaign started
          try {
            const NotificationService = require('../services/notifications/NotificationService');
            await NotificationService.sendAdCampaignStartedNotification(ad._id);
            console.log(`📧 Sent campaign started notification to admins for ad ${ad._id}`);
          } catch (notifError) {
            console.error(`❌ Error sending campaign started notification to admins for ad ${ad._id}:`, notifError);
          }
          
          startedCount++;
          console.log(`▶️  Started ad ${ad._id} (${ad.title}) - Status: RUNNING`);
          
        } catch (error) {
          console.error(`❌ Error starting ad ${ad._id}:`, error);
        }
      }
      
      if (startedCount > 0) {
        logger.database(`✅ [AdSchedulingJob] Started ${startedCount} scheduled ads`);
      } else {
        logger.database('✅ [AdSchedulingJob] No ads to start');
      }
      
      return startedCount;
    } catch (error) {
      console.error('❌ [AdSchedulingJob] Error starting scheduled ads:', error);
      return 0;
    }
  }

  /**
   * End running ads when their end time passes
   */
  async endExpiredAds() {
    try {
      logger.database('⏹️  [AdSchedulingJob] Checking for expired ads to end...');
      
      const now = new Date();
      
      // Find RUNNING ads that have passed their end time
      const adsToEnd = await Ad.find({
        status: 'RUNNING',
        endTime: { $lt: now }
      });
      
      logger.database(`📊 [AdSchedulingJob] Found ${adsToEnd.length} ads to end`);
      
      let endedCount = 0;
      
      for (const ad of adsToEnd) {
        try {
          // Update ad status to ENDED
          ad.status = 'ENDED';
          ad.adStatus = 'FINISHED';
          await ad.save();
          
          // Remove from currentAds in MaterialAvailability
          const materialIds = Array.isArray(ad.materialId) ? ad.materialId : (ad.materialId ? [ad.materialId] : []);
          const targetDeviceIds = ad.targetDevices || materialIds;
          
          for (const materialId of targetDeviceIds) {
            const availability = await MaterialAvailability.findOne({ materialId });
            
            if (availability) {
              availability.removeAd(ad._id);
              await availability.save();
              console.log(`🧹 Removed ended ad ${ad._id} from material ${materialId} (MaterialAvailability)`);
            }
            
            // ✅ NEW: Also update AdsDeployment.lcdSlots[].status to COMPLETED
            const AdsDeployment = require('../models/adsDeployment');
            const deployment = await AdsDeployment.findOne({ materialId });
            
            if (deployment) {
              // Find the slot for this ad and update status to COMPLETED
              const slot = deployment.lcdSlots.find(s => s.adId.toString() === ad._id.toString());
              if (slot && slot.status === 'RUNNING') {
                slot.status = 'COMPLETED';
                slot.completedAt = new Date();
                await deployment.save();
                console.log(`✅ Updated AdsDeployment slot status to COMPLETED for ad ${ad._id} on material ${materialId}`);
              }
            }
          }
          
          endedCount++;
          console.log(`⏹️  Ended ad ${ad._id} (${ad.title}) - Status: ENDED`);
          
          // ✅ Send notification to admins about campaign ended
          try {
            const NotificationService = require('../services/notifications/NotificationService');
            await NotificationService.sendAdCampaignEndedNotification(ad._id);
            console.log(`📧 Sent campaign ended notification to admins for ad ${ad._id}`);
          } catch (notifError) {
            console.error(`❌ Error sending campaign ended notification to admins for ad ${ad._id}:`, notifError);
          }
          
        } catch (error) {
          console.error(`❌ Error ending ad ${ad._id}:`, error);
        }
      }
      
      if (endedCount > 0) {
        logger.database(`✅ [AdSchedulingJob] Ended ${endedCount} expired ads`);
      } else {
        logger.database('✅ [AdSchedulingJob] No ads to end');
      }
      
      return endedCount;
    } catch (error) {
      console.error('❌ [AdSchedulingJob] Error ending expired ads:', error);
      return 0;
    }
  }

  /**
   * Main job execution
   */
  async execute() {
    if (this.isRunning) {
      console.log('⚠️  [AdSchedulingJob] Job is already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      logger.database('⏰ [AdSchedulingJob] Starting ad scheduling job...');
      
      // Execute all tasks
      const remindersSent = await this.sendExpirationReminders();
      const releasedCount = await this.releaseExpiredReservations();
      const startedCount = await this.startScheduledAds();
      const endedCount = await this.endExpiredAds();
      
      logger.database(`🎉 [AdSchedulingJob] Job completed - Reminders: ${remindersSent}, Released: ${releasedCount}, Started: ${startedCount}, Ended: ${endedCount}`);
      
    } catch (error) {
      console.error('❌ [AdSchedulingJob] Job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the cron job (runs every hour)
   */
  start() {
    if (this.job) {
      console.log('⚠️  [AdSchedulingJob] Job is already started');
      return;
    }

    // Run every hour at minute 5 (to avoid collision with other jobs)
    this.job = cron.schedule('5 * * * *', async () => {
      await this.execute();
    }, {
      scheduled: true,
      timezone: 'Asia/Manila'
    });

    console.log('✅ [AdSchedulingJob] Started - Runs every hour at minute 5 (Asia/Manila timezone)');
    
    // Run once immediately on startup
    setTimeout(() => {
      this.execute();
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('⏹️  [AdSchedulingJob] Stopped');
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.job !== null
    };
  }
}

// Create singleton instance
const adSchedulingJob = new AdSchedulingJob();

module.exports = adSchedulingJob;

