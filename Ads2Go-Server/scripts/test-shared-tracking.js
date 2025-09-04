const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function testSharedTracking() {
  try {
    console.log('🧪 Testing SHARED TRACKING system...');
    
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
    
    const testMaterialId = 'TEST-MATERIAL-001';
    const testCarGroupId = 'TEST-GROUP-001';
    
    // Test 1: Register Slot 1
    console.log('\n🔄 Test 1: Registering Slot 1...');
    const slot1DeviceId = 'TABLET-SLOT1-TEST-001';
    
    let record1 = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (!record1) {
      record1 = new ScreenTracking({
        deviceId: slot1DeviceId,
        materialId: testMaterialId,
        carGroupId: testCarGroupId,
        slotNumber: 1,
        isOnline: true,
        lastSeen: new Date(),
        totalHoursOnline: 2.5,
        totalDistanceTraveled: 1000
      });
      await record1.save();
      console.log(`✅ Created shared record for Slot 1: ${slot1DeviceId}`);
    } else {
      console.log(`✅ Found existing shared record for Slot 1: ${record1.deviceId}`);
    }
    
    // Test 2: Register Slot 2 (should update the same record)
    console.log('\n🔄 Test 2: Registering Slot 2...');
    const slot2DeviceId = 'TABLET-SLOT2-TEST-002';
    
    let record2 = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (record2) {
      console.log(`✅ Found existing shared record: ${record2.deviceId}`);
      record2.deviceId = slot2DeviceId; // Switch to Slot 2 device
      record2.slotNumber = 2;
      record2.isOnline = true;
      record2.lastSeen = new Date();
      record2.totalHoursOnline += 1.5; // Add more hours
      record2.totalDistanceTraveled += 500; // Add more distance
      await record2.save();
      console.log(`✅ Updated shared record for Slot 2: ${slot2DeviceId}`);
    } else {
      console.log(`❌ No existing record found for Slot 2`);
    }
    
    // Test 3: Verify only one record exists
    console.log('\n🔄 Test 3: Verifying shared tracking...');
    const allRecords = await ScreenTracking.find({ materialId: testMaterialId });
    console.log(`📊 Records found for materialId ${testMaterialId}: ${allRecords.length}`);
    
    if (allRecords.length === 1) {
      console.log(`✅ SUCCESS: Only one shared record exists!`);
      const record = allRecords[0];
      console.log(`  - DeviceId: ${record.deviceId}`);
      console.log(`  - SlotNumber: ${record.slotNumber}`);
      console.log(`  - IsOnline: ${record.isOnline}`);
      console.log(`  - TotalHoursOnline: ${record.totalHoursOnline}`);
      console.log(`  - TotalDistanceTraveled: ${record.totalDistanceTraveled}`);
    } else {
      console.log(`❌ FAILURE: Multiple records found (${allRecords.length})`);
      allRecords.forEach((record, index) => {
        console.log(`  Record ${index + 1}: ${record.deviceId} (Slot ${record.slotNumber})`);
      });
    }
    
    // Test 4: Test unregistration
    console.log('\n🔄 Test 4: Testing unregistration...');
    const recordToUnregister = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (recordToUnregister) {
      recordToUnregister.isOnline = false;
      recordToUnregister.lastSeen = new Date();
      await recordToUnregister.save();
      console.log(`✅ Unregistered device: ${recordToUnregister.deviceId}`);
    }
    
    // Test 5: Register new device (should reuse same record)
    console.log('\n🔄 Test 5: Registering new device (should reuse record)...');
    const newDeviceId = 'TABLET-NEW-TEST-003';
    
    let newRecord = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (newRecord) {
      console.log(`✅ Found existing record to reuse: ${newRecord.deviceId}`);
      newRecord.deviceId = newDeviceId;
      newRecord.slotNumber = 1;
      newRecord.isOnline = true;
      newRecord.lastSeen = new Date();
      await newRecord.save();
      console.log(`✅ Reused record for new device: ${newDeviceId}`);
    } else {
      console.log(`❌ No existing record found to reuse`);
    }
    
    // Final verification
    console.log('\n📊 Final verification:');
    const finalRecords = await ScreenTracking.find({ materialId: testMaterialId });
    console.log(`  - Total records: ${finalRecords.length}`);
    console.log(`  - Current device: ${finalRecords[0]?.deviceId}`);
    console.log(`  - Current slot: ${finalRecords[0]?.slotNumber}`);
    console.log(`  - Is online: ${finalRecords[0]?.isOnline}`);
    console.log(`  - Total hours: ${finalRecords[0]?.totalHoursOnline}`);
    console.log(`  - Total distance: ${finalRecords[0]?.totalDistanceTraveled}`);
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await ScreenTracking.deleteMany({ materialId: testMaterialId });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testSharedTracking();
