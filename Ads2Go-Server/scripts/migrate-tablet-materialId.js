const mongoose = require('mongoose');
const Tablet = require('../src/models/Tablet');
const Material = require('../src/models/Material');

// MongoDB connection string - update this with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function migrateTabletMaterialIds() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Finding all tablet configurations...');
    const tablets = await Tablet.find({});
    console.log(`📊 Found ${tablets.length} tablet configurations`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const tablet of tablets) {
      console.log(`\n🔍 Processing tablet: ${tablet._id}`);
      console.log(`   Current materialId: ${tablet.materialId} (type: ${typeof tablet.materialId})`);

      // Check if materialId is an ObjectId (24 character hex string)
      if (mongoose.Types.ObjectId.isValid(tablet.materialId) && tablet.materialId.length === 24) {
        console.log('   ⚠️  Found ObjectId materialId, attempting to convert...');

        try {
          // Find the material by ObjectId
          const material = await Material.findById(tablet.materialId);
          
          if (material && material.materialId) {
            console.log(`   ✅ Found material: ${material.materialId}`);
            
            // Update the tablet with the string materialId
            tablet.materialId = material.materialId;
            await tablet.save();
            
            console.log(`   ✅ Migrated to string materialId: ${material.materialId}`);
            migratedCount++;
          } else {
            console.log('   ❌ Material not found, skipping...');
            skippedCount++;
          }
        } catch (error) {
          console.log(`   ❌ Error processing tablet: ${error.message}`);
          skippedCount++;
        }
      } else {
        console.log('   ✅ Already using string materialId, skipping...');
        skippedCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} tablets`);
    console.log(`   ⏭️  Skipped: ${skippedCount} tablets`);
    console.log(`   📊 Total: ${tablets.length} tablets`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const allTablets = await Tablet.find({});
    const objectIdTablets = allTablets.filter(t => 
      mongoose.Types.ObjectId.isValid(t.materialId) && t.materialId.length === 24
    );
    
    if (objectIdTablets.length === 0) {
      console.log('✅ All tablet configurations now use string materialId');
    } else {
      console.log(`⚠️  Found ${objectIdTablets.length} tablets still using ObjectId materialId`);
      objectIdTablets.forEach(t => {
        console.log(`   - ${t._id}: ${t.materialId}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    console.log('\n🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateTabletMaterialIds()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateTabletMaterialIds;
