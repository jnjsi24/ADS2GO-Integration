require('dotenv').config();
const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in the .env file');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Remove test device
const removeTestDevice = async () => {
  try {
    console.log('\n🧹 Removing test device...\n');

    // Find test device
    const testDevice = await ScreenTracking.findOne({
      $or: [
        { materialId: 'test' },
        { deviceId: /test/i },
        { materialId: /test/i }
      ]
    });

    if (testDevice) {
      console.log(`Found test device: ${testDevice.materialId} (${testDevice.deviceId})`);
      
      // Remove the test device
      const result = await ScreenTracking.deleteOne({ _id: testDevice._id });
      
      if (result.deletedCount > 0) {
        console.log('✅ Test device removed successfully');
      } else {
        console.log('❌ Failed to remove test device');
      }
    } else {
      console.log('ℹ️ No test device found');
    }

    // Show remaining devices
    console.log('\n📱 Remaining Active Devices:');
    const activeDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    if (activeDevices.length === 0) {
      console.log('  No active devices found');
    } else {
      activeDevices.forEach(device => {
        const hours = device.currentHoursToday;
        const distance = device.currentSession?.totalDistanceTraveled || 0;
        const status = device.isOnline ? '🟢 Online' : '🔴 Offline';
        
        console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km`);
      });
    }

    console.log('\n✅ Test device cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await removeTestDevice();
  
  console.log('\n🔌 Disconnecting from database...');
  await mongoose.disconnect();
  console.log('✅ Disconnected successfully');
  
  process.exit(0);
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { removeTestDevice };
