/**
 * Script to check if per-material data exists in source and if it's being stored correctly
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

async function checkMaterialBreakdown(userId) {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Get user's ads
    const userAds = await Ad.find({ userId: userId }).select('_id title').lean();
    const userAdIds = userAds.map(ad => ad._id.toString());

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

    console.log(`📊 Materials: ${materialIds.join(', ')}\n`);

    // Check DeviceDataHistoryV2 for 2025-11-08
    const targetDate = new Date('2025-11-08');
    targetDate.setUTCHours(0, 0, 0, 0);

    console.log('🔍 Checking DeviceDataHistoryV2 for 2025-11-08...\n');

    const historyDevices = await DeviceDataHistoryV2.find({
      materialId: { $in: materialIds }
    }).lean();

    // Group data by material, date, and adId
    const dataByMaterial = new Map();

    historyDevices.forEach(device => {
      const materialId = device.materialId;
      if (!dataByMaterial.has(materialId)) {
        dataByMaterial.set(materialId, {
          materialId: materialId,
          adPlaybacks: [],
          qrScans: []
        });
      }
      const materialData = dataByMaterial.get(materialId);

      if (device.dailyData && Array.isArray(device.dailyData)) {
        device.dailyData.forEach(dailyData => {
          const dailyDate = dailyData.date instanceof Date 
            ? dailyData.date 
            : new Date(dailyData.date);
          const dateStr = dailyDate.toISOString().split('T')[0];

          if (dateStr === '2025-11-08') {
            // Process adPlaybacks
            if (dailyData.adPlaybacks && Array.isArray(dailyData.adPlaybacks)) {
              dailyData.adPlaybacks.forEach(playback => {
                const playbackAdId = playback.adId?.toString();
                if (playbackAdId && userAdIds.includes(playbackAdId)) {
                  materialData.adPlaybacks.push({
                    adId: playbackAdId,
                    adTitle: playback.adTitle,
                    viewTime: playback.viewTime || 0,
                    completionRate: playback.completionRate || 0,
                    isMaster: playback.isMaster
                  });
                }
              });
            }

            // Process QR scans
            if (dailyData.qrScans && Array.isArray(dailyData.qrScans)) {
              dailyData.qrScans.forEach(qrScan => {
                const scanAdId = qrScan.adId?.toString();
                if (scanAdId && userAdIds.includes(scanAdId)) {
                  materialData.qrScans.push({
                    adId: scanAdId,
                    adTitle: qrScan.adTitle,
                    scanTimestamp: qrScan.scanTimestamp
                  });
                }
              });
            }
          }
        });
      }
    });

    // Display breakdown by material
    console.log('📊 Data breakdown by Material for 2025-11-08:\n');
    dataByMaterial.forEach((materialData, materialId) => {
      console.log(`Material: ${materialId}`);
      console.log(`  Ad Playbacks: ${materialData.adPlaybacks.length}`);
      console.log(`  QR Scans: ${materialData.qrScans.length}`);

      // Group by adId
      const byAd = new Map();
      materialData.adPlaybacks.forEach(pb => {
        if (!byAd.has(pb.adId)) {
          byAd.set(pb.adId, {
            adId: pb.adId,
            adTitle: pb.adTitle,
            playbacks: 0,
            totalViewTime: 0,
            qrScans: 0
          });
        }
        const adData = byAd.get(pb.adId);
        if (pb.isMaster !== false) {
          adData.playbacks += 1;
          adData.totalViewTime += pb.viewTime;
        }
      });

      materialData.qrScans.forEach(qr => {
        if (!byAd.has(qr.adId)) {
          byAd.set(qr.adId, {
            adId: qr.adId,
            adTitle: qr.adTitle,
            playbacks: 0,
            totalViewTime: 0,
            qrScans: 0
          });
        }
        byAd.get(qr.adId).qrScans += 1;
      });

      byAd.forEach(adData => {
        console.log(`    ${adData.adTitle} (${adData.adId}):`);
        console.log(`      Playbacks: ${adData.playbacks}`);
        console.log(`      View Time: ${adData.totalViewTime}s`);
        console.log(`      QR Scans: ${adData.qrScans}`);
      });
      console.log('');
    });

    // Check DeviceTracking for today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    if (todayStr === '2025-11-08') {
      console.log('🔍 Checking DeviceTracking for 2025-11-08...\n');
      
      const trackingDevices = await DeviceTracking.find({
        materialId: { $in: materialIds },
        date: todayStr
      }).lean();

      trackingDevices.forEach(device => {
        const materialId = device.materialId;
        if (!dataByMaterial.has(materialId)) {
          dataByMaterial.set(materialId, {
            materialId: materialId,
            adPlaybacks: [],
            qrScans: []
          });
        }
        const materialData = dataByMaterial.get(materialId);

        if (device.adPlaybacks && Array.isArray(device.adPlaybacks)) {
          device.adPlaybacks.forEach(playback => {
            const playbackAdId = playback.adId?.toString();
            if (playbackAdId && userAdIds.includes(playbackAdId)) {
              materialData.adPlaybacks.push({
                adId: playbackAdId,
                adTitle: playback.adTitle,
                viewTime: playback.viewTime || 0,
                completionRate: playback.completionRate || 0,
                isMaster: playback.isMaster
              });
            }
          });
        }

        if (device.qrScans && Array.isArray(device.qrScans)) {
          device.qrScans.forEach(qrScan => {
            const scanAdId = qrScan.adId?.toString();
            if (scanAdId && userAdIds.includes(scanAdId)) {
              materialData.qrScans.push({
                adId: scanAdId,
                adTitle: qrScan.adTitle,
                scanTimestamp: qrScan.scanTimestamp
              });
            }
          });
        }
      });
    }

    // Now check what's stored in UserAnalytics
    console.log('\n\n📊 UserAnalytics dailyStats for 2025-11-08:\n');
    const userAnalytics = await UserAnalytics.findOne({ userId: userId }).lean();
    
    if (userAnalytics) {
      const dateStats = userAnalytics.dailyStats.filter(s => s.date === '2025-11-08');
      
      console.log(`Total entries: ${dateStats.length}\n`);

      // Group by materialId
      const byMaterial = new Map();
      dateStats.forEach(stat => {
        const materialId = stat.materialId || 'null (aggregated)';
        if (!byMaterial.has(materialId)) {
          byMaterial.set(materialId, []);
        }
        byMaterial.get(materialId).push(stat);
      });

      byMaterial.forEach((stats, materialId) => {
        console.log(`Material: ${materialId}`);
        stats.forEach(stat => {
          if (stat.adId) {
            const ad = userAds.find(a => a._id.toString() === stat.adId.toString());
            console.log(`  ${ad?.title || 'Unknown'} (${stat.adId}):`);
            console.log(`    QR Scans: ${stat.qrScans}`);
            console.log(`    Ads Played: ${stat.adsPlayed}`);
            console.log(`    Display Time: ${stat.displayTime}s`);
          } else {
            console.log(`  Aggregated (adId: null):`);
            console.log(`    QR Scans: ${stat.qrScans}`);
            console.log(`    Ads Played: ${stat.adsPlayed}`);
            console.log(`    Display Time: ${stat.displayTime}s`);
          }
        });
        console.log('');
      });

      // Compare source vs stored
      console.log('\n📊 Comparison: Source Data vs Stored Data\n');
      console.log('Source Data (by material):');
      dataByMaterial.forEach((materialData, materialId) => {
        const byAd = new Map();
        materialData.adPlaybacks.forEach(pb => {
          if (!byAd.has(pb.adId)) {
            byAd.set(pb.adId, { playbacks: 0, qrScans: 0 });
          }
          if (pb.isMaster !== false) {
            byAd.get(pb.adId).playbacks += 1;
          }
        });
        materialData.qrScans.forEach(qr => {
          if (!byAd.has(qr.adId)) {
            byAd.set(qr.adId, { playbacks: 0, qrScans: 0 });
          }
          byAd.get(qr.adId).qrScans += 1;
        });

        byAd.forEach((adData, adId) => {
          const ad = userAds.find(a => a._id.toString() === adId);
          console.log(`  ${materialId} - ${ad?.title || 'Unknown'}: ${adData.qrScans} QR scans, ${adData.playbacks} playbacks`);
        });
      });

      console.log('\nStored Data (dailyStats):');
      dateStats.forEach(stat => {
        if (stat.adId) {
          const ad = userAds.find(a => a._id.toString() === stat.adId.toString());
          console.log(`  Material: ${stat.materialId || 'null'} - ${ad?.title || 'Unknown'}: ${stat.qrScans} QR scans, ${stat.adsPlayed} ads played`);
        }
      });
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
  console.log('Usage: node scripts/checkMaterialBreakdownInSource.js <userId>');
  process.exit(1);
}

checkMaterialBreakdown(userId);

