/**
 * Fix offline devices showing hours - reset isOnline and startTime
 * Run this once to fix the database from the old bug
 */

const mongoose = require('mongoose');
require('dotenv').config();

const DeviceTracking = require('../models/deviceTracking');

async function fixOfflineDeviceHours() {
  try {
    console.log('🔧 Fixing offline device hours...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all devices that are marked as online but shouldn't be
    const devices = await DeviceTracking.find({
      'currentSession.date': {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });
    
    console.log(`📊 Found ${devices.length} devices to check`);
    
    let fixedCount = 0;
    
    for (const device of devices) {
      let needsUpdate = false;
      
      // Check if device is actually offline (no recent activity)
      const now = new Date();
      const lastSeen = new Date(device.lastSeen);
      const minutesSinceLastSeen = (now - lastSeen) / (1000 * 60);
      
      // If device hasn't been seen in more than 5 minutes but is marked online
      if (minutesSinceLastSeen > 5 && device.isOnline) {
        console.log(`\n🔍 ${device.materialId}:`);
        console.log(`   Last Seen: ${minutesSinceLastSeen.toFixed(0)} minutes ago`);
        console.log(`   isOnline: ${device.isOnline} (should be false)`);
        console.log(`   startTime: ${device.currentSession?.startTime}`);
        
        // Reset to offline
        device.isOnline = false;
        
        // Reset all slots to offline
        if (device.slots) {
          device.slots.forEach(slot => {
            slot.isOnline = false;
          });
        }
        
        needsUpdate = true;
      }
      
      // If startTime is set but device is offline, clear it
      if (!device.isOnline && device.currentSession?.startTime) {
        console.log(`   Clearing startTime (device is offline)`);
        device.currentSession.startTime = null;
        device.currentSession.lastOnlineUpdate = null;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await device.save();
        fixedCount++;
        console.log(`   ✅ Fixed`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} devices`);
    console.log('🎉 Database cleanup complete!');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOfflineDeviceHours();

