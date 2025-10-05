const mongoose = require('mongoose');
require('dotenv').config();

// Import the Tablet model
const Tablet = require('../src/models/Tablet');

async function cleanupNullDeviceIds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ADSTOGO');
    console.log('Connected to MongoDB');

    // Find all tablets with null deviceId values
    const tabletsWithNullDeviceIds = await Tablet.find({
      'tablets.deviceId': null
    });

    console.log(`Found ${tabletsWithNullDeviceIds.length} tablet configurations with null deviceId values`);

    let updatedCount = 0;

    for (const tablet of tabletsWithNullDeviceIds) {
      let needsUpdate = false;
      
      // Check each tablet slot
      for (let i = 0; i < tablet.tablets.length; i++) {
        if (tablet.tablets[i].deviceId === null) {
          console.log(`Removing null deviceId from materialId: ${tablet.materialId}, slot: ${tablet.tablets[i].tabletNumber}`);
          
          // Remove the deviceId field entirely using $unset
          await Tablet.updateOne(
            { _id: tablet._id },
            { $unset: { [`tablets.${i}.deviceId`]: 1 } }
          );
          
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updatedCount++;
      }
    }

    console.log(`✅ Cleanup completed! Updated ${updatedCount} tablet configurations`);
    
    // Verify the cleanup
    const remainingNullDeviceIds = await Tablet.find({
      'tablets.deviceId': null
    });
    
    console.log(`Remaining tablets with null deviceId: ${remainingNullDeviceIds.length}`);
    
    if (remainingNullDeviceIds.length === 0) {
      console.log('🎉 All null deviceId values have been successfully removed!');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupNullDeviceIds();
