const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Migration script to convert materialId from single ObjectId to array
async function migrateMaterialIdToArray() {
  try {
    console.log('🔄 Starting migration: materialId to array...');
    
    // Get the Ad collection
    const Ad = mongoose.model('Ad', new mongoose.Schema({}, { strict: false }));
    
    // Find all ads with materialId as single ObjectId (not array)
    const adsToMigrate = await Ad.find({
      materialId: { $type: "objectId" }
    });
    
    console.log(`📊 Found ${adsToMigrate.length} ads to migrate`);
    
    if (adsToMigrate.length === 0) {
      console.log('✅ No ads need migration - all materialId fields are already arrays');
      return;
    }
    
    // Show some examples before migration
    console.log('\n📋 Sample ads before migration:');
    adsToMigrate.slice(0, 3).forEach((ad, index) => {
      console.log(`${index + 1}. Ad ID: ${ad._id}`);
      console.log(`   Title: ${ad.title}`);
      console.log(`   Current materialId: ${ad.materialId} (type: ${typeof ad.materialId})`);
      console.log(`   targetDevices: ${ad.targetDevices?.length || 0} devices`);
      console.log('');
    });
    
    // Perform the migration
    let migratedCount = 0;
    for (const ad of adsToMigrate) {
      try {
        // Convert single materialId to array
        const result = await Ad.updateOne(
          { _id: ad._id },
          { $set: { materialId: [ad.materialId] } }
        );
        
        if (result.modifiedCount > 0) {
          migratedCount++;
          console.log(`✅ Migrated ad: ${ad._id} - "${ad.title}"`);
        }
      } catch (error) {
        console.error(`❌ Error migrating ad ${ad._id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Successfully migrated: ${migratedCount}/${adsToMigrate.length} ads`);
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const remainingSingleIds = await Ad.find({
      materialId: { $type: "objectId" }
    });
    
    if (remainingSingleIds.length === 0) {
      console.log('✅ Verification successful - all materialId fields are now arrays');
    } else {
      console.log(`⚠️ Warning: ${remainingSingleIds.length} ads still have single materialId`);
    }
    
    // Show some examples after migration
    const sampleMigratedAds = await Ad.find({}).limit(3);
    console.log('\n📋 Sample ads after migration:');
    sampleMigratedAds.forEach((ad, index) => {
      console.log(`${index + 1}. Ad ID: ${ad._id}`);
      console.log(`   Title: ${ad.title}`);
      console.log(`   materialId: [${ad.materialId.length} materials] ${ad.materialId}`);
      console.log(`   targetDevices: ${ad.targetDevices?.length || 0} devices`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Rollback function (in case you need to revert)
async function rollbackMaterialIdToSingle() {
  try {
    console.log('🔄 Starting rollback: array to single materialId...');
    
    const Ad = mongoose.model('Ad', new mongoose.Schema({}, { strict: false }));
    
    // Find all ads with materialId as array
    const adsToRollback = await Ad.find({
      materialId: { $type: "array" }
    });
    
    console.log(`📊 Found ${adsToRollback.length} ads to rollback`);
    
    let rolledBackCount = 0;
    for (const ad of adsToRollback) {
      try {
        // Convert array back to single materialId (use first element)
        const result = await Ad.updateOne(
          { _id: ad._id },
          { $set: { materialId: ad.materialId[0] } }
        );
        
        if (result.modifiedCount > 0) {
          rolledBackCount++;
          console.log(`✅ Rolled back ad: ${ad._id} - "${ad.title}"`);
        }
      } catch (error) {
        console.error(`❌ Error rolling back ad ${ad._id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Rollback completed!`);
    console.log(`📊 Successfully rolled back: ${rolledBackCount}/${adsToRollback.length} ads`);
    
  } catch (error) {
    console.error('❌ Rollback error:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  
  const command = process.argv[2];
  
  if (command === 'rollback') {
    await rollbackMaterialIdToSingle();
  } else {
    await migrateMaterialIdToArray();
  }
  
  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
}

// Run the migration
main().catch(console.error);
