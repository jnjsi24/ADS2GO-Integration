const mongoose = require('mongoose');
const DeviceDataHistory = require('../src/models/deviceDataHistory');

require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

async function verifyMerge() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    // Check for DGL-HEADDRESS-CAR-005 on 2025-10-03
    const records = await DeviceDataHistory.find({ 
      materialId: 'DGL-HEADDRESS-CAR-005', 
      date: new Date('2025-10-03') 
    }).sort({ archivedAt: -1 });
    
    console.log(`\n📊 Found ${records.length} records for DGL-HEADDRESS-CAR-005 on 2025-10-03:`);
    
    records.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record._id}`);
      console.log(`   archivedAt: ${record.archivedAt}`);
      console.log(`   totalAdPlays: ${record.totalAdPlays}`);
      console.log(`   totalQRScans: ${record.totalQRScans}`);
      console.log(`   totalHoursOnline: ${record.totalHoursOnline}`);
      console.log(`   adPlaybacks count: ${record.adPlaybacks?.length || 0}`);
      console.log(`   qrScans count: ${record.qrScans?.length || 0}`);
      console.log(`   locationHistory count: ${record.locationHistory?.length || 0}`);
      console.log('');
    });
    
    // Check for any other duplicates
    const allDuplicates = await DeviceDataHistory.aggregate([
      {
        $match: {
          materialId: { $exists: true, $ne: null },
          date: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            materialId: '$materialId',
            date: '$date'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`\n🔍 Remaining duplicate groups: ${allDuplicates.length}`);
    if (allDuplicates.length > 0) {
      allDuplicates.forEach(dup => {
        console.log(`  - ${dup._id.materialId} on ${dup._id.date.toISOString().split('T')[0]}: ${dup.count} records`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error verifying merge:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

verifyMerge();
