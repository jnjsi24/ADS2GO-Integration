require('dotenv').config();
const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');
const Material = require('../src/models/Material');

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

// Clean up screen tracking data
const cleanupScreenTrackingData = async () => {
  try {
    console.log('\n🧹 Starting screen tracking data cleanup...\n');

    // 1. Remove test materials
    console.log('1. Cleaning up test materials...');
    const testMaterials = await Material.find({
      $or: [
        { materialId: /test/i },
        { title: /test/i },
        { materialId: 'test' },
        { title: 'test' }
      ]
    });

    console.log(`Found ${testMaterials.length} test materials to remove:`);
    testMaterials.forEach(material => {
      console.log(`  - ${material.materialId}: ${material.title}`);
    });

    if (testMaterials.length > 0) {
      const testMaterialIds = testMaterials.map(m => m._id);
      
      // Remove associated screen tracking data
      const deletedScreenTracking = await ScreenTracking.deleteMany({
        materialId: { $in: testMaterialIds }
      });
      console.log(`  ✅ Removed ${deletedScreenTracking.deletedCount} screen tracking records for test materials`);
      
      // Remove test materials
      const deletedMaterials = await Material.deleteMany({
        _id: { $in: testMaterialIds }
      });
      console.log(`  ✅ Removed ${deletedMaterials.deletedCount} test materials`);
    }

    // 2. Reset old sessions (sessions older than 24 hours)
    console.log('\n2. Resetting old sessions...');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const oldSessions = await ScreenTracking.find({
      'currentSession.startTime': { $lt: oneDayAgo },
      'currentSession.isActive': true
    });

    console.log(`Found ${oldSessions.length} devices with sessions older than 24 hours:`);
    
    let resetCount = 0;
    for (const tracking of oldSessions) {
      console.log(`  - ${tracking.materialId} (${tracking.deviceId}): Session started ${tracking.currentSession.startTime}`);
      
      // End the old session
      await tracking.endDailySession();
      
      // Start a new session
      await tracking.startDailySession();
      
      // Reset location and status
      tracking.isOnline = false;
      tracking.lastSeen = new Date();
      tracking.currentLocation = null;
      await tracking.save();
      
      resetCount++;
    }
    
    console.log(`  ✅ Reset ${resetCount} old sessions`);

    // 3. Clean up unrealistic distance data
    console.log('\n3. Cleaning up unrealistic distance data...');
    const unrealisticDistance = await ScreenTracking.find({
      'currentSession.totalDistanceTraveled': { $gt: 1000 } // More than 1000km in one day
    });

    console.log(`Found ${unrealisticDistance.length} devices with unrealistic distance data:`);
    
    let distanceResetCount = 0;
    for (const tracking of unrealisticDistance) {
      console.log(`  - ${tracking.materialId}: ${tracking.currentSession.totalDistanceTraveled}km`);
      
      // Reset distance for current session
      tracking.currentSession.totalDistanceTraveled = 0;
      tracking.currentSession.locationHistory = [];
      await tracking.save();
      
      distanceResetCount++;
    }
    
    console.log(`  ✅ Reset distance data for ${distanceResetCount} devices`);

    // 4. Clean up devices with no recent activity (offline for more than 7 days)
    console.log('\n4. Cleaning up inactive devices...');
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const inactiveDevices = await ScreenTracking.find({
      isOnline: false,
      lastSeen: { $lt: oneWeekAgo }
    });

    console.log(`Found ${inactiveDevices.length} devices inactive for more than 7 days:`);
    
    let inactiveCount = 0;
    for (const tracking of inactiveDevices) {
      console.log(`  - ${tracking.materialId} (${tracking.deviceId}): Last seen ${tracking.lastSeen}`);
      
      // Mark as inactive and reset session
      tracking.isActive = false;
      await tracking.endDailySession();
      await tracking.save();
      
      inactiveCount++;
    }
    
    console.log(`  ✅ Marked ${inactiveCount} devices as inactive`);

    // 5. Summary
    console.log('\n📊 Cleanup Summary:');
    console.log(`  - Test materials removed: ${testMaterials.length}`);
    console.log(`  - Old sessions reset: ${resetCount}`);
    console.log(`  - Distance data cleaned: ${distanceResetCount}`);
    console.log(`  - Inactive devices marked: ${inactiveCount}`);

    // 6. Show current active devices
    console.log('\n📱 Current Active Devices:');
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

    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  - Restart your Android player apps to register fresh');
    console.log('  - Monitor the dashboard for real-time data');
    console.log('  - Sessions will now start fresh and show accurate metrics');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await cleanupScreenTrackingData();
  
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

module.exports = { cleanupScreenTrackingData };
