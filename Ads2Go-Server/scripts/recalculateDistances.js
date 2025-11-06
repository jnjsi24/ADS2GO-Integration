/**
 * Script to recalculate historical totalDistanceTraveled from locationHistory
 * Uses new validation logic: time gaps, speed validation, GPS accuracy checks
 * 
 * Usage:
 *   node scripts/recalculateDistances.js [options]
 * 
 * Options:
 *   --materialId <id>     Recalculate for specific materialId only
 *   --date <YYYY-MM-DD>   Recalculate for specific date only
 *   --dry-run             Show what would be changed without updating database
 *   --force               Force recalculation even if distance seems correct
 */

const mongoose = require('mongoose');
require('dotenv').config();
const GPSValidation = require('../src/utils/gpsValidation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

// Validation constants (same as in deviceTracking.js)
const MAX_TIME_GAP = 60; // seconds - if gap is larger, device was offline
const MAX_ACCURACY_THRESHOLD = 30; // meters - only count movements with good GPS accuracy
const MIN_MOVEMENT_THRESHOLD = 0.008; // 0.008 km = 8 meters - filters stationary GPS drift
const MAX_REALISTIC_SPEED = 150; // km/h - maximum realistic speed for a vehicle

/**
 * Recalculate distance from locationHistory with new validation
 */
function recalculateDistance(locationHistory) {
  if (!locationHistory || locationHistory.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  let skippedCount = 0;
  let addedCount = 0;

  for (let i = 1; i < locationHistory.length; i++) {
    const prevPoint = locationHistory[i - 1];
    const currPoint = locationHistory[i];

    // Validate coordinates
    if (!prevPoint.coordinates || !currPoint.coordinates || 
        prevPoint.coordinates.length < 2 || currPoint.coordinates.length < 2) {
      skippedCount++;
      continue;
    }

    const prevLat = prevPoint.coordinates[1];
    const prevLng = prevPoint.coordinates[0];
    const currLat = currPoint.coordinates[1];
    const currLng = currPoint.coordinates[0];

    // Check time gap
    const prevTimestamp = new Date(prevPoint.timestamp);
    const currTimestamp = new Date(currPoint.timestamp);
    const timeGapSeconds = (currTimestamp - prevTimestamp) / 1000;

    // Skip if time gap is too large (device was offline)
    if (timeGapSeconds > MAX_TIME_GAP) {
      skippedCount++;
      continue;
    }

    // Calculate distance
    const distance = GPSValidation.calculateDistance(prevLat, prevLng, currLat, currLng);

    // Check minimum movement threshold
    if (distance <= MIN_MOVEMENT_THRESHOLD) {
      skippedCount++;
      continue;
    }

    // Check GPS accuracy
    const currentAccuracy = currPoint.accuracy || 0;
    const previousAccuracy = prevPoint.accuracy || 0;

    if (currentAccuracy >= MAX_ACCURACY_THRESHOLD || previousAccuracy >= MAX_ACCURACY_THRESHOLD) {
      skippedCount++;
      continue;
    }

    // Check calculated speed
    const calculatedSpeed = timeGapSeconds > 0 ? (distance / timeGapSeconds) * 3600 : 0; // km/h

    if (calculatedSpeed > MAX_REALISTIC_SPEED) {
      skippedCount++;
      continue;
    }

    // All validations passed - add distance
    totalDistance += distance;
    addedCount++;
  }

  return {
    totalDistance,
    skippedCount,
    addedCount,
    totalPoints: locationHistory.length
  };
}

/**
 * Recalculate distance for DeviceTracking documents
 */
async function recalculateDeviceTracking(options = {}) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const DeviceTracking = require('../src/models/deviceTracking');

    // Build query
    const query = {};
    if (options.materialId) {
      query.materialId = options.materialId;
    }
    if (options.date) {
      const targetDate = new Date(options.date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    }

    console.log('📊 Query:', JSON.stringify(query, null, 2));
    console.log('🔍 Finding DeviceTracking documents...\n');

    const devices = await DeviceTracking.find(query).select('materialId date totalDistanceTraveled locationHistory currentSession');
    console.log(`📦 Found ${devices.length} device tracking records\n`);

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const changes = [];

    for (const device of devices) {
      try {
        processed++;
        const materialId = device.materialId;
        const date = device.date;
        const oldDistance = device.totalDistanceTraveled || 0;

        // Recalculate from locationHistory
        const result = recalculateDistance(device.locationHistory || []);

        const newDistance = result.totalDistance;
        const difference = newDistance - oldDistance;
        const percentChange = oldDistance > 0 ? ((difference / oldDistance) * 100).toFixed(2) : 'N/A';

        // Check if update is needed
        const needsUpdate = options.force || Math.abs(difference) > 0.001; // Update if difference > 1 meter

        if (needsUpdate) {
          if (!options.dryRun) {
            // Update DeviceTracking
            device.totalDistanceTraveled = newDistance;
            
            // Also update currentSession if it exists
            if (device.currentSession) {
              device.currentSession.totalDistanceTraveled = newDistance;
            }

            await device.save();
          }

          updated++;
          changes.push({
            materialId,
            date: date.toISOString().split('T')[0],
            oldDistance: oldDistance.toFixed(3),
            newDistance: newDistance.toFixed(3),
            difference: difference.toFixed(3),
            percentChange,
            skippedPoints: result.skippedCount,
            addedPoints: result.addedCount,
            totalPoints: result.totalPoints
          });

          console.log(`✅ [${processed}/${devices.length}] ${materialId} (${date.toISOString().split('T')[0]}): ${oldDistance.toFixed(3)}km → ${newDistance.toFixed(3)}km (${difference > 0 ? '+' : ''}${difference.toFixed(3)}km, ${percentChange}%)`);
        } else {
          unchanged++;
          if (options.verbose) {
            console.log(`⏭️  [${processed}/${devices.length}] ${materialId} (${date.toISOString().split('T')[0]}): No change (${oldDistance.toFixed(3)}km)`);
          }
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${device.materialId}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Unchanged: ${unchanged}`);
    console.log(`   Errors: ${errors}`);

    if (changes.length > 0) {
      console.log('\n📋 Changes:');
      changes.forEach(change => {
        console.log(`   ${change.materialId} (${change.date}): ${change.oldDistance}km → ${change.newDistance}km (${change.difference > 0 ? '+' : ''}${change.difference}km, ${change.percentChange}%)`);
        console.log(`      Points: ${change.addedPoints} added, ${change.skippedPoints} skipped out of ${change.totalPoints} total`);
      });
    }

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were saved to database');
      console.log('   Run without --dry-run to apply changes');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

/**
 * Recalculate distance for DeviceDataHistoryV2 documents
 */
async function recalculateDeviceDataHistory(options = {}) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');

    // Build query
    const query = {};
    if (options.materialId) {
      query.materialId = options.materialId;
    }

    console.log('📊 Query:', JSON.stringify(query, null, 2));
    console.log('🔍 Finding DeviceDataHistoryV2 documents...\n');

    const devices = await DeviceDataHistoryV2.find(query).select('materialId dailyData');
    console.log(`📦 Found ${devices.length} device history records\n`);

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const changes = [];

    for (const device of devices) {
      try {
        if (!device.dailyData || device.dailyData.length === 0) {
          continue;
        }

        for (const dailyRecord of device.dailyData) {
          processed++;
          const materialId = device.materialId;
          const date = dailyRecord.date;
          const oldDistance = dailyRecord.totalDistanceTraveled || 0;

          // Recalculate from locationHistory
          const result = recalculateDistance(dailyRecord.locationHistory || []);

          const newDistance = result.totalDistance;
          const difference = newDistance - oldDistance;
          const percentChange = oldDistance > 0 ? ((difference / oldDistance) * 100).toFixed(2) : 'N/A';

          // Check if update is needed
          const needsUpdate = options.force || Math.abs(difference) > 0.001; // Update if difference > 1 meter

          if (needsUpdate) {
            if (!options.dryRun) {
              dailyRecord.totalDistanceTraveled = newDistance;
              await device.save();
            }

            updated++;
            changes.push({
              materialId,
              date: date.toISOString().split('T')[0],
              oldDistance: oldDistance.toFixed(3),
              newDistance: newDistance.toFixed(3),
              difference: difference.toFixed(3),
              percentChange,
              skippedPoints: result.skippedCount,
              addedPoints: result.addedCount,
              totalPoints: result.totalPoints
            });

            console.log(`✅ [${processed}] ${materialId} (${date.toISOString().split('T')[0]}): ${oldDistance.toFixed(3)}km → ${newDistance.toFixed(3)}km (${difference > 0 ? '+' : ''}${difference.toFixed(3)}km, ${percentChange}%)`);
          } else {
            unchanged++;
            if (options.verbose) {
              console.log(`⏭️  [${processed}] ${materialId} (${date.toISOString().split('T')[0]}): No change (${oldDistance.toFixed(3)}km)`);
            }
          }
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${device.materialId}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Unchanged: ${unchanged}`);
    console.log(`   Errors: ${errors}`);

    if (changes.length > 0) {
      console.log('\n📋 Changes:');
      changes.forEach(change => {
        console.log(`   ${change.materialId} (${change.date}): ${change.oldDistance}km → ${change.newDistance}km (${change.difference > 0 ? '+' : ''}${change.difference}km, ${change.percentChange}%)`);
        console.log(`      Points: ${change.addedPoints} added, ${change.skippedPoints} skipped out of ${change.totalPoints} total`);
      });
    }

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were saved to database');
      console.log('   Run without --dry-run to apply changes');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  verbose: args.includes('--verbose'),
  materialId: null,
  date: null,
  historyOnly: args.includes('--history-only'),
  trackingOnly: args.includes('--tracking-only')
};

const materialIdIndex = args.indexOf('--materialId');
if (materialIdIndex !== -1 && args[materialIdIndex + 1]) {
  options.materialId = args[materialIdIndex + 1];
}

const dateIndex = args.indexOf('--date');
if (dateIndex !== -1 && args[dateIndex + 1]) {
  options.date = args[dateIndex + 1];
}

// Main execution
async function main() {
  console.log('🔄 Distance Recalculation Script');
  console.log('================================\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  if (options.materialId) {
    console.log(`🎯 Recalculating for materialId: ${options.materialId}\n`);
  }

  if (options.date) {
    console.log(`📅 Recalculating for date: ${options.date}\n`);
  }

  // Recalculate DeviceTracking (current day data)
  if (!options.historyOnly) {
    console.log('📊 Recalculating DeviceTracking (current day data)...\n');
    await recalculateDeviceTracking(options);
    console.log('\n');
  }

  // Recalculate DeviceDataHistoryV2 (historical data)
  if (!options.trackingOnly) {
    console.log('📊 Recalculating DeviceDataHistoryV2 (historical data)...\n');
    await recalculateDeviceDataHistory(options);
  }

  console.log('\n✅ Recalculation complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

