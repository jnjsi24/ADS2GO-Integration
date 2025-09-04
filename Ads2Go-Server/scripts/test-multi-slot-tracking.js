const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function testMultiSlotTracking() {
  try {
    console.log('🧪 Testing MULTI-SLOT TRACKING system...');
    
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
    
    const testMaterialId = 'TEST-MULTI-SLOT-001';
    const testCarGroupId = 'TEST-GROUP-001';
    
    // Test 1: Register Slot 1
    console.log('\n🔄 Test 1: Registering Slot 1...');
    const slot1DeviceId = 'TABLET-SLOT1-MULTI-001';
    
    let record1 = new ScreenTracking({
      materialId: testMaterialId,
      carGroupId: testCarGroupId,
      screenType: 'HEADDRESS',
      devices: [{
        deviceId: slot1DeviceId,
        slotNumber: 1,
        isOnline: true,
        lastSeen: new Date(),
        totalHoursOnline: 2.5,
        totalDistanceTraveled: 1000
      }],
      // Legacy fields
      deviceId: slot1DeviceId,
      slotNumber: 1,
      isOnline: true,
      lastSeen: new Date()
    });
    await record1.save();
    console.log(`✅ Created record with Slot 1: ${slot1DeviceId}`);
    
    // Test 2: Register Slot 2 (should add to same record)
    console.log('\n🔄 Test 2: Registering Slot 2...');
    const slot2DeviceId = 'TABLET-SLOT2-MULTI-002';
    
    let record2 = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (record2) {
      console.log(`✅ Found existing record, adding Slot 2`);
      
      // Add Slot 2 to the devices array
      record2.devices.push({
        deviceId: slot2DeviceId,
        slotNumber: 2,
        isOnline: true,
        lastSeen: new Date(),
        totalHoursOnline: 1.5,
        totalDistanceTraveled: 500
      });
      
      // Update legacy fields to show Slot 2 as primary
      record2.deviceId = slot2DeviceId;
      record2.slotNumber = 2;
      record2.isOnline = true;
      record2.lastSeen = new Date();
      
      await record2.save();
      console.log(`✅ Added Slot 2 to existing record: ${slot2DeviceId}`);
    }
    
    // Test 3: Verify both slots are in the same record
    console.log('\n🔄 Test 3: Verifying both slots in same record...');
    const finalRecord = await ScreenTracking.findOne({ materialId: testMaterialId });
    
    if (finalRecord) {
      console.log(`📊 Record details:`);
      console.log(`  - MaterialId: ${finalRecord.materialId}`);
      console.log(`  - Legacy DeviceId: ${finalRecord.deviceId} (Slot ${finalRecord.slotNumber})`);
      console.log(`  - Devices array length: ${finalRecord.devices ? finalRecord.devices.length : 0}`);
      
      if (finalRecord.devices && finalRecord.devices.length > 0) {
        console.log(`  - Devices in array:`);
        finalRecord.devices.forEach((device, index) => {
          console.log(`    ${index + 1}. DeviceId: ${device.deviceId}, Slot: ${device.slotNumber}, Online: ${device.isOnline}`);
        });
      }
      
      // Check if both slots are present
      const slot1Device = finalRecord.devices?.find(d => d.slotNumber === 1);
      const slot2Device = finalRecord.devices?.find(d => d.slotNumber === 2);
      
      if (slot1Device && slot2Device) {
        console.log(`✅ SUCCESS: Both Slot 1 and Slot 2 are in the same record!`);
        console.log(`  - Slot 1: ${slot1Device.deviceId} (Online: ${slot1Device.isOnline})`);
        console.log(`  - Slot 2: ${slot2Device.deviceId} (Online: ${slot2Device.isOnline})`);
      } else {
        console.log(`❌ FAILURE: Missing slots`);
        if (!slot1Device) console.log(`  - Slot 1 not found`);
        if (!slot2Device) console.log(`  - Slot 2 not found`);
      }
    } else {
      console.log(`❌ No record found`);
    }
    
    // Test 4: Test unregistration of Slot 1
    console.log('\n🔄 Test 4: Unregistering Slot 1...');
    if (finalRecord) {
      const slot1Index = finalRecord.devices.findIndex(d => d.slotNumber === 1);
      if (slot1Index >= 0) {
        finalRecord.devices[slot1Index].isOnline = false;
        finalRecord.devices[slot1Index].lastSeen = new Date();
        await finalRecord.save();
        console.log(`✅ Unregistered Slot 1: ${finalRecord.devices[slot1Index].deviceId}`);
      }
    }
    
    // Test 5: Verify Slot 1 is offline but Slot 2 is still online
    console.log('\n🔄 Test 5: Verifying Slot 1 offline, Slot 2 online...');
    const updatedRecord = await ScreenTracking.findOne({ materialId: testMaterialId });
    if (updatedRecord && updatedRecord.devices) {
      const slot1Device = updatedRecord.devices.find(d => d.slotNumber === 1);
      const slot2Device = updatedRecord.devices.find(d => d.slotNumber === 2);
      
      console.log(`📊 Final status:`);
      console.log(`  - Slot 1: ${slot1Device?.deviceId} (Online: ${slot1Device?.isOnline})`);
      console.log(`  - Slot 2: ${slot2Device?.deviceId} (Online: ${slot2Device?.isOnline})`);
      
      if (slot1Device && !slot1Device.isOnline && slot2Device && slot2Device.isOnline) {
        console.log(`✅ SUCCESS: Slot 1 offline, Slot 2 online - both tracked in same record!`);
      } else {
        console.log(`❌ FAILURE: Status not as expected`);
      }
    }
    
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
testMultiSlotTracking();
