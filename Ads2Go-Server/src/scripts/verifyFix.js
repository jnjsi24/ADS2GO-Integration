/**
 * Verify Fix - Check if summary.totalMaterials was removed
 * 
 * Usage: node src/scripts/verifyFix.js
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

async function verifyFix() {
  try {
    console.log('\n🔍 Verifying fix...\n');
    
    // Check Jairhon Jusi specifically
    const jairhon = await UserAnalytics.findOne({ 
      userId: '6904984dbe891dd9adba1526' 
    });
    
    if (jairhon) {
      console.log(`📊 User: ${jairhon.userName}`);
      console.log(`   totalDevices: ${jairhon.totalDevices}`);
      console.log(`   Total ads: ${jairhon.ads.length}`);
      
      // Check summary.totalMaterials
      if (jairhon.summary && jairhon.summary.totalMaterials !== undefined) {
        console.log(`   ❌ summary.totalMaterials still exists: ${jairhon.summary.totalMaterials}`);
      } else {
        console.log(`   ✅ summary.totalMaterials removed (or summary doesn't exist)`);
      }
      
      // Check ads array
      console.log(`\n   📋 Ads array:`);
      jairhon.ads.forEach(ad => {
        console.log(`      - ${ad.adTitle}: ${ad.totalDevices} devices, ${ad.materials?.length || 0} materials`);
      });
    }
    
    // Check all users for summary.totalMaterials
    const allUsers = await UserAnalytics.find({});
    let usersWithTotalMaterials = 0;
    
    allUsers.forEach(user => {
      if (user.summary && user.summary.totalMaterials !== undefined) {
        usersWithTotalMaterials++;
        console.log(`\n   ⚠️  ${user.userName} still has summary.totalMaterials: ${user.summary.totalMaterials}`);
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total users checked: ${allUsers.length}`);
    console.log(`   Users with summary.totalMaterials: ${usersWithTotalMaterials}`);
    
    if (usersWithTotalMaterials === 0) {
      console.log(`   ✅ All users have summary.totalMaterials removed!`);
    } else {
      console.log(`   ⚠️  ${usersWithTotalMaterials} user(s) still have summary.totalMaterials`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  try {
    await connectDB();
    await verifyFix();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyFix };

