const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');
const EnhancedEmailNotificationService = require('./EnhancedEmailNotificationService');

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

  /**
   * Send new user report notification to admins
   */
  static async sendNewUserReportNotification(userId, reportId, reportType, title) {
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
          '📋 New User Report',
          `New ${reportType.replace('_', ' ').toLowerCase()} report "${title}" submitted by ${user.firstName} ${user.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_USER_REPORT',
            priority: 'MEDIUM',
            reportId: reportId,
            reportType: reportType,
            reportTitle: title,
            data: { 
              submitterName: `${user.firstName} ${user.lastName}`,
              submitterEmail: user.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new user report notification:', error);
      throw error;
    }
  }

  /**
   * Send new driver report notification to admins
   */
  static async sendNewDriverReportNotification(driverId, reportId, reportType, title) {
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
          '📋 New Driver Report',
          `New ${reportType.replace('_', ' ').toLowerCase()} report "${title}" submitted by ${driver.firstName} ${driver.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_DRIVER_REPORT',
            priority: 'MEDIUM',
            reportId: reportId,
            reportType: reportType,
            reportTitle: title,
            data: { 
              submitterName: `${driver.firstName} ${driver.lastName}`,
              submitterEmail: driver.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new driver report notification:', error);
      throw error;
    }
  }

  /**
   * Send admin responded to report notification to admins
   */
  static async sendAdminRespondedToReportNotification(adminId, reportId, reportType, reportTitle, reporterName) {
    try {
      const Admin = require('../../models/Admin');
      
      const respondingAdmin = await Admin.findById(adminId);
      if (!respondingAdmin) throw new Error('Admin not found');

      // Get all active admins EXCEPT the one who responded
      const admins = await Admin.find({ isActive: true, _id: { $ne: adminId } });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '💬 Admin Responded to Report',
          `${respondingAdmin.firstName} ${respondingAdmin.lastName} added notes to ${reportType.toLowerCase()} report "${reportTitle}" from ${reporterName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'ADMIN_RESPONDED_TO_REPORT',
            priority: 'LOW',
            reportId: reportId,
            data: { 
              respondingAdminName: `${respondingAdmin.firstName} ${respondingAdmin.lastName}`,
              reportType: reportType,
              reportTitle: reportTitle,
              reporterName: reporterName
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending admin responded to report notification:', error);
      throw error;
    }
  }

  /**
   * Send ad campaign started notification to admins
   */
  static async sendAdCampaignStartedNotification(adId) {
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
          '🚀 Ad Campaign Started',
          `Ad campaign "${ad.title}" by ${ad.userId.firstName} ${ad.userId.lastName} has started running`,
          'SUCCESS',
          {
            userRole: 'ADMIN',
            category: 'AD_CAMPAIGN_STARTED',
            priority: 'LOW',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              userName: `${ad.userId.firstName} ${ad.userId.lastName}`,
              startDate: ad.startDate
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending ad campaign started notification:', error);
      throw error;
    }
  }

  /**
   * Send ad campaign ended notification to admins
   */
  static async sendAdCampaignEndedNotification(adId) {
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
          '🏁 Ad Campaign Ended',
          `Ad campaign "${ad.title}" by ${ad.userId.firstName} ${ad.userId.lastName} has completed`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'AD_CAMPAIGN_ENDED',
            priority: 'LOW',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              userName: `${ad.userId.firstName} ${ad.userId.lastName}`,
              endDate: ad.endDate
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending ad campaign ended notification:', error);
      throw error;
    }
  }

  /**
   * Send material assigned to driver notification to admins
   */
  static async sendMaterialAssignedNotification(materialId, driverId) {
    try {
      const Material = require('../../models/Material');
      const Driver = require('../../models/Driver');
      const Admin = require('../../models/Admin');
      
      const material = await Material.findById(materialId);
      const driver = await Driver.findById(driverId);
      
      if (!material) throw new Error('Material not found');
      if (!driver) throw new Error('Driver not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '🔗 Material Assigned',
          `Material "${material.materialId}" assigned to driver ${driver.firstName} ${driver.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'MATERIAL_ASSIGNED',
            priority: 'LOW',
            data: { 
              materialId: material.materialId,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              driverName: `${driver.firstName} ${driver.lastName}`,
              driverEmail: driver.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending material assigned notification:', error);
      throw error;
    }
  }

  /**
   * Send material unassigned from driver notification to admins
   */
  static async sendMaterialUnassignedNotification(materialId, driverId) {
    try {
      const Material = require('../../models/Material');
      const Driver = require('../../models/Driver');
      const Admin = require('../../models/Admin');
      
      const material = await Material.findById(materialId);
      const driver = await Driver.findById(driverId);
      
      if (!material) throw new Error('Material not found');
      if (!driver) throw new Error('Driver not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '🔓 Material Unassigned',
          `Material "${material.materialId}" unassigned from driver ${driver.firstName} ${driver.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'MATERIAL_UNASSIGNED',
            priority: 'LOW',
            data: { 
              materialId: material.materialId,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              driverName: `${driver.firstName} ${driver.lastName}`,
              driverEmail: driver.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending material unassigned notification:', error);
      throw error;
    }
  }

  /**
   * Send material photos uploaded notification to admins
   */
  static async sendMaterialPhotosUploadedNotification(materialId, driverId, photoCount) {
    try {
      const Material = require('../../models/Material');
      const Driver = require('../../models/Driver');
      const Admin = require('../../models/Admin');
      
      const material = await Material.findById(materialId);
      const driver = await Driver.findById(driverId);
      
      if (!material) throw new Error('Material not found');
      if (!driver) throw new Error('Driver not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '📸 Material Photos Uploaded',
          `Driver ${driver.firstName} ${driver.lastName} uploaded ${photoCount} compliance photo(s) for material "${material.materialId}"`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'MATERIAL_PHOTOS_UPLOADED',
            priority: 'MEDIUM',
            data: { 
              materialId: material.materialId,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              driverName: `${driver.firstName} ${driver.lastName}`,
              driverEmail: driver.email,
              photoCount: photoCount
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending material photos uploaded notification:', error);
      throw error;
    }
  }

  /**
   * Send company ad created notification to admins
   */
  static async sendCompanyAdCreatedNotification(companyAdId, creatorAdminId) {
    try {
      const CompanyAd = require('../../models/CompanyAd');
      const Admin = require('../../models/Admin');
      
      const companyAd = await CompanyAd.findById(companyAdId);
      const creatorAdmin = await Admin.findById(creatorAdminId);
      
      if (!companyAd) throw new Error('Company ad not found');
      if (!creatorAdmin) throw new Error('Creator admin not found');

      // Get all active admins EXCEPT the one who created it
      const admins = await Admin.find({ isActive: true, _id: { $ne: creatorAdminId } });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '🎬 Company Ad Created',
          `${creatorAdmin.firstName} ${creatorAdmin.lastName} created company ad "${companyAd.title}"`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'COMPANY_AD_CREATED',
            priority: 'LOW',
            data: { 
              companyAdTitle: companyAd.title,
              companyAdFormat: companyAd.format,
              creatorName: `${creatorAdmin.firstName} ${creatorAdmin.lastName}`,
              creatorEmail: creatorAdmin.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending company ad created notification:', error);
      throw error;
    }
  }

  /**
   * Send newsletter sent notification to admins
   */
  static async sendNewsletterSentNotification(newsletterId, senderAdminId, recipientCount) {
    try {
      const Newsletter = require('../../models/Newsletter');
      const Admin = require('../../models/Admin');
      
      const newsletter = await Newsletter.findById(newsletterId);
      const senderAdmin = await Admin.findById(senderAdminId);
      
      if (!newsletter) throw new Error('Newsletter not found');
      if (!senderAdmin) throw new Error('Sender admin not found');

      // Get all active admins EXCEPT the one who sent it
      const admins = await Admin.find({ isActive: true, _id: { $ne: senderAdminId } });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '📧 Newsletter Sent',
          `${senderAdmin.firstName} ${senderAdmin.lastName} sent newsletter "${newsletter.subject}" to ${recipientCount} recipients`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEWSLETTER_SENT',
            priority: 'LOW',
            data: { 
              newsletterSubject: newsletter.subject,
              recipientCount: recipientCount,
              recipientType: newsletter.recipientType,
              senderName: `${senderAdmin.firstName} ${senderAdmin.lastName}`,
              senderEmail: senderAdmin.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending newsletter sent notification:', error);
      throw error;
    }
  }

  /**
   * Send new admin created notification to admins (sent to existing admins when a new admin joins)
   */
  static async sendNewAdminCreatedNotification(newAdminId, creatorAdminId) {
    try {
      const Admin = require('../../models/Admin');
      
      const newAdmin = await Admin.findById(newAdminId);
      const creatorAdmin = await Admin.findById(creatorAdminId);
      
      if (!newAdmin) throw new Error('New admin not found');
      if (!creatorAdmin) throw new Error('Creator admin not found');

      // Get all active admins EXCEPT the new one and the creator
      const admins = await Admin.find({ 
        isActive: true, 
        _id: { $nin: [newAdminId, creatorAdminId] } 
      });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '👤 New Admin Created',
          `${creatorAdmin.firstName} ${creatorAdmin.lastName} created new admin account for ${newAdmin.firstName} ${newAdmin.lastName}`,
          'INFO',
          {
            userRole: 'ADMIN',
            category: 'NEW_ADMIN_CREATED',
            priority: 'MEDIUM',
            data: { 
              newAdminName: `${newAdmin.firstName} ${newAdmin.lastName}`,
              newAdminEmail: newAdmin.email,
              creatorName: `${creatorAdmin.firstName} ${creatorAdmin.lastName}`,
              creatorEmail: creatorAdmin.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending new admin created notification:', error);
      throw error;
    }
  }

  /**
   * Send monthly photo due today notification to admins
   */
  static async sendMonthlyPhotoDueTodayNotification(materialId, driverId, dueDate) {
    try {
      const Material = require('../../models/Material');
      const Driver = require('../../models/Driver');
      const Admin = require('../../models/Admin');
      
      const material = await Material.findOne({ materialId });
      const driver = await Driver.findById(driverId);
      
      if (!material) throw new Error('Material not found');
      if (!driver) throw new Error('Driver not found');

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification(
          admin._id,
          '📸 Monthly Photo Due Today',
          `Driver ${driver.firstName} ${driver.lastName}'s monthly compliance photo for material "${materialId}" is due today (${dueDateFormatted}). Please ensure the driver uploads the required photos.`,
          'WARNING',
          {
            userRole: 'ADMIN',
            category: 'MONTHLY_PHOTO_DUE_TODAY',
            priority: 'HIGH',
            data: { 
              materialId,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              driverName: `${driver.firstName} ${driver.lastName}`,
              driverEmail: driver.email,
              driverId: driver.driverId,
              dueDate: new Date(dueDate).toISOString(),
              timestamp: new Date().toISOString()
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending monthly photo due today notification:', error);
      throw error;
    }
  }
}

module.exports = AdminNotificationService;
