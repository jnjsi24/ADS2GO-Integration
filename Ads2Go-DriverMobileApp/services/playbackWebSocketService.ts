/**
 * PlaybackWebSocketService - Real-time device tracking for Driver Mobile App
 * 
 * Connects to the server's WebSocket to receive:
 * - Real-time GPS updates from ad player (via adPlaybackUpdate messages)
 * - Device online/offline status
 * - Location updates
 * 
 * This replaces the 30-second polling with real-time updates (1-5 second intervals)
 */

import API_CONFIG from '../config/api';

interface GPSData {
  lat: number;
  lng: number;
  speed: number;      // meters per second
  heading: number;    // degrees (0-360)
  accuracy: number;   // meters
  altitude?: number;  // meters
  timestamp: string;  // ISO string
}

interface SessionStatus {
  isActive: boolean;
  startTime: string;
  endTime?: string;
  currentHours: number;
  targetHours: number;
  remainingHours: number;
  progressPercent: number;
  complianceStatus: 'PENDING' | 'COMPLIANT' | 'NON_COMPLIANT';
}

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
  
  // GPS data from real-time WebSocket updates (included in adPlaybackUpdate)
  gpsData?: GPSData;
  
  // Session status for 8-hour requirement tracking (NEW)
  sessionStatus?: SessionStatus;
  
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

type UpdateCallback = (update: PlaybackUpdate) => void;

class PlaybackWebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Set<UpdateCallback> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000; // 3 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManuallyDisconnected: boolean = false;

  constructor() {
    // Service initialized silently
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('🔌 [PlaybackWebSocketService] Already connected or connecting');
      return;
    }

    // Prevent connection attempts if no server is configured
    if (!API_CONFIG.BASE_URL || API_CONFIG.BASE_URL === 'null') {
      console.log('⚠️ [PlaybackWebSocketService] No server configured, skipping connection');
      return;
    }

    this.isConnecting = true;
    this.isManuallyDisconnected = false;

    try {
      const wsUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws') + '/ws';
      // Only log in dev mode to reduce console noise
      if (__DEV__ && this.reconnectAttempts === 0) {
        console.log('🔌 [PlaybackWebSocketService] Connecting to:', wsUrl);
      }
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ [PlaybackWebSocketService] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        
        // Notify subscribers of connection
        this.notifySubscribers({
          type: 'deviceUpdate',
          deviceId: 'system',
          isOnline: true,
          timestamp: new Date().toISOString()
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Ignore heartbeat pings
          if (data.type === 'ping' || data.type === 'pong') {
            return;
          }

          // Log received updates (sample for debugging)
          if (Math.random() < 0.1) {
            console.log('📨 [PlaybackWebSocketService] Received update:', {
              type: data.type,
              deviceId: data.deviceId,
              hasGPS: !!data.gpsData
            });
          }

          this.notifySubscribers(data);
        } catch (error) {
          console.error('❌ [PlaybackWebSocketService] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        // Only log error in development mode, not the full error object
        if (__DEV__) {
          console.log('⚠️ [PlaybackWebSocketService] Connection failed (server may be offline)');
        }
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        // Only log on first disconnect to reduce noise
        if (__DEV__ && this.reconnectAttempts === 0) {
          console.log('🔌 [PlaybackWebSocketService] Disconnected');
        }
        this.isConnecting = false;
        this.stopHeartbeat();
        
        // Notify subscribers of disconnection
        this.notifySubscribers({
          type: 'deviceUpdate',
          deviceId: 'system',
          isOnline: false,
          timestamp: new Date().toISOString()
        });

        // Auto-reconnect if not manually disconnected
        if (!this.isManuallyDisconnected) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      // Only log in dev mode
      if (__DEV__) {
        console.log('⚠️ [PlaybackWebSocketService] Connection failed');
      }
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    console.log('🔌 [PlaybackWebSocketService] Manual disconnect');
    this.isManuallyDisconnected = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to WebSocket updates
   */
  subscribe(callback: UpdateCallback): () => void {
    this.subscribers.add(callback);
    // Only log in dev mode
    if (__DEV__ && this.subscribers.size === 1) {
      console.log('🔌 [PlaybackWebSocketService] WebSocket subscriber connected');
    }

    // Auto-connect if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      
      // Disconnect if no more subscribers
      if (this.subscribers.size === 0) {
        if (__DEV__) {
          console.log('🔌 [PlaybackWebSocketService] No subscribers, disconnecting');
        }
        this.disconnect();
      }
    };
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }

  // Private methods

  private notifySubscribers(update: PlaybackUpdate): void {
    this.subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('❌ [PlaybackWebSocketService] Error in subscriber callback:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isManuallyDisconnected) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Only log in dev mode and only once
      if (__DEV__) {
        console.log('⚠️ [PlaybackWebSocketService] Unable to connect to server (will retry when route tab is opened)');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    // Only log first reconnect attempt to reduce noise
    if (__DEV__ && this.reconnectAttempts === 1) {
      console.log(`🔄 [PlaybackWebSocketService] Will retry connection...`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('❌ [PlaybackWebSocketService] Heartbeat error:', error);
        }
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Export singleton instance
export default new PlaybackWebSocketService();

