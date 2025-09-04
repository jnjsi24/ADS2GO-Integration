const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function testTabletReplacement() {
  try {
    console.log('🔍 Testing tablet replacement flow...');
    
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
    
    // Find a ScreenTracking record with an actual deviceId
    const activeRecord = await ScreenTracking.findOne({ 
      deviceId: { $exists: true, $ne: null, $not: /^TEMP-/ } 
    });
    
    if (!activeRecord) {
      console.log('❌ No active ScreenTracking records found to test with');
      return;
    }
    
    console.log(`\n📱 Found active record:`);
    console.log(`  - DeviceId: ${activeRecord.deviceId}`);
    console.log(`  - MaterialId: ${activeRecord.materialId}`);
    console.log(`  - SlotNumber: ${activeRecord.slotNumber}`);
    console.log(`  - IsOnline: ${activeRecord.isOnline}`);
    console.log(`  - TotalHoursOnline: ${activeRecord.totalHoursOnline}`);
    console.log(`  - TotalDistanceTraveled: ${activeRecord.totalDistanceTraveled}`);
    
    // Simulate unregistration: set deviceId to null
    console.log(`\n🔄 Simulating tablet unregistration...`);
    const oldDeviceId = activeRecord.deviceId;
    activeRecord.deviceId = null;
    activeRecord.isOnline = false;
    activeRecord.lastSeen = new Date();
    await activeRecord.save();
    
    console.log(`✅ Unregistered tablet: ${oldDeviceId}`);
    console.log(`  - DeviceId set to: ${activeRecord.deviceId}`);
    console.log(`  - IsOnline: ${activeRecord.isOnline}`);
    
    // Simulate new tablet registration
    console.log(`\n🔄 Simulating new tablet registration...`);
    const newDeviceId = `TABLET-NEW-${Date.now()}`;
    
    // Look for unregistered record by materialId and slotNumber
    const unregisteredRecord = await ScreenTracking.findByMaterialAndSlot(
      activeRecord.materialId, 
      activeRecord.slotNumber
    );
    
    if (unregisteredRecord && unregisteredRecord.deviceId === null) {
      console.log(`✅ Found unregistered record, updating with new deviceId: ${newDeviceId}`);
      unregisteredRecord.deviceId = newDeviceId;
      unregisteredRecord.isOnline = true;
      unregisteredRecord.lastSeen = new Date();
      await unregisteredRecord.save();
      
      console.log(`✅ New tablet registered successfully!`);
      console.log(`  - New DeviceId: ${unregisteredRecord.deviceId}`);
      console.log(`  - IsOnline: ${unregisteredRecord.isOnline}`);
      console.log(`  - Preserved TotalHoursOnline: ${unregisteredRecord.totalHoursOnline}`);
      console.log(`  - Preserved TotalDistanceTraveled: ${unregisteredRecord.totalDistanceTraveled}`);
      console.log(`  - Same Record ID: ${unregisteredRecord._id}`);
    } else {
      console.log(`❌ Could not find unregistered record for materialId: ${activeRecord.materialId}, slotNumber: ${activeRecord.slotNumber}`);
    }
    
    // Verify no duplicate records were created
    const allRecords = await ScreenTracking.find({ 
      materialId: activeRecord.materialId, 
      slotNumber: activeRecord.slotNumber 
    });
    
    console.log(`\n📊 Verification:`);
    console.log(`  - Total records for this materialId/slotNumber: ${allRecords.length}`);
    if (allRecords.length === 1) {
      console.log(`  ✅ SUCCESS: Only one record exists (no duplicates created)`);
    } else {
      console.log(`  ❌ FAILURE: Multiple records found (duplicates created)`);
      allRecords.forEach((record, index) => {
        console.log(`    Record ${index + 1}: DeviceId=${record.deviceId}, Created=${record.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTabletReplacement();
