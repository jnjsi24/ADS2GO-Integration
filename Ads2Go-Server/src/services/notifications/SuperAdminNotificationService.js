const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');

class SuperAdminNotificationService extends BaseNotificationService {
  /**
   * Send critical system issue notification to superadmins
   */
  static async sendCriticalSystemIssueNotification(issue, description) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      
      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '🚨 Critical System Issue',
          `${issue}: ${description}`,
          'ERROR',
          {
            userRole: 'SUPERADMIN',
            category: 'CRITICAL_ISSUE',
            priority: 'HIGH',
            data: { issue, description }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending critical system issue notification:', error);
      throw error;
    }
  }

  /**
   * Send admin activity notification to superadmins
   */
  static async sendAdminActivityNotification(adminId, activity, details) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      
      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '👨‍💼 Admin Activity',
          `Admin ${admin.firstName} ${admin.lastName} performed: ${activity}`,
          'INFO',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTIVITY',
            priority: 'MEDIUM',
            data: { adminName: `${admin.firstName} ${admin.lastName}`, activity, details }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending admin activity notification:', error);
      throw error;
    }
  }

  /**
   * Send system report notification to superadmins
   */
  static async sendSystemReportNotification(reportType, summary) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      
      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '📊 System Report',
          `${reportType} report generated: ${summary}`,
          'INFO',
          {
            userRole: 'SUPERADMIN',
            category: 'SYSTEM_REPORT',
            priority: 'MEDIUM',
            data: { reportType, summary }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending system report notification:', error);
      throw error;
    }
  }

  /**
   * Send security alert notification to superadmins
   */
  static async sendSecurityAlertNotification(alert, details) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      
      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '🔒 Security Alert',
          `${alert}: ${details}`,
          'ERROR',
          {
            userRole: 'SUPERADMIN',
            category: 'SECURITY_ALERT',
            priority: 'HIGH',
            data: { alert, details }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending security alert notification:', error);
      throw error;
    }
  }

  /**
   * Send database issue notification to superadmins
   */
  static async sendDatabaseIssueNotification(issue, details) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      
      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '🗄️ Database Issue',
          `${issue}: ${details}`,
          'ERROR',
          {
            userRole: 'SUPERADMIN',
            category: 'DATABASE_ISSUE',
            priority: 'HIGH',
            data: { issue, details }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending database issue notification:', error);
      throw error;
    }
  }

  /**
   * Send ad approval notification to superadmins
   */
  static async sendAdApprovalBySuperAdmin(adId, adminId) {
    try {
      console.log('🔔 SuperAdminNotificationService: sendAdApprovalBySuperAdmin called');
      console.log('🔔 AdId:', adId, 'AdminId:', adminId);
      
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Ad = require('../../models/Ad');
      
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) {
        console.error('❌ SuperAdminNotificationService: Ad not found:', adId);
        throw new Error('Ad not found');
      }
      console.log('✅ SuperAdminNotificationService: Found ad:', ad.title);

      const admin = await Admin.findById(adminId);
      if (!admin) {
        console.error('❌ SuperAdminNotificationService: Admin not found:', adminId);
        throw new Error('Admin not found');
      }
      console.log('✅ SuperAdminNotificationService: Found admin:', admin.firstName, admin.lastName);

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const advertiserName = ad.userId ? `${ad.userId.firstName} ${ad.userId.lastName}` : 'Unknown';

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      console.log('🔔 SuperAdminNotificationService: Found', superAdmins.length, 'active superadmins');
      
      if (superAdmins.length === 0) {
        console.warn('⚠️ SuperAdminNotificationService: No active superadmins found!');
        return [];
      }

      const notifications = [];
      for (const superAdmin of superAdmins) {
        console.log('🔔 SuperAdminNotificationService: Creating notification for superadmin:', superAdmin._id, superAdmin.email);
        const notification = await this.createNotification(
          superAdmin._id,
          '✅ Ad Approved by Admin',
          `Admin ${adminName} approved the ad "${ad.title}" from ${advertiserName}`,
          'SUCCESS',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              adminName, 
              action: 'APPROVED',
              itemType: 'AD',
              advertiserName,
              adTitle: ad.title
            }
          }
        );
        console.log('✅ SuperAdminNotificationService: Notification created successfully');
        notifications.push(notification);
      }

      console.log('✅ SuperAdminNotificationService: Created', notifications.length, 'notifications total');
      return notifications;
    } catch (error) {
      console.error('❌ SuperAdminNotificationService: Error sending ad approval notification to superadmins:', error);
      console.error('❌ SuperAdminNotificationService: Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Send ad rejection notification to superadmins
   */
  static async sendAdRejectionBySuperAdmin(adId, adminId, reason) {
    try {
      console.log('🔔 SuperAdminNotificationService: sendAdRejectionBySuperAdmin called');
      console.log('🔔 AdId:', adId, 'AdminId:', adminId, 'Reason:', reason);
      
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Ad = require('../../models/Ad');
      
      const ad = await Ad.findById(adId).populate('userId');
      if (!ad) {
        console.error('❌ SuperAdminNotificationService: Ad not found:', adId);
        throw new Error('Ad not found');
      }
      console.log('✅ SuperAdminNotificationService: Found ad:', ad.title);

      const admin = await Admin.findById(adminId);
      if (!admin) {
        console.error('❌ SuperAdminNotificationService: Admin not found:', adminId);
        throw new Error('Admin not found');
      }
      console.log('✅ SuperAdminNotificationService: Found admin:', admin.firstName, admin.lastName);

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const advertiserName = ad.userId ? `${ad.userId.firstName} ${ad.userId.lastName}` : 'Unknown';

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      console.log('🔔 SuperAdminNotificationService: Found', superAdmins.length, 'active superadmins');
      
      if (superAdmins.length === 0) {
        console.warn('⚠️ SuperAdminNotificationService: No active superadmins found!');
        return [];
      }

      const notifications = [];
      for (const superAdmin of superAdmins) {
        console.log('🔔 SuperAdminNotificationService: Creating notification for superadmin:', superAdmin._id, superAdmin.email);
        const notification = await this.createNotification(
          superAdmin._id,
          '❌ Ad Rejected by Admin',
          `Admin ${adminName} rejected the ad "${ad.title}" from ${advertiserName}. Reason: ${reason}`,
          'WARNING',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            adId: ad._id,
            adTitle: ad.title,
            data: { 
              adminName, 
              action: 'REJECTED',
              itemType: 'AD',
              advertiserName,
              adTitle: ad.title,
              reason
            }
          }
        );
        console.log('✅ SuperAdminNotificationService: Notification created successfully');
        notifications.push(notification);
      }

      console.log('✅ SuperAdminNotificationService: Created', notifications.length, 'notifications total');
      return notifications;
    } catch (error) {
      console.error('❌ SuperAdminNotificationService: Error sending ad rejection notification to superadmins:', error);
      console.error('❌ SuperAdminNotificationService: Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Send driver approval notification to superadmins
   */
  static async sendDriverApprovalBySuperAdmin(driverId, adminId) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Driver = require('../../models/Driver');
      
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const driverName = `${driver.firstName} ${driver.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '✅ Driver Approved by Admin',
          `Admin ${adminName} approved driver ${driverName} (ID: ${driver.driverId})`,
          'SUCCESS',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'APPROVED',
              itemType: 'DRIVER',
              driverName,
              driverId: driver.driverId
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending driver approval notification to superadmins:', error);
      throw error;
    }
  }

  /**
   * Send driver rejection notification to superadmins
   */
  static async sendDriverRejectionBySuperAdmin(driverId, adminId, reason) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Driver = require('../../models/Driver');
      
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const driverName = `${driver.firstName} ${driver.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '❌ Driver Rejected by Admin',
          `Admin ${adminName} rejected driver ${driverName} (ID: ${driver.driverId}). Reason: ${reason}`,
          'WARNING',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'REJECTED',
              itemType: 'DRIVER',
              driverName,
              driverId: driver.driverId,
              reason
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending driver rejection notification to superadmins:', error);
      throw error;
    }
  }

  /**
   * Send material approval notification to superadmins
   */
  static async sendMaterialApprovalBySuperAdmin(materialId, adminId) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Material = require('../../models/Material');
      
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '✅ Material Approved by Admin',
          `Admin ${adminName} approved material ${material.materialId} (${material.materialType})`,
          'SUCCESS',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'APPROVED',
              itemType: 'MATERIAL',
              materialId: material.materialId,
              materialType: material.materialType
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending material approval notification to superadmins:', error);
      throw error;
    }
  }

  /**
   * Send material rejection notification to superadmins
   */
  static async sendMaterialRejectionBySuperAdmin(materialId, adminId, reason) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const Material = require('../../models/Material');
      
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '❌ Material Rejected by Admin',
          `Admin ${adminName} rejected material ${material.materialId} (${material.materialType}). Reason: ${reason}`,
          'WARNING',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'REJECTED',
              itemType: 'MATERIAL',
              materialId: material.materialId,
              materialType: material.materialType,
              reason
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending material rejection notification to superadmins:', error);
      throw error;
    }
  }

  /**
   * Send user approval notification to superadmins
   */
  static async sendUserApprovalBySuperAdmin(userId, adminId) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const User = require('../../models/User');
      
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const userName = `${user.firstName} ${user.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '✅ User Approved by Admin',
          `Admin ${adminName} approved user ${userName} (${user.email})`,
          'SUCCESS',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'APPROVED',
              itemType: 'USER',
              userName,
              userEmail: user.email
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending user approval notification to superadmins:', error);
      throw error;
    }
  }

  /**
   * Send user rejection notification to superadmins
   */
  static async sendUserRejectionBySuperAdmin(userId, adminId, reason) {
    try {
      const SuperAdmin = require('../../models/SuperAdmin');
      const Admin = require('../../models/Admin');
      const User = require('../../models/User');
      
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const admin = await Admin.findById(adminId);
      if (!admin) throw new Error('Admin not found');

      const adminName = `${admin.firstName} ${admin.lastName}`;
      const userName = `${user.firstName} ${user.lastName}`;

      // Get all active superadmins
      const superAdmins = await SuperAdmin.find({ isActive: true });
      
      const notifications = [];
      for (const superAdmin of superAdmins) {
        const notification = await this.createNotification(
          superAdmin._id,
          '❌ User Rejected by Admin',
          `Admin ${adminName} rejected user ${userName} (${user.email}). Reason: ${reason}`,
          'WARNING',
          {
            userRole: 'SUPERADMIN',
            category: 'ADMIN_ACTION',
            priority: 'HIGH',
            data: { 
              adminName, 
              action: 'REJECTED',
              itemType: 'USER',
              userName,
              userEmail: user.email,
              reason
            }
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending user rejection notification to superadmins:', error);
      throw error;
    }
  }
}

module.exports = SuperAdminNotificationService;
