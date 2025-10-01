const express = require('express');
const router = express.Router();

// Store SSE connections
const sseConnections = new Set();

// SSE endpoint for real-time updates
router.get('/sse/playback', (req, res) => {
  console.log('🔌 SSE connection request received');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Create SSE connection object
  const sseConnection = {
    res,
    id: Date.now(),
    isAdmin: req.query.admin === 'true'
  };

  // Add to connections set
  sseConnections.add(sseConnection);

  console.log(`✅ SSE connection established (ID: ${sseConnection.id}, Admin: ${sseConnection.isAdmin})`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'SSE connection established',
    id: sseConnection.id
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`🔌 SSE connection closed (ID: ${sseConnection.id})`);
    sseConnections.delete(sseConnection);
  });

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    if (sseConnections.has(sseConnection)) {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      })}\n\n`);
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // Send heartbeat every 30 seconds
});

// Function to broadcast to all SSE connections
function broadcastToSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  sseConnections.forEach(connection => {
    try {
      connection.res.write(message);
    } catch (error) {
      console.error('Error sending SSE message:', error);
      sseConnections.delete(connection);
    }
  });
}

// Function to broadcast to admin connections only
function broadcastToAdminSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  sseConnections.forEach(connection => {
    if (connection.isAdmin) {
      try {
        connection.res.write(message);
      } catch (error) {
        console.error('Error sending admin SSE message:', error);
        sseConnections.delete(connection);
      }
    }
  });
}

// Export the router and broadcast functions
module.exports = {
  router,
  broadcastToSSE,
  broadcastToAdminSSE,
  getConnectionCount: () => sseConnections.size
};
