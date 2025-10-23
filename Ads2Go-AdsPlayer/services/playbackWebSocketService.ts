import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../utils/logger';

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

interface GPSData {
  lat: number;
  lng: number;
  speed: number;      // meters per second
  heading: number;    // degrees (0-360)
  accuracy: number;   // meters
  altitude?: number;  // meters
  timestamp: string;  // ISO string
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
  gpsData?: GPSData;  // NEW: Real-time GPS data
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
  private onPauseAll: ((message: any) => void) | null = null;
  private onResumeAll: ((message: any) => void) | null = null;
  private onStopAll: ((message: any) => void) | null = null;
  private onDisplayData: ((message: any) => void) | null = null;
  private onLockdown: ((message: any) => void) | null = null;
  private onUnlock: ((message: any) => void) | null = null;
  private onFullscreen: ((message: any) => void) | null = null;
  private onExitFullscreen: ((message: any) => void) | null = null;
  private onStop8Hours: ((message: any) => void) | null = null;
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
        log.deviceTracking('Loaded device info', { deviceId: this.deviceId, materialId: this.materialId, slotNumber: this.slotNumber });
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
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/playback?deviceId=${this.deviceId}&materialId=${this.materialId}&slotNumber=${this.slotNumber}`;
      
      log.deviceTracking('WebSocket server URL', { url: apiUrl });
      log.deviceTracking('WebSocket URL', { url: wsUrl });
      // Only log connection attempts if not in reconnection mode
      if (this.reconnectAttempts === 0) {
        log.deviceTracking('Connecting to playback server...');
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
          } else if (message.type === 'stop8Hours') {
            console.log('🛑 [WebSocket] Received 8-hour completion STOP command:', message);
            this.handleStop8Hours(message);
          } else if (message.type === 'slotSync') {
            console.log('🔄 [WebSocket] Received slot sync command:', message);
            this.handleSlotSync(message);
          } else if (message.type === 'stateRequest') {
            console.log('🔄 [WebSocket] Received state request:', message);
            this.handleStateRequest(message);
          } else if (message.type === 'stateResponse') {
            console.log('🔄 [WebSocket] Received state response:', message);
            this.handleStateResponse(message);
          } else if (message.type === 'pauseAll') {
            console.log('⏸️ [WebSocket] Received pause all command:', message);
            this.handlePauseAll(message);
          } else if (message.type === 'resumeAll') {
            console.log('▶️ [WebSocket] Received resume all command:', message);
            this.handleResumeAll(message);
          } else if (message.type === 'stopAll') {
            console.log('⏹️ [WebSocket] Received stop all command:', message);
            this.handleStopAll(message);
          } else if (message.type === 'displayData') {
            console.log('📺 [WebSocket] Received display data for duplication:', message);
            this.handleDisplayData(message);
          } else if (message.type === 'lockdown') {
            console.log('🔒 [WebSocket] Received lockdown command:', message);
            this.handleLockdown(message);
          } else if (message.type === 'unlock') {
            console.log('🔓 [WebSocket] Received unlock command:', message);
            this.handleUnlock(message);
          } else if (message.type === 'fullscreen') {
            console.log('🖥️ [WebSocket] Received fullscreen command:', message);
            this.handleFullscreen(message);
          } else if (message.type === 'exit-fullscreen') {
            console.log('🖥️ [WebSocket] Received exit fullscreen command:', message);
            this.handleExitFullscreen(message);
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
        startTime: this.currentPlaybackData.startTime,
        gpsData: this.currentPlaybackData.gpsData  // Include GPS data if available
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
        // Only log WebSocket updates occasionally to reduce noise
        if (Math.random() < 0.05) { // Log ~5% of WebSocket updates
          log.deviceTracking(`WebSocket state update`, {
            adTitle: update.adTitle,
            state: update.state,
            progress: `${update.progress.toFixed(1)}%`
          });
        }
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

  // Handle pause all command from server
  private handlePauseAll(message: any) {
    try {
      console.log('⏸️ [WebSocket] Handling pause all command:', message);
      
      // Emit pause event to the AdPlayer component
      if (this.onPauseAll) {
        this.onPauseAll(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling pause all command:', error);
    }
  }

  // Handle resume all command from server
  private handleResumeAll(message: any) {
    try {
      console.log('▶️ [WebSocket] Handling resume all command:', message);
      
      // Emit resume event to the AdPlayer component
      if (this.onResumeAll) {
        this.onResumeAll(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling resume all command:', error);
    }
  }

  // Handle stop all command from server
  private handleStopAll(message: any) {
    try {
      console.log('⏹️ [WebSocket] Handling stop all command:', message);
      
      // Emit stop event to the AdPlayer component
      if (this.onStopAll) {
        this.onStopAll(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling stop all command:', error);
    }
  }

  // Handle slot synchronization command from server
  private handleSlotSync(message: any) {
    try {
      console.log('🔄 [WebSocket] Handling slot sync command:', message);
      
      // Emit slot sync event to the AdPlayer component
      if (this.onSlotSync) {
        this.onSlotSync(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling slot sync command:', error);
    }
  }

  // Handle display data for duplication
  private handleDisplayData(message: any) {
    try {
      console.log('📺 [WebSocket] Handling display data for duplication:', message);
      
      // Emit display data event to the AdPlayer component
      if (this.onDisplayData) {
        this.onDisplayData(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling display data:', error);
    }
  }

  // Send display data to other slots for duplication
  sendDisplayData(displayData: any) {
    try {
      if (this.ws && this.ws.readyState === 1) {
        const message = {
          type: 'displayData',
          timestamp: new Date().toISOString(),
          data: displayData,
          deviceId: this.deviceId,
          materialId: this.materialId,
          slotNumber: this.slotNumber
        };
        
        this.ws.send(JSON.stringify(message));
        console.log('📺 [WebSocket] Sent display data to other slots:', displayData);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error sending display data:', error);
    }
  }

  // Handle lockdown command from server
  private handleLockdown(message: any) {
    try {
      console.log('🔒 [WebSocket] Handling lockdown command:', message);
      
      // Emit lockdown event to the AdPlayer component
      if (this.onLockdown) {
        this.onLockdown(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling lockdown command:', error);
    }
  }

  // Handle unlock command from server
  private handleUnlock(message: any) {
    try {
      console.log('🔓 [WebSocket] Handling unlock command:', message);
      
      // Emit unlock event to the AdPlayer component
      if (this.onUnlock) {
        this.onUnlock(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling unlock command:', error);
    }
  }

  // Handle fullscreen command from server
  private handleFullscreen(message: any) {
    try {
      console.log('🖥️ [WebSocket] Handling fullscreen command:', message);
      
      // Emit fullscreen event to the AdPlayer component
      if (this.onFullscreen) {
        this.onFullscreen(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling fullscreen command:', error);
    }
  }

  // Handle exit fullscreen command from server
  private handleExitFullscreen(message: any) {
    try {
      console.log('🖥️ [WebSocket] Handling exit fullscreen command:', message);
      
      // Emit exit fullscreen event to the AdPlayer component
      if (this.onExitFullscreen) {
        this.onExitFullscreen(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling exit fullscreen command:', error);
    }
  }

  // Handle 8-hour completion stop command from server
  private handleStop8Hours(message: any) {
    try {
      console.log('🛑 [WebSocket] Handling 8-hour completion STOP command:', message);
      console.log(`🎉 Congratulations! You completed ${message.totalHours?.toFixed(2)} hours`);
      console.log(`🔒 Ad player will be locked until ${message.unlockTime}`);
      
      // Emit stop8Hours event to trigger shutdown sequence
      if (this.onStop8Hours) {
        this.onStop8Hours(message);
      }
      
      // Also save the completion data to AsyncStorage for lock check on next launch
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem('8hourCompletion', JSON.stringify({
        completedAt: message.completedAt,
        totalHours: message.totalHours,
        unlockTime: message.unlockTime,
        deviceId: message.deviceId
      })).catch((error: any) => {
        console.error('❌ Error saving 8-hour completion data:', error);
      });
      
      // Disconnect WebSocket (server will close it anyway)
      this.disconnect();
    } catch (error) {
      console.error('❌ [WebSocket] Error handling 8-hour stop command:', error);
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

  // Set callback for pause all handling
  setPauseAllCallback(callback: (message: any) => void) {
    this.onPauseAll = callback;
  }

  // Set callback for resume all handling
  setResumeAllCallback(callback: (message: any) => void) {
    this.onResumeAll = callback;
  }

  // Set callback for stop all handling
  setStopAllCallback(callback: (message: any) => void) {
    this.onStopAll = callback;
  }

  // Set callback for slot sync handling
  setSlotSyncCallback(callback: (message: any) => void) {
    this.onSlotSync = callback;
  }

  // Set callback for display data handling
  setDisplayDataCallback(callback: (message: any) => void) {
    this.onDisplayData = callback;
  }

  setLockdownCallback(callback: (message: any) => void) {
    this.onLockdown = callback;
  }

  setUnlockCallback(callback: (message: any) => void) {
    this.onUnlock = callback;
  }

  setFullscreenCallback(callback: (message: any) => void) {
    this.onFullscreen = callback;
  }

  setExitFullscreenCallback(callback: (message: any) => void) {
    this.onExitFullscreen = callback;
  }

  setStop8HoursCallback(callback: (message: any) => void) {
    this.onStop8Hours = callback;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new PlaybackWebSocketService();
