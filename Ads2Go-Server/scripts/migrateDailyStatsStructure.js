/**
 * Migration script to convert dailyStats from flat structure to nested structure
 * Old: [{ date, adId, materialId, adsPlayed, ... }]
 * New: [{ date, ads: [{ adId, materials: [{ materialId, ... }], totals: {...} }], totals: {...} }]
 */

require('dotenv').config();
const path = require('path');

const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function migrateDailyStatsStructure() {
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

    let documentsUpdated = 0;
    let totalEntriesConverted = 0;

    for (const userAnalytics of allUserAnalytics) {
      const userId = userAnalytics.userId;
      const oldDailyStats = userAnalytics.dailyStats || [];
      
      // Skip if already in new structure (has 'ads' array in first entry)
      if (oldDailyStats.length > 0 && oldDailyStats[0].ads) {
        console.log(`⏭️  User ${userId}: Already in new structure, skipping`);
        continue;
      }
      
      if (oldDailyStats.length === 0) {
        console.log(`⏭️  User ${userId}: No dailyStats, skipping`);
        continue;
      }
      
      console.log(`🔄 User ${userId}: Converting ${oldDailyStats.length} entries...`);
      
      // Group by date, then by adId, then by materialId
      const dailyStatsByDate = new Map();
      
      oldDailyStats.forEach(stat => {
        const dateKey = stat.date;
        if (!dateKey) return;
        
        // Skip aggregated entries (adId: null) - we'll recreate them from per-ad data
        if (!stat.adId) {
          return;
        }
        
        const materialId = stat.materialId || null;
        if (!materialId) {
          console.warn(`  ⚠️  Skipping entry with missing materialId for ad ${stat.adId} on ${dateKey}`);
          return;
        }
        
        // Initialize date entry if needed
        if (!dailyStatsByDate.has(dateKey)) {
          dailyStatsByDate.set(dateKey, {
            date: dateKey,
            ads: new Map(), // Map<adId, { materials: Map<materialId, stats>, totals: {...} }>
            totals: {
              impressions: 0,
              adsPlayed: 0,
              displayTime: 0,
              qrScans: 0,
              completionRates: [],
              completionRate: 0
            }
          });
        }
        
        const dateEntry = dailyStatsByDate.get(dateKey);
        
        // Initialize ad entry if needed
        const adIdStr = stat.adId.toString();
        if (!dateEntry.ads.has(adIdStr)) {
          dateEntry.ads.set(adIdStr, {
            adId: stat.adId,
            materials: new Map(), // Map<materialId, stats>
            totals: {
              impressions: 0,
              adsPlayed: 0,
              displayTime: 0,
              qrScans: 0,
              completionRates: [],
              completionRate: 0
            }
          });
        }
        
        const adEntry = dateEntry.ads.get(adIdStr);
        
        // Store material stats
        adEntry.materials.set(materialId, {
          materialId: materialId,
          impressions: stat.impressions || 0,
          adsPlayed: stat.adsPlayed || 0,
          displayTime: stat.displayTime || 0,
          qrScans: stat.qrScans || 0,
          completionRate: stat.completionRate || 0
        });
        
        // Update ad totals (sum across materials)
        adEntry.totals.impressions += stat.impressions || 0;
        adEntry.totals.adsPlayed += stat.adsPlayed || 0;
        adEntry.totals.displayTime += stat.displayTime || 0;
        adEntry.totals.qrScans += stat.qrScans || 0;
        if (stat.completionRate !== undefined && stat.completionRate > 0) {
          adEntry.totals.completionRates.push(stat.completionRate);
        }
        
        // Update date totals (sum across ads)
        dateEntry.totals.impressions += stat.impressions || 0;
        dateEntry.totals.adsPlayed += stat.adsPlayed || 0;
        dateEntry.totals.displayTime += stat.displayTime || 0;
        dateEntry.totals.qrScans += stat.qrScans || 0;
        if (stat.completionRate !== undefined && stat.completionRate > 0) {
          dateEntry.totals.completionRates.push(stat.completionRate);
        }
      });
      
      // Calculate average completion rates
      dailyStatsByDate.forEach(dateEntry => {
        // Calculate ad-level completion rates
        dateEntry.ads.forEach(adEntry => {
          if (adEntry.totals.completionRates.length > 0) {
            adEntry.totals.completionRate = adEntry.totals.completionRates.reduce((sum, rate) => sum + rate, 0) / adEntry.totals.completionRates.length;
          }
          delete adEntry.totals.completionRates;
        });
        
        // Calculate date-level completion rate
        if (dateEntry.totals.completionRates.length > 0) {
          dateEntry.totals.completionRate = dateEntry.totals.completionRates.reduce((sum, rate) => sum + rate, 0) / dateEntry.totals.completionRates.length;
        }
        delete dateEntry.totals.completionRates;
      });
      
      // Convert Maps to arrays for MongoDB storage
      const newDailyStats = Array.from(dailyStatsByDate.values()).map(dateEntry => {
        const adsArray = Array.from(dateEntry.ads.values()).map(adEntry => {
          const materialsArray = Array.from(adEntry.materials.values());
          return {
            adId: adEntry.adId,
            materials: materialsArray,
            totals: adEntry.totals
          };
        });
        
        return {
          date: dateEntry.date,
          ads: adsArray,
          totals: dateEntry.totals
        };
      });
      
      // Sort by date
      newDailyStats.sort((a, b) => a.date.localeCompare(b.date));
      
      // Update the document
      await UserAnalytics.updateOne(
        { _id: userAnalytics._id },
        { $set: { dailyStats: newDailyStats } }
      );
      
      documentsUpdated += 1;
      totalEntriesConverted += oldDailyStats.length;
      
      console.log(`  ✅ Converted to ${newDailyStats.length} date entries`);
      console.log(`  📊 Total ads across all dates: ${newDailyStats.reduce((sum, d) => sum + d.ads.length, 0)}`);
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log(`📊 Summary:`);
    console.log(`   Documents updated: ${documentsUpdated}`);
    console.log(`   Total entries converted: ${totalEntriesConverted}`);
    console.log(`   New structure: Grouped by date with nested ads and materials`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateDailyStatsStructure();

