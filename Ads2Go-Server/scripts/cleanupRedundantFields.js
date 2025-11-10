/**
 * Combined cleanup script to remove summary and qrScanConversionRate fields
 * This script uses direct MongoDB operations to ensure fields are removed
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

async function cleanupRedundantFields() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('useranalytics');

    // Remove both summary and qrScanConversionRate fields from all documents
    console.log('📋 Removing redundant fields from all UserAnalytics documents...\n');
    console.log('Fields to remove: summary, qrScanConversionRate\n');
    
    const result = await collection.updateMany(
      { 
        $or: [
          { summary: { $exists: true } },
          { qrScanConversionRate: { $exists: true } }
        ]
      },
      { 
        $unset: { 
          summary: '',
          qrScanConversionRate: ''
        } 
      }
    );

    console.log('='.repeat(80));
    console.log('\n📊 CLEANUP SUMMARY\n');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Acknowledged: ${result.acknowledged}`);
    
    if (result.modifiedCount > 0) {
      console.log(`\n✅ Successfully cleaned up ${result.modifiedCount} documents`);
    } else {
      console.log(`\nℹ️  No documents had redundant fields (or they were already removed)`);
    }

    // Verify removal
    const countWithSummary = await collection.countDocuments({ summary: { $exists: true } });
    const countWithQrRate = await collection.countDocuments({ qrScanConversionRate: { $exists: true } });
    
    console.log(`\n🔍 Verification:`);
    console.log(`  - Documents with summary field: ${countWithSummary}`);
    console.log(`  - Documents with qrScanConversionRate field: ${countWithQrRate}`);
    
    if (countWithSummary === 0 && countWithQrRate === 0) {
      console.log('\n✅ All redundant fields have been removed!\n');
    } else {
      console.log(`\n⚠️  Warning: Some documents still have redundant fields\n`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

cleanupRedundantFields();

