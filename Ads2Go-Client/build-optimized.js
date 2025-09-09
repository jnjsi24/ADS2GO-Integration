#!/usr/bin/env node

// Build optimization script for Railway deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting optimized build for Railway...');

// Set memory limit
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Set production environment
process.env.NODE_ENV = 'production';
process.env.CI = 'false';

try {
  // Clean previous build
  if (fs.existsSync('build')) {
    console.log('🧹 Cleaning previous build...');
    fs.rmSync('build', { recursive: true, force: true });
  }

  // Run build with memory optimization
  console.log('🔨 Building with memory optimization...');
  execSync('npx react-scripts build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096',
      GENERATE_SOURCEMAP: 'false', // Disable source maps to save memory
      INLINE_RUNTIME_CHUNK: 'false' // Disable inline runtime chunk
    }
  });

  console.log('✅ Build completed successfully!');
  
  // Check build size
  const buildPath = path.join(__dirname, 'build');
  if (fs.existsSync(buildPath)) {
    const stats = fs.statSync(buildPath);
    console.log(`📦 Build size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
