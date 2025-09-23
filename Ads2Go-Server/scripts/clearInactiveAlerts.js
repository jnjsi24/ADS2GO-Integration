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

// Clear alerts from inactive devices
const clearInactiveAlerts = async () => {
  try {
    console.log('\n🧹 Clearing alerts from inactive devices...\n');

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Status: ${device.isOnline ? 'ACTIVE' : 'OFFLINE'}`);
      console.log(`  Alerts: ${device.alerts.length}`);
      
      // Clear alerts from offline devices
      if (!device.isOnline && device.alerts.length > 0) {
        console.log(`  🧹 Clearing ${device.alerts.length} alerts from offline device`);
        device.alerts = [];
        await device.save();
        console.log(`  ✅ Alerts cleared`);
      } else if (device.isOnline) {
        console.log(`  ✅ Keeping alerts (device is active)`);
      } else {
        console.log(`  ✅ No alerts to clear`);
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

    console.log('\n✅ Inactive device alerts cleared!');

  } catch (error) {
    console.error('❌ Error clearing inactive alerts:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await clearInactiveAlerts();
  
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

module.exports = { clearInactiveAlerts };
