const mongoose = require('mongoose');
const Ad = require('./src/models/Ad');
const Material = require('./src/models/Material');
const AdsDeployment = require('./src/models/adsDeployment');

// Connect to MongoDB (same as server)
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function deployAdToMaterial(materialId) {
  try {
    console.log(`🔍 Looking for ads for material: ${materialId}`);
    
    // First, let's see all materials
    const allMaterials = await Material.find({});
    console.log(`📋 All materials:`, allMaterials.map(m => ({
      id: m._id,
      materialId: m.materialId,
      materialType: m.materialType,
      driverId: m.driverId
    })));
    
    // Find the material
    const material = await Material.findOne({ materialId });
    if (!material) {
      console.error(`❌ Material ${materialId} not found`);
      return;
    }
    
    console.log(`📋 Material found:`, {
      id: material._id,
      materialId: material.materialId,
      materialType: material.materialType,
      driverId: material.driverId
    });
    
    if (!material.driverId) {
      console.error(`❌ No driver assigned to material ${materialId}`);
      return;
    }
    
    // Find ALL ads for this material (regardless of status)
    const allAds = await Ad.find({ 
      materialId: material._id
    });
    
    console.log(`📊 All ads for material ${materialId}:`, allAds.map(ad => ({
      id: ad._id,
      title: ad.title,
      adStatus: ad.adStatus,
      paymentStatus: ad.paymentStatus,
      deploymentStatus: ad.deploymentStatus
    })));
    
    // Also check for recent ads (might be associated with wrong material)
    const recentAds = await Ad.find({}).sort({ createdAt: -1 }).limit(5);
    console.log(`📊 Recent ads (last 5):`, recentAds.map(ad => ({
      id: ad._id,
      title: ad.title,
      adStatus: ad.adStatus,
      paymentStatus: ad.paymentStatus,
      materialId: ad.materialId,
      createdAt: ad.createdAt
    })));
    
    // Find ads for this material
    const ads = await Ad.find({ 
      materialId: material._id,
      adStatus: 'ACTIVE',
      paymentStatus: 'PAID'
    });
    
    console.log(`📊 Found ${ads.length} active paid ads for material ${materialId}`);
    
    if (ads.length === 0) {
      console.log(`❌ No active paid ads found for material ${materialId}`);
      
      // Check if there are any recent ads that should be moved to this material
      const convergeAd = recentAds.find(ad => ad.title.includes('Converge'));
      if (convergeAd) {
        console.log(`🔧 Found Converge ad associated with wrong material. Moving to ${materialId}...`);
        
        // Update the ad to the correct material
        await Ad.findByIdAndUpdate(convergeAd._id, {
          materialId: material._id
        });
        
        console.log(`✅ Moved Converge ad to material ${materialId}`);
        
        // Now try to deploy it
        console.log(`🔄 Now deploying the moved ad...`);
        const updatedAd = await Ad.findById(convergeAd._id);
        
        if (material.materialType === 'HEADDRESS') {
          const deployment = await AdsDeployment.addToHEADDRESS(
            material.materialId,
            material.driverId,
            updatedAd._id,
            updatedAd.startTime,
            updatedAd.endTime
          );
          
          console.log(`✅ Converge ad deployed successfully to HEADDRESS material`);
          console.log(`📋 Deployment ID: ${deployment._id}`);
          
          // Update ad status
          await Ad.findByIdAndUpdate(updatedAd._id, {
            deploymentStatus: 'DEPLOYED',
            lastDeploymentAttempt: new Date()
          });
        }
      }
      return;
    }
    
    // Deploy each ad
    for (const ad of ads) {
      console.log(`\n🔄 Deploying ad: ${ad.title} (${ad._id})`);
      
      try {
        if (material.materialType === 'HEADDRESS') {
          const deployment = await AdsDeployment.addToHEADDRESS(
            material.materialId,
            material.driverId,
            ad._id,
            ad.startTime,
            ad.endTime
          );
          
          console.log(`✅ Ad deployed successfully to HEADDRESS material`);
          console.log(`📋 Deployment ID: ${deployment._id}`);
          
          // Update ad status
          await Ad.findByIdAndUpdate(ad._id, {
            deploymentStatus: 'DEPLOYED',
            lastDeploymentAttempt: new Date()
          });
          
        } else if (material.materialType === 'LCD') {
          const deployment = await AdsDeployment.addToLCD(
            material.materialId,
            material.driverId,
            ad._id,
            ad.startTime,
            ad.endTime
          );
          
          console.log(`✅ Ad deployed successfully to LCD material`);
          console.log(`📋 Deployment ID: ${deployment._id}`);
          
          // Update ad status
          await Ad.findByIdAndUpdate(ad._id, {
            deploymentStatus: 'DEPLOYED',
            lastDeploymentAttempt: new Date()
          });
        }
        
      } catch (error) {
        console.error(`❌ Error deploying ad ${ad._id}:`, error.message);
        
        // Update ad status to failed
        await Ad.findByIdAndUpdate(ad._id, {
          deploymentStatus: 'FAILED',
          lastDeploymentAttempt: new Date()
        });
      }
    }
    
    // Check final deployment status
    const finalDeployment = await AdsDeployment.findOne({ materialId: material.materialId });
    if (finalDeployment) {
      console.log(`\n📊 Final deployment status:`, {
        materialId: finalDeployment.materialId,
        slotsCount: finalDeployment.lcdSlots.length,
        slots: finalDeployment.lcdSlots.map(slot => ({
          slotNumber: slot.slotNumber,
          adId: slot.adId,
          status: slot.status,
          startTime: slot.startTime,
          endTime: slot.endTime
        }))
      });
    }
    
  } catch (error) {
    console.error('❌ Error in deployment script:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Get material ID from command line argument
const materialId = process.argv[2];
if (!materialId) {
  console.error('❌ Please provide material ID as argument');
  console.log('Usage: node deploy-ad.js DGL-HEADDRESS-CAR-003');
  process.exit(1);
}

deployAdToMaterial(materialId);
