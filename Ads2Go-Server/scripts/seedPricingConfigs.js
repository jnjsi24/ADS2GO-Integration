const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.development' });

// Import the PricingConfig model
const PricingConfig = require('../src/models/PricingConfig');

// Sample pricing configurations
const pricingConfigs = [
  {
    materialType: 'LCD',
    vehicleType: 'CAR',
    category: 'DIGITAL',
    pricingTiers: [
      { durationDays: 30, pricePerPlay: 0.50, adLengthMultiplier: 1.0 },   // 1 month
      { durationDays: 60, pricePerPlay: 0.45, adLengthMultiplier: 1.0 },   // 2 months
      { durationDays: 90, pricePerPlay: 0.40, adLengthMultiplier: 1.0 },   // 3 months
      { durationDays: 120, pricePerPlay: 0.35, adLengthMultiplier: 1.0 },  // 4 months
      { durationDays: 150, pricePerPlay: 0.30, adLengthMultiplier: 1.0 },  // 5 months
      { durationDays: 180, pricePerPlay: 0.25, adLengthMultiplier: 1.0 }   // 6 months
    ],
    maxDevices: 3,
      minAdLengthSeconds: 20,
    maxAdLengthSeconds: 60,
    isActive: true,
    createdBy: 'system'
  },
  {
    materialType: 'HEADDRESS',
    vehicleType: 'CAR',
    category: 'DIGITAL',
    pricingTiers: [
      { durationDays: 7, pricePerPlay: 0.60, adLengthMultiplier: 1.0 },
      { durationDays: 14, pricePerPlay: 0.55, adLengthMultiplier: 1.0 },
      { durationDays: 30, pricePerPlay: 0.50, adLengthMultiplier: 1.0 },
      { durationDays: 60, pricePerPlay: 0.45, adLengthMultiplier: 1.0 },
      { durationDays: 90, pricePerPlay: 0.40, adLengthMultiplier: 1.0 }
    ],
      maxDevices: 5,
    minAdLengthSeconds: 20,
    maxAdLengthSeconds: 60,
    isActive: true,
    createdBy: 'system'
  },
  {
    materialType: 'LCD',
    vehicleType: 'MOTORCYCLE',
    category: 'DIGITAL',
    pricingTiers: [
      { durationDays: 7, pricePerPlay: 0.40, adLengthMultiplier: 1.0 },
      { durationDays: 14, pricePerPlay: 0.35, adLengthMultiplier: 1.0 },
      { durationDays: 30, pricePerPlay: 0.30, adLengthMultiplier: 1.0 },
      { durationDays: 60, pricePerPlay: 0.25, adLengthMultiplier: 1.0 },
      { durationDays: 90, pricePerPlay: 0.20, adLengthMultiplier: 1.0 }
    ],
    maxDevices: 1,
    minAdLengthSeconds: 5,
    maxAdLengthSeconds: 30,
    isActive: true,
    createdBy: 'system'
  }
];

async function seedPricingConfigs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing pricing configs
    await PricingConfig.deleteMany({});
    console.log('🗑️ Cleared existing pricing configurations');

    // Insert new pricing configs
    const createdConfigs = await PricingConfig.insertMany(pricingConfigs);
    console.log(`✅ Created ${createdConfigs.length} pricing configurations:`);
    
    createdConfigs.forEach(config => {
      console.log(`   - ${config.materialType} ${config.vehicleType} ${config.category} (${config.pricingTiers.length} tiers)`);
    });

    console.log('\n🎉 Pricing configurations seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding pricing configurations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the seeding function
seedPricingConfigs();
