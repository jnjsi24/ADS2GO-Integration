/**
 * UserAnalytics Audit Script
 * 
 * This script checks the UserAnalytics collection and verifies:
 * 1. If users have ads in the Ads collection
 * 2. If DeviceDataHistoryV2 has data for those users
 * 3. If UserAnalytics data matches what's in DeviceDataHistoryV2
 * 4. Reports discrepancies and missing data
 * 
 * Usage:
 *   node scripts/auditUserAnalytics.js
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Load .env file - try multiple locations
const envPaths = [
  path.join(__dirname, '..', '.env'), // Ads2Go-Server/.env
  path.join(__dirname, '..', '..', '.env'), // Root .env
  path.join(process.cwd(), '.env'), // Current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    envLoaded = true;
    console.log(`✅ Found .env file at: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found, using environment variables');
}

// Add the server directory to the path so we can require models
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!mongoUri) {
  console.error('❌ MongoDB URI not found in environment variables');
  console.error('Please set MONGODB_URI or DATABASE_URL in your .env file');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
  runAudit();
}).catch(error => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

async function runAudit() {
  try {
    const UserAnalytics = require('../src/models/userAnalytics');
    const Ad = require('../src/models/Ad');
    const User = require('../src/models/User');
    const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');

    console.log('\n📊 Starting UserAnalytics Audit...\n');
    console.log('='.repeat(80));

    // Get all UserAnalytics documents
    const userAnalyticsDocs = await UserAnalytics.find({}).lean();
    console.log(`\n📋 Found ${userAnalyticsDocs.length} UserAnalytics documents\n`);
    
    // Pre-fetch all users for better performance and display
    const userIds = userAnalyticsDocs.map(ua => ua.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('_id firstName lastName email').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const auditResults = {
      totalUsers: userAnalyticsDocs.length,
      usersWithAds: 0,
      usersWithoutAds: 0,
      usersWithData: 0,
      usersWithoutData: 0,
      discrepancies: [],
      missingData: []
    };

    // Audit each user
    for (let i = 0; i < userAnalyticsDocs.length; i++) {
      const ua = userAnalyticsDocs[i];
      const userId = ua.userId;

      // 1. Get user from pre-fetched map
      const user = userMap.get(userId.toString());
      if (!user) {
        console.log(`\n[${i + 1}/${userAnalyticsDocs.length}] Auditing user: ${userId}`);
        console.log(`  👤 User Name: ❌ User not found in Users collection`);
        auditResults.discrepancies.push({
          userId,
          userName: 'Unknown User',
          issue: 'User not found in Users collection',
          userAnalytics: ua
        });
        continue;
      }

      // Display userId and user name prominently
      const userName = `${user.firstName} ${user.lastName}`;
      console.log(`\n[${i + 1}/${userAnalyticsDocs.length}] Auditing user: ${userId}`);
      console.log(`  👤 User Name: ${userName} (${user.email || 'no email'})`);

      // 2. Check if user has ads
      const userAds = await Ad.find({
        userId: userId,
        paymentStatus: 'PAID',
        adStatus: 'ACTIVE',
        status: { $in: ['RUNNING', 'APPROVED', 'SCHEDULED'] }
      }).select('_id title status paymentStatus adStatus createdAt materialId targetDevices').lean();

      console.log(`  📢 Active Paid Ads: ${userAds.length}`);

      if (userAds.length === 0) {
        auditResults.usersWithoutAds++;
        console.log(`  ✅ Expected: UserAnalytics.ads should be empty (user has no ads)`);
        
        // Check if UserAnalytics has ads (should be empty)
        if (ua.ads && ua.ads.length > 0) {
          console.log(`  ❌ DISCREPANCY: UserAnalytics has ${ua.ads.length} ads but user has no active paid ads!`);
          auditResults.discrepancies.push({
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            issue: 'UserAnalytics has ads but user has no active paid ads',
            userAnalyticsAdsCount: ua.ads.length,
            actualAdsCount: 0
          });
        }
        continue;
      }

      auditResults.usersWithAds++;
      console.log(`  📋 Ads: ${userAds.map(ad => ad.title).join(', ')}`);

      // 3. Check UserAnalytics.ads array
      const uaAdsCount = ua.ads ? ua.ads.length : 0;
      console.log(`  📊 UserAnalytics.ads count: ${uaAdsCount}`);

      if (uaAdsCount === 0) {
        console.log(`  ⚠️  WARNING: UserAnalytics.ads is empty but user has ${userAds.length} active paid ads!`);
        auditResults.missingData.push({
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          issue: 'UserAnalytics.ads is empty but user has active paid ads',
          expectedAdsCount: userAds.length,
          actualAdsCount: 0,
          ads: userAds.map(ad => ({ id: ad._id, title: ad.title }))
        });
      } else if (uaAdsCount !== userAds.length) {
        console.log(`  ⚠️  WARNING: UserAnalytics.ads count (${uaAdsCount}) doesn't match actual ads count (${userAds.length})`);
        auditResults.discrepancies.push({
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          issue: 'UserAnalytics.ads count mismatch',
          expectedAdsCount: userAds.length,
          actualAdsCount: uaAdsCount
        });
      }

      // 4. Check if DeviceDataHistoryV2 has data for this user's ads
      const userAdIds = userAds.map(ad => ad._id.toString());
      console.log(`  🔍 Checking DeviceDataHistoryV2 for ad data...`);

      // Get materialIds for user's ads
      // ✅ FIX: Check BOTH materialId and targetDevices fields
      const Material = require('../src/models/Material');
      const allMaterialRefs = [];
      
      for (const ad of userAds) {
        // Check materialId field (array of ObjectIds)
        if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
          allMaterialRefs.push(...ad.materialId);
          console.log(`    📋 Ad "${ad.title}": materialId count = ${ad.materialId.length}`);
        }
        
        // Check targetDevices field (array of ObjectIds)
        if (ad.targetDevices && Array.isArray(ad.targetDevices) && ad.targetDevices.length > 0) {
          allMaterialRefs.push(...ad.targetDevices);
          console.log(`    📋 Ad "${ad.title}": targetDevices count = ${ad.targetDevices.length}`);
        }
        
        // If neither field has data, log it
        if ((!ad.materialId || ad.materialId.length === 0) && 
            (!ad.targetDevices || ad.targetDevices.length === 0)) {
          console.log(`    ⚠️  Ad "${ad.title}": NO materials/devices assigned (both materialId and targetDevices are empty)`);
        }
      }

      // Remove duplicates
      const uniqueMaterialRefs = [...new Set(allMaterialRefs.map(ref => ref.toString()))];
      console.log(`  📦 Total unique material references: ${uniqueMaterialRefs.length}`);

      let materialIds = [];
      if (uniqueMaterialRefs.length > 0) {
        const materials = await Material.find({ 
          _id: { $in: uniqueMaterialRefs.map(id => new mongoose.Types.ObjectId(id)) } 
        }).select('materialId').lean();
        materialIds = materials.map(m => m.materialId).filter(Boolean);
        console.log(`  📦 Found ${materialIds.length} materials with materialId values`);
      }

      if (materialIds.length === 0) {
        console.log(`  ⚠️  WARNING: User has ads but no materials/devices assigned!`);
        auditResults.missingData.push({
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          issue: 'User has ads but no materials/devices assigned',
          adsCount: userAds.length,
          materialsCount: 0
        });
        continue;
      }

      // Check DeviceDataHistoryV2 for data
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Check if any DeviceDataHistoryV2 documents exist for these materials
      let historyData = [];
      try {
        // First, check if documents exist
        const docCount = await DeviceDataHistoryV2.countDocuments({
          materialId: { $in: materialIds }
        });
        
        console.log(`  📦 DeviceDataHistoryV2 documents with these materials: ${docCount}`);
        
        if (docCount > 0) {
          // Try to aggregate data
          historyData = await DeviceDataHistoryV2.aggregate([
            {
              $match: {
                materialId: { $in: materialIds }
              }
            },
            {
              $unwind: '$dailyData'
            },
            {
              $match: {
                'dailyData.date': { $gte: thirtyDaysAgo },
                'dailyData.adPlaybacks': { $exists: true, $ne: [] }
              }
            },
            {
              $unwind: '$dailyData.adPlaybacks'
            },
            {
              $match: {
                $or: [
                  // Try string match first
                  { 'dailyData.adPlaybacks.adId': { $in: userAdIds } },
                  // Try ObjectId match
                  { 'dailyData.adPlaybacks.adId': { 
                    $in: userAdIds.map(id => {
                      try {
                        return new mongoose.Types.ObjectId(id);
                      } catch (e) {
                        return null;
                      }
                    }).filter(Boolean)
                  }}
                ]
              }
            },
            {
              $group: {
                _id: null,
                totalPlays: { $sum: 1 },
                materials: { $addToSet: '$materialId' },
                dates: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$dailyData.date' } } }
              }
            }
          ]).allowDiskUse(true);
        }
      } catch (error) {
        console.log(`  ⚠️  Error querying DeviceDataHistoryV2: ${error.message}`);
      }

      const hasHistoryData = historyData.length > 0 && historyData[0] && historyData[0].totalPlays > 0;
      console.log(`  📈 DeviceDataHistoryV2 data (last 30 days): ${hasHistoryData ? 'YES' : 'NO'}`);

      if (hasHistoryData) {
        const data = historyData[0];
        console.log(`    - Total ad plays: ${data.totalPlays}`);
        console.log(`    - Materials with data: ${data.materials.length}`);
        console.log(`    - Days with data: ${data.dates.length}`);

        auditResults.usersWithData++;

        // Check if UserAnalytics has this data
        if (ua.totalAdPlays === 0 && ua.dailyStats.length === 0 && ua.materialBreakdown.length === 0) {
          console.log(`  ❌ DISCREPANCY: DeviceDataHistoryV2 has data but UserAnalytics is empty!`);
          auditResults.discrepancies.push({
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            issue: 'DeviceDataHistoryV2 has data but UserAnalytics is empty',
            historyDataPlays: data.totalPlays,
            userAnalyticsPlays: ua.totalAdPlays,
            userAnalyticsDailyStats: ua.dailyStats.length,
            userAnalyticsMaterialBreakdown: ua.materialBreakdown.length
          });
        } else {
          console.log(`  ✅ UserAnalytics has data: totalAdPlays=${ua.totalAdPlays}, dailyStats=${ua.dailyStats.length}, materialBreakdown=${ua.materialBreakdown.length}`);
        }
      } else {
        auditResults.usersWithoutData++;
        console.log(`  ℹ️  No data in DeviceDataHistoryV2 (last 7 days) - UserAnalytics empty is expected`);
        
        // Check if UserAnalytics has old data
        if (ua.totalAdPlays > 0 || ua.dailyStats.length > 0 || ua.materialBreakdown.length > 0) {
          console.log(`  ⚠️  NOTE: UserAnalytics has data but no recent data in DeviceDataHistoryV2 (might be older data)`);
        }
      }

      // 5. Check dailyStats
      console.log(`  📅 UserAnalytics.dailyStats count: ${ua.dailyStats ? ua.dailyStats.length : 0}`);
      if (ua.dailyStats && ua.dailyStats.length > 0) {
        const latestDate = ua.dailyStats[ua.dailyStats.length - 1].date;
        const oldestDate = ua.dailyStats[0].date;
        console.log(`    - Date range: ${oldestDate} to ${latestDate}`);
        const totalPlays = ua.dailyStats.reduce((sum, stat) => sum + (stat.adsPlayed || 0), 0);
        console.log(`    - Total plays in dailyStats: ${totalPlays}`);
      }

      // 6. Check materialBreakdown
      console.log(`  📦 UserAnalytics.materialBreakdown count: ${ua.materialBreakdown ? ua.materialBreakdown.length : 0}`);
      if (ua.materialBreakdown && ua.materialBreakdown.length > 0) {
        const totalPlays = ua.materialBreakdown.reduce((sum, mat) => sum + (mat.totalAdPlays || 0), 0);
        console.log(`    - Total plays in materialBreakdown: ${totalPlays}`);
      }

      // 7. Check totals
      console.log(`  📊 UserAnalytics totals:`);
      console.log(`    - totalAdPlays: ${ua.totalAdPlays}`);
      console.log(`    - totalQRScans: ${ua.totalQRScans}`);
      console.log(`    - totalMaterials: ${ua.totalMaterials}`);
      console.log(`    - totalDevices: ${ua.totalDevices}`);
      console.log(`    - lastUpdated: ${ua.lastUpdated}`);
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 AUDIT SUMMARY\n');
    console.log(`Total users audited: ${auditResults.totalUsers}`);
    console.log(`Users with active paid ads: ${auditResults.usersWithAds}`);
    console.log(`Users without active paid ads: ${auditResults.usersWithoutAds}`);
    console.log(`Users with data in DeviceDataHistoryV2: ${auditResults.usersWithData}`);
    console.log(`Users without data in DeviceDataHistoryV2: ${auditResults.usersWithoutData}`);
    console.log(`\nDiscrepancies found: ${auditResults.discrepancies.length}`);
    console.log(`Missing data issues: ${auditResults.missingData.length}`);

    if (auditResults.discrepancies.length > 0) {
      console.log('\n❌ DISCREPANCIES:');
      auditResults.discrepancies.forEach((disc, index) => {
        console.log(`\n${index + 1}. User: ${disc.userName || disc.userId}`);
        console.log(`   Issue: ${disc.issue}`);
        if (disc.expectedAdsCount !== undefined) {
          console.log(`   Expected: ${disc.expectedAdsCount}, Actual: ${disc.actualAdsCount}`);
        }
        if (disc.historyDataPlays !== undefined) {
          console.log(`   DeviceDataHistoryV2 plays: ${disc.historyDataPlays}`);
          console.log(`   UserAnalytics plays: ${disc.userAnalyticsPlays}`);
        }
      });
    }

    if (auditResults.missingData.length > 0) {
      console.log('\n⚠️  MISSING DATA:');
      auditResults.missingData.forEach((missing, index) => {
        console.log(`\n${index + 1}. User: ${missing.userName || missing.userId}`);
        console.log(`   Issue: ${missing.issue}`);
        if (missing.expectedAdsCount !== undefined) {
          console.log(`   Expected ads: ${missing.expectedAdsCount}, Actual: ${missing.actualAdsCount}`);
        }
        if (missing.ads) {
          console.log(`   Ads: ${missing.ads.map(a => a.title).join(', ')}`);
        }
      });
    }

    console.log('\n✅ Audit complete!\n');

    // Exit
    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Audit error:', error);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

