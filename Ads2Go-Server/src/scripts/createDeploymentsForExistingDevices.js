/**
 * Backfill script: Create deployment records for existing devices
 * that have materialId + driverId but no deployment record
 * 
 * This ensures all devices with drivers assigned appear in the Deployment tab
 * even if they don't have any paid ads deployed yet.
 * 
 * Run this script once to backfill existing devices.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');

async function createDeploymentsForExistingDevices() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all materials that:
    // 1. Have materialId (all materials should have this)
    // 2. Have driverId assigned
    // 3. Are not archived
    // 4. Are LCD or HEADDRESS type (these need deployments)
    const materialsNeedingDeployment = await Material.find({
      driverId: { $exists: true, $ne: null },
      isArchived: { $ne: true },
      materialType: { $in: ['LCD', 'HEADDRESS'] }
    });

    console.log(`\n📊 Found ${materialsNeedingDeployment.length} materials with drivers assigned (LCD/HEADDRESS)`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const material of materialsNeedingDeployment) {
      try {
        if (!material.materialId) {
          console.log(`⚠️  Skipping material ${material._id}: No materialId`);
          skippedCount++;
          continue;
        }

        if (!material.driverId) {
          console.log(`⚠️  Skipping material ${material.materialId}: No driverId`);
          skippedCount++;
          continue;
        }

        // Check if deployment already exists
        const existingDeployment = await AdsDeployment.findOne({ materialId: material.materialId });

        if (existingDeployment) {
          // Update driverId if it's different
          if (existingDeployment.driverId.toString() !== material.driverId.toString()) {
            console.log(`🔄 Updating driverId for deployment ${material.materialId}: ${existingDeployment.driverId} → ${material.driverId}`);
            existingDeployment.driverId = material.driverId;
            await existingDeployment.save();
            updatedCount++;
          } else {
            console.log(`ℹ️  Deployment already exists for material ${material.materialId}`);
            skippedCount++;
          }
        } else {
          // Create new deployment
          console.log(`➕ Creating deployment for material ${material.materialId} with driver ${material.driverId}`);
          await AdsDeployment.createOrGetDeployment(
            material.materialId,
            material.driverId
          );
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing material ${material.materialId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   ✅ Created: ${createdCount} deployments`);
    console.log(`   🔄 Updated: ${updatedCount} deployments`);
    console.log(`   ⏭️  Skipped: ${skippedCount} (already exist)`);
    console.log(`   ❌ Errors: ${errorCount}`);

    console.log('\n✅ Backfill completed successfully!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createDeploymentsForExistingDevices()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createDeploymentsForExistingDevices };

