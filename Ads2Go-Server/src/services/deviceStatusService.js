const WebSocket = require('ws');
const ScreenTracking = require('../models/screenTracking');
const deviceStatusManager = require('./deviceStatusManager');

class DeviceStatusService {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map();
    this.pingInterval = null;
    this.adEndTimers = new Map(); // Track timers for clearing ended ads
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
          ws.connectionType = 'status'; // Mark as status connection
          
          // Set up ping-pong handler
          ws.on('pong', () => {
            ws.isAlive = true;
            ws.lastPong = Date.now();
          });
          
          this.handleConnection(ws, request);
        });
<<<<<<< HEAD
      } else if (pathname === '/ws/admin-dashboard') {
        // Admin dashboard WebSocket connection - no device ID required
        console.log('Admin dashboard WebSocket connection request');
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          ws.isAdmin = true;
          ws.isAlive = true;
          ws.lastPong = Date.now();
=======
      } else if (pathname === '/ws/playback') {
        // New endpoint for real-time ad playback updates
        const deviceId = url.searchParams.get('deviceId') || request.headers['device-id'];
        const materialId = url.searchParams.get('materialId') || request.headers['material-id'];
        const isAdmin = url.searchParams.get('admin') === 'true' || request.headers['admin'] === 'true';
        
        console.log('WebSocket Playback Upgrade Request Details:');
        console.log('- Pathname:', pathname);
        console.log('- Device ID from Query:', url.searchParams.get('deviceId'));
        console.log('- Material ID from Query:', url.searchParams.get('materialId'));
        console.log('- Is Admin:', isAdmin);
        console.log('- Final Device ID:', deviceId);
        console.log('- Final Material ID:', materialId);
        
        if (!deviceId && !isAdmin) {
          console.error('No device ID provided in WebSocket playback upgrade request');
          socket.destroy();
          return;
        }
        
        if (isAdmin) {
          console.log(`🔧 Admin WebSocket Connection for Real-Time Monitoring`);
        } else {
          console.log(`WebSocket Playback Upgrade Request for Device: ${deviceId}${materialId ? `, material: ${materialId}` : ''}`);
        }
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          // Store the device and material IDs with the connection
          ws.deviceId = deviceId || 'ADMIN';
          if (materialId) ws.materialId = materialId;
          ws.isAlive = true;
          ws.lastPong = Date.now();
          ws.connectionType = 'playback'; // Mark as playback connection
          ws.isAdmin = isAdmin; // Mark as admin connection
>>>>>>> jairhon_cleanup-directory
          
          // Set up ping-pong handler
          ws.on('pong', () => {
            ws.isAlive = true;
            ws.lastPong = Date.now();
          });
          
<<<<<<< HEAD
          this.handleAdminConnection(ws, request);
=======
          this.handlePlaybackConnection(ws, request);
>>>>>>> jairhon_cleanup-directory
        });
      } else {
        console.log(`Rejected WebSocket connection to unknown path: ${pathname}`);
        socket.destroy();
      }
    });
    
    this.startPingInterval();
    console.log('WebSocket server initialized');
  }

  async handleAdminConnection(ws, request) {
    console.log('🔌 New admin dashboard WebSocket connection');
    
    // Store admin connection
    this.activeConnections.set('admin-dashboard', ws);
    
    // Send initial device list to admin
    try {
      const allDevices = await this.getAllActiveDevices();
      ws.send(JSON.stringify({
        event: 'deviceList',
        data: { devices: allDevices }
      }));
      console.log(`📊 Sent initial device list to admin: ${allDevices.length} devices`);
    } catch (error) {
      console.error('Error sending initial device list to admin:', error);
    }
    
    // Handle messages from admin
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('Admin message received:', data);
        
        // Handle admin-specific messages if needed
        switch (data.event) {
          case 'ping':
            ws.send(JSON.stringify({ event: 'pong', data: { timestamp: Date.now() } }));
            break;
          default:
            console.log('Unknown admin message event:', data.event);
        }
      } catch (error) {
        console.error('Error parsing admin message:', error);
      }
    });
    
    // Handle admin disconnection
    ws.on('close', () => {
      console.log('Admin dashboard WebSocket disconnected');
      this.activeConnections.delete('admin-dashboard');
    });
    
    ws.on('error', (error) => {
      console.error('Admin WebSocket error:', error);
      this.activeConnections.delete('admin-dashboard');
    });
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
    console.log(`📱 Online Device: ${this.activeConnections.size}`);
    
    // Update device status in the database
    this.updateDeviceStatus(deviceId, true).catch(err => {
      console.error(`Failed to update status for device ${deviceId}:`, err);
    });

    // Update DeviceStatusManager with WebSocket connection
    deviceStatusManager.setWebSocketStatus(deviceId, true, new Date());
    
<<<<<<< HEAD
    // Update session tracking for time calculation
    this.updateSessionTracking(deviceId, true).catch(err => {
      console.error(`Failed to update session tracking for device ${deviceId}:`, err);
    });
    
    // Broadcast device update to admin dashboard
    this.broadcastToAdmin({
      event: 'deviceUpdate',
      data: {
        device: {
          deviceId,
          materialId,
          isOnline: true,
          lastSeen: new Date().toISOString()
        }
      }
    });
=======
    // Immediately broadcast status update for real-time response
    this.broadcastDeviceUpdate(deviceId, true);
>>>>>>> jairhon_cleanup-directory
    
    // Also update with the full device ID if they're different
    if (deviceId !== materialId) {
      // Try to find the full device ID from the database
      this.findFullDeviceId(deviceId, materialId).then(fullDeviceId => {
        if (fullDeviceId && fullDeviceId !== deviceId) {
          console.log(`🔄 [DeviceStatusManager] Also updating full device ID: ${fullDeviceId}`);
          deviceStatusManager.setWebSocketStatus(fullDeviceId, true, new Date());
        }
      }).catch(err => {
        console.error('Error finding full device ID:', err);
      });
    }

    ws.on('close', (code, reason) => {
      console.log(`🔌 [WebSocket] Device disconnected: ${deviceId} - Code: ${code}, Reason: ${reason}`);
      if (this.activeConnections.get(deviceId) === ws) {
        this.removeConnection(deviceId);
        this.handleDisconnect(deviceId).catch(err => {
          console.error(`Failed to update status for device ${deviceId}:`, err);
        });
        
        // Update DeviceStatusManager with WebSocket disconnection
        console.log(`🔄 [DeviceStatusManager] Updating WebSocket status for ${deviceId} as offline`);
        deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
        
<<<<<<< HEAD
        // Broadcast device disconnection to admin dashboard
        this.broadcastToAdmin({
          event: 'deviceUpdate',
          data: {
            device: {
              deviceId,
              materialId: ws.materialId,
              isOnline: false,
              lastSeen: new Date().toISOString()
            }
          }
        });
=======
        // Immediately broadcast status update for real-time response
        this.broadcastDeviceUpdate(deviceId, false);
>>>>>>> jairhon_cleanup-directory
        
        // Also update with the full device ID if they're different
        if (deviceId !== ws.materialId) {
          console.log(`🔍 [DeviceStatusManager] Looking for full device ID for short ID: ${deviceId}, material: ${ws.materialId}`);
          this.findFullDeviceId(deviceId, ws.materialId).then(fullDeviceId => {
            if (fullDeviceId && fullDeviceId !== deviceId) {
              console.log(`🔄 [DeviceStatusManager] Also updating full device ID: ${fullDeviceId} as offline`);
              deviceStatusManager.setWebSocketStatus(fullDeviceId, false, new Date());
            } else {
              console.log(`⚠️ [DeviceStatusManager] No full device ID found for ${deviceId}`);
            }
          }).catch(err => {
            console.error('Error finding full device ID on disconnect:', err);
          });
        }
      }
      console.log(`📱 Online Device: ${this.activeConnections.size}`);
    });
    
    // Handle ping/pong to detect dead connections
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle incoming messages (including ping and playback updates)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          ws.isAlive = true;
        } else if (message.type === 'adPlaybackUpdate') {
          // Handle real-time ad playback updates
          console.log(`🎬 [WebSocket] Received adPlaybackUpdate from ${deviceId}:`, {
            adId: message.adId,
            adTitle: message.adTitle,
            state: message.state,
            currentTime: message.currentTime,
            duration: message.duration,
            progress: message.progress
          });
          this.handlePlaybackUpdate(deviceId, message);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  }

  async handlePlaybackConnection(ws, request) {
    let deviceId, materialId;
    
    if (ws.isAdmin) {
      console.log(`🔧 Admin WebSocket Connection Established for Real-Time Monitoring`);
      // For admin connections, use 'ADMIN' as the key
      deviceId = 'ADMIN';
      materialId = null;
    } else {
      deviceId = ws.deviceId || request.headers['device-id'];
      materialId = ws.materialId || request.headers['material-id'];
      console.log(`🎬 New WebSocket Playback Connection from Device: ${deviceId}${materialId ? ` (material: ${materialId})` : ''}`);
    }

    // Store the connection with its device ID and material ID
    ws.deviceId = deviceId;
    ws.materialId = materialId;
    this.activeConnections.set(deviceId, ws);
    
    if (ws.isAdmin) {
      console.log(`🔧 Admin real-time monitoring connection established`);
    } else {
      console.log(`Playback connection established: ${deviceId}`);
    }
    
    // Handle incoming messages (including ping and playback updates)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          ws.isAlive = true;
        } else if (message.type === 'adPlaybackUpdate') {
          // Handle real-time ad playback updates
          console.log(`🎬 [WebSocket] Received adPlaybackUpdate from ${deviceId}:`, {
            adId: message.adId,
            adTitle: message.adTitle,
            state: message.state,
            currentTime: message.currentTime,
            duration: message.duration,
            progress: message.progress
          });
          this.handlePlaybackUpdate(deviceId, message);
        }
      } catch (error) {
        console.error('Error processing WebSocket Playback Message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🎬 [WebSocket] Playback Connection Closed: ${deviceId} - Code: ${code}, Reason: ${reason}`);
      if (this.activeConnections.get(deviceId) === ws) {
        this.removeConnection(deviceId);
      }
    });
  }

  async handlePlaybackUpdate(deviceId, message) {
    try {
      console.log(`🎬 [Playback Update] ${deviceId}:`, {
        adId: message.adId,
        adTitle: message.adTitle,
        state: message.state,
        currentTime: message.currentTime,
        duration: message.duration,
        progress: message.progress
      });

      // Update the database with current ad information
      await this.updateCurrentAd(deviceId, message);

      // Broadcast the playback update to all admin clients
      this.broadcastPlaybackUpdate(deviceId, message);

    } catch (error) {
      console.error(`Error handling playback update for device ${deviceId}:`, error);
    }
  }

  async updateCurrentAd(deviceId, playbackData) {
    try {
      const now = new Date();
      const connection = this.activeConnections.get(deviceId);
      const materialId = connection?.materialId || deviceId;

      console.log(`🔍 [updateCurrentAd] Looking for device ${deviceId} in ScreenTracking...`);

      // Handle different states appropriately
      let updateData = {};
      
      if (playbackData.state === 'ended') {
        // When ad ends, don't clear currentAd immediately - keep it for a few seconds
        // This prevents the "No ads playing" flash between ads
        console.log(`🏁 [updateCurrentAd] Ad ended for device ${deviceId}: ${playbackData.adTitle}`);
        updateData = {
          'screenMetrics.currentAd.state': 'ended',
          'screenMetrics.currentAd.endTime': now,
          'screenMetrics.currentAd.progress': 100,
          lastSeen: now
        };
        
        // Set a timer to clear the currentAd after 5 seconds if no new ad starts
        this.scheduleAdCleanup(deviceId, materialId);
      } else if (playbackData.state === 'loading' || playbackData.state === 'buffering') {
        // During loading/buffering, keep the current ad info but update state
        console.log(`⏳ [updateCurrentAd] Ad ${playbackData.state} for device ${deviceId}: ${playbackData.adTitle}`);
        updateData = {
          'screenMetrics.currentAd.state': playbackData.state,
          'screenMetrics.currentAd.currentTime': playbackData.currentTime || 0,
          'screenMetrics.currentAd.progress': playbackData.progress || 0,
          lastSeen: now
        };
      } else {
        // Normal playback state - update all fields
        // Cancel any pending cleanup timer since a new ad is starting
        this.cancelAdCleanup(deviceId);
        
        updateData = {
          'screenMetrics.currentAd': {
            adId: playbackData.adId,
            adTitle: playbackData.adTitle,
            adDuration: playbackData.duration,
            startTime: playbackData.startTime || now.toISOString(),
            currentTime: playbackData.currentTime,
            state: playbackData.state,
            progress: playbackData.progress
          },
          lastSeen: now
        };
      }

      // Update the current ad information in the database
      const result = await ScreenTracking.findOneAndUpdate(
        { 'devices.deviceId': deviceId },
        { $set: updateData },
        { new: true }
      );

      if (result) {
        console.log(`✅ Updated current ad for device ${deviceId}: ${playbackData.adTitle} (${playbackData.state})`);
        console.log(`📊 Current ad data:`, result.screenMetrics?.currentAd);
      } else {
        console.log(`❌ No ScreenTracking document found for device ${deviceId}`);
        
        // Try alternative query by materialId
        console.log(`🔍 Trying alternative query by materialId: ${materialId}`);
        const altResult = await ScreenTracking.findOneAndUpdate(
          { materialId },
          { $set: updateData },
          { new: true }
        );
        
        if (altResult) {
          console.log(`✅ Updated current ad via materialId ${materialId}: ${playbackData.adTitle}`);
        } else {
          console.log(`❌ No ScreenTracking document found for materialId ${materialId} either`);
        }
      }

    } catch (error) {
      console.error(`Error updating current ad for device ${deviceId}:`, error);
    }
  }

  broadcastPlaybackUpdate(deviceId, playbackData) {
    const updateMessage = {
      type: 'adPlaybackUpdate',
      deviceId: deviceId,
      adId: playbackData.adId,
      adTitle: playbackData.adTitle,
      state: playbackData.state,
      currentTime: playbackData.currentTime,
      duration: playbackData.duration,
      progress: playbackData.progress,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all connections (both status and playback connections)
    this.broadcast(updateMessage);
    
    console.log(`📡 [Broadcast] Playback update for ${deviceId}: ${playbackData.adTitle} - ${playbackData.state} (${playbackData.progress}%)`);
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
            // Get materialId from active connections or use deviceId as fallback
      const connection = this.activeConnections.get(deviceId);
      const materialId = connection?.materialId || deviceId;
      
      console.log(`🔄 Updating device status: ${deviceId} -> ${status ? 'online' : 'offline'} (materialId: ${materialId})`);
      
      // First, try to find and update existing record by deviceId in devices array
      let updatedDevice = await ScreenTracking.findOneAndUpdate(
        { 'devices.deviceId': deviceId },
        {
          $set: {
            'devices.$.isOnline': status,
            'devices.$.lastSeen': now,
            isOnline: status, // CRITICAL: Always update root level isOnline
            lastSeen: now
          },
          $push: {
            statusHistory: {
              status: status ? 'online' : 'offline',
              timestamp: now
            }
          }
        },
        { new: true }
      );

      // If not found by deviceId, try to find by materialId and update/add device
      if (!updatedDevice) {
        console.log(`🔍 Device ${deviceId} not found in devices array, searching by materialId: ${materialId}`);
        
        updatedDevice = await ScreenTracking.findOneAndUpdate(
          { materialId },
          {
            $set: {
              isOnline: status, // CRITICAL: Always update root level isOnline
              lastSeen: now
            },
            $push: {
              devices: {
                deviceId: deviceId,
                slotNumber: 1, // Default slot number
                isOnline: status,
                lastSeen: now
              },
              statusHistory: {
                status: status ? 'online' : 'offline',
                timestamp: now
              }
            }
          },
          { upsert: true, new: true }
        );
      }

      // CRITICAL: Ensure root level isOnline matches the device status
      if (updatedDevice) {
        // Check if any device in the array is online
        const hasOnlineDevice = updatedDevice.devices && updatedDevice.devices.some(device => device.isOnline);
        
        // Update root level isOnline to match the devices array
        if (updatedDevice.isOnline !== hasOnlineDevice) {
          console.log(`🔄 Syncing root isOnline: ${updatedDevice.isOnline} -> ${hasOnlineDevice}`);
          updatedDevice = await ScreenTracking.findByIdAndUpdate(
            updatedDevice._id,
            { 
              $set: { 
                isOnline: hasOnlineDevice,
                lastSeen: now
              }
            },
            { new: true }
          );
        }
      }

      console.log(`✅ Device ${deviceId} marked as ${status ? 'online' : 'offline'} (root isOnline: ${updatedDevice?.isOnline})`);
      
      // Update DeviceStatusManager with database status
      deviceStatusManager.setDatabaseStatus(deviceId, status, now);
      
      // Also update with the short device ID if they're different
      // This handles the case where the database has the full device ID but WebSocket uses short ID
      if (deviceId.includes('TABLET-') && deviceId.includes('-W09-')) {
        // Extract short device ID from full device ID
        const shortDeviceId = deviceId.split('-W09-')[0].replace('TABLET-', '') + '-W09';
        console.log(`🔄 [DeviceStatusManager] Also updating short device ID: ${shortDeviceId}`);
        deviceStatusManager.setDatabaseStatus(shortDeviceId, status, now);
      }
      
      // Broadcast the status update to all connected clients
      this.broadcastDeviceUpdate(updatedDevice);
      
      // Also update the device list
      this.broadcastDeviceList();
    } catch (error) {
      console.error(`❌ Error updating status for device ${deviceId}:`, error);
    }
  }

  async updateSessionTracking(deviceId, isConnected) {
    try {
      const screenTracking = await ScreenTracking.findByDeviceId(deviceId);
      
      if (!screenTracking) {
        console.warn(`No screen tracking record found for device: ${deviceId}`);
        return;
      }

      if (isConnected) {
        await screenTracking.handleWebSocketConnection();
        console.log(`🔌 [SESSION] Started session tracking for ${deviceId}`);
      } else {
        await screenTracking.handleWebSocketDisconnection();
        console.log(`🔌 [SESSION] Ended session tracking for ${deviceId}`);
      }
    } catch (error) {
      console.error(`Error updating session tracking for ${deviceId}:`, error);
    }
  }

  async handleDisconnect(deviceId) {
    this.removeConnection(deviceId);
    try {
      await this.updateDeviceStatus(deviceId, false);
      
      // Update session tracking for disconnection
      await this.updateSessionTracking(deviceId, false);
      
      console.log(`Successfully handled disconnect for device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`Error handling disconnect for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get device status using DeviceStatusManager (new source of truth)
   * @param {string} deviceId - Device identifier
   * @returns {Object} Device status with source and confidence
   */
  getDeviceStatus(deviceId) {
    return deviceStatusManager.getDeviceStatus(deviceId);
  }

  /**
   * Get all device statuses using DeviceStatusManager
   * @returns {Array} Array of all device statuses
   */
  getAllDeviceStatuses() {
    return deviceStatusManager.getAllDeviceStatuses();
  }

  /**
   * Check if device has active WebSocket connection
   * @param {string} deviceId - Device identifier
   * @returns {boolean} Whether device has active WebSocket
   */
  hasActiveWebSocket(deviceId) {
    return deviceStatusManager.hasActiveWebSocket(deviceId);
  }

  /**
   * Get status summary for debugging
   * @returns {Object} Status summary
   */
  getStatusSummary() {
    return deviceStatusManager.getStatusSummary();
  }

  /**
   * Find the full device ID from the database based on material ID
   * @param {string} shortDeviceId - Short device ID from WebSocket
   * @param {string} materialId - Material ID
   * @returns {Promise<string|null>} Full device ID or null if not found
   */
  async findFullDeviceId(shortDeviceId, materialId) {
    try {
      // First try to find by materialId
      const screen = await ScreenTracking.findOne({ materialId });
      if (screen && screen.deviceId) {
        console.log(`🔍 [DeviceStatusManager] Found full device ID: ${screen.deviceId} for material: ${materialId}`);
        return screen.deviceId;
      }

      // If not found by materialId, try to find by partial deviceId match
      const screens = await ScreenTracking.find({ 
        deviceId: { $regex: shortDeviceId, $options: 'i' } 
      });
      
      if (screens.length > 0) {
        console.log(`🔍 [DeviceStatusManager] Found full device ID: ${screens[0].deviceId} for short ID: ${shortDeviceId}`);
        return screens[0].deviceId;
      }

      console.log(`⚠️ [DeviceStatusManager] No full device ID found for short ID: ${shortDeviceId}, material: ${materialId}`);
      return null;
    } catch (error) {
      console.error('Error finding full device ID:', error);
      return null;
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

  async getAllActiveDevices() {
    try {
      // Get all screens from database with their current status
      const screens = await ScreenTracking.find({}).lean();
      
      const activeDevices = screens.map(screen => ({
        deviceId: screen.deviceId,
        materialId: screen.materialId,
        isOnline: this.activeConnections.has(screen.deviceId) || this.activeConnections.has(screen.materialId),
        lastSeen: screen.lastSeen,
        currentLocation: screen.currentLocation,
        lastSeenLocation: screen.lastSeenLocation,
        currentHours: screen.currentHoursToday || 0,
        hoursRemaining: screen.hoursRemaining || 0,
        isCompliant: screen.isCompliantToday || false,
        totalDistanceToday: screen.currentSession?.totalDistanceTraveled || 0,
        displayStatus: screen.screenMetrics?.isDisplaying ? 'ACTIVE' : 'DISPLAY_OFF',
        screenMetrics: screen.screenMetrics,
        alerts: screen.alerts || []
      }));
      
      return activeDevices;
    } catch (error) {
      console.error('Error getting all active devices:', error);
      return [];
    }
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

  broadcastDeviceUpdate(deviceId, isOnline) {
    const device = {
      deviceId,
      isOnline,
      lastSeen: new Date(),
      source: 'websocket'
    };
    
    this.broadcast({
      type: 'deviceUpdate',
      device: device
    });
    
    console.log(`📡 [Broadcast] Device ${deviceId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  }

  broadcastToAdmin(message) {
    const adminWs = this.activeConnections.get('admin-dashboard');
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
      adminWs.send(JSON.stringify(message));
    }
  }

  startPingInterval() {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Set up a new ping interval (every 10 seconds for faster detection)
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const deadConnections = [];

      // Check all active connections
      this.activeConnections.forEach((ws, deviceId) => {
        // If we haven't received a pong in the last 30 seconds, mark as dead (faster detection)
        if (ws.lastPong && (now - ws.lastPong) > 30000) {
          console.log(`Device ${deviceId} connection timed out (no pong for 30s)`);
          deadConnections.push(deviceId);
          ws.close(1000, 'Connection timeout - no pong received');
          return;
        }

        // Mark as waiting for pong
        if (ws.isAlive === false) {
          console.log(`Device ${deviceId} did not respond to last ping, terminating connection`);
          deadConnections.push(deviceId);
          ws.close(1000, 'Connection timeout - no ping response');
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
        
        // Immediately broadcast status update for real-time response
        this.broadcastDeviceUpdate(deviceId, false);
        
        // Update DeviceStatusManager
        deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
      });

      console.log(`🔄 Real-Time Connection Check: ${this.activeConnections.size}`);
    }, 10000); // 10 seconds for faster real-time checking
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

  // Schedule cleanup of ended ad after delay
  scheduleAdCleanup(deviceId, materialId) {
    // Clear any existing timer
    this.cancelAdCleanup(deviceId);
    
    // Set new timer to clear currentAd after 5 seconds
    const timer = setTimeout(async () => {
      try {
        console.log(`🧹 [AdCleanup] Clearing currentAd for device ${deviceId} after 5 seconds`);
        
        // Try to clear currentAd by deviceId first
        let result = await ScreenTracking.findOneAndUpdate(
          { 'devices.deviceId': deviceId },
          { 
            $unset: { 'screenMetrics.currentAd': 1 },
            $set: { lastSeen: new Date() }
          },
          { new: true }
        );
        
        // If not found, try by materialId
        if (!result) {
          result = await ScreenTracking.findOneAndUpdate(
            { materialId },
            { 
              $unset: { 'screenMetrics.currentAd': 1 },
              $set: { lastSeen: new Date() }
            },
            { new: true }
          );
        }
        
        if (result) {
          console.log(`✅ [AdCleanup] Cleared currentAd for device ${deviceId}`);
        } else {
          console.log(`❌ [AdCleanup] Could not find device ${deviceId} to clear currentAd`);
        }
        
        // Remove timer from map
        this.adEndTimers.delete(deviceId);
      } catch (error) {
        console.error(`Error clearing currentAd for device ${deviceId}:`, error);
        this.adEndTimers.delete(deviceId);
      }
    }, 5000); // 5 seconds delay
    
    // Store timer in map
    this.adEndTimers.set(deviceId, timer);
  }

  // Cancel scheduled ad cleanup
  cancelAdCleanup(deviceId) {
    const timer = this.adEndTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.adEndTimers.delete(deviceId);
      console.log(`🚫 [AdCleanup] Cancelled cleanup timer for device ${deviceId}`);
    }
  }
}

module.exports = new DeviceStatusService();
