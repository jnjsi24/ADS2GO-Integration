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

// Fix false active status
const fixFalseActive = async () => {
  try {
    console.log('\n🔧 Fixing false ACTIVE status...\n');

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      
      if (device.devices && device.devices.length > 0) {
        let hasRealActivity = false;
        
        device.devices.forEach((d, i) => {
          const timeSinceLastSeen = Date.now() - new Date(d.lastSeen).getTime();
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          
          console.log(`  Device ${i + 1}: ${d.deviceId} - ${d.isOnline ? 'ONLINE' : 'OFFLINE'} (last seen: ${minutesSinceLastSeen} minutes ago)`);
          
          // Check if this device has recent activity (within 2 minutes)
          if (d.isOnline && minutesSinceLastSeen <= 2) {
            hasRealActivity = true;
          } else {
            // Mark old devices as offline
            if (d.isOnline && minutesSinceLastSeen > 2) {
              console.log(`    🔧 Marking old device as offline (${minutesSinceLastSeen} minutes old)`);
              d.isOnline = false;
            }
          }
        });
        
        // Update root status based on real activity
        if (device.isOnline !== hasRealActivity) {
          console.log(`  🔧 Updating root status: ${device.isOnline} -> ${hasRealActivity}`);
          device.isOnline = hasRealActivity;
          device.lastSeen = new Date();
        }
        
        await device.save();
        console.log(`  ✅ Status updated: ${hasRealActivity ? 'ACTIVE' : 'OFFLINE'}`);
      } else {
        // No devices array, mark as offline
        if (device.isOnline) {
          console.log(`  🔧 No devices array, marking as offline`);
          device.isOnline = false;
          await device.save();
          console.log(`  ✅ Status updated to offline`);
        } else {
          console.log(`  ✅ Already offline`);
        }
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

    console.log('\n✅ False ACTIVE status fixed!');
    console.log('\n💡 Only devices with real WebSocket connections should show as ACTIVE now.');

  } catch (error) {
    console.error('❌ Error fixing false active status:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await fixFalseActive();
  
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

module.exports = { fixFalseActive };
