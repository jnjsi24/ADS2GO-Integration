const mongoose = require('mongoose');
const DeviceDataHistory = require('../src/models/deviceDataHistory');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function addTrackingFields() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    // Find all records that don't have the new tracking fields
    const recordsToUpdate = await DeviceDataHistory.find({
      $or: [
        { lastDataUpdate: { $exists: false } },
        { lastArchiveUpdate: { $exists: false } },
        { updateCount: { $exists: false } },
        { lastUpdateSource: { $exists: false } },
        { lastUpdateType: { $exists: false } }
      ]
    });
    
    console.log(`📊 Found ${recordsToUpdate.length} records to update with tracking fields`);
    
    if (recordsToUpdate.length === 0) {
      console.log('✅ All records already have tracking fields');
      return;
    }
    
    // Update each record
    for (const record of recordsToUpdate) {
      const updateData = {
        lastDataUpdate: record.archivedAt || record.updatedAt || record.createdAt,
        lastArchiveUpdate: record.archivedAt || record.updatedAt || record.createdAt,
        updateCount: 1,
        lastUpdateSource: 'migration',
        lastUpdateType: 'create'
      };
      
      await DeviceDataHistory.findByIdAndUpdate(record._id, {
        $set: updateData
      });
      
      console.log(`✅ Updated record ${record._id} with tracking fields`);
    }
    
    console.log(`\n🎉 Successfully updated ${recordsToUpdate.length} records with tracking fields!`);
    
    // Show some examples
    const sampleRecords = await DeviceDataHistory.find({
      lastDataUpdate: { $exists: true }
    }).limit(3).sort({ lastDataUpdate: -1 });
    
    console.log('\n📋 Sample records with tracking fields:');
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. Material: ${record.materialId || record.deviceId}`);
      console.log(`   Last Data Update: ${record.lastDataUpdate}`);
      console.log(`   Last Archive Update: ${record.lastArchiveUpdate}`);
      console.log(`   Update Count: ${record.updateCount}`);
      console.log(`   Last Update Source: ${record.lastUpdateSource}`);
      console.log(`   Last Update Type: ${record.lastUpdateType}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error adding tracking fields:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

addTrackingFields();
