const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Load environment variables
require('dotenv').config();

async function migrateToMultiSlot() {
  try {
    console.log('🔄 Starting migration to MULTI-SLOT TRACKING...');
    
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
    
    // Process each record
    for (const record of allRecords) {
      console.log(`\n🔄 Processing record: ${record.materialId}`);
      console.log(`  - Current deviceId: ${record.deviceId}`);
      console.log(`  - Current slotNumber: ${record.slotNumber}`);
      console.log(`  - Has devices array: ${record.devices ? 'Yes' : 'No'}`);
      
      // If devices array doesn't exist, create it from legacy fields
      if (!record.devices || record.devices.length === 0) {
        console.log(`  - Creating devices array from legacy fields`);
        record.devices = [{
          deviceId: record.deviceId,
          slotNumber: record.slotNumber,
          isOnline: record.isOnline,
          lastSeen: record.lastSeen,
          currentLocation: record.currentLocation,
          totalHoursOnline: record.totalHoursOnline || 0,
          totalDistanceTraveled: record.totalDistanceTraveled || 0
        }];
        
        await record.save();
        console.log(`  ✅ Created devices array with 1 device`);
      } else {
        console.log(`  ✅ Devices array already exists with ${record.devices.length} devices`);
      }
      
      // Show final structure
      console.log(`  📊 Final structure:`);
      console.log(`    - MaterialId: ${record.materialId}`);
      console.log(`    - Legacy DeviceId: ${record.deviceId} (Slot ${record.slotNumber})`);
      console.log(`    - Devices array:`);
      record.devices.forEach((device, index) => {
        console.log(`      ${index + 1}. ${device.deviceId} (Slot ${device.slotNumber}, Online: ${device.isOnline})`);
      });
    }
    
    console.log(`\n✅ Migration completed! All records now support multi-slot tracking.`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
migrateToMultiSlot();
