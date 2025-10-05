const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

// Import the archive job
const dailyArchiveJob = require('../src/jobs/dailyArchiveJob');

async function testArchive() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');

    // Get current data before archiving
    const DeviceTracking = mongoose.model('DeviceTracking');
    const DeviceDataHistory = mongoose.model('DeviceDataHistory');

    const device = await DeviceTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-005' });
    if (!device) {
      console.log('❌ Device not found');
      return;
    }

    console.log('📊 Before archiving:');
    console.log(`   DeviceTracking adPlaybacks: ${device.adPlaybacks?.length || 0}`);
    console.log(`   DeviceTracking locationHistory: ${device.locationHistory?.length || 0}`);
    console.log(`   DeviceTracking totalAdPlays: ${device.totalAdPlays}`);

    // Check existing archive
    const existingArchive = await DeviceDataHistory.findOne({ 
      materialId: 'DGL-HEADDRESS-CAR-005',
      date: new Date('2025-10-03T00:00:00.000Z')
    });

    if (existingArchive) {
      console.log('📊 Existing archive:');
      console.log(`   DeviceDataHistory adPlaybacks: ${existingArchive.adPlaybacks?.length || 0}`);
      console.log(`   DeviceDataHistory locationHistory: ${existingArchive.locationHistory?.length || 0}`);
      console.log(`   DeviceDataHistory totalAdPlays: ${existingArchive.totalAdPlays}`);
    }

    // Run archive job
    console.log('\n🔄 Running archive job...');
    await dailyArchiveJob.archiveDailyData();

    // Check data after archiving
    const updatedArchive = await DeviceDataHistory.findOne({ 
      materialId: 'DGL-HEADDRESS-CAR-005',
      date: new Date('2025-10-03T00:00:00.000Z')
    });

    if (updatedArchive) {
      console.log('\n📊 After archiving:');
      console.log(`   DeviceDataHistory adPlaybacks: ${updatedArchive.adPlaybacks?.length || 0}`);
      console.log(`   DeviceDataHistory locationHistory: ${updatedArchive.locationHistory?.length || 0}`);
      console.log(`   DeviceDataHistory totalAdPlays: ${updatedArchive.totalAdPlays}`);
      console.log(`   Update count: ${updatedArchive.updateCount}`);
      console.log(`   Last update: ${updatedArchive.lastArchiveUpdate}`);
    }

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testArchive();
