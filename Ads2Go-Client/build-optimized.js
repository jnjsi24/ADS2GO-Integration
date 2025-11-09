#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ✅ Load environment variables from .env files BEFORE checking them
// React Scripts loads these automatically, but we need them here for the check
// Load in priority order: .env.local overrides .env, .env.production overrides both in production
try {
  // Load .env first (lowest priority)
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
  }
  // Load .env.local (higher priority, overrides .env)
  if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env.local') });
  }
  // In production build, .env.production takes highest precedence
  // React Scripts sets NODE_ENV=production during build
  if (fs.existsSync(path.join(__dirname, '.env.production'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env.production') });
  }
} catch (error) {
  // dotenv might not be installed, but React Scripts will load .env files anyway
  console.log('⚠️  Note: Could not load .env files in build script (React Scripts will load them)');
}

console.log('🚀 Starting optimized build process...');

// Set memory limit for build process
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Log environment variables for debugging (important for Railway builds)
// Use process.stderr.write to ensure output is visible in Railway logs
process.stderr.write('\n');
process.stderr.write('═══════════════════════════════════════════════════════════════\n');
process.stderr.write('🔍 ENVIRONMENT VARIABLES CHECK (Build Time)\n');
process.stderr.write('═══════════════════════════════════════════════════════════════\n');
process.stderr.write(`  REACT_APP_API_URL: ${process.env.REACT_APP_API_URL || '❌ NOT SET - This will cause issues!'}\n`);
process.stderr.write(`  REACT_APP_SERVER_URL: ${process.env.REACT_APP_SERVER_URL || 'not set'}\n`);
process.stderr.write(`  REACT_APP_WS_URL: ${process.env.REACT_APP_WS_URL || 'not set'}\n`);
process.stderr.write(`  REACT_APP_CLIENT_URL: ${process.env.REACT_APP_CLIENT_URL || 'not set'}\n`);
process.stderr.write(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}\n`);
process.stderr.write('═══════════════════════════════════════════════════════════════\n');
process.stderr.write('\n');

// Also log to console for local development
console.log('🔍 Environment Variables Check:');
console.log('  REACT_APP_API_URL:', process.env.REACT_APP_API_URL || '❌ NOT SET - This will cause issues!');
console.log('  REACT_APP_SERVER_URL:', process.env.REACT_APP_SERVER_URL || 'not set');
console.log('  REACT_APP_WS_URL:', process.env.REACT_APP_WS_URL || 'not set');
console.log('  REACT_APP_CLIENT_URL:', process.env.REACT_APP_CLIENT_URL || 'not set');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');

// Warn if critical environment variables are missing
if (!process.env.REACT_APP_API_URL) {
  process.stderr.write('❌ WARNING: REACT_APP_API_URL is not set!\n');
  process.stderr.write('   The build will use fallback URLs which may not work in production.\n');
  process.stderr.write('   Please set REACT_APP_API_URL in Railway environment variables before building.\n');
  console.error('❌ WARNING: REACT_APP_API_URL is not set!');
  console.error('   The build will use fallback URLs which may not work in production.');
  console.error('   Please set REACT_APP_API_URL in Railway environment variables before building.');
} else {
  process.stderr.write('✅ REACT_APP_API_URL is set correctly!\n');
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
  // ✅ Pass environment variables to react-scripts build
  // React Scripts will also load .env files, but we've already loaded them above
  execSync('npx react-scripts build', { 
    stdio: 'inherit',
    env: { 
      ...process.env, 
      CI: 'false',
      NODE_ENV: 'production' // React Scripts sets this, but ensure it's set
    }
  });

  // Verify build was successful
  const buildPath = path.join(__dirname, 'build');
  const indexPath = path.join(buildPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('Build failed - index.html not found');
  }

  // Create a verification file with environment variable info (for debugging)
  const envInfoPath = path.join(buildPath, 'env-info.json');
  const envInfo = {
    buildTime: new Date().toISOString(),
    environment: {
      REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'NOT SET',
      REACT_APP_SERVER_URL: process.env.REACT_APP_SERVER_URL || 'NOT SET',
      REACT_APP_WS_URL: process.env.REACT_APP_WS_URL || 'NOT SET',
      REACT_APP_CLIENT_URL: process.env.REACT_APP_CLIENT_URL || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET'
    },
    note: 'This file shows what environment variables were available at build time. These values are embedded in the JavaScript bundle.'
  };
  fs.writeFileSync(envInfoPath, JSON.stringify(envInfo, null, 2));
  process.stderr.write(`📝 Environment info written to: ${envInfoPath}\n`);

  console.log('✅ Build completed successfully!');
  console.log(`📁 Build output: ${buildPath}`);
  process.stderr.write('✅ Build completed successfully!\n');
  process.stderr.write(`📁 Build output: ${buildPath}\n`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
