import AsyncStorage from '@react-native-async-storage/async-storage';

interface AdDetails {
  adId: string;
  adTitle: string;
  adDuration: number;
  mediaFile: string;
  slotNumber: number;
  materialId: string;
  isCompanyAd: boolean;
  adIndex: number;
  totalAds: number;
}

interface PlaybackUpdate {
  type: 'adPlaybackUpdate';
  deviceId: string;
  adId: string;
  adTitle: string;
  state: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
  currentTime: number;
  duration: number;
  progress: number;
  remainingTime?: number;
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  hasJustStarted?: boolean;
  hasJustFinished?: boolean;
  adDetails?: AdDetails;
  startTime?: string;
}

class PlaybackWebSocketService {
  private ws: WebSocket | null = null;
  private deviceId: string | null = null;
  private materialId: string | null = null;
  private slotNumber: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private playbackUpdateInterval: NodeJS.Timeout | null = null;
  private currentPlaybackData: Partial<PlaybackUpdate> | null = null;
  private onSlotSync: ((message: any) => void) | null = null;
  private syncRequestInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;

  constructor() {
    this.loadDeviceInfo();
  }

  private async loadDeviceInfo() {
    try {
      const registration = await AsyncStorage.getItem('tabletRegistration');
      if (registration) {
        const data = JSON.parse(registration);
        
        // Check if device is actually registered
        if (!data.isRegistered) {
          console.log('🔌 [WebSocket] Device not registered, skipping WebSocket initialization');
          this.deviceId = null;
          this.materialId = null;
          return;
        }
        
        this.deviceId = data.deviceId;
        this.materialId = data.materialId;
        this.slotNumber = data.slotNumber;
        console.log('🔌 [WebSocket] Loaded device info:', { deviceId: this.deviceId, materialId: this.materialId, slotNumber: this.slotNumber });
      } else {
        console.log('🔌 [WebSocket] No registration data found, device not registered');
        this.deviceId = null;
        this.materialId = null;
        this.slotNumber = null;
      }
    } catch (error) {
      console.error('Error loading device info for WebSocket:', error);
      this.deviceId = null;
      this.materialId = null;
      this.slotNumber = null;
    }
  }

  async connect(): Promise<boolean> {
    // First check if device is registered
    try {
      const registration = await AsyncStorage.getItem('tabletRegistration');
      if (!registration) {
        console.log('🔌 [WebSocket] No registration data found, cannot connect');
        return false;
      }
      
      const data = JSON.parse(registration);
      if (!data.isRegistered) {
        console.log('🔌 [WebSocket] Device not registered, cannot connect');
        return false;
      }
    } catch (error) {
      console.error('🔌 [WebSocket] Error checking registration status:', error);
      return false;
    }

    if (!this.deviceId || !this.materialId) {
      console.error('🔌 [WebSocket] Cannot connect: missing device info');
      return false;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 [WebSocket] Already connected or connecting, skipping connection attempt');
      return true;
    }

    try {
      // Use dynamic URL with environment support
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/playback?deviceId=${this.deviceId}&materialId=${this.materialId}&slotNumber=${this.slotNumber}`;
      // Only log connection attempts if not in reconnection mode
      if (this.reconnectAttempts === 0) {
        console.log('🔌 [WebSocket] Connecting to playback server...');
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.reconnectAttempts > 0) {
          console.log('🔌 [WebSocket] ✅ Reconnected to playback server successfully');
        } else {
          console.log('🔌 [WebSocket] Connected successfully');
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            console.log('🔌 [WebSocket] Received pong');
          } else if (message.type === 'slotSync') {
            console.log('🔄 [WebSocket] Received slot sync message:', message);
            this.handleSlotSync(message);
          } else if (message.type === 'stateRequest') {
            console.log('🔄 [WebSocket] Received state request:', message);
            this.handleStateRequest(message);
          } else if (message.type === 'stateResponse') {
            console.log('🔄 [WebSocket] Received state response:', message);
            this.handleStateResponse(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        // Only log disconnection if it's unexpected (not during reconnection)
        if (this.reconnectAttempts === 0) {
          console.log('🔌 [WebSocket] Connection closed:', event.code, event.reason);
        }
        this.isConnected = false;
        this.ws = null;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('🔌 [WebSocket] Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        // Only log connection errors if we're not in a reconnection attempt
        if (this.reconnectAttempts === 0) {
          console.log('🔌 [WebSocket] Connection error - will attempt to reconnect');
        }
        this.isConnected = false;
      };

      return true;
    } catch (error) {
      console.error('🔌 [WebSocket] Connection failed:', error);
      return false;
    }
  }

  private scheduleReconnect() {
    // Don't schedule if already scheduled
    if (this.reconnectInterval) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    // Only log first reconnection attempt to reduce noise
    if (this.reconnectAttempts === 1) {
      console.log(`🔌 [WebSocket] Server offline - attempting to reconnect in ${Math.round(delay/1000)}s`);
    }
    
    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = null; // Clear the interval reference
      this.connect();
    }, delay);
  }

  private clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🔌 [WebSocket] Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff, max 10s
    
    console.log(`🔌 [WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
    }, delay);
  }

  startPlaybackUpdates(playbackData: Partial<PlaybackUpdate>) {
    this.currentPlaybackData = playbackData;
    
    if (!this.isConnected) {
      console.log('🔌 [WebSocket] Not connected, skipping playback updates');
      return;
    }

    // Only start updates if the state is 'playing' - not buffering or loading
    if (playbackData.state !== 'playing') {
      console.log('🔌 [WebSocket] Not starting playback updates - state is not playing:', playbackData.state);
      return;
    }

    // Clear existing interval
    if (this.playbackUpdateInterval) {
      clearInterval(this.playbackUpdateInterval);
    }

    // Send updates every 200ms for ultra smooth real-time progress bar
    this.playbackUpdateInterval = setInterval(() => {
      this.sendPlaybackUpdate();
    }, 200);

    // Send initial update immediately
    this.sendPlaybackUpdate();
  }

  // Update playback data and send immediate update for state changes
  updatePlaybackDataAndSend(playbackData: Partial<PlaybackUpdate>) {
    this.currentPlaybackData = { ...this.currentPlaybackData, ...playbackData };
    
    // Send immediate update for state changes (buffering, loading, etc.)
    if (playbackData.state && this.isConnected && this.ws) {
      this.sendPlaybackUpdate();
    }
  }

  stopPlaybackUpdates() {
    if (this.playbackUpdateInterval) {
      clearInterval(this.playbackUpdateInterval);
      this.playbackUpdateInterval = null;
    }
    this.currentPlaybackData = null;
  }

  private sendPlaybackUpdate() {
    if (!this.isConnected || !this.ws || !this.currentPlaybackData) {
      return;
    }

    try {
      const update: PlaybackUpdate = {
        type: 'adPlaybackUpdate',
        deviceId: this.deviceId!,
        adId: this.currentPlaybackData.adId || '',
        adTitle: this.currentPlaybackData.adTitle || '',
        state: this.currentPlaybackData.state!,
        currentTime: this.currentPlaybackData.currentTime!,
        duration: this.currentPlaybackData.duration!,
        progress: this.currentPlaybackData.progress!,
        startTime: this.currentPlaybackData.startTime
      };

      this.ws.send(JSON.stringify(update));
      
      // Enhanced logging with detailed information
      if (update.state === 'playing' || update.state === 'paused') {
        console.log(`🎬 [WebSocket] Sent detailed playback update:`, {
          deviceId: update.deviceId,
          adTitle: update.adTitle,
          state: update.state,
          progress: `${update.progress.toFixed(1)}%`,
          currentTime: `${update.currentTime.toFixed(1)}s`,
          remainingTime: update.remainingTime ? `${update.remainingTime.toFixed(1)}s` : 'N/A',
          playbackRate: update.playbackRate || 1.0,
          volume: update.volume || 1.0,
          isMuted: update.isMuted || false,
          adIndex: update.adDetails?.adIndex || 'N/A',
          totalAds: update.adDetails?.totalAds || 'N/A',
          isCompanyAd: update.adDetails?.isCompanyAd || false
        });
      } else {
        console.log(`🎬 [WebSocket] Sent detailed state update:`, {
          deviceId: update.deviceId,
          adTitle: update.adTitle,
          state: update.state,
          progress: `${update.progress.toFixed(1)}%`,
          currentTime: `${update.currentTime.toFixed(1)}s`,
          adIndex: update.adDetails?.adIndex || 'N/A',
          totalAds: update.adDetails?.totalAds || 'N/A',
          isCompanyAd: update.adDetails?.isCompanyAd || false,
          mediaFile: update.adDetails?.mediaFile || 'N/A'
        });
      }
    } catch (error) {
      console.error('Error sending playback update:', error);
    }
  }

  updatePlaybackData(playbackData: Partial<PlaybackUpdate>) {
    this.currentPlaybackData = { ...this.currentPlaybackData, ...playbackData };
  }

  disconnect() {
    this.stopPlaybackUpdates();
    this.stopPeriodicSync();
    this.clearReconnectInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log('🔌 [WebSocket] Disconnected');
  }

  async updateDeviceInfo(deviceId: string, materialId: string, slotNumber?: number) {
    this.deviceId = deviceId;
    this.materialId = materialId;
    this.slotNumber = slotNumber || null;
    
    // Reconnect with new device info
    if (this.isConnected) {
      this.disconnect();
      await this.connect();
    }
  }

  // Handle slot synchronization messages
  private handleSlotSync(message: any) {
    // This will be called by the AdPlayer component to handle synchronization
    if (this.onSlotSync) {
      this.onSlotSync(message);
    }
  }

  // Handle state request messages
  private handleStateRequest(message: any) {
    // Send current playback state to requesting slot
    if (this.currentPlaybackData && this.isConnected && this.ws) {
      const stateResponse = {
        type: 'stateResponse',
        requestingSlot: message.requestingSlot,
        materialId: message.materialId,
        ...this.currentPlaybackData,
        timestamp: new Date().toISOString()
      };
      
      this.ws.send(JSON.stringify(stateResponse));
      console.log('🔄 [WebSocket] Sent state response to slot:', message.requestingSlot);
    }
  }

  // Handle state response messages (for late-connecting devices)
  private handleStateResponse(message: any) {
    // This will be called by the AdPlayer component to handle state responses
    if (this.onSlotSync) {
      this.onSlotSync({
        type: 'slotSync',
        sourceSlot: message.requestingSlot,
        materialId: message.materialId,
        adId: message.adId,
        adTitle: message.adTitle,
        state: message.state,
        currentTime: message.currentTime,
        duration: message.duration,
        progress: message.progress,
        timestamp: message.timestamp
      });
    }
  }

  // Request synchronization with other slots
  requestSync() {
    if (this.isConnected && this.ws && this.materialId && this.slotNumber) {
      // Only request sync if we have current playback data and are actually playing
      if (!this.currentPlaybackData || !this.currentPlaybackData.adId || 
          this.currentPlaybackData.state === 'loading' || 
          this.currentPlaybackData.state === 'buffering') {
        console.log('🔄 [WebSocket] Skipping sync request - no ads currently playing or still loading');
        return;
      }

      const syncRequest = {
        type: 'syncRequest',
        materialId: this.materialId,
        slotNumber: this.slotNumber,
        timestamp: new Date().toISOString()
      };
      
      this.ws.send(JSON.stringify(syncRequest));
      this.lastSyncTime = Date.now();
      console.log('🔄 [WebSocket] Requested sync with other slots');
    }
  }

  // Start periodic sync requests (for late-connecting devices)
  startPeriodicSync() {
    if (this.syncRequestInterval) {
      clearInterval(this.syncRequestInterval);
    }

    // Request sync every 30 seconds for minimal synchronization
    this.syncRequestInterval = setInterval(() => {
      if (this.isConnected && this.materialId && this.slotNumber) {
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        if (timeSinceLastSync > 30000) { // Only if we haven't synced in the last 30 seconds
          this.requestSync();
        }
      }
    }, 30000);

    // Stop periodic sync after 60 seconds
    setTimeout(() => {
      if (this.syncRequestInterval) {
        clearInterval(this.syncRequestInterval);
        this.syncRequestInterval = null;
        console.log('🔄 [WebSocket] Stopped periodic sync requests');
      }
    }, 60000);
  }

  // Stop periodic sync requests
  stopPeriodicSync() {
    if (this.syncRequestInterval) {
      clearInterval(this.syncRequestInterval);
      this.syncRequestInterval = null;
    }
  }

  // Set callback for slot sync handling
  setSlotSyncCallback(callback: (message: any) => void) {
    this.onSlotSync = callback;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new PlaybackWebSocketService();
