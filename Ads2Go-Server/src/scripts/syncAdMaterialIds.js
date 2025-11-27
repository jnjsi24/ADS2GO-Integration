/**
 * Script to sync Ad materialId arrays with AdsDeployment lcdSlots
 * 
 * This fixes ads that were moved before the automatic sync was implemented.
 * Run this once to fix existing data.
 * 
 * Usage: node src/scripts/syncAdMaterialIds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Load all models to avoid schema errors
const User = require('../models/User');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');

async function syncAdMaterialIds() {
  try {
    console.log('🔄 Starting Ad materialId sync...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all ads
    const ads = await Ad.find({});
    console.log(`📊 Found ${ads.length} ads to process\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const ad of ads) {
      try {
        console.log(`\n📝 Processing ad: ${ad.title} (${ad._id})`);
        
        // Find all ACTIVE deployments that have this ad in their lcdSlots (not completed/removed)
        const deployments = await AdsDeployment.find({
          'lcdSlots.adId': ad._id,
          'lcdSlots.status': { $in: ['SCHEDULED', 'RUNNING'] }
        });
        
        if (deployments.length === 0) {
          console.log(`   ⏭️  No active deployments found - skipping`);
          skippedCount++;
          continue;
        }
        
        console.log(`   ℹ️  Found ${deployments.length} active deployment(s)`);
        
        // Get unique material ObjectIds from active deployments only
        const materialIds = [];
        const materialNames = [];
        for (const deployment of deployments) {
          const material = await Material.findOne({ materialId: deployment.materialId });
          if (material && !materialIds.some(id => id.toString() === material._id.toString())) {
            materialIds.push(material._id);
            materialNames.push(deployment.materialId);
            console.log(`   📍 Currently deployed on: ${deployment.materialId}`);
          }
        }
        
        if (materialIds.length === 0) {
          console.log(`   ⚠️  No valid materials found - skipping`);
          skippedCount++;
          continue;
        }
        
        // Update ad's materialId array to only contain current active materials
        const oldMaterialIds = ad.materialId || [];
        ad.materialId = materialIds;
        await ad.save({ validateBeforeSave: false }); // Skip validation to avoid errors on existing data
        
        console.log(`   ✅ Updated materialId array:`);
        console.log(`      Old: [${oldMaterialIds.map(id => id.toString()).join(', ')}]`);
        console.log(`      New: [${materialIds.map(id => id.toString()).join(', ')}]`);
        updatedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing ad ${ad._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log(`   ✅ Updated: ${updatedCount} ads`);
    console.log(`   ⏭️  Skipped: ${skippedCount} ads`);
    console.log(`   ❌ Errors: ${errorCount} ads`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✨ Sync complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the sync
syncAdMaterialIds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

