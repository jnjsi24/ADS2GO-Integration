#!/usr/bin/env node

// Alternative Express-based server for Railway
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;
const buildPath = path.join(__dirname, 'build');

console.log(`🚀 Starting Express server on port ${port}`);
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

// Serve static files from the build directory
app.use(express.static(buildPath));

// Health check endpoint (must be before the catch-all route)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: port 
  });
});

// Handle React routing - return index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🌐 Access your app at: http://localhost:${port}`);
  console.log(`🔍 Environment PORT: ${process.env.PORT}`);
  console.log(`🔍 Process PID: ${process.pid}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
