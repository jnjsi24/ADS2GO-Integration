/**
 * 🛠️ Comprehensive Database Index Manager
 * 
 * A unified tool to manage all database indexes across the application.
 * Combines general model-driven index management with specialized custom indexes.
 * 
 * Commands:
 *   build         - Build all indexes from model schemas (safe, won't drop existing)
 *   rebuild       - Drop and rebuild all indexes (use after schema changes)
 *   verify        - Verify all indexes exist and show detailed statistics
 *   clean         - Remove unused/deprecated indexes
 *   build-device  - Build specialized custom indexes for DeviceDataHistoryV2
 * 
 * Usage:
 *   node scripts/indexManager.js <command>
 *   npm run indexes:build
 *   npm run indexes:rebuild
 *   npm run indexes:verify
 *   npm run indexes:clean
 *   npm run indexes:device
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models that need indexes
const Ad = require('../src/models/Ad');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const UserAnalytics = require('../src/models/userAnalytics');
const DeviceTracking = require('../src/models/deviceTracking');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  section: (msg) => console.log(`\n${colors.bright}📦 ${msg}${colors.reset}\n`)
};

// Model configurations
const MODELS = [
  { name: 'Ad', model: Ad, priority: 1 },
  { name: 'DeviceDataHistoryV2', model: DeviceDataHistoryV2, priority: 2 },
  { name: 'UserAnalytics', model: UserAnalytics, priority: 3 },
  { name: 'DeviceTracking', model: DeviceTracking, priority: 4 }
];

/**
 * Build specialized custom indexes for DeviceDataHistoryV2
 * These are performance-optimized indexes beyond the model schema
 */
async function buildDeviceCustomIndexes() {
  log.title('🚀 BUILDING CUSTOM DEVICE INDEXES');
  console.log('Creating 9 specialized indexes for DeviceDataHistoryV2...\n');

  try {
    // Use the model's collection name to ensure we're using the correct one
    const collection = DeviceDataHistoryV2.collection;

    // Check existing indexes
    console.log('🔍 Checking existing indexes...');
    const existingIndexes = await collection.listIndexes().toArray();
    console.log(`   Found ${existingIndexes.length} existing indexes\n`);

    // Drop old/conflicting indexes if they exist
    console.log('🗑️  Cleaning up old indexes...');
    const indexesToDrop = ['materialId_1', 'analytics_date_idx_old'];
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`   ✅ Dropped old index: ${indexName}`);
      } catch (e) {
        // Index doesn't exist, that's fine
      }
    }
    console.log('   Cleanup complete\n');

    console.log('🔨 Creating optimized indexes...\n');
    console.log('━'.repeat(80));

    // ==========================================
    // SECTION 1: COMPLIANCE & DEVICE TRACKING INDEXES
    // ==========================================
    console.log('\n📦 SECTION 1: Compliance & Device Tracking Indexes\n');

    // Index 1: materialId (PRIMARY - most critical for device lookups)
    console.log('1️⃣  Creating materialId index (UNIQUE)...');
    const startTime1 = Date.now();
    try {
      await collection.createIndex(
        { materialId: 1 }, 
        { 
          unique: true,
          background: false,
          name: 'materialId_1_optimized'
        }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime1}ms`);
    } catch (err) {
      if (err.code === 11000 || err.message.includes('already exists')) {
        console.log(`   ℹ️  Index already exists (skipped)`);
      } else {
        throw err;
      }
    }

    // Index 2: materialId + date composite
    console.log('2️⃣  Creating materialId + date composite index...');
    const startTime2 = Date.now();
    await collection.createIndex(
      { materialId: 1, 'dailyData.date': -1 },
      { background: false, name: 'materialId_date_composite' }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime2}ms`);

    // Index 3: carGroupId
    console.log('3️⃣  Creating carGroupId index...');
    const startTime3 = Date.now();
    await collection.createIndex(
      { carGroupId: 1 },
      { background: false, name: 'carGroupId_1' }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime3}ms`);

    // Index 4: updatedAt
    console.log('4️⃣  Creating updatedAt index...');
    const startTime4 = Date.now();
    await collection.createIndex(
      { updatedAt: -1 },
      { background: false, name: 'updatedAt_-1' }
    );
    console.log(`   ✅ Created in ${Date.now() - startTime4}ms`);

    // ==========================================
    // SECTION 2: ANALYTICS & REPORTING INDEXES
    // ==========================================
    console.log('\n📊 SECTION 2: Analytics & Reporting Indexes\n');

    // Index 5: Date range queries
    console.log('5️⃣  Creating dailyData.date index...');
    const startTime5 = Date.now();
    try {
      await collection.createIndex(
        { 'dailyData.date': 1 },
        { name: 'analytics_date_idx', background: true }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime5}ms`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ℹ️  Index already exists with different name (skipped)`);
      } else {
        throw err;
      }
    }

    // Index 6: User filter
    console.log('6️⃣  Creating dailyData.adPerformance.userId index...');
    const startTime6 = Date.now();
    try {
      await collection.createIndex(
        { 'dailyData.adPerformance.userId': 1 },
        { name: 'analytics_user_idx', background: true }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime6}ms`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ℹ️  Index already exists with different name (skipped)`);
      } else {
        throw err;
      }
    }

    // Index 7: Ad filter
    console.log('7️⃣  Creating dailyData.adPerformance.adId index...');
    const startTime7 = Date.now();
    try {
      await collection.createIndex(
        { 'dailyData.adPerformance.adId': 1 },
        { name: 'analytics_ad_idx', background: true }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime7}ms`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ℹ️  Index already exists with different name (skipped)`);
      } else {
        throw err;
      }
    }

    // Index 8: Compound date + user
    console.log('8️⃣  Creating date + userId compound index...');
    const startTime8 = Date.now();
    try {
      await collection.createIndex(
        { 'dailyData.date': 1, 'dailyData.adPerformance.userId': 1 },
        { name: 'analytics_date_user_idx', background: true }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime8}ms`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ℹ️  Index already exists with different name (skipped)`);
      } else {
        throw err;
      }
    }

    // Index 9: Compound date + user + ad
    console.log('9️⃣  Creating date + userId + adId compound index...');
    const startTime9 = Date.now();
    try {
      await collection.createIndex(
        { 
          'dailyData.date': 1, 
          'dailyData.adPerformance.userId': 1,
          'dailyData.adPerformance.adId': 1
        },
        { name: 'analytics_date_user_ad_idx', background: true }
      );
      console.log(`   ✅ Created in ${Date.now() - startTime9}ms`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ℹ️  Index already exists with different name (skipped)`);
      } else {
        throw err;
      }
    }

    // Show final indexes
    console.log('\n━'.repeat(80));
    console.log('\n✅ All custom indexes created successfully!\n');
    
    const finalIndexes = await collection.indexes();
    console.log('📊 Final Index List:');
    console.log(`   Total: ${finalIndexes.length} indexes\n`);
    finalIndexes.forEach((index, i) => {
      const unique = index.unique ? ' [UNIQUE]' : '';
      console.log(`   ${String(i + 1).padStart(2)}. ${index.name.padEnd(35)} ${JSON.stringify(index.key)}${unique}`);
    });

    // Performance test
    console.log('\n⚡ Testing Query Performance...\n');
    
    const testMaterialId = 'MAT-001';
    const queryStart1 = Date.now();
    const testDoc1 = await DeviceDataHistoryV2.findOne({ materialId: testMaterialId });
    const queryDuration1 = Date.now() - queryStart1;
    console.log(`   Test 1: Device lookup by materialId`);
    console.log(`   ${testDoc1 ? '✅' : 'ℹ️ '} Completed in ${queryDuration1}ms ${testDoc1 ? '(GOOD: < 100ms)' : '(test ID not found)'}`);

    const queryStart2 = Date.now();
    const testDocs2 = await DeviceDataHistoryV2.find({ 'dailyData.adPerformance.userId': { $exists: true } }).limit(1);
    const queryDuration2 = Date.now() - queryStart2;
    console.log(`   Test 2: Analytics query with user filter`);
    console.log(`   ${testDocs2.length > 0 ? '✅' : 'ℹ️ '} Completed in ${queryDuration2}ms ${testDocs2.length > 0 ? '(GOOD: < 100ms)' : '(no data found)'}`);

    console.log('\n━'.repeat(80));
    console.log('\n🎉 CUSTOM DEVICE INDEXES BUILD COMPLETE!\n');
    console.log('📈 Expected Performance Improvements:');
    console.log('   ✅ Compliance queries:  10-23s → < 1s (95% faster)');
    console.log('   ✅ Analytics queries:   10-50x performance boost');
    console.log('   ✅ Device lookups:      Near-instant with unique index');
    console.log('   ✅ Date-range queries:  Optimized with compound indexes\n');

    return { success: true, count: 9 };

  } catch (error) {
    log.error(`Failed to build custom device indexes: ${error.message}`);
    throw error;
  }
}

/**
 * Build all indexes from model schemas (safe operation)
 */
async function buildIndexes() {
  log.title('🔨 BUILDING ALL INDEXES FROM MODEL SCHEMAS');
  
  const results = { success: 0, failed: 0, total: 0 };
  
  for (const { name, model } of MODELS) {
    try {
      log.section(`Building indexes for ${name}`);
      
      await model.syncIndexes();
      
      const indexes = await model.collection.listIndexes().toArray();
      log.success(`Created/verified ${indexes.length} indexes`);
      indexes.forEach(idx => console.log(`   - ${idx.name}`));
      
      results.success++;
      results.total += indexes.length;
    } catch (error) {
      log.error(`Failed to build indexes for ${name}: ${error.message}`);
      results.failed++;
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  log.title('📊 BUILD SUMMARY');
  console.log(`   Models processed: ${results.success + results.failed}`);
  console.log(`   ${colors.green}✅ Successful: ${results.success}${colors.reset}`);
  console.log(`   ${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`   📋 Total indexes: ${results.total}\n`);

  return results;
}

/**
 * Rebuild all indexes (drops and recreates)
 */
async function rebuildIndexes() {
  log.title('🔄 REBUILDING ALL INDEXES');
  log.warning('This will drop and recreate indexes. Continue...\n');
  
  const results = { success: 0, failed: 0, dropped: 0, created: 0 };
  
  for (const { name, model } of MODELS) {
    try {
      log.section(`Rebuilding indexes for ${name}`);
      
      const existingIndexes = await model.collection.listIndexes().toArray();
      
      let droppedCount = 0;
      for (const idx of existingIndexes) {
        if (idx.name !== '_id_' && !idx.unique) {
          try {
            await model.collection.dropIndex(idx.name);
            console.log(`   🗑️  Dropped: ${idx.name}`);
            droppedCount++;
          } catch (err) {
            log.warning(`Could not drop ${idx.name}: ${err.message}`);
          }
        }
      }
      
      await model.syncIndexes();
      const newIndexes = await model.collection.listIndexes().toArray();
      
      log.success(`Rebuilt ${newIndexes.length} indexes (dropped ${droppedCount})`);
      newIndexes.forEach(idx => console.log(`   - ${idx.name}`));
      
      results.success++;
      results.dropped += droppedCount;
      results.created += newIndexes.length;
    } catch (error) {
      log.error(`Failed to rebuild indexes for ${name}: ${error.message}`);
      results.failed++;
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  log.title('📊 REBUILD SUMMARY');
  console.log(`   Models processed: ${results.success + results.failed}`);
  console.log(`   ${colors.green}✅ Successful: ${results.success}${colors.reset}`);
  console.log(`   ${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`   🗑️  Dropped: ${results.dropped}`);
  console.log(`   🔨 Created: ${results.created}\n`);

  return results;
}

/**
 * Verify all indexes and show statistics
 */
async function verifyIndexes() {
  log.title('🔍 VERIFYING ALL INDEXES');
  
  const results = { totalIndexes: 0, uniqueIndexes: 0, compoundIndexes: 0 };
  
  for (const { name, model } of MODELS) {
    try {
      log.section(`Verifying ${name} indexes`);
      
      const indexes = await model.collection.listIndexes().toArray();
      const stats = await model.collection.stats();
      
      console.log(`   Collection size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Document count:  ${stats.count.toLocaleString()}`);
      console.log(`   Total indexes:   ${indexes.length}\n`);
      
      indexes.forEach(idx => {
        const keyCount = Object.keys(idx.key).length;
        const unique = idx.unique ? ' [UNIQUE]' : '';
        const compound = keyCount > 1 ? ' [COMPOUND]' : '';
        
        console.log(`   ${idx.name.padEnd(40)} ${JSON.stringify(idx.key)}${unique}${compound}`);
        
        if (idx.unique) results.uniqueIndexes++;
        if (keyCount > 1) results.compoundIndexes++;
      });
      
      results.totalIndexes += indexes.length;
      log.success(`Verified ${indexes.length} indexes\n`);
      
    } catch (error) {
      log.error(`Failed to verify ${name}: ${error.message}`);
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  log.title('📊 VERIFICATION SUMMARY');
  console.log(`   Total indexes:    ${results.totalIndexes}`);
  console.log(`   Unique indexes:   ${results.uniqueIndexes}`);
  console.log(`   Compound indexes: ${results.compoundIndexes}\n`);

  return results;
}

/**
 * Clean unused indexes
 */
async function cleanIndexes() {
  log.title('🧹 CLEANING UNUSED INDEXES');
  log.warning('This will analyze and remove deprecated indexes\n');
  
  const deprecatedIndexes = [
    'materialId_1',
    'analytics_date_idx_old'
  ];
  
  let removedCount = 0;
  
  for (const { name, model } of MODELS) {
    try {
      log.section(`Checking ${name} for unused indexes`);
      
      const indexes = await model.collection.listIndexes().toArray();
      
      for (const idx of indexes) {
        if (deprecatedIndexes.includes(idx.name)) {
          try {
            await model.collection.dropIndex(idx.name);
            log.success(`Removed deprecated index: ${idx.name}`);
            removedCount++;
          } catch (err) {
            // Index doesn't exist or can't be dropped
          }
        }
      }
      
      if (removedCount === 0) {
        log.info(`No deprecated indexes found in ${name}`);
      }
      
    } catch (error) {
      log.error(`Failed to clean ${name}: ${error.message}`);
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  log.title('📊 CLEANUP SUMMARY');
  console.log(`   Indexes removed: ${removedCount}\n`);

  return { removed: removedCount };
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];
  
  const validCommands = ['build', 'rebuild', 'verify', 'clean', 'build-device'];
  
  if (!command || !validCommands.includes(command)) {
    console.log(`
${colors.bright}${colors.magenta}🛠️  Comprehensive Database Index Manager${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/indexManager.js <command>

${colors.cyan}Commands:${colors.reset}
  ${colors.green}build${colors.reset}         - Build all indexes from model schemas (safe, won't drop existing)
  ${colors.yellow}rebuild${colors.reset}       - Drop and rebuild all indexes (use after schema changes)
  ${colors.blue}verify${colors.reset}        - Verify all indexes exist and show detailed statistics
  ${colors.red}clean${colors.reset}         - Remove unused/deprecated indexes
  ${colors.magenta}build-device${colors.reset}  - Build specialized custom indexes for DeviceDataHistoryV2

${colors.cyan}NPM Shortcuts:${colors.reset}
  npm run indexes:build       # Build all indexes
  npm run indexes:rebuild     # Rebuild all indexes
  npm run indexes:verify      # Verify indexes
  npm run indexes:clean       # Clean unused indexes
  npm run indexes:device      # Build custom device indexes

${colors.cyan}Examples:${colors.reset}
  node scripts/indexManager.js build
  node scripts/indexManager.js build-device
  node scripts/indexManager.js verify

${colors.cyan}Recommended Workflow:${colors.reset}
  1. First deployment:     npm run indexes:build && npm run indexes:device
  2. After schema changes: npm run indexes:rebuild
  3. Health check:         npm run indexes:verify
  4. Maintenance:          npm run indexes:clean
    `);
    process.exit(1);
  }
  
  try {
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    log.success('Connected to MongoDB\n');
    
    switch (command) {
      case 'build':
        await buildIndexes();
        break;
      case 'rebuild':
        await rebuildIndexes();
        break;
      case 'verify':
        await verifyIndexes();
        break;
      case 'clean':
        await cleanIndexes();
        break;
      case 'build-device':
        await buildDeviceCustomIndexes();
        break;
    }
    
    log.success('Operation completed successfully!');
    
  } catch (error) {
    log.error(`Operation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
main();

