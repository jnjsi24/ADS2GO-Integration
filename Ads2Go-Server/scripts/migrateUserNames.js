/**
 * Migration script to populate userName field in UserAnalytics documents
 * This script fetches user names from the User collection and updates
 * all UserAnalytics documents with the userName field.
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

async function migrateUserNames() {
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

    // Update each document
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
      
      // Check if userName needs to be updated
      if (ua.userName === userName) {
        console.log(`[${i + 1}/${userAnalyticsDocs.length}] ✅ ${userName} (${userId}) - Already up to date`);
        skippedCount++;
        continue;
      }

      try {
        // Update the document
        await UserAnalytics.updateOne(
          { _id: ua._id },
          { $set: { userName: userName } }
        );
        
        console.log(`[${i + 1}/${userAnalyticsDocs.length}] ✅ Updated: ${userName} (${userId})`);
        if (ua.userName) {
          console.log(`    Changed from: "${ua.userName}" to "${userName}"`);
        } else {
          console.log(`    Added userName: "${userName}"`);
        }
        updatedCount++;
      } catch (error) {
        console.error(`[${i + 1}/${userAnalyticsDocs.length}] ❌ Error updating ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 MIGRATION SUMMARY\n');
    console.log(`Total documents: ${userAnalyticsDocs.length}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped (already up to date): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n✅ Migration complete!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

migrateUserNames();

