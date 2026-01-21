/**
 * List All Drivers Script
 * 
 * This script lists all drivers in the database with their details
 * Use this to find the correct driver email for the salary report
 * 
 * Usage: node scripts/listDrivers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Driver = require('../src/models/Driver');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ads2go';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    console.log(`🔌 Connecting to MongoDB...`);
    console.log(`   Connection string: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}\n`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\n💡 TIP: Check your .env file and make sure MONGODB_URI is set correctly');
    console.error('   Example: MONGODB_URI=mongodb://username:password@host:27017/database\n');
    throw error;
  }
}

/**
 * List all drivers
 */
async function listDrivers() {
  try {
    console.log('📋 Fetching all drivers...\n');
    
    // Get all drivers with relevant fields
    const drivers = await Driver.find({})
      .populate('materialId')
      .sort({ createdAt: -1 })
      .lean();
    
    if (drivers.length === 0) {
      console.log('⚠️  No drivers found in the database\n');
      return;
    }
    
    console.log(`Found ${drivers.length} driver(s):\n`);
    console.log('='.repeat(100));
    
    drivers.forEach((driver, index) => {
      console.log(`\n${index + 1}. ${driver.firstName} ${driver.lastName}`);
      console.log('-'.repeat(100));
      console.log(`   Driver ID:       ${driver.driverId}`);
      console.log(`   Email:           ${driver.email}`);
      console.log(`   Contact:         ${driver.contactNumber}`);
      console.log(`   Account Status:  ${driver.accountStatus}`);
      console.log(`   Review Status:   ${driver.reviewStatus}`);
      console.log(`   Vehicle Type:    ${driver.vehicleType}`);
      console.log(`   Plate Number:    ${driver.vehiclePlateNumber}`);
      console.log(`   Email Verified:  ${driver.isEmailVerified ? 'Yes' : 'No'}`);
      
      if (driver.materialId) {
        console.log(`   Material:        ${driver.materialId.materialId} (${driver.materialId.materialType})`);
        console.log(`   Material Status: ${driver.materialId.status}`);
      } else {
        console.log(`   Material:        None assigned`);
      }
      
      console.log(`   Date Joined:     ${new Date(driver.dateJoined).toLocaleDateString()}`);
    });
    
    console.log('\n' + '='.repeat(100));
    console.log('\n💡 TIP: Copy the email address you want to use in the salary report script\n');
    
    // Show active drivers with materials
    const activeDriversWithMaterials = drivers.filter(d => 
      d.accountStatus === 'ACTIVE' && 
      d.reviewStatus === 'APPROVED' && 
      d.materialId
    );
    
    if (activeDriversWithMaterials.length > 0) {
      console.log('✅ ACTIVE DRIVERS WITH MATERIALS (Ready for salary report):');
      console.log('-'.repeat(100));
      activeDriversWithMaterials.forEach(driver => {
        console.log(`   • ${driver.email} - ${driver.firstName} ${driver.lastName} (${driver.driverId})`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error listing drivers:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🚀 Starting Driver List...\n');
    
    // Connect to database
    await connectDB();
    
    // List all drivers
    await listDrivers();
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  }
}

// Run the script
main();
