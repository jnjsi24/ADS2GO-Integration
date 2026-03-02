const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');
const EnhancedEmailNotificationService = require('./EnhancedEmailNotificationService');

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
        `Your advertisement "${ad.title}" has been approved. You can pay it now`,
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

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getAdApprovalEmailData(user.firstName, ad.title, ad._id);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'AD_APPROVAL',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
        console.log('✅ UserNotificationService: Email notification sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Email notification queued (communication emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send email notification:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

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

      // Send email notification using enhanced service
      try {
        const emailData = await this.getAdRejectionEmailData(user.firstName, ad.title, reason, ad._id);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'AD_REJECTION',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
        console.log('✅ UserNotificationService: Ad rejection email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Ad rejection email queued (communication emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send ad rejection email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('Error sending ad rejection notification:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation notification
   */
  static async sendPaymentConfirmationNotification(userId, amount, adTitle, adId) {
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
        'Payment Confirmed',
        `Your payment of ₱${amount} for "${adTitle}" has been confirmed.`,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'PAYMENT_CONFIRMATION',
          priority: 'HIGH',
          adId: adId,
          adTitle: adTitle
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getPaymentConfirmationEmailData(user.firstName, amount, adTitle, adId);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'PAYMENT_CONFIRMATION',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
        console.log('✅ UserNotificationService: Payment confirmation email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Payment confirmation email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send payment confirmation email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending payment confirmation notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
      throw error;
    }
  }

  /**
   * Send ad deletion notification
   * @param {string} adId - The ID of the deleted ad
   * @param {boolean} deletedByUser - Whether the ad was deleted by the user (true) or admin (false)
   * @param {string} reason - The reason for deletion (optional, only for user deletions)
   */
  static async sendAdDeletionNotification(adId, deletedByUser = false, reason = null) {
    try {
      console.log('🔔 UserNotificationService: Starting ad deletion notification for ad:', adId);
      
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

      // Determine notification message based on who deleted it
      const notificationTitle = deletedByUser 
        ? '🗑️ Ad Deleted' 
        : '🗑️ Ad Deleted by Admin';
      
      let notificationMessage;
      if (deletedByUser) {
        notificationMessage = `Your advertisement "${ad.title}" has been deleted.`;
        if (reason) {
          notificationMessage += ` Reason: ${reason}`;
        }
        notificationMessage += ' This action cannot be undone.';
      } else {
        notificationMessage = `Your advertisement "${ad.title}" has been deleted by an administrator.`;
        if (reason) {
          notificationMessage += ` Reason: ${reason}`;
        }
        notificationMessage += ' This action cannot be undone.';
      }

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        user._id,
        notificationTitle,
        notificationMessage,
        'WARNING',
        {
          userRole: 'USER',
          category: 'AD_DELETION',
          priority: 'HIGH',
          adId: ad._id,
          adTitle: ad.title,
          data: { deletedByUser }
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getAdDeletionEmailData(user.firstName, ad.title, ad._id, deletedByUser, reason);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'AD_DELETION',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ UserNotificationService: Ad deletion email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Ad deletion email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send ad deletion email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending ad deletion notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
      // Don't throw - deletion should succeed even if notification fails
      return null;
    }
  }

  /**
   * Send ad performance update notification
   */
  static async sendAdPerformanceNotification(userId, adTitle, impressions, plays) {
    try {
      const notification = await this.createNotification(
        userId,
        'Ad Performance Update',
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
   * Fetch active pricing configs and return a summary for notifications/email.
   * Returns { summaryText, rows } where rows are { materialType, vehicleType, category, basePrice }.
   */
  static async getActivePricingSummary() {
    const PricingConfig = require('../../models/PricingConfig');
    const configs = await PricingConfig.find({
      isActive: true,
      isArchived: { $ne: true }
    })
      .sort({ materialType: 1, vehicleType: 1, category: 1 })
      .select('materialType vehicleType category basePrice')
      .lean();
    const rows = configs.map(c => ({
      materialType: c.materialType,
      vehicleType: c.vehicleType,
      category: c.category,
      basePrice: c.basePrice
    }));
    const summaryText = rows.length === 0
      ? 'Ad pricing has been updated. New rates apply to new ads immediately.'
      : rows.map(r => `${r.materialType} / ${r.vehicleType} / ${r.category}: ₱${Number(r.basePrice).toLocaleString()}`).join(' • ');
    return { summaryText, rows };
  }

  /**
   * Send ads pricing change notification to a user (in-app + email).
   * Called when super admin updates PricingConfig; broadcast to all user clients.
   * @param {string} userId - User ID
   * @param {object} [pricingSummary] - Optional { summaryText, rows } from getActivePricingSummary (avoids refetch per user)
   */
  static async sendAdsPricingChangeNotification(userId, pricingSummary = null) {
    try {
      const User = require('../../models/User');
      const user = await User.findById(userId);
      if (!user) {
        console.error('UserNotificationService: User not found for pricing notification:', userId);
        return { notification: null, sentToEmail: null };
      }

      const summary = pricingSummary || await this.getActivePricingSummary();
      const message = summary.rows.length === 0
        ? 'Ad pricing has been updated. New rates apply to new ads immediately.'
        : `Ad pricing updated. New rates (base per 20s, 1 mo, 1 vehicle): ${summary.summaryText}`;

      const notification = await this.createNotification(
        userId,
        'Ads Pricing Updated',
        message,
        'INFO',
        {
          userRole: 'USER',
          category: 'ADS_PRICING_CHANGE',
          priority: 'MEDIUM',
          data: { pricingRows: summary.rows }
        }
      );

      let sentToEmail = null;
      try {
        const emailData = await this.getAdsPricingChangeEmailData(user.firstName, summary);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'ADS_PRICING_CHANGE',
          emailData,
          'MEDIUM',
          notification._id
        );
        if (result.sent) {
          sentToEmail = user.email;
          console.log('✅ Pricing notification email sent successfully to:', user.email);
        } else if (result.queued) {
          console.log('UserNotificationService: Ads pricing change email queued (announcements disabled)');
        }
      } catch (emailError) {
        console.error('UserNotificationService: Failed to send ads pricing change email:', emailError.message);
      }

      return { notification, sentToEmail };
    } catch (error) {
      console.error('Error sending ads pricing change notification:', error);
      throw error;
    }
  }

  /**
   * Get email data for ads pricing change notification
   * @param {string} firstName - User first name
   * @param {object} pricingSummary - { summaryText, rows } from getActivePricingSummary
   */
  static async getAdsPricingChangeEmailData(firstName, pricingSummary = { summaryText: '', rows: [] }) {
    const clientUrl = process.env.CLIENT_URL || 'https://ads2go.com';
    const { rows } = pricingSummary;
    const pricingHtml = rows.length === 0
      ? '<p style="margin: 5px 0; color: #333;">View current pricing and create or update your campaigns on the website.</p>'
      : `
        <p style="margin: 5px 0 10px 0; color: #333; font-weight: bold;">New rates (base per 20s ad, 1 month, 1 vehicle):</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${rows.map(r => `
            <tr>
              <td style="padding: 6px 8px; color: #333;">${r.materialType} / ${r.vehicleType} / ${r.category}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #1a73e8;">₱${Number(r.basePrice).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
        <p style="margin: 10px 0 5px 0; color: #666; font-size: 12px;">Rates scale by ad length (20/40/60s), duration, and number of vehicles. View the website for exact quotes.</p>
      `;
    return {
      subject: 'Ad Pricing Updated – New Rates Now in Effect',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Ad Pricing Updated</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName},</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Our ad pricing has been updated. New rates apply to new ads immediately.</p>
            <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
              ${pricingHtml}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${clientUrl}/create-advertisement" style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Pricing & Create Ad</a>
            </div>
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">Thank you for choosing Ads2Go.</p>
          </div>
        </div>
      `,
      templateData: { firstName }
    };
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
        'Profile Updated',
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

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getProfileChangeEmailData(user.firstName, changeMessages, changedFields);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'PROFILE_CHANGE',
          emailData,
          'MEDIUM',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ UserNotificationService: Profile change email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Profile change email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send profile change email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending profile change notification:', error);
      console.error('❌ UserNotificationService: Error details:', error.message);
      throw error;
    }
  }

  /**
   * Get email data for ad approval notification
   */
  static async getAdApprovalEmailData(firstName, adTitle, adId) {
    return {
      subject: 'Ads Approved by Admin and Ready for Payment',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">🎉 Great News, ${firstName}!</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Your advertisement has been approved, you can pay it now</p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin: 0 0 10px 0;">Ad Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">APPROVED ✅</span></p>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Please complete your payment to start running your advertisement. Once payment is confirmed, your ad will be displayed on our network!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/ad-details/${adId}" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Ad Details
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              Thank you for choosing Ads2Go for your advertising needs!
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        adTitle,
        adId
      }
    };
  }

  /**
   * Get email data for ad rejection notification
   */
  static async getAdRejectionEmailData(firstName, adTitle, reason, adId) {
    return {
      subject: 'Ad Rejected - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">❌ Ad Review Update</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName},</p>
            <p style="text-align: center; font-size: 16px; color: #666;">We need to discuss your advertisement submission.</p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">Ad Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: bold;">REJECTED ❌</span></p>
              <p style="margin: 5px 0; color: #333;"><strong>Reason:</strong> ${reason}</p>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Don't worry! You can resubmit your advertisement after making the necessary changes.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/dashboard" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Your Dashboard
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        adTitle,
        reason,
        adId
      }
    };
  }

  /**
   * Get email data for report status update notification
   */
  static async getReportStatusUpdateEmailData(firstName, reportTitle, newStatus, adminNotes) {
    // Status-specific configurations
    const statusConfig = {
      'PENDING': {
        icon: '📋',
        color: '#FFA500',
        bgColor: '#FFF4E6',
        borderColor: '#FFA500',
        title: 'Report Submitted',
        message: 'Your report has been successfully submitted and is now pending review by our support team.',
        actionMessage: 'We will review your report and get back to you as soon as possible.'
      },
      'IN_PROGRESS': {
        icon: '🔧',
        color: '#4A90E2',
        bgColor: '#E8F4FD',
        borderColor: '#4A90E2',
        title: 'Report In Progress',
        message: 'Your report is now being actively reviewed by our support team.',
        actionMessage: 'We are working on resolving your issue and will keep you updated.'
      },
      'RESOLVED': {
        icon: '✅',
        color: '#28a745',
        bgColor: '#E8F5E9',
        borderColor: '#28a745',
        title: 'Report Resolved',
        message: 'Great news! Your report has been resolved.',
        actionMessage: 'Thank you for your patience. If you have any further concerns, please don\'t hesitate to reach out.'
      },
      'CLOSED': {
        icon: '🔒',
        color: '#6c757d',
        bgColor: '#F5F5F5',
        borderColor: '#6c757d',
        title: 'Report Closed',
        message: 'Your report has been closed.',
        actionMessage: 'If you need to reopen this issue or have any questions, please create a new report.'
      }
    };
    
    const config = statusConfig[newStatus] || statusConfig['PENDING'];
    const statusText = newStatus.replace('_', ' ').toLowerCase();
    
    return {
      subject: `${config.icon} Report ${config.title} - ${reportTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center; margin-bottom: 10px;">${config.icon} ${config.title}</h2>
            <p style="text-align: center; font-size: 16px; color: #666; margin-top: 0;">Hello ${firstName}!</p>
            
            <div style="background-color: ${config.bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${config.borderColor};">
              <h3 style="color: ${config.color}; margin: 0 0 15px 0; font-size: 18px;">Report Details:</h3>
              <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Report Title:</strong> ${reportTitle}</p>
              <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Status:</strong> <span style="color: ${config.color}; font-weight: bold; text-transform: capitalize;">${statusText}</span></p>
              ${adminNotes ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                  <p style="margin: 0 0 8px 0; color: #333; font-weight: bold; font-size: 14px;">Admin Response:</p>
                  <div style="background-color: #ffffff; padding: 12px; border-radius: 5px; margin-top: 8px;">
                    <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.5;">${adminNotes}</p>
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
                ${config.message}
              </p>
              ${adminNotes ? '' : `<p style="margin: 10px 0 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">${config.actionMessage}</p>`}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/dashboard" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View Your Reports
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px; line-height: 1.5;">
              Thank you for your patience and for helping us improve our service.<br>
              If you have any questions, please don't hesitate to contact our support team.
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        reportTitle,
        newStatus,
        adminNotes
      }
    };
  }

  /**
   * Get email data for admin response notification
   */
  static async getAdminResponseEmailData(firstName, reportTitle, adminNotes) {
    return {
      subject: 'Admin Response - Your Report',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">💬 Admin Response</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Our admin team has responded to your report.</p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin: 0 0 10px 0;">Report Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Report:</strong> ${reportTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Admin Response:</strong></p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <p style="margin: 0; color: #333; font-style: italic;">"${adminNotes}"</p>
              </div>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Please review the response and let us know if you need any clarification.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/dashboard" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Your Reports
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              Thank you for your feedback and for helping us improve our service.
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        reportTitle,
        adminNotes
      }
    };
  }

  /**
   * Get email data for profile change notification
   */
  static async getProfileChangeEmailData(firstName, changeMessages, changedFields) {
    return {
      subject: 'Profile Updated - Security Alert',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">👤 Profile Updated</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Your profile has been successfully updated.</p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">Changes Made:</h3>
              ${changeMessages.map(message => `<p style="margin: 5px 0; color: #333;">• ${message}</p>`).join('')}
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              If you didn't make these changes, please contact our support team immediately.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/dashboard" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Your Profile
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              This is an automated notification for your security and awareness.
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        changeMessages,
        changedFields
      }
    };
  }

  /**
   * Get email data for ad deletion notification
   */
  static async getAdDeletionEmailData(firstName, adTitle, adId, deletedByUser = false, reason = null) {
    const deletionContext = deletedByUser 
      ? 'You have deleted your advertisement' 
      : 'An administrator has deleted your advertisement';
    
    return {
      subject: deletedByUser ? 'Advertisement Deleted' : 'Advertisement Deleted by Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">🗑️ Advertisement Deleted</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName},</p>
            <p style="text-align: center; font-size: 16px; color: #666;">${deletionContext}.</p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">Ad Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: bold;">DELETED 🗑️</span></p>
              ${reason ? `<p style="margin: 5px 0; color: #333;"><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>
            
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <p style="margin: 0; color: #721c24; font-weight: bold;">⚠️ Important Notice:</p>
              <p style="margin: 5px 0 0 0; color: #721c24;">
                This action cannot be undone. The advertisement has been removed from all devices and will be permanently deleted after 30 days.
                ${deletedByUser ? '' : 'If you believe this was done in error, please contact our support team.'}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/advertisements" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View My Advertisements
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              ${deletedByUser ? 'If you have any questions, please contact our support team.' : 'If you have questions about this deletion, please contact our support team immediately.'}
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        adTitle,
        adId,
        deletedByUser,
        reason
      }
    };
  }

  /**
   * Get email data for payment confirmation notification
   */
  static async getPaymentConfirmationEmailData(firstName, amount, adTitle, adId) {
    return {
      subject: 'Payment Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">💳 Payment Confirmed</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Your payment has been successfully processed.</p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin: 0 0 10px 0;">Payment Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Amount:</strong> ₱${amount}</p>
              <p style="margin: 5px 0; color: #333;"><strong>For:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">CONFIRMED ✅</span></p>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Thank you for your payment! Your advertisement is now active and running.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/ad-details/${adId}" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Ad Details
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              If you have any questions about this payment, please contact our support team.
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        amount,
        adTitle,
        adId
      }
    };
  }

  /**
   * Send ad created successfully notification
   */
  static async sendAdCreatedNotification(adId) {
    try {
      console.log('🔔 UserNotificationService: Starting ad created notification for ad:', adId);
      
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
        '✅ Ad Created Successfully!',
        `Your advertisement "${ad.title}" has been created successfully and is pending admin review.`,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'AD_CREATED',
          priority: 'MEDIUM',
          adId: ad._id,
          adTitle: ad.title
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getAdCreatedEmailData(user.firstName, ad.title, ad._id);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'AD_CREATED',
          emailData,
          'MEDIUM',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ UserNotificationService: Ad created email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Ad created email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send ad created email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending ad created notification:', error);
      throw error;
    }
  }

  /**
   * Send ad deployed notification
   */
  static async sendAdDeployedNotification(adId) {
    try {
      console.log('🔔 UserNotificationService: Starting ad deployed notification for ad:', adId);
      
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

      const endDate = new Date(ad.endTime).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        user._id,
        '▶️  Your Ad is Now Running!',
        `Your ad "${ad.title}" has started running and is now being displayed on the selected devices. It will run until ${endDate}.`,
        'SUCCESS',
        {
          userRole: 'USER',
          category: 'AD_DEPLOYED',
          priority: 'HIGH',
          adId: ad._id,
          adTitle: ad.title,
          data: {
            startTime: ad.startTime,
            endTime: ad.endTime,
            adId: ad._id.toString(),
            action: 'VIEW_DETAILS'
          }
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getAdDeployedEmailData(user.firstName, ad.title, ad._id, endDate);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'AD_DEPLOYED',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ UserNotificationService: Ad deployed email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Ad deployed email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send ad deployed email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending ad deployed notification:', error);
      throw error;
    }
  }

  /**
   * Get email data for ad created notification
   */
  static async getAdCreatedEmailData(firstName, adTitle, adId) {
    return {
      subject: 'Ads Created Successfully',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">✅ Ad Created Successfully!</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Your advertisement has been created successfully.</p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin: 0 0 10px 0;">Ad Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">PENDING REVIEW ⏳</span></p>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Your advertisement is now pending admin review. Once approved, you'll receive a notification and can proceed with payment.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/ad-details/${adId}" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Ad Details
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              Thank you for choosing Ads2Go for your advertising needs!
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        adTitle,
        adId
      }
    };
  }

  /**
   * Get email data for ad deployed notification
   */
  static async getAdDeployedEmailData(firstName, adTitle, adId, endDate) {
    return {
      subject: 'Ads Deployed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">▶️  Your Ad is Now Running!</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            <p style="text-align: center; font-size: 16px; color: #666;">Great news! Your advertisement has been deployed and is now running.</p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin: 0 0 10px 0;">Ad Details:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${adTitle}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">RUNNING ▶️</span></p>
              <p style="margin: 5px 0; color: #333;"><strong>End Date:</strong> ${endDate}</p>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              Your advertisement is now being displayed on the selected devices and will continue running until ${endDate}.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/ad-details/${adId}" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Ad Details
              </a>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
              Thank you for choosing Ads2Go for your advertising needs!
            </p>
          </div>
        </div>
      `,
      templateData: {
        firstName,
        adTitle,
        adId,
        endDate
      }
    };
  }

  /**
   * Send email notification for ad approval (legacy method - use getAdApprovalEmailData instead)
   */
  static async sendAdApprovalEmail(email, firstName, adTitle, adId) {
    try {
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: 'Your Ad Has Been Approved!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">🎉 Great News, ${firstName}!</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Your advertisement has been approved and You can pay it now</p>
              
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

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send ad approval email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Ad approval email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending ad approval email:', error.message);
      throw error;
    }
  }

  /**
   * Send email notification for ad rejection
   */
  static async sendAdRejectionEmail(email, firstName, adTitle, reason, adId) {
    try {
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: 'Ad Rejection - Action Required',
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

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send ad rejection email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Ad rejection email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending ad rejection email:', error.message);
      throw error;
    }
  }

  /**
   * Send email notification for payment confirmation
   */
  static async sendPaymentConfirmationEmail(email, firstName, amount, adTitle) {
    try {
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: 'Payment Confirmed - Thank You!',
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

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send payment confirmation email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Payment confirmation email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending payment confirmation email:', error.message);
      throw error;
    }
  }

  /**
   * Send report status update notification to user
   */
  static async sendReportStatusUpdateNotification(userId, reportId, reportTitle, oldStatus, newStatus, adminNotes = null) {
    try {
      console.log('🔔 UserNotificationService: Starting report status update notification for user:', userId);
      
      // Get user details
      const User = require('../../models/User');
      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ UserNotificationService: User not found:', userId);
        throw new Error('User not found');
      }

      console.log('UserNotificationService: Found user:', user.firstName, user.lastName, user.email);

      // Create status-specific messages
      let title, message, type, priority;
      
      switch (newStatus) {
        case 'PENDING':
          title = 'Report Submitted';
          message = `Your report "${reportTitle}" has been successfully submitted and is pending review.`;
          type = 'INFO';
          priority = 'MEDIUM';
          break;
        case 'IN_PROGRESS':
          title = 'Report In Progress';
          message = `Your report "${reportTitle}" is now being actively reviewed by our support team.`;
          type = 'INFO';
          priority = 'MEDIUM';
          break;
        case 'RESOLVED':
          title = 'Report Resolved';
          message = `Great news! Your report "${reportTitle}" has been resolved.`;
          type = 'SUCCESS';
          priority = 'HIGH';
          break;
        case 'CLOSED':
          title = 'Report Closed';
          message = `Your report "${reportTitle}" has been closed.`;
          type = 'INFO';
          priority = 'MEDIUM';
          break;
        default:
          title = 'Report Status Update';
          message = `Your report "${reportTitle}" status has been updated to ${newStatus.replace('_', ' ').toLowerCase()}.`;
          type = 'INFO';
          priority = 'MEDIUM';
      }

      // Add admin notes to message if provided
      if (adminNotes && adminNotes.trim()) {
        message += ` Admin message: "${adminNotes}"`;
      }

      // Create in-app notification
      console.log('🔔 UserNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        userId,
        title,
        message,
        type,
        {
          userRole: 'USER',
          category: 'REPORT_STATUS_UPDATE',
          priority: priority,
          reportId: reportId,
          reportTitle: reportTitle,
          data: { 
            oldStatus, 
            newStatus, 
            adminNotes: adminNotes || null 
          }
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification only for IN_PROGRESS and RESOLVED statuses
      if (newStatus === 'IN_PROGRESS' || newStatus === 'RESOLVED') {
        console.log('📧 UserNotificationService: Sending email notification...');
        try {
          const emailData = await this.getReportStatusUpdateEmailData(user.firstName, reportTitle, newStatus, adminNotes);
          const result = await EnhancedEmailNotificationService.sendEmailNotification(
            user._id,
            'USER',
            user.email,
            user.firstName,
            'REPORT_STATUS_UPDATE',
            emailData,
            'MEDIUM',
            notification._id
          );
          
          if (result.sent) {
            console.log('✅ UserNotificationService: Report status update email sent successfully');
          } else if (result.queued) {
            console.log('📝 UserNotificationService: Report status update email queued (announcements emails disabled)');
          }
        } catch (emailError) {
          console.error('❌ UserNotificationService: Failed to send report status update email:', emailError.message);
          console.error('❌ UserNotificationService: Email error details:', emailError);
          // Don't throw the error - continue with in-app notification
        }
      } else {
        console.log(`📝 UserNotificationService: Status is ${newStatus}, skipping email (only IN_PROGRESS and RESOLVED send emails)`);
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending report status update notification:', error);
      throw error;
    }
  }

  /**
   * Send admin response notification to user
   */
  static async sendReportAdminResponseNotification(userId, reportId, reportTitle, adminNotes) {
    try {
      console.log('🔔 UserNotificationService: Starting admin response notification for user:', userId);
      
      // Get user details
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
        '💬 Admin Response',
        `You received a response from our admin team regarding your report "${reportTitle}". Message: "${adminNotes}"`,
        'INFO',
        {
          userRole: 'USER',
          category: 'REPORT_ADMIN_RESPONSE',
          priority: 'HIGH',
          reportId: reportId,
          reportTitle: reportTitle,
          data: { adminNotes }
        }
      );
      console.log('✅ UserNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 UserNotificationService: Sending email notification...');
      try {
        const emailData = await this.getAdminResponseEmailData(user.firstName, reportTitle, adminNotes);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          user._id,
          'USER',
          user.email,
          user.firstName,
          'ADMIN_RESPONSE',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ UserNotificationService: Admin response email sent successfully');
        } else if (result.queued) {
          console.log('📝 UserNotificationService: Admin response email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ UserNotificationService: Failed to send admin response email:', emailError.message);
        console.error('❌ UserNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ UserNotificationService: Error sending admin response notification:', error);
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
        from: EmailService.getFromEmail(),
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

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send profile change email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Profile change email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending profile change email:', error.message);
      throw error;
    }
  }

  /**
   * Send email notification for report status updates
   */
  static async sendReportStatusUpdateEmail(email, firstName, reportTitle, newStatus, adminNotes = null) {
    try {
      const statusText = newStatus.replace('_', ' ').toLowerCase();
      const statusColor = newStatus === 'RESOLVED' ? '#28a745' : '#4A90E2';
      const statusIcon = newStatus === 'RESOLVED' ? '✅' : newStatus === 'IN_PROGRESS' ? '🔧' : '📋';

      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: `${statusIcon} Report Status Update - ${statusText}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">${statusIcon} Report Status Update</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
                <h3 style="color: ${statusColor}; margin: 0 0 10px 0;">Report Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${reportTitle}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText.toUpperCase()} ${statusIcon}</span></p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              ${adminNotes ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                <h3 style="color: #495057; margin: 0 0 10px 0;">Admin Message:</h3>
                <p style="margin: 0; color: #495057; font-style: italic;">"${adminNotes}"</p>
              </div>
              ` : ''}
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                ${newStatus === 'RESOLVED' ? 'Great news! Your report has been resolved.' : 
                  newStatus === 'IN_PROGRESS' ? 'Our team is now reviewing your report.' : 
                  'Your report status has been updated.'}
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/help" 
                   style="background-color: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Reports
                </a>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                Thank you for using Ads2Go!
              </p>
            </div>
          </div>
        `
      };

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send report status update email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Report status update email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending report status update email:', error.message);
      throw error;
    }
  }

  /**
   * Send email notification for admin responses
   */
  static async sendReportAdminResponseEmail(email, firstName, reportTitle, adminNotes) {
    try {
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: '💬 Admin Response to Your Report',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">💬 Admin Response</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
                <h3 style="color: #4A90E2; margin: 0 0 10px 0;">Report Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Title:</strong> ${reportTitle}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin: 0 0 10px 0;">Admin Response:</h3>
                <p style="margin: 0; color: #856404; font-style: italic;">"${adminNotes}"</p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                Our admin team has responded to your report. Please review their message above.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/help" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Reports
                </a>
              </div>
              
              <p style="text-align: center; color: #999; margin-top: 20px; font-size: 14px;">
                Thank you for using Ads2Go!
              </p>
            </div>
          </div>
        `
      };

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send admin response email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Admin response email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending admin response email:', error.message);
      throw error;
    }
  }
}

module.exports = UserNotificationService;