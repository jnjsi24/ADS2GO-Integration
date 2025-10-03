const mongoose = require('mongoose');
const DeviceDataHistory = require('../src/models/deviceDataHistory');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

// Helper functions for merging data (copied from dailyArchiveJob.js)
function mergeAdPlaybacks(existing, newData) {
  const merged = [...existing];
  const existingKeys = new Set(existing.map(item => `${item.adId}-${item.startTime?.getTime()}`));
  
  newData.forEach(newItem => {
    const key = `${newItem.adId}-${newItem.startTime?.getTime()}`;
    if (!existingKeys.has(key)) {
      merged.push(newItem);
    }
  });
  
  // Keep only the last 800 entries to prevent unlimited growth (8 hours × 160 plays × 5 ads)
  return merged.slice(-800);
}

function mergeQrScans(existing, newData) {
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

function mergeLocationHistory(existing, newData) {
  const merged = [...existing];
  const existingKeys = new Set(existing.map(item => item.timestamp?.getTime()));
  
  newData.forEach(newItem => {
    const key = newItem.timestamp?.getTime();
    if (key && !existingKeys.has(key)) {
      merged.push(newItem);
    }
  });
  
    // Keep only the last 960 entries (8 hours at 30s intervals)
    return merged.slice(-960);
}

function mergeHourlyStats(existing, newData) {
  const merged = [...existing];
  
  newData.forEach(newStat => {
    const existingIndex = merged.findIndex(stat => stat.hour === newStat.hour);
    if (existingIndex >= 0) {
      // Update existing hour with latest data
      merged[existingIndex] = newStat;
    } else {
      // Add new hour
      merged.push(newStat);
    }
  });
  
  return merged.sort((a, b) => a.hour - b.hour);
}

function mergeAdPerformance(existing, newData) {
  const merged = [...existing];
  
  newData.forEach(newPerf => {
    const existingIndex = merged.findIndex(perf => perf.adId === newPerf.adId);
    if (existingIndex >= 0) {
      // Update existing ad performance with latest data
      merged[existingIndex] = newPerf;
    } else {
      // Add new ad performance
      merged.push(newPerf);
    }
  });
  
  return merged;
}

function mergeQrScansByAd(existing, newData) {
  const merged = [...existing];
  
  newData.forEach(newQrScan => {
    const existingIndex = merged.findIndex(qrScan => qrScan.adId === newQrScan.adId);
    if (existingIndex >= 0) {
      // Update existing QR scan data with latest data
      merged[existingIndex] = newQrScan;
    } else {
      // Add new QR scan data
      merged.push(newQrScan);
    }
  });
  
  return merged;
}

async function mergeDuplicateArchives() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    // Find all duplicate records grouped by materialId and date
    const duplicates = await DeviceDataHistory.aggregate([
      {
        $match: {
          materialId: { $exists: true, $ne: null },
          date: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            materialId: '$materialId',
            date: '$date'
          },
          records: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { '_id.date': -1, '_id.materialId': 1 }
      }
    ]);

    console.log(`📊 Found ${duplicates.length} groups with duplicate records`);

    for (const group of duplicates) {
      const { materialId, date } = group._id;
      const records = group.records;
      
      console.log(`\n🔄 Processing material ${materialId} for date ${date.toISOString().split('T')[0]} (${records.length} duplicates)`);
      
      // Sort records by archivedAt to get the latest one as the base
      records.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
      
      const baseRecord = records[0]; // Use the latest record as base
      const recordsToMerge = records.slice(1); // All other records to merge
      
      console.log(`📝 Using record ${baseRecord._id} as base (archived at ${baseRecord.archivedAt})`);
      
      // Merge all the other records into the base record
      let mergedRecord = { ...baseRecord };
      
      for (const record of recordsToMerge) {
        console.log(`  🔗 Merging record ${record._id} (archived at ${record.archivedAt})`);
        
        // Merge arrays
        mergedRecord.adPlaybacks = mergeAdPlaybacks(mergedRecord.adPlaybacks || [], record.adPlaybacks || []);
        mergedRecord.qrScans = mergeQrScans(mergedRecord.qrScans || [], record.qrScans || []);
        mergedRecord.locationHistory = mergeLocationHistory(mergedRecord.locationHistory || [], record.locationHistory || []);
        mergedRecord.hourlyStats = mergeHourlyStats(mergedRecord.hourlyStats || [], record.hourlyStats || []);
        mergedRecord.adPerformance = mergeAdPerformance(mergedRecord.adPerformance || [], record.adPerformance || []);
        mergedRecord.qrScansByAd = mergeQrScansByAd(mergedRecord.qrScansByAd || [], record.qrScansByAd || []);
        
        // Use the latest values for totals and status
        if (new Date(record.archivedAt) > new Date(mergedRecord.archivedAt)) {
          mergedRecord.totalAdPlays = record.totalAdPlays;
          mergedRecord.totalQRScans = record.totalQRScans;
          mergedRecord.totalDistanceTraveled = record.totalDistanceTraveled;
          mergedRecord.totalHoursOnline = record.totalHoursOnline;
          mergedRecord.hoursTracking = record.hoursTracking;
          mergedRecord.dailySummary = record.dailySummary;
          mergedRecord.networkStatus = record.networkStatus;
          mergedRecord.complianceData = record.complianceData;
          mergedRecord.isDisplaying = record.isDisplaying;
          mergedRecord.maintenanceMode = record.maintenanceMode;
          mergedRecord.archivedAt = record.archivedAt;
        }
      }
      
      // Update the base record with merged data
      await DeviceDataHistory.findByIdAndUpdate(baseRecord._id, {
        $set: {
          adPlaybacks: mergedRecord.adPlaybacks,
          qrScans: mergedRecord.qrScans,
          locationHistory: mergedRecord.locationHistory,
          hourlyStats: mergedRecord.hourlyStats,
          adPerformance: mergedRecord.adPerformance,
          qrScansByAd: mergedRecord.qrScansByAd,
          totalAdPlays: mergedRecord.totalAdPlays,
          totalQRScans: mergedRecord.totalQRScans,
          totalDistanceTraveled: mergedRecord.totalDistanceTraveled,
          totalHoursOnline: mergedRecord.totalHoursOnline,
          hoursTracking: mergedRecord.hoursTracking,
          dailySummary: mergedRecord.dailySummary,
          networkStatus: mergedRecord.networkStatus,
          complianceData: mergedRecord.complianceData,
          isDisplaying: mergedRecord.isDisplaying,
          maintenanceMode: mergedRecord.maintenanceMode,
          archivedAt: mergedRecord.archivedAt,
          updatedAt: new Date()
        }
      });
      
      // Delete the duplicate records
      const duplicateIds = recordsToMerge.map(r => r._id);
      const deleteResult = await DeviceDataHistory.deleteMany({
        _id: { $in: duplicateIds }
      });
      
      console.log(`✅ Merged ${records.length} records into 1, deleted ${deleteResult.deletedCount} duplicates`);
    }
    
    console.log('\n🎉 Merge operation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error merging duplicate archives:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the merge operation
if (require.main === module) {
  mergeDuplicateArchives();
}

module.exports = { mergeDuplicateArchives };
