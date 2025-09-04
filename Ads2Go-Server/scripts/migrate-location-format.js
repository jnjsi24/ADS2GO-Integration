const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const ScreenTracking = require('../src/models/screenTracking');

async function migrateLocationFormat() {
  try {
    console.log('Starting location format migration...');
    
    // Find all ScreenTracking documents
    const screenTrackings = await ScreenTracking.find({});
    console.log(`Found ${screenTrackings.length} ScreenTracking documents to migrate`);
    
    let migratedCount = 0;
    
    for (const tracking of screenTrackings) {
      let needsUpdate = false;
      
      // Migrate currentLocation if it exists and is in old format
      if (tracking.currentLocation && tracking.currentLocation.lat !== undefined) {
        console.log(`Migrating currentLocation for device: ${tracking.deviceId}`);
        
        tracking.currentLocation = {
          type: 'Point',
          coordinates: [tracking.currentLocation.lng, tracking.currentLocation.lat],
          timestamp: tracking.currentLocation.timestamp,
          speed: tracking.currentLocation.speed,
          heading: tracking.currentLocation.heading,
          accuracy: tracking.currentLocation.accuracy,
          address: tracking.currentLocation.address
        };
        needsUpdate = true;
      }
      
      // Migrate locationHistory in currentSession
      if (tracking.currentSession && tracking.currentSession.locationHistory) {
        const migratedHistory = tracking.currentSession.locationHistory
          .map(point => {
            if (point.lat !== undefined) {
              return {
                type: 'Point',
                coordinates: [point.lng, point.lat],
                timestamp: point.timestamp,
                speed: point.speed,
                heading: point.heading,
                accuracy: point.accuracy,
                address: point.address
              };
            }
            return point; // Already in correct format
          })
          .filter(point => {
            // Remove invalid entries (empty coordinates, NaN values, etc.)
            return point.coordinates && 
                   point.coordinates.length === 2 && 
                   typeof point.coordinates[0] === 'number' && 
                   typeof point.coordinates[1] === 'number' &&
                   !isNaN(point.coordinates[0]) && !isNaN(point.coordinates[1]);
          });
        
        if (JSON.stringify(tracking.currentSession.locationHistory) !== JSON.stringify(migratedHistory)) {
          console.log(`Migrating and cleaning locationHistory for device: ${tracking.deviceId}`);
          tracking.currentSession.locationHistory = migratedHistory;
          needsUpdate = true;
        }
      }
      
      // Migrate locationHistory in dailySessions
      if (tracking.dailySessions && tracking.dailySessions.length > 0) {
        for (const session of tracking.dailySessions) {
          if (session.locationHistory) {
            const migratedHistory = session.locationHistory
              .map(point => {
                if (point.lat !== undefined) {
                  return {
                    type: 'Point',
                    coordinates: [point.lng, point.lat],
                    timestamp: point.timestamp,
                    speed: point.speed,
                    heading: point.heading,
                    accuracy: point.accuracy,
                    address: point.address
                  };
                }
                return point; // Already in correct format
              })
              .filter(point => {
                // Remove invalid entries (empty coordinates, NaN values, etc.)
                return point.coordinates && 
                       point.coordinates.length === 2 && 
                       typeof point.coordinates[0] === 'number' && 
                       typeof point.coordinates[1] === 'number' &&
                       !isNaN(point.coordinates[0]) && !isNaN(point.coordinates[1]);
              });
            
            if (JSON.stringify(session.locationHistory) !== JSON.stringify(migratedHistory)) {
              console.log(`Migrating and cleaning dailySession locationHistory for device: ${tracking.deviceId}`);
              session.locationHistory = migratedHistory;
              needsUpdate = true;
            }
          }
        }
      }
      
      // Fix NaN values in distance calculations
      if (tracking.currentSession && (isNaN(tracking.currentSession.totalDistanceTraveled) || tracking.currentSession.totalDistanceTraveled < 0)) {
        console.log(`Fixing NaN distance for device: ${tracking.deviceId}`);
        tracking.currentSession.totalDistanceTraveled = 0;
        needsUpdate = true;
      }
      
      if (isNaN(tracking.totalDistanceTraveled) || tracking.totalDistanceTraveled < 0) {
        console.log(`Fixing NaN total distance for device: ${tracking.deviceId}`);
        tracking.totalDistanceTraveled = 0;
        needsUpdate = true;
      }
      
      // Save if any changes were made
      if (needsUpdate) {
        await tracking.save();
        migratedCount++;
        console.log(`✅ Migrated device: ${tracking.deviceId}`);
      }
    }
    
    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`📊 Migrated ${migratedCount} out of ${screenTrackings.length} documents`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run migration
migrateLocationFormat();
