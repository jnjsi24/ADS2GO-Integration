require('dotenv').config();
const mongoose = require('mongoose');
const TimeSeriesEvent = require('../src/models/TimeSeriesEvent');
const Analytics = require('../src/models/analytics');
const DeviceTracking = require('../src/models/deviceTracking');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const { createLogger, format, transports } = require('winston');

// Configure logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'migration.log' })
  ]
});

// MongoDB connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      readPreference: 'secondaryPreferred' // Prefer reading from secondaries
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Migrate data from Analytics collection
async function migrateAnalyticsData() {
  logger.info('Starting migration of Analytics collection...');
  
  const batchSize = 1000;
  let lastId = null;
  let processed = 0;
  let success = 0;
  let errors = 0;
  
  try {
    while (true) {
      const query = lastId ? { _id: { $gt: lastId } } : {};
      const docs = await Analytics.find(query)
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean();
      
      if (docs.length === 0) break;
      
      const operations = [];
      
      for (const doc of docs) {
        try {
          // Process ad playbacks
          if (doc.adPlaybacks && doc.adPlaybacks.length > 0) {
            doc.adPlaybacks.forEach(playback => {
              operations.push({
                eventType: 'AD_PLAYBACK',
                timestamp: playback.startTime || new Date(),
                data: {
                  ...playback,
                  materialId: doc.materialId,
                  deviceId: doc.deviceId,
                  originalId: doc._id.toString()
                },
                metadata: {
                  date: new Date(playback.startTime || new Date()),
                  hour: new Date(playback.startTime || new Date()).getHours(),
                  dayOfWeek: new Date(playback.startTime || new Date()).getDay()
                }
              });
            });
          }
          
          // Process QR scans
          if (doc.qrScans && doc.qrScans.length > 0) {
            doc.qrScans.forEach(scan => {
              operations.push({
                eventType: 'QR_SCAN',
                timestamp: scan.scanTimestamp || new Date(),
                data: {
                  ...scan,
                  materialId: doc.materialId,
                  deviceId: doc.deviceId,
                  originalId: doc._id.toString()
                },
                metadata: {
                  date: new Date(scan.scanTimestamp || new Date()),
                  hour: new Date(scan.scanTimestamp || new Date()).getHours(),
                  dayOfWeek: new Date(scan.scanTimestamp || new Date()).getDay(),
                  location: scan.location || null,
                  locationName: scan.city || null
                }
              });
            });
          }
          
          processed++;
          if (processed % 100 === 0) {
            logger.info(`Processed ${processed} documents...`);
          }
          
          lastId = doc._id;
        } catch (error) {
          errors++;
          logger.error(`Error processing document ${doc._id}:`, error);
        }
      }
      
      // Insert batch
      if (operations.length > 0) {
        try {
          await TimeSeriesEvent.insertMany(operations, { ordered: false });
          success += operations.length;
          logger.info(`Inserted ${operations.length} events (${success} total)`);
        } catch (batchError) {
          errors += operations.length;
          logger.error('Batch insert error:', batchError);
        }
      }
    }
    
    logger.info(`Migration completed. Processed: ${processed}, Success: ${success}, Errors: ${errors}`);
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    
    // Create indexes if they don't exist
    logger.info('Ensuring indexes...');
    await TimeSeriesEvent.createIndexes();
    
    // Run migrations
    await migrateAnalyticsData();
    
    logger.info('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Migration interrupted by user');
  await mongoose.disconnect();
  process.exit(0);
});

// Start migration
main();
