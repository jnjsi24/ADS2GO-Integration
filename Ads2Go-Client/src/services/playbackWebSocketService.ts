interface PlaybackUpdate {
  type: 'adPlaybackUpdate';
  deviceId: string;
  adId: string;
  adTitle: string;
  state: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
  currentTime: number;
  duration: number;
  progress: number;
  timestamp: string;
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
    // Use REACT_APP_API_URL and extract host from it
    const apiUrl = process.env.REACT_APP_API_URL;
    if (!apiUrl) {
      throw new Error('REACT_APP_API_URL environment variable is not set');
    }
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${protocol}//${host}/ws/playback?admin=true`;
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 [Admin WebSocket] Already connected');
      return;
    }

    try {
      const wsUrl = this.getWebSocketUrl();
      console.log('🔌 [Admin WebSocket] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 [Admin WebSocket] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            console.log('🔌 [Admin WebSocket] Received pong');
          } else if (message.type === 'adPlaybackUpdate') {
            console.log('🎬 [Admin WebSocket] Received playback update:', {
              deviceId: message.deviceId,
              adTitle: message.adTitle,
              state: message.state,
              progress: message.progress
            });
            
            // Notify all callbacks
            this.callbacks.forEach(callback => {
              try {
                callback(message);
              } catch (error) {
                console.error('Error in playback update callback:', error);
              }
            });
          } else if (message.type === 'deviceUpdate') {
            console.log('📱 [Admin WebSocket] Received device update:', message.device);
          } else if (message.type === 'deviceList') {
            console.log('📋 [Admin WebSocket] Received device list:', message.devices);
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
