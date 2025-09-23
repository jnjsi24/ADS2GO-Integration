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

// Fix device status inconsistency
const fixDeviceStatusInconsistency = async () => {
  try {
    console.log('\n🔧 Fixing device status inconsistency...\n');

    const device = await ScreenTracking.findOne({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    if (device) {
      console.log(`📱 ${device.materialId}:`);
      console.log(`  Root isOnline: ${device.isOnline}`);
      console.log(`  Last Seen: ${device.lastSeen}`);
      
      if (device.devices && device.devices.length > 0) {
        console.log(`  Devices Array (${device.devices.length} devices):`);
        
        for (let i = 0; i < device.devices.length; i++) {
          const d = device.devices[i];
          const timeSinceLastSeen = Date.now() - new Date(d.lastSeen).getTime();
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / (1000 * 60));
          
          console.log(`    Device ${i + 1}: ${d.deviceId}`);
          console.log(`      Current status: ${d.isOnline ? 'ONLINE' : 'OFFLINE'}`);
          console.log(`      Last seen: ${minutesSinceLastSeen} minutes ago`);
          
          // Fix inconsistent device status
          if (d.isOnline && minutesSinceLastSeen > 2) {
            console.log(`      🔧 Device should be offline (${minutesSinceLastSeen} minutes old), fixing...`);
            device.devices[i].isOnline = false;
          } else if (d.isOnline && minutesSinceLastSeen <= 2) {
            console.log(`      ✅ Device status is correct (recently active)`);
          } else {
            console.log(`      ✅ Device is already offline`);
          }
        }
        
        // Check if any device is actually online (within 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const hasOnlineDevice = device.devices.some(d => 
          d.isOnline && new Date(d.lastSeen) > twoMinutesAgo
        );
        
        console.log(`\n  Has online device: ${hasOnlineDevice}`);
        console.log(`  Root status should be: ${hasOnlineDevice ? 'ONLINE' : 'OFFLINE'}`);
        
        // Fix root status if it's inconsistent
        if (device.isOnline !== hasOnlineDevice) {
          console.log(`  🔧 Fixing root status: ${device.isOnline} -> ${hasOnlineDevice}`);
          device.isOnline = hasOnlineDevice;
        } else {
          console.log(`  ✅ Root status is correct`);
        }
        
        await device.save();
        console.log(`  ✅ Device status fixed`);
      }
    }

    // Clear all alerts from offline devices
    console.log('\n🧹 Clearing alerts from offline devices...');
    await ScreenTracking.updateMany(
      { isOnline: false },
      { $set: { alerts: [] } }
    );
    console.log('✅ Alerts cleared from offline devices');

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

    console.log('\n✅ Device status inconsistency fixed!');
    console.log('\n💡 Alerts will now only be generated for actually online devices.');

  } catch (error) {
    console.error('❌ Error fixing device status inconsistency:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await fixDeviceStatusInconsistency();
  
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

module.exports = { fixDeviceStatusInconsistency };
