/**
 * Script to rebuild analytics for a single user (for testing)
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalyticsService = require('../src/services/userAnalyticsService');
const User = require('../src/models/User');

async function rebuildSingleUser(userId) {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB');

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    console.log(`\n🔄 Rebuilding analytics for: ${user.firstName} ${user.lastName} (${userId})\n`);

    // Calculate date range (last 2 years)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    // Sync user analytics
    const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(userId, startDate, endDate);

    if (result.success) {
      console.log('\n✅ Rebuild successful!');
      
      // Fetch updated document
      const UserAnalytics = require('../src/models/userAnalytics');
      const updated = await UserAnalytics.findOne({ userId: userId }).lean();
      
      if (updated) {
        console.log('\n📊 Updated Analytics:');
        console.log(`   Total Ad Plays: ${updated.totalAdPlays}`);
        console.log(`   Total QR Scans: ${updated.totalQRScans}`);
        console.log(`   Daily Stats Entries: ${updated.dailyStats?.length || 0}`);
        
        // Check QR scan consistency (new nested structure)
        if (updated.dailyStats && updated.dailyStats.length > 0) {
          // ✅ NEW STRUCTURE: dailyStats is now grouped by date with nested ads and materials
          // Sum QR scans from all ads across all dates
          const perAdSum = updated.dailyStats.reduce((sum, dateEntry) => {
            if (dateEntry.ads && Array.isArray(dateEntry.ads)) {
              return sum + dateEntry.ads.reduce((adSum, adEntry) => {
                return adSum + (adEntry.totals?.qrScans || 0);
              }, 0);
            }
            return sum;
          }, 0);
          
          // Sum QR scans from date totals (aggregated across all ads)
          const aggregatedSum = updated.dailyStats.reduce((sum, dateEntry) => {
            return sum + (dateEntry.totals?.qrScans || 0);
          }, 0);
          
          console.log(`   Date entries: ${updated.dailyStats.length}`);
          console.log(`   Total ads across all dates: ${updated.dailyStats.reduce((sum, d) => sum + (d.ads?.length || 0), 0)}`);
          console.log(`   Per-ad QR scans sum: ${perAdSum}`);
          console.log(`   Aggregated QR scans sum: ${aggregatedSum}`);
          console.log(`   Total QR Scans (field): ${updated.totalQRScans}`);
          
          if (perAdSum === aggregatedSum && aggregatedSum === updated.totalQRScans) {
            console.log('\n✅ QR scan consistency: PERFECT!');
          } else {
            console.log('\n⚠️ QR scan inconsistency detected!');
            console.log(`   Per-ad sum: ${perAdSum}`);
            console.log(`   Aggregated sum: ${aggregatedSum}`);
            console.log(`   Total field: ${updated.totalQRScans}`);
          }
          
          // Show per-ad breakdown
          console.log('\n📋 Per-ad QR scans breakdown:');
          updated.dailyStats.forEach(dateEntry => {
            if (dateEntry.ads && Array.isArray(dateEntry.ads)) {
              dateEntry.ads.forEach(adEntry => {
                if (adEntry.adId && adEntry.totals) {
                  const adIdStr = adEntry.adId.toString ? adEntry.adId.toString() : String(adEntry.adId);
                  console.log(`   Ad ${adIdStr}: ${adEntry.totals.qrScans || 0} QR scans (date: ${dateEntry.date})`);
                }
              });
            }
          });
        }
      }
    } else {
      console.error('\n❌ Rebuild failed:', result.message || result.error);
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
  console.log('Usage: node scripts/rebuildSingleUserAnalytics.js <userId>');
  process.exit(1);
}

rebuildSingleUser(userId);

