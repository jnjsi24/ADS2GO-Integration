/**
 * Script to verify QR scan data directly from source collections
 * Checks DeviceDataHistoryV2 and DeviceTracking for accurate QR scan counts
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const DeviceTracking = require('../src/models/deviceTracking');
const Ad = require('../src/models/Ad');
const UserAnalytics = require('../src/models/userAnalytics');

async function verifyQRScans(userId) {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Get user's ads
    const userAds = await Ad.find({ userId: userId }).select('_id title materialId targetDevices').lean();
    const userAdIds = userAds.map(ad => ad._id.toString());
    
    console.log(`📊 User has ${userAds.length} ads:`);
    userAds.forEach(ad => {
      console.log(`   - ${ad.title} (${ad._id})`);
    });
    console.log('');

    // Get materialIds
    const Material = require('../src/models/Material');
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

    console.log(`📊 Found ${materialIds.length} materials: ${materialIds.join(', ')}\n`);

    // Check DeviceDataHistoryV2 for QR scans
    console.log('🔍 Checking DeviceDataHistoryV2 for QR scans...\n');
    
    const historyDevices = await DeviceDataHistoryV2.find({
      materialId: { $in: materialIds }
    }).lean();

    console.log(`📊 Found ${historyDevices.length} devices in DeviceDataHistoryV2\n`);

    // Aggregate QR scans by adId from DeviceDataHistoryV2
    const qrScansByAd = new Map();
    const qrScansByDateAndAd = new Map();

    historyDevices.forEach(device => {
      if (device.dailyData && Array.isArray(device.dailyData)) {
        device.dailyData.forEach(dailyData => {
          if (dailyData.qrScans && Array.isArray(dailyData.qrScans)) {
            dailyData.qrScans.forEach(qrScan => {
              const scanAdId = qrScan.adId?.toString();
              if (scanAdId && userAdIds.includes(scanAdId)) {
                // Count by adId
                if (!qrScansByAd.has(scanAdId)) {
                  qrScansByAd.set(scanAdId, {
                    adId: scanAdId,
                    adTitle: userAds.find(a => a._id.toString() === scanAdId)?.title || 'Unknown',
                    count: 0,
                    scans: []
                  });
                }
                const adStats = qrScansByAd.get(scanAdId);
                adStats.count += 1;
                adStats.scans.push({
                  materialId: device.materialId,
                  date: dailyData.date,
                  scanTimestamp: qrScan.scanTimestamp,
                  adTitle: qrScan.adTitle
                });

                // Count by date and adId
                const dateStr = dailyData.date instanceof Date 
                  ? dailyData.date.toISOString().split('T')[0] 
                  : (typeof dailyData.date === 'string' ? dailyData.date.split('T')[0] : 'unknown');
                const key = `${dateStr}_${scanAdId}`;
                if (!qrScansByDateAndAd.has(key)) {
                  qrScansByDateAndAd.set(key, {
                    date: dateStr,
                    adId: scanAdId,
                    adTitle: userAds.find(a => a._id.toString() === scanAdId)?.title || 'Unknown',
                    count: 0
                  });
                }
                qrScansByDateAndAd.get(key).count += 1;
              }
            });
          }
        });
      }
    });

    // Check DeviceTracking for current day QR scans
    console.log('🔍 Checking DeviceTracking for current day QR scans...\n');
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const trackingDevices = await DeviceTracking.find({
      materialId: { $in: materialIds },
      date: todayStr
    }).lean();

    console.log(`📊 Found ${trackingDevices.length} devices in DeviceTracking for today (${todayStr})\n`);

    trackingDevices.forEach(device => {
      if (device.qrScans && Array.isArray(device.qrScans)) {
        device.qrScans.forEach(qrScan => {
          const scanAdId = qrScan.adId?.toString();
          if (scanAdId && userAdIds.includes(scanAdId)) {
            // Count by adId
            if (!qrScansByAd.has(scanAdId)) {
              qrScansByAd.set(scanAdId, {
                adId: scanAdId,
                adTitle: userAds.find(a => a._id.toString() === scanAdId)?.title || 'Unknown',
                count: 0,
                scans: []
              });
            }
            const adStats = qrScansByAd.get(scanAdId);
            adStats.count += 1;
            adStats.scans.push({
              materialId: device.materialId,
              date: todayStr,
              scanTimestamp: qrScan.scanTimestamp,
              adTitle: qrScan.adTitle
            });

            // Count by date and adId
            const key = `${todayStr}_${scanAdId}`;
            if (!qrScansByDateAndAd.has(key)) {
              qrScansByDateAndAd.set(key, {
                date: todayStr,
                adId: scanAdId,
                adTitle: userAds.find(a => a._id.toString() === scanAdId)?.title || 'Unknown',
                count: 0
              });
            }
            qrScansByDateAndAd.get(key).count += 1;
          }
        });
      }
    });

    // Display results
    console.log('📊 QR Scans by Ad (from source data):');
    console.log('═'.repeat(80));
    let totalScans = 0;
    Array.from(qrScansByAd.values()).forEach(adStats => {
      console.log(`\n${adStats.adTitle} (${adStats.adId}):`);
      console.log(`   Total QR Scans: ${adStats.count}`);
      totalScans += adStats.count;
      
      // Group by date
      const byDate = new Map();
      adStats.scans.forEach(scan => {
        const dateStr = scan.date instanceof Date 
          ? scan.date.toISOString().split('T')[0] 
          : (typeof scan.date === 'string' ? scan.date.split('T')[0] : 'unknown');
        if (!byDate.has(dateStr)) {
          byDate.set(dateStr, []);
        }
        byDate.get(dateStr).push(scan);
      });
      
      byDate.forEach((scans, date) => {
        console.log(`   ${date}: ${scans.length} scans`);
        scans.forEach(scan => {
          console.log(`      - Material: ${scan.materialId}, Time: ${scan.scanTimestamp}`);
        });
      });
    });

    console.log(`\n📊 Total QR Scans (sum of all ads): ${totalScans}`);
    console.log('═'.repeat(80));

    console.log('\n📊 QR Scans by Date and Ad:');
    console.log('═'.repeat(80));
    Array.from(qrScansByDateAndAd.values())
      .sort((a, b) => a.date.localeCompare(b.date) || a.adId.localeCompare(b.adId))
      .forEach(stat => {
        console.log(`${stat.date} - ${stat.adTitle} (${stat.adId}): ${stat.count} scans`);
      });

    // Check UserAnalytics
    console.log('\n\n📊 UserAnalytics Stored Data:');
    console.log('═'.repeat(80));
    const userAnalytics = await UserAnalytics.findOne({ userId: userId }).lean();
    
    if (userAnalytics) {
      console.log(`\nTotal QR Scans (field): ${userAnalytics.totalQRScans}`);
      console.log(`\nPer-ad QR Scans in ads array:`);
      userAnalytics.ads.forEach(ad => {
        console.log(`   ${ad.adTitle} (${ad.adId}): ${ad.totalQRScans || 0} QR scans`);
      });

      console.log(`\nDaily Stats QR Scans:`);
      const dailyStatsByAd = new Map();
      userAnalytics.dailyStats.forEach(stat => {
        if (stat.adId) {
          const adIdStr = stat.adId.toString();
          if (!dailyStatsByAd.has(adIdStr)) {
            dailyStatsByAd.set(adIdStr, {
              adId: adIdStr,
              adTitle: userAds.find(a => a._id.toString() === adIdStr)?.title || 'Unknown',
              totalQRScans: 0,
              byDate: new Map()
            });
          }
          const adStats = dailyStatsByAd.get(adIdStr);
          adStats.totalQRScans += stat.qrScans || 0;
          if (!adStats.byDate.has(stat.date)) {
            adStats.byDate.set(stat.date, 0);
          }
          adStats.byDate.set(stat.date, adStats.byDate.get(stat.date) + (stat.qrScans || 0));
        }
      });

      dailyStatsByAd.forEach(adStats => {
        console.log(`\n${adStats.adTitle} (${adStats.adId}):`);
        console.log(`   Total in dailyStats: ${adStats.totalQRScans}`);
        adStats.byDate.forEach((count, date) => {
          console.log(`   ${date}: ${count} scans`);
        });
      });

      // Check aggregated entry
      const aggregated = userAnalytics.dailyStats.find(s => !s.adId);
      if (aggregated) {
        console.log(`\nAggregated Entry (adId: null):`);
        console.log(`   Date: ${aggregated.date}`);
        console.log(`   QR Scans: ${aggregated.qrScans}`);
      }

      // Compare
      console.log('\n\n📊 Comparison:');
      console.log('═'.repeat(80));
      console.log(`Source Data Total: ${totalScans}`);
      console.log(`UserAnalytics Total: ${userAnalytics.totalQRScans}`);
      console.log(`Ads Array Sum: ${userAnalytics.ads.reduce((sum, ad) => sum + (ad.totalQRScans || 0), 0)}`);
      
      const dailyStatsPerAdSum = Array.from(dailyStatsByAd.values())
        .reduce((sum, ad) => sum + ad.totalQRScans, 0);
      console.log(`DailyStats Per-Ad Sum: ${dailyStatsPerAdSum}`);
      
      if (aggregated) {
        console.log(`DailyStats Aggregated: ${aggregated.qrScans}`);
      }

      if (totalScans === userAnalytics.totalQRScans && 
          totalScans === dailyStatsPerAdSum &&
          (!aggregated || totalScans === aggregated.qrScans)) {
        console.log('\n✅ All values match!');
      } else {
        console.log('\n⚠️ MISMATCH DETECTED!');
        console.log('   Source data may have different QR scans than stored data.');
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get userId from command line argument
const userId = process.argv[2];
if (!userId) {
  console.error('❌ Please provide a userId as an argument');
  console.log('Usage: node scripts/verifyQRScansFromSource.js <userId>');
  process.exit(1);
}

verifyQRScans(userId);

