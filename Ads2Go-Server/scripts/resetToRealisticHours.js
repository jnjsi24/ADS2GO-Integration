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

// Reset to realistic hours based on actual device activity
const resetToRealisticHours = async () => {
  try {
    console.log('\n⏰ Resetting to realistic hours based on actual device activity...\n');

    const allDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    for (const device of allDevices) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Current status: ${device.isOnline ? 'ACTIVE' : 'OFFLINE'}`);
      console.log(`  Last seen: ${device.lastSeen}`);
      
      // Calculate realistic hours based on actual activity
      let realisticHours = 0;
      let realisticStartTime;
      
      if (device.isOnline) {
        // Device is currently online, use current session start time
        realisticStartTime = device.currentSession?.startTime || new Date();
        const sessionStart = new Date(realisticStartTime);
        const now = new Date();
        const totalTimeMs = now - sessionStart;
        realisticHours = totalTimeMs / (1000 * 60 * 60);
        console.log(`  ✅ Device is online, calculating from session start: ${realisticHours.toFixed(2)}h`);
      } else {
        // Device is offline, estimate based on last activity
        const lastSeen = new Date(device.lastSeen);
        const now = new Date();
        const timeSinceLastSeen = now - lastSeen;
        const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
        
        if (minutesSinceLastSeen < 60) {
          // Recently offline, assume it was active for a short time
          realisticHours = Math.min(0.5, minutesSinceLastSeen / 60);
          realisticStartTime = new Date(lastSeen.getTime() - (realisticHours * 60 * 60 * 1000));
          console.log(`  🔧 Recently offline (${minutesSinceLastSeen}m ago), estimating ${realisticHours.toFixed(2)}h active time`);
        } else {
          // Been offline for a while, minimal hours
          realisticHours = 0.1; // Just 6 minutes
          realisticStartTime = new Date(lastSeen.getTime() - (6 * 60 * 1000));
          console.log(`  🔧 Been offline for ${minutesSinceLastSeen}m, setting minimal hours: ${realisticHours.toFixed(2)}h`);
        }
      }
      
      // Update the session with realistic data
      await ScreenTracking.updateOne(
        { _id: device._id },
        { 
          $set: { 
            'currentSession.startTime': realisticStartTime,
            'currentSession.totalHoursOnline': realisticHours,
            'currentSession.totalDistanceTraveled': 0, // Reset distance
            'currentSession.locationHistory': [], // Clear location history
            'totalDistanceTraveled': 0
          }
        }
      );
      
      console.log(`  ✅ Updated with realistic hours: ${realisticHours.toFixed(2)}h`);
    }

    // Show final realistic status
    console.log('\n📊 Final Realistic Status:');
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

    console.log('\n✅ Realistic hours reset completed!');
    console.log('\n💡 Hours now reflect actual device activity:');
    console.log('  - Online devices: Hours calculated from session start');
    console.log('  - Recently offline devices: Estimated based on last activity');
    console.log('  - Long offline devices: Minimal hours (0.1h)');

  } catch (error) {
    console.error('❌ Error resetting to realistic hours:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await resetToRealisticHours();
  
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

module.exports = { resetToRealisticHours };
