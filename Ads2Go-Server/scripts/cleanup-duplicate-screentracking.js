const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://ads2go:ads2go123@ads2go.8qjqj.mongodb.net/ads2go?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function cleanupDuplicateScreenTracking() {
  try {
    console.log('🔍 Starting cleanup of duplicate ScreenTracking records...');
    
    // Find all ScreenTracking records
    const allRecords = await ScreenTracking.find({});
    console.log(`📊 Found ${allRecords.length} total ScreenTracking records`);
    
    // Group by materialId and slotNumber
    const groupedRecords = {};
    const duplicates = [];
    
    allRecords.forEach(record => {
      const key = `${record.materialId}-${record.slotNumber}`;
      
      if (!groupedRecords[key]) {
        groupedRecords[key] = [];
      }
      
      groupedRecords[key].push(record);
    });
    
    // Find duplicates
    Object.keys(groupedRecords).forEach(key => {
      const records = groupedRecords[key];
      if (records.length > 1) {
        console.log(`\n🔍 Found ${records.length} records for ${key}:`);
        records.forEach(record => {
          console.log(`  - DeviceId: ${record.deviceId}, Created: ${record.createdAt}, Online: ${record.isOnline}`);
        });
        duplicates.push(...records);
      }
    });
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate records found!');
      return;
    }
    
    console.log(`\n🗑️  Found ${duplicates.length} duplicate records to clean up`);
    
    // For each group of duplicates, keep the one with the actual deviceId (not TEMP-)
    // and delete the others
    const recordsToDelete = [];
    
    Object.keys(groupedRecords).forEach(key => {
      const records = groupedRecords[key];
      if (records.length > 1) {
        // Sort records: actual deviceIds first, then TEMP- deviceIds
        records.sort((a, b) => {
          const aIsTemp = a.deviceId.startsWith('TEMP-');
          const bIsTemp = b.deviceId.startsWith('TEMP-');
          
          if (aIsTemp && !bIsTemp) return 1;
          if (!aIsTemp && bIsTemp) return -1;
          
          // If both are temp or both are actual, keep the newer one
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // Keep the first record (best one), delete the rest
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);
        
        console.log(`\n📌 Keeping record: ${keepRecord.deviceId} (${keepRecord.createdAt})`);
        deleteRecords.forEach(record => {
          console.log(`🗑️  Deleting record: ${record.deviceId} (${record.createdAt})`);
          recordsToDelete.push(record._id);
        });
      }
    });
    
    if (recordsToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${recordsToDelete.length} duplicate records...`);
      const result = await ScreenTracking.deleteMany({ _id: { $in: recordsToDelete } });
      console.log(`✅ Deleted ${result.deletedCount} duplicate records`);
    }
    
    // Final count
    const finalCount = await ScreenTracking.countDocuments();
    console.log(`\n📊 Final count: ${finalCount} ScreenTracking records`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the cleanup
cleanupDuplicateScreenTracking();
