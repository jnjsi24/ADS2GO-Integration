const mongoose = require('mongoose');
const QRScanTracking = require('./src/models/qrScanTracking');
const Analytics = require('./src/models/analytics');

mongoose.connect('mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Find all QR scan documents for the RICK ad
    const qrScans = await QRScanTracking.find({ 
      adId: '68d01c8a905edca9f119e916',
      materialId: 'DGL-HEADDRESS-CAR-001'
    });
    
    console.log(`Found ${qrScans.length} QR scan documents for RICK ad`);
    
    if (qrScans.length > 0) {
      // Group by device ID
      const deviceGroups = {};
      qrScans.forEach(scan => {
        const deviceId = scan.registrationData?.deviceId || 'unknown';
        if (!deviceGroups[deviceId]) {
          deviceGroups[deviceId] = [];
        }
        deviceGroups[deviceId].push(scan);
      });
      
      console.log('Device groups:', Object.keys(deviceGroups));
      
      // For each device, consolidate QR scans into analytics document
      for (const [deviceId, scans] of Object.entries(deviceGroups)) {
        if (deviceId === 'unknown') continue;
        
        console.log(`\nProcessing device: ${deviceId} (${scans.length} scans)`);
        
        // Find or create analytics document
        let analytics = await Analytics.findOne({
          deviceId: deviceId,
          materialId: 'DGL-HEADDRESS-CAR-001',
          slotNumber: 1
        });
        
        if (!analytics) {
          console.log(`Creating new analytics document for device: ${deviceId}`);
          analytics = new Analytics({
            deviceId: deviceId,
            materialId: 'DGL-HEADDRESS-CAR-001',
            slotNumber: 1,
            adId: '68d01c8a905edca9f119e916',
            userId: null,
            adDeploymentId: null,
            isOnline: true,
            deviceInfo: scans[0].deviceInfo || null,
            currentLocation: scans[0].gpsData ? {
              type: 'Point',
              coordinates: [scans[0].gpsData.lng || 0, scans[0].gpsData.lat || 0],
              accuracy: scans[0].gpsData.accuracy || 0,
              speed: scans[0].gpsData.speed || 0,
              heading: scans[0].gpsData.heading || 0,
              timestamp: new Date()
            } : null,
            networkStatus: {
              isOnline: scans[0].networkStatus || false,
              lastSeen: new Date()
            }
          });
        }
        
        // Add all QR scans to analytics document
        for (const scan of scans) {
          const qrScanData = {
            adId: scan.adId,
            adTitle: scan.adTitle,
            scanTimestamp: scan.scanTimestamp,
            qrCodeUrl: scan.qrCodeUrl,
            userAgent: scan.userAgent,
            deviceType: scan.deviceType,
            browser: scan.browser,
            operatingSystem: scan.operatingSystem,
            ipAddress: scan.ipAddress,
            country: scan.country,
            city: scan.city,
            location: scan.location,
            timeOnPage: scan.timeOnPage || 0,
            converted: scan.converted || false,
            conversionType: scan.conversionType,
            conversionValue: scan.conversionValue || 0
          };
          
          await analytics.addQRScan(qrScanData);
        }
        
        console.log(`✅ Added ${scans.length} QR scans to analytics document for device: ${deviceId}`);
        console.log(`   Total QR scans in analytics: ${analytics.qrScans.length}`);
        console.log(`   Total QR scans counter: ${analytics.totalQRScans}`);
      }
      
      // Delete the duplicate QR scan documents
      console.log('\nDeleting duplicate QR scan documents...');
      const deleteResult = await QRScanTracking.deleteMany({ 
        adId: '68d01c8a905edca9f119e916',
        materialId: 'DGL-HEADDRESS-CAR-001'
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} duplicate QR scan documents`);
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    mongoose.disconnect();
  }
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
