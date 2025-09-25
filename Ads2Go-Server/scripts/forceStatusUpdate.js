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

// Force status update for all devices
const forceStatusUpdate = async () => {
  try {
    console.log('\n🔄 Forcing status update for all devices...\n');

    const now = new Date();
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`2 minutes ago: ${twoMinutesAgo.toISOString()}`);
    console.log(`5 minutes ago: ${fiveMinutesAgo.toISOString()}\n`);

    const allDevices = await ScreenTracking.find({ isActive: true });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Current status: ${device.isOnline ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`  Last seen: ${device.lastSeen.toISOString()}`);
      
      const timeSinceLastSeen = now - new Date(device.lastSeen);
      const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
      console.log(`  Minutes since last seen: ${minutesSinceLastSeen}`);
      
      // Check if device should be offline (more than 2 minutes)
      if (minutesSinceLastSeen > 2) {
        if (device.isOnline) {
          console.log(`  🔧 Device should be offline, updating status...`);
          
          // Update device status to offline
          await ScreenTracking.updateOne(
            { _id: device._id },
            { 
              $set: { 
                isOnline: false,
                'devices.$[].isOnline': false,
                'devices.$[].lastSeen': new Date(device.lastSeen) // Keep original last seen time
              }
            }
          );
          
          console.log(`  ✅ Status updated to OFFLINE`);
        } else {
          console.log(`  ✅ Already offline`);
        }
      } else {
        console.log(`  ✅ Still within 2-minute threshold, keeping as ONLINE`);
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

    console.log('\n✅ Status update completed!');

  } catch (error) {
    console.error('❌ Error forcing status update:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await forceStatusUpdate();
  
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

module.exports = { forceStatusUpdate };
