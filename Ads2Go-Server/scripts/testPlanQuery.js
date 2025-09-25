const mongoose = require('mongoose');
const MaterialAvailabilityService = require('../src/services/materialAvailabilityService');
require('dotenv').config();

async function testPlanQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
    
    // Get all plans to see their IDs
    const AdsPlan = require('../src/models/AdsPlan');
    const plans = await AdsPlan.find({}).populate('materials');
    
    console.log('\n=== ALL PLANS WITH IDs ===');
    plans.forEach(p => {
      console.log(`ID: ${p._id}, Name: ${p.name}, Materials: ${p.materials.length}`);
    });
    
    // Test the "Passenger Prime" plan specifically
    const passengerPrime = plans.find(p => p.name === 'Passenger Prime');
    if (passengerPrime) {
      console.log(`\n=== TESTING PASSENGER PRIME (ID: ${passengerPrime._id}) ===`);
      const testDate = new Date().toISOString();
      const result = await MaterialAvailabilityService.validatePlanAvailability(passengerPrime._id.toString(), testDate);
      console.log('Result:', {
        canCreate: result.canCreate,
        totalAvailableSlots: result.totalAvailableSlots,
        availableMaterialsCount: result.availableMaterialsCount
      });
    } else {
      console.log('\n❌ Passenger Prime plan not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testPlanQuery();
