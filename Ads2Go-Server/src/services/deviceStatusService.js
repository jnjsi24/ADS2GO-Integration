const WebSocket = require('ws');
const DeviceTracking = require('../models/deviceTracking');
const deviceStatusManager = require('./deviceStatusManager');
const deviceOfflineNotificationService = require('./deviceOfflineNotificationService');
const logger = require('../utils/logger');

class DeviceStatusService {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map();
    this.pingInterval = null;
    this.adEndTimers = new Map(); // Track timers for clearing ended ads
    this.offlineCheckInterval = null; // Check for offline devices
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
    logger.info('WebSocket server created, waiting for upgrade requests');
    
    // Handle WebSocket upgrade
    server.on('upgrade', (request, socket, head) => {
      if (process.env.DEBUG_WEBSOCKET === 'true') {
        logger.debug(`WebSocket upgrade request: ${request.url}`);
      }
      
      const url = new URL(request.url, `http://${request.headers.host}`);
      const pathname = url.pathname;
      
      if (pathname === '/ws/status') {
        // Get device ID from query params or headers
        const deviceId = url.searchParams.get('deviceId') || request.headers['device-id'];
        const materialId = url.searchParams.get('materialId') || request.headers['material-id'];
        
        
        if (!deviceId) {
          logger.error('No device ID provided in WebSocket upgrade request');
          socket.destroy();
          return;
        }
        
        if (process.env.DEBUG_WEBSOCKET === 'true') {
          logger.debug(`WebSocket upgrade for device: ${deviceId}${materialId ? `, material: ${materialId}` : ''}`);
        }
        
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
          logger.error('No device ID provided in WebSocket playback upgrade request');
          socket.destroy();
          return;
        }
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          
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
        console.log(`❌ Rejected WebSocket connection to unknown path: ${pathname}`);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });
    
    // Add error handler for the upgrade event
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
    
    this.startPingInterval();
    this.startOfflineCheckInterval();
    console.log('WebSocket server initialized');
  }

  async handleConnection(ws, request) {
    const deviceId = ws.deviceId || request.headers['device-id'];
    const materialId = ws.materialId || request.headers['material-id'];
    
    if (!deviceId) {
      logger.error('No device ID provided in WebSocket connection');
      ws.close(4001, 'Device ID is required');
      return;
    }

    // Clean up any existing connection for this device
    const existingConnection = this.activeConnections.get(deviceId);
    if (existingConnection && existingConnection !== ws) {
      existingConnection.terminate();
    }

    // Store the connection with its device ID and material ID
    ws.deviceId = deviceId;
    ws.materialId = materialId;
    this.activeConnections.set(deviceId, ws);
    
    // Broadcast updated device list to all clients
    this.broadcastDeviceList();
    
    if (process.env.DEBUG_WEBSOCKET === 'true') {
      logger.debug(`Device connected: ${deviceId} (${this.activeConnections.size} online)`);
    }
    
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
    this.broadcastDeviceUpdate(deviceId, true, 'websocket');
    
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
      if (process.env.DEBUG_WEBSOCKET === 'true') {
        logger.debug(`Device disconnected: ${deviceId}`);
      }
      
      this.removeConnection(deviceId);
      this.handleDisconnect(deviceId).catch(err => {
        console.error(`Failed to update status for device ${deviceId}:`, err);
      });
      
      // Update DeviceStatusManager with WebSocket disconnection
      deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
      
      // Immediately broadcast status update for real-time response
      this.broadcastDeviceUpdate(deviceId, false, 'websocket');
      
      // Also update with the full device ID if they're different
      if (deviceId !== ws.materialId) {
        this.findFullDeviceId(deviceId, ws.materialId).then(fullDeviceId => {
          if (fullDeviceId && fullDeviceId !== deviceId) {
            deviceStatusManager.setWebSocketStatus(fullDeviceId, false, new Date());
          }
        }).catch(err => {
          logger.error('Error finding full device ID on disconnect:', err);
        });
      }
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
          logger.websocket(`🎬 [WebSocket] Received adPlaybackUpdate from ${deviceId}:`, {
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
      logger.websocket(`🔧 Admin WebSocket Connection Established for Real-Time Monitoring`);
      // For admin connections, use 'ADMIN' as the key
      deviceId = 'ADMIN';
      materialId = null;
      slotNumber = null;
      
      // Send initial device status to admin connection
      this.sendInitialDeviceStatusToAdmin(ws);
      
      // Set up periodic status updates for admin connection
      const adminUpdateInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendPeriodicStatusUpdateToAdmin(ws);
        } else {
          clearInterval(adminUpdateInterval);
        }
      }, 10000); // Send updates every 10 seconds
      
      // Store the interval ID for cleanup
      ws.adminUpdateInterval = adminUpdateInterval;
    } else {
      deviceId = ws.deviceId || request.headers['device-id'];
      materialId = ws.materialId || request.headers['material-id'];
      slotNumber = ws.slotNumber || request.headers['slot-number'];
      logger.websocket(`🎬 New WebSocket Playback Connection from Device: ${deviceId}${materialId ? ` (material: ${materialId}, slot: ${slotNumber})` : ''}`);
    }

    // Store the connection with its device ID, material ID, and slot number
    ws.deviceId = deviceId;
    ws.materialId = materialId;
    ws.slotNumber = slotNumber;
    this.activeConnections.set(deviceId, ws);
    
    // Also register in DeviceStatusManager for status tracking
    if (!ws.isAdmin) {
      const deviceStatusManager = require('./deviceStatusManager');
      deviceStatusManager.setWebSocketStatus(deviceId, true, new Date());
      console.log(`🔌 [DeviceStatusManager] Registered playback connection for ${deviceId} as online`);
      
      // Trigger online notification
      deviceOfflineNotificationService.checkDeviceStatusChange(
        deviceId, 
        true, 
        'websocket_connect'
      );
    }
    
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
          logger.websocket(`🎬 [WebSocket] Received adPlaybackUpdate from ${deviceId}:`, {
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
        } else if (message.type === 'displayData') {
          // Handle display data from master (Slot 1) to broadcast to slave (Slot 2)
          console.log(`📺 [WebSocket] Received displayData from Slot ${slotNumber}:`, {
            materialId,
            slotNumber,
            data: message.data
          });
          this.broadcastDisplayData(materialId, slotNumber, message);
        }
      } catch (error) {
        console.error('Error processing WebSocket Playback Message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      logger.websocket(`🎬 [WebSocket] Playback Connection Closed: ${deviceId} - Code: ${code}, Reason: ${reason}`);
      if (this.activeConnections.get(deviceId) === ws) {
        // Clean up admin update interval if this is an admin connection
        if (ws.isAdmin && ws.adminUpdateInterval) {
          clearInterval(ws.adminUpdateInterval);
          console.log('🔧 [Admin WebSocket] Cleared admin update interval');
        }
        
        // Clean up slot connections before removing the main connection
        this.cleanupSlotConnections(deviceId, materialId, slotNumber);
        this.removeConnection(deviceId);
        
        // Also update DeviceStatusManager for status tracking
        if (!ws.isAdmin) {
          const deviceStatusManager = require('./deviceStatusManager');
          deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
          console.log(`🔌 [DeviceStatusManager] Marked playback connection for ${deviceId} as offline`);
          
          // Trigger offline notification
          deviceOfflineNotificationService.checkDeviceStatusChange(
            deviceId, 
            false, 
            'websocket_disconnect'
          );
        }
      }
    });
  }

  async handlePlaybackUpdate(deviceId, message) {
    try {
      // Log playback update (with GPS info if available)
      const logData = {
        adId: message.adId,
        adTitle: message.adTitle,
        state: message.state,
        currentTime: message.currentTime,
        duration: message.duration,
        progress: message.progress
      };
      
      // Add GPS data to log if available
      if (message.gpsData) {
        logData.gps = {
          lat: message.gpsData.lat,
          lng: message.gpsData.lng,
          speed: `${(message.gpsData.speed * 3.6).toFixed(1)} km/h`,
          accuracy: `${message.gpsData.accuracy}m`
        };
      }
      
      console.log(`🎬 [Playback Update] ${deviceId}:`, logData);

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
          gpsData: message.gpsData, // Store GPS data
          timestamp: new Date().toISOString()
        };
      }

      // Update the database with current ad information
      await this.updateCurrentAd(deviceId, message);

      // Process GPS data if available (real-time location tracking)
      if (message.gpsData) {
        await this.processGPSData(deviceId, message.gpsData, message.adDetails);
      }

      // Broadcast the playback update to all admin clients
      this.broadcastPlaybackUpdate(deviceId, message);

    } catch (error) {
      console.error(`Error handling playback update for device ${deviceId}:`, error);
    }
  }

  async processGPSData(deviceId, gpsData, adDetails) {
    const connection = this.activeConnections.get(deviceId);
    const materialId = connection?.materialId || adDetails?.materialId;
    const deviceSlot = connection?.slotNumber || adDetails?.slotNumber;

    if (!materialId || !deviceSlot) {
      // Skip GPS processing if we don't have materialId or slot
      return;
    }

    // Validate GPS data
    const { lat, lng, speed, heading, accuracy, altitude, timestamp } = gpsData;
    
    // Skip invalid GPS coordinates
    if (!lat || !lng || lat === 0 && lng === 0) {
      return;
    }

    // Log GPS processing only in debug mode
    if (process.env.DEBUG_GPS === 'true') {
      logger.debug(`GPS from ${deviceId}: ${lat.toFixed(6)}, ${lng.toFixed(6)}, ${(speed * 3.6).toFixed(1)} km/h`);
    }

    // Retry logic for handling version conflicts
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // Update device tracking with GPS data
        const DeviceTracking = require('../models/deviceTracking');
        let carTracking = await DeviceTracking.findByMaterialId(materialId);

        if (!carTracking) {
          // Device tracking record not found - skip GPS update
          // The HTTP fallback will create the record if needed
          return;
        }

        // Check if we should update the location (avoid excessive updates)
        const shouldUpdate = await this.shouldUpdateGPSLocation(
          carTracking,
          lat,
          lng,
          accuracy,
          timestamp
        );

        if (!shouldUpdate) {
          return; // Skip this update
        }

        // Update current location
        carTracking.currentLocation = {
          type: 'Point',
          coordinates: [lng, lat],
          accuracy,
          speed: speed || 0,
          heading: heading || 0,
          altitude: altitude || undefined,
          timestamp: new Date(timestamp || Date.now())
        };

        // Add to location history (for route tracking)
        if (!carTracking.locationHistory) {
          carTracking.locationHistory = [];
        }

        carTracking.locationHistory.push({
          type: 'Point',
          coordinates: [lng, lat],
          timestamp: new Date(timestamp || Date.now()),
          speed: speed || 0,
          heading: heading || 0,
          accuracy
        });

        // Keep only last 1000 location points to avoid excessive storage
        if (carTracking.locationHistory.length > 1000) {
          carTracking.locationHistory = carTracking.locationHistory.slice(-1000);
        }

        // Update distance traveled
        if (carTracking.currentSession && speed > 0) {
          const timeDiff = Date.now() - new Date(carTracking.currentSession.lastOnlineUpdate).getTime();
          const hours = timeDiff / (1000 * 60 * 60);
          const distanceKm = (speed * 3.6) * hours; // speed in km/h * hours
          
          if (distanceKm > 0 && distanceKm < 10) { // Sanity check: less than 10km per update
            carTracking.currentSession.totalDistanceTraveled += distanceKm;
          }
        }

        // Save the updated tracking record
        await carTracking.save();
        
        // Success! Exit the retry loop
        return;

      } catch (error) {
        lastError = error;
        
        // Check if this is a version conflict error (check multiple ways mongoose might indicate this)
        const isVersionError = error.name === 'VersionError' || 
                               error.constructor.name === 'VersionError' ||
                               error.message?.includes('No matching document found') ||
                               error.message?.includes('version');
        
        if (isVersionError) {
          retryCount++;
          if (retryCount < maxRetries) {
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
            continue; // Retry
          } else {
            // Max retries exceeded for version conflict - silently fail (this is expected with high-frequency GPS)
            if (process.env.DEBUG_GPS === 'true') {
              console.warn(`⚠️ GPS update for ${deviceId} failed after ${maxRetries} retries (version conflict)`);
            }
            return;
          }
        }
        
        // For non-version errors, log and exit
        console.error(`Error processing GPS data for device ${deviceId}:`, error);
        return;
      }
    }
  }

  async shouldUpdateGPSLocation(carTracking, lat, lng, accuracy, timestamp) {
    try {
      // Always update if no current location
      if (!carTracking.currentLocation) {
        return true;
      }

      const currentLoc = carTracking.currentLocation;
      const [currentLng, currentLat] = currentLoc.coordinates || [0, 0];

      // Calculate distance between current and new location (simple approximation)
      const latDiff = lat - currentLat;
      const lngDiff = lng - currentLng;
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // Rough meters

      // Update if moved more than 5 meters
      if (distance > 5) {
        return true;
      }

      // Update if accuracy improved significantly
      if (accuracy < (currentLoc.accuracy || 999) * 0.7) {
        return true;
      }

      // Update if more than 10 seconds have passed
      const timeDiff = Date.now() - new Date(currentLoc.timestamp || 0).getTime();
      if (timeDiff > 10000) {
        return true;
      }

      return false; // Skip this update
    } catch (error) {
      console.error('Error in shouldUpdateGPSLocation:', error);
      return false;
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
      // Query by materialId since DeviceTracking stores devices in slots array
      const result = await DeviceTracking.findOneAndUpdate(
        { materialId },
        { $set: updateData },
        { new: true }
      );

      if (result) {
        // Only log in debug mode to reduce verbosity
        if (process.env.DEBUG_ADS === 'true') {
          console.log(`✅ Updated current ad via materialId ${materialId}: ${playbackData.adTitle}`);
        }
      } else {
        // This is unexpected - log it
        console.log(`⚠️ No DeviceTracking document found for materialId ${materialId}`);
      }

    } catch (error) {
      console.error(`Error updating current ad for device ${deviceId}:`, error);
    }
  }

  async broadcastPlaybackUpdate(deviceId, playbackData) {
    // ✅ NEW: Fetch session status to include in real-time updates
    let sessionStatus = null;
    try {
      const deviceTracking = await DeviceTracking.findByDeviceId(deviceId);
      if (deviceTracking && deviceTracking.currentSession) {
        sessionStatus = {
          isActive: deviceTracking.currentSession.isActive || false,
          startTime: deviceTracking.currentSession.startTime,
          endTime: deviceTracking.currentSession.endTime,
          currentHours: deviceTracking.currentSession.totalHoursOnline || 0,
          targetHours: deviceTracking.currentSession.targetHours || 8,
          remainingHours: Math.max(0, (deviceTracking.currentSession.targetHours || 8) - (deviceTracking.currentSession.totalHoursOnline || 0)),
          progressPercent: Math.min(100, ((deviceTracking.currentSession.totalHoursOnline || 0) / (deviceTracking.currentSession.targetHours || 8)) * 100),
          complianceStatus: deviceTracking.currentSession.complianceStatus || 'PENDING'
        };
      }
    } catch (error) {
      console.error(`Error fetching session status for ${deviceId}:`, error);
    }
    
    const updateMessage = {
      type: 'adPlaybackUpdate',
      deviceId: deviceId,
      adId: playbackData.adId,
      adTitle: playbackData.adTitle,
      state: playbackData.state,
      currentTime: playbackData.currentTime,
      duration: playbackData.duration,
      progress: playbackData.progress,
      startTime: playbackData.startTime || new Date().toISOString(), // ✅ FIXED: Send real ad start time
      timestamp: new Date().toISOString(), // Current message timestamp (for update tracking)
      gpsData: playbackData.gpsData || null,  // Include GPS data if available (real-time location)
      sessionStatus: sessionStatus  // ✅ NEW: Include session status for real-time driver progress
    };
    
    // Broadcast to all connections (both status and playback connections)
    this.broadcast(updateMessage);
    
    // Enhanced logging with GPS and session info if available
    const logData = {
      adTitle: playbackData.adTitle,
      state: playbackData.state,
      progress: `${playbackData.progress}%`
    };
    
    if (playbackData.gpsData) {
      logData.gps = {
        lat: playbackData.gpsData.lat.toFixed(6),
        lng: playbackData.gpsData.lng.toFixed(6),
        speed: `${(playbackData.gpsData.speed * 3.6).toFixed(1)} km/h`
      };
    }
    
    if (sessionStatus) {
      logData.session = {
        hours: `${sessionStatus.currentHours.toFixed(2)}/${sessionStatus.targetHours}`,
        progress: `${sessionStatus.progressPercent.toFixed(1)}%`,
        status: sessionStatus.complianceStatus
      };
    }
    
    console.log(`📡 [Broadcast] Playback update for ${deviceId}:`, logData);
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
      
      // Compare dates properly in UTC timezone to avoid timezone conversion issues
      const deviceDateUTC = deviceTracking.date ? new Date(deviceTracking.date) : null;
      let needsDateUpdate = false;
      
      if (!deviceDateUTC) {
        needsDateUpdate = true;
      } else {
        // Compare year, month, and date in UTC timezone (not local)
        const deviceYear = deviceDateUTC.getUTCFullYear();
        const deviceMonth = deviceDateUTC.getUTCMonth();
        const deviceDay = deviceDateUTC.getUTCDate();
        
        const todayYear = todayUTC.getUTCFullYear();
        const todayMonth = todayUTC.getUTCMonth();
        const todayDay = todayUTC.getUTCDate();
        
        if (deviceYear !== todayYear || deviceMonth !== todayMonth || deviceDay !== todayDay) {
          needsDateUpdate = true;
        }
      }
      
      if (needsDateUpdate) {
        console.log(`📅 [updateDeviceStatus] Updating date from ${deviceDateUTC ? deviceDateUTC.toISOString() : 'null'} to UTC midnight: ${todayUTC.toISOString()}`);
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
          
          // Check if there's an existing session for today
          const existingSession = deviceTracking.currentSession;
          let preservedHours = 0;
          let preservedDistance = 0;
          let preservedLocationHistory = [];
          
          if (existingSession && existingSession.date) {
            const sessionDate = new Date(existingSession.date);
            sessionDate.setHours(0, 0, 0, 0);
            const todayLocal = new Date(today);
            todayLocal.setHours(0, 0, 0, 0);
            
            // If the session is from today, preserve the hours and distance
            if (sessionDate.getTime() === todayLocal.getTime()) {
              preservedHours = existingSession.totalHoursOnline || 0;
              preservedDistance = existingSession.totalDistanceTraveled || 0;
              preservedLocationHistory = existingSession.locationHistory || [];
              console.log(`♻️ [updateDeviceStatus] Preserving ${preservedHours.toFixed(2)} hours from existing session for ${deviceId}`);
            }
          }
          
          deviceTracking.currentSession = {
            date: todayUTC,  // UTC midnight for current date
            startTime: existingSession?.startTime || now,  // Preserve original start time if available
            endTime: null,
            totalHoursOnline: preservedHours,  // Preserve hours from same-day session
            totalDistanceTraveled: preservedDistance,  // Preserve distance from same-day session
            isActive: true,
            targetHours: 8,
            complianceStatus: preservedHours >= 8 ? 'COMPLIANT' : 'PENDING',
            locationHistory: preservedLocationHistory,  // Preserve location history
            lastOnlineUpdate: now  // Track when device came online
          };
          
          // Also preserve totalHoursOnline at device level
          if (preservedHours > 0) {
            deviceTracking.totalHoursOnline = preservedHours;
          }
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
      
      // Broadcast the status update to all connected clients (use the deviceId parameter, not deviceTracking.deviceId)
      this.broadcastDeviceUpdate(deviceId, deviceTracking.isOnline, 'database');
      
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
      
      // Broadcast the status update to all connected clients (use the deviceId parameter, not deviceTracking.deviceId)
      this.broadcastDeviceUpdate(deviceId, deviceTracking.isOnline, 'database');
      
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
   * Send initial device status to admin connection
   * @param {WebSocket} ws - Admin WebSocket connection
   */
  async sendInitialDeviceStatusToAdmin(ws) {
    try {
      console.log('🔧 [Admin WebSocket] Sending initial device status...');
      
      // Get all device statuses from DeviceStatusManager
      const deviceStatusManager = require('./deviceStatusManager');
      const allStatuses = deviceStatusManager.getAllDeviceStatuses();
      
      console.log(`📊 [Admin WebSocket] Found ${allStatuses.length} device statuses to send`);
      
      // Send device list first
      const deviceList = allStatuses.map(status => ({
        deviceId: status.deviceId,
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
        source: status.source
      }));
      
      ws.send(JSON.stringify({
        type: 'deviceList',
        devices: deviceList
      }));
      
      console.log(`📋 [Admin WebSocket] Sent device list with ${deviceList.length} devices`);
      
      // Send individual device updates
      for (const status of allStatuses) {
        ws.send(JSON.stringify({
          type: 'deviceUpdate',
          deviceId: status.deviceId,
          isOnline: status.isOnline,
          lastSeen: status.lastSeen,
          source: status.source
        }));
      }
      
      console.log(`📡 [Admin WebSocket] Sent ${allStatuses.length} individual device updates`);
      
    } catch (error) {
      console.error('❌ [Admin WebSocket] Error sending initial device status:', error);
    }
  }

  /**
   * Send periodic status update to admin connection
   * @param {WebSocket} ws - Admin WebSocket connection
   */
  async sendPeriodicStatusUpdateToAdmin(ws) {
    try {
      // Get all device statuses from DeviceStatusManager
      const deviceStatusManager = require('./deviceStatusManager');
      const allStatuses = deviceStatusManager.getAllDeviceStatuses();
      
      // Send device list update
      const deviceList = allStatuses.map(status => ({
        deviceId: status.deviceId,
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
        source: status.source
      }));
      
      ws.send(JSON.stringify({
        type: 'deviceList',
        devices: deviceList
      }));
      
    } catch (error) {
      console.error('❌ [Admin WebSocket] Error sending periodic status update:', error);
    }
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

  broadcastDeviceUpdate(deviceId, isOnline, source = 'websocket') {
    // Skip broadcasting if deviceId is undefined or null
    if (!deviceId) {
      console.warn('⚠️ [broadcastDeviceUpdate] Skipping broadcast - deviceId is undefined or null');
      return;
    }
    
    const device = {
      deviceId,
      isOnline,
      lastSeen: new Date(),
      source: source
    };
    
    // Send to all connections (including admin)
    this.broadcast({
      type: 'deviceUpdate',
      device: device
    });
    
    // Also send individual device update format for admin connections
    this.activeConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.isAdmin) {
        ws.send(JSON.stringify({
          type: 'deviceUpdate',
          deviceId: deviceId,
          isOnline: isOnline,
          lastSeen: device.lastSeen,
          source: source
        }));
      }
    });
    
    console.log(`📡 [Broadcast] Device ${deviceId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'} (source: ${source})`);
    
    // Trigger notification for status changes from any source
    deviceOfflineNotificationService.checkDeviceStatusChange(
      deviceId, 
      isOnline, 
      source === 'websocket' ? 'websocket_update' : 'database_update'
    );
  }

  broadcastLocationUpdate(deviceId, locationData) {
    // Send location update to admin connections only
    this.activeConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.isAdmin) {
        ws.send(JSON.stringify({
          type: 'locationUpdate',
          deviceId: deviceId,
          location: {
            lat: locationData.lat,
            lng: locationData.lng,
            speed: locationData.speed,
            heading: locationData.heading,
            accuracy: locationData.accuracy,
            address: locationData.address,
            timestamp: locationData.timestamp,
            isOnline: locationData.isOnline
          }
        }));
      }
    });
    
    console.log(`📍 [Broadcast] Location update for ${deviceId}: ${locationData.lat}, ${locationData.lng} (online: ${locationData.isOnline})`);
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
        this.broadcastDeviceUpdate(deviceId, false, 'timeout');
        
        // Update DeviceStatusManager
        deviceStatusManager.setWebSocketStatus(deviceId, false, new Date());
      });

      if (process.env.DEBUG_WEBSOCKET === 'true') {
        logger.debug(`Real-Time Connection Check: ${this.activeConnections.size}`);
      }
    }, 10000); // 10 seconds for faster real-time checking
  }

  startOfflineCheckInterval() {
    // Clear any existing interval
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
    }

    // Set up offline check interval (every 5 minutes)
    this.offlineCheckInterval = setInterval(() => {
      try {
        // Clean up old notification history
        deviceOfflineNotificationService.cleanupOldHistory();
        
        // Log statistics
        const stats = deviceOfflineNotificationService.getNotificationStats();
        console.log(`📊 [DeviceOfflineNotification] Stats: ${JSON.stringify(stats)}`);
      } catch (error) {
        console.error('❌ Error in offline check interval:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
      this.offlineCheckInterval = null;
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

  // Broadcast display data from master (Slot 1) to slave (Slot 2)
  broadcastDisplayData(materialId, sourceSlotNumber, message) {
    if (!this.materialConnections || !this.materialConnections.has(materialId)) {
      console.log(`⚠️ [DisplayData] No material connections found for ${materialId}`);
      return;
    }

    // Only broadcast if source is Slot 1 (master)
    if (sourceSlotNumber !== 1) {
      console.log(`⚠️ [DisplayData] Ignoring displayData from Slot ${sourceSlotNumber} - only Slot 1 can broadcast`);
      return;
    }

    const connections = this.materialConnections.get(materialId);
    const displayMessage = {
      type: 'displayData',
      sourceSlot: sourceSlotNumber,
      materialId: materialId,
      data: message.data,
      timestamp: message.timestamp || new Date().toISOString()
    };

    console.log(`📺 [DisplayData] Broadcasting display data from Slot ${sourceSlotNumber} to slaves`);

    // Send to all other slots (only Slot 2 should receive)
    connections.forEach((ws) => {
      if (ws.slotNumber !== sourceSlotNumber && ws.readyState === WebSocket.OPEN) {
        console.log(`📺 [DisplayData] Sending display data to Slot ${ws.slotNumber}`);
        try {
          ws.send(JSON.stringify(displayMessage));
        } catch (error) {
          console.error(`❌ [DisplayData] Error sending to Slot ${ws.slotNumber}:`, error);
        }
      }
    });

    // ✨ NEW: Also broadcast to admin clients for real-time monitoring
    this.activeConnections.forEach((ws, deviceId) => {
      if (ws.isAdmin && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(displayMessage));
        } catch (error) {
          console.error(`❌ [DisplayData] Error sending to admin:`, error);
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
