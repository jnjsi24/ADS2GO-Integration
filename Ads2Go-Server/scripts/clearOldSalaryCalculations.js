/**
 * Clear Old Salary Calculations Script
 * 
 * This script deletes all existing salary calculations from the database
 * so they can be regenerated with the updated billable calculation logic
 * (1m precision for distance, complete minutes for time, floored per day).
 * 
 * Usage:
 *   node scripts/clearOldSalaryCalculations.js
 * 
 * Options:
 *   --driverId <id>  - Delete calculations for a specific driver only
 *   --all            - Delete all salary calculations (default)
 *   --confirm        - Skip confirmation prompt
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DriverSalaryCalculation = require('../src/models/DriverSalaryCalculation');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const driverId = args.includes('--driverId') ? args[args.indexOf('--driverId') + 1] : null;
const skipConfirmation = args.includes('--confirm');

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Get confirmation from user
 */
async function getConfirmation(message) {
  if (skipConfirmation) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Clear salary calculations
 */
async function clearSalaryCalculations() {
  try {
    console.log('🗑️  Clear Old Salary Calculations');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  This will delete salary calculations that were created with the old logic.');
    console.log('   After deletion, admins will need to regenerate them with the new logic.');
    console.log('');

    // Build query filter
    const filter = driverId ? { driverId } : {};
    
    // Count existing calculations
    const count = await DriverSalaryCalculation.countDocuments(filter);
    
    if (count === 0) {
      console.log('ℹ️  No salary calculations found to delete.');
      return;
    }

    // Show what will be deleted
    console.log('📊 Found Calculations:');
    console.log('-'.repeat(80));
    if (driverId) {
      console.log(`   Driver: ${driverId}`);
    } else {
      console.log('   All drivers');
    }
    console.log(`   Total calculations: ${count}`);
    console.log('');

    // Get sample of calculations to delete
    const samples = await DriverSalaryCalculation.find(filter)
      .limit(5)
      .select('driverId calculationPeriod.startDate calculationPeriod.endDate calculations.totalSalary status')
      .sort({ createdAt: -1 });

    console.log('📋 Sample calculations that will be deleted:');
    console.log('-'.repeat(80));
    samples.forEach((calc, idx) => {
      const startDate = new Date(calc.calculationPeriod.startDate).toISOString().split('T')[0];
      const endDate = new Date(calc.calculationPeriod.endDate).toISOString().split('T')[0];
      console.log(`   ${idx + 1}. ${calc.driverId} | ${startDate} to ${endDate} | ₱${calc.calculations.totalSalary.toFixed(2)} | ${calc.status}`);
    });
    
    if (count > 5) {
      console.log(`   ... and ${count - 5} more`);
    }
    console.log('');

    // Confirm deletion
    const confirmed = await getConfirmation('⚠️  Are you sure you want to DELETE these calculations?');
    
    if (!confirmed) {
      console.log('❌ Deletion cancelled by user.');
      return;
    }

    // Delete calculations
    console.log('\n🗑️  Deleting calculations...');
    const result = await DriverSalaryCalculation.deleteMany(filter);
    
    console.log('✅ Deletion complete!');
    console.log('-'.repeat(80));
    console.log(`   Deleted: ${result.deletedCount} calculation(s)`);
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Make sure your server is restarted with the new salary logic');
    console.log('   2. Admins should regenerate salary calculations via the admin panel');
    console.log('   3. New calculations will use the updated billable logic:');
    console.log('      - Distance: Floored to nearest meter (per day)');
    console.log('      - Time: Floored to complete minutes (per day)');
    console.log('');

  } catch (error) {
    console.error('❌ Error clearing salary calculations:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await connectDB();
    await clearSalaryCalculations();
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  }
}

// Run the script
main();
