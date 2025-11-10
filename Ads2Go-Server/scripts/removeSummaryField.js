/**
 * Migration script to remove the redundant summary field from UserAnalytics documents
 * The summary field is redundant because the same data exists in individual total fields
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

async function removeSummaryField() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all UserAnalytics documents that have a summary field
    const userAnalyticsDocs = await UserAnalytics.find({ summary: { $exists: true } }).lean();
    console.log(`📋 Found ${userAnalyticsDocs.length} UserAnalytics documents with summary field\n`);
    console.log('='.repeat(80));

    if (userAnalyticsDocs.length === 0) {
      console.log('✅ No documents found with summary field. Nothing to migrate.\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Remove summary field from each document
    for (let i = 0; i < userAnalyticsDocs.length; i++) {
      const ua = userAnalyticsDocs[i];
      const userId = ua.userId.toString();
      const userName = ua.userName || 'Unknown';
      
      try {
        // Use $unset to remove the summary field
        await UserAnalytics.updateOne(
          { _id: ua._id },
          { $unset: { summary: '' } }
        );
        
        console.log(`[${i + 1}/${userAnalyticsDocs.length}] ✅ Removed summary field: ${userName} (${userId})`);
        updatedCount++;
      } catch (error) {
        console.error(`[${i + 1}/${userAnalyticsDocs.length}] ❌ Error removing summary from ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 MIGRATION SUMMARY\n');
    console.log(`Total documents with summary field: ${userAnalyticsDocs.length}`);
    console.log(`✅ Removed summary field: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n✅ Migration complete!');
    console.log('💡 Note: The summary field has been removed. Individual total fields are used instead.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

removeSummaryField();

