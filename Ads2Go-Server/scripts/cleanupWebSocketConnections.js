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

// Cleanup WebSocket connections
const cleanupWebSocketConnections = async () => {
  try {
    console.log('\n🔌 Cleaning up WebSocket connections...\n');

    // Get all device statuses from DeviceStatusManager
    const allStatuses = deviceStatusService.getAllDeviceStatuses();
    console.log(`Found ${allStatuses.length} device statuses in memory:`);
    
    allStatuses.forEach(status => {
      console.log(`  ${status.deviceId}: ${status.isOnline ? 'ONLINE' : 'OFFLINE'} (source: ${status.source})`);
    });

    // Get all devices from database
    const allDevices = await ScreenTracking.find({ isActive: true });
    console.log(`\nFound ${allDevices.length} devices in database:`);
    
    for (const device of allDevices) {
      console.log(`\n📱 ${device.materialId}:`);
      console.log(`  Database status: ${device.isOnline ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`  Last seen: ${device.lastSeen}`);
      
      // Check if there's a WebSocket connection for this device
      const wsStatus = allStatuses.find(status => 
        status.deviceId === device.materialId || 
        status.deviceId.includes(device.materialId) ||
        device.materialId.includes(status.deviceId)
      );
      
      if (wsStatus) {
        console.log(`  WebSocket status: ${wsStatus.isOnline ? 'CONNECTED' : 'DISCONNECTED'} (source: ${wsStatus.source})`);
        
        // If database says online but WebSocket says disconnected, fix database
        if (device.isOnline && !wsStatus.isOnline) {
          console.log(`  🔧 Fixing database status: ONLINE -> OFFLINE (WebSocket disconnected)`);
          await ScreenTracking.updateOne(
            { _id: device._id },
            { 
              $set: { 
                isOnline: false,
                'devices.$[].isOnline': false
              }
            }
          );
          console.log(`  ✅ Database status corrected`);
        }
      } else {
        console.log(`  WebSocket status: No connection found`);
        
        // If database says online but no WebSocket connection, mark as offline
        if (device.isOnline) {
          console.log(`  🔧 Fixing database status: ONLINE -> OFFLINE (no WebSocket connection)`);
          await ScreenTracking.updateOne(
            { _id: device._id },
            { 
              $set: { 
                isOnline: false,
                'devices.$[].isOnline': false
              }
            }
          );
          console.log(`  ✅ Database status corrected`);
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

    console.log('\n✅ WebSocket connection cleanup completed!');
    console.log('\n💡 All device statuses should now be accurate and consistent.');

  } catch (error) {
    console.error('❌ Error cleaning up WebSocket connections:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await cleanupWebSocketConnections();
  
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

module.exports = { cleanupWebSocketConnections };
