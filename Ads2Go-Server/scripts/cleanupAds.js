const mongoose = require('mongoose');
require('dotenv').config();

// Import cleanup utilities
const { runCleanup } = require('../src/utils/cleanupUnpaidAds');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    console.log('✅ Connected to MongoDB');

    // Run cleanup
    const result = await runCleanup();
    
    if (result.unpaid.success && result.expired.success) {
      console.log('✅ Cleanup completed successfully');
      process.exit(0);
    } else {
      console.error('❌ Cleanup failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
