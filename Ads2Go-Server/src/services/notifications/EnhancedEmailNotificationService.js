const EmailNotificationQueue = require('../../models/EmailNotificationQueue');
const User = require('../../models/User');
const Driver = require('../../models/Driver');
const EmailService = require('../../utils/emailService');
const mongoose = require('mongoose');

class EnhancedEmailNotificationService {
  /**
   * Critical notification types that should always be sent regardless of user preferences
   * These are transactional emails that users need to receive
   */
  static CRITICAL_NOTIFICATION_TYPES = [
    'AD_CREATED',
    'AD_APPROVAL',
    'AD_REJECTION',
    'PAYMENT_CONFIRMATION',
    'AD_DEPLOYED',
    'AD_DELETION'
  ];

  /**
   * Send email notification with preference checking and queuing
   */
  static async sendEmailNotification(userId, userRole, email, firstName, notificationType, emailData, priority = 'MEDIUM', originalNotificationId = null) {
    try {
      console.log(`📧 EnhancedEmailNotificationService: Processing ${notificationType} email for ${userRole} ${userId}`);
      
      // For drivers, send email directly (they don't have notification preferences like users)
      if (userRole === 'DRIVER') {
        console.log(`📤 EnhancedEmailNotificationService: Sending email directly to driver ${userId}`);
        const result = await this.sendEmailImmediately(email, emailData);
        
        if (result.success) {
          return {
            sent: true,
            queued: false,
            message: 'Email sent successfully to driver'
          };
        } else {
          throw new Error('Failed to send email to driver');
        }
      }
      
      // For users, check notification preferences
      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ EnhancedEmailNotificationService: User not found: ${userId}`);
        throw new Error('User not found');
      }

      // Check if this is a critical notification type that should always be sent
      const isCriticalNotification = this.CRITICAL_NOTIFICATION_TYPES.includes(notificationType);
      
      if (isCriticalNotification) {
        console.log(`📤 EnhancedEmailNotificationService: Critical notification type ${notificationType} - sending email immediately (bypassing preferences)`);
        const result = await this.sendEmailImmediately(email, emailData);
        
        if (result.success) {
          return {
            sent: true,
            queued: false,
            message: 'Critical email sent successfully (bypassed preferences)'
          };
        } else {
          // If email sending failed, throw error to trigger fallback queueing
          throw new Error(result.error || 'Failed to send email');
        }
      }

      // Initialize notification preferences if they don't exist (for users created before this feature)
      if (!user.notificationPreferences) {
        console.log(`🔧 EnhancedEmailNotificationService: Initializing notification preferences for user ${userId}`);
        user.notificationPreferences = {
          enableDesktopNotifications: false,
          enableNotificationBadge: true,
          pushNotificationTimeout: '10',
          communicationEmails: false,
          announcementsEmails: true // Default to true to enable emails
        };
        await user.save();
        console.log(`✅ EnhancedEmailNotificationService: Notification preferences initialized for user ${userId}`);
      }

      // Check if announcements emails are enabled
      // Default to true if announcementsEmails is undefined (shouldn't happen after initialization, but safety check)
      const announcementsEmailsEnabled = user.notificationPreferences.announcementsEmails !== undefined 
        ? user.notificationPreferences.announcementsEmails 
        : true; // Default to true (matching schema default)
      
      console.log(`📧 EnhancedEmailNotificationService: User ${userId} announcementsEmails setting: ${announcementsEmailsEnabled}`);
      
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
      
      if (result.success) {
        return {
          sent: true,
          queued: false,
          message: 'Email sent successfully'
        };
      } else {
        // If email sending failed, throw error to trigger fallback queueing
        throw new Error(result.error || 'Failed to send email');
      }

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
      // Ensure email service is initialized before sending
      if (!EmailService.isConfigured) {
        console.log(`🔄 EnhancedEmailNotificationService: Email service not configured, initializing...`);
        EmailService.initializeTransporter();
        await EmailService.verifyConfiguration();
      }

      console.log(`📧 EnhancedEmailNotificationService: Attempting to send email to ${email}`);
      console.log(`   Subject: ${emailData.subject}`);
      console.log(`   Email service configured: ${EmailService.isConfigured}`);
      console.log(`   Email provider: ${EmailService.provider || 'Not set'}`);
      console.log(`   From email: ${EmailService.getFromEmail()}`);
      
      if (!EmailService.isConfigured) {
        const errorMsg = 'Email service is not configured. Please check RESEND_API_KEY or SMTP settings.';
        console.error(`❌ EnhancedEmailNotificationService: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Use EmailService.sendEmail() which handles both Resend and SMTP properly
      const result = await EmailService.sendEmail({
        to: email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || null // Include text version if available
      });

      if (result.success) {
        console.log(`✅ EnhancedEmailNotificationService: Email sent successfully to ${email}`);
        console.log(`   Message ID: ${result.messageId || 'N/A'}`);
        console.log(`   Provider: ${result.provider || 'Unknown'}`);
        return { success: true };
      } else {
        const errorMessage = result.error || 'Unknown error sending email';
        console.error(`❌ EnhancedEmailNotificationService: Email sending failed: ${errorMessage}`);
        console.error(`   Email: ${email}`);
        console.error(`   Subject: ${emailData.subject}`);
        console.error(`   Provider: ${EmailService.provider || 'Not set'}`);
        console.error(`   Is Configured: ${EmailService.isConfigured}`);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(`❌ EnhancedEmailNotificationService: Failed to send email to ${email}:`, error);
      console.error(`   Error details:`, error.message);
      console.error(`   Error stack:`, error.stack);
      console.error(`   Email service state:`);
      console.error(`     - Configured: ${EmailService.isConfigured}`);
      console.error(`     - Provider: ${EmailService.provider || 'Not set'}`);
      console.error(`     - From email: ${EmailService.getFromEmail()}`);
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
      const objectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      const stats = await EmailNotificationQueue.aggregate([
        { $match: { userId: objectId } },
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
