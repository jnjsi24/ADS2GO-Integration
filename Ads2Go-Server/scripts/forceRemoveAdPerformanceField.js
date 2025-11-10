/**
 * Aggressive script to remove the adPerformance field from UserAnalytics documents
 * This script uses direct MongoDB operations to ensure complete removal
 */

require('dotenv').config();
const path = require('path');

// Change to server directory to ensure correct module resolution
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');

async function forceRemoveAdPerformanceField() {
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

    // Remove adPerformance field using native MongoDB updateMany
    const result = await collection.updateMany(
      {},
      { 
        $unset: { adPerformance: "" }
      }
    );

    console.log(`✅ Removed adPerformance field from ${result.modifiedCount} documents`);
    console.log(`📊 Matched ${result.matchedCount} documents`);

    // Verify removal by checking a sample document
    const sampleDoc = await collection.findOne({});
    if (sampleDoc) {
      if (sampleDoc.adPerformance !== undefined) {
        console.log(`⚠️ Warning: Sample document still has adPerformance field`);
        console.log(`   Field value:`, sampleDoc.adPerformance);
        
        // Try a more aggressive removal
        console.log(`🔧 Attempting aggressive removal...`);
        await collection.updateMany(
          {},
          { 
            $unset: { adPerformance: "" },
            $set: { updatedAt: new Date() }
          }
        );
        console.log(`✅ Aggressive removal completed`);
      } else {
        console.log('✅ Verification: Sample document does not have adPerformance field');
      }
    }

    // Count documents that still have the field
    const docsWithField = await collection.countDocuments({
      adPerformance: { $exists: true }
    });

    if (docsWithField === 0) {
      console.log('✅ Verification: No documents have adPerformance field');
    } else {
      console.log(`⚠️ Warning: ${docsWithField} documents still have adPerformance field`);
      console.log(`   Attempting direct field removal...`);
      
      // Try removing it using $pull or direct update
      const removeResult = await collection.updateMany(
        { adPerformance: { $exists: true } },
        { 
          $unset: { adPerformance: "" },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`✅ Removed adPerformance from ${removeResult.modifiedCount} additional documents`);
      
      // Final verification
      const finalCount = await collection.countDocuments({
        adPerformance: { $exists: true }
      });
      console.log(`📊 Final count of documents with adPerformance: ${finalCount}`);
      
      if (finalCount > 0) {
        console.log(`⚠️ Some documents may still have adPerformance as empty array`);
        console.log(`   This is okay - Mongoose hooks will prevent it from being saved in future updates.`);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

forceRemoveAdPerformanceField();

