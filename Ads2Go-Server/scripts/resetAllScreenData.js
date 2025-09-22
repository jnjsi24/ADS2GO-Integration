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

// Reset all screen data to 0
const resetAllScreenData = async () => {
  try {
    console.log('\n🧹 Resetting all screen data to 0...\n');

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Before reset:`);
      console.log(`    Hours Today: ${device.currentHoursToday.toFixed(1)}h`);
      console.log(`    Distance: ${device.currentSession?.totalDistanceTraveled || 0}km`);
      console.log(`    Alerts: ${device.alerts.length}`);
      console.log(`    Status: ${device.isOnline ? 'ACTIVE' : 'OFFLINE'}`);
      
      // Reset all data to 0
      await ScreenTracking.updateOne(
        { _id: device._id },
        { 
          $set: { 
            // Reset session data
            'currentSession.totalHoursOnline': 0,
            'currentSession.totalDistanceTraveled': 0,
            'currentSession.locationHistory': [],
            'currentSession.startTime': new Date(), // Reset to current time
            
            // Reset total distance
            'totalDistanceTraveled': 0,
            
            // Clear all alerts
            'alerts': [],
            
            // Reset device status to offline
            'isOnline': false,
            'devices.$[].isOnline': false,
            
            // Reset last seen to current time
            'lastSeen': new Date(),
            'devices.$[].lastSeen': new Date()
          }
        }
      );
      
      console.log(`  ✅ Reset completed`);
    }

    // Show final status
    console.log('\n📊 Final Reset Status:');
    const finalDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    finalDevices.forEach(device => {
      const hours = device.currentHoursToday;
      const distance = device.currentSession?.totalDistanceTraveled || 0;
      const status = device.isOnline ? '🟢 ACTIVE' : '🔴 OFFLINE';
      const alertCount = device.alerts.length;
      const lastSeen = new Date(device.lastSeen);
      const minutesAgo = Math.round((Date.now() - lastSeen.getTime()) / (1000 * 60));
      
      console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km, ${alertCount} alert(s), last seen ${minutesAgo}m ago`);
    });

    console.log('\n✅ All screen data reset completed!');
    console.log('\n💡 All devices now have:');
    console.log('  - 0 hours today');
    console.log('  - 0 distance traveled');
    console.log('  - 0 alerts');
    console.log('  - OFFLINE status');
    console.log('  - Fresh session start time');

  } catch (error) {
    console.error('❌ Error resetting screen data:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await resetAllScreenData();
  
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

module.exports = { resetAllScreenData };
