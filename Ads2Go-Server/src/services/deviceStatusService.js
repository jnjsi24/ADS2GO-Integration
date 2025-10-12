const WebSocket = require('ws');
const DeviceTracking = require('../models/deviceTracking');
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
      console.log(`🔌 WebSocket upgrade request received: ${request.url}`);
      console.log(`🔌 Headers:`, request.headers);
      
      const url = new URL(request.url, `http://${request.headers.host}`);
      const pathname = url.pathname;
      
      console.log(`🔌 Parsed URL - Pathname: ${pathname}, Search: ${url.search}`);
      
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
          console.log(`✅ WebSocket upgrade successful for device: ${deviceId}`);
          
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
          
          // Add error handling
          ws.on('error', (error) => {
            console.error(`❌ WebSocket error for device ${deviceId}:`, error);
          });
          
          this.handleConnection(ws, request);
        });
      } else if (pathname === '/ws/playback') {
        // New endpoint for real-time ad playback updates
        const deviceId = url.searchParams.get('deviceId') || request.headers['device-id'];
        const materialId = url.searchParams.get('materialId') || request.headers['material-id'];
        const slotNumber = url.searchParams.get('slotNumber') || request.headers['slot-number'];
        const isAdmin = url.searchParams.get('admin') === 'true' || request.headers['admin'] === 'true';
        
        
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
          console.log(`✅ WebSocket playback upgrade successful for device: ${deviceId || 'ADMIN'}`);
          
          // Store the device and material IDs with the connection
          ws.deviceId = deviceId || 'ADMIN';
          if (materialId) ws.materialId = materialId;
          if (slotNumber) ws.slotNumber = parseInt(slotNumber);
          ws.isAlive = true;
          ws.lastPong = Date.now();
          ws.connectionType = 'playback'; // Mark as playback connection
          ws.isAdmin = isAdmin; // Mark as admin connection
          
          // Add error handling
          ws.on('error', (error) => {
            console.error(`❌ WebSocket playback error for device ${ws.deviceId}:`, error);
          });
          
          // Set up ping-pong handler
          ws.on('pong', () => {
            ws.isAlive = true;
            ws.lastPong = Date.now();
          });
          
          this.handlePlaybackConnection(ws, request);
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
    console.log(`📱 Online Device: ${this.activeConnections.size}`);
    
    // Update device status in the database
    this.updateDeviceStatus(deviceId, true).catch(err => {
      console.error(`Failed to update status for device ${deviceId}:`, err);
    });

    // Update DeviceStatusManager with WebSocket connection
    deviceStatusManager.setWebSocketStatus(deviceId, true, new Date());
    
    // Also update tablet registration status to ONLINE
    this.updateTabletStatus(deviceId, true).catch(err => {
      console.error('Error updating tablet status on connect:', err);
    });
    
    // Immediately broadcast status update for real-time response
    this.broadcastDeviceUpdate(deviceId, true);
    
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
      
      // Always handle disconnect regardless of activeConnections check
      // The activeConnections check was preventing database updates
      console.log(`🔄 [WebSocket] Processing disconnect for device: ${deviceId}`);
      
      this.removeConnection(deviceId);
      this.handleDisconnect(deviceId).catch(err => {
        console.error(`Failed to update status for device ${deviceId}:`, err);
      });
      
      // Update DeviceStatusManager with WebSocket disconnection
      console.log(`🔄 [DeviceStatusManager] Updating WebSocket status for ${deviceId} as offline`);
      deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
      
      // Immediately broadcast status update for real-time response
      this.broadcastDeviceUpdate(deviceId, false);
      
      // Also update with the full device ID if they're different
      if (deviceId !== ws.materialId) {
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
          ws.lastPong = Date.now();
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
    let deviceId, materialId, slotNumber;
    
    if (ws.isAdmin) {
      console.log(`🔧 Admin WebSocket Connection Established for Real-Time Monitoring`);
      // For admin connections, use 'ADMIN' as the key
      deviceId = 'ADMIN';
      materialId = null;
      slotNumber = null;
    } else {
      deviceId = ws.deviceId || request.headers['device-id'];
      materialId = ws.materialId || request.headers['material-id'];
      slotNumber = ws.slotNumber || request.headers['slot-number'];
      console.log(`🎬 New WebSocket Playback Connection from Device: ${deviceId}${materialId ? ` (material: ${materialId}, slot: ${slotNumber})` : ''}`);
    }

    // Store the connection with its device ID, material ID, and slot number
    ws.deviceId = deviceId;
    ws.materialId = materialId;
    ws.slotNumber = slotNumber;
    this.activeConnections.set(deviceId, ws);
    
    // Store slot-specific connections for synchronization
    if (materialId && slotNumber) {
      const slotKey = `${materialId}-${slotNumber}`;
      if (!this.slotConnections) {
        this.slotConnections = new Map();
      }
      if (!this.slotConnections.has(slotKey)) {
        this.slotConnections.set(slotKey, new Set());
      }
      this.slotConnections.get(slotKey).add(ws);
      
      // Also store by material for cross-slot synchronization
      const materialKey = `${materialId}`;
      if (!this.materialConnections) {
        this.materialConnections = new Map();
      }
      if (!this.materialConnections.has(materialKey)) {
        this.materialConnections.set(materialKey, new Set());
      }
      this.materialConnections.get(materialKey).add(ws);
    }
    
    if (ws.isAdmin) {
      console.log(`🔧 Admin real-time monitoring connection established`);
    } else {
      console.log(`Playback connection established: ${deviceId} (slot ${slotNumber})`);
    }
    
    // Handle incoming messages (including ping and playback updates)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          ws.isAlive = true;
          ws.lastPong = Date.now();
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
          
          // Broadcast synchronization signals to other slots of the same material
          if (materialId && slotNumber) {
            this.broadcastSlotSynchronization(materialId, slotNumber, message);
          }
        } else if (message.type === 'syncRequest') {
          // Handle synchronization requests
          this.handleSyncRequest(deviceId, materialId, slotNumber, message);
        }
      } catch (error) {
        console.error('Error processing WebSocket Playback Message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🎬 [WebSocket] Playback Connection Closed: ${deviceId} - Code: ${code}, Reason: ${reason}`);
      if (this.activeConnections.get(deviceId) === ws) {
        // Clean up slot connections before removing the main connection
        this.cleanupSlotConnections(deviceId, materialId, slotNumber);
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

      // Store current playback state for synchronization
      const connection = this.activeConnections.get(deviceId);
      if (connection) {
        connection.currentPlaybackState = {
          adId: message.adId,
          adTitle: message.adTitle,
          state: message.state,
          currentTime: message.currentTime,
          duration: message.duration,
          progress: message.progress,
          timestamp: new Date().toISOString()
        };
      }

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
      const materialId = connection?.materialId;

      if (!materialId) {
        console.log(`⚠️ [updateCurrentAd] No materialId found for device ${deviceId}. Skipping update.`);
        return;
      }


      // Handle different states appropriately
      let updateData = {};
      
      if (playbackData.state === 'ended') {
        // When ad ends, don't clear currentAd immediately - keep it for a few seconds
        // This prevents the "No ads playing" flash between ads
        console.log(`🏁 [updateCurrentAd] Ad ended for device ${deviceId}: ${playbackData.adTitle}`);
        updateData = {
          'currentAd.state': 'ended',
          'currentAd.endTime': now,
          'currentAd.progress': 100,
          lastSeen: now
        };
        
        // Set a timer to clear the currentAd after 5 seconds if no new ad starts
        this.scheduleAdCleanup(deviceId, materialId);
      } else if (playbackData.state === 'loading' || playbackData.state === 'buffering') {
        // During loading/buffering, keep the current ad info but update state
        console.log(`⏳ [updateCurrentAd] Ad ${playbackData.state} for device ${deviceId}: ${playbackData.adTitle}`);
        updateData = {
          'currentAd.state': playbackData.state,
          'currentAd.currentTime': playbackData.currentTime || 0,
          'currentAd.progress': playbackData.progress || 0,
          lastSeen: now
        };
      } else {
        // Normal playback state - update all fields
        // Cancel any pending cleanup timer since a new ad is starting
        this.cancelAdCleanup(deviceId);
        
        updateData = {
          'currentAd': {
            adId: playbackData.adId,
            adTitle: playbackData.adTitle,
            materialId: materialId,
            slotNumber: connection?.slotNumber || 1,
            adDuration: playbackData.duration,
            startTime: playbackData.startTime || now.toISOString(),
            currentTime: playbackData.currentTime || 0,
            state: playbackData.state,
            progress: playbackData.progress || 0,
            endTime: null,
            viewTime: playbackData.currentTime || 0,
            completionRate: playbackData.duration > 0 ? Math.min(100, ((playbackData.currentTime || 0) / playbackData.duration) * 100) : 0,
            impressions: 1
          },
          lastSeen: now
        };
      }

      // Update the current ad information in the database
      const result = await DeviceTracking.findOneAndUpdate(
        { deviceId: deviceId },
        { $set: updateData },
        { new: true }
      );

      if (result) {
        console.log(`✅ Updated current ad for device ${deviceId}: ${playbackData.adTitle} (${playbackData.state})`);
        console.log(`📊 Current ad data:`, result.currentAd);
      } else {
        console.log(`❌ No DeviceTracking document found for device ${deviceId}`);
        
        // Try alternative query by materialId
        const altResult = await DeviceTracking.findOneAndUpdate(
          { materialId },
          { $set: updateData },
          { new: true }
        );
        
        if (altResult) {
          console.log(`✅ Updated current ad via materialId ${materialId}: ${playbackData.adTitle}`);
        } else {
          console.log(`❌ No DeviceTracking document found for materialId ${materialId} either`);
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
      // Check if deviceId is valid
      if (!deviceId) {
        console.log('⚠️ [updateDeviceStatus] Skipping update - deviceId is undefined or null');
        return;
      }
      
      const now = new Date();
      // Get materialId from active connections
      const connection = this.activeConnections.get(deviceId);
      const materialId = connection?.materialId;
      
      if (!materialId) {
        console.log(`⚠️ [updateDeviceStatus] No materialId found for device ${deviceId}. Skipping update.`);
        return;
      }
      
      console.log(`🔄 [updateDeviceStatus] Updating device status: ${deviceId} -> ${status ? 'online' : 'offline'} (materialId: ${materialId})`);
      
      // Find existing record by materialId
      let deviceTracking = await DeviceTracking.findOne({ materialId: materialId });
      
      if (!deviceTracking) {
        console.log(`⚠️ [updateDeviceStatus] No DeviceTracking record found for materialId: ${materialId}. Device may not be registered.`);
        return;
      }
      
      // Ensure date field is always UTC midnight (no timezone confusion)
      const today = new Date();
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
      if (!deviceTracking.date || new Date(deviceTracking.date).toDateString() !== todayUTC.toDateString()) {
        console.log(`📅 [updateDeviceStatus] Setting date to UTC midnight: ${todayUTC.toISOString()}`);
        deviceTracking.date = todayUTC;
      }
      
      // Update the specific slot for this device
      const slot = deviceTracking.slots.find(s => s.deviceId === deviceId);
      if (slot) {
        slot.isOnline = status;
        slot.lastSeen = now;
        deviceTracking.isOnline = deviceTracking.slots.some(s => s.isOnline);
        deviceTracking.lastSeen = now;
        
        // If device is coming online, ensure we have an active session
        if (status && (!deviceTracking.currentSession || !deviceTracking.currentSession.isActive)) {
          console.log(`🔄 [updateDeviceStatus] Device ${deviceId} coming online, ensuring active session`);
          // Use UTC midnight for date field (no timezone offset confusion)
          const today = new Date();
          const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
          
          deviceTracking.currentSession = {
            date: todayUTC,  // UTC midnight for current date
            startTime: now,
            endTime: null,
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            isActive: true,
            targetHours: 8,
            complianceStatus: 'PENDING',
            locationHistory: [],
            lastOnlineUpdate: now  // Track when device came online
          };
        } else if (status && deviceTracking.currentSession && deviceTracking.currentSession.isActive) {
          // Device was already online - just update the last online update time
          deviceTracking.currentSession.lastOnlineUpdate = now;
        }
        
        await deviceTracking.save();
        console.log(`✅ [updateDeviceStatus] Updated slot for device ${deviceId} in material ${materialId}`);
        
        // Real-time hours calculation when device comes online
        if (status) {
          console.log(`🕐 [updateDeviceStatus] Calculating real-time hours for ${deviceId}`);
          deviceTracking.calculateAndUpdateOnlineHours();
          await deviceTracking.save();
          console.log(`✅ [updateDeviceStatus] Real-time hours updated: ${deviceTracking.totalHoursOnline} hours`);
        }
      } else {
        console.log(`⚠️ [updateDeviceStatus] Device ${deviceId} not found in slots for material ${materialId}`);
      }

      console.log(`✅ [updateDeviceStatus] Device ${deviceId} marked as ${status ? 'online' : 'offline'}`);
      
      // Update DeviceStatusManager with database status
      deviceStatusManager.setDatabaseStatus(deviceId, status, now);
      
      // Also update with the short device ID if they're different
      // This handles the case where the database has the full device ID but WebSocket uses short ID
      if (deviceId && deviceId.includes('TABLET-') && deviceId.includes('-W09-')) {
        // Extract short device ID from full device ID
        const shortDeviceId = deviceId.split('-W09-')[0].replace('TABLET-', '') + '-W09';
        console.log(`🔄 [DeviceStatusManager] Also updating short device ID: ${shortDeviceId}`);
        deviceStatusManager.setDatabaseStatus(shortDeviceId, status, now);
      }
      
      // Broadcast the status update to all connected clients
      this.broadcastDeviceUpdate(deviceTracking);
      
      // Also update the device list
      this.broadcastDeviceList();
    } catch (error) {
      console.error(`❌ Error updating status for device ${deviceId}:`, error);
    }
  }

  async updateDeviceStatusWithMaterialId(deviceId, materialId, status) {
    try {
      const now = new Date();
      
      
      // Find existing record by materialId
      let deviceTracking = await DeviceTracking.findOne({ materialId: materialId });
      
      if (!deviceTracking) {
        console.log(`⚠️ [updateDeviceStatusWithMaterialId] No DeviceTracking record found for materialId: ${materialId}. Device may not be registered.`);
        return;
      }
      
      // Update the specific slot for this device
      const slot = deviceTracking.slots.find(s => s.deviceId === deviceId);
      if (slot) {
        slot.isOnline = status;
        slot.lastSeen = now;
        deviceTracking.isOnline = deviceTracking.slots.some(s => s.isOnline);
        deviceTracking.lastSeen = now;
        
        // When device goes offline, end the session
        if (!status) {
          console.log(`📴 [updateDeviceStatusWithMaterialId] Device ${deviceId} going offline - ending session`);
          if (deviceTracking.currentSession && deviceTracking.currentSession.isActive) {
            deviceTracking.currentSession.isActive = false;
            deviceTracking.currentSession.endTime = new Date();
          }
        }
        
        await deviceTracking.save();
      }
      
      // Update DeviceStatusManager with database status
      deviceStatusManager.setDatabaseStatus(deviceId, status, now);
      
      // Broadcast the status update to all connected clients
      this.broadcastDeviceUpdate(deviceTracking);
      
      // Also update the device list
      this.broadcastDeviceList();
      
    } catch (error) {
      console.error(`❌ Error updating status for device ${deviceId} with materialId ${materialId}:`, error);
    }
  }

  async handleDisconnect(deviceId) {
    // Get materialId before removing connection
    const connection = this.activeConnections.get(deviceId);
    let materialId = connection?.materialId;
    
    // Debug logging
    
    // If no materialId from connection, try to find it from database
    if (!materialId) {
      try {
        const DeviceTracking = require('../models/deviceTracking');
        const device = await DeviceTracking.findOne({ 'slots.deviceId': deviceId });
        if (device) {
          materialId = device.materialId;
        }
      } catch (error) {
        console.error(`❌ [handleDisconnect] Error finding materialId from database:`, error);
      }
    }
    
    this.removeConnection(deviceId);
    try {
      console.log(`🔄 [handleDisconnect] Starting disconnect process for device: ${deviceId}`);
      
      // Update device status with materialId if available
      if (materialId) {
        await this.updateDeviceStatusWithMaterialId(deviceId, materialId, false);
      } else {
        console.log(`⚠️ [handleDisconnect] No materialId found for device ${deviceId}, skipping database update`);
      }
      
      // Also update tablet registration status to OFFLINE
      await this.updateTabletStatus(deviceId, false);
      
      console.log(`✅ [handleDisconnect] Successfully handled disconnect for device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`❌ [handleDisconnect] Error handling disconnect for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Update tablet registration status when device disconnects
   * @param {string} deviceId - Device identifier
   * @param {boolean} isOnline - Whether device is online
   */
  async updateTabletStatus(deviceId, isOnline) {
    try {
      const Tablet = require('../models/Tablet');
      
      // Find tablet by device ID
      const tablet = await Tablet.findOne({
        'tablets.deviceId': deviceId
      });

      if (!tablet) {
        console.log(`⚠️ [updateTabletStatus] Tablet not found for device: ${deviceId}`);
        return;
      }

      // Find the specific tablet slot
      const tabletIndex = tablet.tablets.findIndex(t => t.deviceId === deviceId);
      if (tabletIndex === -1) {
        console.log(`⚠️ [updateTabletStatus] Tablet slot not found for device: ${deviceId}`);
        return;
      }

      // Update tablet status
      const currentTablet = tablet.tablets[tabletIndex];
      tablet.tablets[tabletIndex] = {
        tabletNumber: currentTablet.tabletNumber,
        deviceId: currentTablet.deviceId,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastSeen: new Date(),
        gps: currentTablet.gps || null
      };

      await tablet.save();
      console.log(`✅ [updateTabletStatus] Updated tablet status for ${deviceId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

    } catch (error) {
      console.error(`❌ [updateTabletStatus] Error updating tablet status for ${deviceId}:`, error);
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
      const screen = await DeviceTracking.findOne({ materialId });
      if (screen && screen.deviceId) {
        return screen.deviceId;
      }

      // If not found by materialId, try to find by partial deviceId match
      const screens = await DeviceTracking.find({ 
        deviceId: { $regex: shortDeviceId, $options: 'i' } 
      });
      
      if (screens.length > 0) {
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

  /**
   * Send unregister notification to a specific device
   * @param {string} deviceId - Device identifier
   */
  sendUnregisterNotification(deviceId) {
    try {
      const connection = this.activeConnections.get(deviceId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        const message = {
          type: 'unregister',
          deviceId: deviceId,
          message: 'This device has been unregistered by an administrator',
          timestamp: new Date().toISOString()
        };
        connection.send(JSON.stringify(message));
        console.log(`✅ Sent unregister notification to device: ${deviceId}`);
        
        // Close the connection after sending the message
        setTimeout(() => {
          if (connection.readyState === WebSocket.OPEN) {
            connection.close(1000, 'Device unregistered');
          }
        }, 1000); // Wait 1 second before closing to ensure message is delivered
      } else {
        console.log(`⚠️ No active WebSocket connection found for device: ${deviceId}`);
      }
    } catch (error) {
      console.error(`Error sending unregister notification to device ${deviceId}:`, error);
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
        // If we haven't received a pong in the last 15 seconds, mark as dead (faster detection)
        if (ws.lastPong && (now - ws.lastPong) > 15000) {
          console.log(`Device ${deviceId} connection timed out (no pong for 15s)`);
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
        let result = await DeviceTracking.findOneAndUpdate(
          { deviceId: deviceId },
          { 
            $unset: { 'currentAd': 1 },
            $set: { lastSeen: new Date() }
          },
          { new: true }
        );
        
        // If not found, try by materialId
        if (!result) {
          result = await DeviceTracking.findOneAndUpdate(
            { materialId },
            { 
              $unset: { 'currentAd': 1 },
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

  // Slot synchronization methods
  broadcastSlotSynchronization(materialId, sourceSlotNumber, message) {
    if (!this.materialConnections || !this.materialConnections.has(materialId)) {
      console.log(`⚠️ [SlotSync] No material connections found for ${materialId}`);
      return;
    }

    const connections = this.materialConnections.get(materialId);
    const syncMessage = {
      type: 'slotSync',
      sourceSlot: sourceSlotNumber,
      materialId: materialId,
      adId: message.adId || '',
      adTitle: message.adTitle || '',
      state: message.state,
      currentTime: message.currentTime || 0,
      duration: message.duration || 0,
      progress: message.progress || 0,
      timestamp: new Date().toISOString()
    };

    console.log(`🔄 [SlotSync] Broadcasting sync from slot ${sourceSlotNumber} to other slots: ${message.adTitle || 'Unknown'} - ${message.state}`);

    connections.forEach((connection, slotNumber) => {
      if (slotNumber !== sourceSlotNumber && connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        console.log(`🔄 [SlotSync] Sending sync to slot ${slotNumber}: ${message.adTitle || 'Unknown'} - ${message.state}`);
        try {
          connection.ws.send(JSON.stringify(syncMessage));
        } catch (error) {
          console.error(`❌ [SlotSync] Error sending sync to slot ${slotNumber}:`, error);
        }
      }
    });
  }

  handleSyncRequest(deviceId, materialId, slotNumber, message) {
    if (!this.materialConnections || !this.materialConnections.has(materialId)) {
      return;
    }

    const connections = this.materialConnections.get(materialId);
    console.log(`🔄 [SlotSync] Handling sync request from slot ${slotNumber} for material ${materialId}`);

    // Find the first active slot that is currently playing an ad
    let sourceSlot = null;
    let bestSourceSlot = null;
    
    connections.forEach(ws => {
      if (ws.slotNumber !== slotNumber && ws.readyState === WebSocket.OPEN) {
        // Prefer slots that are currently playing
        if (ws.currentPlaybackState && ws.currentPlaybackState.state === 'playing') {
          bestSourceSlot = ws;
        } else if (!sourceSlot) {
          sourceSlot = ws; // Fallback to any active slot
        }
      }
    });

    const targetSlot = bestSourceSlot || sourceSlot;
    
    // Don't sync if no slots are actually playing ads
    if (!targetSlot || (targetSlot.currentPlaybackState && 
        (targetSlot.currentPlaybackState.state === 'loading' || 
         targetSlot.currentPlaybackState.state === 'buffering'))) {
      console.log(`⚠️ [SlotSync] No active playing slots found for material ${materialId}`);
      return;
    }

    if (targetSlot) {
      // Request current state from the source slot
      const stateRequest = {
        type: 'stateRequest',
        requestingSlot: slotNumber,
        materialId: materialId,
        timestamp: new Date().toISOString()
      };

      try {
        targetSlot.send(JSON.stringify(stateRequest));
        console.log(`🔄 [SlotSync] Requesting state from slot ${targetSlot.slotNumber} for slot ${slotNumber}`);
        
        // Also send a direct sync message with current state if available
        if (targetSlot.currentPlaybackState) {
          const directSync = {
            type: 'slotSync',
            sourceSlot: targetSlot.slotNumber,
            materialId: materialId,
            adId: targetSlot.currentPlaybackState.adId,
            adTitle: targetSlot.currentPlaybackState.adTitle,
            state: targetSlot.currentPlaybackState.state,
            currentTime: targetSlot.currentPlaybackState.currentTime,
            duration: targetSlot.currentPlaybackState.duration,
            progress: targetSlot.currentPlaybackState.progress,
            timestamp: new Date().toISOString()
          };
          
          // Send directly to the requesting slot
          const requestingConnection = this.activeConnections.get(deviceId);
          if (requestingConnection && requestingConnection.readyState === WebSocket.OPEN) {
            requestingConnection.send(JSON.stringify(directSync));
            console.log(`🔄 [SlotSync] Sent direct sync to slot ${slotNumber} from slot ${targetSlot.slotNumber}`);
          }
        }
      } catch (error) {
        console.error(`Error requesting state from slot ${targetSlot.slotNumber}:`, error);
      }
    } else {
      console.log(`⚠️ [SlotSync] No active slots found for material ${materialId} to sync with slot ${slotNumber}`);
    }
  }

  // Clean up slot connections when WebSocket closes
  cleanupSlotConnections(deviceId, materialId, slotNumber) {
    if (materialId && slotNumber) {
      const slotKey = `${materialId}-${slotNumber}`;
      if (this.slotConnections && this.slotConnections.has(slotKey)) {
        this.slotConnections.get(slotKey).delete(this.activeConnections.get(deviceId));
        if (this.slotConnections.get(slotKey).size === 0) {
          this.slotConnections.delete(slotKey);
        }
      }

      if (this.materialConnections && this.materialConnections.has(materialId)) {
        this.materialConnections.get(materialId).delete(this.activeConnections.get(deviceId));
        if (this.materialConnections.get(materialId).size === 0) {
          this.materialConnections.delete(materialId);
        }
      }
    }
  }
}

module.exports = new DeviceStatusService();
