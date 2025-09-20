const mongoose = require('mongoose');
require('dotenv').config();

async function fixMaterialTrackingIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('materialtrackings');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes on materialtrackings collection:');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key);
    });

    // Check for problematic activitySessions.sessionId index
    const problematicIndex = indexes.find(index => 
      index.key && index.key['activitySessions.sessionId'] !== undefined
    );

    if (problematicIndex) {
      console.log(`\n🔍 Found problematic index: ${problematicIndex.name}`);
      console.log('Key:', problematicIndex.key);
      
      // Drop the problematic index
      try {
        await collection.dropIndex(problematicIndex.name);
        console.log(`✅ Dropped problematic index: ${problematicIndex.name}`);
      } catch (dropError) {
        console.error(`❌ Error dropping index:`, dropError.message);
      }
    } else {
      console.log('\n✅ No problematic activitySessions.sessionId index found');
    }

    // List indexes after cleanup
    const updatedIndexes = await collection.indexes();
    console.log('\n📋 Updated indexes:');
    updatedIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key);
    });

    console.log('\n🎯 Index cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMaterialTrackingIndexes();
