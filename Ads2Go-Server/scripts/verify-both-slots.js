const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function verifyBothSlots() {
  try {
    console.log('🔍 Verifying both slots are tracked...');
    
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
    
    // Find the record
    const record = await ScreenTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    if (!record) {
      console.log('❌ No record found');
      return;
    }
    
    console.log('\n📋 WHAT YOU SEE IN DATABASE VIEWER:');
    console.log('=' .repeat(50));
    console.log(`deviceId: "${record.deviceId}"`);
    console.log(`materialId: "${record.materialId}"`);
    console.log(`screenType: "${record.screenType}"`);
    console.log(`carGroupId: "${record.carGroupId}"`);
    console.log(`slotNumber: ${record.slotNumber}`);
    console.log(`isOnline: ${record.isOnline}`);
    console.log(`lastSeen: "${record.lastSeen}"`);
    console.log('=' .repeat(50));
    
    console.log('\n🔄 WHAT\'S ACTUALLY TRACKED (devices array):');
    console.log('=' .repeat(50));
    
    if (record.devices && record.devices.length > 0) {
      record.devices.forEach((device, index) => {
        console.log(`Device ${index + 1}:`);
        console.log(`  deviceId: "${device.deviceId}"`);
        console.log(`  slotNumber: ${device.slotNumber}`);
        console.log(`  isOnline: ${device.isOnline}`);
        console.log(`  lastSeen: "${device.lastSeen}"`);
        console.log(`  totalHoursOnline: ${device.totalHoursOnline || 0}`);
        console.log(`  totalDistanceTraveled: ${device.totalDistanceTraveled || 0}`);
        console.log('');
      });
    } else {
      console.log('No devices array found');
    }
    
    console.log('=' .repeat(50));
    
    // Check if both slots exist
    const slot1 = record.devices?.find(d => d.slotNumber === 1);
    const slot2 = record.devices?.find(d => d.slotNumber === 2);
    
    console.log('\n📊 SLOT VERIFICATION:');
    console.log(`✅ Slot 1 exists: ${slot1 ? 'YES' : 'NO'}`);
    if (slot1) {
      console.log(`   - DeviceId: ${slot1.deviceId}`);
      console.log(`   - Online: ${slot1.isOnline}`);
    }
    
    console.log(`✅ Slot 2 exists: ${slot2 ? 'YES' : 'NO'}`);
    if (slot2) {
      console.log(`   - DeviceId: ${slot2.deviceId}`);
      console.log(`   - Online: ${slot2.isOnline}`);
    }
    
    console.log(`\n🎯 RESULT: ${slot1 && slot2 ? 'BOTH SLOTS ARE TRACKED!' : 'MISSING SLOTS'}`);
    
    if (slot1 && slot2) {
      console.log('\n💡 EXPLANATION:');
      console.log('The database viewer shows slotNumber: 2 because that\'s the "legacy field"');
      console.log('showing the current primary device. But the actual multi-slot tracking');
      console.log('is in the "devices" array above, which contains BOTH Slot 1 and Slot 2!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyBothSlots();
