const mongoose = require('mongoose');
const MaterialAvailability = require('../src/models/MaterialAvailability');
const Material = require('../src/models/Material');
require('dotenv').config();

async function checkAvailability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('💾 MongoDB connected to Atlas');
    
    console.log('\n=== MATERIAL AVAILABILITY ===');
    const availabilities = await MaterialAvailability.find({}).populate('materialId');
    availabilities.forEach(avail => {
      console.log(`Material: ${avail.materialId.materialId}, Total Slots: ${avail.totalSlots}, Occupied: ${avail.occupiedSlots}, Available: ${avail.availableSlots}, Status: ${avail.status}`);
    });
    
    console.log('\n=== TESTING PLAN AVAILABILITY ===');
    const MaterialAvailabilityService = require('../src/services/materialAvailabilityService');
    
    // Test with Passenger Prime plan
    const testPlanId = '68ada1ffc599b1170b538b1e'; // You'll need to get the actual plan ID
    const testDate = new Date().toISOString();
    
    try {
      const result = await MaterialAvailabilityService.validatePlanAvailability(testPlanId, testDate);
      console.log('Plan availability result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('Error testing plan availability:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAvailability();
