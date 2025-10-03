const mongoose = require('mongoose');
const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistory = require('../models/deviceDataHistory');
const Analytics = require('../models/analytics');
const TimezoneUtils = require('../utils/timezoneUtils');

class DailyArchiveJob {
  constructor() {
    this.isRunning = false;
  }

  // Main archive function - runs at midnight
  async archiveDailyData() {
    if (this.isRunning) {
      console.log('⚠️  Daily archive job is already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting daily archive job...');

    try {
      // For testing: archive any existing data (not just today's)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      console.log(`📅 Archiving data for date: ${dateStr} (TESTING MODE)`);

      // Get all DeviceTracking records (for testing - any date)
      const dailyData = await DeviceTracking.find({});
      
      if (dailyData.length === 0) {
        console.log('ℹ️  No data found for archiving');
        this.isRunning = false;
        return;
      }

      console.log(`📊 Found ${dailyData.length} device records to archive`);

      // Process each device record and reset daily sessions if needed
      const archivePromises = dailyData.map(async device => {
        // Check if device needs daily reset (new day)
        const wasReset = device.resetDailySession();
        if (wasReset) {
          console.log(`🔄 Daily session reset for ${device.materialId} - new day started`);
          await device.save();
        }
        
        // Archive the device data
        return this.archiveDeviceData(device, dateStr);
      });
      await Promise.all(archivePromises);

      // Skip clearing data during testing (normally clears yesterday's data)
      console.log(`ℹ️  Skipping data cleanup during testing mode`);

      // Update Analytics collection with daily summaries
      await this.updateAnalyticsWithDailySummary(dailyData, dateStr);

      console.log('✅ Daily archive job completed successfully');

    } catch (error) {
      console.error('❌ Error in daily archive job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Archive individual device data (one record per material with all slots)
  async archiveDeviceData(device, dateStr) {
    try {
      // Create one archive record for the entire material (all slots combined)
      await this.archiveMaterialData(device, dateStr);
      
      console.log(`✅ Archived data for material ${device.materialId} with ${device.slots.length} slots`);
    } catch (error) {
      console.error(`❌ Error archiving device data for material ${device.materialId}:`, error);
    }
  }

  // Archive material data (one record per material with all slots)
  async archiveMaterialData(device, dateStr) {
    try {
      // Get device timezone from current location
      const deviceTimezone = TimezoneUtils.getDeviceTimezone(device.currentLocation);
      
      // Calculate enhanced hours tracking data (using device-level data)
      const hoursTracking = this.calculateHoursTrackingData(device, null, deviceTimezone);
      
      // Calculate daily summary for the entire material
      const dailySummary = this.calculateDailySummaryForMaterial(device);
      
      // Create archive record for the entire material
      const archiveRecord = {
        materialId: device.materialId,
        carGroupId: device.carGroupId,
        date: new Date(dateStr),
        
        // Device info (from first slot or combined)
        deviceInfo: device.slots[0]?.deviceInfo || {},
        
        // Daily totals (from device level)
        totalAdPlays: device.totalAdPlays,
        totalQRScans: device.totalQRScans,
        totalDistanceTraveled: device.totalDistanceTraveled,
        totalHoursOnline: this.getFinalHoursOnline(device, deviceTimezone),
        
        // Enhanced hours tracking with timezone awareness
        hoursTracking: hoursTracking,
        
        // Daily summary
        dailySummary: dailySummary,
        
        // Hourly breakdown
        hourlyStats: device.hourlyStats,
        
        // Location data (keep last 24 hours)
        locationHistory: device.locationHistory.slice(-24),
        
        // Ad performance
        adPerformance: device.adPerformance,
        
        // QR scan details
        qrScans: device.qrScans,
        qrScansByAd: device.qrScansByAd,
        
        // Ad playback details
        adPlaybacks: device.adPlaybacks,
        
        // Network and connectivity
        networkStatus: device.networkStatus,
        
        // Compliance data
        complianceData: device.complianceData,
        
        // Slots information (all slots in one record)
        slots: device.slots.map(slot => ({
          deviceId: slot.deviceId,
          slotNumber: slot.slotNumber,
          isOnline: slot.isOnline,
          lastSeen: slot.lastSeen,
          deviceInfo: slot.deviceInfo,
          totalAdPlays: slot.totalAdPlays || 0,
          totalQRScans: slot.totalQRScans || 0
        })),
        
        // Metadata
        archivedAt: new Date(),
        dataSource: 'deviceTracking',
        version: '3.0' // Updated version for enhanced tracking
      };

      // Save to DeviceDataHistory
      await DeviceDataHistory.create(archiveRecord);
      console.log(`✅ Archived material data for ${device.materialId} with ${device.slots.length} slots (${deviceTimezone})`);
    } catch (error) {
      console.error(`❌ Error archiving material data for ${device.materialId}:`, error);
    }
  }

  // Archive individual slot data (DEPRECATED - kept for backward compatibility)
  async archiveSlotData(device, slot, dateStr) {
    try {
      // Calculate daily summary for this slot
      const dailySummary = this.calculateDailySummaryForSlot(device, slot);
      
      // Get device timezone from current location
      const deviceTimezone = TimezoneUtils.getDeviceTimezone(device.currentLocation);
      
      // Calculate enhanced hours tracking data
      const hoursTracking = this.calculateHoursTrackingData(device, slot, deviceTimezone);
      
      // Create archive record for this slot
      const archiveRecord = {
        deviceId: slot.deviceId,
        deviceSlot: slot.slotNumber,
        materialId: device.materialId,
        carGroupId: device.carGroupId,
        date: new Date(dateStr),
        
        // Device info
        deviceInfo: slot.deviceInfo || {},
        
        // Daily totals (from device level) - use enhanced calculation
        totalAdPlays: device.totalAdPlays,
        totalQRScans: device.totalQRScans,
        totalDistanceTraveled: device.totalDistanceTraveled,
        totalHoursOnline: this.getFinalHoursOnline(device, deviceTimezone),
        
        // Enhanced hours tracking with timezone awareness
        hoursTracking: hoursTracking,
        
        // Daily summary
        dailySummary: dailySummary,
        
        // Hourly breakdown
        hourlyStats: device.hourlyStats,
        
        // Location data (keep last 24 hours)
        locationHistory: device.locationHistory.slice(-24),
        
        // Ad performance
        adPerformance: device.adPerformance,
        
        // QR scan details
        qrScans: device.qrScans,
        qrScansByAd: device.qrScansByAd,
        
        // Ad playback details
        adPlaybacks: device.adPlaybacks,
        
        // Network and connectivity
        networkStatus: device.networkStatus,
        
        // Compliance data
        complianceData: device.complianceData,
        
        // Metadata
        archivedAt: new Date(),
        dataSource: 'deviceTracking',
        version: '3.0' // Updated version for enhanced tracking
      };

      // Save to DeviceDataHistory
      await DeviceDataHistory.create(archiveRecord);
      console.log(`✅ Archived enhanced data for device ${slot.deviceId} in material ${device.materialId} (${hoursTracking.deviceTimezone})`);
    } catch (error) {
      console.error(`❌ Error archiving slot data for device ${slot.deviceId}:`, error);
    }
  }

  // Calculate daily summary for the entire material (all slots combined)
  calculateDailySummaryForMaterial(device) {
    // Calculate slot-level statistics
    const slotStats = device.slots.map(slot => ({
      slotNumber: slot.slotNumber,
      deviceId: slot.deviceId,
      isOnline: slot.isOnline,
      lastSeen: slot.lastSeen,
      deviceInfo: slot.deviceInfo || {},
      totalAdPlays: slot.totalAdPlays || 0,
      totalQRScans: slot.totalQRScans || 0
    }));

    return {
      // Material-level totals
      totalAdPlays: device.totalAdPlays,
      totalQRScans: device.totalQRScans,
      totalDistanceTraveled: device.totalDistanceTraveled,
      totalHoursOnline: device.totalHoursOnline,
      averageAdCompletionRate: this.calculateAverageCompletionRate(device.adPlaybacks),
      uniqueAdsPlayed: new Set(device.adPlaybacks.map(play => play.adId)).size,
      totalAdImpressions: device.totalAdImpressions,
      totalAdPlayTime: device.totalAdPlayTime,
      
      // Material-level status
      isOnline: device.isOnline,
      lastSeen: device.lastSeen,
      
      // Slot-level breakdown
      totalSlots: device.slots.length,
      onlineSlots: device.slots.filter(slot => slot.isOnline).length,
      slotStats: slotStats
    };
  }

  // Calculate daily summary for a specific slot (DEPRECATED - kept for backward compatibility)
  calculateDailySummaryForSlot(device, slot) {
    return {
      totalAdPlays: device.totalAdPlays,
      totalQRScans: device.totalQRScans,
      totalDistanceTraveled: device.totalDistanceTraveled,
      totalHoursOnline: device.totalHoursOnline,
      averageAdCompletionRate: this.calculateAverageCompletionRate(device.adPlaybacks),
      uniqueAdsPlayed: new Set(device.adPlaybacks.map(play => play.adId)).size,
      totalAdImpressions: device.totalAdImpressions,
      totalAdPlayTime: device.totalAdPlayTime,
      isOnline: slot.isOnline,
      lastSeen: slot.lastSeen,
      deviceInfo: slot.deviceInfo || {}
    };
  }

  // Calculate enhanced hours tracking data with timezone awareness
  calculateHoursTrackingData(device, slot, deviceTimezone) {
    const now = new Date();
    const session = device.currentSession || {};
    
    // Calculate final hours online with timezone awareness
    const finalHours = this.getFinalHoursOnline(device, deviceTimezone);
    
    // Calculate offline periods during the day
    const offlinePeriods = this.calculateOfflinePeriods(device, deviceTimezone);
    
    return {
      deviceTimezone: deviceTimezone,
      sessionStartTime: session.startTime || now,
      sessionEndTime: now,
      lastOnlineUpdate: session.lastOnlineUpdate || session.startTime || now,
      offlinePeriods: offlinePeriods,
      complianceStatus: session.complianceStatus || (finalHours >= 8 ? 'COMPLIANT' : 'NON_COMPLIANT'),
      targetHours: session.targetHours || 8,
      precision: '30s', // High-precision updates
      totalOfflineHours: offlinePeriods.reduce((sum, period) => sum + period.duration, 0),
      totalOnlineHours: finalHours,
      efficiency: finalHours > 0 ? (finalHours / (finalHours + offlinePeriods.reduce((sum, period) => sum + period.duration, 0))) * 100 : 0
    };
  }

  // Get final hours online with timezone awareness
  getFinalHoursOnline(device, deviceTimezone) {
    if (!device.currentSession || !device.currentSession.startTime) {
      return device.totalHoursOnline || 0;
    }

    const now = new Date();
    const sessionStart = new Date(device.currentSession.startTime);
    
    // Check if it's a new day in device timezone
    const todayInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(now, deviceTimezone);
    const sessionDateInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(device.currentSession.date, deviceTimezone);
    
    if (sessionDateInDeviceTz.getTime() !== todayInDeviceTz.getTime()) {
      // New day - return the session total
      return device.currentSession.totalHoursOnline || 0;
    }

    // Calculate hours with timezone awareness
    let totalHours = device.currentSession.totalHoursOnline || 0;
    
    if (device.isOnline) {
      const lastUpdate = device.currentSession.lastOnlineUpdate || sessionStart;
      const hoursSinceLastUpdate = TimezoneUtils.calculateHoursInTimezone(lastUpdate, now, deviceTimezone);
      totalHours += hoursSinceLastUpdate;
    }

    // Cap at 8 hours max per day
    return Math.min(8, Math.max(0, totalHours));
  }

  // Calculate offline periods during the day
  calculateOfflinePeriods(device, deviceTimezone) {
    const offlinePeriods = [];
    
    if (!device.currentSession || !device.currentSession.startTime) {
      return offlinePeriods;
    }

    // This is a simplified calculation - in a real implementation,
    // you'd track offline/online transitions throughout the day
    const sessionStart = new Date(device.currentSession.startTime);
    const now = new Date();
    
    // For now, we'll estimate based on current online status
    if (!device.isOnline) {
      const lastSeen = new Date(device.lastSeen);
      const offlineDuration = TimezoneUtils.calculateHoursInTimezone(lastSeen, now, deviceTimezone);
      
      if (offlineDuration > 0.1) { // Only count periods longer than 6 minutes
        offlinePeriods.push({
          startTime: lastSeen,
          endTime: now,
          duration: offlineDuration
        });
      }
    }

    return offlinePeriods;
  }

  // Calculate daily summary from device data
  calculateDailySummary(device) {
    const hourlyStats = device.hourlyStats || [];
    
    // Find peak hours (hours with most activity)
    const peakHours = hourlyStats
      .map(stat => ({ hour: stat.hour, activity: stat.adPlays + stat.qrScans }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 3)
      .map(stat => stat.hour);

    // Calculate averages
    const totalAdPlayTime = device.totalAdPlayTime || 0;
    const totalAdPlays = device.totalAdPlays || 0;
    const totalQRScans = device.totalQRScans || 0;
    const totalDistance = device.totalDistanceTraveled || 0;
    const totalHoursOnline = device.totalHoursOnline || 0;

    // Calculate completion rate
    const adPlaybacks = device.adPlaybacks || [];
    const totalCompletionRate = adPlaybacks.length > 0 
      ? adPlaybacks.reduce((sum, ad) => sum + (ad.completionRate || 0), 0) / adPlaybacks.length
      : 0;

    // Calculate compliance rate (simplified)
    const complianceRate = totalHoursOnline > 0 ? Math.min(100, (totalHoursOnline / 8) * 100) : 0;

    // Calculate average speed
    const averageSpeed = totalHoursOnline > 0 ? totalDistance / totalHoursOnline : 0;

    // Find max speed from location history
    const maxSpeed = device.locationHistory && device.locationHistory.length > 0
      ? Math.max(...device.locationHistory.map(loc => loc.speed || 0))
      : 0;

    return {
      peakHours,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      complianceRate: Math.round(complianceRate * 100) / 100,
      adCompletionRate: Math.round(totalCompletionRate * 100) / 100,
      totalAdImpressions: device.totalAdImpressions || 0,
      totalAdPlayTime,
      uptimePercentage: Math.round(complianceRate * 100) / 100,
      totalInteractions: device.totalAdPlays + device.totalQRScans,
      totalScreenTaps: device.totalAdPlays, // Assuming ad plays = screen taps
      totalDebugActivations: 0 // Not tracked in current system
    };
  }

  // Update Analytics collection with daily summary
  async updateAnalyticsWithDailySummary(dailyData, dateStr) {
    try {
      console.log('📊 Updating Analytics collection with daily summaries...');

      // Group data by ad for analytics updates
      const adGroups = {};
      
      dailyData.forEach(device => {
        device.adPlaybacks.forEach(playback => {
          const adId = playback.adId;
          if (!adGroups[adId]) {
            adGroups[adId] = {
              adId,
              adTitle: playback.adTitle,
              devices: [],
              totalAdPlays: 0,
              totalQRScans: 0,
              totalAdPlayTime: 0,
              totalAdImpressions: 0
            };
          }
          
          adGroups[adId].devices.push(device);
          adGroups[adId].totalAdPlays += device.totalAdPlays;
          adGroups[adId].totalQRScans += device.totalQRScans;
          adGroups[adId].totalAdPlayTime += device.totalAdPlayTime;
          adGroups[adId].totalAdImpressions += device.totalAdImpressions;
        });
      });

      // Update Analytics for each ad
      for (const [adId, adData] of Object.entries(adGroups)) {
        try {
          // Skip company ads - they don't need analytics tracking
          if (this.isCompanyAd(adId, adData.adTitle)) {
            console.log(`⏭️  Skipping analytics creation for company ad: ${adData.adTitle} (${adId})`);
            continue;
          }

          // Find or create analytics record
          let analytics = await Analytics.findOne({ adId });
          
          if (!analytics) {
            analytics = new Analytics({
              adId,
              adTitle: adData.adTitle,
              materials: [],
              materialPerformance: [],
              isActive: true
            });
          }

          // Update with daily data - batch all material updates first
          const materialUpdates = adData.devices.map(device => {
            const materialData = {
              materialId: device.materialId, // Use actual materialId from new schema
              materialType: 'HEADDRESS',
              carGroupId: device.carGroupId,
              isOnline: device.isOnline,
              currentLocation: device.currentLocation,
              totalAdPlayTime: device.totalAdPlayTime,
              totalAdImpressions: device.totalAdImpressions,
              totalQRScans: device.totalQRScans,
              averageAdCompletionRate: this.calculateAverageCompletionRate(device.adPlaybacks),
              qrScans: device.qrScans,
              adPlaybacks: device.adPlaybacks,
              lastSeen: device.lastSeen,
              createdAt: device.createdAt,
              updatedAt: new Date()
            };
            return materialData;
          });

          // Update materials array directly to avoid parallel save conflicts
          const existingMaterials = analytics.materials || [];
          const updatedMaterials = [...existingMaterials];
          
          materialUpdates.forEach(materialData => {
            const existingIndex = updatedMaterials.findIndex(m => m.materialId === materialData.materialId);
            if (existingIndex >= 0) {
              // Update existing material
              updatedMaterials[existingIndex] = { ...updatedMaterials[existingIndex], ...materialData };
            } else {
              // Add new material
              updatedMaterials.push(materialData);
            }
          });
          
          // Update the analytics document directly
          await Analytics.findByIdAndUpdate(analytics._id, {
            $set: { materials: updatedMaterials }
          });
          console.log(`✅ Updated Analytics for ad ${adId}`);

        } catch (error) {
          console.error(`❌ Error updating Analytics for ad ${adId}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ Error updating Analytics collection:', error);
      throw error;
    }
  }

  // Calculate average completion rate
  calculateAverageCompletionRate(adPlaybacks) {
    if (!adPlaybacks || adPlaybacks.length === 0) return 0;
    
    const totalCompletion = adPlaybacks.reduce((sum, ad) => sum + (ad.completionRate || 0), 0);
    return totalCompletion / adPlaybacks.length;
  }

  // Check if an ad is a company ad (should not have analytics)
  isCompanyAd(adId, adTitle) {
    // Company ads are identified by:
    // 1. Specific titles like "COMPANY ADS"
    // 2. Ad IDs that exist in the CompanyAd collection
    // 3. Ad titles that match company ad patterns
    
    const companyAdTitles = [
      'COMPANY ADS',
      'Company Ads',
      'company ads',
      'COMPANY AD',
      'Company Ad',
      'company ad'
    ];
    
    // Check if title matches company ad patterns
    if (companyAdTitles.includes(adTitle)) {
      return true;
    }
    
    // Check if title contains company ad keywords
    const companyKeywords = ['company', 'internal', 'fallback', 'default'];
    const titleLower = adTitle.toLowerCase();
    if (companyKeywords.some(keyword => titleLower.includes(keyword))) {
      return true;
    }
    
    return false;
  }

  // Clean up existing company ad analytics records
  async cleanupCompanyAdAnalytics() {
    try {
      const Analytics = require('../models/analytics');
      
      // Find all analytics records that are company ads
      const companyAdAnalytics = await Analytics.find({
        $or: [
          { adTitle: 'COMPANY ADS' },
          { adTitle: 'Company Ads' },
          { adTitle: 'company ads' },
          { adTitle: 'COMPANY AD' },
          { adTitle: 'Company Ad' },
          { adTitle: 'company ad' },
          { adTitle: { $regex: /company/i } },
          { adTitle: { $regex: /internal/i } },
          { adTitle: { $regex: /fallback/i } },
          { adTitle: { $regex: /default/i } }
        ]
      });
      
      if (companyAdAnalytics.length > 0) {
        console.log(`🧹 Found ${companyAdAnalytics.length} company ad analytics records to clean up`);
        
        // Delete company ad analytics records
        const result = await Analytics.deleteMany({
          _id: { $in: companyAdAnalytics.map(ad => ad._id) }
        });
        
        console.log(`✅ Cleaned up ${result.deletedCount} company ad analytics records`);
      } else {
        console.log('ℹ️  No company ad analytics records found to clean up');
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up company ad analytics:', error);
    }
  }

  // Manual archive trigger (for testing)
  async manualArchive(dateStr) {
    console.log(`🔄 Manual archive triggered for date: ${dateStr}`);
    
    const targetDate = new Date(dateStr);
    const dailyData = await DeviceTracking.find({ date: targetDate });
    
    if (dailyData.length === 0) {
      console.log('ℹ️  No data found for the specified date');
      return;
    }

    // Process each device record
    const archivePromises = dailyData.map(device => this.archiveDeviceData(device, dateStr));
    await Promise.all(archivePromises);

    console.log(`✅ Manual archive completed for ${dailyData.length} devices`);
  }

  // Get archive status
  async getArchiveStatus() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentDayData = await DeviceTracking.countDocuments({ date: today });
    const yesterdayData = await DeviceTracking.countDocuments({ date: yesterdayStr });
    const archivedData = await DeviceDataHistory.countDocuments({ date: yesterdayStr });

    return {
      currentDay: {
        date: today,
        deviceCount: currentDayData
      },
      yesterday: {
        date: yesterdayStr,
        deviceCount: yesterdayData,
        archivedCount: archivedData
      },
      isArchiveNeeded: yesterdayData > 0 && archivedData === 0
    };
  }
}

// Create singleton instance
const dailyArchiveJob = new DailyArchiveJob();

module.exports = dailyArchiveJob;
