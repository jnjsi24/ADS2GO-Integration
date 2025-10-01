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
}

module.exports = SuperAdminNotificationService;
