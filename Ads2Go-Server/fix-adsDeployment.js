const mongoose = require('mongoose');
const AdsDeployment = require('./src/models/adsDeployment');
const Material = require('./src/models/Material');

// You can replace this with your actual MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/ads2go'; // Change this to your actual MongoDB URI

async function fixAdsDeploymentMaterialIds() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📝 Using connection string:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Finding all AdsDeployment records...');
    const deployments = await AdsDeployment.find({});
    console.log(`📊 Found ${deployments.length} AdsDeployment records`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const deployment of deployments) {
      console.log(`\n🔍 Processing deployment: ${deployment._id}`);
      console.log(`   Current materialId: ${deployment.materialId} (type: ${typeof deployment.materialId})`);

      // Check if materialId is an ObjectId (24 character hex string)
      if (mongoose.Types.ObjectId.isValid(deployment.materialId) && deployment.materialId.length === 24) {
        console.log('   ⚠️  Found ObjectId materialId, attempting to convert...');

        try {
          // Find the material by ObjectId
          const material = await Material.findById(deployment.materialId);
          
          if (material && material.materialId) {
            console.log(`   ✅ Found material: ${material.materialId}`);
            
            // Update the deployment with the string materialId
            deployment.materialId = material.materialId;
            await deployment.save();
            
            console.log(`   ✅ Migrated to string materialId: ${material.materialId}`);
            migratedCount++;
          } else {
            console.log('   ❌ Material not found, skipping...');
            skippedCount++;
          }
        } catch (error) {
          console.log(`   ❌ Error processing deployment: ${error.message}`);
          skippedCount++;
        }
      } else {
        console.log('   ✅ Already using string materialId, skipping...');
        skippedCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} deployments`);
    console.log(`   ⏭️  Skipped: ${skippedCount} deployments`);
    console.log(`   📊 Total: ${deployments.length} deployments`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const allDeployments = await AdsDeployment.find({});
    const objectIdDeployments = allDeployments.filter(d => 
      mongoose.Types.ObjectId.isValid(d.materialId) && d.materialId.length === 24
    );
    
    if (objectIdDeployments.length === 0) {
      console.log('✅ All AdsDeployment records now use string materialId');
    } else {
      console.log(`⚠️  Found ${objectIdDeployments.length} deployments still using ObjectId materialId`);
      objectIdDeployments.forEach(d => {
        console.log(`   - ${d._id}: ${d.materialId}`);
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

// Run the migration
fixAdsDeploymentMaterialIds()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
