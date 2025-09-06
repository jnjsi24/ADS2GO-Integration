#!/usr/bin/env node

// Simple memory check script
const os = require('os');

console.log('🖥️  System Memory Information:');
console.log('================================');

const totalMemory = Math.round(os.totalmem() / 1024 / 1024 / 1024); // GB
const freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024); // GB
const usedMemory = totalMemory - freeMemory;

console.log(`Total Memory: ${totalMemory} GB`);
console.log(`Used Memory: ${usedMemory} GB`);
console.log(`Free Memory: ${freeMemory} GB`);
console.log(`Memory Usage: ${Math.round((usedMemory / totalMemory) * 100)}%`);

console.log('\n📊 Recommendations:');
console.log('===================');

if (totalMemory < 8) {
  console.log('⚠️  WARNING: System has less than 8GB RAM');
  console.log('   - Consider using: npm run start:fallback');
  console.log('   - Or close other applications to free up memory');
} else if (totalMemory < 16) {
  console.log('✅ System has adequate memory (8-16GB)');
  console.log('   - Current settings should work: npm start');
} else {
  console.log('🚀 System has plenty of memory (16GB+)');
  console.log('   - Current settings should work fine: npm start');
}

if (freeMemory < 2) {
  console.log('⚠️  WARNING: Less than 2GB free memory');
  console.log('   - Close other applications before starting the dev server');
  console.log('   - Consider using: npm run start:fallback');
}

console.log('\n🔧 Available Commands:');
console.log('======================');
console.log('npm start              - 4GB heap size (recommended)');
console.log('npm run start:fallback - 2GB heap size (low memory)');
console.log('npm run build          - Build for production');
