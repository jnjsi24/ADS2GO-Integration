const BaseNotificationService = require('./BaseNotificationService');
const EmailService = require('../../utils/emailService');

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
      const Driver = require('../../models/Driver');
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const statusMessages = {
        'APPROVED': '🎉 Congratulations! Your driver application has been approved!',
        'REJECTED': '❌ Your driver application has been rejected.',
        'SUSPENDED': '⚠️ Your driver account has been suspended.',
        'ACTIVE': '✅ Your driver account is now active!'
      };

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

      // Send email notification
      await this.sendDriverStatusChangeEmail(driver.email, driver.firstName, status, reason);

      return notification;
    } catch (error) {
      console.error('Error sending driver status change notification:', error);
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
          data: { deviceId, issue }
        }
      );

      return notification;
    } catch (error) {
      console.error('Error sending device issue notification:', error);
      throw error;
    }
  }

  /**
   * Send material assignment email to driver
   */
  static async sendMaterialAssignmentEmail(email, firstName, materialName) {
    try {
      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
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
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                You have been assigned to a new material. Please check your driver dashboard for more details.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/driver-dashboard" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Driver Dashboard
                </a>
              </div>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Material assignment email sent to ${email}`);
    } catch (error) {
      console.error('Error sending material assignment email:', error);
      throw error;
    }
  }

  /**
   * Send driver status change email
   */
  static async sendDriverStatusChangeEmail(email, firstName, status, reason) {
    try {
      const statusMessages = {
        'APPROVED': '🎉 Congratulations! Your driver application has been approved!',
        'REJECTED': '❌ Your driver application has been rejected.',
        'SUSPENDED': '⚠️ Your driver account has been suspended.',
        'ACTIVE': '✅ Your driver account is now active!'
      };

      const mailOptions = {
        from: `Ads2Go <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Driver Status Update - ${status}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; text-align: center;">Driver Status Update</h2>
              <p style="text-align: center; font-size: 16px; color: #666;">Hello ${firstName}!</p>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4A90E2;">
                <h3 style="color: #4A90E2; margin: 0 0 10px 0;">Status Update:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">${status}</span></p>
                ${reason ? `<p style="margin: 5px 0; color: #333;"><strong>Reason:</strong> ${reason}</p>` : ''}
              </div>
              
              <p style="color: #666; text-align: center; margin: 20px 0;">
                ${statusMessages[status]}
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/driver-dashboard" 
                   style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Driver Dashboard
                </a>
              </div>
            </div>
          </div>
        `
      };

      await EmailService.transporter.sendMail(mailOptions);
      console.log(`✅ Driver status change email sent to ${email}`);
    } catch (error) {
      console.error('Error sending driver status change email:', error);
      throw error;
    }
  }
}

module.exports = DriverNotificationService;
