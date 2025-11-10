/**
 * Migration script to remove qrScanConversionRate field from UserAnalytics documents
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

async function removeQrScanConversionRate() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('useranalytics');

    // Remove qrScanConversionRate from all documents
    console.log('📋 Removing qrScanConversionRate field from all UserAnalytics documents...\n');
    
    const result = await collection.updateMany(
      { qrScanConversionRate: { $exists: true } },
      { $unset: { qrScanConversionRate: '' } }
    );

    console.log('='.repeat(80));
    console.log('\n📊 MIGRATION SUMMARY\n');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Acknowledged: ${result.acknowledged}`);
    
    if (result.modifiedCount > 0) {
      console.log(`\n✅ Successfully removed qrScanConversionRate field from ${result.modifiedCount} documents`);
    } else {
      console.log(`\nℹ️  No documents had the qrScanConversionRate field (or it was already removed)`);
    }

    // Verify removal
    const countWithField = await collection.countDocuments({ qrScanConversionRate: { $exists: true } });
    console.log(`\n🔍 Verification: ${countWithField} documents still have qrScanConversionRate field`);
    
    if (countWithField === 0) {
      console.log('✅ All qrScanConversionRate fields have been removed!\n');
    } else {
      console.log(`⚠️  Warning: ${countWithField} documents still have qrScanConversionRate field\n`);
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

removeQrScanConversionRate();

