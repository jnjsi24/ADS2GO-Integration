const mongoose = require('mongoose');
const Material = require('./src/models/Material');
const AdsDeployment = require('./src/models/adsDeployment');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://a-lopez:construction@clustero.fdgbsyy.mongodb.net/ADSTOGO?retryWrites=true&w=majority&appName=Cluster0';

async function debugMaterial() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const objectId = '68b1f45b9384e0cec97f66aa';
    const stringMaterialId = 'DGL-HEADDRESS-CAR-001';

    console.log('\n🔍 Checking Material records...');
    
    // Check if Material exists by ObjectId
    const materialByObjectId = await Material.findById(objectId);
    console.log('Material by ObjectId:', materialByObjectId ? 'Found' : 'Not found');
    if (materialByObjectId) {
      console.log('  _id:', materialByObjectId._id);
      console.log('  materialId:', materialByObjectId.materialId);
      console.log('  materialType:', materialByObjectId.materialType);
    }

    // Check if Material exists by string materialId
    const materialByString = await Material.findOne({ materialId: stringMaterialId });
    console.log('Material by string materialId:', materialByString ? 'Found' : 'Not found');
    if (materialByString) {
      console.log('  _id:', materialByString._id);
      console.log('  materialId:', materialByString.materialId);
      console.log('  materialType:', materialByString.materialType);
    }

    console.log('\n🔍 Checking AdsDeployment records...');
    
    // Check AdsDeployment by string materialId
    const deploymentsByString = await AdsDeployment.find({ materialId: stringMaterialId });
    console.log('AdsDeployment by string materialId:', deploymentsByString.length, 'found');
    deploymentsByString.forEach((deployment, index) => {
      console.log(`  Deployment ${index + 1}:`);
      console.log('    _id:', deployment._id);
      console.log('    materialId:', deployment.materialId);
      console.log('    lcdSlots count:', deployment.lcdSlots.length);
      deployment.lcdSlots.forEach((slot, slotIndex) => {
        console.log(`      Slot ${slotIndex + 1}: slotNumber=${slot.slotNumber}, status=${slot.status}`);
      });
    });

    // Check AdsDeployment by ObjectId materialId
    const deploymentsByObjectId = await AdsDeployment.find({ materialId: new mongoose.Types.ObjectId(objectId) });
    console.log('AdsDeployment by ObjectId materialId:', deploymentsByObjectId.length, 'found');

    console.log('\n✅ Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugMaterial();
