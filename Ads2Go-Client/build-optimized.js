#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting optimized build process...');

// Set memory limit for build process
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

try {
  // Clean previous build
  if (fs.existsSync('build')) {
    console.log('🧹 Cleaning previous build...');
    fs.rmSync('build', { recursive: true, force: true });
  }

  // Run the build command
  console.log('📦 Building React app...');
  execSync('npx react-scripts build', { 
    stdio: 'inherit',
    env: { ...process.env, CI: 'false' }
  });

  // Verify build was successful
  const buildPath = path.join(__dirname, 'build');
  const indexPath = path.join(buildPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('Build failed - index.html not found');
  }

  console.log('✅ Build completed successfully!');
  console.log(`📁 Build output: ${buildPath}`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
