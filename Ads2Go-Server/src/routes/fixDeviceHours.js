/**
 * API endpoint to fix offline devices showing hours
 * GET /api/fixDeviceHours - Reset isOnline and startTime for offline devices
 */

const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');

/**
 * Fix offline devices that are incorrectly marked as online
 */
router.get('/', async (req, res) => {
  try {
    console.log('🔧 [FIX] Starting offline device hours fix...');
    
    // Find all devices
    const devices = await DeviceTracking.find({
      'currentSession.date': {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });
    
    console.log(`📊 [FIX] Found ${devices.length} devices to check`);
    
    const results = [];
    let fixedCount = 0;
    
    for (const device of devices) {
      let needsUpdate = false;
      const deviceInfo = {
        materialId: device.materialId,
        wasBroken: false,
        fixes: []
      };
      
      // Check if device is actually offline (no recent activity)
      const now = new Date();
      const lastSeen = new Date(device.lastSeen);
      const minutesSinceLastSeen = (now - lastSeen) / (1000 * 60);
      
      // If device hasn't been seen in more than 5 minutes but is marked online
      if (minutesSinceLastSeen > 5 && device.isOnline) {
        console.log(`\n🔍 [FIX] ${device.materialId}:`);
        console.log(`   Last Seen: ${minutesSinceLastSeen.toFixed(0)} minutes ago`);
        console.log(`   isOnline: ${device.isOnline} (should be false)`);
        
        deviceInfo.wasBroken = true;
        deviceInfo.minutesSinceLastSeen = Math.floor(minutesSinceLastSeen);
        
        // Reset to offline
        device.isOnline = false;
        deviceInfo.fixes.push('Set isOnline = false');
        
        // Reset all slots to offline
        if (device.slots) {
          device.slots.forEach(slot => {
            slot.isOnline = false;
          });
          deviceInfo.fixes.push('Reset all slots to offline');
        }
        
        needsUpdate = true;
      }
      
      // If device is offline, set startTime to sentinel value (far future)
      if (!device.isOnline && device.currentSession?.startTime) {
        const startTime = new Date(device.currentSession.startTime);
        const now = new Date();
        const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
        
        // If startTime is NOT already a sentinel value (not in far future)
        if (startTime < oneYearFromNow) {
          console.log(`   Setting startTime to sentinel value (device is offline)`);
          
          if (!deviceInfo.wasBroken) {
            deviceInfo.wasBroken = true;
          }
          
          const farFuture = new Date('2099-12-31T23:59:59Z');
          device.currentSession.startTime = farFuture;
          device.currentSession.lastOnlineUpdate = null;
          deviceInfo.fixes.push('Set startTime to sentinel value (far future)');
          
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await device.save();
        fixedCount++;
        console.log(`   ✅ [FIX] Fixed ${device.materialId}`);
        results.push(deviceInfo);
      }
    }
    
    console.log(`\n✅ [FIX] Fixed ${fixedCount} devices`);
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} offline devices`,
      fixedCount,
      results
    });
    
  } catch (error) {
    console.error('❌ [FIX] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing device hours',
      error: error.message
    });
  }
});

module.exports = router;

