require('dotenv').config();
const mongoose = require('mongoose');
const ScreenTracking = require('../src/models/screenTracking');
const deviceStatusService = require('../src/services/deviceStatusService');

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

// Fix active status based on WebSocket connections
const fixActiveStatusBasedOnWebSocket = async () => {
  try {
    console.log('\n🔌 Fixing active status based on WebSocket connections...\n');

    // Get all WebSocket statuses
    const allStatuses = deviceStatusService.getAllDeviceStatuses();
    console.log(`Found ${allStatuses.length} WebSocket statuses:`);
    
    allStatuses.forEach((status, i) => {
      console.log(`  ${i + 1}. ${status.deviceId}: ${status.isOnline ? 'ONLINE' : 'OFFLINE'} (source: ${status.source})`);
    });

    // Get all devices
    const allDevices = await ScreenTracking.find({ isActive: true });
    console.log(`\nFound ${allDevices.length} devices in database:`);
    
    for (const device of allDevices) {
      console.log(`\n📱 ${device.materialId}:`);
      console.log(`  Current root isOnline: ${device.isOnline}`);
      
      if (device.devices && device.devices.length > 0) {
        console.log(`  Sub-devices (${device.devices.length}):`);
        
        let hasAnyOnlineDevice = false;
        
        for (let i = 0; i < device.devices.length; i++) {
          const d = device.devices[i];
          const timeSinceLastSeen = Date.now() - new Date(d.lastSeen).getTime();
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          
          // Check if this device has an active WebSocket connection
          const webSocketStatus = allStatuses.find(status => 
            status.deviceId === d.deviceId || 
            status.deviceId === device.materialId ||
            d.deviceId.includes(status.deviceId)
          );
          
          const hasWebSocketConnection = webSocketStatus && webSocketStatus.isOnline;
          const shouldBeOnline = hasWebSocketConnection && minutesSinceLastSeen <= 2;
          
          console.log(`    Device ${i + 1}: ${d.deviceId}`);
          console.log(`      Current status: ${d.isOnline ? 'ONLINE' : 'OFFLINE'}`);
          console.log(`      WebSocket status: ${hasWebSocketConnection ? 'CONNECTED' : 'DISCONNECTED'}`);
          console.log(`      Last seen: ${minutesSinceLastSeen} minutes ago`);
          console.log(`      Should be: ${shouldBeOnline ? 'ONLINE' : 'OFFLINE'}`);
          
          if (d.isOnline !== shouldBeOnline) {
            console.log(`      🔧 Updating device status: ${d.isOnline} -> ${shouldBeOnline}`);
            device.devices[i].isOnline = shouldBeOnline;
          }
          
          if (shouldBeOnline) {
            hasAnyOnlineDevice = true;
          }
        }
        
        // Update root status
        if (device.isOnline !== hasAnyOnlineDevice) {
          console.log(`  🔧 Updating root status: ${device.isOnline} -> ${hasAnyOnlineDevice}`);
          device.isOnline = hasAnyOnlineDevice;
        }
        
        await device.save();
        console.log(`  ✅ Device status updated`);
      } else {
        console.log(`  No sub-devices found`);
        if (device.isOnline) {
          console.log(`  🔧 No sub-devices but marked as online, setting to offline`);
          device.isOnline = false;
          await device.save();
        }
      }
    }

    // Clear alerts from offline devices
    console.log('\n🧹 Clearing alerts from offline devices...');
    await ScreenTracking.updateMany(
      { isOnline: false },
      { $set: { alerts: [] } }
    );
    console.log('✅ Alerts cleared from offline devices');

    // Show final status
    console.log('\n📊 Final Status (Based on WebSocket Connections):');
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

    console.log('\n✅ Active status fixed based on WebSocket connections!');
    console.log('\n💡 Devices are now only marked as ACTIVE if they have active WebSocket connections.');
    console.log('   Location updates alone will not mark devices as online.');

  } catch (error) {
    console.error('❌ Error fixing active status based on WebSocket:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await fixActiveStatusBasedOnWebSocket();
  
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

module.exports = { fixActiveStatusBasedOnWebSocket };
