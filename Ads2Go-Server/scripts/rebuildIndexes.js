/**
 * Rebuild Database Indexes Script
 * 
 * This script rebuilds all indexes for optimal query performance.
 * Run this after updating model index definitions.
 * 
 * Usage: node scripts/rebuildIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models that need indexes
const Ad = require('../src/models/Ad');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const UserAnalytics = require('../src/models/userAnalytics');
const DeviceTracking = require('../src/models/deviceTracking');

async function rebuildIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop and rebuild indexes for Ad model
    console.log('\n📊 Rebuilding Ad indexes...');
    await Ad.collection.dropIndexes();
    console.log('   Dropped old indexes');
    await Ad.syncIndexes();
    console.log('   ✅ Created new indexes');
    const adIndexes = await Ad.collection.listIndexes().toArray();
    console.log(`   📋 Total Ad indexes: ${adIndexes.length}`);
    adIndexes.forEach(idx => console.log(`      - ${idx.name}`));

    // Drop and rebuild indexes for DeviceDataHistoryV2
    console.log('\n📊 Rebuilding DeviceDataHistoryV2 indexes...');
    try {
      // Drop all non-unique indexes (keep unique indexes to avoid data issues)
      const existingIndexes = await DeviceDataHistoryV2.collection.listIndexes().toArray();
      for (const idx of existingIndexes) {
        if (idx.name !== '_id_' && !idx.unique) {
          try {
            await DeviceDataHistoryV2.collection.dropIndex(idx.name);
            console.log(`   Dropped index: ${idx.name}`);
          } catch (err) {
            console.log(`   Could not drop index ${idx.name}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.log('   Error managing existing indexes:', err.message);
    }
    
    try {
      await DeviceDataHistoryV2.syncIndexes();
      console.log('   ✅ Created new indexes');
    } catch (err) {
      console.log('   ⚠️ Some indexes may already exist:', err.message);
    }
    
    const historyIndexes = await DeviceDataHistoryV2.collection.listIndexes().toArray();
    console.log(`   📋 Total DeviceDataHistoryV2 indexes: ${historyIndexes.length}`);
    historyIndexes.forEach(idx => console.log(`      - ${idx.name}`));

    // Rebuild UserAnalytics indexes
    console.log('\n📊 Rebuilding UserAnalytics indexes...');
    try {
      // Drop all non-unique indexes (keep unique indexes to avoid data issues)
      const existingIndexes = await UserAnalytics.collection.listIndexes().toArray();
      for (const idx of existingIndexes) {
        if (idx.name !== '_id_' && !idx.unique) {
          try {
            await UserAnalytics.collection.dropIndex(idx.name);
            console.log(`   Dropped index: ${idx.name}`);
          } catch (err) {
            console.log(`   Could not drop index ${idx.name}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.log('   Error managing existing indexes:', err.message);
    }
    
    try {
      await UserAnalytics.syncIndexes();
      console.log('   ✅ Created new indexes');
    } catch (err) {
      console.log('   ⚠️ Some indexes may already exist:', err.message);
    }
    
    const analyticsIndexes = await UserAnalytics.collection.listIndexes().toArray();
    console.log(`   📋 Total UserAnalytics indexes: ${analyticsIndexes.length}`);
    analyticsIndexes.forEach(idx => console.log(`      - ${idx.name}`));

    // Verify DeviceTracking indexes
    console.log('\n📊 Verifying DeviceTracking indexes...');
    await DeviceTracking.syncIndexes();
    const trackingIndexes = await DeviceTracking.collection.listIndexes().toArray();
    console.log(`   📋 Total DeviceTracking indexes: ${trackingIndexes.length}`);
    trackingIndexes.forEach(idx => console.log(`      - ${idx.name}`));

    console.log('\n✅ Index rebuild process completed!');
    console.log('\n📝 Summary:');
    console.log(`   - Ad: ${adIndexes.length} indexes`);
    console.log(`   - DeviceDataHistoryV2: ${historyIndexes.length} indexes`);
    console.log(`   - UserAnalytics: ${analyticsIndexes.length} indexes`);
    console.log(`   - DeviceTracking: ${trackingIndexes.length} indexes`);
    console.log(`\n   Total: ${adIndexes.length + historyIndexes.length + analyticsIndexes.length + trackingIndexes.length} indexes`);

  } catch (error) {
    console.error('\n❌ Critical error during index rebuild:', error.message);
    console.error('\n⚠️ Some models may not have been processed.');
    console.error('Please check the error above and run the script again.');
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
rebuildIndexes();

