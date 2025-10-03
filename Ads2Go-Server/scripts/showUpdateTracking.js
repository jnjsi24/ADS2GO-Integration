const mongoose = require('mongoose');
const DeviceDataHistory = require('../src/models/deviceDataHistory');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function showUpdateTracking() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    // Get the specific record you mentioned
    const record = await DeviceDataHistory.findById('68dfbac07b0082330f474bde');
    
    if (!record) {
      console.log('❌ Record not found');
      return;
    }
    
    console.log('\n📊 UPDATE TRACKING FOR RECORD:', record._id);
    console.log('=' .repeat(60));
    
    // 1. Mongoose automatic timestamps
    console.log('\n🕐 MONGOOSE AUTOMATIC TIMESTAMPS:');
    console.log(`   createdAt: ${record.createdAt}`);
    console.log(`   updatedAt: ${record.updatedAt}`);
    
    // 2. Archive-specific timestamps
    console.log('\n📦 ARCHIVE-SPECIFIC TIMESTAMPS:');
    console.log(`   archivedAt: ${record.archivedAt}`);
    
    // 3. Enhanced tracking timestamps (new)
    console.log('\n🔍 ENHANCED TRACKING TIMESTAMPS:');
    console.log(`   lastDataUpdate: ${record.lastDataUpdate || 'Not set'}`);
    console.log(`   lastArchiveUpdate: ${record.lastArchiveUpdate || 'Not set'}`);
    console.log(`   updateCount: ${record.updateCount || 'Not set'}`);
    console.log(`   lastUpdateSource: ${record.lastUpdateSource || 'Not set'}`);
    console.log(`   lastUpdateType: ${record.lastUpdateType || 'Not set'}`);
    
    // 4. Device-specific timestamps
    console.log('\n📱 DEVICE-SPECIFIC TIMESTAMPS:');
    console.log(`   lastSeen: ${record.lastSeen || 'Not set'}`);
    if (record.networkStatus) {
      console.log(`   networkStatus.lastSeen: ${record.networkStatus.lastSeen || 'Not set'}`);
    }
    
    // 5. Hours tracking timestamps
    if (record.hoursTracking) {
      console.log('\n⏰ HOURS TRACKING TIMESTAMPS:');
      console.log(`   sessionStartTime: ${record.hoursTracking.sessionStartTime || 'Not set'}`);
      console.log(`   sessionEndTime: ${record.hoursTracking.sessionEndTime || 'Not set'}`);
      console.log(`   lastOnlineUpdate: ${record.hoursTracking.lastOnlineUpdate || 'Not set'}`);
    }
    
    // 6. Recent activity timestamps
    console.log('\n📈 RECENT ACTIVITY TIMESTAMPS:');
    if (record.adPlaybacks && record.adPlaybacks.length > 0) {
      const latestPlayback = record.adPlaybacks[record.adPlaybacks.length - 1];
      console.log(`   Latest Ad Playback: ${latestPlayback.startTime}`);
    }
    if (record.qrScans && record.qrScans.length > 0) {
      const latestQrScan = record.qrScans[record.qrScans.length - 1];
      console.log(`   Latest QR Scan: ${latestQrScan.scanTimestamp}`);
    }
    if (record.locationHistory && record.locationHistory.length > 0) {
      const latestLocation = record.locationHistory[record.locationHistory.length - 1];
      console.log(`   Latest Location: ${latestLocation.timestamp}`);
    }
    
    // 7. Summary of most recent activity
    console.log('\n📋 SUMMARY - MOST RECENT ACTIVITY:');
    const timestamps = [
      { name: 'Mongoose updatedAt', time: record.updatedAt },
      { name: 'Archive archivedAt', time: record.archivedAt },
      { name: 'Last Data Update', time: record.lastDataUpdate },
      { name: 'Last Archive Update', time: record.lastArchiveUpdate },
      { name: 'Device Last Seen', time: record.lastSeen },
      { name: 'Network Last Seen', time: record.networkStatus?.lastSeen }
    ].filter(t => t.time);
    
    timestamps.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    console.log('   Most recent to oldest:');
    timestamps.forEach((t, index) => {
      console.log(`   ${index + 1}. ${t.name}: ${t.time}`);
    });
    
    // 8. Time since last update
    const mostRecent = new Date(timestamps[0].time);
    const now = new Date();
    const timeDiff = now - mostRecent;
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    
    console.log(`\n⏱️  TIME SINCE LAST UPDATE:`);
    if (minutesAgo < 60) {
      console.log(`   ${minutesAgo} minutes ago`);
    } else {
      console.log(`   ${hoursAgo} hours ago`);
    }
    
  } catch (error) {
    console.error('❌ Error showing update tracking:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

showUpdateTracking();
