/**
 * Update October 14 data with deployment fields
 */

const mongoose = require('mongoose');
require('dotenv').config();

const DeviceTracking = require('../src/models/deviceTracking');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected\n');
    await fixOctober14();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

async function fixOctober14() {
  try {
    const targetDate = new Date('2025-10-14T00:00:00.000Z');
    
    // Get deployment info from DeviceTracking
    const deviceTrackingRecords = await DeviceTracking.find({});
    const deploymentMap = {};
    
    deviceTrackingRecords.forEach(device => {
      deploymentMap[device.materialId] = {
        deployedAds: device.deployedAds || [],
        currentDeploymentId: device.currentDeploymentId ? device.currentDeploymentId.toString() : null,
        lastDeploymentSync: device.lastDeploymentSync || null
      };
    });
    
    console.log('📊 Deployment Info:');
    Object.keys(deploymentMap).forEach(materialId => {
      const info = deploymentMap[materialId];
      console.log(`   ${materialId}: ${info.deployedAds.length} ads, deploymentId: ${info.currentDeploymentId ? '✅' : '❌'}`);
    });
    console.log('');
    
    // Update all DeviceDataHistoryV2 records
    const histories = await DeviceDataHistoryV2.find({});
    let updated = 0;
    
    for (const history of histories) {
      const deployment = deploymentMap[history.materialId];
      if (!deployment) {
        console.log(`⚠️  No deployment info for ${history.materialId}`);
        continue;
      }
      
      let needsSave = false;
      
      for (const dailyRecord of history.dailyData || []) {
        if (dailyRecord.date.toDateString() === targetDate.toDateString()) {
          console.log(`\n🎯 ${history.materialId} - Oct 14:`);
          
          // Filter out entries without userId
          const fieldsToClean = ['adPerformance', 'qrScans', 'qrScansByAd', 'adPlaybacks'];
          fieldsToClean.forEach(field => {
            if (dailyRecord[field] && Array.isArray(dailyRecord[field])) {
              const before = dailyRecord[field].length;
              dailyRecord[field] = dailyRecord[field].filter(item => item.userId);
              const removed = before - dailyRecord[field].length;
              if (removed > 0) {
                console.log(`   🗑️  Removed ${removed} ${field} without userId`);
              }
            }
          });
          
          // Add deployment fields
          const beforeAds = dailyRecord.deployedAds?.length || 0;
          dailyRecord.deployedAds = deployment.deployedAds;
          dailyRecord.currentDeploymentId = deployment.currentDeploymentId;
          dailyRecord.lastDeploymentSync = deployment.lastDeploymentSync;
          
          console.log(`   📦 deployedAds: ${beforeAds} → ${deployment.deployedAds.length}`);
          console.log(`   🆔 deploymentId: ${deployment.currentDeploymentId ? '✅' : '❌'}`);
          console.log(`   🕒 lastSync: ${deployment.lastDeploymentSync ? '✅' : '❌'}`);
          
          needsSave = true;
          break;
        }
      }
      
      if (needsSave) {
        await history.save();
        updated++;
        console.log(`   💾 Saved!`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Updated ${updated} documents`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

