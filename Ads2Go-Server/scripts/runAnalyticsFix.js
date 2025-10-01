#!/usr/bin/env node

/**
 * Simple script to run the analytics collection fix
 */

const fixAnalyticsCollection = require('./fixAnalyticsCollection');

console.log('🚀 Starting analytics collection fix...');
fixAnalyticsCollection()
  .then(() => {
    console.log('✅ Analytics fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analytics fix failed:', error);
    process.exit(1);
  });
