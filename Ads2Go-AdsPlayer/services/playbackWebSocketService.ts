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
  private onCompanyAdsOnly: ((message: any) => void) | null = null;
  private onRefreshAds: ((message: any) => void) | null = null;
  private syncRequestInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  // ✅ NEW: Track if Slot 2 is in slave mode (true) or failover mode (false)
  // Slot 2 starts in slave mode, can switch to failover if Slot 1 goes offline
  private isInSlaveMode: boolean = true;

  constructor() {
    this.loadDeviceInfo();
  }

  // ✅ NEW: Method to toggle slave mode for Slot 2
  // Called by AdPlayer when failover is triggered or when reverting to slave mode
  setSlaveMode(isSlaveMode: boolean) {
    if (this.slotNumber === 2) {
      this.isInSlaveMode = isSlaveMode;
      console.log(`🔄 [WebSocket] Slot 2 mode changed: ${isSlaveMode ? 'SLAVE (mirroring)' : 'FAILOVER (master)'}`);
    }
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

      this.ws.onopen = async () => {
        if (this.reconnectAttempts > 0) {
          console.log('🔌 [WebSocket] ✅ Reconnected to playback server successfully');
        } else {
          console.log('🔌 [WebSocket] Connected successfully');
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
        
        // ✅ FIX: Update device status to online when WebSocket connects
        // This ensures device is marked online when connection is established
        try {
          const tabletRegistrationService = (await import('./tabletRegistration')).default;
          if (this.deviceId && tabletRegistrationService) {
            await tabletRegistrationService.updateTabletStatus(true);
            console.log('✅ [WebSocket] Device status updated to ONLINE after connection');
          }
        } catch (error) {
          console.error('Error updating device status on WebSocket connect:', error);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            console.log('🔌 [WebSocket] Received pong');
          } else if (message.type === 'stop8Hours') {
            console.log('🛑 [WebSocket] Received 8-hour completion STOP command:', message);
            this.handleStop8Hours(message);
          } else if (message.type === 'companyAdsOnly') {
            console.log('🏢 [WebSocket] Received company ads only mode command:', message);
            this.handleCompanyAdsOnly(message);
          } else if (message.type === 'refreshAds') {
            console.log('🔄 [WebSocket] Received refresh ads command:', message);
            this.handleRefreshAds(message);
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

      this.ws.onclose = async (event) => {
        // Only log disconnection if it's unexpected (not during reconnection)
        if (this.reconnectAttempts === 0) {
          console.log('🔌 [WebSocket] Connection closed:', event.code, event.reason);
        }
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.ws = null;
        
        // ✅ FIX: Server-side WebSocket handler will mark device offline when connection closes
        // We don't need to mark offline here - the server handles it in handleDisconnect()
        // Only try to reconnect if we haven't exceeded max attempts
        // Note: Server will mark device offline immediately when connection closes,
        // but will mark it back online when reconnection succeeds
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          // Still trying to reconnect - schedule reconnection attempt
          this.scheduleReconnect();
        } else {
          // Max reconnection attempts reached
          // Server has already marked device offline via handleDisconnect()
          console.error('🔌 [WebSocket] Max reconnection attempts reached - device is offline');
          // Note: Device status is already managed by server-side WebSocket handler
          // No need to call updateTabletStatus here - server handles it
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
    
    // ✅ CRITICAL FIX: Slot 2 in SLAVE mode should NEVER broadcast playback updates
    // This prevents Slot 2 from sending its state that could cause Slot 1 to sync backwards
    // However, in FAILOVER mode (Slot 1 offline), Slot 2 acts as master and should broadcast
    if (this.slotNumber === 2 && this.isInSlaveMode) {
      console.log('⏭️ [WebSocket] Slot 2 (slave mode) skipping playback updates - only receives from Slot 1');
      return;
    }
    
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

    // ✅ OPTIMIZED: Send periodic sync updates every 5 seconds instead of every 200ms
    // Client will calculate progress locally using startTime + duration
    // This reduces WebSocket traffic by 96% (from 5 updates/sec to 0.2 updates/sec)
    this.playbackUpdateInterval = setInterval(() => {
      this.sendPlaybackUpdate();
    }, 5000); // 5 seconds for periodic sync to correct any drift

    // Send initial update immediately with startTime
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
    // ✅ CRITICAL FIX: Slot 2 in SLAVE mode should NEVER send playback updates
    // Only the master (Slot 1 or Slot 2 in failover) sends playback updates
    if (this.slotNumber === 2 && this.isInSlaveMode) {
      return;
    }
    
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
    // ✅ CRITICAL FIX: Slot 2 in SLAVE mode should NEVER respond to state requests
    // This prevents Slot 2 from broadcasting its stale position to Slot 1, which causes both slots to restart
    // However, in FAILOVER mode (Slot 1 offline), Slot 2 acts as master and should respond normally
    if (this.slotNumber === 2 && this.isInSlaveMode) {
      console.log('⏭️ [WebSocket] Slot 2 (slave mode) ignoring state request - only master responds');
      return;
    }
    
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
    // ✅ CRITICAL FIX: Only the requesting slot should process the state response
    // If this slot IS the requesting slot, process it. Otherwise ignore it.
    // This prevents Slot 1 from processing Slot 2's state responses
    if (this.slotNumber !== message.requestingSlot) {
      console.log(`⏭️ [WebSocket] Ignoring state response - this is slot ${this.slotNumber}, response is for slot ${message.requestingSlot}`);
      return;
    }
    
    // This will be called by the AdPlayer component to handle state responses
    // The sourceSlot should be the slot that sent the response (NOT the requesting slot)
    // For a 2-slot system: if requestingSlot is 2, sourceSlot is 1, and vice versa
    const sourceSlot = message.requestingSlot === 1 ? 2 : 1;
    
    if (this.onSlotSync) {
      this.onSlotSync({
        type: 'slotSync',
        sourceSlot: sourceSlot,  // ✅ FIX: Use the RESPONDING slot, not the requesting slot
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
    // ✅ CRITICAL FIX: Slot 2 in SLAVE mode should NEVER send display data
    // Only the master (Slot 1 or Slot 2 in failover) sends display data
    if (this.slotNumber === 2 && this.isInSlaveMode) {
      console.log('⏭️ [WebSocket] Slot 2 in slave mode - skipping display data broadcast');
      return;
    }
    
    try {
      if (!this.ws) {
        console.log('⚠️ [WebSocket] Cannot send display data - WebSocket not initialized');
        return;
      }
      
      if (this.ws.readyState !== 1) {
        console.log(`⚠️ [WebSocket] Cannot send display data - WebSocket not open (readyState: ${this.ws.readyState})`);
        return;
      }
      
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

  // Handle company ads only mode command from server (when 8 hours reached)
  private handleCompanyAdsOnly(message: any) {
    try {
      console.log('🏢 [WebSocket] Handling company ads only mode command:', message);
      console.log(`🎉 Congratulations! You completed ${message.totalHours?.toFixed(2)} hours`);
      console.log(`🏢 Switching to company ads only mode - will lock at ${message.lockTime}`);
      
      // Emit companyAdsOnly event to trigger mode switch
      if (this.onCompanyAdsOnly) {
        this.onCompanyAdsOnly(message);
      }
      
      // Save the completion data to AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem('8hourCompletion', JSON.stringify({
        completedAt: message.completedAt,
        totalHours: message.totalHours,
        lockTime: message.lockTime,
        deviceId: message.deviceId,
        companyAdsOnlyMode: true
      })).catch((error: any) => {
        console.error('❌ Error saving 8-hour completion data:', error);
      });
      
      // NOTE: Keep WebSocket connection open - device will continue playing
    } catch (error) {
      console.error('❌ [WebSocket] Error handling company ads only command:', error);
    }
  }

  // Request synchronization with other slots
  requestSync() {
    if (this.isConnected && this.ws && this.materialId && this.slotNumber) {
      // ✅ FIXED: Allow Slot 2 to request sync even without playback data (for initial sync)
      // Slot 1 (master) should only sync if it has playback data
      // Slot 2 (slave) should ALWAYS be able to request sync to catch up with master
      const isSlot2 = this.slotNumber === 2;
      
      if (!isSlot2) {
        // Slot 1 (master): Only request sync if we have current playback data and are actually playing
        if (!this.currentPlaybackData || !this.currentPlaybackData.adId || 
            this.currentPlaybackData.state === 'loading' || 
            this.currentPlaybackData.state === 'buffering') {
          console.log('🔄 [WebSocket] Skipping sync request - no ads currently playing or still loading');
          return;
        }
      } else {
        // Slot 2 (slave): Always allow sync request - this is for initial sync when connecting late
        console.log('🔄 [WebSocket] Slot 2 requesting initial sync with master (Slot 1)');
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

  setCompanyAdsOnlyCallback(callback: (message: any) => void) {
    this.onCompanyAdsOnly = callback;
  }

  // Handle refresh ads command from server
  private handleRefreshAds(message: any) {
    try {
      console.log('🔄 [WebSocket] Handling refresh ads command:', message);
      
      // Emit refreshAds event to the AdPlayer component
      if (this.onRefreshAds) {
        this.onRefreshAds(message);
      }
    } catch (error) {
      console.error('❌ [WebSocket] Error handling refresh ads command:', error);
    }
  }

  setRefreshAdsCallback(callback: (message: any) => void) {
    this.onRefreshAds = callback;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new PlaybackWebSocketService();
