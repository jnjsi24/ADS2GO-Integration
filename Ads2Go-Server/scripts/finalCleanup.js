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

// Final cleanup
const finalCleanup = async () => {
  try {
    console.log('\n🧹 Final cleanup...\n');

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      
      // Clear alerts
      if (device.alerts.length > 0) {
        console.log(`  Clearing ${device.alerts.length} alerts`);
        device.alerts = [];
      }
      
      // Reset unrealistic distance
      if (device.currentSession && device.currentSession.totalDistanceTraveled > 100) {
        console.log(`  Resetting distance: ${device.currentSession.totalDistanceTraveled}km -> 0km`);
        device.currentSession.totalDistanceTraveled = 0;
        device.currentSession.locationHistory = [];
      }
      
      await device.save();
      console.log(`  ✅ Cleaned up`);
    }

    // Show final status
    console.log('\n📊 Final Clean Status:');
    const finalDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    finalDevices.forEach(device => {
      const hours = device.currentHoursToday;
      const distance = device.currentSession?.totalDistanceTraveled || 0;
      const status = device.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
      const alertCount = device.alerts.length;
      const lastSeen = new Date(device.lastSeen);
      const minutesAgo = Math.round((Date.now() - lastSeen.getTime()) / (1000 * 60));
      
      console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km, ${alertCount} alert(s), last seen ${minutesAgo}m ago`);
    });

    console.log('\n✅ Final cleanup completed!');
    console.log('\n💡 Dashboard should now show:');
    console.log('  - DGL-HEADDRESS-CAR-001: ONLINE (if actively connected)');
    console.log('  - DGL-HEADDRESS-CAR-002: OFFLINE');
    console.log('  - DGL-HEADDRESS-CAR-003: ONLINE (your active Android player)');
    console.log('  - All devices: 0 alerts, realistic distance');

  } catch (error) {
    console.error('❌ Error in final cleanup:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await finalCleanup();
  
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

module.exports = { finalCleanup };
