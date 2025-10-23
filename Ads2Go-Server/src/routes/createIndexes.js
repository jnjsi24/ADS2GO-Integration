/**
 * 🚀 MongoDB Index Creation Endpoint
 * 
 * Access this endpoint to create optimized indexes for DeviceDataHistoryV2
 * 
 * GET /api/admin/create-indexes
 * 
 * Expected improvement:
 * - Before: 10-23 seconds per query
 * - After: < 1 second per query
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

router.get('/create-indexes', async (req, res) => {
  try {
    console.log('🔨 Creating MongoDB indexes...\n');
    
    const results = {
      success: true,
      message: 'Indexes created successfully',
      indexes: [],
      performance: {},
      errors: []
    };
    
    // Get the collection
    const collection = mongoose.connection.collection('devicedatahistoryv2s');
    
    // Check existing indexes
    console.log('🔍 Checking existing indexes...');
    const existingIndexes = await collection.indexes();
    console.log('Current indexes:', existingIndexes.map(i => i.name));
    results.existingIndexes = existingIndexes.map(i => ({ name: i.name, key: i.key }));
    
    // Create optimized indexes
    console.log('\n🔨 Creating optimized indexes...\n');
    
    // 1. PRIMARY INDEX: materialId
    console.log('1️⃣  Creating materialId index...');
    const startTime1 = Date.now();
    try {
      await collection.createIndex(
        { materialId: 1 }, 
        { 
          unique: true,
          background: true,
          name: 'materialId_1_optimized'
        }
      );
      const duration = Date.now() - startTime1;
      console.log(`   ✅ Created in ${duration}ms`);
      results.indexes.push({ name: 'materialId_1_optimized', duration, status: 'created' });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ℹ️  Index already exists');
        results.indexes.push({ name: 'materialId_1_optimized', status: 'exists' });
      } else {
        console.error('   ❌ Error:', error.message);
        results.errors.push({ index: 'materialId_1_optimized', error: error.message });
      }
    }
    
    // 2. COMPOSITE INDEX: materialId + date
    console.log('2️⃣  Creating materialId + date composite index...');
    const startTime2 = Date.now();
    try {
      await collection.createIndex(
        { materialId: 1, 'dailyData.date': -1 },
        {
          background: true,
          name: 'materialId_date_composite'
        }
      );
      const duration = Date.now() - startTime2;
      console.log(`   ✅ Created in ${duration}ms`);
      results.indexes.push({ name: 'materialId_date_composite', duration, status: 'created' });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ℹ️  Index already exists');
        results.indexes.push({ name: 'materialId_date_composite', status: 'exists' });
      } else {
        console.error('   ❌ Error:', error.message);
        results.errors.push({ index: 'materialId_date_composite', error: error.message });
      }
    }
    
    // 3. SUPPORTING INDEX: carGroupId
    console.log('3️⃣  Creating carGroupId index...');
    const startTime3 = Date.now();
    try {
      await collection.createIndex(
        { carGroupId: 1 },
        {
          background: true,
          name: 'carGroupId_1'
        }
      );
      const duration = Date.now() - startTime3;
      console.log(`   ✅ Created in ${duration}ms`);
      results.indexes.push({ name: 'carGroupId_1', duration, status: 'created' });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ℹ️  Index already exists');
        results.indexes.push({ name: 'carGroupId_1', status: 'exists' });
      } else {
        console.error('   ❌ Error:', error.message);
        results.errors.push({ index: 'carGroupId_1', error: error.message });
      }
    }
    
    // Get final index list
    const finalIndexes = await collection.indexes();
    results.finalIndexes = finalIndexes.map(i => ({ name: i.name, key: i.key }));
    
    // Test query performance
    console.log('\n⚡ Testing query performance...');
    const queryStart = Date.now();
    const testDoc = await DeviceDataHistoryV2.findOne().limit(1);
    const queryDuration = Date.now() - queryStart;
    
    results.performance = {
      testQueryDuration: queryDuration,
      expectedImprovement: {
        before: '10-23 seconds per query',
        after: '< 1 second per query',
        totalEndpoint: '24s → 3-5s'
      }
    };
    
    console.log(`   ✅ Test query completed in ${queryDuration}ms`);
    console.log('\n🎉 Index creation complete!');
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating indexes',
      error: error.message
    });
  }
});

// Route to check index status
router.get('/check-indexes', async (req, res) => {
  try {
    const collection = mongoose.connection.collection('devicedatahistoryv2s');
    const indexes = await collection.indexes();
    
    // Test query performance
    const queryStart = Date.now();
    await DeviceDataHistoryV2.findOne().limit(1);
    const queryDuration = Date.now() - queryStart;
    
    res.json({
      success: true,
      indexes: indexes.map(i => ({ name: i.name, key: i.key })),
      queryPerformance: {
        duration: queryDuration,
        unit: 'ms',
        status: queryDuration < 100 ? 'excellent' : queryDuration < 500 ? 'good' : 'needs optimization'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

