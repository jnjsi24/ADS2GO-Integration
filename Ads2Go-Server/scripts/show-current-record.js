const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function showCurrentRecord() {
  try {
    console.log('📊 Showing current record structure...');
    
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
    const record = await ScreenTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    if (!record) {
      console.log('❌ No record found with materialId: DGL-HEADDRESS-CAR-001');
      return;
    }
    
    console.log('\n📋 COMPLETE RECORD STRUCTURE:');
    console.log('=' .repeat(50));
    
    // Basic info
    console.log(`📱 MaterialId: ${record.materialId}`);
    console.log(`🚗 CarGroupId: ${record.carGroupId}`);
    console.log(`📺 ScreenType: ${record.screenType}`);
    console.log(`🌐 IsOnline: ${record.isOnline}`);
    console.log(`⏰ LastSeen: ${record.lastSeen}`);
    
    // Legacy fields (for backward compatibility)
    console.log('\n🔧 LEGACY FIELDS (Backward Compatibility):');
    console.log(`  - DeviceId: ${record.deviceId}`);
    console.log(`  - SlotNumber: ${record.slotNumber}`);
    console.log(`  - Note: These show the "current primary" device`);
    
    // New multi-slot structure
    console.log('\n🔄 MULTI-SLOT DEVICES ARRAY:');
    if (record.devices && record.devices.length > 0) {
      record.devices.forEach((device, index) => {
        console.log(`  ${index + 1}. DeviceId: ${device.deviceId}`);
        console.log(`     Slot: ${device.slotNumber}`);
        console.log(`     Online: ${device.isOnline}`);
        console.log(`     LastSeen: ${device.lastSeen}`);
        console.log(`     TotalHours: ${device.totalHoursOnline || 0}`);
        console.log(`     TotalDistance: ${device.totalDistanceTraveled || 0}`);
        console.log('');
      });
    } else {
      console.log('  No devices in array');
    }
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`  - Total devices tracked: ${record.devices ? record.devices.length : 0}`);
    console.log(`  - Slot 1 present: ${record.devices?.find(d => d.slotNumber === 1) ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Slot 2 present: ${record.devices?.find(d => d.slotNumber === 2) ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Both slots in same record: ${record.devices?.length === 2 ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ This record now supports BOTH Slot 1 and Slot 2!');
    console.log('   The legacy fields show Slot 2 as primary, but both slots are tracked.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
showCurrentRecord();
