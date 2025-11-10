/**
 * Migration script to reorder UserAnalytics document fields
 * This ensures userName appears right after userId in MongoDB Compass
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
    envLoaded = true;
    console.log(`✅ Found .env file at: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

if (!envLoaded) {
  require('dotenv').config();
}

// Add the server directory to the path so we can require models
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');
const User = require('../src/models/User');

async function reorderFields() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all UserAnalytics documents
    const userAnalyticsDocs = await UserAnalytics.find({}).lean();
    console.log(`📋 Found ${userAnalyticsDocs.length} UserAnalytics documents\n`);
    console.log('='.repeat(80));

    // Pre-fetch all users
    const userIds = userAnalyticsDocs.map(ua => ua.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('_id firstName lastName').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Update each document with correct field order
    for (let i = 0; i < userAnalyticsDocs.length; i++) {
      const ua = userAnalyticsDocs[i];
      const userId = ua.userId.toString();
      const user = userMap.get(userId);
      
      if (!user) {
        console.log(`[${i + 1}/${userAnalyticsDocs.length}] ⚠️  User not found for userId: ${userId}`);
        errorCount++;
        continue;
      }

      const userName = `${user.firstName} ${user.lastName}`.trim();
      
      try {
        // Create a new document with correct field order
        // Fields should be in this order: _id, userId, userName, then all others
        // Note: summary field has been removed as it was redundant with individual total fields
        const reorderedDoc = {
          userId: ua.userId,
          userName: userName,
          ads: ua.ads || [],
          dailyStats: ua.dailyStats || [],
          totalAds: ua.totalAds || 0,
          totalMaterials: ua.totalMaterials || 0,
          totalDevices: ua.totalDevices || 0,
          totalAdPlays: ua.totalAdPlays || 0,
          totalAdPlayTime: ua.totalAdPlayTime || 0,
          totalAdImpressions: ua.totalAdImpressions || 0,
          totalQRScans: ua.totalQRScans || 0,
          averageAdCompletionRate: ua.averageAdCompletionRate || 0,
          // qrScanConversionRate removed - no longer needed
          adPerformance: ua.adPerformance || [],
          materialBreakdown: ua.materialBreakdown || [],
          errorLogs: ua.errorLogs || [],
          isActive: ua.isActive !== undefined ? ua.isActive : true,
          lastUpdated: ua.lastUpdated || ua.updatedAt || new Date(),
          createdAt: ua.createdAt || new Date(),
          updatedAt: ua.updatedAt || new Date(),
          lastSyncTimestamp: ua.lastSyncTimestamp || null,
          lastAnalyticsAccess: ua.lastAnalyticsAccess || null,
          __v: ua.__v || 0
        };

        // Use replaceOne to replace the entire document with correct field order
        await UserAnalytics.replaceOne(
          { _id: ua._id },
          reorderedDoc
        );
        
        console.log(`[${i + 1}/${userAnalyticsDocs.length}] ✅ Reordered: ${userName} (${userId})`);
        updatedCount++;
      } catch (error) {
        console.error(`[${i + 1}/${userAnalyticsDocs.length}] ❌ Error reordering ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 REORDERING SUMMARY\n');
    console.log(`Total documents: ${userAnalyticsDocs.length}`);
    console.log(`✅ Reordered: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n✅ Reordering complete!');
    console.log('💡 Note: In MongoDB Compass, userName should now appear right after userId\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Reordering error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

reorderFields();

