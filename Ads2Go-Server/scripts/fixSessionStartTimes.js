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

// Fix session start times based on actual device activity
const fixSessionStartTimes = async () => {
  try {
    console.log('\n🕐 Fixing session start times based on actual device activity...\n');

    const allDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Current session start time: ${device.currentSession?.startTime}`);
      console.log(`  Last seen: ${device.lastSeen}`);
      
      if (device.currentSession) {
        // Calculate when this device was actually active
        // For offline devices, set session start to their last seen time minus some hours
        // For online devices, keep current start time
        
        let newStartTime;
        
        if (device.isOnline) {
          // Device is currently online, keep current start time
          newStartTime = device.currentSession.startTime;
          console.log(`  ✅ Device is online, keeping current start time`);
        } else {
          // Device is offline, set start time based on last activity
          const lastSeen = new Date(device.lastSeen);
          const now = new Date();
          const timeSinceLastSeen = now - lastSeen;
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          
          // Set start time to 30 minutes before last seen (assuming it was active for 30 minutes)
          newStartTime = new Date(lastSeen.getTime() - (30 * 60 * 1000));
          
          console.log(`  🔧 Device is offline (last seen ${minutesSinceLastSeen} minutes ago)`);
          console.log(`  🔧 Setting start time to: ${newStartTime.toISOString()}`);
        }
        
        // Update the session start time
        await ScreenTracking.updateOne(
          { _id: device._id },
          { 
            $set: { 
              'currentSession.startTime': newStartTime
            }
          }
        );
        
        console.log(`  ✅ Session start time updated`);
      } else {
        console.log(`  ❌ No current session found`);
      }
    }

    // Show final status with corrected hours
    console.log('\n📊 Final Status with Corrected Hours:');
    const finalDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    finalDevices.forEach(device => {
      const hours = device.currentHoursToday;
      const distance = device.currentSession?.totalDistanceTraveled || 0;
      const status = device.isOnline ? '🟢 ACTIVE' : '🔴 OFFLINE';
      const alertCount = device.alerts.length;
      const lastSeen = new Date(device.lastSeen);
      const minutesAgo = Math.round((Date.now() - lastSeen.getTime()) / (1000 * 60));
      
      // Calculate actual hours based on session start time
      let actualHours = 0;
      if (device.currentSession && device.currentSession.startTime) {
        const sessionStart = new Date(device.currentSession.startTime);
        const now = new Date();
        const totalTimeMs = now - sessionStart;
        actualHours = totalTimeMs / (1000 * 60 * 60);
      }
      
      console.log(`  ${device.materialId}: ${status}, ${actualHours.toFixed(1)}h, ${distance.toFixed(2)}km, ${alertCount} alert(s), last seen ${minutesAgo}m ago`);
    });

    console.log('\n✅ Session start times fixed!');
    console.log('\n💡 Each device now has its own session start time based on actual activity:');
    console.log('  - Online devices: Keep current start time');
    console.log('  - Offline devices: Start time set to 30 minutes before last seen');

  } catch (error) {
    console.error('❌ Error fixing session start times:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await fixSessionStartTimes();
  
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

module.exports = { fixSessionStartTimes };
