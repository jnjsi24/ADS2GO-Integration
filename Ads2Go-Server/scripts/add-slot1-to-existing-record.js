const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function addSlot1ToExistingRecord() {
  try {
    console.log('🔄 Adding Slot 1 to existing record...');
    
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
    
    // Find the existing record
    const existingRecord = await ScreenTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    if (!existingRecord) {
      console.log('❌ No record found with materialId: DGL-HEADDRESS-CAR-001');
      return;
    }
    
    console.log('📊 Current record structure:');
    console.log(`  - MaterialId: ${existingRecord.materialId}`);
    console.log(`  - Legacy DeviceId: ${existingRecord.deviceId}`);
    console.log(`  - Legacy SlotNumber: ${existingRecord.slotNumber}`);
    console.log(`  - Devices array length: ${existingRecord.devices ? existingRecord.devices.length : 0}`);
    
    if (existingRecord.devices && existingRecord.devices.length > 0) {
      console.log(`  - Current devices:`);
      existingRecord.devices.forEach((device, index) => {
        console.log(`    ${index + 1}. ${device.deviceId} (Slot ${device.slotNumber}, Online: ${device.isOnline})`);
      });
    }
    
    // Check if Slot 1 already exists
    const slot1Exists = existingRecord.devices?.find(d => d.slotNumber === 1);
    
    if (slot1Exists) {
      console.log('✅ Slot 1 already exists in the record');
      return;
    }
    
    // Add Slot 1 to the devices array
    console.log('\n🔄 Adding Slot 1 to the devices array...');
    
    // Create a Slot 1 device ID (similar to Slot 2 but with different identifier)
    const slot1DeviceId = existingRecord.deviceId.replace('A2-', 'A1-'); // Change A2 to A1 for Slot 1
    
    existingRecord.devices.push({
      deviceId: slot1DeviceId,
      slotNumber: 1,
      isOnline: true,
      lastSeen: new Date(),
      totalHoursOnline: 0,
      totalDistanceTraveled: 0
    });
    
    await existingRecord.save();
    
    console.log(`✅ Added Slot 1: ${slot1DeviceId}`);
    
    // Show final structure
    console.log('\n📊 Final record structure:');
    console.log(`  - MaterialId: ${existingRecord.materialId}`);
    console.log(`  - Legacy DeviceId: ${existingRecord.deviceId} (Slot ${existingRecord.slotNumber})`);
    console.log(`  - Devices array:`);
    existingRecord.devices.forEach((device, index) => {
      console.log(`    ${index + 1}. ${device.deviceId} (Slot ${device.slotNumber}, Online: ${device.isOnline})`);
    });
    
    console.log('\n✅ SUCCESS: Both Slot 1 and Slot 2 are now in the same record!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
addSlot1ToExistingRecord();
