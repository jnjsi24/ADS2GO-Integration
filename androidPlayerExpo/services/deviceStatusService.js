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

  initialize({ materialId, onStatusChange }) {
    this.materialId = materialId;
    this.onStatusChange = onStatusChange;
    
    // Get device ID
    this.deviceId = Application.androidId || Device.modelName || 'unknown-device';
    
    // Initialize WebSocket connection
    this.connect();
    
    // Listen to app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  connect = () => {
    if (this.ws) {
      this.ws.close();
    }

    // Use the same host as the API URL but with WebSocket protocol
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${baseUrl}/ws/status?deviceId=${this.deviceId}&materialId=${this.materialId}`;
    console.log('Connecting to WebSocket:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start ping interval
      this.startPing();
      
      // Send initial ping to establish connection
      this.sendPing();
      
      // Notify status change
      if (this.onStatusChange) {
        this.onStatusChange({ isOnline: true });
      }
    };

    this.ws.onclose = (e) => {
      console.log('WebSocket disconnected:', e.code, e.reason);
      this.isConnected = false;
      this.stopPing();
      
      // Notify status change
      if (this.onStatusChange) {
        this.onStatusChange({ isOnline: false });
      }
      
      // Attempt to reconnect
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.stopPing();
      
      // Notify status change
      if (this.onStatusChange) {
        this.onStatusChange({ isOnline: false, error });
      }
      
      // Attempt to reconnect
      this.handleReconnect();
    };
  };

  handleReconnect = () => {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  };

  // Handle incoming pings from server
  handlePing = () => {
    if (this.ws && this.isConnected) {
      // Respond to server pings with pong
      this.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
  };

  // Send ping to server
  sendPing = () => {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ 
        type: 'ping', 
        timestamp: Date.now() 
      }));
    }
  };

  startPing = () => {
    // Clear any existing interval
    this.stopPing();
    
    // Send ping every 20 seconds to keep the connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.sendPing();
      }
    }, 20000);
  };

  stopPing = () => {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  };

  handleAppStateChange = (nextAppState) => {
    console.log('App state changed to:', nextAppState);
    if (nextAppState === 'active') {
      // App came to foreground, ensure connection is active
      if (!this.isConnected) {
        console.log('App in foreground, reconnecting WebSocket...');
        this.connect();
      } else {
        // If already connected, send a ping to verify
        this.sendPing();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background, clean up
      console.log('App in background, cleaning up WebSocket...');
      this.stopPing();
      if (this.ws) {
        this.ws.close();
      }
    }
  };

  cleanup = () => {
    // Clean up event listeners and timeouts
    AppState.removeEventListener('change', this.handleAppStateChange);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopPing();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  };
}

// Export a singleton instance
export default new DeviceStatusService();
