const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Driver = require('../src/models/Driver');
const DriverSalaryCalculation = require('../src/models/DriverSalaryCalculation');
const Material = require('../src/models/Material');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');

const driverName = 'Bianca Inocencio';

async function checkRealTimeUpdate() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ads2go';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find driver
    const driver = await Driver.findOne({
      $or: [
        { firstName: 'Bianca', lastName: 'Inocencio' },
        { firstName: 'Bianca', lastName: { $regex: /Inocencio/i } },
        { fullName: { $regex: /Bianca.*Inocencio/i } }
      ]
    }).populate('material');

    if (!driver) {
      console.log('❌ Driver not found');
      process.exit(1);
    }

    console.log(`\n🔍 Checking real-time update service for: ${driver.firstName} ${driver.lastName} (${driver.driverId})`);

    // Get material
    const material = await Material.findById(driver.materialId);
    if (!material) {
      console.log('❌ Material not found');
      process.exit(1);
    }

    console.log(`\n📦 Material: ${material.materialId}`);

    // Get current calculation
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    console.log(`\n📅 Current month range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const calculation = await DriverSalaryCalculation.findOne({
      driverId: driver.driverId,
      'calculationPeriod.startDate': { $gte: startDate },
      'calculationPeriod.endDate': { $lte: endDate },
      isActive: true
    });

    if (calculation) {
      console.log(`\n📊 Found calculation:`);
      console.log(`   Period: ${calculation.calculationPeriod.startDate.toISOString().split('T')[0]} to ${calculation.calculationPeriod.endDate.toISOString().split('T')[0]}`);
      console.log(`   Status: ${calculation.status}`);
      console.log(`   Created: ${calculation.createdAt.toISOString()}`);
      console.log(`   Updated: ${calculation.updatedAt.toISOString()}`);
    } else {
      console.log('\n⚠️  No calculation found for current month');
    }

    // Check DeviceDataHistoryV2
    const deviceHistory = await DeviceDataHistoryV2.findOne({
      materialId: material.materialId
    });

    if (!deviceHistory) {
      console.log('\n❌ No DeviceDataHistoryV2 found');
      process.exit(1);
    }

    // Check when data was last modified
    console.log(`\n📈 DeviceDataHistoryV2 Info:`);
    console.log(`   Last Modified: ${deviceHistory.updatedAt.toISOString()}`);
    console.log(`   Created: ${deviceHistory.createdAt.toISOString()}`);
    console.log(`   Daily Data Count: ${deviceHistory.dailyData?.length || 0}`);

    // Check if calculation was created before tracking data
    if (calculation && deviceHistory) {
      const calcCreated = new Date(calculation.createdAt);
      const dataUpdated = new Date(deviceHistory.updatedAt);
      
      console.log(`\n⏰ Timeline Analysis:`);
      console.log(`   Calculation Created: ${calcCreated.toISOString()}`);
      console.log(`   Data Last Updated: ${dataUpdated.toISOString()}`);
      
      if (calcCreated < dataUpdated) {
        console.log(`\n⚠️  ISSUE FOUND: Calculation was created BEFORE tracking data was updated!`);
        console.log(`   The real-time update service should have been triggered when data was updated.`);
        console.log(`   Possible reasons:`);
        console.log(`   1. Post-save hook didn't fire (data might have been updated directly in DB)`);
        console.log(`   2. Date range mismatch (calculation period doesn't match current month)`);
        console.log(`   3. Real-time update service failed silently`);
      } else {
        console.log(`\n✅ Calculation was created after data update - should be up to date`);
      }
    }

    // Check date range issue
    if (calculation) {
      const calcStart = new Date(calculation.calculationPeriod.startDate);
      const calcEnd = new Date(calculation.calculationPeriod.endDate);
      
      console.log(`\n🔍 Date Range Check:`);
      console.log(`   Calculation Period: ${calcStart.toISOString().split('T')[0]} to ${calcEnd.toISOString().split('T')[0]}`);
      console.log(`   Current Month: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Check if calculation period matches current month
      const calcStartMonth = calcStart.getMonth();
      const calcStartYear = calcStart.getFullYear();
      const currentMonth = startDate.getMonth();
      const currentYear = startDate.getFullYear();
      
      if (calcStartMonth !== currentMonth || calcStartYear !== currentYear) {
        console.log(`\n⚠️  ISSUE FOUND: Calculation period doesn't match current month!`);
        console.log(`   Calculation is for a different month, so real-time updates won't match.`);
      } else {
        console.log(`\n✅ Date ranges match - real-time update should work`);
      }
    }

    // Check if post-save hook would trigger
    console.log(`\n🔧 Real-Time Update Service Check:`);
    console.log(`   The service is triggered by:`);
    console.log(`   1. DeviceDataHistoryV2 post-save hook (when dailyData or lifetimeTotals changes)`);
    console.log(`   2. DeviceTracking post-save hook (when tracking data changes)`);
    console.log(`\n   The service checks:`);
    console.log(`   - Material has driverId: ${material.driverId ? '✅' : '❌'}`);
    console.log(`   - Driver exists: ${driver ? '✅' : '❌'}`);
    console.log(`   - Calculation exists for month: ${calculation ? '✅' : '❌'}`);
    
    if (calculation) {
      const updateDate = new Date();
      const updateStartDate = new Date(updateDate.getFullYear(), updateDate.getMonth(), 1);
      const updateEndDate = new Date(updateDate.getFullYear(), updateDate.getMonth() + 1, 0);
      
      const calcStart = new Date(calculation.calculationPeriod.startDate);
      const calcEnd = new Date(calculation.calculationPeriod.endDate);
      
      const dateMatch = calcStart >= updateStartDate && calcEnd <= updateEndDate;
      console.log(`   - Date range matches current month: ${dateMatch ? '✅' : '❌'}`);
      
      if (!dateMatch) {
        console.log(`\n❌ ROOT CAUSE: Date range mismatch prevents real-time updates!`);
        console.log(`   The calculation period (${calcStart.toISOString().split('T')[0]} to ${calcEnd.toISOString().split('T')[0]})`);
        console.log(`   doesn't match the current month (${updateStartDate.toISOString().split('T')[0]} to ${updateEndDate.toISOString().split('T')[0]})`);
        console.log(`   The real-time update service only updates calculations for the current month.`);
      }
    }

    console.log('\n✅ Check complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRealTimeUpdate();

