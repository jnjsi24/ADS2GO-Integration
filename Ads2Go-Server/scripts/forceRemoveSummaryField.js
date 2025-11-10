/**
 * Force remove summary field from UserAnalytics documents using direct MongoDB operations
 * This script uses $unset to permanently remove the summary field
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

async function forceRemoveSummaryField() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('useranalytics');

    // Use updateMany with $unset to remove summary field from all documents
    console.log('📋 Removing summary field from all UserAnalytics documents...\n');
    
    const result = await collection.updateMany(
      { summary: { $exists: true } },
      { $unset: { summary: '' } }
    );

    console.log('='.repeat(80));
    console.log('\n📊 MIGRATION SUMMARY\n');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Acknowledged: ${result.acknowledged}`);
    
    if (result.modifiedCount > 0) {
      console.log(`\n✅ Successfully removed summary field from ${result.modifiedCount} documents`);
    } else {
      console.log(`\nℹ️  No documents had the summary field (or it was already removed)`);
    }

    // Verify removal
    const countWithSummary = await collection.countDocuments({ summary: { $exists: true } });
    console.log(`\n🔍 Verification: ${countWithSummary} documents still have summary field`);
    
    if (countWithSummary === 0) {
      console.log('✅ All summary fields have been removed!\n');
    } else {
      console.log(`⚠️  Warning: ${countWithSummary} documents still have summary field\n`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

forceRemoveSummaryField();

