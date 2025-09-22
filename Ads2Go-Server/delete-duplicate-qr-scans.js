const mongoose = require('mongoose');
const QRScanTracking = require('./src/models/qrScanTracking');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ads2go', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Delete all QR scan documents for the RICK ad
    const deleteResult = await QRScanTracking.deleteMany({ 
      adId: '68d01c8a905edca9f119e916',
      materialId: 'DGL-HEADDRESS-CAR-001'
    });
    
    console.log(`✅ Deleted ${deleteResult.deletedCount} duplicate QR scan documents`);
    console.log('🎉 Cleanup completed successfully!');
    
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
