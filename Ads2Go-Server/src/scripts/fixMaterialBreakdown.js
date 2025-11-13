/**
 * Script to fix materialBreakdown array in UserAnalytics
 * Filters materialBreakdown to only include actively deployed devices (matching totalDevices)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const UserAnalytics = require('../models/userAnalytics');
const Ad = require('../models/Ad');
const AdsDeployment = require('../models/adsDeployment');

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ADSTOGO';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Fix materialBreakdown for a single user
 */
async function fixUserMaterialBreakdown(userAnalytics) {
  try {
    const userId = userAnalytics.userId;
    const userName = userAnalytics.userName || 'Unknown';
    
    // Get user's active ads (RUNNING or APPROVED, PAID, ACTIVE)
    const userAds = await Ad.find({
      userId: userId,
      paymentStatus: 'PAID',
      adStatus: 'ACTIVE',
      status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
    }).select('_id title');
    
    if (!userAds || userAds.length === 0) {
      // No active ads - clear materialBreakdown
      const beforeCount = userAnalytics.materialBreakdown?.length || 0;
      userAnalytics.materialBreakdown = [];
      await userAnalytics.save();
      if (beforeCount > 0) {
        console.log(`   🔄 ${userName}: Cleared materialBreakdown (${beforeCount} → 0, no active ads)`);
        return { userId, userName, beforeCount, afterCount: 0, changed: true };
      }
      return { userId, userName, beforeCount: 0, afterCount: 0, changed: false };
    }
    
    // Get active deployments for all user's ads
    const activeDeployments = await AdsDeployment.find({
      'lcdSlots.adId': { $in: userAds.map(ad => ad._id) },
      'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] }
    }).select('materialId lcdSlots');
    
    // Collect unique actively deployed materialIds
    const activeMaterialIds = new Set();
    const userAdIdSet = new Set(userAds.map(ad => ad._id.toString()));
    
    activeDeployments.forEach(deployment => {
      deployment.lcdSlots.forEach(slot => {
        if (['RUNNING', 'SCHEDULED'].includes(slot.status) && slot.adId) {
          const adIdStr = slot.adId.toString ? slot.adId.toString() : String(slot.adId);
          // Only count devices for ads that belong to this user
          if (userAdIdSet.has(adIdStr)) {
            activeMaterialIds.add(deployment.materialId);
          }
        }
      });
    });
    
    // Filter materialBreakdown to only include actively deployed devices
    const beforeCount = userAnalytics.materialBreakdown?.length || 0;
    if (activeMaterialIds.size > 0) {
      userAnalytics.materialBreakdown = (userAnalytics.materialBreakdown || []).filter(
        material => activeMaterialIds.has(material.materialId)
      );
    } else {
      // No active deployments - clear materialBreakdown
      userAnalytics.materialBreakdown = [];
    }
    
    const afterCount = userAnalytics.materialBreakdown.length;
    const changed = beforeCount !== afterCount;
    
    await userAnalytics.save();
    
    if (changed) {
      const changeIndicator = '🔄';
      console.log(`   ${changeIndicator} ${userName}: materialBreakdown ${beforeCount} → ${afterCount} (totalDevices: ${userAnalytics.totalDevices || 0})`);
    } else {
      console.log(`   ✓ ${userName}: materialBreakdown unchanged (${afterCount}, matches totalDevices: ${userAnalytics.totalDevices || 0})`);
    }
    
    return {
      userId,
      userName,
      beforeCount,
      afterCount,
      totalDevices: userAnalytics.totalDevices || 0,
      changed
    };
  } catch (error) {
    console.error(`   ❌ Error fixing materialBreakdown for user ${userAnalytics.userName || userAnalytics.userId}:`, error.message);
    return {
      userId: userAnalytics.userId,
      userName: userAnalytics.userName || 'Unknown',
      error: error.message
    };
  }
}

/**
 * Main function to fix all UserAnalytics documents
 */
async function fixAllMaterialBreakdowns() {
  try {
    await connectDB();
    
    console.log('\n🔧 Starting materialBreakdown fix...\n');
    
    // Get all UserAnalytics documents
    const allUserAnalytics = await UserAnalytics.find({}).lean();
    console.log(`📊 Found ${allUserAnalytics.length} UserAnalytics documents to process\n`);
    
    let fixedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process each user
    for (let i = 0; i < allUserAnalytics.length; i++) {
      const userAnalyticsDoc = allUserAnalytics[i];
      console.log(`[${i + 1}/${allUserAnalytics.length}] Processing user...`);
      
      // Convert to Mongoose document for saving
      const userAnalytics = await UserAnalytics.findById(userAnalyticsDoc._id);
      if (!userAnalytics) {
        console.log(`   ⚠️  UserAnalytics document not found: ${userAnalyticsDoc._id}`);
        errorCount++;
        continue;
      }
      
      const result = await fixUserMaterialBreakdown(userAnalytics);
      results.push(result);
      
      if (result.error) {
        errorCount++;
      } else if (result.changed) {
        fixedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    // Print summary
    console.log('\n============================================================');
    console.log('📊 FIX SUMMARY');
    console.log('============================================================');
    console.log(`Total processed: ${allUserAnalytics.length}`);
    console.log(`✅ Fixed (changed): ${fixedCount}`);
    console.log(`✓  Unchanged: ${unchangedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (fixedCount > 0) {
      console.log('\n🔄 Users with corrected materialBreakdown:');
      results
        .filter(r => r.changed)
        .forEach(r => {
          console.log(`   ${r.userName}: ${r.beforeCount} → ${r.afterCount} (totalDevices: ${r.totalDevices})`);
        });
    }
    
    console.log('\n✅ Fix completed!\n');
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ Error in fixAllMaterialBreakdowns:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixAllMaterialBreakdowns()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script error:', error);
      process.exit(1);
    });
}

module.exports = { fixUserMaterialBreakdown, fixAllMaterialBreakdowns };


