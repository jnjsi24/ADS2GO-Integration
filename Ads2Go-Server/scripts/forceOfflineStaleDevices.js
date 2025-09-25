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

// Force offline stale devices
const forceOfflineStaleDevices = async () => {
  try {
    console.log('\n🔧 Forcing offline stale devices...\n');

    // Find DGL-HEADDRESS-CAR-001 specifically
    const device = await ScreenTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    if (device) {
      console.log(`📱 ${device.materialId} - Current Status:`);
      console.log(`  Root isOnline: ${device.isOnline}`);
      console.log(`  Last Seen: ${device.lastSeen}`);
      
      if (device.devices && device.devices.length > 0) {
        console.log(`  Devices Array: ${device.devices.length} devices`);
        
        device.devices.forEach((d, i) => {
          const timeSinceLastSeen = Date.now() - new Date(d.lastSeen).getTime();
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          console.log(`    Device ${i + 1}: ${d.deviceId} - ${d.isOnline ? 'ONLINE' : 'OFFLINE'} (last seen: ${minutesSinceLastSeen} minutes ago)`);
        });
        
        // Force all devices in DGL-HEADDRESS-CAR-001 to offline
        console.log(`\n🔧 Forcing all devices in ${device.materialId} to OFFLINE...`);
        device.devices.forEach((d, i) => {
          if (d.isOnline) {
            console.log(`    Device ${i + 1}: ${d.deviceId} -> OFFLINE`);
            d.isOnline = false;
          }
        });
        
        // Update root status to offline
        device.isOnline = false;
        device.lastSeen = new Date(Date.now() - 10 * 60 * 1000); // Set last seen to 10 minutes ago
        
        await device.save();
        console.log(`  ✅ ${device.materialId} forced to OFFLINE`);
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

    console.log('\n✅ Stale devices forced offline!');
    console.log('\n💡 Now only DGL-HEADDRESS-CAR-003 should show as ACTIVE (your real Android player).');

  } catch (error) {
    console.error('❌ Error forcing offline stale devices:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await forceOfflineStaleDevices();
  
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

module.exports = { forceOfflineStaleDevices };
