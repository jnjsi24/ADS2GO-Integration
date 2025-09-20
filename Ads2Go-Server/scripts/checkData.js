const mongoose = require('mongoose');
const Material = require('../src/models/Material');
const AdsPlan = require('../src/models/AdsPlan');
require('dotenv').config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
    
    console.log('\n=== MATERIALS ===');
    const materials = await Material.find({});
    materials.forEach(m => {
      console.log(`ID: ${m._id}, MaterialID: ${m.materialId}, Type: ${m.materialType}, Vehicle: ${m.vehicleType}, Category: ${m.category}`);
    });
    
    console.log('\n=== PLANS ===');
    const plans = await AdsPlan.find({}).populate('materials');
    plans.forEach(p => {
      console.log(`Plan: ${p.name}, Type: ${p.materialType}, Vehicle: ${p.vehicleType}, Category: ${p.category}, Materials: ${p.materials.length}`);
      if (p.materials.length > 0) {
        p.materials.forEach(m => {
          console.log(`  - Material: ${m.materialId} (${m.materialType} - ${m.vehicleType})`);
        });
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
