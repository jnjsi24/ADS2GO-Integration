const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Analytics = require('./src/models/analytics');

let previousCounts = {};

async function monitorQRScans() {
  try {
    console.log('🔍 REAL-TIME QR SCAN MONITORING...');
    console.log('Press Ctrl+C to stop monitoring\n');
    
    // Initial scan
    await checkQRScans();
    
    // Monitor every 2 seconds
    setInterval(async () => {
      await checkQRScans();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error monitoring QR scans:', error);
  }
}

async function checkQRScans() {
  try {
    const analyticsDocs = await Analytics.find({ materialId: 'DGL-HEADDRESS-CAR-001' });
    
    const currentTime = new Date().toLocaleTimeString();
    let hasChanges = false;
    
    analyticsDocs.forEach(doc => {
      const deviceKey = `${doc.deviceId}-${doc.slotNumber}`;
      const currentCount = doc.totalQRScans || 0;
      const previousCount = previousCounts[deviceKey] || 0;
      
      if (currentCount !== previousCount) {
        hasChanges = true;
        console.log(`\n🔄 [${currentTime}] QR SCAN DETECTED!`);
        console.log(`   Device: ${doc.deviceId}`);
        console.log(`   Slot: ${doc.slotNumber}`);
        console.log(`   Previous Count: ${previousCount}`);
        console.log(`   Current Count: ${currentCount}`);
        console.log(`   New Scans: ${currentCount - previousCount}`);
        console.log(`   Last QR Scan: ${doc.lastQRScan || 'Never'}`);
        console.log('   ' + '='.repeat(50));
      }
      
      previousCounts[deviceKey] = currentCount;
    });
    
    if (!hasChanges) {
      process.stdout.write(`\r⏰ [${currentTime}] Monitoring... (No new QR scans)`);
    }
    
  } catch (error) {
    console.error('❌ Error checking QR scans:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping QR scan monitoring...');
  mongoose.connection.close();
  process.exit(0);
});

monitorQRScans();
