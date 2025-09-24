const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');

class AdminNotificationService extends BaseNotificationService {
  /**
   * Send new ad submission notification to admins
   */
  static async sendNewAdSubmissionNotification(adId) {
    try {
      const Ad = require('../../models/Ad');
      const Admin = require('../../models/Admin');
      
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) throw new Error('Ad not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '📝 New Ad Submission',
          `New advertisement "${ad.title}" submitted by ${ad.userId.firstName} ${ad.userId.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_AD_SUBMISSION',
            priority: 'MEDIUM',
            adId: ad._id,
            adTitle: ad.title,
            data: { submitterName: `${ad.userId.firstName} ${ad.userId.lastName}` }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new ad submission notification:', error);
      throw error;
    }
  }

  /**
   * Send new driver application notification to admins
   */
  static async sendNewDriverApplicationNotification(driverId) {
    try {
      const Driver = require('../../models/Driver');
      const Admin = require('../../models/Admin');
      
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '👤 New Driver Application',
          `New driver application from ${driver.firstName} ${driver.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_DRIVER_APPLICATION',
            priority: 'MEDIUM',
            data: { driverName: `${driver.firstName} ${driver.lastName}` }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new driver application notification:', error);
      throw error;
    }
  }

  /**
   * Send new user registration notification to admins
   */
  static async sendNewUserRegistrationNotification(userId) {
    try {
      const User = require('../../models/User');
      const Admin = require('../../models/Admin');
      
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '👤 New User Registration',
          `New user registered: ${user.firstName} ${user.lastName} (${user.email})`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_USER_REGISTRATION',
            priority: 'LOW',
            data: { userName: `${user.firstName} ${user.lastName}`, userEmail: user.email }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new user registration notification:', error);
      throw error;
    }
  }

  /**
   * Send payment issue notification to admins
   */
  static async sendPaymentIssueNotification(issue, details) {
    try {
      const Admin = require('../../models/Admin');
      
      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '💳 Payment Issue',
          `Payment issue detected: ${issue}`,
          'WARNING',
          {
            userRole: 'ADMIN',
            category: 'PAYMENT_ISSUE',
            priority: 'HIGH',
            data: { issue, details }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending payment issue notification:', error);
      throw error;
    }
  }

  /**
   * Send system alert notification to admins
   */
  static async sendSystemAlertNotification(alert, description) {
    try {
      const Admin = require('../../models/Admin');
      
      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '🚨 System Alert',
          `${alert}: ${description}`,
          'WARNING',
          {
            userRole: 'ADMIN',
            category: 'SYSTEM_ALERT',
            priority: 'HIGH',
            data: { alert, description }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending system alert notification:', error);
      throw error;
    }
  }
}

module.exports = AdminNotificationService;
