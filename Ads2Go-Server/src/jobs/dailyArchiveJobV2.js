const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const logger = require('../utils/logger');
const { getUTCMidnight, formatDateString } = require('../utils/dateUtils');
const GPSValidation = require('../utils/gpsValidation');

class DailyArchiveJobV2 {
  constructor() {
    this.isRunning = false;
  }

  async archiveDailyData() {
    if (this.isRunning) {
      console.log('⏭️ Archive job already running, skipping...');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:10',message:'Archive job skipped - already running',data:{isRunning:this.isRunning},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    this.isRunning = true;
    logger.database('🔄 Starting daily archive job V2 (Array Structure)...');
    
    // #region agent log
    // Log archive job start to track if it runs multiple times
    const archiveStartTime = new Date();
    fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:17',message:'Archive job STARTED',data:{startTime:archiveStartTime.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    try {
      // ✅ FIX: Get the date in Philippines timezone properly
      // At 11:55 PM PH time, we want to archive the current day's data
      // We need to calculate the UTC midnight date that corresponds to "today" in PH timezone
      const now = new Date();
      
      // Get date components directly from Philippines timezone using Intl.DateTimeFormat
      // This ensures we get "today" in PH timezone, not UTC timezone
      const phDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const phDateParts = phDateFormatter.formatToParts(now);
      const year = parseInt(phDateParts.find(p => p.type === 'year').value);
      const month = parseInt(phDateParts.find(p => p.type === 'month').value) - 1; // 0-indexed
      const day = parseInt(phDateParts.find(p => p.type === 'day').value);
      
      // Create UTC midnight date directly from Philippines date components
      // This matches how dates are stored in the database (UTC midnight)
      // Using Date.UTC ensures consistency with DeviceTracking records
      const targetUTCDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      
      // Format date string for logging using the utility function
      const dateStr = formatDateString(targetUTCDate);
      
      logger.database(`📅 Archiving data for date: ${dateStr} (Philippines time)`);
      logger.database(`📅 Target UTC date: ${targetUTCDate.toISOString()}`);

      // Get all device tracking records using the correct UTC midnight date
      const devices = await this.getDevicesForArchiving(targetUTCDate);

      logger.database(`📊 Found ${devices.length} device records to archive`);

      for (const device of devices) {
        await this.archiveMaterialDataV2(device, dateStr, targetUTCDate);
      }

      // ✅ ADD VALIDATION
      const validationResult = await this.validateArchive(dateStr);
      
      logger.database(`📊 Archive validation: ${validationResult.archivedMaterials}/${validationResult.totalMaterials} materials archived`);
      
      if (validationResult.missingArchives > 0) {
        logger.database(`⚠️ ${validationResult.missingArchives} materials had missing archives (auto-recovered)`);
      }

      logger.database('✅ Daily archive job V2 completed successfully');

    } catch (error) {
      console.error('❌ Daily archive job V2 failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // ✅ FIX: Simplified date matching using single UTC midnight format
  async getDevicesForArchiving(targetUTCDate) {
    try {
      logger.database(`🔍 Searching for devices with date: ${targetUTCDate.toISOString()}`);
      
      // ✅ FIX: Use exact match first (most efficient)
      let devices = await DeviceTracking.find({
        date: targetUTCDate
      });
      
      // If no devices found with exact match, try range query as fallback
      // This handles edge cases where dates might be slightly off
      if (devices.length === 0) {
        logger.database(`⚠️ No exact match found, trying range query...`);
        const startOfDay = new Date(targetUTCDate);
        const endOfDay = new Date(targetUTCDate);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
        
        devices = await DeviceTracking.find({
          date: { 
            $gte: startOfDay, 
            $lt: endOfDay 
          }
        });
      }
      
      logger.database(`📊 Found ${devices.length} devices for archiving`);
      
      if (devices.length === 0) {
        // ⚠️ WARNING: No devices found - possible issue
        console.warn(`⚠️ WARNING: No devices found for ${targetUTCDate.toISOString().split('T')[0]}`);
        console.warn(`   This might indicate:`);
        console.warn(`   1. No devices were online today`);
        console.warn(`   2. Daily reset already ran and cleared the data`);
        console.warn(`   3. Date format mismatch (check database date format)`);
        console.warn(`   4. Archive job timing issue (running too late)`);
        
        // Try to find any devices with recent dates to help debug
        const recentDevices = await DeviceTracking.find({}).limit(5).select('materialId date');
        if (recentDevices.length > 0) {
          console.warn(`   Sample device dates in database:`);
          recentDevices.forEach(d => {
            console.warn(`     ${d.materialId}: ${d.date ? d.date.toISOString() : 'null'}`);
          });
        }
      }
      
      return devices;
      
    } catch (error) {
      console.error('❌ Error getting devices for archiving:', error);
      throw error;
    }
  }

  async archiveMaterialDataV2(device, dateStr, targetUTCDate = null) {
    try {
      const deviceTimezone = 'Asia/Manila';
      // ✅ FIX: Use the UTC midnight date passed from archiveDailyData, or parse from dateStr as UTC
      // This ensures we use UTC dates consistently, not local timezone dates
      const targetDate = targetUTCDate || getUTCMidnight(new Date(dateStr + 'T00:00:00Z'));

      // Prepare QR scans array first (filter out invalid location data and entries without userId)
      const cleanedQrScans = this.cleanQRScanData(device.qrScans || []).filter(scan => scan.userId);
      
      // ✅ FIX: Calculate totals from arrays instead of counters (similar to QR scans)
      // This ensures data is saved even if counters are reset or not updated
      const calculatedTotalAdPlays = this.calculateTotalAdPlays(device);
      const calculatedTotalDistance = this.calculateTotalDistanceTraveled(device);
      
      // Use calculated values, but fallback to counter if calculated is 0 and counter has value
      // This handles edge cases where arrays might be empty but counters have data
      const totalAdPlays = calculatedTotalAdPlays > 0 ? calculatedTotalAdPlays : (device.totalAdPlays || 0);
      const totalDistanceTraveled = calculatedTotalDistance > 0 ? calculatedTotalDistance : (device.totalDistanceTraveled || 0);
      
      // Prepare daily data
      const dailyData = {
        date: targetDate,
        // ✅ FIX: Use calculated totalAdPlays from adPlaybacks array instead of counter
        totalAdPlays: totalAdPlays,
        // ✅ FIX: Calculate totalQRScans from actual qrScans array length instead of device.totalQRScans
        totalQRScans: cleanedQrScans.length,
        // ✅ FIX: Use calculated totalDistanceTraveled from locationHistory array instead of counter
        totalDistanceTraveled: totalDistanceTraveled,
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
          .slice(-3600), // ✅ MEMORY OPTIMIZATION: Reduced to 2 hours at 2s intervals (was 8 hours)
        
        // Ad performance (filter out entries without userId)
        adPerformance: (device.adPerformance || []).filter(perf => perf.userId),
        
        // QR scan details (filter out invalid location data and entries without userId)
        qrScans: cleanedQrScans,
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
        // ✅ FIX: Compare dates using UTC midnight timestamps instead of toDateString() (timezone-dependent)
        const targetDateTimestamp = targetDate.getTime();
        const existingDailyIndex = existingDocument.dailyData.findIndex(d => {
          if (!d.date) return false;
          const dDate = new Date(d.date);
          return dDate.getTime() === targetDateTimestamp;
        });

        if (existingDailyIndex >= 0) {
          // Update existing daily data
          logger.database(`🔄 Updating existing daily data for material ${device.materialId} on ${dateStr}`);
          
          // Merge arrays to avoid duplicates
          const existingDaily = existingDocument.dailyData[existingDailyIndex];
          
          // #region agent log
          // Log BEFORE merge to track duplicates
          const existingQrScansByAdBefore = (existingDaily.qrScansByAd || []).map(ad => ({ adId: ad.adId?.toString(), adTitle: ad.adTitle, scanCount: ad.scanCount }));
          const newQrScansByAdBefore = (dailyData.qrScansByAd || []).map(ad => ({ adId: ad.adId?.toString(), adTitle: ad.adTitle, scanCount: ad.scanCount }));
          const existingQrScansCountBefore = (existingDaily.qrScans || []).length;
          const newQrScansCountBefore = (dailyData.qrScans || []).length;
          fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:216',message:'BEFORE mergeQrScansByAd - existing daily data found',data:{materialId:device.materialId,dateStr,existingQrScansByAdCount:existingDaily.qrScansByAd?.length||0,existingQrScansByAd:existingQrScansByAdBefore,newQrScansByAdCount:dailyData.qrScansByAd?.length||0,newQrScansByAd:newQrScansByAdBefore,existingQrScansCount:existingQrScansCountBefore,newQrScansCount:newQrScansCountBefore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
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
          
          // #region agent log
          // Log AFTER merge to track if duplicates were created
          const mergedQrScansByAdAfter = (dailyData.qrScansByAd || []).map(ad => ({ adId: ad.adId?.toString(), adTitle: ad.adTitle, scanCount: ad.scanCount }));
          const mergedQrScansCountAfter = (dailyData.qrScans || []).length;
          fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:229',message:'AFTER mergeQrScansByAd - merged data',data:{materialId:device.materialId,dateStr,mergedQrScansByAdCount:dailyData.qrScansByAd?.length||0,mergedQrScansByAd:mergedQrScansByAdAfter,mergedQrScansCount:mergedQrScansCountAfter,totalQRScans:dailyData.totalQRScans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Final cleaning of the daily data before assignment
          dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
          
          // ✅ FIX: Recalculate totals from arrays after merging (similar to QR scans)
          dailyData.totalQRScans = dailyData.qrScans.length;
          // Recalculate totalAdPlays from merged adPlaybacks
          dailyData.totalAdPlays = (dailyData.adPlaybacks || []).filter(pb => pb.userId).length || dailyData.totalAdPlays;
          // Recalculate totalDistanceTraveled from merged locationHistory
          if (dailyData.locationHistory && dailyData.locationHistory.length >= 2) {
            let mergedDistance = 0;
            for (let i = 1; i < dailyData.locationHistory.length; i++) {
              const prevPoint = dailyData.locationHistory[i - 1];
              const currentPoint = dailyData.locationHistory[i];
              if (prevPoint.coordinates && currentPoint.coordinates &&
                  prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
                const distance = GPSValidation.calculateDistance(
                  prevPoint.coordinates[1], prevPoint.coordinates[0],
                  currentPoint.coordinates[1], currentPoint.coordinates[0]
                );
                mergedDistance += distance;
              }
            }
            dailyData.totalDistanceTraveled = Math.round(mergedDistance * 100) / 100;
          }
          
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
            // Handle VersionError (concurrency conflict) - reload and retry
            if (saveError.name === 'VersionError') {
              console.log(`⚠️ VersionError on save for ${device.materialId}, reloading document and retrying...`);
              try {
                // Reload the document to get the latest version
                const freshDocument = await DeviceDataHistoryV2.findOne({
                  materialId: device.materialId
                });
                if (!freshDocument) {
                  throw new Error(`Document ${device.materialId} not found after VersionError`);
                }
                
                // Reapply the changes to the fresh document
                // ✅ FIX: Compare dates using UTC midnight timestamps instead of toDateString()
                const targetDateTimestamp = targetDate.getTime();
                const freshDailyIndex = freshDocument.dailyData.findIndex(d => {
                  if (!d.date) return false;
                  const dDate = new Date(d.date);
                  return dDate.getTime() === targetDateTimestamp;
                });
                
                if (freshDailyIndex >= 0) {
                  const freshDaily = freshDocument.dailyData[freshDailyIndex];
                  const cleanedExistingQrScans = this.cleanQRScanData(freshDaily.qrScans);
                  const cleanedNewQrScans = this.cleanQRScanData(dailyData.qrScans);
                  
                  dailyData.locationHistory = this.mergeLocationHistory(freshDaily.locationHistory, dailyData.locationHistory);
                  dailyData.adPlaybacks = this.mergeAdPlaybacks(freshDaily.adPlaybacks, dailyData.adPlaybacks);
                  dailyData.qrScans = this.mergeQrScans(cleanedExistingQrScans, cleanedNewQrScans);
                  dailyData.hourlyStats = this.mergeHourlyStats(freshDaily.hourlyStats, dailyData.hourlyStats);
                  dailyData.adPerformance = this.mergeAdPerformance(freshDaily.adPerformance, dailyData.adPerformance);
                  dailyData.qrScansByAd = this.mergeQrScansByAd(freshDaily.qrScansByAd, dailyData.qrScansByAd);
                  dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
                  // ✅ FIX: Recalculate totals from arrays after merging
                  dailyData.totalQRScans = dailyData.qrScans.length;
                  dailyData.totalAdPlays = (dailyData.adPlaybacks || []).filter(pb => pb.userId).length || dailyData.totalAdPlays;
                  if (dailyData.locationHistory && dailyData.locationHistory.length >= 2) {
                    let mergedDistance = 0;
                    for (let i = 1; i < dailyData.locationHistory.length; i++) {
                      const prevPoint = dailyData.locationHistory[i - 1];
                      const currentPoint = dailyData.locationHistory[i];
                      if (prevPoint.coordinates && currentPoint.coordinates &&
                          prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
                        const distance = GPSValidation.calculateDistance(
                          prevPoint.coordinates[1], prevPoint.coordinates[0],
                          currentPoint.coordinates[1], currentPoint.coordinates[0]
                        );
                        mergedDistance += distance;
                      }
                    }
                    dailyData.totalDistanceTraveled = Math.round(mergedDistance * 100) / 100;
                  }
                  
                  freshDocument.dailyData[freshDailyIndex] = dailyData;
                  freshDocument.lastArchiveUpdate = new Date();
                  freshDocument.totalUpdates += 1;
                  freshDocument.updateLifetimeTotals();
                  
                  await freshDocument.save();
                  logger.database(`✅ Updated daily data for material ${device.materialId} on ${dateStr} (after VersionError retry)`);
                  return; // Success, exit the function
                }
              } catch (retryError) {
                console.error(`❌ Failed to retry after VersionError for ${device.materialId}:`, retryError.message);
                throw retryError;
              }
            }
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
          
          // ✅ FIX: Recalculate totals from arrays (similar to QR scans)
          dailyData.totalQRScans = dailyData.qrScans.length;
          dailyData.totalAdPlays = (dailyData.adPlaybacks || []).filter(pb => pb.userId).length || dailyData.totalAdPlays;
          if (dailyData.locationHistory && dailyData.locationHistory.length >= 2) {
            let mergedDistance = 0;
            for (let i = 1; i < dailyData.locationHistory.length; i++) {
              const prevPoint = dailyData.locationHistory[i - 1];
              const currentPoint = dailyData.locationHistory[i];
              if (prevPoint.coordinates && currentPoint.coordinates &&
                  prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
                const distance = GPSValidation.calculateDistance(
                  prevPoint.coordinates[1], prevPoint.coordinates[0],
                  currentPoint.coordinates[1], currentPoint.coordinates[0]
                );
                mergedDistance += distance;
              }
            }
            dailyData.totalDistanceTraveled = Math.round(mergedDistance * 100) / 100;
          }
          
          existingDocument.addDailyData(dailyData);
          existingDocument.lastArchiveUpdate = new Date();
          existingDocument.totalUpdates += 1;
          
          try {
            await existingDocument.save();
            console.log(`✅ Added new daily data for material ${device.materialId} on ${dateStr}`);
          } catch (saveError) {
            // Handle VersionError (concurrency conflict) - reload and retry
            if (saveError.name === 'VersionError') {
              console.log(`⚠️ VersionError on save for ${device.materialId}, reloading document and retrying...`);
              try {
                // Reload the document to get the latest version
                const freshDocument = await DeviceDataHistoryV2.findOne({
                  materialId: device.materialId
                });
                if (!freshDocument) {
                  throw new Error(`Document ${device.materialId} not found after VersionError`);
                }
                
                // Check if daily data for this date already exists (might have been added by another process)
                // ✅ FIX: Compare dates using UTC midnight timestamps instead of toDateString()
                const targetDateTimestamp = targetDate.getTime();
                const freshDailyIndex = freshDocument.dailyData.findIndex(d => {
                  if (!d.date) return false;
                  const dDate = new Date(d.date);
                  return dDate.getTime() === targetDateTimestamp;
                });
                
                if (freshDailyIndex >= 0) {
                  // Date already exists, update instead
                  const freshDaily = freshDocument.dailyData[freshDailyIndex];
                  const cleanedExistingQrScans = this.cleanQRScanData(freshDaily.qrScans);
                  const cleanedNewQrScans = this.cleanQRScanData(dailyData.qrScans);
                  
                  dailyData.locationHistory = this.mergeLocationHistory(freshDaily.locationHistory, dailyData.locationHistory);
                  dailyData.adPlaybacks = this.mergeAdPlaybacks(freshDaily.adPlaybacks, dailyData.adPlaybacks);
                  dailyData.qrScans = this.mergeQrScans(cleanedExistingQrScans, cleanedNewQrScans);
                  dailyData.hourlyStats = this.mergeHourlyStats(freshDaily.hourlyStats, dailyData.hourlyStats);
                  dailyData.adPerformance = this.mergeAdPerformance(freshDaily.adPerformance, dailyData.adPerformance);
                  dailyData.qrScansByAd = this.mergeQrScansByAd(freshDaily.qrScansByAd, dailyData.qrScansByAd);
                  dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
                  dailyData.totalQRScans = dailyData.qrScans.length;
                  
                  freshDocument.dailyData[freshDailyIndex] = dailyData;
                } else {
                  // Add new daily data
                  dailyData.qrScans = this.cleanQRScanData(dailyData.qrScans);
                  // ✅ FIX: Recalculate totals from arrays
                  dailyData.totalQRScans = dailyData.qrScans.length;
                  dailyData.totalAdPlays = (dailyData.adPlaybacks || []).filter(pb => pb.userId).length || dailyData.totalAdPlays;
                  if (dailyData.locationHistory && dailyData.locationHistory.length >= 2) {
                    let mergedDistance = 0;
                    for (let i = 1; i < dailyData.locationHistory.length; i++) {
                      const prevPoint = dailyData.locationHistory[i - 1];
                      const currentPoint = dailyData.locationHistory[i];
                      if (prevPoint.coordinates && currentPoint.coordinates &&
                          prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
                        const distance = GPSValidation.calculateDistance(
                          prevPoint.coordinates[1], prevPoint.coordinates[0],
                          currentPoint.coordinates[1], currentPoint.coordinates[0]
                        );
                        mergedDistance += distance;
                      }
                    }
                    dailyData.totalDistanceTraveled = Math.round(mergedDistance * 100) / 100;
                  }
                  freshDocument.addDailyData(dailyData);
                }
                
                freshDocument.lastArchiveUpdate = new Date();
                freshDocument.totalUpdates += 1;
                freshDocument.updateLifetimeTotals();
                
                await freshDocument.save();
                console.log(`✅ Added/Updated daily data for material ${device.materialId} on ${dateStr} (after VersionError retry)`);
                return; // Success, exit the function
              } catch (retryError) {
                console.error(`❌ Failed to retry after VersionError for ${device.materialId}:`, retryError.message);
                throw retryError;
              }
            }
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
        
        // ✅ FIX: Recalculate totals from arrays (similar to QR scans)
        dailyData.totalQRScans = dailyData.qrScans.length;
        dailyData.totalAdPlays = (dailyData.adPlaybacks || []).filter(pb => pb.userId).length || dailyData.totalAdPlays;
        if (dailyData.locationHistory && dailyData.locationHistory.length >= 2) {
          let mergedDistance = 0;
          for (let i = 1; i < dailyData.locationHistory.length; i++) {
            const prevPoint = dailyData.locationHistory[i - 1];
            const currentPoint = dailyData.locationHistory[i];
            if (prevPoint.coordinates && currentPoint.coordinates &&
                prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
              const distance = GPSValidation.calculateDistance(
                prevPoint.coordinates[1], prevPoint.coordinates[0],
                currentPoint.coordinates[1], currentPoint.coordinates[0]
              );
              mergedDistance += distance;
            }
          }
          dailyData.totalDistanceTraveled = Math.round(mergedDistance * 100) / 100;
        }
        
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

  // ✅ FIX: Calculate totalAdPlays from adPlaybacks array (similar to QR scans)
  calculateTotalAdPlays(device) {
    // Filter adPlaybacks by userId (only count valid playbacks)
    const validAdPlaybacks = (device.adPlaybacks || []).filter(pb => pb.userId);
    return validAdPlaybacks.length;
  }

  // ✅ FIX: Calculate totalDistanceTraveled from locationHistory array
  calculateTotalDistanceTraveled(device) {
    const locationHistory = (device.locationHistory || [])
      .filter(loc => loc && loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2);
    
    if (locationHistory.length < 2) {
      // Need at least 2 points to calculate distance
      return device.totalDistanceTraveled || 0; // Fallback to counter if available
    }
    
    let totalDistance = 0;
    for (let i = 1; i < locationHistory.length; i++) {
      const prevPoint = locationHistory[i - 1];
      const currentPoint = locationHistory[i];
      
      if (prevPoint.coordinates && currentPoint.coordinates &&
          prevPoint.coordinates.length >= 2 && currentPoint.coordinates.length >= 2) {
        // Calculate distance using GPSValidation (coordinates are [lng, lat] in GeoJSON format)
        const distance = GPSValidation.calculateDistance(
          prevPoint.coordinates[1], // lat
          prevPoint.coordinates[0], // lng
          currentPoint.coordinates[1], // lat
          currentPoint.coordinates[0]  // lng
        );
        totalDistance += distance;
      }
    }
    
    // Round to 2 decimal places
    return Math.round(totalDistance * 100) / 100;
  }

  // Helper methods (same as original)
  getFinalHoursOnline(device, deviceTimezone) {
    if (device.hoursTracking && device.hoursTracking.totalOnlineHours !== undefined) {
      return device.hoursTracking.totalOnlineHours;
    }
    return device.totalHoursOnline || 0;
  }

  prepareHoursTracking(device, deviceTimezone) {
    // ✅ Calculate final hours for compliance determination
    const finalHours = this.getFinalHoursOnline(device, deviceTimezone);
    const targetHours = device.hoursTracking?.targetHours || device.currentSession?.targetHours || 8;
    
    // ✅ Determine compliance status based on final hours
    // If session is not active (ended), determine final status
    // If session is still active, keep as PENDING (for today's data)
    let complianceStatus = 'PENDING';
    const isSessionActive = device.currentSession?.isActive !== false;
    const isToday = this.isToday(device.date || new Date(), deviceTimezone);
    
    if (!isToday || !isSessionActive) {
      // For past days or ended sessions, determine final compliance status
      complianceStatus = finalHours >= targetHours ? 'COMPLIANT' : 'NON_COMPLIANT';
    } else if (finalHours >= targetHours) {
      // For today's active session, if already reached 8 hours, mark as COMPLIANT
      complianceStatus = 'COMPLIANT';
    } else {
      // For today's active session, if not yet 8 hours, keep as PENDING
      complianceStatus = 'PENDING';
    }
    
    return {
      deviceTimezone: deviceTimezone,
      sessionStartTime: device.hoursTracking?.sessionStartTime || device.currentSession?.startTime,
      sessionEndTime: device.hoursTracking?.sessionEndTime || device.currentSession?.endTime,
      lastOnlineUpdate: device.hoursTracking?.lastOnlineUpdate || device.currentSession?.lastOnlineUpdate,
      offlinePeriods: device.hoursTracking?.offlinePeriods || [],
      complianceStatus: complianceStatus,
      targetHours: targetHours,
      precision: device.hoursTracking?.precision || '30s',
      totalOnlineHours: finalHours
    };
  }
  
  // ✅ Helper method to check if a date is today
  isToday(date, deviceTimezone) {
    const now = new Date();
    const todayInTz = new Date(now.toLocaleString("en-US", {timeZone: deviceTimezone}));
    const dateInTz = new Date(date.toLocaleString("en-US", {timeZone: deviceTimezone}));
    
    return todayInTz.getFullYear() === dateInTz.getFullYear() &&
           todayInTz.getMonth() === dateInTz.getMonth() &&
           todayInTz.getDate() === dateInTz.getDate();
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
    
    // #region agent log
    // Log BEFORE merge to track duplicates
    const existingCount = existing.length;
    const newCount = newData.length;
    fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:795',message:'BEFORE mergeQrScans',data:{existingCount,newCount,existingKeysSize:existingKeys.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // Clean the new data before processing
    const cleanedNewData = this.cleanQRScanData(newData);
    
    cleanedNewData.forEach(newItem => {
      const key = `${newItem.adId}-${newItem.scanTimestamp?.getTime()}`;
      if (!existingKeys.has(key)) {
        merged.push(newItem);
        existingKeys.add(key); // Track added keys
      }
    });
    
    // #region agent log
    // Log AFTER merge to track if duplicates were added
    const mergedCount = merged.length;
    fetch('http://127.0.0.1:7242/ingest/cc36b36e-7fcf-4c8c-871a-9ca9767a6ccd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dailyArchiveJobV2.js:812',message:'AFTER mergeQrScans',data:{existingCount,newCount,mergedCount,expectedCount:existingCount+cleanedNewData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
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
    
    // ✅ MEMORY OPTIMIZATION: Keep only the last 3600 entries (2 hours at 2s intervals, was 8 hours)
    return merged.slice(-3600);
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

  // ✅ NEW: Validate archive completeness
  async validateArchive(dateStr) {
    console.log(`🔍 Validating archive for ${dateStr}...`);
    
    // ✅ FIX: Parse dateStr as UTC midnight to match database format
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    
    // Get all registered materials
    const Material = require('../models/Material');
    const registeredMaterials = await Material.find({ status: 'ACTIVE' });
    
    // Check which materials have archived data
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    const archivedMaterials = await DeviceDataHistoryV2.find({
      'dailyData.date': targetDate
    }).select('materialId');
    
    const archivedMaterialIds = new Set(archivedMaterials.map(m => m.materialId));
    const missingArchives = [];
    
    for (const material of registeredMaterials) {
      if (!archivedMaterialIds.has(material.materialId)) {
        // Check if device was online that day
        const deviceTracking = await DeviceTracking.findOne({
          materialId: material.materialId,
          date: targetDate
        });
        
        if (deviceTracking && deviceTracking.totalHoursOnline > 0) {
          missingArchives.push({
            materialId: material.materialId,
            hoursOnline: deviceTracking.totalHoursOnline,
            reason: 'Device was online but not archived'
          });
        }
      }
    }
    
    if (missingArchives.length > 0) {
      console.error(`❌ Archive validation FAILED: ${missingArchives.length} materials missing`);
      console.error(JSON.stringify(missingArchives, null, 2));
      
      // Auto-recover missed archives
      await this.recoverMissedArchives(missingArchives, dateStr);
    } else {
      console.log(`✅ Archive validation PASSED: All active materials archived`);
    }
    
    return {
      totalMaterials: registeredMaterials.length,
      archivedMaterials: archivedMaterials.length,
      missingArchives: missingArchives.length,
      details: missingArchives
    };
  }

  // ✅ NEW: Recover missed archives
  async recoverMissedArchives(missingArchives, dateStr) {
    console.log(`🔄 Recovering ${missingArchives.length} missed archives...`);
    
    for (const missing of missingArchives) {
      try {
        // ✅ FIX: Parse dateStr as UTC midnight to match database format
        const [year, month, day] = dateStr.split('-').map(Number);
        const targetUTCDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        
        const device = await DeviceTracking.findOne({
          materialId: missing.materialId,
          date: targetUTCDate
        });
        
        if (device) {
          await this.archiveMaterialDataV2(device, dateStr);
          console.log(`✅ Recovered archive for ${missing.materialId}`);
        }
      } catch (error) {
        console.error(`❌ Failed to recover ${missing.materialId}:`, error);
      }
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
