#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting optimized build process...');

// Set memory limit for build process
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Log environment variables for debugging (important for Railway builds)
console.log('🔍 Environment Variables Check:');
console.log('  REACT_APP_API_URL:', process.env.REACT_APP_API_URL || '❌ NOT SET - This will cause issues!');
console.log('  REACT_APP_SERVER_URL:', process.env.REACT_APP_SERVER_URL || 'not set');
console.log('  REACT_APP_WS_URL:', process.env.REACT_APP_WS_URL || 'not set');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');

// Warn if critical environment variables are missing
if (!process.env.REACT_APP_API_URL) {
  console.error('❌ WARNING: REACT_APP_API_URL is not set!');
  console.error('   The build will use fallback URLs which may not work in production.');
  console.error('   Please set REACT_APP_API_URL in Railway environment variables before building.');
}

try {
  // Clean previous build
  if (fs.existsSync('build')) {
    console.log('🧹 Cleaning previous build...');
    fs.rmSync('build', { recursive: true, force: true });
  }

  // Run the build command
  console.log('📦 Building React app...');
  console.log('   Environment variables will be embedded in the build at this step.');
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
