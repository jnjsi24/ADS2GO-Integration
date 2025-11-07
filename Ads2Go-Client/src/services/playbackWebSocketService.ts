interface PlaybackUpdate {
  type: 'adPlaybackUpdate' | 'deviceUpdate' | 'deviceList' | 'locationUpdate';
  deviceId: string;
  adId?: string;
  adTitle?: string;
  state?: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
  currentTime?: number;
  duration?: number;
  progress?: number;
  startTime?: string; // ✅ FIXED: Real ad start time (not message timestamp)
  timestamp?: string; // Message timestamp (when update was sent)
  isOnline?: boolean;
  lastSeen?: string;
  devices?: any[];
  // GPS data from real-time WebSocket updates (NEW: included in adPlaybackUpdate)
  gpsData?: {
    lat: number;
    lng: number;
    speed: number;      // meters per second
    heading: number;    // degrees (0-360)
    accuracy: number;   // meters
    altitude?: number;  // meters
    timestamp: string;  // ISO string
  };
  // Legacy location field for backwards compatibility
  location?: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
    timestamp: string;
    isOnline: boolean;
  };
}

type PlaybackUpdateCallback = (update: PlaybackUpdate) => void;

class PlaybackWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private callbacks: PlaybackUpdateCallback[] = [];
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Use environment variable or fallback to localhost for development
    const serverUrl = process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_URL;
    const actualServerUrl = serverUrl ? serverUrl.replace('/graphql', '') : 'http://localhost:5000';
    
    // Always log WebSocket configuration in production to debug connection issues
    console.log('🔧 [Playback WebSocket] Configuration:', {
      REACT_APP_WS_URL: process.env.REACT_APP_WS_URL || 'not set',
      REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'not set',
      serverUrl: serverUrl || 'not set',
      actualServerUrl: actualServerUrl,
      usingFallback: !serverUrl,
      NODE_ENV: process.env.NODE_ENV
    });
    
    const host = actualServerUrl.replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${protocol}//${host}/ws/playback?admin=true`;
    
    // Always log the final WebSocket URL to help debug connection issues
    console.log('🔌 [Playback WebSocket] Final WebSocket URL:', wsUrl);
    return wsUrl;
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Only log connection status in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('🔌 [Admin WebSocket] Already connected');
      }
      return;
    }

    try {
      const wsUrl = this.getWebSocketUrl();
      
      // Skip WebSocket connection in development if server is not available
      if (process.env.NODE_ENV === 'development' && this.reconnectAttempts > 5) {
        console.log('🔌 [Admin WebSocket] Skipping connection attempts in development mode');
        return;
      }
      
      console.log('🔌 [Admin WebSocket] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ [Admin WebSocket] Connected successfully to:', wsUrl);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            // Only log pong in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
              console.log('🔌 [Admin WebSocket] Received pong');
            }
          } else if (message.type === 'adPlaybackUpdate') {
            // Only log playback updates in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
              console.log('🎬 [Admin WebSocket] Received playback update:', {
                deviceId: message.deviceId,
                adTitle: message.adTitle,
                state: message.state,
                progress: message.progress
              });
            }
            
            // Notify all callbacks
            this.callbacks.forEach(callback => {
              try {
                callback(message);
              } catch (error) {
                console.error('Error in playback update callback:', error);
              }
            });
          } else if (message.type === 'deviceUpdate') {
            // Only log device updates in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
              console.log('📱 [Admin WebSocket] Received device update:', message.device || message);
            }
            
            // Forward device update to callbacks
            // Handle both message formats: wrapped (message.device) and direct (message.deviceId)
            let deviceId, isOnline, lastSeen;
            
            if (message.device && message.device.deviceId) {
              // Wrapped format: { type: 'deviceUpdate', device: { deviceId, isOnline, lastSeen } }
              deviceId = message.device.deviceId;
              isOnline = message.device.isOnline;
              lastSeen = message.device.lastSeen;
            } else if (message.deviceId) {
              // Direct format: { type: 'deviceUpdate', deviceId, isOnline, lastSeen }
              deviceId = message.deviceId;
              isOnline = message.isOnline;
              lastSeen = message.lastSeen;
            }
            
            if (deviceId) {
              this.callbacks.forEach(callback => {
                try {
                  callback({
                    type: 'deviceUpdate',
                    deviceId: deviceId,
                    isOnline: isOnline,
                    lastSeen: lastSeen
                  });
                } catch (error) {
                  console.error('Error in device update callback:', error);
                }
              });
            } else {
              console.warn('⚠️ [Admin WebSocket] Received deviceUpdate with missing device data:', message);
            }
          } else if (message.type === 'deviceList') {
            // Only log device list in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
              console.log('📋 [Admin WebSocket] Received device list:', message.devices);
            }
            
            // Forward device list to callbacks
            this.callbacks.forEach(callback => {
              try {
                callback({
                  type: 'deviceList',
                  devices: message.devices
                });
              } catch (error) {
                console.error('Error in device list callback:', error);
              }
            });
          } else if (message.type === 'locationUpdate') {
            console.log('📍 [Admin WebSocket] Received location update:', {
              deviceId: message.deviceId,
              location: message.location
            });
            
            // Forward location update to callbacks
            this.callbacks.forEach(callback => {
              try {
                callback({
                  type: 'locationUpdate',
                  deviceId: message.deviceId,
                  location: message.location
                });
              } catch (error) {
                console.error('Error in location update callback:', error);
              }
            });
          } else if (message.type === 'adPlaybackUpdate') {
            console.log('🎬 [Admin WebSocket] Received playback update:', message);
            
            // Forward playback update to callbacks
            this.callbacks.forEach(callback => {
              try {
                callback({
                  type: 'adPlaybackUpdate',
                  deviceId: message.deviceId,
                  adId: message.adId,
                  adTitle: message.adTitle,
                  state: message.state,
                  currentTime: message.currentTime,
                  duration: message.duration,
                  progress: message.progress
                });
              } catch (error) {
                console.error('Error in playback update callback:', error);
              }
            });
          } else if (message.type === 'displayData') {
            // ✨ NEW: Handle real-time display data from ad player (for live ad monitoring)
            console.log('📺 [Admin WebSocket] Received display data:', {
              materialId: message.materialId,
              adIndex: message.data?.adIndex,
              currentTime: message.data?.currentTime?.toFixed(1),
              isPaused: message.data?.isPaused
            });
            
            // Forward display data to callbacks
            this.callbacks.forEach(callback => {
              try {
                callback({
                  type: 'displayData',
                  materialId: message.materialId,
                  sourceSlot: message.sourceSlot,
                  data: message.data,
                  timestamp: message.timestamp
                });
              } catch (error) {
                console.error('Error in display data callback:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.ws = null;
        this.clearPingInterval();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.warn('🔌 [Admin WebSocket] Max reconnection attempts reached, giving up');
        }
      };

      this.ws.onerror = (error) => {
        // Only log error details on first attempt to avoid spam
        if (this.reconnectAttempts === 0) {
          console.warn('❌ [Admin WebSocket] Connection failed, will retry...');
          console.warn('Error details:', error);
          console.warn('Target URL:', wsUrl);
        }
        this.isConnected = false;
      };

    } catch (error) {
      console.error('🔌 [Admin WebSocket] Connection failed:', error);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    
    this.reconnectInterval = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  private startPingInterval(): void {
    this.clearPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Subscribe to playback updates
  subscribe(callback: PlaybackUpdateCallback): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  // Get current connection status
  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Disconnect WebSocket
  disconnect(): void {
    this.clearReconnectInterval();
    this.clearPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.callbacks = [];
    console.log('🔌 [Admin WebSocket] Disconnected');
  }

  // Reconnect manually
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Assign instance to a variable before exporting to satisfy ESLint rule
const playbackWebSocketService = new PlaybackWebSocketService();
export default playbackWebSocketService;
