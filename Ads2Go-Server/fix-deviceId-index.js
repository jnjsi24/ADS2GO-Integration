const mongoose = require('mongoose');
require('dotenv').config();

// Use the same MongoDB connection string as the main server
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

async function fixDeviceIdIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📡 Using connection string:', MONGODB_URI.substring(0, 20) + '...');
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('tablets');

    console.log('🔍 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('📊 Current indexes:', indexes.map(idx => idx.name));

    // Find the problematic deviceId index
    const deviceIdIndex = indexes.find(idx => 
      idx.name === 'deviceId_1' || 
      (idx.key && idx.key.deviceId)
    );

    if (deviceIdIndex) {
      console.log('⚠️  Found deviceId index:', deviceIdIndex.name);
      console.log('   Index details:', deviceIdIndex);
      
      if (deviceIdIndex.unique) {
        console.log('🗑️  Dropping unique deviceId index...');
        await collection.dropIndex(deviceIdIndex.name);
        console.log('✅ Successfully dropped deviceId index');
      } else {
        console.log('ℹ️  deviceId index is not unique, no action needed');
      }
    } else {
      console.log('ℹ️  No deviceId index found');
    }

    // Optionally, create a sparse unique index that only applies to non-null values
    console.log('🔧 Creating sparse unique index for deviceId (only applies to non-null values)...');
    await collection.createIndex(
      { 'tablets.deviceId': 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'tablets_deviceId_sparse_unique'
      }
    );
    console.log('✅ Created sparse unique index for deviceId');

    console.log('🔍 Verifying indexes after fix...');
    const newIndexes = await collection.indexes();
    console.log('📊 Updated indexes:', newIndexes.map(idx => idx.name));

  } catch (error) {
    console.error('❌ Error fixing deviceId index:', error);
  } finally {
    console.log('\n🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixDeviceIdIndex()
    .then(() => {
      console.log('🎉 DeviceId index fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 DeviceId index fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixDeviceIdIndex;
