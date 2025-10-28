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
        // Store previous hours to check if we crossed 8-hour threshold
        const previousHours = device.currentSession.totalHoursOnline || 0;
        
        // ✅ FIX: Use centralized validation and update logic
        const { validateHours, syncHoursFromSession } = require('../models/deviceTrackingHelpers');
        
        // Update session hours
        device.currentSession.totalHoursOnline += hoursSinceLastUpdate;
        device.currentSession.lastOnlineUpdate = now;
        
        // Check if we've reached or exceeded 8 hours
        const targetHours = device.currentSession.targetHours || 8;
        const hasReached8Hours = device.currentSession.totalHoursOnline >= targetHours;
        const justReached8Hours = previousHours < targetHours && device.currentSession.totalHoursOnline >= targetHours;
        
        // ✅ FIX: Use centralized validation
        device.currentSession.totalHoursOnline = validateHours(device.currentSession.totalHoursOnline);
        
        // Cap at 8 hours max per day
        device.currentSession.totalHoursOnline = Math.min(targetHours, device.currentSession.totalHoursOnline);
        
        // Update compliance status
        device.currentSession.complianceStatus = 
          device.currentSession.totalHoursOnline >= targetHours ? 
          'COMPLIANT' : 'NON_COMPLIANT';
        
        // ✅ FIX: Use centralized sync method
        syncHoursFromSession(device);
        
        // ✅ AUTO-END SESSION AT 8 HOURS + STOP AD PLAYER
        if (justReached8Hours && hasReached8Hours) {
          console.log(`🎯 [HoursUpdate] ${device.materialId} reached ${targetHours} hours! Auto-ending session and stopping ad player...`);
          
          // ✅ Mark when 8 hours was completed (for 8 AM lock rule)
          device.currentSession.completedAt = new Date();
          console.log(`⏰ [HoursUpdate] Marked completion time for ${device.materialId}: ${device.currentSession.completedAt.toISOString()}`);
          
          // Send notification BEFORE ending session
          const masterSlot = device.slots.find(slot => slot.slotNumber === 1 && slot.deviceId);
          const notificationDeviceId = masterSlot?.deviceId || device.slots.find(slot => slot.deviceId)?.deviceId;
          
          if (notificationDeviceId) {
            await deviceHoursNotificationService.checkAndNotify8HourMilestone(
              notificationDeviceId, 
              device.currentSession.totalHoursOnline
            );
          }
          
          // ✅ NEW: Send STOP message to ad player and close connection
          await this.stopAdPlayer(notificationDeviceId, device.materialId, device.currentSession.totalHoursOnline);
          
          // Auto-end the session
          await device.endDailySession();
          console.log(`✅ [HoursUpdate] Session auto-ended for ${device.materialId} at ${device.currentSession.totalHoursOnline.toFixed(2)} hours`);
          
          // Save to history (archiving is handled by endDailySession method)
          await device.save();
          
          return; // Exit early, session is now ended
        }
        
        // Save the device (if session hasn't ended)
        await device.save();
        
        console.log(`✅ [HoursUpdate] Updated ${device.materialId}: ${device.currentSession.totalHoursOnline.toFixed(2)} / ${targetHours} hours`);
      }

    } catch (error) {
      console.error(`❌ Error updating hours for device ${device.materialId}:`, error);
    }
  }

  /**
   * Stop ad player and close WebSocket connection when 8 hours is reached
   */
  async stopAdPlayer(deviceId, materialId, totalHours) {
    try {
      console.log(`🛑 [HoursUpdate] Stopping ad player for device ${deviceId} (${totalHours.toFixed(2)} hours)`);
      
      // Get the device status service
      const deviceStatusService = require('./deviceStatusService');
      
      // Get the WebSocket connection for this device
      const connection = deviceStatusService.activeConnections.get(deviceId);
      
      if (connection && connection.readyState === 1) { // 1 = OPEN
        // Send STOP message to ad player
        const stopMessage = {
          type: 'stop8Hours',
          deviceId: deviceId,
          materialId: materialId,
          message: 'You have completed your 8-hour daily requirement!',
          totalHours: totalHours,
          completedAt: new Date().toISOString(),
          unlockTime: '8:00 AM tomorrow'
        };
        
        connection.send(JSON.stringify(stopMessage));
        console.log(`✅ [HoursUpdate] Sent STOP message to ad player ${deviceId}`);
        
        // Wait a moment for the message to be sent, then close connection
        setTimeout(() => {
          try {
            deviceStatusService.removeConnection(deviceId);
            console.log(`✅ [HoursUpdate] Closed WebSocket connection for ${deviceId}`);
          } catch (error) {
            console.error(`❌ Error closing connection for ${deviceId}:`, error);
          }
        }, 1000); // 1 second delay to ensure message is sent
      } else {
        console.log(`⚠️ [HoursUpdate] No active WebSocket connection found for device ${deviceId}`);
      }
    } catch (error) {
      console.error(`❌ Error stopping ad player for device ${deviceId}:`, error);
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
