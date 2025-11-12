/**
 * Remove totalMaterials from ads array in UserAnalytics collection
 * 
 * This script aggressively removes totalMaterials from all ads in the UserAnalytics collection
 * 
 * Usage: node src/scripts/removeTotalMaterialsFromAds.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UserAnalytics = require('../models/userAnalytics');

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

async function removeTotalMaterialsFromAds() {
  try {
    console.log('\n🧹 Removing totalMaterials from ads array...\n');
    
    const allUserAnalytics = await UserAnalytics.find({});
    console.log(`📊 Found ${allUserAnalytics.length} UserAnalytics documents\n`);
    
    let totalAdsFixed = 0;
    let usersFixed = 0;
    
    for (const userAnalytics of allUserAnalytics) {
      let userFixed = false;
      let adsFixed = 0;
      
      if (userAnalytics.ads && Array.isArray(userAnalytics.ads)) {
        userAnalytics.ads.forEach((ad, index) => {
          if (ad.totalMaterials !== undefined) {
            delete ad.totalMaterials;
            adsFixed++;
            userFixed = true;
          }
        });
        
        if (userFixed) {
          await userAnalytics.save();
          totalAdsFixed += adsFixed;
          usersFixed++;
          console.log(`   ✅ ${userAnalytics.userName || 'Unknown'}: Removed totalMaterials from ${adsFixed} ad(s)`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 REMOVAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users fixed: ${usersFixed}`);
    console.log(`Total ads fixed: ${totalAdsFixed}`);
    console.log(`✅ All totalMaterials removed from ads arrays!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await removeTotalMaterialsFromAds();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { removeTotalMaterialsFromAds };

