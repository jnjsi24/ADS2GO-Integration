import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { AppState } from 'react-native';

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
  }

  initialize = ({ materialId, onStatusChange, forceReconnect = false }) => {
    // Store the previous materialId to check if it changed
    const previousMaterialId = this.materialId;
    this.materialId = materialId;
    this.onStatusChange = onStatusChange;
    
    // Get device ID
    this.deviceId = Application.androidId || Device.modelName || 'unknown-device';
    
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
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/status?deviceId=${this.deviceId}&materialId=${this.materialId}`;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      console.log('[WebSocket] Device ID:', this.deviceId);
      console.log('[WebSocket] Material ID:', this.materialId);
      console.log('[WebSocket] WebSocket ready state before connection:', this.ws ? this.ws.readyState : 'null');
      
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      console.log('[WebSocket] WebSocket created, ready state:', this.ws.readyState);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
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
        console.log('[WebSocket] Disconnected - Code:', e.code, 'Reason:', e.reason, 'WasClean:', e.wasClean);
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
        console.error('WebSocket error:', error);
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
        
        this.ws.send(JSON.stringify(statusUpdate));
      } catch (error) {
        console.error('[WebSocket] Error sending status update:', error);
      }
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
    
    // Try to reconnect if we haven't exceeded max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const baseDelay = 1000; // Start with 1 second
      const maxDelay = 30000; // Max 30 seconds
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay) + jitter;
      
      console.log(`[WebSocket] Attempting to reconnect in ${Math.round(delay/1000)}s (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
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
      if (!this.isConnected) {
        console.log('[AppState] App is active, reconnecting WebSocket...');
        this.reconnectAttempts = 0;
        this.connect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background or is inactive
      console.log('[AppState] App is in background, cleaning up WebSocket...');
      if (this.ws) {
        this.ws.close();
      }
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
