const WebSocket = require('ws');
const ScreenTracking = require('../models/screenTracking');

class DeviceStatusService {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map();
    this.pingInterval = null;
  }

  initializeWebSocketServer(server) {
    if (this.wss) {
      console.log('WebSocket server already initialized');
      return;
    }
    
    this.wss = new WebSocket.Server({ 
      noServer: true,
      clientTracking: true,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    // Log when the WebSocket server is ready
    console.log('WebSocket server created, waiting for upgrade requests');
    
    // Handle WebSocket upgrade
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const pathname = url.pathname;
      
      if (pathname === '/ws/status') {
        // Get device ID from query params or headers
        const deviceId = url.searchParams.get('deviceId') || request.headers['device-id'];
        const materialId = url.searchParams.get('materialId') || request.headers['material-id'];
        
        if (!deviceId) {
          console.error('No device ID provided in WebSocket upgrade request');
          console.log('Available headers:', request.headers);
          console.log('Query params:', Object.fromEntries(url.searchParams));
          socket.destroy();
          return;
        }
        
        console.log(`WebSocket upgrade request for device: ${deviceId}${materialId ? `, material: ${materialId}` : ''}`);
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          // Store the device and material IDs with the connection
          ws.deviceId = deviceId;
          if (materialId) ws.materialId = materialId;
          this.handleConnection(ws, request);
        });
      } else {
        console.log(`Rejected WebSocket connection to unknown path: ${pathname}`);
        socket.destroy();
      }
    });
    
    this.startPingInterval();
    console.log('WebSocket server initialized');
  }

  async handleConnection(ws, request) {
    const deviceId = ws.deviceId || request.headers['device-id'];
    const materialId = ws.materialId || request.headers['material-id'];
    
    if (!deviceId) {
      console.error('No device ID provided in WebSocket connection');
      ws.close(4001, 'Device ID is required');
      return;
    }
    
    console.log(`🔌 New WebSocket connection from device: ${deviceId}${materialId ? ` (material: ${materialId})` : ''}`);

    // Clean up any existing connection for this device
    const existingConnection = this.activeConnections.get(deviceId);
    if (existingConnection && existingConnection !== ws) {
      console.log(`Replacing existing connection for device: ${deviceId}`);
      existingConnection.terminate();
    }

    // Store the connection with its device ID
    this.activeConnections.set(deviceId, ws);
    console.log(`Device connected: ${deviceId}`);
    console.log(`Active connections: ${this.activeConnections.size}`);
    
    // Update device status in the database
    this.updateDeviceStatus(deviceId, true).catch(err => {
      console.error(`Failed to update status for device ${deviceId}:`, err);
    });

    ws.on('close', () => {
      console.log(`Device disconnected: ${deviceId}`);
      if (this.activeConnections.get(deviceId) === ws) {
        this.removeConnection(deviceId);
        this.handleDisconnect(deviceId).catch(err => {
          console.error(`Failed to update status for device ${deviceId}:`, err);
        });
      }
      console.log(`Active connections: ${this.activeConnections.size}`);
    });
    
    // Handle ping/pong to detect dead connections
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  removeConnection(deviceId) {
    const existing = this.activeConnections.get(deviceId);
    if (existing) {
      try {
        if (existing.terminate) {
          existing.terminate();
        } else if (existing.close) {
          existing.close();
        }
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.activeConnections.delete(deviceId);
    }
  }

  async updateDeviceStatus(deviceId, isOnline) {
    try {
      const now = new Date();
      const update = {
        isOnline,
        lastSeen: now,
        ...(isOnline ? { lastOnline: now } : {})
      };
      
      // Update the screen tracking document
      await ScreenTracking.findOneAndUpdate(
        { deviceId },
        { 
          $set: update,
          $push: { 
            statusHistory: {
              status: isOnline ? 'online' : 'offline',
              timestamp: now
            }
          }
        },
        { upsert: true, new: true }
      );
      
      console.log(`✅ Updated status for device ${deviceId}: ${isOnline ? 'online' : 'offline'}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating status for device ${deviceId}:`, error);
      throw error;
    }
  }

  startPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      const now = new Date();
      console.log(`[${now.toISOString()}] Pinging ${this.activeConnections.size} active connections...`);
      
      // Check for and clean up dead connections
      this.activeConnections.forEach((ws, deviceId) => {
        if (ws.isAlive === false) {
          console.log(`Terminating dead connection for device: ${deviceId}`);
          ws.terminate();
          this.activeConnections.delete(deviceId);
          // Update status in database
          this.updateDeviceStatus(deviceId, false).catch(console.error);
          return;
        }

        ws.isAlive = false;
        ws.ping(() => {});
      });
      
      // Log connection status
      console.log(`Active WebSocket connections: ${this.activeConnections.size}`);
      if (this.activeConnections.size > 0) {
        console.log('Connected devices:', Array.from(this.activeConnections.keys()));
      }
    }, 10000); // Ping every 10 seconds
  }

  async handleDisconnect(deviceId) {
    this.removeConnection(deviceId);
    try {
      await this.updateDeviceStatus(deviceId, false);
      console.log(`Successfully handled disconnect for device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`Error handling disconnect for device ${deviceId}:`, error);
      throw error;
    }
  }

  async broadcast(message) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }

    this.activeConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Clean up resources when the server is shutting down
  async cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Close all active connections
    this.activeConnections.forEach((ws, deviceId) => {
      try {
        ws.terminate();
        this.updateDeviceStatus(deviceId, false).catch(console.error);
      } catch (error) {
        console.error(`Error closing connection for device ${deviceId}:`, error);
      }
    });
    
    this.activeConnections.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    console.log('Device status service cleaned up');
  }
}

module.exports = new DeviceStatusService();
