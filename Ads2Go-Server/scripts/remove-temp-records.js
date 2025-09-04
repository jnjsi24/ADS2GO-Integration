const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Use the same connection as the server
// Load environment variables
require('dotenv').config();

async function removeTempRecords() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    
    // Use the same connection string as the server
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      return;
    }
    
    console.log('📡 Connecting to:', mongoUri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Find all records with TEMP- deviceIds
    const tempRecords = await ScreenTracking.find({ 
      deviceId: { $regex: /^TEMP-/ } 
    });
    
    console.log(`🔍 Found ${tempRecords.length} records with TEMP- deviceIds:`);
    tempRecords.forEach(record => {
      console.log(`  - ${record.deviceId} (Material: ${record.materialId}, Slot: ${record.slotNumber})`);
    });
    
    if (tempRecords.length === 0) {
      console.log('✅ No TEMP- records found!');
      return;
    }
    
    // Delete all TEMP- records
    const result = await ScreenTracking.deleteMany({ 
      deviceId: { $regex: /^TEMP-/ } 
    });
    
    console.log(`🗑️  Deleted ${result.deletedCount} TEMP- records`);
    
    // Show remaining records
    const remainingRecords = await ScreenTracking.find({});
    console.log(`📊 Remaining ScreenTracking records: ${remainingRecords.length}`);
    
    remainingRecords.forEach(record => {
      console.log(`  - ${record.deviceId} (Material: ${record.materialId}, Slot: ${record.slotNumber}, Online: ${record.isOnline})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
removeTempRecords();
