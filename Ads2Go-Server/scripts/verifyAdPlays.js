/**
 * Script to verify ad play counts directly from the database
 * Run with: node scripts/verifyAdPlays.js <userId> <period>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function verifyAdPlays(userId, period = '7d') {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
    
    // Calculate date range (calendar days)
    const now = new Date();
    const endDate = now;
    const startDate = new Date(now);
    
    if (period === '1d') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      startDate.setDate(startDate.getDate() - 6); // 6 days ago + today = 7 days
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 29); // 29 days ago + today = 30 days
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log(`📅 Period: ${period}`);
    console.log(`📅 Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Query 1: Get ALL ad plays for this user (all ads combined)
    console.log('🔍 Query 1: Total plays across ALL ads for this user...\n');
    
    const allAdsData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
          uniqueDevices: { $addToSet: '$materialId' },
          uniqueAds: { $addToSet: '$dailyData.adPerformance.adId' },
          uniqueDays: { $addToSet: '$dailyData.date' }
        }
      }
    ]);
    
    if (allAdsData.length > 0) {
      const summary = allAdsData[0];
      console.log('✅ TOTAL AD PLAYS (ALL ADS COMBINED):');
      console.log(`   📊 Total Plays: ${summary.totalPlays}`);
      console.log(`   📊 Total Impressions: ${summary.totalImpressions}`);
      console.log(`   📊 Total View Time: ${Math.round(summary.totalViewTime * 100) / 100}s`);
      console.log(`   📊 Unique Ads: ${summary.uniqueAds.length}`);
      console.log(`   📊 Unique Devices: ${summary.uniqueDevices.length}`);
      console.log(`   📊 Unique Days: ${summary.uniqueDays.length}\n`);
    } else {
      console.log('❌ No data found for this user and period\n');
    }
    
    // Query 2: Get breakdown by each ad
    console.log('🔍 Query 2: Breakdown by each ad...\n');
    
    const byAdData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: '$dailyData.adPerformance.adId',
          adTitle: { $first: '$dailyData.adPerformance.adTitle' },
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          totalImpressions: { $sum: '$dailyData.adPerformance.impressions' },
          totalViewTime: { $sum: '$dailyData.adPerformance.totalViewTime' },
          uniqueDevices: { $addToSet: '$materialId' }
        }
      },
      { $sort: { totalPlays: -1 } }
    ]);
    
    console.log('📊 BREAKDOWN BY AD:\n');
    let totalPlaysCheck = 0;
    byAdData.forEach((ad, index) => {
      console.log(`   ${index + 1}. ${ad.adTitle || 'Unknown Ad'}`);
      console.log(`      Ad ID: ${ad._id}`);
      console.log(`      Plays: ${ad.totalPlays}`);
      console.log(`      Impressions: ${ad.totalImpressions}`);
      console.log(`      View Time: ${Math.round(ad.totalViewTime * 100) / 100}s`);
      console.log(`      Devices: ${ad.uniqueDevices.length}\n`);
      totalPlaysCheck += ad.totalPlays;
    });
    
    console.log(`✅ Total plays (sum of all ads): ${totalPlaysCheck}\n`);
    
    // Query 3: Get daily breakdown
    console.log('🔍 Query 3: Daily breakdown...\n');
    
    const dailyData = await DeviceDataHistoryV2.aggregate([
      { $unwind: '$dailyData' },
      {
        $match: {
          'dailyData.date': { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: { path: '$dailyData.adPerformance', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      },
      {
        $group: {
          _id: '$dailyData.date',
          totalPlays: { $sum: '$dailyData.adPerformance.playCount' },
          uniqueAds: { $addToSet: '$dailyData.adPerformance.adId' },
          uniqueDevices: { $addToSet: '$materialId' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('📊 DAILY BREAKDOWN:\n');
    dailyData.forEach(day => {
      const dateStr = new Date(day._id).toISOString().split('T')[0];
      console.log(`   ${dateStr}: ${day.totalPlays} plays (${day.uniqueAds.length} ads, ${day.uniqueDevices.length} devices)`);
    });
    
    console.log('\n🎉 Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Get userId from command line argument
const userId = process.argv[2];
const period = process.argv[3] || '7d';

if (!userId) {
  console.error('❌ Usage: node scripts/verifyAdPlays.js <userId> [period]');
  console.error('   Example: node scripts/verifyAdPlays.js 68ada30cc599b1170b538b6f 7d');
  process.exit(1);
}

verifyAdPlays(userId, period);

