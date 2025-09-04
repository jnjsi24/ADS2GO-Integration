const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function migrateToSharedTracking() {
  try {
    console.log('🔄 Starting migration to SHARED TRACKING...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      return;
    }
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Find all ScreenTracking records
    const allRecords = await ScreenTracking.find({});
    console.log(`📊 Found ${allRecords.length} total ScreenTracking records`);
    
    if (allRecords.length === 0) {
      console.log('✅ No records to migrate');
      return;
    }
    
    // Group by materialId
    const groupedByMaterial = {};
    allRecords.forEach(record => {
      if (!groupedByMaterial[record.materialId]) {
        groupedByMaterial[record.materialId] = [];
      }
      groupedByMaterial[record.materialId].push(record);
    });
    
    console.log(`📊 Found ${Object.keys(groupedByMaterial).length} unique materialIds`);
    
    // Process each materialId group
    for (const [materialId, records] of Object.entries(groupedByMaterial)) {
      console.log(`\n🔄 Processing materialId: ${materialId} (${records.length} records)`);
      
      if (records.length === 1) {
        console.log(`  ✅ Only one record - no migration needed`);
        continue;
      }
      
      // Find the best record to keep (most recent, with real deviceId, online)
      const bestRecord = records.reduce((best, current) => {
        // Prefer records with real deviceIds (not TEMP-)
        const currentIsReal = current.deviceId && !current.deviceId.startsWith('TEMP-');
        const bestIsReal = best.deviceId && !best.deviceId.startsWith('TEMP-');
        
        if (currentIsReal && !bestIsReal) return current;
        if (!currentIsReal && bestIsReal) return best;
        
        // If both are real or both are temp, prefer online
        if (current.isOnline && !best.isOnline) return current;
        if (!current.isOnline && best.isOnline) return best;
        
        // If both have same online status, prefer most recent
        return new Date(current.updatedAt) > new Date(best.updatedAt) ? current : best;
      });
      
      console.log(`  📌 Keeping record: ${bestRecord.deviceId} (Online: ${bestRecord.isOnline}, Updated: ${bestRecord.updatedAt})`);
      
      // Merge data from other records into the best record
      const otherRecords = records.filter(r => r._id.toString() !== bestRecord._id.toString());
      
      for (const otherRecord of otherRecords) {
        console.log(`  🔄 Merging data from: ${otherRecord.deviceId}`);
        
        // Merge totalHoursOnline
        bestRecord.totalHoursOnline += otherRecord.totalHoursOnline || 0;
        
        // Merge totalDistanceTraveled
        bestRecord.totalDistanceTraveled += otherRecord.totalDistanceTraveled || 0;
        
        // Merge dailySessions
        if (otherRecord.dailySessions && otherRecord.dailySessions.length > 0) {
          bestRecord.dailySessions = bestRecord.dailySessions.concat(otherRecord.dailySessions);
        }
        
        // Merge locationHistory from currentSession
        if (otherRecord.currentSession && otherRecord.currentSession.locationHistory) {
          if (!bestRecord.currentSession) {
            bestRecord.currentSession = otherRecord.currentSession;
          } else {
            bestRecord.currentSession.locationHistory = bestRecord.currentSession.locationHistory.concat(
              otherRecord.currentSession.locationHistory
            );
          }
        }
        
        // Merge alerts
        if (otherRecord.alerts && otherRecord.alerts.length > 0) {
          bestRecord.alerts = bestRecord.alerts.concat(otherRecord.alerts);
        }
        
        // Merge screenMetrics
        if (otherRecord.screenMetrics) {
          if (!bestRecord.screenMetrics) {
            bestRecord.screenMetrics = otherRecord.screenMetrics;
          } else {
            // Merge ad performance data
            if (otherRecord.screenMetrics.adPerformance) {
              bestRecord.screenMetrics.adPerformance = bestRecord.screenMetrics.adPerformance.concat(
                otherRecord.screenMetrics.adPerformance
              );
            }
            
            // Merge total ad counts
            bestRecord.screenMetrics.adPlayCount += otherRecord.screenMetrics.adPlayCount || 0;
            bestRecord.screenMetrics.displayHours += otherRecord.screenMetrics.displayHours || 0;
          }
        }
      }
      
      // Save the merged record
      await bestRecord.save();
      console.log(`  ✅ Merged record saved`);
      
      // Delete the other records
      const idsToDelete = otherRecords.map(r => r._id);
      const deleteResult = await ScreenTracking.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`  🗑️  Deleted ${deleteResult.deletedCount} duplicate records`);
    }
    
    // Final verification
    const finalCount = await ScreenTracking.countDocuments();
    const finalRecords = await ScreenTracking.find({});
    
    console.log(`\n📊 Migration completed!`);
    console.log(`  - Final record count: ${finalCount}`);
    console.log(`  - Records by materialId:`);
    
    for (const record of finalRecords) {
      console.log(`    - ${record.materialId}: ${record.deviceId} (Online: ${record.isOnline})`);
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
migrateToSharedTracking();
