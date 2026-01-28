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
      const { getPhilippinesDateString } = require('../utils/dateUtils');
      const todayStr = getPhilippinesDateString();

      const devices = await DeviceTracking.find({
        date: todayStr,
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

      // ✅ FIX: Only count hours when ads are actually displaying
      // Hours should only accumulate when ad player is actively displaying ads, not just when WebSocket is connected
      // Check both screenMetrics.isDisplaying and isDisplaying - if either is explicitly false, don't count hours
      const screenMetricsDisplaying = device.screenMetrics?.isDisplaying !== false;
      const deviceDisplaying = device.isDisplaying !== false;
      const isDisplaying = screenMetricsDisplaying && deviceDisplaying;
      if (!isDisplaying) {
        // Device is online but not displaying ads - don't update hours
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
        // ✅ NEW: Stop tracking hours if 8 hours already completed (in company-ads-only mode)
        if (device.currentSession.completedAt) {
          console.log(`⏸️ [HoursUpdate] ${device.materialId} already completed 8 hours - skipping hours tracking (company-ads-only mode)`);
          // Don't update hours - device is in company-ads-only mode
          // GPS/location tracking still continues
          await device.save();
          return;
        }
        
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
        
        // ✅ NEW: SWITCH TO COMPANY ADS ONLY MODE AT 8 HOURS (instead of stopping)
        if (justReached8Hours && hasReached8Hours) {
          console.log(`🎯 [HoursUpdate] ${device.materialId} reached ${targetHours} hours! Switching to company ads only mode...`);
          
          // ✅ Mark when 8 hours was completed (for 8 AM lock rule)
          device.currentSession.completedAt = new Date();
          console.log(`⏰ [HoursUpdate] Marked completion time for ${device.materialId}: ${device.currentSession.completedAt.toISOString()}`);
          
          // Send notification
          const masterSlot = device.slots.find(slot => slot.slotNumber === 1 && slot.deviceId);
          const notificationDeviceId = masterSlot?.deviceId || device.slots.find(slot => slot.deviceId)?.deviceId;
          
          if (notificationDeviceId) {
            await deviceHoursNotificationService.checkAndNotify8HourMilestone(
              notificationDeviceId, 
              device.currentSession.totalHoursOnline
            );
          }
          
          // ✅ NEW: Send companyAdsOnly message to ad player (keep connection open, continue playing)
          await this.enableCompanyAdsOnlyMode(notificationDeviceId, device.materialId, device.currentSession.totalHoursOnline);
          
          // NOTE: Session continues - device will lock at midnight (12:00 AM) instead
          console.log(`✅ [HoursUpdate] Switched ${device.materialId} to company ads only mode at ${device.currentSession.totalHoursOnline.toFixed(2)} hours`);
          console.log(`⏰ [HoursUpdate] Device will lock at 12:00 AM due to time-based lock`);
          
          // Save device state (session continues)
          await device.save();
          
          // Don't exit early - continue tracking hours until midnight lock
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
   * Enable company ads only mode when 8 hours is reached (keeps playing, only company ads)
   */
  async enableCompanyAdsOnlyMode(deviceId, materialId, totalHours) {
    try {
      console.log(`🏢 [HoursUpdate] Enabling company ads only mode for device ${deviceId} (${totalHours.toFixed(2)} hours)`);
      
      // Get the device status service
      const deviceStatusService = require('./deviceStatusService');
      
      // Get the WebSocket connection for this device
      const connection = deviceStatusService.activeConnections.get(deviceId);
      
      if (connection && connection.readyState === 1) { // 1 = OPEN
        // Send companyAdsOnly message to ad player (keep connection open)
        const companyAdsOnlyMessage = {
          type: 'companyAdsOnly',
          deviceId: deviceId,
          materialId: materialId,
          message: 'You have completed your 8-hour daily requirement! Switching to company ads only.',
          totalHours: totalHours,
          completedAt: new Date().toISOString(),
          lockTime: '12:00 AM (midnight)'
        };
        
        connection.send(JSON.stringify(companyAdsOnlyMessage));
        console.log(`✅ [HoursUpdate] Sent companyAdsOnly message to ad player ${deviceId}`);
        console.log(`📺 [HoursUpdate] Device will continue playing company ads until midnight lock`);
        
        // NOTE: Keep WebSocket connection open - device will lock at midnight
      } else {
        console.log(`⚠️ [HoursUpdate] No active WebSocket connection found for device ${deviceId}`);
      }
    } catch (error) {
      console.error(`❌ Error enabling company ads only mode for device ${deviceId}:`, error);
    }
  }

  /**
   * Stop ad player and close WebSocket connection when 8 hours is reached
   * NOTE: This method is kept for backward compatibility but is no longer used
   * @deprecated Use enableCompanyAdsOnlyMode instead
   */
  async stopAdPlayer(deviceId, materialId, totalHours) {
    try {
      console.log(`🛑 [HoursUpdate] stopAdPlayer called (deprecated) for device ${deviceId}`);
      // This method is deprecated - using enableCompanyAdsOnlyMode instead
      await this.enableCompanyAdsOnlyMode(deviceId, materialId, totalHours);
    } catch (error) {
      console.error(`❌ Error in stopAdPlayer for device ${deviceId}:`, error);
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
