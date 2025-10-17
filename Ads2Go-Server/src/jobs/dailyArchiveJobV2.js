const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const logger = require('../utils/logger');

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
    logger.database('🔄 Starting daily archive job V2 (Array Structure)...');

    try {
      // Get today's date in Philippines timezone for archiving
      const now = new Date();
      const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
      
      const year = philippinesTime.getFullYear();
      const month = String(philippinesTime.getMonth() + 1).padStart(2, '0');
      const day = String(philippinesTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      logger.database(`📅 Archiving data for date: ${dateStr} (Current day)`);

      // Get all device tracking records using flexible date matching
      const devices = await this.getDevicesForArchiving(philippinesTime);

      logger.database(`📊 Found ${devices.length} device records to archive`);

      for (const device of devices) {
        await this.archiveMaterialDataV2(device, dateStr);
      }

      logger.database('✅ Daily archive job V2 completed successfully');

    } catch (error) {
      console.error('❌ Daily archive job V2 failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // New method to handle flexible date matching for archiving
  async getDevicesForArchiving(philippinesTime) {
    try {
      // Create multiple date formats to match different DeviceTracking record formats
      const targetYear = philippinesTime.getFullYear();
      const targetMonth = philippinesTime.getMonth();
      const targetDay = philippinesTime.getDate();
      
      // Format 1: Midnight Philippines time (original format)
      const midnightPhilippines = new Date(targetYear, targetMonth, targetDay);
      
      // Format 2: Midnight UTC (common format)
      const midnightUTC = new Date(Date.UTC(targetYear, targetMonth, targetDay));
      
      // Format 3: Previous day at 4 PM UTC (to catch records created with different timezone handling)
      const previousDay4PM = new Date(Date.UTC(targetYear, targetMonth, targetDay - 1, 16, 0, 0));
      
      // Format 4: Current day at 4 PM UTC
      const currentDay4PM = new Date(Date.UTC(targetYear, targetMonth, targetDay, 16, 0, 0));
      
      logger.database(`🔍 Searching for devices with dates:`);
      logger.database(`   - Midnight Philippines: ${midnightPhilippines.toISOString()}`);
      logger.database(`   - Midnight UTC: ${midnightUTC.toISOString()}`);
      logger.database(`   - Previous day 4PM UTC: ${previousDay4PM.toISOString()}`);
      logger.database(`   - Current day 4PM UTC: ${currentDay4PM.toISOString()}`);
      
      // Query for devices with any of these date formats
      const devices = await DeviceTracking.find({
        $or: [
          { date: midnightPhilippines },
          { date: midnightUTC },
          { date: previousDay4PM },
          { date: currentDay4PM },
          // Also search for records within the last 2 days to catch any missed records
          { 
            date: { 
              $gte: new Date(Date.UTC(targetYear, targetMonth, targetDay - 2, 0, 0, 0)),
              $lte: new Date(Date.UTC(targetYear, targetMonth, targetDay + 1, 23, 59, 59))
            }
          }
        ]
      });
      
      logger.database(`📊 Found ${devices.length} devices with flexible date matching`);
      
      // Log the dates found for debugging
      devices.forEach((device, index) => {
        logger.database(`   Device ${index + 1}: ${device.materialId} - Date: ${device.date?.toISOString()}`);
      });
      
      return devices;
      
    } catch (error) {
      console.error('❌ Error getting devices for archiving:', error);
      // Fallback to original method if flexible matching fails
      console.log('🔄 Falling back to original date matching method');
      return await DeviceTracking.find({
        date: new Date(philippinesTime.getFullYear(), philippinesTime.getMonth(), philippinesTime.getDate())
      });
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
          .slice(-4114), // 8 hours at 7s intervals
        
        // Ad performance (filter out entries without userId)
        adPerformance: (device.adPerformance || []).filter(perf => perf.userId),
        
        // QR scan details (filter out invalid location data and entries without userId)
        qrScans: this.cleanQRScanData(device.qrScans).filter(scan => scan.userId),
        qrScansByAd: (device.qrScansByAd || []).filter(scan => scan.userId),
        
        // Ad playback details (keep last 800 entries, filter out entries without userId)
        adPlaybacks: (device.adPlaybacks || []).filter(pb => pb.userId).slice(-800),
        
        // Network and connectivity
        networkStatus: device.networkStatus || {},
        
        // Compliance data
        complianceData: device.complianceData || {},
        
        // Basic vehicle display status
        isDisplaying: device.isDisplaying !== false,
        maintenanceMode: device.maintenanceMode || false,
        
        // Deployed ads (synced from AdsDeployment)
        deployedAds: device.deployedAds || [],
        currentDeploymentId: device.currentDeploymentId ? device.currentDeploymentId.toString() : undefined,
        lastDeploymentSync: device.lastDeploymentSync || undefined,
        
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
          logger.database(`🔄 Updating existing daily data for material ${device.materialId} on ${dateStr}`);
          
          // Merge arrays to avoid duplicates
          const existingDaily = existingDocument.dailyData[existingDailyIndex];
          
          // Clean existing QR scans data to remove any invalid coordinates
          const cleanedExistingQrScans = this.cleanQRScanData(existingDaily.qrScans);
          
          // Also clean the new daily data QR scans before merging
          const cleanedNewQrScans = this.cleanQRScanData(dailyData.qrScans);
          
          dailyData.locationHistory = this.mergeLocationHistory(existingDaily.locationHistory, dailyData.locationHistory);
          dailyData.adPlaybacks = this.mergeAdPlaybacks(existingDaily.adPlaybacks, dailyData.adPlaybacks);
          dailyData.qrScans = this.mergeQrScans(cleanedExistingQrScans, cleanedNewQrScans);
          dailyData.hourlyStats = this.mergeHourlyStats(existingDaily.hourlyStats, dailyData.hourlyStats);
          dailyData.adPerformance = this.mergeAdPerformance(existingDaily.adPerformance, dailyData.adPerformance);
          dailyData.qrScansByAd = this.mergeQrScansByAd(existingDaily.qrScansByAd, dailyData.qrScansByAd);
          
          // Final cleaning of the daily data before assignment
          dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
          
          // Update the daily data
          existingDocument.dailyData[existingDailyIndex] = dailyData;
          existingDocument.lastArchiveUpdate = new Date();
          existingDocument.totalUpdates += 1;
          
          // Update lifetime totals
          existingDocument.updateLifetimeTotals();
          
          try {
            await existingDocument.save();
            logger.database(`✅ Updated daily data for material ${device.materialId} on ${dateStr}`);
          } catch (saveError) {
            // If save fails due to validation errors, clean the existing data and retry
            if (saveError.name === 'ValidationError' && saveError.message.includes('coordinates')) {
              console.log(`🧹 Validation error detected for ${device.materialId}, deep cleaning existing data...`);
              
              // Deep clean all QR scans in the existing document
              this.deepCleanQRScanData(existingDocument);
              
              // Mark the document as modified to ensure Mongoose recognizes the changes
              existingDocument.markModified('dailyData');
              existingDocument.markModified('dailyData.qrScans');
              
              // Force validation to run again to ensure the data is clean
              try {
                await existingDocument.validate();
                console.log(`✅ Document validation passed after deep cleaning for ${device.materialId}`);
              } catch (validationError) {
                console.error(`❌ Document validation failed after deep cleaning for ${device.materialId}:`, validationError.message);
                // If validation still fails, try to remove the problematic QR scan entirely
                this.removeProblematicQRScans(existingDocument);
                existingDocument.markModified('dailyData');
              }
              
              // Try to save again
              try {
                await existingDocument.save();
                logger.database(`✅ Updated daily data for material ${device.materialId} on ${dateStr} (after deep cleaning)`);
              } catch (retryError) {
                console.error(`❌ Failed to save ${device.materialId} even after deep cleaning:`, retryError.message);
                throw retryError;
              }
            } else {
              throw saveError;
            }
          }
        } else {
          // Add new daily data
          console.log(`➕ Adding new daily data for material ${device.materialId} on ${dateStr}`);
          
          // Final cleaning of the daily data before adding
          dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
          
          existingDocument.addDailyData(dailyData);
          existingDocument.lastArchiveUpdate = new Date();
          existingDocument.totalUpdates += 1;
          
          try {
            await existingDocument.save();
            console.log(`✅ Added new daily data for material ${device.materialId} on ${dateStr}`);
          } catch (saveError) {
            // If save fails due to validation errors, clean the existing data and retry
            if (saveError.name === 'ValidationError' && saveError.message.includes('coordinates')) {
              console.log(`🧹 Validation error detected for ${device.materialId}, deep cleaning existing data...`);
              
              // Deep clean all QR scans in the existing document
              this.deepCleanQRScanData(existingDocument);
              
              // Mark the document as modified to ensure Mongoose recognizes the changes
              existingDocument.markModified('dailyData');
              existingDocument.markModified('dailyData.qrScans');
              
              // Force validation to run again to ensure the data is clean
              try {
                await existingDocument.validate();
                console.log(`✅ Document validation passed after deep cleaning for ${device.materialId}`);
              } catch (validationError) {
                console.error(`❌ Document validation failed after deep cleaning for ${device.materialId}:`, validationError.message);
                // If validation still fails, try to remove the problematic QR scan entirely
                this.removeProblematicQRScans(existingDocument);
                existingDocument.markModified('dailyData');
              }
              
              // Try to save again
              try {
                await existingDocument.save();
                console.log(`✅ Added new daily data for material ${device.materialId} on ${dateStr} (after deep cleaning)`);
              } catch (retryError) {
                console.error(`❌ Failed to save ${device.materialId} even after deep cleaning:`, retryError.message);
                throw retryError;
              }
            } else {
              throw saveError;
            }
          }
        }
      } else {
        // Create new document
        console.log(`🆕 Creating new document for material ${device.materialId}`);
        
        // Final cleaning of the daily data before creating new document
        dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
        
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

        try {
          await newDocument.save();
          console.log(`✅ Created new document for material ${device.materialId}`);
        } catch (saveError) {
          // If save fails due to validation errors, clean the data and retry
          if (saveError.name === 'ValidationError' && saveError.message.includes('coordinates')) {
            console.log(`🧹 Validation error detected for ${device.materialId}, deep cleaning data...`);
            
            // Deep clean all QR scans in the new document
            this.deepCleanQRScanData(newDocument);
            
            // Mark the document as modified to ensure Mongoose recognizes the changes
            newDocument.markModified('dailyData');
            newDocument.markModified('dailyData.qrScans');
            
            // Force validation to run again to ensure the data is clean
            try {
              await newDocument.validate();
              console.log(`✅ Document validation passed after deep cleaning for ${device.materialId}`);
            } catch (validationError) {
              console.error(`❌ Document validation failed after deep cleaning for ${device.materialId}:`, validationError.message);
              // If validation still fails, try to remove the problematic QR scan entirely
              this.removeProblematicQRScans(newDocument);
              newDocument.markModified('dailyData');
            }
            
            // Try to save again
            try {
              await newDocument.save();
              console.log(`✅ Created new document for material ${device.materialId} (after deep cleaning)`);
            } catch (retryError) {
              console.error(`❌ Failed to save ${device.materialId} even after deep cleaning:`, retryError.message);
              throw retryError;
            }
          } else {
            throw saveError;
          }
        }
      }

    } catch (error) {
      console.error(`❌ Failed to archive material data for ${device.materialId}:`, error);
      throw error;
    }
  }

  // Helper method to clean QR scan data
  cleanQRScanData(qrScans) {
    if (!qrScans || qrScans.length === 0) {
      return [];
    }
    
    let cleanedCount = 0;
    const cleanedScans = qrScans.map((qrScan, index) => {
      // Clean up QR scan data to ensure valid coordinates
      if (qrScan.location) {
        // Check if location has coordinates
        if (qrScan.location.coordinates) {
          // If coordinates is empty or invalid, remove the location field
          if (!Array.isArray(qrScan.location.coordinates) || 
              qrScan.location.coordinates.length === 0 ||
              qrScan.location.coordinates.length !== 2 ||
              typeof qrScan.location.coordinates[0] !== 'number' ||
              typeof qrScan.location.coordinates[1] !== 'number' ||
              isNaN(qrScan.location.coordinates[0]) ||
              isNaN(qrScan.location.coordinates[1]) ||
              !isFinite(qrScan.location.coordinates[0]) ||
              !isFinite(qrScan.location.coordinates[1])) {
            cleanedCount++;
            console.log(`🧹 QR scan ${index}: Removing invalid coordinates:`, qrScan.location.coordinates);
            const { location, ...qrScanWithoutLocation } = qrScan;
            return qrScanWithoutLocation;
          }
        } else {
          // If location exists but has no coordinates, remove the entire location field
          cleanedCount++;
          console.log(`🧹 QR scan ${index}: Removing location without coordinates`);
          const { location, ...qrScanWithoutLocation } = qrScan;
          return qrScanWithoutLocation;
        }
      }
      return qrScan;
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} QR scans with invalid coordinates`);
    }
    
    return cleanedScans;
  }

  // Helper method to deeply clean all QR scan data in a document
  deepCleanQRScanData(document) {
    if (!document || !document.dailyData) {
      return document;
    }
    
    let totalCleaned = 0;
    
    // Clean QR scans in each daily data entry
    for (let i = 0; i < document.dailyData.length; i++) {
      const dailyData = document.dailyData[i];
      if (dailyData.qrScans && Array.isArray(dailyData.qrScans)) {
        const originalCount = dailyData.qrScans.length;
        let dailyCleaned = 0;
        
        // Clean each QR scan individually and modify in place
        for (let j = dailyData.qrScans.length - 1; j >= 0; j--) {
          const qrScan = dailyData.qrScans[j];
          if (qrScan.location && qrScan.location.coordinates) {
            // Check if coordinates are invalid (including empty arrays)
            if (!Array.isArray(qrScan.location.coordinates) || 
                qrScan.location.coordinates.length === 0 ||
                qrScan.location.coordinates.length !== 2 ||
                typeof qrScan.location.coordinates[0] !== 'number' ||
                typeof qrScan.location.coordinates[1] !== 'number' ||
                isNaN(qrScan.location.coordinates[0]) ||
                isNaN(qrScan.location.coordinates[1]) ||
                !isFinite(qrScan.location.coordinates[0]) ||
                !isFinite(qrScan.location.coordinates[1])) {
              
              console.log(`🧹 QR scan ${j}: Removing invalid coordinates:`, qrScan.location.coordinates);
              // Remove the location field entirely
              delete qrScan.location;
              dailyCleaned++;
              totalCleaned++;
            }
          } else if (qrScan.location && !qrScan.location.coordinates) {
            // If location exists but has no coordinates, remove the entire location field
            console.log(`🧹 QR scan ${j}: Removing location without coordinates`);
            delete qrScan.location;
            dailyCleaned++;
            totalCleaned++;
          }
        }
        
        if (dailyCleaned > 0) {
          console.log(`🧹 Daily data ${i}: Cleaned ${dailyCleaned} QR scans`);
        }
      }
    }
    
    if (totalCleaned > 0) {
      console.log(`🧹 Deep cleaned ${totalCleaned} total QR scans across all daily data`);
    }
    
    return document;
  }

  // Helper method to remove problematic QR scans that still cause validation errors
  removeProblematicQRScans(document) {
    if (!document || !document.dailyData) {
      return document;
    }
    
    let totalRemoved = 0;
    
    // Remove problematic QR scans in each daily data entry
    for (let i = 0; i < document.dailyData.length; i++) {
      const dailyData = document.dailyData[i];
      if (dailyData.qrScans && Array.isArray(dailyData.qrScans)) {
        const originalCount = dailyData.qrScans.length;
        
        // Filter out QR scans with invalid location data
        dailyData.qrScans = dailyData.qrScans.filter((qrScan, index) => {
          if (qrScan.location && qrScan.location.coordinates) {
            // Check if coordinates are invalid
            if (!Array.isArray(qrScan.location.coordinates) || 
                qrScan.location.coordinates.length === 0 ||
                qrScan.location.coordinates.length !== 2 ||
                typeof qrScan.location.coordinates[0] !== 'number' ||
                typeof qrScan.location.coordinates[1] !== 'number' ||
                isNaN(qrScan.location.coordinates[0]) ||
                isNaN(qrScan.location.coordinates[1]) ||
                !isFinite(qrScan.location.coordinates[0]) ||
                !isFinite(qrScan.location.coordinates[1])) {
              
              console.log(`🗑️ QR scan ${index}: Removing QR scan with invalid coordinates:`, qrScan.location.coordinates);
              return false; // Remove this QR scan
            }
          } else if (qrScan.location && !qrScan.location.coordinates) {
            // If location exists but has no coordinates, remove the QR scan
            console.log(`🗑️ QR scan ${index}: Removing QR scan with location but no coordinates`);
            return false; // Remove this QR scan
          }
          return true; // Keep this QR scan
        });
        
        const removedCount = originalCount - dailyData.qrScans.length;
        if (removedCount > 0) {
          totalRemoved += removedCount;
          console.log(`🗑️ Daily data ${i}: Removed ${removedCount} problematic QR scans`);
        }
      }
    }
    
    if (totalRemoved > 0) {
      console.log(`🗑️ Removed ${totalRemoved} total problematic QR scans across all daily data`);
    }
    
    return document;
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
    
    // Clean the new data before processing
    const cleanedNewData = this.cleanQRScanData(newData);
    
    cleanedNewData.forEach(newItem => {
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
    
    // Keep only the last 4114 entries (8 hours at 7s intervals)
    return merged.slice(-4114);
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

  // Method to archive all unarchived records (useful for catching missed records)
  async archiveAllUnarchivedRecords() {
    if (this.isRunning) {
      console.log('⏭️ Archive job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting archive for all unarchived records...');

    try {
      // Get all DeviceTracking records
      const allDevices = await DeviceTracking.find({});
      console.log(`📊 Found ${allDevices.length} total DeviceTracking records`);

      let archivedCount = 0;
      let skippedCount = 0;

      for (const device of allDevices) {
        try {
          // Check if this material already has archived data
          const existingArchive = await DeviceDataHistoryV2.findOne({
            materialId: device.materialId
          });

          if (existingArchive) {
            // Check if this specific date is already archived with similar data
            const deviceDate = device.date;
            const deviceDateStr = deviceDate.toISOString().split('T')[0];
            
            // Find existing daily data for the same date
            const existingDailyData = existingArchive.dailyData.find(dailyData => {
              if (!dailyData.date) return false;
              const dailyDataDateStr = dailyData.date.toISOString().split('T')[0];
              return dailyDataDateStr === deviceDateStr;
            });

            if (existingDailyData) {
              // Check if the data is significantly different (more than 10% difference in key metrics)
              const currentAdPlays = device.totalAdPlays || 0;
              const archivedAdPlays = existingDailyData.totalAdPlays || 0;
              const currentHoursOnline = device.totalHoursOnline || 0;
              const archivedHoursOnline = existingDailyData.totalHoursOnline || 0;
              
              const adPlaysDiff = Math.abs(currentAdPlays - archivedAdPlays);
              const hoursDiff = Math.abs(currentHoursOnline - archivedHoursOnline);
              
              // If data is similar (less than 10% difference), skip
              const adPlaysSimilar = adPlaysDiff < Math.max(10, currentAdPlays * 0.1);
              const hoursSimilar = hoursDiff < Math.max(0.1, currentHoursOnline * 0.1);
              
              if (adPlaysSimilar && hoursSimilar) {
                console.log(`⏭️ Skipping ${device.materialId} - already archived with similar data for date ${deviceDateStr} (${archivedAdPlays} plays, ${archivedHoursOnline.toFixed(2)}h)`);
                skippedCount++;
                continue;
              } else {
                console.log(`🔄 Updating ${device.materialId} - data has changed for date ${deviceDateStr} (${archivedAdPlays} → ${currentAdPlays} plays, ${archivedHoursOnline.toFixed(2)} → ${currentHoursOnline.toFixed(2)}h)`);
              }
            }
          }

          // Archive this device
          const dateStr = device.date.toISOString().split('T')[0];
          await this.archiveMaterialDataV2(device, dateStr);
          archivedCount++;
          console.log(`✅ Archived ${device.materialId} for date ${dateStr}`);

        } catch (error) {
          console.error(`❌ Failed to archive ${device.materialId}:`, error.message);
        }
      }

      console.log(`✅ Archive completed: ${archivedCount} archived, ${skippedCount} skipped`);

    } catch (error) {
      console.error('❌ Archive all unarchived records failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Method to force archive all records (ignores existing data checks)
  async forceArchiveAllRecords() {
    if (this.isRunning) {
      console.log('⏭️ Archive job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting FORCE archive for all records...');

    try {
      // Get all DeviceTracking records
      const allDevices = await DeviceTracking.find({});
      console.log(`📊 Found ${allDevices.length} total DeviceTracking records`);

      let archivedCount = 0;

      for (const device of allDevices) {
        try {
          // Force archive this device regardless of existing data
          const dateStr = device.date.toISOString().split('T')[0];
          await this.archiveMaterialDataV2(device, dateStr);
          archivedCount++;
          console.log(`✅ Force archived ${device.materialId} for date ${dateStr}`);

        } catch (error) {
          console.error(`❌ Failed to force archive ${device.materialId}:`, error.message);
        }
      }

      console.log(`✅ Force archive completed: ${archivedCount} records processed`);

    } catch (error) {
      console.error('❌ Force archive all records failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Method to clean existing archived data with invalid coordinates
  async cleanExistingArchivedData() {
    console.log('🧹 Starting cleanup of existing archived data with invalid coordinates...');
    
    try {
      const documents = await DeviceDataHistoryV2.find({});
      let totalCleaned = 0;
      let documentsProcessed = 0;
      
      for (const doc of documents) {
        let documentModified = false;
        
        // Clean each daily data entry
        for (let i = 0; i < doc.dailyData.length; i++) {
          const dailyData = doc.dailyData[i];
          const originalQrScansCount = dailyData.qrScans ? dailyData.qrScans.length : 0;
          
          // Clean QR scans data
          dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
          
          const cleanedQrScansCount = dailyData.qrScans ? dailyData.qrScans.length : 0;
          const cleanedCount = originalQrScansCount - cleanedQrScansCount;
          
          if (cleanedCount > 0) {
            totalCleaned += cleanedCount;
            documentModified = true;
            console.log(`🧹 Material ${doc.materialId}, Date ${dailyData.date?.toISOString()?.split('T')[0]}: Cleaned ${cleanedCount} QR scans`);
          }
        }
        
        // Save if modified
        if (documentModified) {
          await doc.save();
          documentsProcessed++;
        }
      }
      
      console.log(`✅ Cleanup completed: ${totalCleaned} QR scans cleaned across ${documentsProcessed} documents`);
      return { totalCleaned, documentsProcessed };
      
    } catch (error) {
      console.error('❌ Error cleaning existing archived data:', error);
      throw error;
    }
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
