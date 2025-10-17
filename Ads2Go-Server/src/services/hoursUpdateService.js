/**
 * Hours Update Service - Provides real-time hours tracking with high precision
 */

const DeviceTracking = require('../models/deviceTracking');
const TimezoneUtils = require('../utils/timezoneUtils');
const deviceHoursNotificationService = require('./deviceHoursNotificationService');

class HoursUpdateService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
    this.updateFrequency = 30000; // 30 seconds for high precision
  }

  /**
   * Start the hours update service
   */
  start() {
    if (this.isRunning) {
      console.log('Hours update service is already running');
      return;
    }

    console.log('🕐 Starting hours update service with 30-second intervals');
    this.isRunning = true;

    this.updateInterval = setInterval(async () => {
      await this.updateAllDeviceHours();
    }, this.updateFrequency);
  }

  /**
   * Stop the hours update service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('🕐 Hours update service stopped');
  }

  /**
   * Update hours for all online devices
   */
  async updateAllDeviceHours() {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Get all devices for today that are online
      const devices = await DeviceTracking.find({
        date: today,
        isOnline: true,
        'currentSession.isActive': true
      });

      if (devices.length === 0) {
        return;
      }

      console.log(`🕐 [HoursUpdate] Updating hours for ${devices.length} online devices`);

      const updatePromises = devices.map(device => this.updateDeviceHours(device));
      await Promise.all(updatePromises);

    } catch (error) {
      console.error('❌ Error updating device hours:', error);
    }
  }

  /**
   * Update hours for a specific device
   */
  async updateDeviceHours(device) {
    try {
      if (!device.currentSession || !device.currentSession.isActive) {
        return;
      }

      const now = new Date();
      const deviceTimezone = TimezoneUtils.getDeviceTimezone(device.currentLocation);
      
      // Check if it's a new day in device timezone
      const todayInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(now, deviceTimezone);
      const sessionDateInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(device.currentSession.date, deviceTimezone);
      
      if (sessionDateInDeviceTz.getTime() !== todayInDeviceTz.getTime()) {
        // New day - reset session
        console.log(`🔄 [HoursUpdate] New day detected for ${device.materialId}, resetting session`);
        await device.resetDailySession();
        await device.save();
        console.log(`✅ [HoursUpdate] Reset ${device.materialId}: ${device.totalHoursOnline.toFixed(2)} hours`);
        return;
      }

      // Calculate hours since last update
      const lastUpdate = device.currentSession.lastOnlineUpdate || device.currentSession.startTime;
      const hoursSinceLastUpdate = TimezoneUtils.calculateHoursInTimezone(lastUpdate, now, deviceTimezone);
      
      if (hoursSinceLastUpdate > 0) {
        // Update session hours
        device.currentSession.totalHoursOnline += hoursSinceLastUpdate;
        device.currentSession.lastOnlineUpdate = now;
        
        // Cap at 8 hours max per day
        device.currentSession.totalHoursOnline = Math.min(8, device.currentSession.totalHoursOnline);
        
        // Update compliance status
        device.currentSession.complianceStatus = 
          device.currentSession.totalHoursOnline >= device.currentSession.targetHours ? 
          'COMPLIANT' : 'NON_COMPLIANT';
        
        // Update total daily hours (not lifetime)
        device.totalHoursOnline = device.currentSession.totalHoursOnline;
        
        // Update average daily hours
        device.averageDailyHours = device.totalHoursOnline;
        
        // Update compliance rate
        device.complianceRate = device.currentSession.complianceStatus === 'COMPLIANT' ? 100 : 0;
        
        // Save the device
        await device.save();
        
        // Check for 8-hour milestone and send notification if needed
        // Only check the master slot (slot 1) to avoid duplicate notifications
        const masterSlot = device.slots.find(slot => slot.slotNumber === 1 && slot.deviceId);
        
        if (masterSlot) {
          console.log(`🎯 [HoursUpdate] Checking master slot for 8-hour milestone: ${device.materialId}, deviceId: ${masterSlot.deviceId}`);
          if (masterSlot.deviceId) {
            await deviceHoursNotificationService.checkAndNotify8HourMilestone(
              masterSlot.deviceId, 
              device.currentSession.totalHoursOnline
            );
          } else {
            console.log(`❌ [HoursUpdate] Master slot deviceId is undefined for ${device.materialId}`);
          }
        } else {
          // Fallback: if no slot 1, use the first available slot
          const firstSlot = device.slots.find(slot => slot.deviceId);
          if (firstSlot) {
            console.log(`🎯 [HoursUpdate] Using fallback slot ${firstSlot.slotNumber} for 8-hour milestone: ${device.materialId}, deviceId: ${firstSlot.deviceId}`);
            if (firstSlot.deviceId) {
              await deviceHoursNotificationService.checkAndNotify8HourMilestone(
                firstSlot.deviceId, 
                device.currentSession.totalHoursOnline
              );
            } else {
              console.log(`❌ [HoursUpdate] Fallback slot deviceId is undefined for ${device.materialId}`);
            }
          } else {
            console.log(`❌ [HoursUpdate] No slots with deviceId found for ${device.materialId}`);
          }
        }
        
        console.log(`✅ [HoursUpdate] Updated ${device.materialId}: ${device.currentSession.totalHoursOnline.toFixed(2)} hours`);
      }

    } catch (error) {
      console.error(`❌ Error updating hours for device ${device.materialId}:`, error);
    }
  }

  /**
   * Force update hours for a specific device
   */
  async forceUpdateDeviceHours(deviceId) {
    try {
      const device = await DeviceTracking.findOne({ 'slots.deviceId': deviceId });
      if (device) {
        await this.updateDeviceHours(device);
      }
    } catch (error) {
      console.error(`❌ Error force updating hours for device ${deviceId}:`, error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      nextUpdate: this.updateInterval ? new Date(Date.now() + this.updateFrequency) : null
    };
  }
}

module.exports = new HoursUpdateService();
