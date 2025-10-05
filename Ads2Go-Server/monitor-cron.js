const mongoose = require('mongoose');
const DeviceTracking = require('./src/models/deviceTracking');
const DeviceDataHistoryV2V2 = require('./src/models/deviceDataHistoryV2');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function monitorCron() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    console.log(`\n🕐 [${timeStr}] CRON MONITOR CHECK`);
    console.log('=' .repeat(50));

    // Check DeviceTracking records
    const deviceTrackingCount = await DeviceTracking.countDocuments();
    const onlineDevices = await DeviceTracking.countDocuments({ isOnline: true });
    console.log(`📋 DeviceTracking: ${deviceTrackingCount} total, ${onlineDevices} online`);

    // Check DeviceDataHistoryV2 records
    const deviceDataHistoryCount = await DeviceDataHistoryV2.countDocuments();
    console.log(`📚 DeviceDataHistoryV2: ${deviceDataHistoryCount} total`);

    // Check recent archives (last 10 minutes)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const recentArchives = await DeviceDataHistoryV2.find({
      archivedAt: { $gte: tenMinutesAgo }
    }).sort({ archivedAt: -1 });

    console.log(`🔄 Recent archives (last 10 min): ${recentArchives.length}`);
    
    if (recentArchives.length > 0) {
      console.log('📋 Recent archive details:');
      recentArchives.forEach((record, index) => {
        const archiveTime = record.archivedAt.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        console.log(`  ${index + 1}. MaterialId: ${record.materialId || 'undefined'}, ArchivedAt: ${archiveTime}, Slots: ${record.slots?.length || 0}`);
      });
    } else {
      console.log('⚠️  No recent archives found - cron job may not be running');
    }

    // Check for today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const todayDeviceDataHistoryV2 = await DeviceDataHistoryV2.countDocuments({ date: todayStr });
    console.log(`📅 Today's archives: ${todayDeviceDataHistoryV2}`);

    // Check material-level records
    const materialRecords = await DeviceDataHistoryV2.find({ 
      materialId: { $exists: true, $ne: null } 
    }).sort({ archivedAt: -1 }).limit(3);
    
    console.log(`🎯 Material-level records: ${materialRecords.length}`);
    if (materialRecords.length > 0) {
      materialRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.materialId} - ${record.totalAdPlays} ad plays, ${record.totalHoursOnline?.toFixed(2)} hours`);
      });
    }

    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Error during monitoring:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the monitor
monitorCron();
