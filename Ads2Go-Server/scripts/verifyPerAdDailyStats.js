/**
 * Verification script to check if per-ad daily stats are stored correctly
 */

const path = require('path');
const fs = require('fs');

// Load .env file
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  require('dotenv').config();
}

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function verifyPerAdDailyStats() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get a user with ads (Arabella Lopez)
    const userId = '6903818de39067f38afecab2';
    const ua = await UserAnalytics.findOne({ userId }).lean();

    if (!ua) {
      console.log('❌ UserAnalytics document not found');
      return;
    }

    console.log('📊 UserAnalytics for Arabella Lopez:');
    console.log(`Total dailyStats entries: ${ua.dailyStats.length}`);
    console.log(`Per-ad entries: ${ua.dailyStats.filter(s => s.adId).length}`);
    console.log(`Aggregated entries: ${ua.dailyStats.filter(s => !s.adId).length}`);
    console.log(`\nTotal Ad Plays: ${ua.totalAdPlays}`);
    console.log(`Total QR Scans: ${ua.totalQRScans}`);

    console.log('\n📋 Sample per-ad entries:');
    const perAdEntries = ua.dailyStats.filter(s => s.adId).slice(0, 5);
    perAdEntries.forEach(s => {
      console.log(`  Date: ${s.date}, AdId: ${s.adId}, Plays: ${s.adsPlayed}, QR: ${s.qrScans}, DisplayTime: ${s.displayTime}s`);
    });

    console.log('\n📋 Sample aggregated entries:');
    const aggregatedEntries = ua.dailyStats.filter(s => !s.adId).slice(0, 3);
    aggregatedEntries.forEach(s => {
      console.log(`  Date: ${s.date}, AdId: ${s.adId}, Plays: ${s.adsPlayed}, QR: ${s.qrScans}, DisplayTime: ${s.displayTime}s`);
    });

    // Verify: Sum of per-ad entries should match aggregated entries
    console.log('\n✅ Verification:');
    const dates = [...new Set(ua.dailyStats.map(s => s.date))];
    let allMatch = true;
    
    dates.forEach(date => {
      const perAdForDate = ua.dailyStats.filter(s => s.adId && s.date === date);
      const aggregatedForDate = ua.dailyStats.find(s => !s.adId && s.date === date);
      
      if (perAdForDate.length > 0 && aggregatedForDate) {
        const sumPlays = perAdForDate.reduce((sum, s) => sum + (s.adsPlayed || 0), 0);
        const sumQR = perAdForDate.reduce((sum, s) => sum + (s.qrScans || 0), 0);
        
        if (sumPlays !== aggregatedForDate.adsPlayed || sumQR !== aggregatedForDate.qrScans) {
          console.log(`  ⚠️  Date ${date}: Per-ad sum (${sumPlays} plays, ${sumQR} QR) != Aggregated (${aggregatedForDate.adsPlayed} plays, ${aggregatedForDate.qrScans} QR)`);
          allMatch = false;
        } else {
          console.log(`  ✅ Date ${date}: Per-ad sum matches aggregated (${sumPlays} plays, ${sumQR} QR)`);
        }
      }
    });

    if (allMatch) {
      console.log('\n✅ All per-ad entries match aggregated entries!');
    }

    await mongoose.disconnect();
    console.log('\n✅ Verification complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyPerAdDailyStats();

