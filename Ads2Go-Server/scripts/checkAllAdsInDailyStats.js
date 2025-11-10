/**
 * Script to check if all user's ads are represented in dailyStats
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const Ad = require('../src/models/Ad');
const UserAnalytics = require('../src/models/userAnalytics');

async function checkAllAds(userId) {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Get user's ads
    const userAds = await Ad.find({ userId: userId }).select('_id title status').lean();
    const userAdIds = userAds.map(ad => ad._id.toString());
    
    console.log(`📊 User has ${userAds.length} total ads:\n`);
    userAds.forEach((ad, idx) => {
      console.log(`${idx + 1}. ${ad.title} (${ad._id}) - Status: ${ad.status}`);
    });

    // Get UserAnalytics
    const userAnalytics = await UserAnalytics.findOne({ userId: userId }).lean();
    
    if (!userAnalytics) {
      console.log('\n❌ No UserAnalytics document found');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n\n📊 UserAnalytics has ${userAnalytics.ads.length} ads in ads array:\n`);
    userAnalytics.ads.forEach((ad, idx) => {
      console.log(`${idx + 1}. ${ad.adTitle} (${ad.adId}) - QR Scans: ${ad.totalQRScans || 0}`);
    });

    // Check which ads are in ads array
    const adsInAnalytics = userAnalytics.ads.map(ad => ad.adId.toString());
    const missingFromAds = userAdIds.filter(adId => !adsInAnalytics.includes(adId));
    
    if (missingFromAds.length > 0) {
      console.log(`\n⚠️ ${missingFromAds.length} ads are missing from ads array:`);
      missingFromAds.forEach(adId => {
        const ad = userAds.find(a => a._id.toString() === adId);
        console.log(`   - ${ad?.title || 'Unknown'} (${adId})`);
      });
    } else {
      console.log(`\n✅ All ads are in ads array`);
    }

    // Check dailyStats
    console.log(`\n\n📊 DailyStats has entries for ${new Set(userAnalytics.dailyStats.filter(s => s.adId).map(s => s.adId.toString())).size} unique ads:\n`);
    
    const adsInDailyStats = new Set();
    userAnalytics.dailyStats.forEach(stat => {
      if (stat.adId) {
        adsInDailyStats.add(stat.adId.toString());
      }
    });

    Array.from(adsInDailyStats).forEach(adId => {
      const ad = userAds.find(a => a._id.toString() === adId);
      const stats = userAnalytics.dailyStats.filter(s => s.adId && s.adId.toString() === adId);
      const totalQRScans = stats.reduce((sum, s) => sum + (s.qrScans || 0), 0);
      const totalAdsPlayed = stats.reduce((sum, s) => sum + (s.adsPlayed || 0), 0);
      console.log(`   - ${ad?.title || 'Unknown'} (${adId}): ${stats.length} entries, ${totalQRScans} QR scans, ${totalAdsPlayed} ads played`);
    });

    const missingFromDailyStats = userAdIds.filter(adId => !adsInDailyStats.has(adId));
    
    if (missingFromDailyStats.length > 0) {
      console.log(`\n⚠️ ${missingFromDailyStats.length} ads are missing from dailyStats:`);
      missingFromDailyStats.forEach(adId => {
        const ad = userAds.find(a => a._id.toString() === adId);
        console.log(`   - ${ad?.title || 'Unknown'} (${adId}) - Status: ${ad?.status}`);
      });
    } else {
      console.log(`\n✅ All ads are in dailyStats`);
    }

    // Detailed breakdown for 2025-11-08
    console.log(`\n\n📊 Detailed breakdown for 2025-11-08:\n`);
    const dateStats = userAnalytics.dailyStats.filter(s => s.date === '2025-11-08');
    
    console.log(`Total entries for 2025-11-08: ${dateStats.length}`);
    console.log(`Per-ad entries: ${dateStats.filter(s => s.adId).length}`);
    console.log(`Aggregated entries: ${dateStats.filter(s => !s.adId).length}\n`);

    dateStats.forEach((stat, idx) => {
      if (stat.adId) {
        const ad = userAds.find(a => a._id.toString() === stat.adId.toString());
        console.log(`${idx + 1}. ${ad?.title || 'Unknown'} (${stat.adId}):`);
        console.log(`   QR Scans: ${stat.qrScans}`);
        console.log(`   Ads Played: ${stat.adsPlayed}`);
        console.log(`   Display Time: ${stat.displayTime}s`);
        console.log(`   MaterialId: ${stat.materialId || 'null'}`);
      } else {
        console.log(`${idx + 1}. Aggregated (adId: null):`);
        console.log(`   QR Scans: ${stat.qrScans}`);
        console.log(`   Ads Played: ${stat.adsPlayed}`);
        console.log(`   Display Time: ${stat.displayTime}s`);
      }
      console.log('');
    });

    // Verify totals
    const perAdSum = dateStats.filter(s => s.adId).reduce((sum, s) => sum + (s.qrScans || 0), 0);
    const aggregatedSum = dateStats.filter(s => !s.adId).reduce((sum, s) => sum + (s.qrScans || 0), 0);
    
    console.log(`\n📊 Totals for 2025-11-08:`);
    console.log(`   Per-ad QR scans sum: ${perAdSum}`);
    console.log(`   Aggregated QR scans: ${aggregatedSum}`);
    console.log(`   Match: ${perAdSum === aggregatedSum ? '✅ YES' : '❌ NO'}`);

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
  console.log('Usage: node scripts/checkAllAdsInDailyStats.js <userId>');
  process.exit(1);
}

checkAllAds(userId);

