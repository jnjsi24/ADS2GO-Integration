/**
 * One-time script to build performance indexes for analytics queries
 * This significantly speeds up getUserAnalytics queries
 * 
 * Run: node scripts/buildAnalyticsIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function buildIndexes() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('devicedatahistoryv2s');

    console.log('\n📊 Building performance indexes for analytics queries...\n');

    // Index 1: Date range queries
    console.log('1️⃣ Building index: dailyData.date...');
    await collection.createIndex(
      { 'dailyData.date': 1 },
      { name: 'analytics_date_idx', background: true }
    );
    console.log('   ✅ Index created: analytics_date_idx');

    // Index 2: User filter
    console.log('2️⃣ Building index: dailyData.adPerformance.userId...');
    await collection.createIndex(
      { 'dailyData.adPerformance.userId': 1 },
      { name: 'analytics_user_idx', background: true }
    );
    console.log('   ✅ Index created: analytics_user_idx');

    // Index 3: Ad filter
    console.log('3️⃣ Building index: dailyData.adPerformance.adId...');
    await collection.createIndex(
      { 'dailyData.adPerformance.adId': 1 },
      { name: 'analytics_ad_idx', background: true }
    );
    console.log('   ✅ Index created: analytics_ad_idx');

    // Index 4: Compound - Date + User (most common query)
    console.log('4️⃣ Building compound index: date + userId...');
    await collection.createIndex(
      { 
        'dailyData.date': 1, 
        'dailyData.adPerformance.userId': 1 
      },
      { name: 'analytics_date_user_idx', background: true }
    );
    console.log('   ✅ Index created: analytics_date_user_idx');

    // Index 5: Compound - Date + User + Ad (filtered query)
    console.log('5️⃣ Building compound index: date + userId + adId...');
    await collection.createIndex(
      { 
        'dailyData.date': 1, 
        'dailyData.adPerformance.userId': 1,
        'dailyData.adPerformance.adId': 1
      },
      { name: 'analytics_date_user_ad_idx', background: true }
    );
    console.log('   ✅ Index created: analytics_date_user_ad_idx');

    console.log('\n🎉 All indexes built successfully!');
    console.log('\n📊 Listing all indexes:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n⚡ Performance boost applied! Analytics queries should be 10-50x faster now.');

  } catch (error) {
    console.error('❌ Error building indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

buildIndexes();

