const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Driver = require('../src/models/Driver');
const DriverSalaryCalculation = require('../src/models/DriverSalaryCalculation');
const Material = require('../src/models/Material');
const DriverSalaryPricing = require('../src/models/DriverSalaryPricing');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');

const driverName = 'Bianca Inocencio';

async function checkDriverSalary() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ads2go';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find driver by name
    console.log(`\n🔍 Searching for driver: "${driverName}"...`);
    const driver = await Driver.findOne({
      $or: [
        { firstName: 'Bianca', lastName: 'Inocencio' },
        { firstName: 'Bianca', lastName: { $regex: /Inocencio/i } },
        { fullName: { $regex: /Bianca.*Inocencio/i } }
      ]
    }).populate('material');

    if (!driver) {
      console.log('❌ Driver not found in database');
      console.log('\n📋 Searching for similar names...');
      const similarDrivers = await Driver.find({
        $or: [
          { firstName: { $regex: /Bianca/i } },
          { lastName: { $regex: /Inocencio/i } }
        ]
      }).select('driverId firstName lastName email accountStatus materialId');
      
      if (similarDrivers.length > 0) {
        console.log(`\nFound ${similarDrivers.length} similar drivers:`);
        similarDrivers.forEach(d => {
          console.log(`  - ${d.firstName} ${d.lastName} (${d.driverId}) - Status: ${d.accountStatus}`);
        });
      }
      process.exit(1);
    }

    console.log(`\n✅ Found driver:`);
    console.log(`   Driver ID: ${driver.driverId}`);
    console.log(`   Name: ${driver.firstName} ${driver.lastName}`);
    console.log(`   Email: ${driver.email}`);
    console.log(`   Account Status: ${driver.accountStatus}`);
    console.log(`   Vehicle Type: ${driver.vehicleType}`);
    console.log(`   Material ID: ${driver.materialId || 'Not assigned'}`);

    // Check if driver has material assigned
    if (!driver.materialId) {
      console.log('\n⚠️  Driver has no material assigned - salary calculations cannot be created');
      process.exit(1);
    }

    // Get material details
    const material = await Material.findById(driver.materialId);
    if (!material) {
      console.log('\n⚠️  Material not found - salary calculations cannot be created');
      process.exit(1);
    }

    console.log(`\n📦 Material Details:`);
    console.log(`   Material ID: ${material.materialId}`);
    console.log(`   Material Type: ${material.materialType}`);
    console.log(`   Category: ${material.category}`);
    console.log(`   Vehicle Type: ${material.vehicleType}`);

    // Check pricing configuration
    const pricingConfig = await DriverSalaryPricing.findOne({
      vehicleType: driver.vehicleType,
      category: material.category,
      materialType: material.materialType,
      isActive: true
    });

    if (!pricingConfig) {
      console.log(`\n⚠️  No pricing configuration found for:`);
      console.log(`   Vehicle Type: ${driver.vehicleType}`);
      console.log(`   Category: ${material.category}`);
      console.log(`   Material Type: ${material.materialType}`);
      console.log(`\n❌ Salary calculations cannot be created without pricing configuration`);
    } else {
      console.log(`\n💰 Pricing Configuration Found:`);
      console.log(`   Distance Rate: ₱${pricingConfig.distanceRate}`);
      console.log(`   Hours Rate: ₱${pricingConfig.hoursRate}`);
    }

    // Check existing salary calculations
    console.log(`\n📊 Checking existing salary calculations...`);
    const calculations = await DriverSalaryCalculation.find({
      driverId: driver.driverId,
      isActive: true
    }).sort({ 'calculationPeriod.startDate': -1 });

    console.log(`\n📋 Found ${calculations.length} calculation document(s):`);
    
    if (calculations.length === 0) {
      console.log('   ❌ No salary calculations found');
    } else {
      calculations.forEach((calc, index) => {
        console.log(`\n   Calculation ${index + 1}:`);
        console.log(`   - Period: ${calc.calculationPeriod.startDate.toISOString().split('T')[0]} to ${calc.calculationPeriod.endDate.toISOString().split('T')[0]}`);
        console.log(`   - Status: ${calc.status}`);
        console.log(`   - Distance: ${calc.rawData.totalDistance} km`);
        console.log(`   - Hours: ${calc.rawData.totalHours} hours`);
        console.log(`   - Days Worked: ${calc.rawData.daysWorked}`);
        console.log(`   - Distance Salary: ₱${calc.calculations.distanceComputation}`);
        console.log(`   - Hours Salary: ₱${calc.calculations.hoursComputation}`);
        console.log(`   - Total Salary: ₱${calc.calculations.totalSalary}`);
        console.log(`   - Created: ${calc.createdAt.toISOString()}`);
      });

      // Calculate total salary
      const totalSalary = calculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
      console.log(`\n💰 Total Salary (all calculations): ₱${totalSalary.toFixed(2)}`);
    }

    // Check current month calculation
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const currentMonthCalc = await DriverSalaryCalculation.findOne({
      driverId: driver.driverId,
      'calculationPeriod.startDate': { $gte: startDate },
      'calculationPeriod.endDate': { $lte: endDate },
      isActive: true
    });

    if (!currentMonthCalc) {
      console.log(`\n⚠️  No calculation found for current month (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
      console.log(`   This explains why salary shows 0 in the dashboard`);
    } else {
      console.log(`\n✅ Current month calculation exists:`);
      console.log(`   Total Salary: ₱${currentMonthCalc.calculations.totalSalary}`);
    }

    // Check tracking data
    console.log(`\n📈 Checking tracking data...`);
    const deviceHistory = await DeviceDataHistoryV2.findOne({
      materialId: material.materialId
    });

    if (!deviceHistory) {
      console.log('   ⚠️  No tracking data found in DeviceDataHistoryV2');
    } else {
      const currentMonthData = deviceHistory.dailyData ? deviceHistory.dailyData.filter(d => {
        const dataDate = new Date(d.date);
        return dataDate >= startDate && dataDate <= endDate;
      }) : [];

      console.log(`   ✅ Found tracking data`);
      console.log(`   - Total days in history: ${deviceHistory.dailyData?.length || 0}`);
      console.log(`   - Days in current month: ${currentMonthData.length}`);
      
      if (currentMonthData.length > 0) {
        const totalDistance = currentMonthData.reduce((sum, d) => sum + (d.totalDistanceTraveled || 0), 0);
        const totalHours = currentMonthData.reduce((sum, d) => sum + (d.totalHoursOnline || 0), 0);
        console.log(`   - Total Distance (current month): ${totalDistance.toFixed(2)} km`);
        console.log(`   - Total Hours (current month): ${totalHours.toFixed(2)} hours`);
        
        if (pricingConfig) {
          const estimatedSalary = (totalDistance * pricingConfig.distanceRate) + (totalHours * pricingConfig.hoursRate);
          console.log(`   - Estimated Salary (if calculated): ₱${estimatedSalary.toFixed(2)}`);
        }
      }
    }

    console.log('\n✅ Check complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDriverSalary();

