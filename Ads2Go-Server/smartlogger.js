#!/usr/bin/env node

// Start the server with verbose logging enabled
process.env.VERBOSE_LOGS = 'true';
process.env.NODE_ENV = 'development';

// Start the server
require('./src/index.js');
