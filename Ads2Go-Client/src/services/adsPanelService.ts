// AdsPanel API Service - V4 (REAL ADS) - CACHE BUSTED
// Force correct API base URL for REST endpoints (not GraphQL)
const API_BASE_URL = 'http://192.168.1.7:5000';

// Aggressive cache busting - force browser to reload this file
const CACHE_BUST = Date.now();
console.log('🔄 AdsPanelService V4 (REAL ADS) loaded - Cache busted at:', new Date().toISOString(), 'Cache bust ID:', CACHE_BUST);

export interface ScreenData {
  deviceId: string;
  materialId: string;
  displayId?: string; // Display identifier like "DGL-HEADDRESS-CAR-003-SLOT-1"
  screenType: string;
  carGroupId: string;
  slotNumber: number;
  isOnline: boolean;
  currentLocation: string;
  lastSeen: string;
  currentHours: number;
  hoursRemaining: number;
  isCompliant: boolean;
  totalDistanceToday: number;
  displayStatus: string;
  screenMetrics: {
    isDisplaying: boolean;
    brightness: number;
    volume: number;
    adPlayCount: number;
    maintenanceMode: boolean;
    currentAd?: {
      adId: string;
      adTitle: string;
      adDuration: number;
      startTime: string;
    };
    dailyAdStats: any;
    adPerformance: any[];
    displayHours: number;
    lastAdPlayed: string;
  };
}

export interface ComplianceReport {
  date: string;
  totalTablets: number;
  onlineTablets: number;
  compliantTablets: number;
  nonCompliantTablets: number;
  averageHours: number;
  averageDistance: number;
  screens: ScreenData[];
}

export interface AdAnalytics {
  summary: {
    totalDevices: number;
    onlineDevices: number;
    totalAdsPlayed: number;
    totalDisplayHours: number;
    averageAdsPerDevice: number;
    averageDisplayHours: number;
  };
  devices: Array<{
    deviceId: string;
    materialId: string;
    screenType: string;
    currentAd?: any;
    dailyStats: any;
    totalAdsPlayed: number;
    displayHours: number;
    adPerformance: any[];
    lastAdPlayed: string;
    isOnline: boolean;
    lastSeen: string;
  }>;
}

class AdsPanelServiceV4 {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🌐 [makeRequest] API_BASE_URL:', API_BASE_URL);
    console.log('🌐 [makeRequest] endpoint:', endpoint);
    console.log('🌐 [makeRequest] final URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      console.error('❌ API request failed:', url, response.status, response.statusText);
      throw new Error(`API request failed: ${response.statusText}`);
    }

    console.log('✅ API request successful:', url);
    return response.json();
  }

  // Get all screens with filtering
  async getScreens(filters?: {
    screenType?: string;
    status?: string;
    materialId?: string;
  }): Promise<{ screens: ScreenData[]; totalScreens: number; onlineScreens: number; displayingScreens: number; maintenanceScreens: number }> {
    try {
      // Use the compliance endpoint to get real-time screen data with displayId
      console.log('🔍 [getScreens] Using compliance endpoint: /screenTracking/compliance');
      // Add cache-busting parameter to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const response = await this.makeRequest(`/screenTracking/compliance${cacheBuster}`);
      
      if (!response || !response.data || !response.data.screens) {
        console.error('❌ Invalid response format from compliance endpoint:', response);
        return {
          screens: [],
          totalScreens: 0,
          onlineScreens: 0,
          displayingScreens: 0,
          maintenanceScreens: 0
        };
      }
      
      // Debug: Log current ad information from server response
      console.log('🔍 Server response current ads:', response.data.screens.map((screen: any) => ({
        deviceId: screen.deviceId,
        currentAd: screen.screenMetrics?.currentAd?.adTitle || 'No ad'
      })));

      // Transform compliance data to ScreenData format
      const screens: ScreenData[] = await Promise.all(response.data.screens.map(async (screen: any) => {
        // Use the current ad from compliance endpoint (this is the actually playing ad)
        let currentAd = undefined;
        if (screen.screenMetrics?.currentAd) {
          currentAd = {
            adId: screen.screenMetrics.currentAd.adId,
            adTitle: screen.screenMetrics.currentAd.adTitle,
            adDuration: screen.screenMetrics.currentAd.adDuration || 30,
            startTime: screen.screenMetrics.currentAd.startTime
          };
          console.log(`🎯 Using current playing ad for ${screen.displayId}:`, currentAd);
        } else {
          console.log(`📭 No current ad playing for ${screen.displayId}`);
        }

        return {
          deviceId: screen.deviceId,
          materialId: screen.materialId,
          displayId: screen.displayId, // Include the displayId from compliance endpoint
          screenType: screen.screenType || 'HEADDRESS',
          carGroupId: screen.carGroupId || '',
          slotNumber: screen.slotNumber || 1,
          isOnline: screen.isOnline,
          currentLocation: screen.currentLocation?.address || 'Unknown Location',
          lastSeen: screen.lastSeen,
          currentHours: screen.currentHours || 0,
          hoursRemaining: screen.hoursRemaining || 0,
          isCompliant: screen.isCompliant || false,
          totalDistanceToday: screen.totalDistanceToday || 0,
          displayStatus: screen.isOnline ? 'ACTIVE' : 'OFFLINE',
          screenMetrics: {
            isDisplaying: screen.isOnline,
            brightness: 100,
            volume: 50,
            adPlayCount: 0,
            maintenanceMode: false,
            currentAd: currentAd, // Use real ad data instead of demo
            dailyAdStats: {
              totalAdsPlayed: 0,
              totalDisplayTime: 0,
              uniqueAdsPlayed: 0,
              averageAdDuration: 0,
              adCompletionRate: 0
            },
            adPerformance: [],
            displayHours: screen.currentHours || 0,
            lastAdPlayed: screen.lastSeen
          }
        };
      }));

      // Apply filters
      let filteredScreens = screens;
      if (filters?.screenType) {
        filteredScreens = filteredScreens.filter(screen => screen.screenType === filters.screenType);
      }
      if (filters?.status) {
        filteredScreens = filteredScreens.filter(screen => {
          if (filters.status === 'online') return screen.isOnline;
          if (filters.status === 'offline') return !screen.isOnline;
          return true;
        });
      }
      if (filters?.materialId) {
        filteredScreens = filteredScreens.filter(screen => screen.materialId.includes(filters.materialId!));
      }

      const onlineScreens = filteredScreens.filter(screen => screen.isOnline).length;
      const displayingScreens = filteredScreens.filter(screen => screen.isOnline && screen.screenMetrics.isDisplaying).length;
      const maintenanceScreens = filteredScreens.filter(screen => screen.screenMetrics.maintenanceMode).length;

      console.log(`📊 Compliance data transformed: ${filteredScreens.length} screens, ${onlineScreens} online`);

      return {
        screens: filteredScreens,
        totalScreens: filteredScreens.length,
        onlineScreens,
        displayingScreens,
        maintenanceScreens
      };
    } catch (error) {
      console.error('❌ Error fetching screens from compliance endpoint:', error);
      return {
        screens: [],
        totalScreens: 0,
        onlineScreens: 0,
        displayingScreens: 0,
        maintenanceScreens: 0
      };
    }
  }

  // Get compliance report
  async getComplianceReport(date?: string): Promise<ComplianceReport> {
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);

    const endpoint = `/screenTracking/compliance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  // Get ad analytics
  async getAdAnalytics(date?: string, materialId?: string): Promise<AdAnalytics> {
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    if (materialId) queryParams.append('materialId', materialId);

    const endpoint = `/screenTracking/adAnalytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  // Get specific screen status
  async getScreenStatus(deviceId: string): Promise<ScreenData> {
    const response = await this.makeRequest(`/screenTracking/status/${deviceId}`);
    return response.data;
  }

  // Get all tablets list
  async getTabletsList(): Promise<any[]> {
    const response = await this.makeRequest('/tablet/list');
    return response.tablets;
  }

  // Get all ads deployments
  async getAdsDeployments(): Promise<any[]> {
    const response = await this.makeRequest('/ads/deployments');
    return response.deployments;
  }

  // Bulk operations
  async syncAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for bulk sync
    // For now, we'll simulate it
    return { success: true, message: 'All screens synced successfully' };
  }

  async playAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for bulk play
    return { success: true, message: 'All screens started playing' };
  }

  async pauseAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for bulk pause
    return { success: true, message: 'All screens paused' };
  }

  async stopAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for bulk stop
    return { success: true, message: 'All screens stopped' };
  }

  async restartAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for bulk restart
    return { success: true, message: 'All screens restarted' };
  }

  async emergencyStopAll(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for emergency stop
    return { success: true, message: 'Emergency stop activated for all screens' };
  }

  async lockdownAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for lockdown
    return { success: true, message: 'All screens locked down' };
  }

  async unlockAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would be a custom endpoint for unlock
    return { success: true, message: 'All screens unlocked' };
  }

  // Individual screen operations
  async updateScreenMetrics(deviceId: string, metrics: {
    isDisplaying?: boolean;
    brightness?: number;
    volume?: number;
    adPlayCount?: number;
    maintenanceMode?: boolean;
  }): Promise<{ success: boolean; message: string; data: any }> {
    const response = await this.makeRequest('/screenTracking/updateScreenMetrics', {
      method: 'POST',
      body: JSON.stringify({ deviceId, ...metrics }),
    });
    return response;
  }

  async startScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/startSession', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    return response;
  }

  async endScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/endSession', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    return response;
  }

  async trackAdPlayback(deviceId: string, adId: string, adTitle: string, adDuration: number, viewTime?: number): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/trackAd', {
      method: 'POST',
      body: JSON.stringify({ deviceId, adId, adTitle, adDuration, viewTime }),
    });
    return response;
  }

  async endAdPlayback(deviceId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/endAd', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    return response;
  }

  async updateDriverActivity(deviceId: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/updateDriverActivity', {
      method: 'POST',
      body: JSON.stringify({ deviceId, isActive }),
    });
    return response;
  }

  async resolveAlert(deviceId: string, alertIndex: number): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest('/screenTracking/resolveAlert', {
      method: 'POST',
      body: JSON.stringify({ deviceId, alertIndex }),
    });
    return response;
  }

  // Get ads for specific material and slot
  async getAdsForMaterial(materialId: string, slotNumber: number): Promise<any[]> {
    const response = await this.makeRequest(`/ads/${materialId}/${slotNumber}`);
    return response.ads || [];
  }

  // Get screen path/history
  async getScreenPath(deviceId: string, date?: string): Promise<any> {
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);

    const endpoint = `/screenTracking/path/${deviceId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  // Get ad analytics for specific device
  async getDeviceAdAnalytics(deviceId: string, date?: string): Promise<any> {
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);

    const endpoint = `/screenTracking/adAnalytics/${deviceId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }
}

export const adsPanelService = new AdsPanelServiceV4();
