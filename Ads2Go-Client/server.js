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

// Serve static files from the build directory with proper caching headers
app.use(express.static(buildPath, {
  // Cache static assets (JS, CSS, images) for 1 year
  maxAge: '1y',
  // Enable ETag for better caching
  etag: true,
  // Don't cache index.html (always serve fresh version for code splitting)
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Handle React routing - return index.html for all non-API routes
// This is critical for code splitting - all routes must serve index.html
app.get('*', (req, res) => {
  // Skip API routes and static file requests
  if (req.path.startsWith('/api/') || req.path.startsWith('/static/')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: port 
  });
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
