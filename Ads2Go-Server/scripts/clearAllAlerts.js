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

// Clear all alerts from all devices
const clearAllAlerts = async () => {
  try {
    console.log('\n🧹 Clearing all alerts from all devices...\n');

    // Get all devices with alerts
    const devicesWithAlerts = await ScreenTracking.find({
      'alerts.0': { $exists: true }
    });

    console.log(`Found ${devicesWithAlerts.length} devices with alerts`);
    
    let totalAlertsCleared = 0;
    
    for (const device of devicesWithAlerts) {
      const alertCount = device.alerts.length;
      console.log(`  ${device.materialId}: ${alertCount} alerts`);
      
      // Clear all alerts
      device.alerts = [];
      await device.save();
      
      totalAlertsCleared += alertCount;
      console.log(`    ✅ Cleared ${alertCount} alerts`);
    }

    console.log(`\n📊 Alert Clearing Summary:`);
    console.log(`  - Devices processed: ${devicesWithAlerts.length}`);
    console.log(`  - Total alerts cleared: ${totalAlertsCleared}`);

    // Verify all alerts are cleared
    const remainingDevices = await ScreenTracking.find({
      'alerts.0': { $exists: true }
    });

    if (remainingDevices.length === 0) {
      console.log(`\n✅ All alerts successfully cleared!`);
    } else {
      console.log(`\n⚠️ Warning: ${remainingDevices.length} devices still have alerts`);
    }

    // Show current device status
    console.log(`\n📱 Current Device Status (No Alerts):`);
    const allDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    allDevices.forEach(device => {
      const hours = device.currentHoursToday;
      const distance = device.currentSession?.totalDistanceTraveled || 0;
      const status = device.isOnline ? '🟢 Online' : '🔴 Offline';
      
      console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km, 0 alert(s)`);
    });

    console.log(`\n💡 Alert System Status:`);
    console.log(`  - All historical alerts have been cleared`);
    console.log(`  - New alerts will only be generated when devices are actually online`);
    console.log(`  - The alert generation logic will create fewer, more meaningful alerts`);

  } catch (error) {
    console.error('❌ Error clearing alerts:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await clearAllAlerts();
  
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

module.exports = { clearAllAlerts };
