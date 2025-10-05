const mongoose = require('mongoose');
const DeviceTracking = require('../src/models/deviceTracking');
const DeviceDataHistory = require('../src/models/deviceDataHistory');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

// Configuration for location history limits
const LOCATION_LIMITS = {
  DEVICE_TRACKING: 960,    // Real-time data (was 200) - 8 hours at 30s intervals
  DEVICE_DATA_HISTORY: 960, // Archived data (was 240) - 8 hours at 30s intervals
  AD_PLAYBACKS: 800,       // Ad playbacks (was 50) - 8 hours × 160 plays × 5 ads
  QR_SCANS: 'No limit',    // QR scans (no limit - matches DeviceTracking)
  LOCATION_HISTORY_ARCHIVE: 960 // Location history in archives (was 240)
};

async function updateLocationLimits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    console.log('📊 Previous location history limits:');
    console.log(`   DeviceTracking: 200 entries`);
    console.log(`   DeviceDataHistory: 50 entries`);
    console.log(`   AdPlaybacks: 20 entries`);
    
    console.log('\n🔧 New limits (IMPLEMENTED):');
    console.log(`   DeviceTracking: ${LOCATION_LIMITS.DEVICE_TRACKING} entries (8 hours at 30s intervals)`);
    console.log(`   DeviceDataHistory: ${LOCATION_LIMITS.DEVICE_DATA_HISTORY} entries (8 hours at 30s intervals)`);
    console.log(`   AdPlaybacks: ${LOCATION_LIMITS.AD_PLAYBACKS} entries (8 hours × 160 plays × 5 ads)`);
    console.log(`   QRScans: ${LOCATION_LIMITS.QR_SCANS} entries`);
    
    // Check current data sizes
    const deviceTrackingStats = await DeviceTracking.aggregate([
      {
        $project: {
          materialId: 1,
          locationHistoryCount: { $size: { $ifNull: ['$locationHistory', []] } },
          adPlaybacksCount: { $size: { $ifNull: ['$adPlaybacks', []] } },
          qrScansCount: { $size: { $ifNull: ['$qrScans', []] } }
        }
      },
      {
        $group: {
          _id: null,
          avgLocationHistory: { $avg: '$locationHistoryCount' },
          maxLocationHistory: { $max: '$locationHistoryCount' },
          avgAdPlaybacks: { $avg: '$adPlaybacksCount' },
          maxAdPlaybacks: { $max: '$adPlaybacksCount' },
          avgQrScans: { $avg: '$qrScansCount' },
          maxQrScans: { $max: '$qrScansCount' }
        }
      }
    ]);
    
    if (deviceTrackingStats.length > 0) {
      const stats = deviceTrackingStats[0];
      console.log('\n📈 Current data statistics:');
      console.log(`   Location History - Avg: ${stats.avgLocationHistory?.toFixed(1)}, Max: ${stats.maxLocationHistory}`);
      console.log(`   Ad Playbacks - Avg: ${stats.avgAdPlaybacks?.toFixed(1)}, Max: ${stats.maxAdPlaybacks}`);
      console.log(`   QR Scans - Avg: ${stats.avgQrScans?.toFixed(1)}, Max: ${stats.maxQrScans}`);
    }
    
    // Show impact analysis
    console.log('\n💾 Storage impact analysis:');
    console.log(`   Previous max storage per device: ~${(200 * 0.5 + 20 * 0.3 + 5 * 0.2).toFixed(1)}KB`);
    console.log(`   New max storage per device: ~${(LOCATION_LIMITS.DEVICE_TRACKING * 0.5 + LOCATION_LIMITS.AD_PLAYBACKS * 0.3 + LOCATION_LIMITS.QR_SCANS * 0.2).toFixed(1)}KB`);
    console.log(`   Storage increase: ~${((LOCATION_LIMITS.DEVICE_TRACKING * 0.5 + LOCATION_LIMITS.AD_PLAYBACKS * 0.3 + LOCATION_LIMITS.QR_SCANS * 0.2) / (200 * 0.5 + 20 * 0.3 + 5 * 0.2)).toFixed(1)}x`);
    
    console.log('\n⚠️  Note: To implement these changes, you need to:');
    console.log('   1. Update the $slice values in deviceTracking.js');
    console.log('   2. Update the slice() values in dailyArchiveJob.js');
    console.log('   3. Restart the server for changes to take effect');
    console.log('   4. Existing data will be trimmed on next update');
    
  } catch (error) {
    console.error('❌ Error analyzing location limits:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

updateLocationLimits();
