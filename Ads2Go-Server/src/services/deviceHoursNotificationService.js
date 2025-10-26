const BaseNotificationService = require('./notifications/BaseNotificationService');
const DeviceTracking = require('../models/deviceTracking');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const logger = require('../utils/logger');

class DeviceHoursNotificationService {
  constructor() {
    this.notificationSentToday = new Map(); // Track notifications sent today per device
    this.dailyResetTime = '00:00'; // Reset time for daily tracking
  }

  /**
   * Check if device has reached 8 hours and send notification if needed
   * @param {string} deviceId - Device identifier
   * @param {number} currentHours - Current hours online today
   */
  async checkAndNotify8HourMilestone(deviceId, currentHours) {
    try {
      if (!deviceId) {
        logger.notification(`❌ [DeviceHoursNotification] DeviceId is undefined or null`);
        return;
      }
      
      logger.notification(`🎯 [DeviceHoursNotification] Device ${deviceId} reached 8-hour milestone: ${currentHours} hours`);
      
      // Check if we've already sent notification today for this device
      const today = new Date().toDateString();
      const notificationKey = `${deviceId}_${today}`;
      
      if (this.notificationSentToday.has(notificationKey)) {
        console.log(`⏭️ [DeviceHoursNotification] Notification already sent today for ${deviceId}`);
        return; // Already sent notification today
      }

      // Check if device has reached exactly 8 hours
      if (currentHours >= 8.0) {
        logger.notification(`🎯 [DeviceHoursNotification] Device ${deviceId} reached 8-hour milestone: ${currentHours} hours`);
        
      // Get device tracking info using the proper method for slots
      const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
        if (!deviceTracking) {
          console.error(`❌ [DeviceHoursNotification] Device tracking not found for ${deviceId}`);
          return;
        }

      // Get driver info from Material model using materialId
      let driverInfo = null;
      if (deviceTracking.materialId) {
        const material = await Material.findOne({ materialId: deviceTracking.materialId });
        if (material && material.driverId) {
          const driver = await Driver.findOne({ driverId: material.driverId });
          if (driver) {
            driverInfo = {
              id: driver._id,
              name: driver.fullName || `${driver.firstName} ${driver.lastName}`,
              driverId: driver.driverId
            };
          }
        }
        
        // Skip notification if material is not currently assigned to a driver
        if (!material || !material.driverId) {
          console.log(`⏭️ [DeviceHoursNotification] Skipping notification for ${deviceId} - material ${deviceTracking.materialId} is not assigned to a driver`);
          return;
        }
      }

        // Send notification to all admins
        await this.send8HourMilestoneNotification(deviceId, currentHours, driverInfo, deviceTracking);
        
        // Mark notification as sent for today
        this.notificationSentToday.set(notificationKey, {
          deviceId,
          hours: currentHours,
          timestamp: new Date(),
          driverInfo
        });

        console.log(`✅ [DeviceHoursNotification] 8-hour notification sent for device ${deviceId}`);
      }
    } catch (error) {
      console.error(`❌ [DeviceHoursNotification] Error checking 8-hour milestone for ${deviceId}:`, error);
    }
  }

  /**
   * Send 8-hour milestone notification to all admins
   * @param {string} deviceId - Device identifier
   * @param {number} hours - Hours online
   * @param {Object} driverInfo - Driver information
   * @param {Object} deviceTracking - Device tracking data
   */
  async send8HourMilestoneNotification(deviceId, hours, driverInfo, deviceTracking) {
    try {
      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      if (admins.length === 0) {
        console.warn('⚠️ [DeviceHoursNotification] No active admins found');
        return;
      }

      const notifications = [];
      const driverName = driverInfo ? driverInfo.name : 'Unknown Driver';
      const driverId = driverInfo ? driverInfo.driverId : 'N/A';
      
      // Format hours to 2 decimal places
      const formattedHours = Math.round(hours * 100) / 100;
      
      // Find the slot that contains this deviceId
      const slot = deviceTracking.slots?.find(s => s.deviceId === deviceId);
      const slotNumber = slot ? slot.slotNumber : 'Unknown';
      const materialId = deviceTracking.materialId || 'Unknown';
      
      // Create notification message with material ID and slot
      const title = '🎯 8-Hour Milestone Achieved!';
      const message = `Device ${materialId} (Slot ${slotNumber}) has been online for ${formattedHours} hours today. Driver: ${driverName} (ID: ${driverId})`;
      
      for (const admin of admins) {
        const notification = await BaseNotificationService.createNotification(
          admin._id,
          title,
          message,
          'SUCCESS',
          {
            userRole: 'ADMIN',
            category: 'DEVICE_MILESTONE',
            priority: 'HIGH',
            data: {
              deviceId,
              materialId,
              slotNumber,
              hours: formattedHours,
              driverName,
              driverId: driverInfo?.id,
              achievementType: '8_HOUR_MILESTONE',
              timestamp: new Date().toISOString(),
              location: deviceTracking.currentLocation || null
            }
          }
        );
        notifications.push(notification);
      }

      console.log(`📧 [DeviceHoursNotification] Sent 8-hour milestone notifications to ${admins.length} admins`);
      return notifications;
    } catch (error) {
      console.error('❌ [DeviceHoursNotification] Error sending 8-hour milestone notification:', error);
      throw error;
    }
  }

  /**
   * Check all devices for 8-hour milestones
   * This should be called periodically (e.g., every 30 minutes)
   */
  async checkAllDevicesFor8HourMilestone() {
    try {
      console.log('🔍 [DeviceHoursNotification] Checking all devices for 8-hour milestones...');
      
      // Get all devices that are currently online
      const onlineDevices = await DeviceTracking.find({
        isOnline: true,
        'currentSession.isActive': true
      });

      console.log(`📊 [DeviceHoursNotification] Found ${onlineDevices.length} online devices to check`);

      for (const device of onlineDevices) {
        try {
          // Calculate current hours for today
          const currentHours = device.currentHoursToday || 0;
          
          // Check if device has reached 8 hours
          if (currentHours >= 8.0) {
            // Only check the master slot (slot 1) to avoid duplicate notifications
            // The master slot is responsible for analytics tracking and notifications
            const masterSlot = device.slots.find(slot => slot.slotNumber === 1 && slot.deviceId);
            
            if (masterSlot) {
              console.log(`🎯 [DeviceHoursNotification] Checking master slot for material ${device.materialId}`);
              await this.checkAndNotify8HourMilestone(masterSlot.deviceId, currentHours);
            } else {
              // Fallback: if no slot 1, use the first available slot
              const firstSlot = device.slots.find(slot => slot.deviceId);
              if (firstSlot) {
                console.log(`🎯 [DeviceHoursNotification] Using fallback slot ${firstSlot.slotNumber} for material ${device.materialId}`);
                await this.checkAndNotify8HourMilestone(firstSlot.deviceId, currentHours);
              }
            }
          }
        } catch (deviceError) {
          console.error(`❌ [DeviceHoursNotification] Error processing device ${device.materialId}:`, deviceError);
        }
      }

      console.log('✅ [DeviceHoursNotification] Completed checking all devices for 8-hour milestones');
    } catch (error) {
      console.error('❌ [DeviceHoursNotification] Error checking all devices for 8-hour milestones:', error);
    }
  }

  /**
   * Reset daily notification tracking (call this at midnight)
   */
  resetDailyTracking() {
    this.notificationSentToday.clear();
    console.log('🔄 [DeviceHoursNotification] Daily notification tracking reset');
  }

  /**
   * Get notification statistics for today
   * @returns {Object} Statistics about notifications sent today
   */
  getTodayNotificationStats() {
    const stats = {
      totalNotifications: this.notificationSentToday.size,
      devices: Array.from(this.notificationSentToday.values()).map(notification => ({
        deviceId: notification.deviceId,
        hours: notification.hours,
        timestamp: notification.timestamp,
        driverName: notification.driverInfo?.name || 'Unknown'
      }))
    };
    
    console.log('📊 [DeviceHoursNotification] Today\'s notification stats:', stats);
    return stats;
  }

  /**
   * Check if notification was already sent for a device today
   * @param {string} deviceId - Device identifier
   * @returns {boolean} Whether notification was sent today
   */
  wasNotificationSentToday(deviceId) {
    const today = new Date().toDateString();
    const notificationKey = `${deviceId}_${today}`;
    return this.notificationSentToday.has(notificationKey);
  }
}

// Export singleton instance
module.exports = new DeviceHoursNotificationService();
