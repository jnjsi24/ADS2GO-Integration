const mongoose = require('mongoose');
require('dotenv').config();

const DeviceTracking = require('./src/models/deviceTracking');
const DeviceDataHistoryV2 = require('./src/models/deviceDataHistoryV2');
const dailyArchiveJobV2V2 = require('./src/jobs/dailyArchiveJobV2V2');

async function archiveExistingData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Find the existing record
    const existingRecord = await DeviceTracking.findOne({});
    if (!existingRecord) {
      console.log('❌ No DeviceTracking records found');
      return;
    }
    
    console.log('📋 Found existing record:', {
      _id: existingRecord._id,
      date: existingRecord.date,
      materialId: existingRecord.materialId,
      deviceId: existingRecord.deviceId,
      isOnline: existingRecord.isOnline,
      totalAdPlays: existingRecord.totalAdPlays,
      totalHoursOnline: existingRecord.totalHoursOnline
    });
    
    // Archive this specific record manually
    console.log('🔄 Archiving existing record...');
    await dailyArchiveJobV2.archiveDeviceData(existingRecord, existingRecord.date.toISOString().split('T')[0]);
    
    // Check if it was created
    const archivedRecord = await DeviceDataHistory.findOne({ materialId: existingRecord.materialId });
    if (archivedRecord) {
      console.log('✅ Successfully archived! New DeviceDataHistory record:', {
        _id: archivedRecord._id,
        deviceId: archivedRecord.deviceId,
        materialId: archivedRecord.materialId,
        date: archivedRecord.date,
        totalAdPlays: archivedRecord.totalAdPlays,
        totalHoursOnline: archivedRecord.totalHoursOnline,
        archivedAt: archivedRecord.archivedAt
      });
    } else {
      console.log('❌ Archive failed - no DeviceDataHistory record created');
    }
    
  } catch (error) {
    console.error('❌ Archive failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

archiveExistingData();
