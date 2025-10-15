const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const DriverSalaryPricing = require('../src/models/DriverSalaryPricing');
const DriverSalaryCalculation = require('../src/models/DriverSalaryCalculation');
const Driver = require('../src/models/Driver');
const Material = require('../src/models/Material');
const SuperAdmin = require('../src/models/SuperAdmin');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function setupDriverSalary() {
  try {
    console.log('🚀 Setting up Driver Salary System...');

    // 1. Get or create a SuperAdmin for pricing creation
    let superAdmin = await SuperAdmin.findOne();
    if (!superAdmin) {
      console.log('⚠️  No SuperAdmin found. Please create a SuperAdmin first.');
      return;
    }

    // 2. Create sample pricing configurations
    console.log('📊 Creating sample pricing configurations...');
    
    const pricingConfigs = [
      // Digital materials
      { vehicleType: 'CAR', category: 'DIGITAL', materialType: 'LCD', distanceRate: 5.0, hoursRate: 50.0 },
      { vehicleType: 'CAR', category: 'DIGITAL', materialType: 'HEADDRESS', distanceRate: 4.0, hoursRate: 45.0 },
      { vehicleType: 'MOTORCYCLE', category: 'DIGITAL', materialType: 'LCD', distanceRate: 3.0, hoursRate: 40.0 },
      { vehicleType: 'BUS', category: 'DIGITAL', materialType: 'LCD', distanceRate: 6.0, hoursRate: 60.0 },
      { vehicleType: 'JEEP', category: 'DIGITAL', materialType: 'LCD', distanceRate: 4.5, hoursRate: 50.0 },
      { vehicleType: 'E_TRIKE', category: 'DIGITAL', materialType: 'LCD', distanceRate: 3.5, hoursRate: 45.0 },
      
      // Non-digital materials
      { vehicleType: 'CAR', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.0, hoursRate: 30.0 },
      { vehicleType: 'CAR', category: 'NON_DIGITAL', materialType: 'STICKER', distanceRate: 1.5, hoursRate: 25.0 },
      { vehicleType: 'MOTORCYCLE', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 1.5, hoursRate: 25.0 },
      { vehicleType: 'MOTORCYCLE', category: 'NON_DIGITAL', materialType: 'STICKER', distanceRate: 1.0, hoursRate: 20.0 },
      { vehicleType: 'BUS', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 3.0, hoursRate: 40.0 },
      { vehicleType: 'JEEP', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.5, hoursRate: 35.0 },
      { vehicleType: 'E_TRIKE', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.0, hoursRate: 30.0 },
    ];

    for (const config of pricingConfigs) {
      const existingPricing = await DriverSalaryPricing.findOne({
        vehicleType: config.vehicleType,
        category: config.category,
        materialType: config.materialType
      });

      if (!existingPricing) {
        const pricing = new DriverSalaryPricing({
          ...config,
          createdBy: superAdmin._id,
          notes: `Sample pricing for ${config.materialType} (${config.category}) on ${config.vehicleType}`
        });
        await pricing.save();
        console.log(`✅ Created pricing: ${config.materialType} (${config.category}) on ${config.vehicleType}`);
      } else {
        console.log(`⏭️  Pricing already exists: ${config.materialType} (${config.category}) on ${config.vehicleType}`);
      }
    }

    // 3. Get active drivers with materials
    console.log('👥 Finding active drivers with materials...');
    const drivers = await Driver.find({
      accountStatus: 'ACTIVE',
      materialId: { $exists: true, $ne: null }
    }).populate('material');

    console.log(`Found ${drivers.length} active drivers with materials`);

    if (drivers.length === 0) {
      console.log('⚠️  No active drivers with materials found. Please assign materials to drivers first.');
      return;
    }

    // 4. Create sample salary calculations for the last 3 months
    console.log('💰 Creating sample salary calculations...');
    
    const currentDate = new Date();
    const months = [2, 1, 0]; // Last 3 months

    for (const monthOffset of months) {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset + 1, 0);
      
      console.log(`📅 Processing month: ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);

      for (const driver of drivers) {
        try {
          // Check if calculation already exists for this driver and month
          const existingCalculation = await DriverSalaryCalculation.findOne({
            driverId: driver.driverId,
            'calculationPeriod.startDate': { $gte: startDate, $lte: endDate }
          });

          if (existingCalculation) {
            console.log(`⏭️  Calculation already exists for ${driver.driverId} in ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
            continue;
          }

          // Get pricing configuration
          const pricingConfig = await DriverSalaryPricing.findOne({
            vehicleType: driver.vehicleType,
            category: driver.material.category,
            materialType: driver.material.materialType,
            isActive: true
          });

          if (!pricingConfig) {
            console.log(`⚠️  No pricing config found for ${driver.driverId} - ${driver.material.materialType} (${driver.material.category}) on ${driver.vehicleType}`);
            continue;
          }

          // Generate sample tracking data (in real implementation, this would come from DeviceTracking)
          const sampleDistance = Math.random() * 1000 + 500; // 500-1500 km
          const sampleHours = Math.random() * 200 + 100; // 100-300 hours
          const daysWorked = Math.floor(Math.random() * 20) + 20; // 20-40 days

          // Create salary calculation
          const calculation = await DriverSalaryCalculation.createCalculation({
            driverId: driver.driverId,
            materialId: driver.material._id,
            calculationPeriod: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              periodType: 'MONTHLY'
            },
            rawData: {
              totalDistance: Math.round(sampleDistance * 100) / 100,
              totalHours: Math.round(sampleHours * 100) / 100,
              daysWorked
            },
            pricingConfig: {
              vehicleType: driver.vehicleType,
              category: driver.material.category,
              materialType: driver.material.materialType,
              distanceRate: pricingConfig.distanceRate,
              hoursRate: pricingConfig.hoursRate
            },
            status: monthOffset === 0 ? 'CALCULATED' : 'PAID', // Current month is calculated, previous months are paid
            notes: `Sample calculation for ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
          });

          if (monthOffset > 0) {
            // Mark previous months as paid
            calculation.status = 'PAID';
            calculation.paidAt = new Date();
            calculation.paymentReference = `PAY-${driver.driverId}-${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            await calculation.save();
          }

          console.log(`✅ Created calculation for ${driver.driverId}: ${calculation.calculations.totalSalary.toFixed(2)} PHP`);
        } catch (error) {
          console.error(`❌ Error creating calculation for ${driver.driverId}:`, error.message);
        }
      }
    }

    // 5. Summary
    const totalPricing = await DriverSalaryPricing.countDocuments();
    const totalCalculations = await DriverSalaryCalculation.countDocuments();
    
    console.log('\n🎉 Driver Salary System Setup Complete!');
    console.log(`📊 Created ${totalPricing} pricing configurations`);
    console.log(`💰 Created ${totalCalculations} salary calculations`);
    console.log(`👥 Processed ${drivers.length} drivers`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Go to Super Admin → Driver Salary to configure pricing rates');
    console.log('2. Go to Super Admin → Salary Summary to view driver summaries');
    console.log('3. Go to Super Admin → Salary Calculations to manage individual calculations');
    console.log('4. Drivers can view their salary in the mobile app');

  } catch (error) {
    console.error('❌ Error setting up driver salary system:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the setup
setupDriverSalary();
