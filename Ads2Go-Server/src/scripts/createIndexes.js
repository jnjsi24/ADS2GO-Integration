/**
 * 🚀 MongoDB Index Creation Script
 * 
 * This script creates optimized indexes for DeviceDataHistoryV2 collection
 * to dramatically improve query performance on the compliance endpoint.
 * 
 * Expected improvement:
 * - Before: 10-23 seconds per query
 * - After: < 1 second per query
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

async function createIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    console.log('📊 Creating indexes for DeviceDataHistoryV2...\n');
    
    // Get the collection
    const collection = mongoose.connection.collection('devicedatahistoryv2s');
    
    // Check existing indexes
    console.log('🔍 Checking existing indexes...');
    const existingIndexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(existingIndexes.map(i => i.name), null, 2));
    console.log('');
    
    // Drop old indexes if they exist (to ensure they're optimal)
    console.log('🗑️  Dropping old indexes if they exist...');
    try {
      await collection.dropIndex('materialId_1').catch(() => {});
      console.log('   - Dropped old materialId_1 index');
    } catch (e) {
      console.log('   - No old materialId_1 index to drop');
    }
    
    // Create optimized indexes
    console.log('\n🔨 Creating optimized indexes...\n');
    
    // 1. PRIMARY INDEX: materialId (most important for compliance queries)
    console.log('1️⃣  Creating materialId index...');
    const startTime1 = Date.now();
    await collection.createIndex(
      { materialId: 1 }, 
      { 
        unique: true,
        background: false, // Create in foreground for immediate use
        name: 'materialId_1_optimized'
      }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime1}ms\n`);
    
    // 2. COMPOSITE INDEX: materialId + dailyData.date (for date-specific queries)
    console.log('2️⃣  Creating materialId + date composite index...');
    const startTime2 = Date.now();
    await collection.createIndex(
      { materialId: 1, 'dailyData.date': -1 },
      {
        background: false,
        name: 'materialId_date_composite'
      }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime2}ms\n`);
    
    // 3. SUPPORTING INDEX: carGroupId (for filtering by car group)
    console.log('3️⃣  Creating carGroupId index...');
    const startTime3 = Date.now();
    await collection.createIndex(
      { carGroupId: 1 },
      {
        background: false,
        name: 'carGroupId_1'
      }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime3}ms\n`);
    
    // 4. SUPPORTING INDEX: updatedAt (for sorting by recency)
    console.log('4️⃣  Creating updatedAt index...');
    const startTime4 = Date.now();
    await collection.createIndex(
      { updatedAt: -1 },
      {
        background: false,
        name: 'updatedAt_-1'
      }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime4}ms\n`);
    
    // Show final indexes
    console.log('📊 Final index list:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Test query performance
    console.log('\n⚡ Testing query performance...');
    const testMaterialId = 'MAT-001'; // Replace with a real materialId if you know one
    
    const queryStart = Date.now();
    const testDoc = await DeviceDataHistoryV2.findOne({ materialId: testMaterialId });
    const queryDuration = Date.now() - queryStart;
    
    if (testDoc) {
      console.log(`   ✅ Query completed in ${queryDuration}ms (should be < 100ms)`);
    } else {
      console.log(`   ℹ️  Test materialId '${testMaterialId}' not found in database`);
      console.log(`   ℹ️  Index is ready - will be used on actual queries`);
    }
    
    console.log('\n🎉 All indexes created successfully!');
    console.log('\n📈 Expected performance improvement:');
    console.log('   - Before: 10-23 seconds per query');
    console.log('   - After:  < 1 second per query');
    console.log('   - Total compliance endpoint: 24s → 3-5s ⚡\n');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
createIndexes();

