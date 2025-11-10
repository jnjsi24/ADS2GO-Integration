/**
 * Script to remove dailyStats entries where materialId is null
 * This removes incorrectly aggregated entries while keeping proper per-material entries
 * Note: Aggregated entries (adId: null, materialId: null) are kept for backward compatibility
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function removeNullMaterialIdEntries() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Get all UserAnalytics documents
    const allUserAnalytics = await UserAnalytics.find({}).lean();
    console.log(`📊 Found ${allUserAnalytics.length} UserAnalytics documents\n`);

    let totalRemoved = 0;
    let documentsUpdated = 0;

    for (const userAnalytics of allUserAnalytics) {
      const userId = userAnalytics.userId;
      const originalCount = userAnalytics.dailyStats?.length || 0;
      
      // Filter out entries where materialId is null AND adId is not null
      // Keep aggregated entries (adId: null, materialId: null) for backward compatibility
      const filteredStats = (userAnalytics.dailyStats || []).filter(stat => {
        // Keep if materialId is not null (has actual material)
        if (stat.materialId !== null && stat.materialId !== undefined) {
          return true;
        }
        // Keep if it's an aggregated entry (adId: null)
        if (!stat.adId || stat.adId === null) {
          return true;
        }
        // Remove: has adId but materialId is null (incorrectly aggregated)
        return false;
      });

      const removedCount = originalCount - filteredStats.length;
      
      if (removedCount > 0) {
        totalRemoved += removedCount;
        documentsUpdated += 1;
        
        console.log(`User ${userId}:`);
        console.log(`  Original entries: ${originalCount}`);
        console.log(`  Removed entries: ${removedCount} (materialId: null with adId)`);
        console.log(`  Remaining entries: ${filteredStats.length}`);
        console.log('');

        // Update the document
        await UserAnalytics.updateOne(
          { _id: userAnalytics._id },
          { 
            $set: { dailyStats: filteredStats }
          }
        );
      }
    }

    console.log('═'.repeat(80));
    console.log(`📊 Summary:`);
    console.log(`   Documents updated: ${documentsUpdated}`);
    console.log(`   Total entries removed: ${totalRemoved}`);
    console.log(`   Aggregated entries (adId: null) were preserved`);

    // Verify removal
    const sampleDoc = await UserAnalytics.findOne({}).lean();
    if (sampleDoc && sampleDoc.dailyStats) {
      const nullMaterialEntries = sampleDoc.dailyStats.filter(s => 
        s.materialId === null && s.adId !== null
      );
      if (nullMaterialEntries.length === 0) {
        console.log(`\n✅ Verification: No per-ad entries with materialId: null found`);
      } else {
        console.log(`\n⚠️ Warning: ${nullMaterialEntries.length} entries still have materialId: null with adId`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeNullMaterialIdEntries();

