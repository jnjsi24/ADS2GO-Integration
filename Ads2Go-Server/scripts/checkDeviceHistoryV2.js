/**
 * Check DeviceDataHistoryV2 Script
 * 
 * This script checks what data exists in DeviceDataHistoryV2 collection
 * and whether it should be populating userAnalytics dailyStats.
 * 
 * Usage:
 *   node scripts/checkDeviceHistoryV2.js              # Check all users
 *   node scripts/checkDeviceHistoryV2.js --userId=xxx # Check specific user
 */

const path = require('path');
const fs = require('fs');

// Load .env file
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const mongoose = require('mongoose');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const UserAnalytics = require('../src/models/userAnalytics');
const User = require('../src/models/User');
const Ad = require('../src/models/Ad');
const Material = require('../src/models/Material');

// Color logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkDeviceHistoryV2(userId = null) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      log('❌ MONGODB_URI not found in environment variables', 'red');
      process.exit(1);
    }

    log('🔌 Connecting to MongoDB...', 'cyan');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log('✅ Connected to MongoDB\n', 'green');

    // Get users to check
    let users;
    if (userId) {
      users = await User.find({ _id: userId }).select('_id firstName lastName');
      if (users.length === 0) {
        log(`❌ User not found: ${userId}`, 'red');
        process.exit(1);
      }
    } else {
      // Get users with empty dailyStats
      const userAnalyticsWithEmptyStats = await UserAnalytics.find({
        $or: [
          { dailyStats: { $exists: false } },
          { dailyStats: { $size: 0 } },
          { dailyStats: null }
        ]
      }).select('userId').lean();

      const userIds = userAnalyticsWithEmptyStats.map(ua => ua.userId);
      
      if (userIds.length === 0) {
        log('✅ No users found with empty dailyStats.', 'green');
        process.exit(0);
      }

      users = await User.find({ _id: { $in: userIds } }).select('_id firstName lastName');
      log(`📊 Checking ${users.length} user(s) with empty dailyStats\n`, 'blue');
    }

    for (const user of users) {
      log(`\n${'='.repeat(80)}`, 'bright');
      log(`👤 User: ${user.firstName} ${user.lastName} (${user._id})`, 'bright');
      log('='.repeat(80), 'bright');

      // 1. Check if user has ads
      const userAds = await Ad.find({ userId: user._id }).select('_id title materialId targetDevices paymentStatus adStatus status');
      log(`\n📢 Ads: ${userAds.length}`, userAds.length > 0 ? 'green' : 'yellow');
      
      if (userAds.length > 0) {
        userAds.forEach((ad, idx) => {
          log(`   ${idx + 1}. ${ad.title} (${ad._id})`, 'cyan');
          log(`      Status: ${ad.status || 'N/A'}, Payment: ${ad.paymentStatus || 'N/A'}, AdStatus: ${ad.adStatus || 'N/A'}`, 'cyan');
          log(`      MaterialId: ${ad.materialId?.length || 0}, TargetDevices: ${ad.targetDevices?.length || 0}`, 'cyan');
        });
      } else {
        log('   ⚠️  No ads found for this user', 'yellow');
      }

      // 2. Get materialIds for user's ads
      const allMaterialRefs = [];
      for (const ad of userAds) {
        if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
          allMaterialRefs.push(...ad.materialId);
        }
        if (ad.targetDevices && Array.isArray(ad.targetDevices) && ad.targetDevices.length > 0) {
          allMaterialRefs.push(...ad.targetDevices);
        }
      }
      const uniqueMaterialRefs = [...new Set(allMaterialRefs.map(ref => ref.toString()))];
      
      let materialIds = [];
      if (uniqueMaterialRefs.length > 0) {
        const materials = await Material.find({ 
          _id: { $in: uniqueMaterialRefs.map(id => new mongoose.Types.ObjectId(id)) } 
        }).select('materialId').lean();
        materialIds = materials.map(m => m.materialId).filter(Boolean);
      }

      log(`\n📦 Materials: ${materialIds.length}`, materialIds.length > 0 ? 'green' : 'yellow');
      if (materialIds.length > 0) {
        materialIds.forEach((matId, idx) => {
          log(`   ${idx + 1}. ${matId}`, 'cyan');
        });
      }

      // 3. Check DeviceDataHistoryV2 for these materials
      log(`\n🔍 Checking DeviceDataHistoryV2 for ${materialIds.length} material(s)...`, 'cyan');
      
      if (materialIds.length === 0) {
        log('   ⚠️  No materials to check', 'yellow');
        continue;
      }

      const historyRecords = await DeviceDataHistoryV2.find({
        materialId: { $in: materialIds }
      }).select('materialId carGroupId dailyData').lean();

      log(`   📊 Found ${historyRecords.length} history record(s)`, historyRecords.length > 0 ? 'green' : 'yellow');

      if (historyRecords.length > 0) {
        let totalDailyEntries = 0;
        let totalAdPlaybacks = 0;
        let totalQRScans = 0;
        const datesWithData = new Set();
        const datesByMaterial = {};

        historyRecords.forEach(record => {
          const matId = record.materialId;
          if (!datesByMaterial[matId]) {
            datesByMaterial[matId] = {
              dailyEntries: 0,
              adPlaybacks: 0,
              qrScans: 0,
              dates: []
            };
          }

          if (record.dailyData && Array.isArray(record.dailyData)) {
            record.dailyData.forEach(daily => {
              totalDailyEntries++;
              datesByMaterial[matId].dailyEntries++;
              
              const dateStr = daily.date ? new Date(daily.date).toISOString().split('T')[0] : 'unknown';
              datesWithData.add(dateStr);
              datesByMaterial[matId].dates.push(dateStr);

              // Count ad playbacks
              if (daily.adPlaybacks && Array.isArray(daily.adPlaybacks)) {
                const playbacks = daily.adPlaybacks.filter(pb => {
                  // Check if playback belongs to user's ads
                  const pbAdId = pb.adId?.toString ? pb.adId.toString() : String(pb.adId);
                  return userAds.some(ad => ad._id.toString() === pbAdId);
                });
                totalAdPlaybacks += playbacks.length;
                datesByMaterial[matId].adPlaybacks += playbacks.length;
              }

              // Count QR scans
              if (daily.qrScans && Array.isArray(daily.qrScans)) {
                const scans = daily.qrScans.filter(qr => {
                  // Check if QR scan belongs to user's ads
                  const qrAdId = qr.adId?.toString ? qr.adId.toString() : String(qr.adId);
                  return userAds.some(ad => ad._id.toString() === qrAdId);
                });
                totalQRScans += scans.length;
                datesByMaterial[matId].qrScans += scans.length;
              }
            });
          }
        });

        log(`\n📈 Summary:`, 'bright');
        log(`   Total daily entries: ${totalDailyEntries}`, 'cyan');
        log(`   Total ad playbacks (user's ads): ${totalAdPlaybacks}`, totalAdPlaybacks > 0 ? 'green' : 'yellow');
        log(`   Total QR scans (user's ads): ${totalQRScans}`, totalQRScans > 0 ? 'green' : 'yellow');
        log(`   Unique dates with data: ${datesWithData.size}`, 'cyan');
        
        if (datesWithData.size > 0) {
          const sortedDates = Array.from(datesWithData).sort();
          log(`   Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`, 'cyan');
        }

        log(`\n📦 By Material:`, 'bright');
        Object.keys(datesByMaterial).forEach(matId => {
          const stats = datesByMaterial[matId];
          log(`   ${matId}:`, 'cyan');
          log(`      Daily entries: ${stats.dailyEntries}`, 'cyan');
          log(`      Ad playbacks: ${stats.adPlaybacks}`, stats.adPlaybacks > 0 ? 'green' : 'yellow');
          log(`      QR scans: ${stats.qrScans}`, stats.qrScans > 0 ? 'green' : 'yellow');
          log(`      Dates: ${stats.dates.length} unique dates`, 'cyan');
        });

        // 4. Check UserAnalytics dailyStats
        const userAnalytics = await UserAnalytics.findOne({ userId: user._id }).select('dailyStats').lean();
        const dailyStatsCount = userAnalytics?.dailyStats?.length || 0;
        
        log(`\n📊 UserAnalytics dailyStats:`, 'bright');
        log(`   Entries: ${dailyStatsCount}`, dailyStatsCount > 0 ? 'green' : 'red');
        
        if (totalAdPlaybacks > 0 || totalQRScans > 0) {
          if (dailyStatsCount === 0) {
            log(`   ⚠️  ISSUE: There IS data in DeviceDataHistoryV2 but dailyStats is empty!`, 'red');
            log(`   💡 This means the sync should populate dailyStats but didn't.`, 'yellow');
          } else {
            log(`   ✅ dailyStats has ${dailyStatsCount} entries`, 'green');
          }
        } else {
          log(`   ℹ️  No ad playbacks or QR scans found for user's ads`, 'yellow');
          log(`   💡 dailyStats will populate once there's playback/scan data`, 'yellow');
        }
      } else {
        log('   ⚠️  No history records found in DeviceDataHistoryV2', 'yellow');
      }
    }

    log(`\n${'='.repeat(80)}`, 'bright');
    log('✅ Check completed!', 'green');

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log('\n🔌 Disconnected from MongoDB', 'cyan');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let targetUserId = null;

args.forEach(arg => {
  if (arg.startsWith('--userId=')) {
    targetUserId = arg.split('=')[1];
  }
});

// Run check
checkDeviceHistoryV2(targetUserId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

