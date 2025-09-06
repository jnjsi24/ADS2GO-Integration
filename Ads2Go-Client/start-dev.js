#!/usr/bin/env node

// Custom development server script with memory optimizations
const { spawn } = require('child_process');
const path = require('path');

// Set environment variables for memory optimization
process.env.NODE_OPTIONS = '--max-old-space-size=8192 --optimize-for-size --gc-interval=100 --max-semi-space-size=128';

// Additional memory optimization flags
const nodeArgs = [
  '--max-old-space-size=8192',
  '--optimize-for-size',
  '--gc-interval=100',
  '--max-semi-space-size=128',
  '--expose-gc',
  '--trace-gc'
];

const reactScriptsPath = path.join(__dirname, 'node_modules', '.bin', 'react-scripts');
const args = ['start'];

console.log('🚀 Starting development server with memory optimizations...');
console.log('📊 Memory settings:', {
  maxOldSpaceSize: '8GB',
  optimizeForSize: true,
  gcInterval: '100ms',
  maxSemiSpaceSize: '128MB'
});

const child = spawn('node', [...nodeArgs, reactScriptsPath, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: nodeArgs.join(' ')
  }
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
