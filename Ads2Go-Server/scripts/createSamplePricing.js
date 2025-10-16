const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const DriverSalaryPricing = require('../src/models/DriverSalaryPricing');
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

async function createSamplePricing() {
  try {
    console.log('🚀 Creating sample pricing configurations...');

    // Get or create a SuperAdmin for pricing creation
    let superAdmin = await SuperAdmin.findOne();
    if (!superAdmin) {
      console.log('⚠️  No SuperAdmin found. Please create a SuperAdmin first.');
      return;
    }

    console.log(`👤 Using SuperAdmin: ${superAdmin.firstName} ${superAdmin.lastName}`);

    // Create sample pricing configurations
    const pricingConfigs = [
      // Digital materials - Higher rates
      { vehicleType: 'CAR', category: 'DIGITAL', materialType: 'LCD', distanceRate: 5.0, hoursRate: 50.0, notes: 'LCD display for cars - premium digital advertising' },
      { vehicleType: 'CAR', category: 'DIGITAL', materialType: 'HEADDRESS', distanceRate: 4.0, hoursRate: 45.0, notes: 'Digital headdress for cars' },
      { vehicleType: 'MOTORCYCLE', category: 'DIGITAL', materialType: 'LCD', distanceRate: 3.0, hoursRate: 40.0, notes: 'LCD display for motorcycles' },
      { vehicleType: 'BUS', category: 'DIGITAL', materialType: 'LCD', distanceRate: 6.0, hoursRate: 60.0, notes: 'LCD display for buses - high visibility' },
      { vehicleType: 'JEEP', category: 'DIGITAL', materialType: 'LCD', distanceRate: 4.5, hoursRate: 50.0, notes: 'LCD display for jeeps' },
      { vehicleType: 'E_TRIKE', category: 'DIGITAL', materialType: 'LCD', distanceRate: 3.5, hoursRate: 45.0, notes: 'LCD display for e-trikes' },
      
      // Non-digital materials - Lower rates
      { vehicleType: 'CAR', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.0, hoursRate: 30.0, notes: 'Banner for cars - traditional advertising' },
      { vehicleType: 'CAR', category: 'NON_DIGITAL', materialType: 'STICKER', distanceRate: 1.5, hoursRate: 25.0, notes: 'Sticker for cars' },
      { vehicleType: 'MOTORCYCLE', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 1.5, hoursRate: 25.0, notes: 'Banner for motorcycles' },
      { vehicleType: 'MOTORCYCLE', category: 'NON_DIGITAL', materialType: 'STICKER', distanceRate: 1.0, hoursRate: 20.0, notes: 'Sticker for motorcycles' },
      { vehicleType: 'BUS', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 3.0, hoursRate: 40.0, notes: 'Banner for buses - large format' },
      { vehicleType: 'JEEP', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.5, hoursRate: 35.0, notes: 'Banner for jeeps' },
      { vehicleType: 'E_TRIKE', category: 'NON_DIGITAL', materialType: 'BANNER', distanceRate: 2.0, hoursRate: 30.0, notes: 'Banner for e-trikes' },
    ];

    let createdCount = 0;
    let existingCount = 0;

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
          isActive: true
        });
        await pricing.save();
        console.log(`✅ Created: ${config.materialType} (${config.category}) on ${config.vehicleType} - ₱${config.distanceRate}/km, ₱${config.hoursRate}/hour`);
        createdCount++;
      } else {
        console.log(`⏭️  Already exists: ${config.materialType} (${config.category}) on ${config.vehicleType}`);
        existingCount++;
      }
    }

    console.log('\n🎉 Sample Pricing Configuration Complete!');
    console.log(`✅ Created ${createdCount} new pricing configurations`);
    console.log(`⏭️  ${existingCount} configurations already existed`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Go to Super Admin → Driver Salary to view and modify pricing rates');
    console.log('2. Assign materials to drivers in the Admin panel');
    console.log('3. Generate salary calculations using the "Generate Monthly" feature');
    console.log('4. View driver salary summaries in Super Admin → Salary Summary');

  } catch (error) {
    console.error('❌ Error creating sample pricing:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
createSamplePricing();
