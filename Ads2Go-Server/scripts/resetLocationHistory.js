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

// Reset location history and distance
const resetLocationHistory = async () => {
  try {
    console.log('\n🧹 Resetting location history and distance...\n');

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      
      if (device.currentSession) {
        const oldDistance = device.currentSession.totalDistanceTraveled;
        const oldHistoryCount = device.currentSession.locationHistory?.length || 0;
        
        console.log(`  Previous distance: ${oldDistance} km`);
        console.log(`  Previous location history entries: ${oldHistoryCount}`);
        
        // Reset distance and clear location history using direct update
        await ScreenTracking.updateOne(
          { _id: device._id },
          { 
            $set: { 
              'currentSession.totalDistanceTraveled': 0,
              'currentSession.locationHistory': [],
              'totalDistanceTraveled': 0
            }
          }
        );
        console.log(`  ✅ Reset distance to 0 km and cleared location history`);
      } else {
        console.log(`  ✅ No current session to reset`);
      }
    }

    // Show final status
    console.log('\n📊 Final Status:');
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

    console.log('\n✅ Location history reset completed!');
    console.log('\n💡 Distance will now only be calculated when device actually moves to different locations.');
    console.log('   - Stationary devices will show 0.00 km');
    console.log('   - Moving devices will show actual distance traveled');

  } catch (error) {
    console.error('❌ Error resetting location history:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await resetLocationHistory();
  
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

module.exports = { resetLocationHistory };
