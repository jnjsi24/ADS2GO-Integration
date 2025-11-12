/**
 * Check UserAnalytics Storage Script
 * 
 * This script checks what's actually stored in the userAnalytics collection,
 * specifically the dailyStats field.
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
const UserAnalytics = require('../src/models/userAnalytics');
const User = require('../src/models/User');

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

async function checkUserAnalyticsStorage() {
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

    // Get all userAnalytics documents
    const allUserAnalytics = await UserAnalytics.find({}).select('userId userName dailyStats totalAdPlays totalQRScans lastSyncTimestamp lastUpdated').lean();
    
    log(`📊 Total UserAnalytics documents: ${allUserAnalytics.length}\n`, 'bright');

    // Categorize by dailyStats status
    const withDailyStats = [];
    const emptyDailyStats = [];
    const noDailyStatsField = [];

    allUserAnalytics.forEach(ua => {
      if (!ua.dailyStats) {
        noDailyStatsField.push(ua);
      } else if (Array.isArray(ua.dailyStats) && ua.dailyStats.length > 0) {
        withDailyStats.push(ua);
      } else {
        emptyDailyStats.push(ua);
      }
    });

    log(`📈 Summary:`, 'bright');
    log(`   ✅ With dailyStats data: ${withDailyStats.length}`, withDailyStats.length > 0 ? 'green' : 'yellow');
    log(`   ⚠️  Empty dailyStats array: ${emptyDailyStats.length}`, 'yellow');
    log(`   ❌ No dailyStats field: ${noDailyStatsField.length}`, noDailyStatsField.length > 0 ? 'red' : 'green');

    // Show users with dailyStats
    if (withDailyStats.length > 0) {
      log(`\n✅ Users WITH dailyStats data:`, 'bright');
      withDailyStats.forEach((ua, idx) => {
        const user = ua.userName || ua.userId;
        const dateRange = ua.dailyStats.length > 0 ? {
          first: ua.dailyStats[0].date,
          last: ua.dailyStats[ua.dailyStats.length - 1].date
        } : null;
        
        log(`   ${idx + 1}. ${user} (${ua.userId})`, 'green');
        log(`      Daily entries: ${ua.dailyStats.length}`, 'cyan');
        if (dateRange) {
          log(`      Date range: ${dateRange.first} to ${dateRange.last}`, 'cyan');
        }
        log(`      Total ad plays: ${ua.totalAdPlays || 0}`, 'cyan');
        log(`      Total QR scans: ${ua.totalQRScans || 0}`, 'cyan');
        log(`      Last sync: ${ua.lastSyncTimestamp ? new Date(ua.lastSyncTimestamp).toISOString() : 'Never'}`, 'cyan');
        
        // Show sample of dailyStats structure
        if (ua.dailyStats.length > 0) {
          const sample = ua.dailyStats[0];
          log(`      Sample entry (${sample.date}):`, 'cyan');
          log(`         Ads: ${sample.ads?.length || 0}`, 'cyan');
          log(`         Totals: plays=${sample.totals?.adsPlayed || 0}, time=${sample.totals?.displayTime || 0}, qr=${sample.totals?.qrScans || 0}`, 'cyan');
        }
      });
    }

    // Show users with empty dailyStats
    if (emptyDailyStats.length > 0) {
      log(`\n⚠️  Users with EMPTY dailyStats:`, 'bright');
      emptyDailyStats.slice(0, 10).forEach((ua, idx) => {
        const user = ua.userName || ua.userId;
        log(`   ${idx + 1}. ${user} (${ua.userId})`, 'yellow');
        log(`      Total ad plays: ${ua.totalAdPlays || 0}`, 'cyan');
        log(`      Total QR scans: ${ua.totalQRScans || 0}`, 'cyan');
        log(`      Last sync: ${ua.lastSyncTimestamp ? new Date(ua.lastSyncTimestamp).toISOString() : 'Never'}`, 'cyan');
        log(`      Last updated: ${ua.lastUpdated ? new Date(ua.lastUpdated).toISOString() : 'Never'}`, 'cyan');
      });
      if (emptyDailyStats.length > 10) {
        log(`   ... and ${emptyDailyStats.length - 10} more`, 'yellow');
      }
    }

    // Show users without dailyStats field
    if (noDailyStatsField.length > 0) {
      log(`\n❌ Users WITHOUT dailyStats field:`, 'bright');
      noDailyStatsField.slice(0, 10).forEach((ua, idx) => {
        const user = ua.userName || ua.userId;
        log(`   ${idx + 1}. ${user} (${ua.userId})`, 'red');
        log(`      Total ad plays: ${ua.totalAdPlays || 0}`, 'cyan');
        log(`      Last updated: ${ua.lastUpdated ? new Date(ua.lastUpdated).toISOString() : 'Never'}`, 'cyan');
      });
      if (noDailyStatsField.length > 10) {
        log(`   ... and ${noDailyStatsField.length - 10} more`, 'red');
      }
    }

    // Check specific users mentioned earlier
    log(`\n${'='.repeat(80)}`, 'bright');
    log(`🔍 Checking Specific Users:`, 'bright');
    log('='.repeat(80), 'bright');

    const specificUserIds = [
      '69037f60960a3a60f0fa10a4', // Bianca Limson
      '690e2cd6703e7e16fc5d5e3a', // Nico Faith Enriquez
      '690ee7cbf4ce7e5f8d7ae141', // Mary Salvador
      '69142ee509dfcacfd7517e7c'  // Rovic Maten
    ];

    for (const userId of specificUserIds) {
      const ua = await UserAnalytics.findOne({ userId }).lean();
      if (ua) {
        const user = await User.findOne({ _id: userId }).select('firstName lastName').lean();
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        
        log(`\n👤 ${userName} (${userId}):`, 'bright');
        log(`   dailyStats field exists: ${ua.dailyStats !== undefined ? 'Yes' : 'No'}`, ua.dailyStats !== undefined ? 'green' : 'red');
        log(`   dailyStats is array: ${Array.isArray(ua.dailyStats) ? 'Yes' : 'No'}`, Array.isArray(ua.dailyStats) ? 'green' : 'red');
        log(`   dailyStats length: ${ua.dailyStats?.length || 0}`, ua.dailyStats?.length > 0 ? 'green' : 'yellow');
        log(`   totalAdPlays: ${ua.totalAdPlays || 0}`, 'cyan');
        log(`   totalQRScans: ${ua.totalQRScans || 0}`, 'cyan');
        log(`   lastSyncTimestamp: ${ua.lastSyncTimestamp ? new Date(ua.lastSyncTimestamp).toISOString() : 'null'}`, 'cyan');
        log(`   lastUpdated: ${ua.lastUpdated ? new Date(ua.lastUpdated).toISOString() : 'null'}`, 'cyan');
        
        // Check if dailyStats structure is correct
        if (ua.dailyStats && Array.isArray(ua.dailyStats) && ua.dailyStats.length > 0) {
          const sample = ua.dailyStats[0];
          log(`   Sample dailyStats entry:`, 'cyan');
          log(`      date: ${sample.date}`, 'cyan');
          log(`      ads: ${sample.ads?.length || 0}`, 'cyan');
          log(`      totals: ${JSON.stringify(sample.totals || {})}`, 'cyan');
        }
      } else {
        log(`\n👤 User ${userId}:`, 'bright');
        log(`   ❌ No UserAnalytics document found`, 'red');
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
checkUserAnalyticsStorage()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

