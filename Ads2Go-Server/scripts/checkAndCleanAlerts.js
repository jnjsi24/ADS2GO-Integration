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

// Check and clean alerts
const checkAndCleanAlerts = async () => {
  try {
    console.log('\n🔍 Checking alerts in database...\n');

    // Get all devices with alerts
    const devicesWithAlerts = await ScreenTracking.find({
      'alerts.0': { $exists: true } // Has at least one alert
    });

    console.log(`Found ${devicesWithAlerts.length} devices with alerts:`);
    
    let totalAlerts = 0;
    let cleanedCount = 0;
    
    for (const device of devicesWithAlerts) {
      console.log(`\n📱 ${device.materialId} (${device.deviceId}):`);
      console.log(`  Total alerts: ${device.alerts.length}`);
      
      // Show alert details
      device.alerts.forEach((alert, index) => {
        console.log(`    ${index + 1}. [${alert.severity}] ${alert.type}: ${alert.message}`);
        console.log(`       Created: ${alert.timestamp.toLocaleString()}`);
        console.log(`       Resolved: ${alert.isResolved ? 'Yes' : 'No'}`);
      });
      
      totalAlerts += device.alerts.length;
      
      // Check if we should clean these alerts
      const oldAlerts = device.alerts.filter(alert => {
        const alertAge = Date.now() - new Date(alert.timestamp).getTime();
        const hoursOld = alertAge / (1000 * 60 * 60);
        return hoursOld > 24; // Older than 24 hours
      });
      
      if (oldAlerts.length > 0) {
        console.log(`  🧹 Found ${oldAlerts.length} old alerts (older than 24 hours)`);
        
        // Keep only recent alerts (less than 24 hours old)
        const recentAlerts = device.alerts.filter(alert => {
          const alertAge = Date.now() - new Date(alert.timestamp).getTime();
          const hoursOld = alertAge / (1000 * 60 * 60);
          return hoursOld <= 24;
        });
        
        device.alerts = recentAlerts;
        await device.save();
        
        console.log(`  ✅ Cleaned ${oldAlerts.length} old alerts, kept ${recentAlerts.length} recent ones`);
        cleanedCount += oldAlerts.length;
      } else {
        console.log(`  ℹ️ No old alerts to clean`);
      }
    }

    console.log(`\n📊 Alert Summary:`);
    console.log(`  - Devices with alerts: ${devicesWithAlerts.length}`);
    console.log(`  - Total alerts: ${totalAlerts}`);
    console.log(`  - Old alerts cleaned: ${cleanedCount}`);
    
    // Show remaining alerts by type
    const remainingDevices = await ScreenTracking.find({
      'alerts.0': { $exists: true }
    });
    
    const alertTypes = {};
    remainingDevices.forEach(device => {
      device.alerts.forEach(alert => {
        alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
      });
    });
    
    if (Object.keys(alertTypes).length > 0) {
      console.log(`\n🚨 Remaining Alerts by Type:`);
      Object.entries(alertTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} alerts`);
      });
    } else {
      console.log(`\n✅ No alerts remaining in the system`);
    }

    // Show current device status
    console.log(`\n📱 Current Device Status:`);
    const allDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    allDevices.forEach(device => {
      const hours = device.currentHoursToday;
      const distance = device.currentSession?.totalDistanceTraveled || 0;
      const status = device.isOnline ? '🟢 Online' : '🔴 Offline';
      const alertCount = device.alerts.length;
      
      console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km, ${alertCount} alert(s)`);
    });

  } catch (error) {
    console.error('❌ Error checking alerts:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await checkAndCleanAlerts();
  
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

module.exports = { checkAndCleanAlerts };
