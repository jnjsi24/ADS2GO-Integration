const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const Driver = require('../src/models/Driver');
const DriverSalaryCalculation = require('../src/models/DriverSalaryCalculation');
const DriverSalaryService = require('../src/services/driverSalaryService');

// Get driver name from command line argument or use default
const driverName = process.argv[2] || 'Bianca Inocencio';
const forceRecalculate = process.argv[3] === '--force';

async function recalculateDriverSalary() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ads2go';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find driver
    console.log(`\n🔍 Searching for driver: "${driverName}"...`);
    const driver = await Driver.findOne({
      $or: [
        { firstName: driverName.split(' ')[0], lastName: driverName.split(' ')[1] },
        { fullName: { $regex: new RegExp(driverName.replace(/\s+/g, '.*'), 'i') } }
      ]
    }).populate('material');

    if (!driver) {
      console.log('❌ Driver not found');
      console.log('\n💡 Usage: node scripts/recalculateDriverSalary.js "Driver Name" [--force]');
      process.exit(1);
    }

    console.log(`\n✅ Found driver:`);
    console.log(`   Driver ID: ${driver.driverId}`);
    console.log(`   Name: ${driver.firstName} ${driver.lastName}`);
    console.log(`   Account Status: ${driver.accountStatus}`);
    console.log(`   Material ID: ${driver.materialId || 'Not assigned'}`);

    if (!driver.materialId) {
      console.log('\n❌ Driver has no material assigned - cannot calculate salary');
      process.exit(1);
    }

    // Get current month's date range
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    console.log(`\n📅 Calculation Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Find existing calculation
    let calculation = await DriverSalaryCalculation.findOne({
      driverId: driver.driverId,
      'calculationPeriod.startDate': { $gte: startDate },
      'calculationPeriod.endDate': { $lte: endDate },
      isActive: true
    });

    if (!calculation) {
      console.log('\n⚠️  No calculation found for current month');
      console.log('   Creating new calculation...');
      
      // Create new calculation
      const calculationData = await DriverSalaryService.calculateDriverSalary(
        driver.driverId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      calculation = await DriverSalaryCalculation.createCalculation({
        driverId: driver.driverId,
        driverName: calculationData.driverName,
        materialId: driver.materialId,
        deviceId: calculationData.deviceId,
        calculationPeriod: calculationData.calculationPeriod,
        rawData: calculationData.rawData,
        pricingConfig: calculationData.pricingConfig,
        notes: `Recalculated on ${new Date().toLocaleString()}`,
        status: 'CALCULATED'
      });

      console.log('\n✅ Created new calculation:');
    } else {
      console.log('\n📊 Found existing calculation:');
      console.log(`   Previous Distance: ${calculation.rawData.totalDistance} km`);
      console.log(`   Previous Hours: ${calculation.rawData.totalHours} hours`);
      console.log(`   Previous Salary: ₱${calculation.calculations.totalSalary}`);
      console.log(`   Status: ${calculation.status}`);
      
      if (calculation.status === 'APPROVED' && !forceRecalculate) {
        console.log('\n⚠️  Calculation is already APPROVED');
        console.log('   Use --force flag to recalculate approved calculations');
        console.log('   Example: node scripts/recalculateDriverSalary.js "Bianca Inocencio" --force');
        process.exit(0);
      }

      if (calculation.status === 'PAID' && !forceRecalculate) {
        console.log('\n⚠️  Calculation is already PAID');
        console.log('   Use --force flag to recalculate paid calculations');
        console.log('   Example: node scripts/recalculateDriverSalary.js "Bianca Inocencio" --force');
        process.exit(0);
      }

      console.log('\n🔄 Recalculating with latest data...');
      
      // Recalculate with latest data
      const updatedData = await DriverSalaryService.calculateDriverSalary(
        driver.driverId,
        calculation.calculationPeriod.startDate.toISOString(),
        calculation.calculationPeriod.endDate.toISOString()
      );

      // Update the calculation
      calculation.rawData = updatedData.rawData;
      calculation.calculations = updatedData.calculations;
      calculation.updatedAt = new Date();
      const previousNotes = calculation.notes || '';
      calculation.notes = `${previousNotes} | Recalculated on ${new Date().toLocaleString()}`;
      
      await calculation.save();

      console.log('\n✅ Updated calculation:');
    }

    // Display results
    console.log(`\n📊 Calculation Results:`);
    console.log(`   Period: ${calculation.calculationPeriod.startDate.toISOString().split('T')[0]} to ${calculation.calculationPeriod.endDate.toISOString().split('T')[0]}`);
    console.log(`   Distance: ${calculation.rawData.totalDistance} km`);
    console.log(`   Hours: ${calculation.rawData.totalHours} hours`);
    console.log(`   Days Worked: ${calculation.rawData.daysWorked}`);
    console.log(`   Distance Salary: ₱${calculation.calculations.distanceComputation.toFixed(2)}`);
    console.log(`   Hours Salary: ₱${calculation.calculations.hoursComputation.toFixed(2)}`);
    console.log(`   Total Salary: ₱${calculation.calculations.totalSalary.toFixed(2)}`);
    console.log(`   Status: ${calculation.status}`);
    console.log(`   Updated: ${calculation.updatedAt.toISOString()}`);

    // Check all calculations for total
    const allCalculations = await DriverSalaryCalculation.find({
      driverId: driver.driverId,
      isActive: true
    }).sort({ 'calculationPeriod.startDate': -1 });

    const totalSalary = allCalculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
    console.log(`\n💰 Total Salary (all calculations): ₱${totalSalary.toFixed(2)}`);
    console.log(`   (Based on ${allCalculations.length} calculation document(s))`);

    console.log('\n✅ Recalculation complete!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

recalculateDriverSalary();

