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

// Fix status synchronization
const fixStatusSync = async () => {
  try {
    console.log('\n🔧 Fixing status synchronization...\n');

    // Get all devices
    const allDevices = await ScreenTracking.find({ isActive: true });
    
    console.log(`Found ${allDevices.length} active devices:`);
    
    for (const device of allDevices) {
      console.log(`\n📱 ${device.materialId}:`);
      console.log(`  Root isOnline: ${device.isOnline}`);
      console.log(`  Last Seen: ${device.lastSeen}`);
      console.log(`  Devices Array: ${device.devices?.length || 0} devices`);
      
      if (device.devices && device.devices.length > 0) {
        device.devices.forEach((d, i) => {
          const timeSinceLastSeen = Date.now() - new Date(d.lastSeen).getTime();
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          console.log(`    Device ${i + 1}: ${d.deviceId} - ${d.isOnline ? 'ONLINE' : 'OFFLINE'} (last seen: ${minutesSinceLastSeen} minutes ago)`);
        });
        
        // Check if any device is actually online (last seen within 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const hasRecentActivity = device.devices.some(d => 
          d.isOnline && new Date(d.lastSeen) > twoMinutesAgo
        );
        
        console.log(`  Has recent activity: ${hasRecentActivity}`);
        
        // Fix status if it's wrong
        if (device.isOnline !== hasRecentActivity) {
          console.log(`  🔧 Fixing status: ${device.isOnline} -> ${hasRecentActivity}`);
          device.isOnline = hasRecentActivity;
          device.lastSeen = new Date();
          await device.save();
          console.log(`  ✅ Status updated`);
        } else {
          console.log(`  ✅ Status is correct`);
        }
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
      const status = device.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
      const alertCount = device.alerts.length;
      
      console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(1)}h, ${distance.toFixed(2)}km, ${alertCount} alert(s)`);
    });

    console.log('\n✅ Status synchronization completed!');

  } catch (error) {
    console.error('❌ Error fixing status sync:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await fixStatusSync();
  
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

module.exports = { fixStatusSync };
