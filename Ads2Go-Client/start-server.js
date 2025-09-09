#!/usr/bin/env node

// Railway-compatible start script
const { execSync } = require('child_process');
const path = require('path');

const port = process.env.PORT || 3000;
const buildPath = path.join(__dirname, 'build');

console.log(`🚀 Starting server on port ${port}`);
console.log(`📁 Serving from: ${buildPath}`);

try {
  // Use serve with proper port handling
  execSync(`npx serve -s build -l ${port}`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port
    }
  });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
