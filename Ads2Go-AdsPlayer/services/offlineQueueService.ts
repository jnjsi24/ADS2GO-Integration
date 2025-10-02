import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueuedAdPlayback {
  id: string;
  adId: string;
  adTitle: string;
  adDuration: number;
  startTime: string;
  endTime?: string;
  viewTime: number;
  completionRate: number;
  impressions: number;
  slotNumber: number;
  timestamp: string;
  isOffline: boolean;
}

interface QueuedLocationData {
  id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  isOffline: boolean;
}

interface QueuedDeviceStatus {
  id: string;
  isOnline: boolean;
  lastSeen: string;
  timestamp: string;
  isOffline: boolean;
}

interface QueuedQRScan {
  id: string;
  adId: string;
  adTitle: string;
  qrCode: string;
  timestamp: string;
  isOffline: boolean;
}

class OfflineQueueService {
  private static instance: OfflineQueueService;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  // Storage keys
  private readonly AD_PLAYBACK_QUEUE_KEY = 'offline_ad_playback_queue';
  private readonly LOCATION_QUEUE_KEY = 'offline_location_queue';
  private readonly DEVICE_STATUS_QUEUE_KEY = 'offline_device_status_queue';
  private readonly QR_SCAN_QUEUE_KEY = 'offline_qr_scan_queue';

  private constructor() {}

  static getInstance(): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService();
    }
    return OfflineQueueService.instance;
  }

  // Set online/offline status
  setOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    console.log(`📡 [OfflineQueue] Status changed to: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    // If coming back online, trigger sync
    if (isOnline && !this.syncInProgress) {
      this.syncQueuedData();
    }
  }

  // Queue ad playback data
  async queueAdPlayback(adPlayback: Omit<QueuedAdPlayback, 'id' | 'timestamp' | 'isOffline'>) {
    const queuedItem: QueuedAdPlayback = {
      ...adPlayback,
      id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      isOffline: !this.isOnline
    };

    try {
      const existingQueue = await this.getQueuedData<QueuedAdPlayback>(this.AD_PLAYBACK_QUEUE_KEY);
      existingQueue.push(queuedItem);
      await AsyncStorage.setItem(this.AD_PLAYBACK_QUEUE_KEY, JSON.stringify(existingQueue));
      
      // Only log ad playback queuing occasionally to reduce noise
      if (Math.random() < 0.2) { // Log ~20% of ad playbacks
        console.log(`📦 [OfflineQueue] Queued ad playback: ${queuedItem.adTitle} (${queuedItem.isOffline ? 'OFFLINE' : 'ONLINE'})`);
      }
      
      // If online, try to send immediately
      if (this.isOnline) {
        this.sendQueuedAdPlayback(queuedItem);
      }
    } catch (error) {
      console.error('❌ [OfflineQueue] Error queuing ad playback:', error);
    }
  }

  // Queue location data
  async queueLocationData(locationData: Omit<QueuedLocationData, 'id' | 'timestamp' | 'isOffline'>) {
    const queuedItem: QueuedLocationData = {
      ...locationData,
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      isOffline: !this.isOnline
    };

    try {
      const existingQueue = await this.getQueuedData<QueuedLocationData>(this.LOCATION_QUEUE_KEY);
      existingQueue.push(queuedItem);
      await AsyncStorage.setItem(this.LOCATION_QUEUE_KEY, JSON.stringify(existingQueue));
      
      // Only log location data queuing occasionally to reduce noise
      if (Math.random() < 0.1) { // Log ~10% of location updates
        console.log(`📦 [OfflineQueue] Queued location data: ${queuedItem.lat}, ${queuedItem.lng} (${queuedItem.isOffline ? 'OFFLINE' : 'ONLINE'})`);
      }
      
      // If online, try to send immediately
      if (this.isOnline) {
        this.sendQueuedLocationData(queuedItem);
      }
    } catch (error) {
      console.error('❌ [OfflineQueue] Error queuing location data:', error);
    }
  }

  // Queue device status
  async queueDeviceStatus(deviceStatus: Omit<QueuedDeviceStatus, 'id' | 'timestamp' | 'isOffline'>) {
    const queuedItem: QueuedDeviceStatus = {
      ...deviceStatus,
      id: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      isOffline: !this.isOnline
    };

    try {
      const existingQueue = await this.getQueuedData<QueuedDeviceStatus>(this.DEVICE_STATUS_QUEUE_KEY);
      existingQueue.push(queuedItem);
      await AsyncStorage.setItem(this.DEVICE_STATUS_QUEUE_KEY, JSON.stringify(existingQueue));
      
      // Only log device status queuing occasionally to reduce noise
      if (Math.random() < 0.05) { // Log ~5% of device status updates
        console.log(`📦 [OfflineQueue] Queued device status: ${queuedItem.isOnline ? 'ONLINE' : 'OFFLINE'} (${queuedItem.isOffline ? 'OFFLINE' : 'ONLINE'})`);
      }
      
      // If online, try to send immediately
      if (this.isOnline) {
        this.sendQueuedDeviceStatus(queuedItem);
      }
    } catch (error) {
      console.error('❌ [OfflineQueue] Error queuing device status:', error);
    }
  }

  // Queue QR scan data
  async queueQRScan(qrScan: Omit<QueuedQRScan, 'id' | 'timestamp' | 'isOffline'>) {
    const queuedItem: QueuedQRScan = {
      ...qrScan,
      id: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      isOffline: !this.isOnline
    };

    try {
      const existingQueue = await this.getQueuedData<QueuedQRScan>(this.QR_SCAN_QUEUE_KEY);
      existingQueue.push(queuedItem);
      await AsyncStorage.setItem(this.QR_SCAN_QUEUE_KEY, JSON.stringify(existingQueue));
      
      console.log(`📦 [OfflineQueue] Queued QR scan: ${queuedItem.adTitle} (${queuedItem.isOffline ? 'OFFLINE' : 'ONLINE'})`);
      
      // If online, try to send immediately
      if (this.isOnline) {
        this.sendQueuedQRScan(queuedItem);
      }
    } catch (error) {
      console.error('❌ [OfflineQueue] Error queuing QR scan:', error);
    }
  }

  // Get queued data
  private async getQueuedData<T>(key: string): Promise<T[]> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`❌ [OfflineQueue] Error getting queued data for ${key}:`, error);
      return [];
    }
  }

  // Sync all queued data when coming back online
  async syncQueuedData() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 [OfflineQueue] Starting sync of queued data...');

    try {
      // Sync ad playbacks
      await this.syncAdPlaybacks();
      
      // Sync location data
      await this.syncLocationData();
      
      // Sync device status
      await this.syncDeviceStatus();
      
      // Sync QR scans
      await this.syncQRScans();
      
      console.log('✅ [OfflineQueue] Sync completed successfully');
    } catch (error) {
      console.error('❌ [OfflineQueue] Error during sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync ad playbacks
  private async syncAdPlaybacks() {
    const queuedData = await this.getQueuedData<QueuedAdPlayback>(this.AD_PLAYBACK_QUEUE_KEY);
    const offlineData = queuedData.filter(item => item.isOffline);
    
    if (offlineData.length === 0) {
      console.log('📊 [OfflineQueue] No offline ad playbacks to sync');
      return;
    }

    console.log(`🔄 [OfflineQueue] Syncing ${offlineData.length} offline ad playbacks...`);

    for (const item of offlineData) {
      try {
        await this.sendQueuedAdPlayback(item);
        await this.removeQueuedItem(this.AD_PLAYBACK_QUEUE_KEY, item.id);
      } catch (error) {
        console.error(`❌ [OfflineQueue] Error syncing ad playback ${item.id}:`, error);
      }
    }
  }

  // Sync location data
  private async syncLocationData() {
    const queuedData = await this.getQueuedData<QueuedLocationData>(this.LOCATION_QUEUE_KEY);
    const offlineData = queuedData.filter(item => item.isOffline);
    
    if (offlineData.length === 0) {
      console.log('📊 [OfflineQueue] No offline location data to sync');
      return;
    }

    console.log(`🔄 [OfflineQueue] Syncing ${offlineData.length} offline location updates...`);

    for (const item of offlineData) {
      try {
        await this.sendQueuedLocationData(item);
        await this.removeQueuedItem(this.LOCATION_QUEUE_KEY, item.id);
      } catch (error) {
        console.error(`❌ [OfflineQueue] Error syncing location data ${item.id}:`, error);
      }
    }
  }

  // Sync device status
  private async syncDeviceStatus() {
    const queuedData = await this.getQueuedData<QueuedDeviceStatus>(this.DEVICE_STATUS_QUEUE_KEY);
    const offlineData = queuedData.filter(item => item.isOffline);
    
    if (offlineData.length === 0) {
      console.log('📊 [OfflineQueue] No offline device status to sync');
      return;
    }

    console.log(`🔄 [OfflineQueue] Syncing ${offlineData.length} offline device status updates...`);

    for (const item of offlineData) {
      try {
        await this.sendQueuedDeviceStatus(item);
        await this.removeQueuedItem(this.DEVICE_STATUS_QUEUE_KEY, item.id);
      } catch (error) {
        console.error(`❌ [OfflineQueue] Error syncing device status ${item.id}:`, error);
      }
    }
  }

  // Sync QR scans
  private async syncQRScans() {
    const queuedData = await this.getQueuedData<QueuedQRScan>(this.QR_SCAN_QUEUE_KEY);
    const offlineData = queuedData.filter(item => item.isOffline);
    
    if (offlineData.length === 0) {
      console.log('📊 [OfflineQueue] No offline QR scans to sync');
      return;
    }

    console.log(`🔄 [OfflineQueue] Syncing ${offlineData.length} offline QR scans...`);

    for (const item of offlineData) {
      try {
        await this.sendQueuedQRScan(item);
        await this.removeQueuedItem(this.QR_SCAN_QUEUE_KEY, item.id);
      } catch (error) {
        console.error(`❌ [OfflineQueue] Error syncing QR scan ${item.id}:`, error);
      }
    }
  }

  // Send queued ad playback to server
  private async sendQueuedAdPlayback(item: QueuedAdPlayback) {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_BASE_URL}/offlineQueue/ad-playback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adId: item.adId,
          adTitle: item.adTitle,
          adDuration: item.adDuration,
          startTime: item.startTime,
          endTime: item.endTime,
          viewTime: item.viewTime,
          completionRate: item.completionRate,
          impressions: item.impressions,
          slotNumber: item.slotNumber,
          isOffline: item.isOffline,
          queuedTimestamp: item.timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

             // Only log successful sends occasionally to reduce noise
             if (Math.random() < 0.1) { // Log ~10% of successful sends
               console.log(`✅ [OfflineQueue] Successfully sent ad playback: ${item.adTitle}`);
             }
    } catch (error) {
      console.error(`❌ [OfflineQueue] Failed to send ad playback ${item.id}:`, error);
      throw error;
    }
  }

  // Send queued location data to server
  private async sendQueuedLocationData(item: QueuedLocationData) {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_BASE_URL}/offlineQueue/location-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: item.lat,
          lng: item.lng,
          speed: item.speed,
          heading: item.heading,
          accuracy: item.accuracy,
          isOffline: item.isOffline,
          queuedTimestamp: item.timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

             // Only log successful sends occasionally to reduce noise
             if (Math.random() < 0.1) { // Log ~10% of successful sends
               console.log(`✅ [OfflineQueue] Successfully sent location data: ${item.lat}, ${item.lng}`);
             }
    } catch (error) {
      console.error(`❌ [OfflineQueue] Failed to send location data ${item.id}:`, error);
      throw error;
    }
  }

  // Send queued device status to server
  private async sendQueuedDeviceStatus(item: QueuedDeviceStatus) {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_BASE_URL}/offlineQueue/device-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isOnline: item.isOnline,
          lastSeen: item.lastSeen,
          isOffline: item.isOffline,
          queuedTimestamp: item.timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

             // Only log successful sends occasionally to reduce noise
             if (Math.random() < 0.1) { // Log ~10% of successful sends
               console.log(`✅ [OfflineQueue] Successfully sent device status: ${item.isOnline ? 'ONLINE' : 'OFFLINE'}`);
             }
    } catch (error) {
      console.error(`❌ [OfflineQueue] Failed to send device status ${item.id}:`, error);
      throw error;
    }
  }

  // Send queued QR scan to server
  private async sendQueuedQRScan(item: QueuedQRScan) {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_BASE_URL}/offlineQueue/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adId: item.adId,
          adTitle: item.adTitle,
          qrCode: item.qrCode,
          isOffline: item.isOffline,
          queuedTimestamp: item.timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ [OfflineQueue] Successfully sent QR scan: ${item.adTitle}`);
    } catch (error) {
      console.error(`❌ [OfflineQueue] Failed to send QR scan ${item.id}:`, error);
      throw error;
    }
  }

  // Remove queued item after successful sync
  private async removeQueuedItem(key: string, itemId: string) {
    try {
      const queuedData = await this.getQueuedData<any>(key);
      const filteredData = queuedData.filter((item: any) => item.id !== itemId);
      await AsyncStorage.setItem(key, JSON.stringify(filteredData));
    } catch (error) {
      console.error(`❌ [OfflineQueue] Error removing queued item ${itemId}:`, error);
    }
  }

  // Get queue statistics
  async getQueueStats() {
    try {
      const adPlaybacks = await this.getQueuedData<QueuedAdPlayback>(this.AD_PLAYBACK_QUEUE_KEY);
      const locations = await this.getQueuedData<QueuedLocationData>(this.LOCATION_QUEUE_KEY);
      const deviceStatus = await this.getQueuedData<QueuedDeviceStatus>(this.DEVICE_STATUS_QUEUE_KEY);
      const qrScans = await this.getQueuedData<QueuedQRScan>(this.QR_SCAN_QUEUE_KEY);

      return {
        adPlaybacks: adPlaybacks.length,
        locations: locations.length,
        deviceStatus: deviceStatus.length,
        qrScans: qrScans.length,
        total: adPlaybacks.length + locations.length + deviceStatus.length + qrScans.length
      };
    } catch (error) {
      console.error('❌ [OfflineQueue] Error getting queue stats:', error);
      return { adPlaybacks: 0, locations: 0, deviceStatus: 0, qrScans: 0, total: 0 };
    }
  }

  // Clear all queued data
  async clearAllQueues() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.AD_PLAYBACK_QUEUE_KEY),
        AsyncStorage.removeItem(this.LOCATION_QUEUE_KEY),
        AsyncStorage.removeItem(this.DEVICE_STATUS_QUEUE_KEY),
        AsyncStorage.removeItem(this.QR_SCAN_QUEUE_KEY)
      ]);
      console.log('🧹 [OfflineQueue] Cleared all queued data');
    } catch (error) {
      console.error('❌ [OfflineQueue] Error clearing queues:', error);
    }
  }
}

export default OfflineQueueService.getInstance();
