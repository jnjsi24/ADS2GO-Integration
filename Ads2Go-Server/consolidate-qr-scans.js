const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Analytics = require('./src/models/analytics');

async function consolidateQRScans() {
  try {
    console.log('🔧 CONSOLIDATING QR SCANS TO DEPLOYMENT DEVICES...\n');
    
    // Get all analytics documents for the material
    const allAnalytics = await Analytics.find({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    console.log(`📊 Found ${allAnalytics.length} analytics documents for DGL-HEADDRESS-CAR-001\n`);
    
    // Group by slot number
    const slotGroups = {};
    allAnalytics.forEach(doc => {
      if (!slotGroups[doc.slotNumber]) {
        slotGroups[doc.slotNumber] = [];
      }
      slotGroups[doc.slotNumber].push(doc);
    });
    
    // Process each slot
    for (const [slotNumber, docs] of Object.entries(slotGroups)) {
      console.log(`\n🎯 PROCESSING SLOT ${slotNumber}:`);
      console.log(`   Found ${docs.length} documents`);
      
      // Find deployment device for this slot
      const deploymentDevice = docs.find(doc => doc.deviceId.startsWith('DEPLOYMENT-'));
      
      if (deploymentDevice) {
        console.log(`   ✅ Deployment device found: ${deploymentDevice.deviceId}`);
        console.log(`   Current QR scans: ${deploymentDevice.totalQRScans}`);
        
        // Find test devices for this slot
        const testDevices = docs.filter(doc => 
          doc.deviceId.startsWith('REALTIME-TEST-DEVICE-') || 
          doc.deviceId.startsWith('TABLET-')
        );
        
        console.log(`   Test devices found: ${testDevices.length}`);
        
        if (testDevices.length > 0) {
          // Consolidate QR scans from test devices to deployment device
          let totalQRScansToAdd = 0;
          let qrScansToAdd = [];
          
          for (const testDevice of testDevices) {
            if (testDevice.qrScans && testDevice.qrScans.length > 0) {
              qrScansToAdd.push(...testDevice.qrScans);
              totalQRScansToAdd += testDevice.totalQRScans || 0;
              console.log(`     - ${testDevice.deviceId}: ${testDevice.totalQRScans} QR scans`);
            }
          }
          
          if (totalQRScansToAdd > 0) {
            // Update deployment device with consolidated QR scans
            deploymentDevice.qrScans.push(...qrScansToAdd);
            deploymentDevice.totalQRScans += totalQRScansToAdd;
            deploymentDevice.lastQRScan = new Date();
            
            await deploymentDevice.save();
            
            console.log(`   ✅ Added ${totalQRScansToAdd} QR scans to deployment device`);
            console.log(`   New total: ${deploymentDevice.totalQRScans} QR scans`);
            
            // Delete test device analytics documents
            for (const testDevice of testDevices) {
              await Analytics.findByIdAndDelete(testDevice._id);
              console.log(`   🗑️  Deleted test device: ${testDevice.deviceId}`);
            }
          }
        }
      } else {
        console.log(`   ❌ No deployment device found for slot ${slotNumber}`);
      }
    }
    
    // Final summary
    console.log('\n📊 FINAL SUMMARY:');
    const finalAnalytics = await Analytics.find({ materialId: 'DGL-HEADDRESS-CAR-001' });
    finalAnalytics.forEach(doc => {
      console.log(`   ${doc.deviceId} (Slot ${doc.slotNumber}): ${doc.totalQRScans} QR scans`);
    });
    
  } catch (error) {
    console.error('❌ Error consolidating QR scans:', error);
  } finally {
    mongoose.connection.close();
  }
}

consolidateQRScans();
