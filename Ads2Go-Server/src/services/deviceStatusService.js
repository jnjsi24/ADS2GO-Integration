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
        
        console.log('WebSocket upgrade request details:');
        console.log('- Pathname:', pathname);
        console.log('- Device ID from query:', url.searchParams.get('deviceId'));
        console.log('- Material ID from query:', url.searchParams.get('materialId'));
        console.log('- Device ID from headers:', request.headers['device-id']);
        console.log('- Material ID from headers:', request.headers['material-id']);
        console.log('- Final device ID:', deviceId);
        console.log('- Final material ID:', materialId);
        
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
          ws.isAlive = true;
          ws.lastPong = Date.now();
          
          // Set up ping-pong handler
          ws.on('pong', () => {
            ws.isAlive = true;
            ws.lastPong = Date.now();
          });
          
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
    
    console.log('handleConnection called with:');
    console.log('- ws.deviceId:', ws.deviceId);
    console.log('- ws.materialId:', ws.materialId);
    console.log('- request.headers[device-id]:', request.headers['device-id']);
    console.log('- request.headers[material-id]:', request.headers['material-id']);
    console.log('- Final deviceId:', deviceId);
    console.log('- Final materialId:', materialId);
    
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

    // Store the connection with its device ID and material ID
    ws.deviceId = deviceId;
    ws.materialId = materialId;
    this.activeConnections.set(deviceId, ws);
    
    // Broadcast updated device list to all clients
    this.broadcastDeviceList();
    console.log(`Device connected: ${deviceId}`);
    console.log(`Active connections: ${this.activeConnections.size}`);
    
    // Update device status in the database
    this.updateDeviceStatus(deviceId, true).catch(err => {
      console.error(`Failed to update status for device ${deviceId}:`, err);
    });

    ws.on('close', (code, reason) => {
      console.log(`Device disconnected: ${deviceId} - Code: ${code}, Reason: ${reason}`);
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
    
    // Handle incoming messages (including ping)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          ws.isAlive = true;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
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

  async updateDeviceStatus(deviceId, status) {
    try {
      const now = new Date();
      const updateData = {
        isOnline: status,
        lastSeen: now,
        $push: {
          statusHistory: {
            status: status ? 'online' : 'offline',
            timestamp: now
          }
        }
      };

      // Update the device status in the database
      const updatedDevice = await ScreenTracking.findOneAndUpdate(
        { deviceId },
        updateData,
        { upsert: true, new: true }
      );

      console.log(`Device ${deviceId} marked as ${status ? 'online' : 'offline'}`);
      
      // Broadcast the status update to all connected clients
      this.broadcastDeviceUpdate(updatedDevice);
      
      // Also update the device list
      this.broadcastDeviceList();
    } catch (error) {
      console.error(`❌ Error updating status for device ${deviceId}:`, error);
    }
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
    const jsonMessage = typeof message === 'string' ? message : JSON.stringify(message);
    this.activeConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(jsonMessage);
      }
    });
  }

  broadcastDeviceList() {
    const deviceList = Array.from(this.activeConnections.entries()).map(([deviceId, ws]) => ({
      deviceId,
      materialId: ws.materialId,
      isConnected: ws.readyState === WebSocket.OPEN
    }));
    
    this.broadcast({
      type: 'deviceList',
      devices: deviceList
    });
  }

  broadcastDeviceUpdate(device) {
    this.broadcast({
      type: 'deviceUpdate',
      device: device
    });
  }

  startPingInterval() {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Set up a new ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const deadConnections = [];

      // Check all active connections
      this.activeConnections.forEach((ws, deviceId) => {
        // If we haven't received a pong in the last 60 seconds, mark as dead
        if (ws.lastPong && (now - ws.lastPong) > 60000) {
          console.log(`Device ${deviceId} connection timed out`);
          deadConnections.push(deviceId);
          ws.terminate();
          return;
        }

        // Mark as waiting for pong
        if (ws.isAlive === false) {
          console.log(`Device ${deviceId} did not respond to last ping, terminating connection`);
          deadConnections.push(deviceId);
          ws.terminate();
          return;
        }

        // Send ping
        try {
          ws.isAlive = false;
          ws.ping(() => {});
        } catch (error) {
          console.error(`Error sending ping to device ${deviceId}:`, error);
          deadConnections.push(deviceId);
        }
      });

      // Clean up dead connections
      deadConnections.forEach(deviceId => {
        this.activeConnections.delete(deviceId);
        this.updateDeviceStatus(deviceId, false);
      });

      console.log(`Active WebSocket connections: ${this.activeConnections.size}`);
    }, 30000); // 30 seconds
  }

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
