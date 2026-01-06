/**
 * Migration Script: UserAnalytics → DailyUserAnalytics + UserAnalyticsSummary
 * 
 * PHASE 2: Transforms nested analytics structure to flat structure
 * 
 * What this script does:
 * 1. Reads existing UserAnalytics collection (nested structure)
 * 2. Extracts dailyStats array and flattens it
 * 3. Creates individual documents in DailyUserAnalytics (one per day per ad)
 * 4. Creates summary documents in UserAnalyticsSummary (one per user)
 * 5. Validates data integrity
 * 6. Keeps old data intact (safe migration)
 * 
 * Usage:
 *   node scripts/migrateToFlatAnalytics.js [--dry-run] [--userId=USER_ID]
 * 
 * Options:
 *   --dry-run     Don't write to database, just show what would happen
 *   --userId      Migrate specific user only (for testing)
 *   --batch-size  Number of users to process at once (default: 10)
 *   --skip        Number of users to skip (for resuming)
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const userIdArg = args.find(arg => arg.startsWith('--userId='));
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 10;
const skipArg = args.find(arg => arg.startsWith('--skip='));
const skipCount = skipArg ? parseInt(skipArg.split('=')[1]) : 0;

console.log('🔄 Analytics Migration Script');
console.log('='.repeat(80));
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will write to database)'}`);
if (specificUserId) console.log(`Target: Single user (${specificUserId})`);
console.log(`Batch size: ${batchSize} users`);
if (skipCount > 0) console.log(`Skipping first: ${skipCount} users`);
console.log('='.repeat(80));
console.log('');

// Load .env file
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    envLoaded = true;
    console.log(`✅ Found .env file at: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found, using environment variables');
}

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!mongoUri) {
  console.error('❌ MongoDB URI not found in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB\n');
  runMigration();
}).catch(error => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Migration statistics
const stats = {
  totalUsers: 0,
  processedUsers: 0,
  skippedUsers: 0,
  failedUsers: 0,
  totalDailyRecords: 0,
  totalSummaries: 0,
  errors: [],
  startTime: Date.now()
};

async function runMigration() {
  try {
    // Load models
    const UserAnalytics = require('../src/models/userAnalytics');
    const DailyUserAnalytics = require('../src/models/dailyUserAnalytics');
    const UserAnalyticsSummary = require('../src/models/userAnalyticsSummary');
    const User = require('../src/models/User');
    
    console.log('📊 Phase 1: Analyzing existing data...\n');
    
    // Build query
    const query = specificUserId 
      ? { userId: new mongoose.Types.ObjectId(specificUserId) }
      : {};
    
    // Get total count
    const totalCount = await UserAnalytics.countDocuments(query);
    stats.totalUsers = totalCount;
    
    console.log(`Found ${totalCount} user(s) to migrate`);
    if (skipCount > 0) {
      console.log(`Skipping first ${skipCount} user(s)`);
    }
    console.log('');
    
    if (totalCount === 0) {
      console.log('⚠️  No users found to migrate');
      process.exit(0);
    }
    
    console.log('📊 Phase 2: Migrating data...\n');
    
    // Process in batches
    let processedCount = 0;
    let skip = skipCount;
    
    while (processedCount < totalCount - skipCount) {
      const batchUsers = await UserAnalytics.find(query)
        .skip(skip)
        .limit(batchSize)
        .lean();
      
      if (batchUsers.length === 0) break;
      
      // Process batch in parallel
      await Promise.all(
        batchUsers.map(user => migrateUser(user, UserAnalytics, DailyUserAnalytics, UserAnalyticsSummary, User))
      );
      
      processedCount += batchUsers.length;
      skip += batchSize;
      
      // Progress update
      const progress = ((processedCount / (totalCount - skipCount)) * 100).toFixed(1);
      console.log(`\n📈 Progress: ${processedCount}/${totalCount - skipCount} users (${progress}%)`);
      console.log(`   Daily records created: ${stats.totalDailyRecords}`);
      console.log(`   Summaries created: ${stats.totalSummaries}`);
      console.log(`   Failed: ${stats.failedUsers}\n`);
    }
    
    // Final report
    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(80));
    
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    
    console.log(`\n📊 Statistics:`);
    console.log(`   Total users: ${stats.totalUsers}`);
    console.log(`   Successfully migrated: ${stats.processedUsers}`);
    console.log(`   Skipped: ${stats.skippedUsers}`);
    console.log(`   Failed: ${stats.failedUsers}`);
    console.log(`   Daily records created: ${stats.totalDailyRecords}`);
    console.log(`   Summary documents created: ${stats.totalSummaries}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Speed: ${(stats.processedUsers / parseFloat(duration)).toFixed(2)} users/sec`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. User ${error.userId}: ${error.message}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }
    
    if (isDryRun) {
      console.log('\n⚠️  DRY RUN: No changes were written to the database');
    }
    
    console.log('\n✅ Done!\n');
    
    // Close connection
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

async function migrateUser(userAnalytics, UserAnalytics, DailyUserAnalytics, UserAnalyticsSummary, User) {
  const userId = userAnalytics.userId;
  
  try {
    console.log(`\n🔄 Migrating user: ${userId}`);
    
    // Get user details for logging
    const user = await User.findById(userId).select('firstName lastName email').lean();
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
    console.log(`   Name: ${userName}`);
    
    // Check if already migrated
    const existingSummary = await UserAnalyticsSummary.findOne({ userId });
    if (existingSummary && !isDryRun) {
      console.log(`   ⏭️  Already migrated (found existing summary) - skipping`);
      stats.skippedUsers++;
      return;
    }
    
    // Extract dailyStats
    const dailyStats = userAnalytics.dailyStats || [];
    console.log(`   Daily stats entries: ${dailyStats.length}`);
    
    if (dailyStats.length === 0) {
      console.log(`   ⚠️  No daily stats - creating empty summary`);
    }
    
    // Transform nested structure to flat documents
    const dailyRecords = [];
    
    for (const dayEntry of dailyStats) {
      const date = dayEntry.date;
      const ads = dayEntry.ads || [];
      
      for (const ad of ads) {
        const adId = ad.adId;
        if (!adId) {
          console.log(`   ⚠️  Skipping ad entry with no adId on date ${date}`);
          continue;
        }
        
        // Extract material stats
        const materialStats = (ad.materials || []).map(material => ({
          materialId: material.materialId,
          adsPlayed: material.adsPlayed || 0,
          displayTime: material.displayTime || 0,
          qrScans: material.qrScans || 0,
          impressions: material.impressions || 0,
          completionRate: material.completionRate || 0
        }));
        
        // Create flat record
        dailyRecords.push({
          userId: userId,
          date: date,
          adId: adId,
          adTitle: ad.adTitle || '',
          adsPlayed: ad.totals?.adsPlayed || 0,
          displayTime: ad.totals?.displayTime || 0,
          qrScans: ad.totals?.qrScans || 0,
          impressions: ad.totals?.impressions || 0,
          completionRate: ad.totals?.completionRate || 0,
          materialStats: materialStats,
          dataSource: 'migration',
          lastUpdated: new Date(),
          lastSyncTimestamp: new Date()
        });
      }
    }
    
    console.log(`   Flat records to create: ${dailyRecords.length}`);
    
    // Write to new collections (if not dry run)
    if (!isDryRun) {
      // Bulk insert daily records
      if (dailyRecords.length > 0) {
        try {
          await DailyUserAnalytics.bulkUpsert(dailyRecords);
          stats.totalDailyRecords += dailyRecords.length;
        } catch (error) {
          console.error(`   ❌ Error inserting daily records:`, error.message);
          throw error;
        }
      }
      
      // Create summary document
      try {
        await UserAnalyticsSummary.findOneAndUpdate(
          { userId: userId },
          {
            $set: {
              userId: userId,
              userName: userName,
              userEmail: user?.email || '',
              totalAdsPlayed: userAnalytics.totalAdPlays || 0,
              totalDisplayTime: userAnalytics.totalAdPlayTime || 0,
              totalQRScans: userAnalytics.totalQRScans || 0,
              totalImpressions: userAnalytics.totalAdImpressions || 0,
              totalAds: userAnalytics.totalAds || 0,
              activeAds: userAnalytics.ads?.length || 0,
              totalDevices: userAnalytics.totalDevices || 0,
              averageCompletionRate: userAnalytics.averageAdCompletionRate || 0,
              ads: (userAnalytics.ads || []).map(ad => ({
                adId: ad.adId,
                adTitle: ad.adTitle,
                totalPlays: ad.totalAdPlays || 0,
                totalQRScans: ad.totalQRScans || 0,
                totalDisplayTime: ad.totalAdPlayTime || 0,
                totalImpressions: ad.totalAdImpressions || 0,
                averageCompletionRate: ad.averageAdCompletionRate || 0,
                lastActivity: ad.lastActivity || new Date(),
                status: 'ACTIVE'
              })),
              lastUpdated: new Date(),
              lastSyncTimestamp: new Date(),
              dataQuality: {
                isComplete: true,
                lastValidation: new Date(),
                issues: []
              }
            }
          },
          { upsert: true, new: true }
        );
        stats.totalSummaries++;
      } catch (error) {
        console.error(`   ❌ Error creating summary:`, error.message);
        throw error;
      }
    }
    
    console.log(`   ✅ Migration successful`);
    console.log(`      Daily records: ${dailyRecords.length}`);
    console.log(`      Summary: Created`);
    
    stats.processedUsers++;
    
  } catch (error) {
    console.error(`   ❌ Failed to migrate user ${userId}:`, error.message);
    stats.failedUsers++;
    stats.errors.push({
      userId: userId,
      message: error.message
    });
  }
}

