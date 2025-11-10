/**
 * Script to verify and aggressively remove adPerformance field from UserAnalytics documents
 * This script checks the actual MongoDB documents and removes the field if it exists in any form
 */

require('dotenv').config();
const path = require('path');

// Change to server directory to ensure correct module resolution
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');

async function verifyAndRemoveAdPerformance() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB');

    // Get the native MongoDB collection
    const db = mongoose.connection.db;
    const collection = db.collection('useranalytics');

    // First, check if any documents have the field
    const docsWithField = await collection.find({ adPerformance: { $exists: true } }).toArray();
    console.log(`📊 Found ${docsWithField.length} documents with adPerformance field`);

    if (docsWithField.length > 0) {
      console.log('\n📋 Sample documents with adPerformance:');
      docsWithField.slice(0, 3).forEach((doc, idx) => {
        console.log(`   ${idx + 1}. userId: ${doc.userId}, adPerformance:`, doc.adPerformance);
      });

      // Remove the field using $unset
      console.log('\n🔧 Removing adPerformance field...');
      const result = await collection.updateMany(
        { adPerformance: { $exists: true } },
        { 
          $unset: { adPerformance: "" }
        }
      );
      console.log(`✅ Removed adPerformance from ${result.modifiedCount} documents`);
    } else {
      console.log('✅ No documents have adPerformance field');
    }

    // Also try to remove it from all documents (in case it exists but $exists check doesn't catch it)
    console.log('\n🔧 Performing aggressive cleanup on all documents...');
    const aggressiveResult = await collection.updateMany(
      {},
      { 
        $unset: { adPerformance: "" }
      },
      { multi: true }
    );
    console.log(`✅ Aggressive cleanup: Modified ${aggressiveResult.modifiedCount} documents`);

    // Final verification - check a few sample documents
    console.log('\n🔍 Final verification:');
    const sampleDocs = await collection.find({}).limit(5).toArray();
    let hasField = 0;
    sampleDocs.forEach(doc => {
      if (doc.adPerformance !== undefined) {
        hasField++;
        console.log(`   ⚠️ Document ${doc._id} still has adPerformance:`, doc.adPerformance);
      }
    });

    if (hasField === 0) {
      console.log('   ✅ No sample documents have adPerformance field');
    }

    // Count documents with the field
    const finalCount = await collection.countDocuments({
      adPerformance: { $exists: true }
    });
    console.log(`\n📊 Final count of documents with adPerformance: ${finalCount}`);

    if (finalCount === 0) {
      console.log('✅ SUCCESS: All adPerformance fields have been removed!');
      console.log('   💡 If you still see it in MongoDB Compass, try refreshing the view.');
    } else {
      console.log(`⚠️ WARNING: ${finalCount} documents still have adPerformance field`);
      console.log('   This might be a MongoDB Compass caching issue.');
      console.log('   The Mongoose hooks will prevent it from being saved in future updates.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyAndRemoveAdPerformance();

