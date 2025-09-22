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

// Reset all sessions to start fresh
const resetAllSessions = async () => {
  try {
    console.log('\n🔄 Resetting all device sessions...\n');

    // Get all active devices
    const allDevices = await ScreenTracking.find({ isActive: true });
    
    console.log(`Found ${allDevices.length} active devices to reset:`);
    
    let resetCount = 0;
    for (const device of allDevices) {
      console.log(`  - ${device.materialId} (${device.deviceId}): Current session started ${device.currentSession?.startTime}`);
      
      // End current session if it exists
      if (device.currentSession && device.currentSession.isActive) {
        await device.endDailySession();
      }
      
      // Start a fresh session
      await device.startDailySession();
      
      // Reset status to offline (will be updated when device connects)
      device.isOnline = false;
      device.lastSeen = new Date();
      device.currentLocation = null;
      
      // Reset any accumulated data
      if (device.currentSession) {
        device.currentSession.totalDistanceTraveled = 0;
        device.currentSession.locationHistory = [];
      }
      
      await device.save();
      
      resetCount++;
      console.log(`    ✅ Reset session for ${device.materialId}`);
    }
    
    console.log(`\n✅ Reset ${resetCount} device sessions`);

    // Show current status
    console.log('\n📱 Current Device Status (All Fresh Sessions):');
    const activeDevices = await ScreenTracking.find({ isActive: true }).sort({ materialId: 1 });
    
    if (activeDevices.length === 0) {
      console.log('  No active devices found');
    } else {
      activeDevices.forEach(device => {
        const hours = device.currentHoursToday;
        const distance = device.currentSession?.totalDistanceTraveled || 0;
        const status = device.isOnline ? '🟢 Online' : '🔴 Offline';
        const sessionStart = device.currentSession?.startTime;
        
        console.log(`  ${device.materialId}: ${status}, ${hours.toFixed(2)}h, ${distance.toFixed(2)}km`);
        console.log(`    Session started: ${sessionStart ? sessionStart.toLocaleString() : 'Not set'}`);
      });
    }

    console.log('\n✅ All sessions reset successfully!');
    console.log('\n💡 What happens next:');
    console.log('  - All devices now have fresh sessions starting from now');
    console.log('  - Hours will start counting from 0.00h');
    console.log('  - Distance will start accumulating from 0.00km');
    console.log('  - When your Android player connects, it will update its status');
    console.log('  - The dashboard will show real-time, accurate data');

  } catch (error) {
    console.error('❌ Error during session reset:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await resetAllSessions();
  
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

module.exports = { resetAllSessions };
