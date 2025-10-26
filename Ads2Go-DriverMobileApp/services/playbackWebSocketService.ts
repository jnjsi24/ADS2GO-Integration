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
    console.log('🔌 [PlaybackWebSocketService] Service initialized');
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('🔌 [PlaybackWebSocketService] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.isManuallyDisconnected = false;

    try {
      const wsUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws') + '/ws';
      console.log('🔌 [PlaybackWebSocketService] Connecting to:', wsUrl);
      
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
        console.error('❌ [PlaybackWebSocketService] WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('🔌 [PlaybackWebSocketService] Disconnected');
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
      console.error('❌ [PlaybackWebSocketService] Connection error:', error);
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
    console.log(`🔌 [PlaybackWebSocketService] Subscriber added (total: ${this.subscribers.size})`);

    // Auto-connect if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      console.log(`🔌 [PlaybackWebSocketService] Subscriber removed (remaining: ${this.subscribers.size})`);
      
      // Disconnect if no more subscribers
      if (this.subscribers.size === 0) {
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
      console.log('❌ [PlaybackWebSocketService] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 [PlaybackWebSocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

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

