/**
 * Diagnostic Script: Check DeviceTracking QR Scan Data
 * 
 * This script reads DeviceTracking records from the database and displays
 * the QR scan data to help debug frontend display issues.
 * 
 * Usage: node scripts/checkDeviceTrackingQRScans.js [materialId] [date]
 * Example: node scripts/checkDeviceTrackingQRScans.js DGL-HEADDRESS-CAR-001 2026-01-09
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DeviceTracking = require('../src/models/deviceTracking');

async function checkDeviceTrackingQRScans(materialId = null, dateStr = null) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Build query
    const query = {};
    if (materialId) {
      query.materialId = materialId;
      console.log(`🔍 Filtering by materialId: ${materialId}`);
    }
    
    let targetDate = null;
    if (dateStr) {
      targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      query.date = targetDate;
      console.log(`🔍 Filtering by date: ${dateStr}`);
    } else {
      // Don't filter by date - show all records for this material
      console.log(`🔍 Showing all dates for this material`);
    }

    console.log('\n📊 Query:', JSON.stringify(query, null, 2));
    console.log('─'.repeat(80) + '\n');

    // Find records
    const records = await DeviceTracking.find(query).sort({ lastSeen: -1 });

    if (records.length === 0) {
      console.log('❌ No DeviceTracking records found matching the query\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found ${records.length} DeviceTracking record(s)\n`);

    // Display each record
    records.forEach((record, index) => {
      console.log('═'.repeat(80));
      console.log(`📋 Record ${index + 1} of ${records.length}`);
      console.log('═'.repeat(80));
      console.log(`Material ID: ${record.materialId}`);
      console.log(`Date: ${record.date ? new Date(record.date).toISOString().split('T')[0] : 'N/A'}`);
      console.log(`Car Group ID: ${record.carGroupId || 'N/A'}`);
      console.log(`Screen Type: ${record.screenType || 'N/A'}`);
      console.log(`Is Online: ${record.isOnline ? '✅ Yes' : '❌ No'}`);
      console.log(`Last Seen: ${record.lastSeen ? new Date(record.lastSeen).toLocaleString() : 'N/A'}`);
      console.log(`\n📊 Summary Counts:`);
      console.log(`   Total Ad Plays: ${record.totalAdPlays || 0}`);
      console.log(`   Total QR Scans: ${record.totalQRScans || 0}`);
      console.log(`   QR Scans Array Length: ${record.qrScans ? record.qrScans.length : 0}`);
      console.log(`   Total Hours Online: ${record.totalHoursOnline || 0}`);
      console.log(`   Total Distance: ${(record.totalDistanceTraveled || 0).toFixed(3)} km`);

      // Check for mismatch
      if (record.totalQRScans !== (record.qrScans ? record.qrScans.length : 0)) {
        console.log(`\n⚠️  MISMATCH DETECTED!`);
        console.log(`   totalQRScans (${record.totalQRScans}) ≠ qrScans.length (${record.qrScans ? record.qrScans.length : 0})`);
        console.log(`   This record needs repair!`);
      }

      // Display QR Scans Array
      console.log(`\n📱 QR Scans Array (${record.qrScans ? record.qrScans.length : 0} scans):`);
      if (record.qrScans && record.qrScans.length > 0) {
        record.qrScans.forEach((scan, scanIndex) => {
          console.log(`   ${scanIndex + 1}. Ad: ${scan.adTitle || 'Unknown'} (${scan.adId})`);
          console.log(`      Slot: ${scan.slotNumber || 'N/A'}`);
          console.log(`      Timestamp: ${scan.scanTimestamp ? new Date(scan.scanTimestamp).toLocaleString() : 'N/A'}`);
          console.log(`      User ID: ${scan.userId || 'N/A'}`);
          console.log(`      Device Type: ${scan.deviceType || 'N/A'}`);
          console.log(`      Browser: ${scan.browser || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   (No QR scans in array)');
      }

      // Display QR Scans By Ad
      console.log(`\n📊 QR Scans By Ad (${record.qrScansByAd ? record.qrScansByAd.length : 0} entries):`);
      if (record.qrScansByAd && record.qrScansByAd.length > 0) {
        record.qrScansByAd.forEach((adScan, adIndex) => {
          console.log(`   ${adIndex + 1}. Ad: ${adScan.adTitle || 'Unknown'} (${adScan.adId})`);
          console.log(`      Scan Count: ${adScan.scanCount || 0}`);
          console.log(`      User ID: ${adScan.userId || 'N/A'}`);
          console.log(`      First Scanned: ${adScan.firstScanned ? new Date(adScan.firstScanned).toLocaleString() : 'N/A'}`);
          console.log(`      Last Scanned: ${adScan.lastScanned ? new Date(adScan.lastScanned).toLocaleString() : 'N/A'}`);
          
          // Verify count matches array
          const actualCount = record.qrScans ? record.qrScans.filter(s => {
            const scanAdId = s.adId ? (s.adId.toString ? s.adId.toString() : String(s.adId)) : '';
            const adScanAdId = adScan.adId ? (adScan.adId.toString ? adScan.adId.toString() : String(adScan.adId)) : '';
            return scanAdId === adScanAdId;
          }).length : 0;
          
          if (adScan.scanCount !== actualCount) {
            console.log(`      ⚠️  MISMATCH: scanCount (${adScan.scanCount}) ≠ actual array count (${actualCount})`);
          } else {
            console.log(`      ✅ Count matches array`);
          }
          console.log('');
        });
      } else {
        console.log('   (No QR scans by ad entries)');
      }

      // Display Ad Performance
      console.log(`\n🎬 Ad Performance (${record.adPerformance ? record.adPerformance.length : 0} entries):`);
      if (record.adPerformance && record.adPerformance.length > 0) {
        record.adPerformance.forEach((adPerf, perfIndex) => {
          console.log(`   ${perfIndex + 1}. Ad: ${adPerf.adTitle || 'Unknown'} (${adPerf.adId})`);
          console.log(`      Play Count: ${adPerf.playCount || 0}`);
          console.log(`      Total View Time: ${adPerf.totalViewTime || 0}s`);
          console.log(`      User ID: ${adPerf.userId || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   (No ad performance entries)');
      }

      // Display Slots
      console.log(`\n🔌 Device Slots (${record.slots ? record.slots.length : 0} slots):`);
      if (record.slots && record.slots.length > 0) {
        record.slots.forEach((slot, slotIndex) => {
          console.log(`   Slot ${slot.slotNumber}:`);
          console.log(`      Device ID: ${slot.deviceId || 'N/A'}`);
          console.log(`      Is Online: ${slot.isOnline ? '✅ Yes' : '❌ No'}`);
          console.log(`      Last Seen: ${slot.lastSeen ? new Date(slot.lastSeen).toLocaleString() : 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   (No slots configured)');
      }

      console.log('');
    });

    console.log('═'.repeat(80));
    console.log('\n✅ Diagnostic complete!\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const materialId = args[0] || null;
const dateStr = args[1] || null;

// Run the diagnostic
checkDeviceTrackingQRScans(materialId, dateStr);
