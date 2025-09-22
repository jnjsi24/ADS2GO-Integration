const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Analytics = require('./src/models/analytics');

async function cleanupUnknownDevices() {
  try {
    console.log('🧹 CLEANING UP UNKNOWN DEVICES...\n');
    
    // Find all analytics documents with deviceId "unknown"
    const unknownDevices = await Analytics.find({ deviceId: 'unknown' });
    
    console.log(`📊 Found ${unknownDevices.length} unknown device documents\n`);
    
    for (const unknownDevice of unknownDevices) {
      console.log(`Processing unknown device for material ${unknownDevice.materialId}, slot ${unknownDevice.slotNumber}`);
      console.log(`  QR scans: ${unknownDevice.totalQRScans}`);
      
      // Find the corresponding deployment device
      const deploymentDevice = await Analytics.findOne({
        materialId: unknownDevice.materialId,
        slotNumber: unknownDevice.slotNumber,
        deviceId: { $regex: '^DEPLOYMENT-' }
      });
      
      if (deploymentDevice) {
        console.log(`  ✅ Found deployment device: ${deploymentDevice.deviceId}`);
        
        // Move QR scans from unknown device to deployment device
        if (unknownDevice.qrScans && unknownDevice.qrScans.length > 0) {
          deploymentDevice.qrScans.push(...unknownDevice.qrScans);
          deploymentDevice.totalQRScans += unknownDevice.totalQRScans;
          deploymentDevice.lastQRScan = new Date();
          
          await deploymentDevice.save();
          console.log(`  ✅ Moved ${unknownDevice.totalQRScans} QR scans to deployment device`);
          console.log(`  New total: ${deploymentDevice.totalQRScans} QR scans`);
        }
        
        // Delete the unknown device
        await Analytics.findByIdAndDelete(unknownDevice._id);
        console.log(`  🗑️  Deleted unknown device document`);
      } else {
        console.log(`  ❌ No deployment device found for this material/slot`);
      }
      
      console.log('');
    }
    
    // Final summary
    console.log('📊 FINAL SUMMARY:');
    const finalAnalytics = await Analytics.find({ materialId: 'DGL-HEADDRESS-CAR-001' });
    finalAnalytics.forEach(doc => {
      console.log(`   ${doc.deviceId} (Slot ${doc.slotNumber}): ${doc.totalQRScans} QR scans`);
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up unknown devices:', error);
  } finally {
    mongoose.connection.close();
  }
}

cleanupUnknownDevices();
