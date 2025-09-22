const mongoose = require('mongoose');
const Analytics = require('./src/models/analytics');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Find all analytics documents with QR scans
    const analyticsDocs = await Analytics.find({
      totalQRScans: { $gt: 0 }
    });
    
    console.log(`Found ${analyticsDocs.length} analytics documents with QR scans`);
    
    if (analyticsDocs.length > 0) {
      console.log('\n📊 Device Analytics QR Scans:');
      analyticsDocs.forEach((doc, index) => {
        console.log(`\n${index + 1}. Device: ${doc.deviceId}`);
        console.log(`   Material: ${doc.materialId}`);
        console.log(`   Slot: ${doc.slotNumber}`);
        console.log(`   QR Scans in array: ${doc.qrScans.length}`);
        console.log(`   Total QR Scans counter: ${doc.totalQRScans}`);
        console.log(`   Last QR Scan: ${doc.lastQRScan}`);
        
        if (doc.qrScans.length > 0) {
          console.log('   Recent QR Scans:');
          doc.qrScans.slice(-3).forEach((scan, scanIndex) => {
            console.log(`     ${scanIndex + 1}. ${scan.adTitle} (${scan.adId}) - ${scan.scanTimestamp}`);
          });
        }
      });
    } else {
      console.log('❌ No analytics documents with QR scans found');
    }
    
  } catch (error) {
    console.error('Error checking analytics:', error);
  } finally {
    mongoose.disconnect();
  }
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
