const UserNotifications = require('../models/Notification');
const User = require('../models/User');
const Ad = require('../models/Ad');
const EmailService = require('../utils/emailService');

class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(userId, title, message, type = 'INFO', options = {}) {
    try {
      // Find or create user notifications document
      let userNotifications = await UserNotifications.findOne({ userId });
      
      if (!userNotifications) {
        // Create new user notifications document
        userNotifications = new UserNotifications({
          userId,
          notifications: [],
          unreadCount: 0
        });
      }

      // Create new notification item
      const notificationItem = {
        title,
        message,
        type,
        read: false,
        readAt: null,
        adId: options.adId ? options.adId.toString() : null, // Convert ObjectId to string
        adTitle: options.adTitle || null,
        data: options.data || {}
      };

      // Add notification to the array
      userNotifications.notifications.unshift(notificationItem); // Add to beginning
      userNotifications.unreadCount += 1;

      // Keep only last 50 notifications to prevent document from growing too large
      if (userNotifications.notifications.length > 50) {
        userNotifications.notifications = userNotifications.notifications.slice(0, 50);
      }

      await userNotifications.save();
      console.log(`✅ Notification created for user ${userId}: ${title}`);
      console.log('🔔 NotificationService: Created notification:', notificationItem);
      
      return notificationItem;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send ad approval notification
   */
  static async sendAdApprovalNotification(adId) {
    try {
      console.log('🔔 NotificationService: Starting ad approval notification for ad:', adId);
      
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) {
        console.error('❌ NotificationService: Ad not found:', adId);
        throw new Error('Ad not found');
      }

      const user = ad.userId;
      if (!user) {
        console.error('❌ NotificationService: User not found for ad:', adId);
        throw new Error('User not found');
      }

      console.log('👤 NotificationService: Found user:', user.firstName, user.lastName, user.email);

      // Create in-app notification
      console.log('🔔 NotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        user._id,
        '🎉 Ad Approved!',
        `Your advertisement "${ad.title}" has been approved and is now live!`,
        'SUCCESS',
        {
          adId: ad._id,
          adTitle: ad.title
        }
      );
      console.log('✅ NotificationService: In-app notification created');

      // Send email notification
      console.log('📧 NotificationService: Sending email notification...');
      await this.sendAdApprovalEmail(user.email, user.firstName, ad.title, ad._id);
      console.log('✅ NotificationService: Email notification sent');

      return notification;
    } catch (error) {
      console.error('❌ NotificationService: Error sending ad approval notification:', error);
      console.error('❌ NotificationService: Error details:', error.message);
      console.error('❌ NotificationService: Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Send ad rejection notification
   */
  static async sendAdRejectionNotification(adId, reason) {
    try {
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) {
        throw new Error('Ad not found');
      }

      const user = ad.userId;
      if (!user) {
        throw new Error('User not found');
      }

      // Create in-app notification
      const notification = await this.createNotification(
        user._id,
        '❌ Ad Rejected',
        `Your advertisement "${ad.title}" has been rejected. Reason: ${reason}`,
        'ERROR',
        {
          adId: ad._id,
          adTitle: ad.title
        }
      );

      // Send email notification
      await this.sendAdRejectionEmail(user.email, user.firstName, ad.title, reason, ad._id);

      return notification;
    } catch (error) {
      console.error('Error sending ad rejection notification:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation notification
   */
  static async sendPaymentConfirmationNotification(userId, amount, adTitle) {
    try {
      const notification = await this.createNotification(
        userId,
        '💳 Payment Confirmed',
        `Your payment of $${amount} for "${adTitle}" has been confirmed.`,
        'SUCCESS',
        {}
      );

      return notification;
    } catch (error) {
      console.error('Error sending payment confirmation notification:', error);
      throw error;
    }
  }

  /**
   * Send ad performance update notification
   */
  static async sendAdPerformanceNotification(userId, adTitle, impressions, plays) {
    try {
      const notification = await this.createNotification(
        userId,
        '📊 Ad Performance Update',
        `Your ad "${adTitle}" has reached ${impressions} impressions and ${plays} plays!`,
        'INFO',
        {}
      );

      return notification;
    } catch (error) {
      console.error('Error sending ad performance notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification for ad approval
   */
  static async sendAdApprovalEmail(email, firstName, adTitle, adId) {
    try {
      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Your Ad Has Been Approved!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">🎉 Great News, ${firstName}!</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Your advertisement has been approved and is now live!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
                <h3 style="color: #4A90E2; margin: 0 0 10px 0;">Ad Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">APPROVED ✅</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Ad ID:</strong> ${adId}</p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                Your ad is now running and will start generating impressions. You can track its performance in your dashboard.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Dashboard
                </a>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                Thank you for using Ads2Go!
              </p>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Ad approval email sent to ${email}`);
    } catch (error) {
      console.error('Error sending ad approval email:', error);
      throw error;
    }
  }

  /**
   * Send email notification for ad rejection
   */
  static async sendAdRejectionEmail(email, firstName, adTitle, reason, adId) {
    try {
      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '❌ Ad Rejection - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">❌ Ad Rejection Notice</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">We're sorry, but your advertisement needs some adjustments.</p>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin: 0 0 10px 0;">Ad Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: bold;">REJECTED ❌</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Ad ID:</strong> ${adId}</p>
              </div>
              
              <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                <h3 style="color: #721c24; margin: 0 0 10px 0;">Rejection Reason:</h3>
                <p style="margin: 0; color: #721c24;">${reason}</p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                Please review the feedback above and make the necessary changes to your ad. You can resubmit it once the issues are addressed.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/advertisements" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View My Ads
                </a>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                If you have any questions, please contact our support team.
              </p>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Ad rejection email sent to ${email}`);
    } catch (error) {
      console.error('Error sending ad rejection email:', error);
      throw error;
    }
  }

  /**
   * Get user's notification statistics
   */
  static async getUserNotificationStats(userId) {
    try {
      const total = await Notification.countDocuments({ userId });
      const unread = await Notification.countDocuments({ userId, read: false });
      const read = total - unread;

      return {
        total,
        unread,
        read
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
