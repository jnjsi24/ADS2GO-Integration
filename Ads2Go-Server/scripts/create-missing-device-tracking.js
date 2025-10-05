const mongoose = require('mongoose');
require('dotenv').config();

async function createMissingDeviceTracking() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Material = require('../src/models/Material');
    const DeviceTracking = require('../src/models/deviceTracking');
    const AdsDeployment = require('../src/models/adsDeployment');
    
    // Get all materials
    const materials = await Material.find({});
    console.log(`📋 Found ${materials.length} materials`);
    
    // Get all existing DeviceTracking records
    const existingDeviceTracking = await DeviceTracking.find({});
    const existingMaterialIds = existingDeviceTracking.map(dt => dt.materialId);
    console.log(`📊 Found ${existingDeviceTracking.length} existing DeviceTracking records`);
    
    // Find materials without DeviceTracking
    const missingMaterials = materials.filter(m => !existingMaterialIds.includes(m.materialId));
    console.log(`❌ Found ${missingMaterials.length} materials without DeviceTracking`);
    
    if (missingMaterials.length === 0) {
      console.log('✅ All materials already have DeviceTracking records');
      return;
    }
    
    let createdCount = 0;
    let errorCount = 0;
    
    for (const material of missingMaterials) {
      try {
        console.log(`\n🔄 Processing material: ${material.materialId} (${material.materialType})`);
        
        // Check if this material has any ad deployments
        const deployments = await AdsDeployment.find({ materialId: material.materialId });
        const hasDeployments = deployments.length > 0;
        
        if (!hasDeployments) {
          console.log(`   ⏭️ Skipping ${material.materialId} - no ad deployments`);
          continue;
        }
        
        console.log(`   📊 Creating DeviceTracking for ${material.materialId} (${deployments.length} deployments)`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const deviceTracking = new DeviceTracking({
          materialId: material.materialId,
          carGroupId: material.carGroupId || 'UNKNOWN',
          screenType: material.materialType || 'HEADDRESS',
          date: today,
          isOnline: false,
          lastSeen: new Date(),
          slots: [],
          currentSession: {
            date: today,
            startTime: new Date(),
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            targetHours: 8,
            complianceStatus: 'PENDING',
            isActive: false
          }
        });
        
        await deviceTracking.save();
        createdCount++;
        console.log(`   ✅ Created DeviceTracking for ${material.materialId}`);
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error creating DeviceTracking for ${material.materialId}:`, error.message);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Created: ${createdCount} DeviceTracking records`);
    console.log(`   ❌ Errors: ${errorCount} materials`);
    console.log(`   📋 Total materials: ${materials.length}`);
    console.log(`   📊 Existing records: ${existingDeviceTracking.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createMissingDeviceTracking();
