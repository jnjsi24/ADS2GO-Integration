const mongoose = require('mongoose');
const Material = require('../src/models/Material');
const MaterialAvailability = require('../src/models/MaterialAvailability');
const AdsPlan = require('../src/models/AdsPlan');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in the .env file');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize material availability for all materials
const initializeMaterialAvailability = async () => {
  try {
    console.log('Initializing material availability...');
    
    // Get all materials
    const materials = await Material.find({});
    console.log(`Found ${materials.length} materials`);
    
    for (const material of materials) {
      // Check if availability already exists
      const existing = await MaterialAvailability.findOne({ materialId: material._id });
      if (existing) {
        console.log(`Availability already exists for material ${material.materialId}`);
        continue;
      }
      
      // Create availability record
      const availability = new MaterialAvailability({
        materialId: material._id,
        totalSlots: 5,
        occupiedSlots: 0,
        availableSlots: 5,
        nextAvailableDate: new Date(),
        allSlotsFreeDate: new Date(),
        status: 'AVAILABLE'
      });
      
      await availability.save();
      console.log(`Created availability for material ${material.materialId}`);
    }
    
    console.log('Material availability initialization completed');
  } catch (error) {
    console.error('Error initializing material availability:', error);
  }
};

// Update plans to include materials
const updatePlansWithMaterials = async () => {
  try {
    console.log('Updating plans with materials...');
    
    const plans = await AdsPlan.find({});
    console.log(`Found ${plans.length} plans`);
    
    for (const plan of plans) {
      // Find materials that match the plan's criteria
      const materials = await Material.find({
        materialType: plan.materialType,
        vehicleType: plan.vehicleType,
        category: plan.category
      }).limit(3); // Assign up to 3 materials per plan
      
      if (materials.length > 0) {
        plan.materials = materials.map(m => m._id);
        await plan.save();
        console.log(`Updated plan ${plan.name} with ${materials.length} materials`);
      } else {
        console.log(`No materials found for plan ${plan.name}`);
      }
    }
    
    console.log('Plan material assignment completed');
  } catch (error) {
    console.error('Error updating plans with materials:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await initializeMaterialAvailability();
  await updatePlansWithMaterials();
  
  console.log('Initialization completed successfully');
  process.exit(0);
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { initializeMaterialAvailability, updatePlansWithMaterials };
