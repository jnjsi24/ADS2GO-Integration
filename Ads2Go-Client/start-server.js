#!/usr/bin/env node

// Railway-compatible start script
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3000;
const buildPath = path.join(__dirname, 'build');

console.log(`🚀 Starting server on port ${port}`);
console.log(`📁 Serving from: ${buildPath}`);

// Check if build directory exists
if (!fs.existsSync(buildPath)) {
  console.error('❌ Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Check if index.html exists in build directory
const indexPath = path.join(buildPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found in build directory. Build may be incomplete.');
  process.exit(1);
}

console.log('✅ Build directory and files found');

try {
  // Use serve with proper port handling and keep the process alive
  const serveProcess = spawn('npx', ['serve', '-s', 'build', '-l', port.toString()], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port
    }
  });

  serveProcess.on('error', (error) => {
    console.error('❌ Failed to start serve process:', error.message);
    process.exit(1);
  });

  serveProcess.on('exit', (code) => {
    console.log(`Serve process exited with code ${code}`);
    process.exit(code);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    serveProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    serveProcess.kill('SIGINT');
  });

} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
