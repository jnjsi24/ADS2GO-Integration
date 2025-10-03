const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

class DailyArchiveJobV2 {
  constructor() {
    this.isRunning = false;
  }

  async archiveDailyData() {
    if (this.isRunning) {
      console.log('⏭️ Archive job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting daily archive job V2 (Array Structure)...');

    try {
      // Get today's date in Philippines timezone for archiving
      const now = new Date();
      const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
      
      const year = philippinesTime.getFullYear();
      const month = String(philippinesTime.getMonth() + 1).padStart(2, '0');
      const day = String(philippinesTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      console.log(`📅 Archiving data for date: ${dateStr} (Current day)`);

      // Get all device tracking records for today
      const devices = await DeviceTracking.find({
        date: new Date(philippinesTime.getFullYear(), philippinesTime.getMonth(), philippinesTime.getDate())
      });

      console.log(`📊 Found ${devices.length} device records to archive`);

      for (const device of devices) {
        await this.archiveMaterialDataV2(device, dateStr);
      }

      console.log('✅ Daily archive job V2 completed successfully');

    } catch (error) {
      console.error('❌ Daily archive job V2 failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async archiveMaterialDataV2(device, dateStr) {
    try {
      const deviceTimezone = 'Asia/Manila';
      const targetDate = new Date(dateStr);

      // Prepare daily data
      const dailyData = {
        date: targetDate,
        totalAdPlays: device.totalAdPlays || 0,
        totalQRScans: device.totalQRScans || 0,
        totalDistanceTraveled: device.totalDistanceTraveled || 0,
        totalHoursOnline: this.getFinalHoursOnline(device, deviceTimezone),
        totalAdImpressions: device.totalAdImpressions || 0,
        totalAdPlayTime: device.totalAdPlayTime || 0,
        
        // Enhanced hours tracking
        hoursTracking: this.prepareHoursTracking(device, deviceTimezone),
        
        // Daily summary
        dailySummary: this.prepareDailySummary(device),
        
        // Hourly breakdown
        hourlyStats: device.hourlyStats || [],
        
        // Location data (keep last 960 entries, filter invalid entries)
        locationHistory: (device.locationHistory || [])
          .filter(loc => loc && loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2)
          .slice(-960),
        
        // Ad performance
        adPerformance: device.adPerformance || [],
        
        // QR scan details
        qrScans: device.qrScans || [],
        qrScansByAd: device.qrScansByAd || [],
        
        // Ad playback details (keep last 800 entries)
        adPlaybacks: (device.adPlaybacks || []).slice(-800),
        
        // Network and connectivity
        networkStatus: device.networkStatus || {},
        
        // Compliance data
        complianceData: device.complianceData || {},
        
        // Basic vehicle display status
        isDisplaying: device.isDisplaying !== false,
        maintenanceMode: device.maintenanceMode || false,
        
        // Metadata
        archivedAt: new Date(),
        dataSource: 'deviceTracking',
        version: '4.0',
        lastDataUpdate: new Date(),
        lastArchiveUpdate: new Date(),
        updateCount: 1,
        lastUpdateSource: 'cron',
        lastUpdateType: 'create'
      };

      // Find existing document for this material
      let existingDocument = await DeviceDataHistoryV2.findOne({
        materialId: device.materialId
      });

      if (existingDocument) {
        // Check if daily data for this date already exists
        const existingDailyIndex = existingDocument.dailyData.findIndex(d => 
          d.date.toDateString() === targetDate.toDateString()
        );

        if (existingDailyIndex >= 0) {
          // Update existing daily data
          console.log(`🔄 Updating existing daily data for material ${device.materialId} on ${dateStr}`);
          
          // Merge arrays to avoid duplicates
          const existingDaily = existingDocument.dailyData[existingDailyIndex];
          dailyData.locationHistory = this.mergeLocationHistory(existingDaily.locationHistory, dailyData.locationHistory);
          dailyData.adPlaybacks = this.mergeAdPlaybacks(existingDaily.adPlaybacks, dailyData.adPlaybacks);
          dailyData.qrScans = this.mergeQrScans(existingDaily.qrScans, dailyData.qrScans);
          dailyData.hourlyStats = this.mergeHourlyStats(existingDaily.hourlyStats, dailyData.hourlyStats);
          dailyData.adPerformance = this.mergeAdPerformance(existingDaily.adPerformance, dailyData.adPerformance);
          dailyData.qrScansByAd = this.mergeQrScansByAd(existingDaily.qrScansByAd, dailyData.qrScansByAd);
          
          // Update the daily data
          existingDocument.dailyData[existingDailyIndex] = dailyData;
          existingDocument.lastArchiveUpdate = new Date();
          existingDocument.totalUpdates += 1;
          
          // Update lifetime totals
          existingDocument.updateLifetimeTotals();
          
          await existingDocument.save();
          console.log(`✅ Updated daily data for material ${device.materialId} on ${dateStr}`);
        } else {
          // Add new daily data
          console.log(`➕ Adding new daily data for material ${device.materialId} on ${dateStr}`);
          
          existingDocument.addDailyData(dailyData);
          existingDocument.lastArchiveUpdate = new Date();
          existingDocument.totalUpdates += 1;
          
          await existingDocument.save();
          console.log(`✅ Added new daily data for material ${device.materialId} on ${dateStr}`);
        }
      } else {
        // Create new document
        console.log(`🆕 Creating new document for material ${device.materialId}`);
        
        const newDocument = new DeviceDataHistoryV2({
          materialId: device.materialId,
          carGroupId: device.carGroupId,
          deviceInfo: device.deviceInfo || {},
          dailyData: [dailyData],
          lifetimeTotals: {
            totalAdPlays: dailyData.totalAdPlays,
            totalQRScans: dailyData.totalQRScans,
            totalDistanceTraveled: dailyData.totalDistanceTraveled,
            totalHoursOnline: dailyData.totalHoursOnline,
            totalAdImpressions: dailyData.totalAdImpressions,
            totalAdPlayTime: dailyData.totalAdPlayTime,
            totalDays: 1,
            averageDailyHours: dailyData.totalHoursOnline,
            complianceRate: dailyData.complianceData?.complianceRate || 0
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          lastDataUpdate: new Date(),
          lastArchiveUpdate: new Date(),
          totalUpdates: 1
        });

        await newDocument.save();
        console.log(`✅ Created new document for material ${device.materialId}`);
      }

    } catch (error) {
      console.error(`❌ Failed to archive material data for ${device.materialId}:`, error);
      throw error;
    }
  }

  // Helper methods (same as original)
  getFinalHoursOnline(device, deviceTimezone) {
    if (device.hoursTracking && device.hoursTracking.totalOnlineHours !== undefined) {
      return device.hoursTracking.totalOnlineHours;
    }
    return device.totalHoursOnline || 0;
  }

  prepareHoursTracking(device, deviceTimezone) {
    return {
      deviceTimezone: deviceTimezone,
      sessionStartTime: device.hoursTracking?.sessionStartTime,
      sessionEndTime: device.hoursTracking?.sessionEndTime,
      lastOnlineUpdate: device.hoursTracking?.lastOnlineUpdate,
      offlinePeriods: device.hoursTracking?.offlinePeriods || [],
      complianceStatus: device.hoursTracking?.complianceStatus || 'PENDING',
      targetHours: device.hoursTracking?.targetHours || 8,
      precision: device.hoursTracking?.precision || '30s',
      totalOnlineHours: this.getFinalHoursOnline(device, deviceTimezone)
    };
  }

  prepareDailySummary(device) {
    const adPlaybacks = device.adPlaybacks || [];
    const totalCompletionRate = adPlaybacks.length > 0 
      ? adPlaybacks.reduce((sum, ad) => sum + (ad.completionRate || 0), 0) / adPlaybacks.length
      : 0;

    // Filter valid location data first
    const validLocationHistory = (device.locationHistory || [])
      .filter(loc => loc && loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2);
    
    const maxSpeed = validLocationHistory.length > 0
      ? Math.max(...validLocationHistory.map(loc => loc.speed || 0))
      : 0;

    return {
      totalAdPlays: device.totalAdPlays || 0,
      totalQRScans: device.totalQRScans || 0,
      totalDistanceTraveled: device.totalDistanceTraveled || 0,
      totalHoursOnline: this.getFinalHoursOnline(device, 'Asia/Manila'),
      averageSpeed: validLocationHistory.length > 0
        ? validLocationHistory.reduce((sum, loc) => sum + (loc.speed || 0), 0) / validLocationHistory.length
        : 0,
      maxSpeed: maxSpeed,
      complianceRate: device.complianceData?.complianceRate || 0,
      adCompletionRate: totalCompletionRate,
      totalAdImpressions: device.totalAdImpressions || 0,
      totalAdPlayTime: device.totalAdPlayTime || 0
    };
  }

  // Merge functions (same as original)
  mergeAdPlaybacks(existing, newData) {
    const merged = [...existing];
    const existingKeys = new Set(existing.map(item => `${item.adId}-${item.startTime?.getTime()}`));
    
    newData.forEach(newItem => {
      const key = `${newItem.adId}-${newItem.startTime?.getTime()}`;
      if (!existingKeys.has(key)) {
        merged.push(newItem);
      }
    });
    
    // Keep only the last 800 entries
    return merged.slice(-800);
  }

  mergeQrScans(existing, newData) {
    const merged = [...existing];
    const existingKeys = new Set(existing.map(item => `${item.adId}-${item.scanTimestamp?.getTime()}`));
    
    newData.forEach(newItem => {
      const key = `${newItem.adId}-${newItem.scanTimestamp?.getTime()}`;
      if (!existingKeys.has(key)) {
        merged.push(newItem);
      }
    });
    
    return merged;
  }

  mergeLocationHistory(existing, newData) {
    const merged = [...existing];
    const existingKeys = new Set(existing.map(item => item.timestamp?.getTime()));
    
    newData.forEach(newItem => {
      const key = newItem.timestamp?.getTime();
      if (key && !existingKeys.has(key)) {
        merged.push(newItem);
      }
    });
    
    // Keep only the last 960 entries
    return merged.slice(-960);
  }

  mergeHourlyStats(existing, newData) {
    const merged = [...existing];
    
    newData.forEach(newStat => {
      const existingIndex = merged.findIndex(stat => stat.hour === newStat.hour);
      if (existingIndex >= 0) {
        // Update existing hourly stat
        merged[existingIndex] = newStat;
      } else {
        // Add new hourly stat
        merged.push(newStat);
      }
    });
    
    return merged;
  }

  mergeAdPerformance(existing, newData) {
    const merged = [...existing];
    
    newData.forEach(newAd => {
      const existingIndex = merged.findIndex(ad => ad.adId === newAd.adId);
      if (existingIndex >= 0) {
        // Update existing ad performance
        merged[existingIndex] = newAd;
      } else {
        // Add new ad performance
        merged.push(newAd);
      }
    });
    
    return merged;
  }

  mergeQrScansByAd(existing, newData) {
    const merged = [...existing];
    
    newData.forEach(newQrScan => {
      const existingIndex = merged.findIndex(qrScan => qrScan.adId === newQrScan.adId);
      if (existingIndex >= 0) {
        // Update existing QR scan data
        merged[existingIndex] = newQrScan;
      } else {
        // Add new QR scan data
        merged.push(newQrScan);
      }
    });
    
    return merged;
  }

  // Get archive status
  async getArchiveStatus() {
    try {
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const DeviceTracking = require('../models/deviceTracking');
      
      const totalMaterials = await DeviceDataHistoryV2.countDocuments();
      const totalDeviceRecords = await DeviceTracking.countDocuments();
      
      return {
        isRunning: this.isRunning,
        totalMaterials: totalMaterials,
        totalDeviceRecords: totalDeviceRecords,
        lastRun: new Date(),
        status: 'V2 Array Structure Active'
      };
    } catch (error) {
      console.error('Error getting archive status:', error);
      return {
        isRunning: this.isRunning,
        error: error.message,
        status: 'Error'
      };
    }
  }
}

// Create singleton instance
const dailyArchiveJobV2 = new DailyArchiveJobV2();

module.exports = dailyArchiveJobV2;
