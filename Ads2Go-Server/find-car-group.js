const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import models
const Material = require('./src/models/Material');
const Tablet = require('./src/models/Tablet');

async function findCarGroupForMaterial(materialId) {
  try {
    console.log(`\n🔍 Looking for car group for material: ${materialId}\n`);

    // First, check if the material exists
    const material = await Material.findById(materialId);
    if (!material) {
      console.log('❌ Material not found');
      return;
    }

    console.log(`✅ Material found: ${material.materialName} (${material.materialType})`);

    // Find the tablet document for this material
    const tablet = await Tablet.findOne({ materialId });
    if (!tablet) {
      console.log('❌ No tablet configuration found for this material');
      return;
    }

    console.log(`✅ Tablet configuration found:`);
    console.log(`   Car Group ID: ${tablet.carGroupId}`);
    console.log(`   Created: ${tablet.createdAt}`);
    console.log(`   Updated: ${tablet.updatedAt}`);
    
    console.log(`\n📱 Tablet Slots:`);
    tablet.tablets.forEach((slot, index) => {
      console.log(`   Slot ${slot.tabletNumber}:`);
      console.log(`     Status: ${slot.status}`);
      console.log(`     Device ID: ${slot.deviceId || 'Not registered'}`);
      console.log(`     Last Seen: ${slot.lastSeen || 'Never'}`);
    });

    console.log(`\n🎯 Connection Details for Registration:`);
    console.log(`   Material ID: ${materialId}`);
    console.log(`   Car Group ID: ${tablet.carGroupId}`);
    console.log(`   Slot Numbers: 1, 2`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

// Get material ID from command line argument
const materialId = process.argv[2];

if (!materialId) {
  console.log('Usage: node find-car-group.js <materialId>');
  console.log('Example: node find-car-group.js 68b1f45b9384e0cec97f66aa');
  process.exit(1);
}

findCarGroupForMaterial(materialId);
