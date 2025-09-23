const mongoose = require('mongoose');
const Material = require('./Ads2Go-Server/src/models/Material');
require('dotenv').config();

async function checkMaterials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const materials = await Material.find({});
    console.log('\n📦 All Materials:');
    materials.forEach(material => {
      console.log(`- ${material.materialId}: ${material.materialType} ${material.vehicleType} ${material.category}`);
    });
    
    const lcdMaterials = await Material.find({ materialType: 'LCD' });
    console.log('\n🖥️ LCD Materials:');
    if (lcdMaterials.length === 0) {
      console.log('❌ No LCD materials found!');
    } else {
      lcdMaterials.forEach(material => {
        console.log(`- ${material.materialId}: ${material.materialType} ${material.vehicleType} ${material.category}`);
      });
    }
    
    const headdressMaterials = await Material.find({ materialType: 'HEADDRESS' });
    console.log('\n🎩 HEADDRESS Materials:');
    headdressMaterials.forEach(material => {
      console.log(`- ${material.materialId}: ${material.materialType} ${material.vehicleType} ${material.category}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMaterials();
