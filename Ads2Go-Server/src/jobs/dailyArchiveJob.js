const mongoose = require('mongoose');
const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistory = require('../models/deviceDataHistory');
const Analytics = require('../models/analytics');

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
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      console.log(`📅 Archiving data for date: ${dateStr}`);

      // Get all DeviceTracking records for yesterday
      const dailyData = await DeviceTracking.find({ date: dateStr });
      
      if (dailyData.length === 0) {
        console.log('ℹ️  No data found for archiving');
        this.isRunning = false;
        return;
      }

      console.log(`📊 Found ${dailyData.length} device records to archive`);

      // Process each device record
      const archivePromises = dailyData.map(device => this.archiveDeviceData(device, dateStr));
      await Promise.all(archivePromises);

      // Clear yesterday's data from DeviceTracking
      await DeviceTracking.deleteMany({ date: dateStr });
      console.log(`🗑️  Cleared ${dailyData.length} records from DeviceTracking`);

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

  // Archive individual device data
  async archiveDeviceData(device, dateStr) {
    try {
      // Process each slot in the device (new schema)
      const archivePromises = device.slots.map(slot => this.archiveSlotData(device, slot, dateStr));
      await Promise.all(archivePromises);
      
      console.log(`✅ Archived data for material ${device.materialId} with ${device.slots.length} slots`);
    } catch (error) {
      console.error(`❌ Error archiving device data for material ${device.materialId}:`, error);
    }
  }

  // Archive individual slot data
  async archiveSlotData(device, slot, dateStr) {
    try {
      // Calculate daily summary for this slot
      const dailySummary = this.calculateDailySummaryForSlot(device, slot);
      
      // Create archive record for this slot
      const archiveRecord = {
        deviceId: slot.deviceId,
        deviceSlot: slot.slotNumber,
        materialId: device.materialId,
        carGroupId: device.carGroupId,
        date: new Date(dateStr),
        
        // Device info
        deviceInfo: slot.deviceInfo || {},
        
        // Daily totals (from device level)
        totalAdPlays: device.totalAdPlays,
        totalQRScans: device.totalQRScans,
        totalDistanceTraveled: device.totalDistanceTraveled,
        totalHoursOnline: device.totalHoursOnline,
        
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
        
        // Ad playback details
        adPlaybacks: device.adPlaybacks,
        
        // Network and connectivity
        networkStatus: device.networkStatus,
        
        // Compliance data
        complianceData: device.complianceData,
        
        // Metadata
        archivedAt: new Date(),
        dataSource: 'deviceTracking',
        version: '2.0'
      };

      // Save to DeviceDataHistory
      await DeviceDataHistory.create(archiveRecord);
      console.log(`✅ Archived data for device ${slot.deviceId} in material ${device.materialId}`);
    } catch (error) {
      console.error(`❌ Error archiving slot data for device ${slot.deviceId}:`, error);
    }
  }

  // Calculate daily summary for a specific slot
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

          // Update with daily data
          adData.devices.forEach(device => {
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

            // Add or update material
            analytics.addMaterial(materialData);
          });

          await analytics.save();
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
