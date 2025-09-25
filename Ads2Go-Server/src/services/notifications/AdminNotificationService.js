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
   * Send new material creation notification to admins
   */
  static async sendNewMaterialCreatedNotification(materialId) {
    try {
      const Material = require('../../models/Material');
      const Admin = require('../../models/Admin');
      
      const material = await Material.findById(materialId).populate('driverId');
      if (!material) throw new Error('Material not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '📦 New Material Created',
          `New material "${material.materialId}" created by ${material.driverId ? material.driverId.firstName + ' ' + material.driverId.lastName : 'System'}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_MATERIAL_CREATED',
            priority: 'MEDIUM',
            data: { 
              materialId: material.materialId,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              driverName: material.driverId ? `${material.driverId.firstName} ${material.driverId.lastName}` : 'System'
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new material creation notification:', error);
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
   * Send payment success notification to admins
   */
  static async sendPaymentSuccessNotification(paymentId) {
    try {
      const Payment = require('../../models/Payment');
      const Admin = require('../../models/Admin');
      
      const payment = await Payment.findById(paymentId).populate('adsId userId');
      if (!payment) throw new Error('Payment not found');

      const ad = payment.adsId;
      const user = payment.userId;
      
      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '💳 Payment Successful',
          `Payment of ₱${payment.amount} received for "${ad.title}" from ${user.firstName} ${user.lastName}`,
          'SUCCESS',
          {
            userRole: 'ADMIN',
            category: 'PAYMENT_SUCCESS',
            priority: 'MEDIUM',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              userName: `${user.firstName} ${user.lastName}`, 
              userEmail: user.email,
              amount: payment.amount,
              paymentType: payment.paymentType
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending payment success notification:', error);
      throw error;
    }
  }

  /**
   * Send payment failure notification to admins (7-day deadline exceeded)
   */
  static async sendPaymentFailureNotification(adId) {
    try {
      const Ad = require('../../models/Ad');
      const Admin = require('../../models/Admin');
      
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) throw new Error('Ad not found');

      const user = ad.userId;
      
      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '⚠️ Payment Failed - 7 Day Deadline',
          `Payment deadline exceeded for "${ad.title}" from ${user.firstName} ${user.lastName}. Ad will be deactivated.`,
          'ERROR',
          {
            userRole: 'ADMIN',
            category: 'PAYMENT_FAILURE',
            priority: 'HIGH',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              userName: `${user.firstName} ${user.lastName}`, 
              userEmail: user.email,
              amount: ad.totalPrice,
              approveTime: ad.approveTime
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending payment failure notification:', error);
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
