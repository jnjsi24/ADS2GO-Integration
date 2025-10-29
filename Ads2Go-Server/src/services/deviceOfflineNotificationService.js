const BaseNotificationService = require('./notifications/BaseNotificationService');
const DeviceTracking = require('../models/deviceTracking');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Material = require('../models/Material');

class DeviceOfflineNotificationService {
  constructor() {
    this.deviceStatusHistory = new Map(); // Track previous status to detect changes
    this.notificationCooldown = new Map(); // Prevent spam notifications
    this.cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown between notifications for same device
    this.offlineThreshold = 30 * 1000; // 30 seconds before considering device offline
  }

  /**
   * Check device status change and send notification if needed
   * @param {string} deviceId - Device identifier
   * @param {boolean} isOnline - Current online status
   * @param {string} reason - Reason for status change (disconnect, timeout, etc.)
   */
  async checkDeviceStatusChange(deviceId, isOnline, reason = 'unknown') {
    try {
      const now = new Date();
      const previousStatus = this.deviceStatusHistory.get(deviceId);
      
      // Update status history
      this.deviceStatusHistory.set(deviceId, {
        isOnline,
        lastSeen: now,
        reason,
        timestamp: now
      });

      // Check if this is a status change (online -> offline or offline -> online)
      if (previousStatus && previousStatus.isOnline !== isOnline) {
        console.log(`🔄 [DeviceOfflineNotification] Status change detected for ${deviceId}: ${previousStatus.isOnline ? 'ONLINE' : 'OFFLINE'} -> ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        if (!isOnline) {
          // Device went offline - send notification
          await this.sendDeviceOfflineNotification(deviceId, reason, previousStatus.lastSeen);
        } else {
          // Device came back online - send recovery notification
          await this.sendDeviceOnlineNotification(deviceId, reason);
        }
      }
    } catch (error) {
      console.error(`❌ [DeviceOfflineNotification] Error checking status change for ${deviceId}:`, error);
    }
  }

  /**
   * Send device offline notification to admins
   * @param {string} deviceId - Device identifier
   * @param {string} reason - Reason for going offline
   * @param {Date} lastSeen - When device was last seen online
   */
  async sendDeviceOfflineNotification(deviceId, reason, lastSeen) {
    try {
      // Check cooldown to prevent spam
      if (this.isInCooldown(deviceId)) {
        console.log(`⏰ [DeviceOfflineNotification] Skipping notification for ${deviceId} - in cooldown period`);
        return;
      }

      // Get device tracking info using the proper method for slots
      const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
      if (!deviceTracking) {
        console.error(`❌ [DeviceOfflineNotification] Device tracking not found for ${deviceId}`);
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
          console.log(`⏭️ [DeviceOfflineNotification] Skipping notification for ${deviceId} - material ${deviceTracking.materialId} is not assigned to a driver`);
          return;
        }
      }

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      if (admins.length === 0) {
        console.warn('⚠️ [DeviceOfflineNotification] No active admins found');
        return;
      }

      const notifications = [];
      const driverName = driverInfo ? driverInfo.name : 'Unknown Driver';
      const driverId = driverInfo ? driverInfo.driverId : 'N/A';
      
      // Calculate time since last seen
      const timeSinceLastSeen = lastSeen ? Math.floor((new Date() - new Date(lastSeen)) / 1000) : 0;
      const timeAgo = timeSinceLastSeen < 60 ? `${timeSinceLastSeen}s ago` : 
                     timeSinceLastSeen < 3600 ? `${Math.floor(timeSinceLastSeen / 60)}m ago` :
                     `${Math.floor(timeSinceLastSeen / 3600)}h ago`;
      
      // Find the slot that contains this deviceId
      const slot = deviceTracking.slots?.find(s => s.deviceId === deviceId);
      const slotNumber = slot ? slot.slotNumber : 'Unknown';
      const materialId = deviceTracking.materialId || 'Unknown';
      
      // Create notification message based on reason
      let title, message;
      switch (reason) {
        case 'websocket_disconnect':
          title = '🔌 Device Disconnected';
          message = `Device ${materialId} (Slot ${slotNumber}) disconnected from WebSocket. Last seen: ${timeAgo}. Driver: ${driverName}`;
          break;
        case 'timeout':
          title = '⏰ Device Timeout';
          message = `Device ${materialId} (Slot ${slotNumber}) timed out. Last seen: ${timeAgo}. Driver: ${driverName}`;
          break;
        case 'network_error':
          title = '🌐 Network Error';
          message = `Device ${materialId} (Slot ${slotNumber}) lost network connection. Last seen: ${timeAgo}. Driver: ${driverName}`;
          break;
        default:
          title = '📱 Device Offline';
          message = `Device ${materialId} (Slot ${slotNumber}) went offline. Last seen: ${timeAgo}. Driver: ${driverName}`;
      }
      
      for (const admin of admins) {
        const notification = await BaseNotificationService.createNotification(
          admin._id,
          title,
          message,
          'WARNING',
          {
            userRole: 'ADMIN',
            category: 'DEVICE_OFFLINE',
            priority: 'HIGH',
            data: {
              deviceId,
              materialId,
              slotNumber,
              driverName,
              driverId: driverInfo?.id,
              reason,
              lastSeen: lastSeen?.toISOString(),
              timeSinceLastSeen,
              eventType: 'DEVICE_OFFLINE',
              timestamp: new Date().toISOString(),
              location: deviceTracking.currentLocation || null
            }
          }
        );
        notifications.push(notification);
      }

      // Set cooldown for this device
      this.setCooldown(deviceId);

      console.log(`📧 [DeviceOfflineNotification] Sent offline notification for device ${deviceId} to ${admins.length} admins`);
      
      // Also notify the driver
      if (driverInfo) {
        try {
          const NotificationService = require('./notifications/NotificationService');
          await NotificationService.sendMaterialOfflineNotification(
            driverInfo.id,
            materialId,
            materialId,
            reason
          );
          console.log(`📧 [DeviceOfflineNotification] Sent offline notification to driver ${driverInfo.driverId}`);
        } catch (driverNotifError) {
          console.error('Error sending offline notification to driver:', driverNotifError);
        }
      }
      
      return notifications;
    } catch (error) {
      console.error('❌ [DeviceOfflineNotification] Error sending offline notification:', error);
      throw error;
    }
  }

  /**
   * Send device back online notification to admins
   * @param {string} deviceId - Device identifier
   * @param {string} reason - Reason for coming back online
   */
  async sendDeviceOnlineNotification(deviceId, reason) {
    try {
      // Get device tracking info using the proper method for slots
      const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
      if (!deviceTracking) {
        console.error(`❌ [DeviceOfflineNotification] Device tracking not found for ${deviceId}`);
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
          console.log(`⏭️ [DeviceOfflineNotification] Skipping notification for ${deviceId} - material ${deviceTracking.materialId} is not assigned to a driver`);
          return;
        }
      }

      // Get all active admins
      const admins = await Admin.find({ isActive: true });
      
      if (admins.length === 0) {
        console.warn('⚠️ [DeviceOfflineNotification] No active admins found');
        return;
      }

      const notifications = [];
      const driverName = driverInfo ? driverInfo.name : 'Unknown Driver';
      const driverId = driverInfo ? driverInfo.driverId : 'N/A';
      
      // Find the slot that contains this deviceId
      const slot = deviceTracking.slots?.find(s => s.deviceId === deviceId);
      const slotNumber = slot ? slot.slotNumber : 'Unknown';
      const materialId = deviceTracking.materialId || 'Unknown';
      
      const title = '✅ Device Back Online';
      const message = `Device ${materialId} (Slot ${slotNumber}) is back online. Driver: ${driverName}`;
      
      for (const admin of admins) {
        const notification = await BaseNotificationService.createNotification(
          admin._id,
          title,
          message,
          'SUCCESS',
          {
            userRole: 'ADMIN',
            category: 'DEVICE_ONLINE',
            priority: 'MEDIUM',
            data: {
              deviceId,
              materialId,
              slotNumber,
              driverName,
              driverId: driverInfo?.id,
              reason,
              eventType: 'DEVICE_ONLINE',
              timestamp: new Date().toISOString(),
              location: deviceTracking.currentLocation || null
            }
          }
        );
        notifications.push(notification);
      }

      console.log(`📧 [DeviceOfflineNotification] Sent online notification for device ${deviceId} to ${admins.length} admins`);
      
      // Also notify the driver
      if (driverInfo) {
        try {
          const NotificationService = require('./notifications/NotificationService');
          await NotificationService.sendMaterialOnlineNotification(
            driverInfo.id,
            materialId,
            materialId
          );
          console.log(`📧 [DeviceOfflineNotification] Sent online notification to driver ${driverInfo.driverId}`);
        } catch (driverNotifError) {
          console.error('Error sending online notification to driver:', driverNotifError);
        }
      }
      
      return notifications;
    } catch (error) {
      console.error('❌ [DeviceOfflineNotification] Error sending online notification:', error);
      throw error;
    }
  }

  /**
   * Check if device is in cooldown period
   * @param {string} deviceId - Device identifier
   * @returns {boolean} Whether device is in cooldown
   */
  isInCooldown(deviceId) {
    const cooldownEnd = this.notificationCooldown.get(deviceId);
    if (!cooldownEnd) return false;
    
    if (Date.now() > cooldownEnd) {
      this.notificationCooldown.delete(deviceId);
      return false;
    }
    
    return true;
  }

  /**
   * Set cooldown period for device
   * @param {string} deviceId - Device identifier
   */
  setCooldown(deviceId) {
    this.notificationCooldown.set(deviceId, Date.now() + this.cooldownPeriod);
  }

  /**
   * Get device status history
   * @param {string} deviceId - Device identifier
   * @returns {Object} Device status history
   */
  getDeviceStatusHistory(deviceId) {
    return this.deviceStatusHistory.get(deviceId) || null;
  }

  /**
   * Get all device statuses
   * @returns {Array} Array of device status objects
   */
  getAllDeviceStatuses() {
    return Array.from(this.deviceStatusHistory.entries()).map(([deviceId, status]) => ({
      deviceId,
      ...status
    }));
  }

  /**
   * Clear old status history (call this periodically)
   */
  cleanupOldHistory() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [deviceId, status] of this.deviceStatusHistory.entries()) {
      if (now - status.timestamp.getTime() > maxAge) {
        this.deviceStatusHistory.delete(deviceId);
      }
    }
    
    // Clean up old cooldowns
    for (const [deviceId, cooldownEnd] of this.notificationCooldown.entries()) {
      if (now > cooldownEnd) {
        this.notificationCooldown.delete(deviceId);
      }
    }
  }

  /**
   * Get notification statistics
   * @returns {Object} Statistics about notifications
   */
  getNotificationStats() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentStatuses = Array.from(this.deviceStatusHistory.values())
      .filter(status => status.timestamp.getTime() > oneHourAgo);
    
    const offlineCount = recentStatuses.filter(status => !status.isOnline).length;
    const onlineCount = recentStatuses.filter(status => status.isOnline).length;
    
    return {
      totalDevices: this.deviceStatusHistory.size,
      recentOffline: offlineCount,
      recentOnline: onlineCount,
      cooldownDevices: this.notificationCooldown.size
    };
  }
}

// Export singleton instance
module.exports = new DeviceOfflineNotificationService();
