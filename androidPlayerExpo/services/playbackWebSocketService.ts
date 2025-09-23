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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private playbackUpdateInterval: NodeJS.Timeout | null = null;
  private currentPlaybackData: Partial<PlaybackUpdate> | null = null;

  constructor() {
    this.loadDeviceInfo();
  }

  private async loadDeviceInfo() {
    try {
      const registration = await AsyncStorage.getItem('tabletRegistration');
      if (registration) {
        const data = JSON.parse(registration);
        this.deviceId = data.deviceId;
        this.materialId = data.materialId;
        console.log('🔌 [WebSocket] Loaded device info:', { deviceId: this.deviceId, materialId: this.materialId });
      }
    } catch (error) {
      console.error('Error loading device info for WebSocket:', error);
    }
  }

  async connect(): Promise<boolean> {
    if (!this.deviceId || !this.materialId) {
      console.error('🔌 [WebSocket] Cannot connect: missing device info');
      return false;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 [WebSocket] Already connected');
      return true;
    }

    try {
      const wsUrl = `ws://192.168.1.7:5000/ws/playback?deviceId=${this.deviceId}&materialId=${this.materialId}`;
      console.log('🔌 [WebSocket] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 [WebSocket] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            console.log('🔌 [WebSocket] Received pong');
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 [WebSocket] Connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.ws = null;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('🔌 [WebSocket] Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        console.error('🔌 [WebSocket] Connection error:', error);
        this.isConnected = false;
      };

      return true;
    } catch (error) {
      console.error('🔌 [WebSocket] Connection failed:', error);
      return false;
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`🔌 [WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectInterval = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
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
        adId: this.currentPlaybackData.adId!,
        adTitle: this.currentPlaybackData.adTitle!,
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
    this.clearReconnectInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log('🔌 [WebSocket] Disconnected');
  }

  async updateDeviceInfo(deviceId: string, materialId: string) {
    this.deviceId = deviceId;
    this.materialId = materialId;
    
    // Reconnect with new device info
    if (this.isConnected) {
      this.disconnect();
      await this.connect();
    }
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new PlaybackWebSocketService();
