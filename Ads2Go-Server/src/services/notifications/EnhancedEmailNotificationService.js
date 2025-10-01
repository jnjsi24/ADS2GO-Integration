const EmailNotificationQueue = require('../../models/EmailNotificationQueue');
const User = require('../../models/User');
const EmailService = require('../../utils/emailService');
const mongoose = require('mongoose');

class EnhancedEmailNotificationService {
  /**
   * Send email notification with preference checking and queuing
   */
  static async sendEmailNotification(userId, userRole, email, firstName, notificationType, emailData, priority = 'MEDIUM', originalNotificationId = null) {
    try {
      console.log(`📧 EnhancedEmailNotificationService: Processing ${notificationType} email for user ${userId}`);
      
      // Get user notification preferences
      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ EnhancedEmailNotificationService: User not found: ${userId}`);
        throw new Error('User not found');
      }

      // Check if announcements emails are enabled
      const announcementsEmailsEnabled = user.notificationPreferences?.announcementsEmails;
      
      if (!announcementsEmailsEnabled) {
        console.log(`📝 EnhancedEmailNotificationService: Announcements emails disabled for user ${userId}, queuing email`);
        
        // Queue the email for later sending
        const queuedEmail = new EmailNotificationQueue({
          userId,
          userRole,
          email,
          firstName,
          notificationType,
          emailData,
          priority,
          originalNotificationId,
          status: 'PENDING'
        });
        
        await queuedEmail.save();
        console.log(`✅ EnhancedEmailNotificationService: Email queued with ID ${queuedEmail._id}`);
        
        return {
          sent: false,
          queued: true,
          queueId: queuedEmail._id,
          message: 'Email queued - announcements emails are disabled'
        };
      }

      // Send email immediately if enabled
      console.log(`📤 EnhancedEmailNotificationService: Announcements emails enabled, sending email immediately`);
      const result = await this.sendEmailImmediately(email, emailData);
      
      return {
        sent: true,
        queued: false,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Error processing ${notificationType} email:`, error);
      
      // Try to queue the email as fallback
      try {
        const queuedEmail = new EmailNotificationQueue({
          userId,
          userRole,
          email,
          firstName,
          notificationType,
          emailData,
          priority,
          originalNotificationId,
          status: 'PENDING',
          errorMessage: error.message
        });
        
        await queuedEmail.save();
        console.log(`📝 EnhancedEmailNotificationService: Email queued as fallback due to error`);
        
        return {
          sent: false,
          queued: true,
          queueId: queuedEmail._id,
          message: 'Email queued due to error'
        };
      } catch (queueError) {
        console.error(`❌ EnhancedEmailNotificationService: Failed to queue email:`, queueError);
        throw error;
      }
    }
  }

  /**
   * Send email immediately using EmailService
   */
  static async sendEmailImmediately(email, emailData) {
    try {
      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: emailData.subject,
        html: emailData.html
      };

      const transporter = EmailService.initializeTransporter();
      if (!transporter) {
        throw new Error('Email service not configured');
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ EnhancedEmailNotificationService: Email sent successfully to ${email}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Failed to send email:`, error);
      throw error;
    }
  }

  /**
   * Process queued emails when announcements emails are enabled
   */
  static async processQueuedEmails(userId) {
    try {
      console.log(`🔄 EnhancedEmailNotificationService: Processing queued emails for user ${userId}`);
      
      const queuedEmails = await EmailNotificationQueue.find({
        userId,
        status: 'PENDING'
      }).sort({ priority: -1, createdAt: 1 });

      console.log(`📝 EnhancedEmailNotificationService: Found ${queuedEmails.length} queued emails for user ${userId}`);

      const results = [];
      for (const queuedEmail of queuedEmails) {
        try {
          const result = await this.sendEmailImmediately(queuedEmail.email, queuedEmail.emailData);
          
          // Mark as sent
          queuedEmail.status = 'SENT';
          queuedEmail.sentAt = new Date();
          queuedEmail.errorMessage = null;
          await queuedEmail.save();
          
          console.log(`✅ EnhancedEmailNotificationService: Queued email ${queuedEmail._id} sent successfully`);
          
          results.push({
            queueId: queuedEmail._id,
            notificationType: queuedEmail.notificationType,
            status: 'SENT'
          });
          
          // Add small delay between emails to avoid overwhelming the email service
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ EnhancedEmailNotificationService: Failed to send queued email ${queuedEmail._id}:`, error);
          
          // Update attempt count
          queuedEmail.attempts += 1;
          queuedEmail.lastAttemptAt = new Date();
          queuedEmail.errorMessage = error.message;
          
          if (queuedEmail.attempts >= queuedEmail.maxAttempts) {
            queuedEmail.status = 'FAILED';
            console.log(`❌ EnhancedEmailNotificationService: Email ${queuedEmail._id} marked as failed after ${queuedEmail.attempts} attempts`);
          }
          
          await queuedEmail.save();
          
          results.push({
            queueId: queuedEmail._id,
            notificationType: queuedEmail.notificationType,
            status: 'FAILED',
            error: error.message
          });
        }
      }

      return {
        processed: results.length,
        sent: results.filter(r => r.status === 'SENT').length,
        failed: results.filter(r => r.status === 'FAILED').length,
        results
      };

    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Error processing queued emails:`, error);
      throw error;
    }
  }

  /**
   * Get queued email statistics for a user
   */
  static async getQueuedEmailStats(userId) {
    try {
      const stats = await EmailNotificationQueue.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0
      };

      stats.forEach(stat => {
        result[stat._id.toLowerCase()] = stat.count;
      });

      return result;
    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Error getting queued email stats:`, error);
      throw error;
    }
  }

  /**
   * Clear old queued emails (older than 30 days)
   */
  static async clearOldQueuedEmails() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await EmailNotificationQueue.deleteMany({
        status: { $in: ['SENT', 'FAILED'] },
        createdAt: { $lt: thirtyDaysAgo }
      });

      console.log(`🧹 EnhancedEmailNotificationService: Cleared ${result.deletedCount} old queued emails`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Error clearing old queued emails:`, error);
      throw error;
    }
  }
}

module.exports = EnhancedEmailNotificationService;
