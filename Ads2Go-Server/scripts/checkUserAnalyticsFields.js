/**
 * Quick script to check the fields in UserAnalytics documents
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function checkFields() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Get a few sample documents
    const docs = await UserAnalytics.find({}).limit(4).lean();

    console.log(`📊 Found ${docs.length} sample documents:\n`);

    docs.forEach((doc, idx) => {
      console.log(`--- Document ${idx + 1} ---`);
      console.log(`userId: ${doc.userId}`);
      console.log(`userName: ${doc.userName}`);
      console.log(`Has adPerformance field: ${doc.adPerformance !== undefined ? '❌ YES' : '✅ NO'}`);
      console.log(`Has summary field: ${doc.summary !== undefined ? '❌ YES' : '✅ NO'}`);
      console.log(`Has qrScanConversionRate field: ${doc.qrScanConversionRate !== undefined ? '❌ YES' : '✅ NO'}`);
      console.log(`Fields in document:`, Object.keys(doc).join(', '));
      console.log('');
    });

    // Count documents with each redundant field
    const withAdPerformance = await UserAnalytics.countDocuments({ adPerformance: { $exists: true } });
    const withSummary = await UserAnalytics.countDocuments({ summary: { $exists: true } });
    const withQrScanConversionRate = await UserAnalytics.countDocuments({ qrScanConversionRate: { $exists: true } });

    console.log('📊 Summary:');
    console.log(`   Documents with adPerformance: ${withAdPerformance}`);
    console.log(`   Documents with summary: ${withSummary}`);
    console.log(`   Documents with qrScanConversionRate: ${withQrScanConversionRate}`);

    if (withAdPerformance === 0 && withSummary === 0 && withQrScanConversionRate === 0) {
      console.log('\n✅ All redundant fields have been removed!');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFields();

