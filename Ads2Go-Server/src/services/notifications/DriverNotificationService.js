const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');
const EnhancedEmailNotificationService = require('./EnhancedEmailNotificationService');

class DriverNotificationService extends BaseNotificationService {
  /**
   * Send material assignment notification to driver
   */
  static async sendMaterialAssignmentNotification(driverId, materialId, materialName) {
    try {
      const Driver = require('../../models/Driver');
      const Material = require('../../models/Material');
      
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      // Create in-app notification
      const notification = await this.createNotification(
        driver._id,
        '🚚 Material Assigned!',
        `You have been assigned to material: ${materialName || material.materialId}`,
        'SUCCESS',
        {
          userRole: 'DRIVER',
          category: 'MATERIAL_ASSIGNMENT',
          priority: 'HIGH',
          data: { materialId, materialName }
        }
      );

      // Send email notification
      await this.sendMaterialAssignmentEmail(driver.email, driver.firstName, materialName);

      return notification;
    } catch (error) {
      console.error('Error sending material assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send driver status change notification
   */
  static async sendDriverStatusChangeNotification(driverId, status, reason = null) {
    try {
      console.log('🔔 DriverNotificationService: Starting driver status change notification for driver:', driverId);
      
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) {
        console.error('❌ DriverNotificationService: Driver not found:', driverId);
        throw new Error('Driver not found');
      }

      console.log('👤 DriverNotificationService: Found driver:', driver.firstName, driver.lastName, driver.email);

      const statusMessages = {
        'APPROVED': '🎉 Congratulations! Your driver application has been approved!',
        'REJECTED': '❌ Your driver application has been rejected.',
        'SUSPENDED': '⚠️ Your driver account has been suspended.',
        'ACTIVE': '✅ Your driver account is now active!'
      };

      // Create in-app notification
      console.log('🔔 DriverNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        driver._id,
        '📋 Driver Status Update',
        statusMessages[status] + (reason ? ` Reason: ${reason}` : ''),
        status === 'APPROVED' || status === 'ACTIVE' ? 'SUCCESS' : 'WARNING',
        {
          userRole: 'DRIVER',
          category: 'DRIVER_STATUS_CHANGE',
          priority: 'HIGH',
          data: { status, reason }
        }
      );
      console.log('✅ DriverNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 DriverNotificationService: Sending email notification...');
      try {
        const emailData = await this.getDriverStatusChangeEmailData(driver.firstName, status, reason);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          driver._id,
          'DRIVER',
          driver.email,
          driver.firstName,
          'DRIVER_STATUS_CHANGE',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ DriverNotificationService: Driver status change email sent successfully');
        } else if (result.queued) {
          console.log('📝 DriverNotificationService: Driver status change email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ DriverNotificationService: Failed to send driver status change email:', emailError.message);
        console.error('❌ DriverNotificationService: Email error details:', emailError);
        // Fallback to direct email if enhanced service fails
        try {
          await this.sendDriverStatusChangeEmail(driver.email, driver.firstName, status, reason);
          console.log('✅ DriverNotificationService: Fallback email sent successfully');
        } catch (fallbackError) {
          console.error('❌ DriverNotificationService: Fallback email also failed:', fallbackError);
          // Don't throw the error - continue with in-app notification
        }
      }

      return notification;
    } catch (error) {
      console.error('❌ DriverNotificationService: Error sending driver status change notification:', error);
      throw error;
    }
  }

  /**
   * Send route update notification
   */
  static async sendRouteUpdateNotification(driverId, routeDetails) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const notification = await this.createNotification(
        driver._id,
        '📍 Route Updated',
        `Your route has been updated. Check your dashboard for new details.`,
        'INFO',
        {
          userRole: 'DRIVER',
          category: 'ROUTE_UPDATE',
          priority: 'MEDIUM',
          data: routeDetails
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending route update notification:', error);
      throw error;
    }
  }

  /**
   * Send device connectivity issue notification
   */
  static async sendDeviceIssueNotification(driverId, deviceId, issue) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const notification = await this.createNotification(
        driver._id,
        '⚠️ Device Issue',
        `Device ${deviceId} is experiencing connectivity issues: ${issue}`,
        'WARNING',
        {
          userRole: 'DRIVER',
          category: 'DEVICE_ISSUE',
          priority: 'HIGH',
          data: { deviceId, issue, timestamp: new Date().toISOString() }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending device issue notification:', error);
      throw error;
    }
  }

  /**
   * Send report status update notification to driver
   */
  static async sendReportStatusUpdateNotification(driverId, reportId, reportTitle, status, adminNotes = null, adminName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const statusMessages = {
        'PENDING': '📋 Your report is pending review',
        'IN_PROGRESS': '🔄 Your report is being reviewed',
        'RESOLVED': '✅ Your report has been resolved',
        'CLOSED': '❌ Your report has been closed'
      };

      let title = statusMessages[status] || '📋 Report Status Update';
      let message = `Your report "${reportTitle}" status has been updated to: ${status}`;
      
      if (adminNotes) {
        message += `\n\nAdmin Notes: ${adminNotes}`;
      }

      if (adminName) {
        message += `\n\nUpdated by: ${adminName}`;
      }

      const notificationType = status === 'RESOLVED' ? 'SUCCESS' : status === 'CLOSED' ? 'WARNING' : 'INFO';

      const notification = await this.createNotification(
        driver._id,
        title,
        message,
        notificationType,
        {
          userRole: 'DRIVER',
          category: 'REPORT_STATUS_UPDATE',
          priority: 'HIGH',
          data: { 
            reportId, 
            reportTitle, 
            status, 
            adminNotes, 
            adminName,
            timestamp: new Date().toISOString()
          }
        }
      );

      // Send email notification only for IN_PROGRESS and RESOLVED statuses
      if (status === 'IN_PROGRESS' || status === 'RESOLVED') {
        try {
          const emailData = await this.getDriverReportStatusUpdateEmailData(driver.firstName, reportTitle, status, adminNotes);
          const result = await EnhancedEmailNotificationService.sendEmailNotification(
            driver._id,
            'DRIVER',
            driver.email,
            driver.firstName,
            'REPORT_STATUS_UPDATE',
            emailData,
            'HIGH',
            notification._id
          );
          
          if (result.sent) {
            console.log(`✅ DriverNotificationService: Report status update email sent successfully (${status})`);
          } else if (result.queued) {
            console.log('📝 DriverNotificationService: Report status update email queued');
          }
        } catch (emailError) {
          console.error('❌ DriverNotificationService: Failed to send report status update email:', emailError.message);
          // Don't throw the error - continue with in-app notification
        }
      } else {
        console.log(`📝 DriverNotificationService: Status is ${status}, skipping email (only IN_PROGRESS and RESOLVED send emails)`);
      }

      return notification;
    } catch (error) {
      console.error('Error sending report status update notification:', error);
      throw error;
    }
  }

  /**
   * Send admin response notification to driver (when admin replies to driver report)
   */
  static async sendDriverReportAdminResponseNotification(driverId, reportId, reportTitle, adminNotes) {
    try {
      console.log('🔔 DriverNotificationService: Starting admin response notification for driver:', driverId);
      
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) {
        console.error('❌ DriverNotificationService: Driver not found:', driverId);
        throw new Error('Driver not found');
      }

      console.log('👤 DriverNotificationService: Found driver:', driver.firstName, driver.lastName, driver.email);

      // Create in-app notification
      console.log('🔔 DriverNotificationService: Creating in-app notification...');
      const notification = await this.createNotification(
        driverId,
        '💬 Admin Response',
        `You received a response from our admin team regarding your report "${reportTitle}". Message: "${adminNotes}"`,
        'INFO',
        {
          userRole: 'DRIVER',
          category: 'REPORT_ADMIN_RESPONSE',
          priority: 'HIGH',
          reportId: reportId,
          reportTitle: reportTitle,
          data: { adminNotes }
        }
      );
      console.log('✅ DriverNotificationService: In-app notification created');

      // Send email notification using enhanced service
      console.log('📧 DriverNotificationService: Sending email notification...');
      try {
        const emailData = await this.getDriverReportAdminResponseEmailData(driver.firstName, reportTitle, adminNotes);
        const result = await EnhancedEmailNotificationService.sendEmailNotification(
          driver._id,
          'DRIVER',
          driver.email,
          driver.firstName,
          'ADMIN_RESPONSE',
          emailData,
          'HIGH',
          notification._id
        );
        
        if (result.sent) {
          console.log('✅ DriverNotificationService: Admin response email sent successfully');
        } else if (result.queued) {
          console.log('📝 DriverNotificationService: Admin response email queued (announcements emails disabled)');
        }
      } catch (emailError) {
        console.error('❌ DriverNotificationService: Failed to send admin response email:', emailError.message);
        console.error('❌ DriverNotificationService: Email error details:', emailError);
        // Don't throw the error - continue with in-app notification
      }

      return notification;
    } catch (error) {
      console.error('❌ DriverNotificationService: Error sending admin response notification:', error);
      throw error;
    }
  }

  /**
   * Send material online notification to driver
   */
  static async sendMaterialOnlineNotification(driverId, materialId, materialName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const notification = await this.createNotification(
        driver._id,
        '🟢 Material Online',
        `Your assigned material ${materialName || materialId} is now online and ready!`,
        'SUCCESS',
        {
          userRole: 'DRIVER',
          category: 'MATERIAL_STATUS_CHANGE',
          priority: 'MEDIUM',
          data: { 
            materialId, 
            materialName, 
            status: 'ONLINE',
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending material online notification:', error);
      throw error;
    }
  }

  /**
   * Send material offline notification to driver
   */
  static async sendMaterialOfflineNotification(driverId, materialId, materialName = null, reason = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      let message = `Your assigned material ${materialName || materialId} has gone offline`;
      if (reason) {
        message += `. Reason: ${reason}`;
      }

      const notification = await this.createNotification(
        driver._id,
        '🔴 Material Offline',
        message,
        'WARNING',
        {
          userRole: 'DRIVER',
          category: 'MATERIAL_STATUS_CHANGE',
          priority: 'HIGH',
          data: { 
            materialId, 
            materialName, 
            status: 'OFFLINE',
            reason,
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending material offline notification:', error);
      throw error;
    }
  }

  /**
   * Send 8-hour milestone achievement notification to driver
   */
  static async send8HourMilestoneNotification(driverId, materialId, hours, materialName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const formattedHours = Math.round(hours * 100) / 100;

      const notification = await this.createNotification(
        driver._id,
        '🎯 8-Hour Milestone Achieved!',
        `Congratulations! Your material ${materialName || materialId} has been online for ${formattedHours} hours today. You've met the daily requirement!`,
        'SUCCESS',
        {
          userRole: 'DRIVER',
          category: 'HOURS_MILESTONE',
          priority: 'HIGH',
          data: { 
            materialId, 
            materialName, 
            hours: formattedHours,
            achievementType: '8_HOUR_MILESTONE',
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending 8-hour milestone notification:', error);
      throw error;
    }
  }

  /**
   * Send salary rate change notification to driver (when super admin updates driver salary rates)
   */
  static async sendSalaryRateChangeNotification(driverId, newDistanceRate, newHoursRate, effectiveAt) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const effectiveStr = effectiveAt ? new Date(effectiveAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '24 hours from now';
      const message = `Your salary rates have been updated. New rate: ₱${Number(newDistanceRate).toFixed(2)}/km (distance), ₱${Number(newHoursRate).toFixed(2)}/hour. The new rate will apply ${effectiveStr}. Previous periods are unchanged.`;

      const notification = await this.createNotification(
        driver._id,
        '💰 Salary Rate Updated',
        message,
        'INFO',
        {
          userRole: 'DRIVER',
          category: 'SALARY_RATE_CHANGE',
          priority: 'MEDIUM',
          data: {
            newDistanceRate: Number(newDistanceRate),
            newHoursRate: Number(newHoursRate),
            effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : null,
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending salary rate change notification:', error);
      throw error;
    }
  }

  /**
   * Send material assignment email to driver
   */
  static async sendMaterialAssignmentEmail(email, firstName, materialName) {
    try {
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: '🚚 Material Assignment - Ads2Go',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">🚚 Material Assignment</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
                <h3 style="color: #4A90E2; margin: 0 0 10px 0;">Assignment Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Material:</strong> ${materialName}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">ASSIGNED ✅</span></p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin: 0 0 10px 0;">📋 Important Instructions:</h3>
                <p style="margin: 5px 0; color: #856404; line-height: 1.6;">
                  Please proceed to the <strong>Ads2Go main office</strong> to install the device assigned to you. 
                  Our team will assist you with the installation process and provide you with all the necessary information.
                </p>
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                You have been assigned to a new material. Please visit our main office for device installation.
              </p>
            </div>
          </div>
        `
      };

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send material assignment email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Material assignment email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending material assignment email:', error.message);
      throw error;
    }
  }

  /**
   * Get email data for driver status change notification
   */
  static async getDriverStatusChangeEmailData(firstName, status, reason) {
    const statusMessages = {
      'APPROVED': '🎉 Congratulations! Your driver application has been approved!',
      'REJECTED': '❌ Your driver application has been rejected.',
      'SUSPENDED': '⚠️ Your driver account has been suspended.',
      'ACTIVE': '✅ Your driver account is now active!'
    };

    const statusColors = {
      'APPROVED': '#4CAF50',
      'REJECTED': '#dc3545',
      'SUSPENDED': '#ff9800',
      'ACTIVE': '#4CAF50'
    };

    const statusColor = statusColors[status] || '#4A90E2';

    return {
      subject: `Driver Status Update - ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Driver Status Update</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
              <h3 style="color: ${statusColor}; margin: 0 0 10px 0;">Status Update:</h3>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
              ${reason ? `<p style="margin: 5px 0; color: #333;"><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              ${statusMessages[status]}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/driver-dashboard" 
                 style="background-color: #F3A26D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Driver Dashboard
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
        status,
        reason
      }
    };
  }

  /**
   * Get email data for driver report status update notification
   */
  static async getDriverReportStatusUpdateEmailData(firstName, reportTitle, status, adminNotes) {
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
    
    const config = statusConfig[status] || statusConfig['PENDING'];
    const statusText = status.replace('_', ' ').toLowerCase();
    
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
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/driver-dashboard" 
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
        status,
        adminNotes
      }
    };
  }

  /**
   * Get email data for driver report admin response notification
   */
  static async getDriverReportAdminResponseEmailData(firstName, reportTitle, adminNotes) {
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
              <a href="${process.env.CLIENT_URL || 'https://ads2go.com'}/driver-dashboard" 
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
   * Send driver status change email (legacy method - kept for fallback)
   */
  static async sendDriverStatusChangeEmail(email, firstName, status, reason) {
    try {
      const emailData = await this.getDriverStatusChangeEmailData(firstName, status, reason);
      
      const mailOptions = {
        from: EmailService.getFromEmail(),
        to: email,
        subject: emailData.subject,
        html: emailData.html
      };

      const transporter = EmailService.getTransporter();
      if (!transporter) {
        console.error('❌ Cannot send driver status change email: Email service not configured');
        return;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Driver status change email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending driver status change email:', error.message);
      throw error;
    }
  }

  /**
   * Send monthly photo due reminder to driver (1 day before)
   */
  static async sendMonthlyPhotoDueReminderNotification(driverId, materialId, dueDate) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const notification = await this.createNotification(
        driver._id,
        '📸 Monthly Photo Due Tomorrow',
        `Your monthly compliance photo for material ${materialId} is due on ${dueDateFormatted}. Please upload your photos to stay compliant.`,
        'WARNING',
        {
          userRole: 'DRIVER',
          category: 'MONTHLY_PHOTO_DUE_REMINDER',
          priority: 'HIGH',
          data: { 
            materialId, 
            dueDate: new Date(dueDate).toISOString(),
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending monthly photo due reminder notification:', error);
      throw error;
    }
  }

  /**
   * Send monthly photo approved notification to driver
   */
  static async sendMonthlyPhotoApprovedNotification(driverId, materialId, month, adminNotes = null, adminName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const monthFormatted = new Date(month + '-01').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });

      let message = `Your monthly compliance photo for ${monthFormatted} (Material: ${materialId}) has been approved! ✅`;
      
      if (adminNotes) {
        message += `\n\nAdmin Notes: ${adminNotes}`;
      }

      if (adminName) {
        message += `\n\nApproved by: ${adminName}`;
      }

      const notification = await this.createNotification(
        driver._id,
        '✅ Monthly Photo Approved',
        message,
        'SUCCESS',
        {
          userRole: 'DRIVER',
          category: 'MONTHLY_PHOTO_APPROVED',
          priority: 'MEDIUM',
          data: { 
            materialId, 
            month, 
            adminNotes, 
            adminName,
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending monthly photo approved notification:', error);
      throw error;
    }
  }

  /**
   * Send monthly photo rejected notification to driver
   */
  static async sendMonthlyPhotoRejectedNotification(driverId, materialId, month, adminNotes = null, adminName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const monthFormatted = new Date(month + '-01').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });

      let message = `Your monthly compliance photo for ${monthFormatted} (Material: ${materialId}) was rejected. Please re-upload compliant photos.`;
      
      if (adminNotes) {
        message += `\n\nReason: ${adminNotes}`;
      }

      if (adminName) {
        message += `\n\nReviewed by: ${adminName}`;
      }

      const notification = await this.createNotification(
        driver._id,
        '❌ Monthly Photo Rejected',
        message,
        'ERROR',
        {
          userRole: 'DRIVER',
          category: 'MONTHLY_PHOTO_REJECTED',
          priority: 'HIGH',
          data: { 
            materialId, 
            month, 
            adminNotes, 
            adminName,
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending monthly photo rejected notification:', error);
      throw error;
    }
  }

  /**
   * Send daily compliance missed notification to driver (didn't reach 8 hours)
   */
  static async sendDailyComplianceMissedNotification(driverId, materialId, hours, materialName = null) {
    try {
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const formattedHours = Math.round(hours * 100) / 100;
      const hoursShort = Math.round((8 - hours) * 100) / 100;

      const notification = await this.createNotification(
        driver._id,
        '⚠️ Daily Compliance Missed',
        `Your material ${materialName || materialId} only reached ${formattedHours} hours today (${hoursShort}h short of the 8-hour requirement). Please ensure you meet the daily requirement tomorrow.`,
        'WARNING',
        {
          userRole: 'DRIVER',
          category: 'DAILY_COMPLIANCE_MISSED',
          priority: 'HIGH',
          data: { 
            materialId, 
            materialName, 
            hoursAchieved: formattedHours,
            hoursRequired: 8.0,
            hoursShort: hoursShort,
            achievementType: 'DAILY_COMPLIANCE_MISSED',
            timestamp: new Date().toISOString()
          }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending daily compliance missed notification:', error);
      throw error;
    }
  }
}

module.exports = DriverNotificationService;
