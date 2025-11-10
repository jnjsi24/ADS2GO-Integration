/**
 * List UserAnalytics documents with user names
 * This script displays all UserAnalytics documents with their associated user names
 * for easy identification.
 */

const path = require('path');
const fs = require('fs');

// Load .env file
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  require('dotenv').config();
}

// Add the server directory to the path so we can require models
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');
const User = require('../src/models/User');

async function listUserAnalytics() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all UserAnalytics documents
    const userAnalyticsDocs = await UserAnalytics.find({}).lean();
    console.log(`📋 Found ${userAnalyticsDocs.length} UserAnalytics documents\n`);
    console.log('='.repeat(80));

    // Pre-fetch all users
    const userIds = userAnalyticsDocs.map(ua => ua.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('_id firstName lastName email').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    // Display each document
    userAnalyticsDocs.forEach((ua, index) => {
      const user = userMap.get(ua.userId.toString());
      const userName = user ? `${user.firstName} ${user.lastName}` : '❌ User not found';
      const userEmail = user ? user.email : 'N/A';

      console.log(`\n[${index + 1}/${userAnalyticsDocs.length}]`);
      console.log(`_id: ${ua._id}`);
      console.log(`userId: ${ua.userId}`);
      console.log(`👤 User Name: ${userName}`);
      console.log(`📧 Email: ${userEmail}`);
      console.log(`📊 Total Ad Plays: ${ua.totalAdPlays || 0}`);
      console.log(`📊 Total QR Scans: ${ua.totalQRScans || 0}`);
      console.log(`📊 Total Devices: ${ua.totalDevices || 0}`);
      console.log(`📊 Total Materials: ${ua.totalMaterials || 0}`);
      console.log(`📅 Daily Stats: ${ua.dailyStats ? ua.dailyStats.length : 0} entries`);
      console.log(`📦 Material Breakdown: ${ua.materialBreakdown ? ua.materialBreakdown.length : 0} entries`);
      console.log(`📋 Ads: ${ua.ads ? ua.ads.length : 0} entries`);
      console.log(`🕒 Last Updated: ${ua.lastUpdated || ua.updatedAt || 'N/A'}`);
      console.log(`🕒 Created At: ${ua.createdAt || 'N/A'}`);
      console.log('-'.repeat(80));
    });

    console.log('\n✅ Listing complete\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUserAnalytics();

