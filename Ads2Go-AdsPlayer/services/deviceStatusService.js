import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { AppState } from 'react-native';
import offlineQueueService from './offlineQueueService';

class DeviceStatusService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.deviceId = null;
    this.materialId = null;
    this.onStatusChange = null;
    this.isConnected = false;
    this.backgroundTimeout = null;
  }

  initialize = async ({ materialId, onStatusChange, forceReconnect = false }) => {
    // Store the previous materialId to check if it changed
    const previousMaterialId = this.materialId;
    this.materialId = materialId;
    this.onStatusChange = onStatusChange;
    
    // Get device ID from stored registration data
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        const registration = JSON.parse(registrationData);
        this.deviceId = registration.deviceId;
        console.log('Using stored device ID from registration:', this.deviceId);
        
        // Check if device is actually registered
        if (!registration.isRegistered) {
          console.log('Device not registered, skipping WebSocket initialization');
          if (this.onStatusChange) {
            this.onStatusChange({ 
              isOnline: false, 
              error: 'Device not registered. Please register the tablet first.' 
            });
          }
          return;
        }
      } else {
        // No registration data found, device is not registered
        console.log('No registration data found, device not registered');
        if (this.onStatusChange) {
          this.onStatusChange({ 
            isOnline: false, 
            error: 'Device not registered. Please register the tablet first.' 
          });
        }
        return;
      }
    } catch (error) {
      console.error('Error getting device ID from registration:', error);
      if (this.onStatusChange) {
        this.onStatusChange({ 
          isOnline: false, 
          error: 'Failed to verify registration status' 
        });
      }
      return;
    }
    
    // Connect if we have a materialId and either:
    // 1. It's different from the previous one, OR
    // 2. Force reconnect is requested (for going back online)
    if (materialId && (materialId !== previousMaterialId || forceReconnect)) {
      console.log('Initializing WebSocket with materialId:', materialId, forceReconnect ? '(force reconnect)' : '');
      this.connect();
    } else if (!materialId) {
      console.warn('No materialId provided, cannot initialize WebSocket');
      if (this.onStatusChange) {
        this.onStatusChange({ 
          isOnline: false, 
          error: 'Material ID is required for connection' 
        });
      }
    }
    
    // Listen to app state changes if not already listening
    if (!this.appStateListener) {
      this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);
    }
  }

  connect = () => {
    // Don't connect if already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] Already connected or connecting, skipping connection attempt');
      return;
    }

    // Clear any existing connection and timeouts
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Don't proceed if materialId is not set
    if (!this.materialId) {
      console.warn('Cannot connect: materialId is not set');
      if (this.onStatusChange) {
        this.onStatusChange({ 
          isOnline: false, 
          error: 'Material ID is required for connection' 
        });
      }
      return;
    }

    try {
      // Use the same host as the API URL but with WebSocket protocol
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/status?deviceId=${this.deviceId}&materialId=${this.materialId}`;
      
    // Only log connection attempts if not in reconnection mode
    if (this.reconnectAttempts === 0) {
      console.log('[WebSocket] Connecting to server...');
    }
      
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      // Only log WebSocket creation if not in reconnection mode
      if (this.reconnectAttempts === 0) {
        console.log('[WebSocket] WebSocket created, ready state:', this.ws.readyState);
      }

      this.ws.onopen = () => {
        if (this.reconnectAttempts > 0) {
          console.log('[WebSocket] ✅ Reconnected to server successfully');
        } else {
          console.log('[WebSocket] Connected successfully');
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectTimeout();
        
        // Notify status change
        if (this.onStatusChange) {
          this.onStatusChange({ 
            isOnline: true, 
            isConnected: true,
            error: null 
          });
        }
        
        // Start ping to keep connection alive
        this.startPing();
        
        // Send initial status update
        this.sendStatusUpdate();
      };
      
      this.ws.onclose = (e) => {
        // Only log disconnection if it's unexpected (not during reconnection)
        if (this.reconnectAttempts === 0) {
          console.log('[WebSocket] Disconnected - Code:', e.code, 'Reason:', e.reason, 'WasClean:', e.wasClean);
        }
        this.isConnected = false;
        this.stopPing();
        
        // Notify status change
        if (this.onStatusChange) {
          let errorMessage = 'Disconnected';
          let shouldReconnect = true;
          
          if (e.code === 1006) {
            errorMessage = 'Connection lost';
          } else if (e.code === 1000) {
            errorMessage = 'Connection closed normally';
            // Don't auto-reconnect for normal closures unless it's unexpected
            shouldReconnect = false;
          } else if (e.code === 1001) {
            errorMessage = 'Connection going away';
          } else if (e.code === 1002) {
            errorMessage = 'Protocol error';
          } else if (e.code === 1003) {
            errorMessage = 'Unsupported data';
          } else if (e.code === 1004) {
            errorMessage = 'Reserved';
          } else if (e.code === 1005) {
            errorMessage = 'No status code';
          } else if (e.code === 1007) {
            errorMessage = 'Invalid frame payload data';
          } else if (e.code === 1008) {
            errorMessage = 'Policy violation';
          } else if (e.code === 1009) {
            errorMessage = 'Message too big';
          } else if (e.code === 1010) {
            errorMessage = 'Missing extension';
          } else if (e.code === 1011) {
            errorMessage = 'Internal error';
          } else if (e.code === 1012) {
            errorMessage = 'Service restart';
          } else if (e.code === 1013) {
            errorMessage = 'Try again later';
          } else if (e.code === 1014) {
            errorMessage = 'Bad gateway';
          } else if (e.code === 1015) {
            errorMessage = 'TLS handshake';
          }
          
          this.onStatusChange({ 
            isOnline: false, 
            isConnected: false,
            error: errorMessage,
            shouldReconnect: shouldReconnect,
            closeCode: e.code,
            closeReason: e.reason
          });
        }
      };
      
      this.ws.onerror = (error) => {
        // Only log connection errors if we're not in a reconnection attempt
        if (this.reconnectAttempts === 0) {
          console.log('[WebSocket] Connection error - will attempt to reconnect');
        }
        if (this.onStatusChange) {
          this.onStatusChange({ 
            isOnline: false, 
            isConnected: false,
            error: 'Connection failed'
          });
        }
        this.handleDisconnect(error);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            this.lastPong = Date.now();
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      // Send initial ping to establish connection
      this.sendPing();
    } catch (error) {
      console.error('Error in WebSocket connection:', error);
      this.handleDisconnect(error);
    }
  }

  startPing = () => {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.lastPong = Date.now();
    
    // Send ping every 30 seconds (server has 30s timeout)
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000);
  };

  stopPing = () => {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  };

  clearReconnectTimeout = () => {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  };

  sendPing = () => {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // Check if we've received a pong recently
      if (this.lastPong) {
        const timeSinceLastPong = Date.now() - this.lastPong;
        if (timeSinceLastPong > 60000) { // 60 seconds without pong
          console.warn('[WebSocket] No pong received recently, reconnecting...');
          this.handleDisconnect(new Error('No pong received'));
          return;
        }
      }
      
      // Send ping
      this.ws.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      console.error('[WebSocket] Error sending ping:', error);
      this.handleDisconnect(error);
    }
  }

  sendStatusUpdate = () => {
    try {
      const statusUpdate = {
        type: 'statusUpdate',
        deviceId: this.deviceId,
        materialId: this.materialId,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion || 'unknown',
        deviceName: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown'
      };

      // Queue device status (will send immediately if online, queue if offline)
      offlineQueueService.queueDeviceStatus({
        isOnline: this.isConnected,
        lastSeen: new Date().toISOString()
      });

      // Send via WebSocket if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(statusUpdate));
        // Only log status updates occasionally to reduce noise
        if (Math.random() < 0.1) { // Log ~10% of status updates
          console.log('📡 [DeviceStatus] Status update sent via WebSocket');
        }
      } else {
        // Only log offline queuing occasionally
        if (Math.random() < 0.05) { // Log ~5% of offline queuing
          console.log('📦 [DeviceStatus] Status update queued (offline)');
        }
      }
    } catch (error) {
      console.error('[WebSocket] Error sending status update:', error);
    }
  }

  handleDisconnect = (error) => {
    this.isConnected = false;
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Close existing connection
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.error('[WebSocket] Error closing connection:', e);
      }
      this.ws = null;
    }
    
    // Notify status change
    if (this.onStatusChange) {
      this.onStatusChange({ 
        isConnected: false,
        error: error?.message || 'Disconnected',
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.maxReconnectAttempts
      });
    }
    
    // Try to reconnect if we haven't exceeded max attempts and not already scheduled
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.reconnectTimeout) {
      const baseDelay = 1000; // Start with 1 second
      const maxDelay = 30000; // Max 30 seconds
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay) + jitter;
      
      // Only log first reconnection attempt to reduce noise
      if (this.reconnectAttempts === 0) {
        console.log(`[WebSocket] Server offline - attempting to reconnect in ${Math.round(delay/1000)}s`);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null; // Clear the timeout reference
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
    }
  };

  disconnect = () => {
    console.log('[WebSocket] Manually disconnecting...');
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close WebSocket connection
    if (this.ws) {
      try {
        this.ws.close(1000, 'Manual disconnect');
      } catch (e) {
        console.error('[WebSocket] Error closing connection:', e);
      }
      this.ws = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    
    // Notify status change
    if (this.onStatusChange) {
      this.onStatusChange({ 
        isConnected: false,
        isOnline: false,
        error: 'Manually disconnected'
      });
    }
  };

  handleAppStateChange = (nextAppState) => {
    console.log(`[AppState] Changed to: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      // App came to foreground
      // Clear any background timeout
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
        this.backgroundTimeout = null;
      }
      
      if (!this.isConnected) {
        console.log('[AppState] App is active, reconnecting WebSocket...');
        this.reconnectAttempts = 0;
        this.connect();
      } else {
        console.log('[AppState] App is active, WebSocket already connected');
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background or is inactive
      // Don't close WebSocket immediately - let it try to maintain connection
      console.log('[AppState] App is in background, maintaining WebSocket connection...');
      // Only close if we've been in background for too long
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
      }
      this.backgroundTimeout = setTimeout(() => {
        console.log('[AppState] App has been in background too long, closing WebSocket...');
        if (this.ws) {
          this.ws.close();
        }
      }, 300000); // 5 minutes in background before closing
    }
  };

  cleanup = () => {
    // Clean up event listeners
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    
    // Clear timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.backgroundTimeout) {
      clearTimeout(this.backgroundTimeout);
      this.backgroundTimeout = null;
    }
    
    // Stop ping interval
    this.stopPing();
    
    // Close WebSocket connection
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    
    // Reset connection state
    this.isConnected = false;
    
    // Notify status change
    if (this.onStatusChange) {
      this.onStatusChange({ isOnline: false, error: 'Connection closed' });
    }
  };
}

// Export a singleton instance
export default new DeviceStatusService();
