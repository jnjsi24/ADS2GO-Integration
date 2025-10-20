const express = require('express');
const router = express.Router();
const UserNotifications = require('../models/Notification');

// Clean up problematic notifications
router.post('/cleanup', async (req, res) => {
  try {
    console.log('🧹 Starting notification cleanup...');
    
    // Find all user notifications
    const allNotifications = await UserNotifications.find({});
    console.log(`Found ${allNotifications.length} user notification records`);
    
    let totalDeleted = 0;
    let usersProcessed = 0;
    
    for (const userNotification of allNotifications) {
      const originalCount = userNotification.notifications.length;
      
      // Filter out problematic notifications (only device-specific ones)
      const cleanNotifications = userNotification.notifications.filter(notification => {
        // Keep all non-device notifications (general admin notifications)
        if (!['DEVICE_OFFLINE', 'DEVICE_ONLINE', 'DEVICE_MILESTONE', 'MATERIAL_PERFORMANCE', 'DEVICE_STATUS_CHANGE'].includes(notification.category)) {
          return true;
        }
        
        // For device-specific notifications, filter out problematic ones
        if (notification.category === 'DEVICE_MILESTONE' || 
            notification.category === 'DEVICE_OFFLINE' || 
            notification.category === 'DEVICE_ONLINE') {
          
          // Remove notifications with undefined deviceId or materialId
          if (!notification.data?.deviceId || 
              !notification.data?.materialId || 
              notification.data.deviceId === 'undefined' ||
              notification.data.materialId === 'undefined') {
            console.log(`❌ Removing notification with undefined data: ${notification.message}`);
            return false;
          }
          
          // Remove notifications with "Unknown Driver"
          if (notification.data?.driverName === 'Unknown Driver' || 
              notification.data?.driverId === 'N/A') {
            console.log(`❌ Removing notification with unknown driver: ${notification.message}`);
            return false;
          }
          
          // Remove notifications with technical device IDs in the message (should use materialId instead)
          if (notification.message && notification.message.includes('TABLET-')) {
            console.log(`❌ Removing notification with technical device ID: ${notification.message}`);
            return false;
          }
          
          // Keep valid device notifications
          return true;
        }
        
        // Keep all other notifications
        return true;
      });
      
      const deletedCount = originalCount - cleanNotifications.length;
      totalDeleted += deletedCount;
      usersProcessed++;
      
      if (deletedCount > 0) {
        console.log(`User ${userNotification.userId}: Removed ${deletedCount} problematic notifications (${originalCount} -> ${cleanNotifications.length})`);
        
        // Update the user's notifications
        userNotification.notifications = cleanNotifications;
        userNotification.unreadCount = cleanNotifications.filter(n => !n.read).length;
        
        await userNotification.save();
      }
    }
    
    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Users processed: ${usersProcessed}`);
    console.log(`📊 Total problematic notifications removed: ${totalDeleted}`);
    
    // Show remaining notifications by category
    const remainingNotifications = await UserNotifications.find({});
    const categoryCounts = {};
    
    remainingNotifications.forEach(userNotification => {
      userNotification.notifications.forEach(notification => {
        categoryCounts[notification.category] = (categoryCounts[notification.category] || 0) + 1;
      });
    });
    
    console.log(`\n📈 Remaining notifications by category:`);
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    
    res.json({
      success: true,
      message: 'Notification cleanup completed',
      usersProcessed,
      totalDeleted,
      categoryCounts
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Error during cleanup',
      error: error.message
    });
  }
});

// Get notification stats
router.get('/stats', async (req, res) => {
  try {
    const allNotifications = await UserNotifications.find({});
    
    let totalNotifications = 0;
    let deviceNotifications = 0;
    let problematicNotifications = 0;
    
    for (const userNotification of allNotifications) {
      totalNotifications += userNotification.notifications.length;
      
      userNotification.notifications.forEach(notification => {
        if (['DEVICE_OFFLINE', 'DEVICE_ONLINE', 'DEVICE_MILESTONE', 'MATERIAL_PERFORMANCE', 'DEVICE_STATUS_CHANGE'].includes(notification.category)) {
          deviceNotifications++;
          
          // Check if it's problematic
          if (!notification.data?.deviceId || 
              !notification.data?.materialId || 
              notification.data.deviceId === 'undefined' ||
              notification.data.materialId === 'undefined' ||
              notification.data?.driverName === 'Unknown Driver' ||
              notification.data?.driverId === 'N/A' ||
              (notification.message && notification.message.includes('TABLET-'))) {
            problematicNotifications++;
          }
        }
      });
    }
    
    res.json({
      success: true,
      stats: {
        totalNotifications,
        deviceNotifications,
        problematicNotifications,
        cleanNotifications: deviceNotifications - problematicNotifications
      }
    });
    
  } catch (error) {
    console.error('❌ Stats failed:', error);
    res.status(500).json({
      success: false,
      message: 'Stats failed',
      error: error.message
    });
  }
});

module.exports = router;
