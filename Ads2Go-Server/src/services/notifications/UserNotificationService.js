const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');

class UserNotificationService extends BaseNotificationService {
  /**
   * Send ad approval notification
   */
  static async sendAdApprovalNotification(adId) {
    try {
      console.log('🔔 UserNotificationService: Starting ad approval notification for ad:', adId);
      
      const Ad = require('../../models/Ad');
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) {
        console.error('❌ UserNotificationService: Ad not found:', adId);
        throw new Error('Ad not found');
      }

      const user = ad.userId;
      if (!user) {
        console.error('❌ UserNotificationService: User not found for ad:', adId);
        throw new Error('User not found');
      }

      console.log('👤 UserNotificationService: Found user:', user.firstName, user.lastName, user.email);

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        user._id,
        '🎉 Ad Approved!',
        `Your advertisement "${ad.title}" has been approved and is now live!`,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'AD_APPROVAL',
          priority: 'HIGH',
          adId: ad._id,
          adTitle: ad.title
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification
      console.log('📧 UserNotificationService: Sending email notification...');
      await this.sendAdApprovalEmail(user.email, user.firstName, ad.title, ad._id);
      console.log('✅ UserNotificationService: Email notification sent');

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending ad approval notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
      console.error('❌ UserNotificationService: Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Send ad rejection notification
   */
  static async sendAdRejectionNotification(adId, reason) {
    try {
      const Ad = require('../../models/Ad');
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
          userRole: 'USER',
          category: 'AD_REJECTION',
          priority: 'HIGH',
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
      console.log('🔔 UserNotificationService: Starting payment confirmation notification for user:', userId);
      
      // Get user details for email
      const User = require('../../models/User');
      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ UserNotificationService: User not found:', userId);
        throw new Error('User not found');
      }

      console.log('👤 UserNotificationService: Found user:', user.firstName, user.lastName, user.email);

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        userId,
        '💳 Payment Confirmed',
        `Your payment of ₱${amount} for "${adTitle}" has been confirmed.`,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'PAYMENT_CONFIRMATION',
          priority: 'HIGH',
          adTitle: adTitle
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification
      console.log('📧 UserNotificationService: Sending email notification...');
      await this.sendPaymentConfirmationEmail(user.email, user.firstName, amount, adTitle);
      console.log('✅ UserNotificationService: Email notification sent');

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending payment confirmation notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
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
        {
          userRole: 'USER',
          category: 'AD_PERFORMANCE',
          priority: 'MEDIUM'
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending ad performance notification:', error);
      throw error;
    }
  }

  /**
   * Send profile change notification
   */
  static async sendProfileChangeNotification(userId, changedFields, oldValues = {}) {
    try {
      console.log('🔔 UserNotificationService: Starting profile change notification for user:', userId);
      
      // Get user details for email
      const User = require('../../models/User');
      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ UserNotificationService: User not found:', userId);
        throw new Error('User not found');
      }

      console.log('👤 UserNotificationService: Found user:', user.firstName, user.lastName, user.email);
      console.log('📝 UserNotificationService: Changed fields:', changedFields);
      console.log('📝 UserNotificationService: Old values:', oldValues);

      // Create detailed change messages
      const changeMessages = [];
      
      changedFields.forEach(field => {
        const oldValue = oldValues[field];
        const newValue = user[field];
        
        switch (field) {
          case 'firstName':
            changeMessages.push(`Your first name was changed to "${newValue}"`);
            break;
          case 'middleName':
            if (newValue) {
              changeMessages.push(`Your middle name was changed to "${newValue}"`);
            } else {
              changeMessages.push(`Your middle name was removed`);
            }
            break;
          case 'lastName':
            changeMessages.push(`Your last name was changed to "${newValue}"`);
            break;
          case 'email':
            changeMessages.push(`Your email was changed to "${newValue}"`);
            break;
          case 'contactNumber':
            changeMessages.push(`Your contact number was changed to "${newValue}"`);
            break;
          case 'companyName':
            changeMessages.push(`Your company name was changed to "${newValue}"`);
            break;
          case 'companyAddress':
            changeMessages.push(`Your company address was changed to "${newValue}"`);
            break;
          case 'houseAddress':
            if (newValue) {
              changeMessages.push(`Your house address was changed to "${newValue}"`);
            } else {
              changeMessages.push(`Your house address was removed`);
            }
            break;
          case 'password':
            changeMessages.push(`Your password was updated`);
            break;
          default:
            changeMessages.push(`Your ${field} was updated`);
        }
      });

      const notificationMessage = changeMessages.join('. ') + '.';
      const isMultipleFields = changedFields.length > 1;

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        userId,
        '👤 Profile Updated',
        notificationMessage,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'PROFILE_CHANGE',
          priority: 'MEDIUM',
          data: { changedFields, oldValues }
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification
      console.log('📧 UserNotificationService: Sending email notification...');
      await this.sendProfileChangeEmail(user.email, user.firstName, changeMessages, changedFields);
      console.log('✅ UserNotificationService: Email notification sent');

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending profile change notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
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
   * Send email notification for payment confirmation
   */
  static async sendPaymentConfirmationEmail(email, firstName, amount, adTitle) {
    try {
      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '💳 Payment Confirmed - Thank You!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">💳 Payment Confirmed!</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #28a745; margin: 0 0 10px 0;">Payment Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Amount:</strong> <span style="color: #28a745; font-weight: bold;">₱${amount.toLocaleString()}</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Ad Campaign:</strong> ${adTitle}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">PAID ✅</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                Your payment has been successfully processed and your ad campaign is now active! You can track its performance in your dashboard.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Dashboard
                </a>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #666; font-size: 14px; text-align: center;">
                  <strong>Need help?</strong> Contact our support team if you have any questions about your payment or ad campaign.
                </p>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                Thank you for choosing Ads2Go!
              </p>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Payment confirmation email sent to ${email}`);
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send email notification for profile changes
   */
  static async sendProfileChangeEmail(email, firstName, changeMessages, changedFields) {
    try {
      const isMultipleFields = changedFields.length > 1;
      const fieldText = isMultipleFields ? 'fields' : 'field';
      const verbText = isMultipleFields ? 'have' : 'has';
      const changesList = changeMessages.map(msg => `<li style="margin: 8px 0; color: #333;">${msg}</li>`).join('');

      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '👤 Profile Updated Successfully',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">👤 Profile Updated!</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
                <h3 style="color: #4A90E2; margin: 0 0 15px 0;">Changes Made:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${changesList}
                </ul>
                <p style="margin: 15px 0 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">UPDATED ✅</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                Your profile ${fieldText} ${verbText} been successfully updated. If you didn't make these changes, please contact our support team immediately.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/profile" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Profile
                </a>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #666; font-size: 14px; text-align: center;">
                  <strong>Security Notice:</strong> If you didn't make these changes, please contact our support team immediately to secure your account.
                </p>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                Thank you for using Ads2Go!
              </p>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Profile change email sent to ${email}`);
    } catch (error) {
      console.error('Error sending profile change email:', error);
      throw error;
    }
  }
}

module.exports = UserNotificationService;