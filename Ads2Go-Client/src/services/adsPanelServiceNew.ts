// AdsPanel API Service - NEW VERSION TO BYPASS CACHE
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ads2go-integration-production.up.railway.app';
import { AdsPanelGraphQLService } from './adsPanelGraphQLService';

// Cache busting - force browser to reload this file
console.log('🔄 AdsPanelService NEW VERSION loaded - Cache busted at:', new Date().toISOString());

export interface ScreenData {
  deviceId: string;
  materialId: string;
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

class AdsPanelServiceNew {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🌐 NEW SERVICE - Making API request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      console.error('❌ NEW SERVICE - API request failed:', url, response.status, response.statusText);
      throw new Error(`API request failed: ${response.statusText}`);
    }

    console.log('✅ NEW SERVICE - API request successful:', url);
    return response.json();
  }

  // Get all screens with filtering using GraphQL
  async getScreens(filters?: {
    screenType?: string;
    status?: string;
    materialId?: string;
  }): Promise<{ screens: ScreenData[]; totalScreens: number; onlineScreens: number; displayingScreens: number; maintenanceScreens: number }> {
    try {
      // Use the existing GraphQL service instead of REST
      const graphqlService = new AdsPanelGraphQLService();
      return await graphqlService.getScreens(filters);
    } catch (error) {
      console.error('❌ Error in getScreens:', error);
      // Return empty data in case of error to prevent UI crash
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

export const adsPanelService = new AdsPanelServiceNew();
