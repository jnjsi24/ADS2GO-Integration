/**
 * Check Ad Playbacks Script
 * 
 * This script checks the actual adPlaybacks in DeviceDataHistoryV2
 * to see why they're not being matched to user's ads.
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
const Ad = require('../src/models/Ad');

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

async function checkAdPlaybacks() {
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

    // Check specific materials mentioned
    const materials = ['DGL-HEADDRESS-CAR-001', 'DGL-HEADDRESS-CAR-002', 'DGL-HEADDRESS-CAR-003'];
    
    for (const materialId of materials) {
      log(`\n${'='.repeat(80)}`, 'bright');
      log(`📦 Material: ${materialId}`, 'bright');
      log('='.repeat(80), 'bright');

      const historyRecord = await DeviceDataHistoryV2.findOne({ materialId }).lean();
      
      if (!historyRecord) {
        log(`   ⚠️  No history record found`, 'yellow');
        continue;
      }

      log(`\n📊 History Record Found:`, 'green');
      log(`   Daily entries: ${historyRecord.dailyData?.length || 0}`, 'cyan');
      log(`   Lifetime totals - Ad Plays: ${historyRecord.lifetimeTotals?.totalAdPlays || 0}`, 'cyan');
      log(`   Lifetime totals - QR Scans: ${historyRecord.lifetimeTotals?.totalQRScans || 0}`, 'cyan');

      // Check each daily entry
      if (historyRecord.dailyData && historyRecord.dailyData.length > 0) {
        log(`\n📅 Daily Entries Analysis:`, 'bright');
        
        let totalPlaybacks = 0;
        const adIdsFound = new Set();
        const adIdsByDate = {};

        historyRecord.dailyData.forEach((daily, idx) => {
          const dateStr = daily.date ? new Date(daily.date).toISOString().split('T')[0] : 'unknown';
          
          if (daily.adPlaybacks && Array.isArray(daily.adPlaybacks)) {
            totalPlaybacks += daily.adPlaybacks.length;
            
            if (!adIdsByDate[dateStr]) {
              adIdsByDate[dateStr] = {
                playbacks: 0,
                adIds: new Set(),
                samplePlaybacks: []
              };
            }
            
            adIdsByDate[dateStr].playbacks += daily.adPlaybacks.length;
            
            // Check first few playbacks to see their structure
            daily.adPlaybacks.slice(0, 5).forEach((playback, pbIdx) => {
              if (pbIdx < 3) {
                adIdsByDate[dateStr].samplePlaybacks.push({
                  adId: playback.adId,
                  adIdType: typeof playback.adId,
                  adTitle: playback.adTitle,
                  viewTime: playback.viewTime,
                  impressions: playback.impressions
                });
              }
              
              if (playback.adId) {
                const adIdStr = playback.adId.toString ? playback.adId.toString() : String(playback.adId);
                adIdsFound.add(adIdStr);
                adIdsByDate[dateStr].adIds.add(adIdStr);
              }
            });
          }
        });

        log(`\n   Total ad playbacks: ${totalPlaybacks}`, 'cyan');
        log(`   Unique ad IDs found: ${adIdsFound.size}`, 'cyan');
        
        if (adIdsFound.size > 0) {
          log(`\n   Ad IDs in playbacks:`, 'cyan');
          Array.from(adIdsFound).forEach((adId, idx) => {
            log(`      ${idx + 1}. ${adId}`, 'cyan');
          });

          // Check if these ad IDs belong to any user
          log(`\n   Checking ad ownership...`, 'cyan');
          const adIdArray = Array.from(adIdsFound);
          const ads = await Ad.find({
            _id: { $in: adIdArray.map(id => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            }).filter(Boolean) }
          }).select('_id title userId paymentStatus adStatus status').lean();

          log(`   Found ${ads.length} matching ad(s) in database:`, ads.length > 0 ? 'green' : 'yellow');
          ads.forEach(ad => {
            log(`      - ${ad.title} (${ad._id})`, 'cyan');
            log(`        User: ${ad.userId}`, 'cyan');
            log(`        Status: ${ad.status}, Payment: ${ad.paymentStatus}`, 'cyan');
          });

          // Also check by string comparison
          const adsByString = await Ad.find({
            $or: adIdArray.map(id => ({
              _id: id
            }))
          }).select('_id title userId').lean();
          
          if (adsByString.length !== ads.length) {
            log(`   ⚠️  String match found ${adsByString.length} ads (different from ObjectId match)`, 'yellow');
          }
        }

        // Show sample by date
        log(`\n   📅 Playbacks by Date:`, 'bright');
        Object.keys(adIdsByDate).sort().forEach(dateStr => {
          const data = adIdsByDate[dateStr];
          log(`      ${dateStr}:`, 'cyan');
          log(`         Playbacks: ${data.playbacks}`, 'cyan');
          log(`         Unique Ad IDs: ${data.adIds.size}`, 'cyan');
          
          if (data.samplePlaybacks.length > 0) {
            log(`         Sample playbacks:`, 'cyan');
            data.samplePlaybacks.forEach((sample, idx) => {
              log(`            ${idx + 1}. AdId: ${sample.adId} (${sample.adIdType}), Title: ${sample.adTitle || 'N/A'}`, 'cyan');
            });
          }
        });
      }

      // Check adPerformance array
      if (historyRecord.dailyData && historyRecord.dailyData.length > 0) {
        log(`\n📊 Ad Performance Analysis:`, 'bright');
        const adPerformanceByDate = {};
        
        historyRecord.dailyData.forEach(daily => {
          const dateStr = daily.date ? new Date(daily.date).toISOString().split('T')[0] : 'unknown';
          
          if (daily.adPerformance && Array.isArray(daily.adPerformance)) {
            if (!adPerformanceByDate[dateStr]) {
              adPerformanceByDate[dateStr] = [];
            }
            
            daily.adPerformance.forEach(perf => {
              adPerformanceByDate[dateStr].push({
                adId: perf.adId,
                adIdType: typeof perf.adId,
                userId: perf.userId,
                impressions: perf.impressions,
                playCount: perf.playCount
              });
            });
          }
        });

        const datesWithPerf = Object.keys(adPerformanceByDate);
        log(`   Dates with adPerformance: ${datesWithPerf.length}`, 'cyan');
        
        if (datesWithPerf.length > 0) {
          datesWithPerf.slice(0, 3).forEach(dateStr => {
            log(`      ${dateStr}:`, 'cyan');
            adPerformanceByDate[dateStr].forEach((perf, idx) => {
              if (idx < 3) {
                log(`         ${idx + 1}. AdId: ${perf.adId} (${perf.adIdType}), UserId: ${perf.userId}, Plays: ${perf.playCount}`, 'cyan');
              }
            });
          });
        }
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

// Run check
checkAdPlaybacks()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

