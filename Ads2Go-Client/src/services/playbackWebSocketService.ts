interface PlaybackUpdate {
  type: 'adPlaybackUpdate' | 'deviceUpdate' | 'deviceList' | 'locationUpdate';
  deviceId: string;
  adId?: string;
  adTitle?: string;
  state?: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
  currentTime?: number;
  duration?: number;
  progress?: number;
  timestamp?: string;
  isOnline?: boolean;
  lastSeen?: string;
  devices?: any[];
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
    
    // Playback WebSocket configuration logging (only in verbose mode)
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
      console.log('🔧 Playback WebSocket Service Configuration:', {
        envUrl: process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_URL,
        finalUrl: actualServerUrl,
        usingFallback: !serverUrl,
        reason: serverUrl ? 'Using environment variable' : 'Using localhost fallback',
        currentNetwork: process.env.CURRENT_NETWORK || 'not set'
      });
    }
    
    const host = actualServerUrl.replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${protocol}//${host}/ws/playback?admin=true`;
    
    // Only log WebSocket URL in verbose mode
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
      console.log('🔌 [WebSocket] Final WebSocket URL:', wsUrl);
    }
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
      // Only log connection attempts in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('🔌 [Admin WebSocket] Connecting to:', wsUrl);
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Only log successful connections in verbose mode
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
          console.log('🔌 [Admin WebSocket] Connected successfully to:', wsUrl);
        }
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
              console.log('📱 [Admin WebSocket] Received device update:', message.device);
            }
            
            // Forward device update to callbacks
            this.callbacks.forEach(callback => {
              try {
                callback({
                  type: 'deviceUpdate',
                  deviceId: message.device.deviceId,
                  isOnline: message.device.isOnline,
                  lastSeen: message.device.lastSeen
                });
              } catch (error) {
                console.error('Error in device update callback:', error);
              }
            });
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
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 [Admin WebSocket] Connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.ws = null;
        this.clearPingInterval();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('🔌 [Admin WebSocket] Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        console.error('🔌 [Admin WebSocket] Connection error:', error);
        console.error('🔌 [Admin WebSocket] WebSocket state:', this.ws?.readyState);
        console.error('🔌 [Admin WebSocket] WebSocket URL:', wsUrl);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('🔌 [Admin WebSocket] Connection failed:', error);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`🔌 [Admin WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
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

export default new PlaybackWebSocketService();
