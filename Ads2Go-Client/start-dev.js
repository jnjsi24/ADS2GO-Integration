#!/usr/bin/env node

// Custom development server script with memory optimizations
const { spawn } = require('child_process');
const path = require('path');

// Memory optimization flags - only use direct node arguments
const nodeArgs = [
  '--max-old-space-size=8192'
];

const reactScriptsPath = path.join(__dirname, 'node_modules', '.bin', 'react-scripts');
const args = ['start'];

console.log('🚀 Starting development server with memory optimizations...');
console.log('📊 Memory settings:', {
  maxOldSpaceSize: '8GB'
});

const child = spawn('node', [...nodeArgs, reactScriptsPath, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('❌ Failed to start development server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`📝 Development server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  child.kill('SIGTERM');
});
