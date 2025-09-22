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
    // Count total QR scan documents
    const totalCount = await QRScanTracking.countDocuments();
    console.log(`Total QR scan documents found: ${totalCount}`);
    
    if (totalCount > 0) {
      // Delete ALL QR scan documents
      const deleteResult = await QRScanTracking.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} QR scan documents`);
      console.log('🎉 All QR scan documents have been deleted!');
    } else {
      console.log('No QR scan documents found to delete');
    }
    
  } catch (error) {
    console.error('Error during deletion:', error);
  } finally {
    mongoose.disconnect();
  }
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
