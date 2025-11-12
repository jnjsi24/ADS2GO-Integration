/**
 * Backfill DailyStats Script
 * 
 * This script backfills the dailyStats array in UserAnalytics collection
 * from DeviceDataHistoryV2 for all users.
 * 
 * It will:
 * 1. Find all users with empty or missing dailyStats
 * 2. Sync ALL historical data (from first ad creation to now)
 * 3. Populate dailyStats array with all daily entries
 * 
 * Usage:
 *   node scripts/backfillDailyStats.js              # Backfill all users
 *   node scripts/backfillDailyStats.js --userId=xxx # Backfill specific user
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
const UserAnalyticsService = require('../src/services/userAnalyticsService');
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function backfillDailyStats(userId = null) {
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
    log('✅ Connected to MongoDB', 'green');

    // Get users to process
    let users;
    if (userId) {
      users = await User.find({ _id: userId }).select('_id firstName lastName');
      if (users.length === 0) {
        log(`❌ User not found: ${userId}`, 'red');
        process.exit(1);
      }
    } else {
      // Find all users with empty or missing dailyStats
      log('🔍 Finding users with empty or missing dailyStats...', 'cyan');
      
      const userAnalyticsWithEmptyStats = await UserAnalytics.find({
        $or: [
          { dailyStats: { $exists: false } },
          { dailyStats: { $size: 0 } },
          { dailyStats: null }
        ]
      }).select('userId').lean();

      const userIds = userAnalyticsWithEmptyStats.map(ua => ua.userId);
      
      if (userIds.length === 0) {
        log('✅ No users found with empty dailyStats. All users are up to date!', 'green');
        process.exit(0);
      }

      log(`📊 Found ${userIds.length} users with empty dailyStats`, 'blue');
      
      // Get user details
      users = await User.find({ _id: { $in: userIds } }).select('_id firstName lastName');
    }

    log(`\n🚀 Starting backfill for ${users.length} user(s)...\n`, 'bright');

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const batchSize = 3; // Process 3 users at a time to avoid overload
    let processed = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} user(s))`, 'blue');

      const batchPromises = batch.map(async (user) => {
        try {
          processed++;
          const progress = `[${processed}/${users.length}]`;
          log(`${progress} 🔄 Backfilling: ${user.firstName} ${user.lastName} (${user._id})`, 'cyan');

          // Sync with ALL historical data (no date range = fetch all)
          // The syncUserAnalyticsFromHistory function will automatically
          // fetch from first ad creation date to now when dailyStats is empty
          const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(
            user._id.toString(),
            null, // startDate = null (fetch all historical data)
            null, // endDate = null (fetch to now)
            null  // adId = null (all ads)
          );

          if (result && result.success !== false) {
            // Verify dailyStats was populated
            const userAnalytics = await UserAnalytics.findOne({ userId: user._id });
            const dailyStatsCount = userAnalytics?.dailyStats?.length || 0;
            const totalAdPlays = userAnalytics?.totalAdPlays || 0;
            const totalQRScans = userAnalytics?.totalQRScans || 0;

            if (dailyStatsCount > 0) {
              results.success++;
              log(`${progress} ✅ Success: ${user.firstName} ${user.lastName} - ` +
                  `${dailyStatsCount} daily entries, ` +
                  `Plays: ${totalAdPlays}, ` +
                  `QR Scans: ${totalQRScans}`, 'green');
            } else {
              // Check if user has ads
              const Ad = require('../src/models/Ad');
              const userAds = await Ad.find({ userId: user._id }).limit(1);
              
              if (userAds.length === 0) {
                log(`${progress} ⚠️  No ads found for ${user.firstName} ${user.lastName} - skipping`, 'yellow');
              } else {
                results.failed++;
                results.errors.push({
                  userId: user._id.toString(),
                  name: `${user.firstName} ${user.lastName}`,
                  error: 'Sync completed but dailyStats is still empty'
                });
                log(`${progress} ❌ Failed: ${user.firstName} ${user.lastName} - dailyStats still empty`, 'red');
              }
            }
          } else {
            results.failed++;
            const errorMsg = result?.message || result?.error || 'Unknown error';
            results.errors.push({
              userId: user._id.toString(),
              name: `${user.firstName} ${user.lastName}`,
              error: errorMsg
            });
            log(`${progress} ❌ Failed: ${user.firstName} ${user.lastName} - ${errorMsg}`, 'red');
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: user._id.toString(),
            name: `${user.firstName} ${user.lastName}`,
            error: error.message
          });
          log(`${progress} ❌ Error: ${user.firstName} ${user.lastName} - ${error.message}`, 'red');
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);
    }

    // Summary
    log('\n' + '='.repeat(60), 'bright');
    log('📊 BACKFILL SUMMARY', 'bright');
    log('='.repeat(60), 'bright');
    log(`✅ Success: ${results.success} user(s)`, 'green');
    log(`❌ Failed: ${results.failed} user(s)`, results.failed > 0 ? 'red' : 'reset');
    
    if (results.errors.length > 0) {
      log('\n❌ Errors:', 'red');
      results.errors.forEach((err, index) => {
        log(`  ${index + 1}. ${err.name} (${err.userId}): ${err.error}`, 'red');
      });
    }

    log('\n✅ Backfill completed!', 'green');

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

// Run backfill
backfillDailyStats(targetUserId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

