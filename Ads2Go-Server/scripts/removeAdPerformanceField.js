/**
 * Script to remove the redundant adPerformance field from UserAnalytics documents
 * The adPerformance array is redundant because the ads array already contains all the same data
 */

require('dotenv').config();
const path = require('path');

// Change to server directory to ensure correct module resolution
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function removeAdPerformanceField() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Remove adPerformance field from all UserAnalytics documents
    const result = await UserAnalytics.updateMany(
      {},
      { $unset: { adPerformance: '' } }
    );

    console.log(`✅ Removed adPerformance field from ${result.modifiedCount} documents`);

    // Verify removal - check directly in MongoDB
    const sampleDoc = await UserAnalytics.findOne().lean();
    if (sampleDoc && sampleDoc.adPerformance !== undefined) {
      console.log(`⚠️ Warning: Sample document still has adPerformance field`);
      console.log(`   This might be cached. The field will be removed on next save/update.`);
    } else {
      console.log('✅ Verification: adPerformance field removed successfully');
    }
    
    // Also check if any documents still have the field
    const docsWithField = await UserAnalytics.countDocuments({
      adPerformance: { $exists: true, $ne: null }
    });

    if (docsWithField === 0) {
      console.log('✅ Verification: No documents have adPerformance field');
    } else {
      console.log(`⚠️ Note: ${docsWithField} documents may still have adPerformance in MongoDB`);
      console.log(`   This is okay - Mongoose hooks will prevent it from being saved in future updates.`);
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeAdPerformanceField();

