/**
 * Force Remove totalMaterials Field from UserAnalytics Collection
 * 
 * This script directly removes the totalMaterials field from ALL documents
 * in the UserAnalytics collection using MongoDB's native updateMany.
 * 
 * Usage: node src/scripts/removeTotalMaterials.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Force remove totalMaterials from all documents
 */
async function removeTotalMaterials() {
  try {
    console.log('\n🧹 Force removing totalMaterials field from UserAnalytics collection...\n');
    
    // Get the collection directly (bypass Mongoose schema)
    const db = mongoose.connection.db;
    const collection = db.collection('useranalytics');
    
    // Count documents with totalMaterials
    const countBefore = await collection.countDocuments({ totalMaterials: { $exists: true } });
    console.log(`📊 Found ${countBefore} documents with totalMaterials field\n`);
    
    if (countBefore === 0) {
      console.log('✅ No documents have totalMaterials field. Nothing to remove.\n');
      return;
    }
    
    // Force remove using MongoDB's updateMany (bypasses Mongoose)
    const result = await collection.updateMany(
      { totalMaterials: { $exists: true } },
      { $unset: { totalMaterials: '' } }
    );
    
    console.log(`✅ Update result:`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents\n`);
    
    // Verify removal
    const countAfter = await collection.countDocuments({ totalMaterials: { $exists: true } });
    console.log(`📊 Verification: ${countAfter} documents still have totalMaterials field`);
    
    if (countAfter === 0) {
      console.log('✅ Successfully removed totalMaterials from all documents!\n');
    } else {
      console.log(`⚠️  Warning: ${countAfter} documents still have totalMaterials field`);
      console.log('   This might indicate the field is being re-added by another process.\n');
    }
    
    // Show sample documents to verify (using projection, not select)
    const sample = await collection.findOne({}, { projection: { userName: 1, totalDevices: 1, totalMaterials: 1 } });
    if (sample) {
      console.log('📄 Sample document after removal:');
      console.log(JSON.stringify(sample, null, 2));
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error removing totalMaterials:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await connectDB();
    await removeTotalMaterials();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { removeTotalMaterials };

