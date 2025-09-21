// AdsPanel GraphQL Service - Using Apollo Client for GraphQL operations
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { 
  GET_ALL_SCREENS,
  GET_SCREEN_STATUS,
  GET_COMPLIANCE_REPORT,
  GET_AD_ANALYTICS,
  GET_TABLETS_LIST,
  GET_ADS_DEPLOYMENTS,
  GET_ADS_FOR_MATERIAL,
  GET_SCREEN_PATH,
  GET_DEVICE_AD_ANALYTICS,
  SYNC_ALL_SCREENS,
  PLAY_ALL_SCREENS,
  PAUSE_ALL_SCREENS,
  STOP_ALL_SCREENS,
  RESTART_ALL_SCREENS,
  EMERGENCY_STOP_ALL,
  LOCKDOWN_ALL_SCREENS,
  UNLOCK_ALL_SCREENS,
  UPDATE_SCREEN_METRICS,
  START_SCREEN_SESSION,
  END_SCREEN_SESSION,
  TRACK_AD_PLAYBACK,
  END_AD_PLAYBACK,
  UPDATE_DRIVER_ACTIVITY,
  RESOLVE_ALERT,
  DEPLOY_AD_TO_SCREENS,
  UPDATE_SCREEN_BRIGHTNESS,
  UPDATE_SCREEN_VOLUME,
  SET_MAINTENANCE_MODE,
  PLAY_SCREEN,
  PAUSE_SCREEN,
  STOP_SCREEN,
  RESTART_SCREEN,
  SKIP_TO_NEXT_AD
} from '../graphql/admin';

// Cache busting - force browser to reload this file
console.log('🔄 AdsPanelGraphQLService loaded - Cache busted at:', new Date().toISOString());

export interface LocationData {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  accuracy: number;
  address: string;
}

export interface DailyAdStats {
  totalAdsPlayed: number;
  totalDisplayTime: number;
  uniqueAdsPlayed: number;
  averageAdDuration: number;
  adCompletionRate: number;
}

export interface ScreenData {
  deviceId: string;
  materialId: string;
  screenType: string;
  carGroupId: string;
  slotNumber: number;
  isOnline: boolean;
  currentLocation: LocationData | null;
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
    dailyAdStats: DailyAdStats;
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
    dailyStats: DailyAdStats;
    totalAdsPlayed: number;
    displayHours: number;
    adPerformance: any[];
    lastAdPlayed: string;
    isOnline: boolean;
    lastSeen: string;
  }>;
}

export interface ScreenFiltersInput {
  screenType?: string;
  status?: string;
  materialId?: string;
}

export interface ScheduleInput {
  startTime?: string;
  endTime?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

class AdsPanelGraphQLService {
  private client: ApolloClient<any>;

  constructor() {
    // Create HTTP link
    const httpLink = createHttpLink({
      uri: process.env.REACT_APP_GRAPHQL_URL || 'http://localhost:5000/graphql',
    });

    // Create auth link that adds the token to every request
    const authLink = setContext((_, { headers }) => {
      // Get the authentication token from local storage
      const adminToken = localStorage.getItem('adminToken');
      const userToken = localStorage.getItem('token');
      const token = adminToken || userToken;
      
      // Debug token retrieval
      console.log('🔍 Apollo Client Auth Debug:');
      console.log('  - adminToken:', adminToken ? `Found (${adminToken.substring(0, 20)}...)` : 'Not found');
      console.log('  - userToken:', userToken ? `Found (${userToken.substring(0, 20)}...)` : 'Not found');
      console.log('  - selected token:', token ? `Found (${token.substring(0, 20)}...)` : 'Not found');
      console.log('  - Authorization header:', token ? `Bearer ${token.substring(0, 20)}...` : 'None');
      
      // Return the headers to the context so httpLink can read them
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : "",
        }
      }
    });

    this.client = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache(),
    });
  }

  // ===== QUERY METHODS =====

  // Get all screens with filtering
  async getScreens(filters?: ScreenFiltersInput): Promise<{ 
    screens: ScreenData[]; 
    totalScreens: number; 
    onlineScreens: number; 
    displayingScreens: number; 
    maintenanceScreens: number 
  }> {
    try {
      console.log('📡 GraphQL - Fetching screens with filters:', filters);
      
      const { data } = await this.client.query({
        query: GET_ALL_SCREENS,
        variables: { filters },
        fetchPolicy: 'network-only', // Always fetch fresh data
      });

      console.log('📡 GraphQL - Screens response:', data);
      
      return {
        screens: data.getAllScreens.screens || [],
        totalScreens: data.getAllScreens.totalScreens || 0,
        onlineScreens: data.getAllScreens.onlineScreens || 0,
        displayingScreens: data.getAllScreens.displayingScreens || 0,
        maintenanceScreens: data.getAllScreens.maintenanceScreens || 0
      };
    } catch (error) {
      console.error('❌ GraphQL Error in getScreens:', error);
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
    try {
      const { data } = await this.client.query({
        query: GET_COMPLIANCE_REPORT,
        variables: { date },
        fetchPolicy: 'network-only',
      });
      return data.getComplianceReport;
    } catch (error) {
      console.error('❌ GraphQL Error in getComplianceReport:', error);
      throw error;
    }
  }

  // Get ad analytics
  async getAdAnalytics(date?: string, materialId?: string): Promise<AdAnalytics> {
    try {
      const { data } = await this.client.query({
        query: GET_AD_ANALYTICS,
        variables: { date, materialId },
        fetchPolicy: 'network-only',
      });
      return data.getAdAnalytics;
    } catch (error) {
      console.error('❌ GraphQL Error in getAdAnalytics:', error);
      throw error;
    }
  }

  // Get specific screen status
  async getScreenStatus(deviceId: string): Promise<ScreenData> {
    try {
      const { data } = await this.client.query({
        query: GET_SCREEN_STATUS,
        variables: { deviceId },
        fetchPolicy: 'network-only',
      });
      return data.getScreenStatus;
    } catch (error) {
      console.error('❌ GraphQL Error in getScreenStatus:', error);
      throw error;
    }
  }

  // Get all tablets list
  async getTabletsList(): Promise<any[]> {
    try {
      const { data } = await this.client.query({
        query: GET_TABLETS_LIST,
        fetchPolicy: 'network-only',
      });
      return data.getTabletsList || [];
    } catch (error) {
      console.error('❌ GraphQL Error in getTabletsList:', error);
      return [];
    }
  }

  // Get all ads deployments
  async getAdsDeployments(): Promise<any[]> {
    try {
      const { data } = await this.client.query({
        query: GET_ADS_DEPLOYMENTS,
        fetchPolicy: 'network-only',
      });
      return data.getAdsDeployments || [];
    } catch (error) {
      console.error('❌ GraphQL Error in getAdsDeployments:', error);
      return [];
    }
  }

  // Get ads for specific material and slot
  async getAdsForMaterial(materialId: string, slotNumber: number): Promise<any[]> {
    try {
      const { data } = await this.client.query({
        query: GET_ADS_FOR_MATERIAL,
        variables: { materialId, slotNumber },
        fetchPolicy: 'network-only',
      });
      return data.getAdsForMaterial || [];
    } catch (error) {
      console.error('❌ GraphQL Error in getAdsForMaterial:', error);
      return [];
    }
  }

  // Get screen path/history
  async getScreenPath(deviceId: string, date?: string): Promise<any> {
    try {
      const { data } = await this.client.query({
        query: GET_SCREEN_PATH,
        variables: { deviceId, date },
        fetchPolicy: 'network-only',
      });
      return data.getScreenPath;
    } catch (error) {
      console.error('❌ GraphQL Error in getScreenPath:', error);
      throw error;
    }
  }

  // Get ad analytics for specific device
  async getDeviceAdAnalytics(deviceId: string, date?: string): Promise<any> {
    try {
      const { data } = await this.client.query({
        query: GET_DEVICE_AD_ANALYTICS,
        variables: { deviceId, date },
        fetchPolicy: 'network-only',
      });
      return data.getDeviceAdAnalytics;
    } catch (error) {
      console.error('❌ GraphQL Error in getDeviceAdAnalytics:', error);
      throw error;
    }
  }

  // ===== MUTATION METHODS =====

  // Bulk operations
  async syncAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: SYNC_ALL_SCREENS,
      });
      return data.syncAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in syncAllScreens:', error);
      throw error;
    }
  }

  async playAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PLAY_ALL_SCREENS,
      });
      return data.playAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in playAllScreens:', error);
      throw error;
    }
  }

  async pauseAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PAUSE_ALL_SCREENS,
      });
      return data.pauseAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in pauseAllScreens:', error);
      throw error;
    }
  }

  async stopAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: STOP_ALL_SCREENS,
      });
      return data.stopAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in stopAllScreens:', error);
      throw error;
    }
  }

  async restartAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: RESTART_ALL_SCREENS,
      });
      return data.restartAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in restartAllScreens:', error);
      throw error;
    }
  }

  async emergencyStopAll(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: EMERGENCY_STOP_ALL,
      });
      return data.emergencyStopAll;
    } catch (error) {
      console.error('❌ GraphQL Error in emergencyStopAll:', error);
      throw error;
    }
  }

  async lockdownAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: LOCKDOWN_ALL_SCREENS,
      });
      return data.lockdownAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in lockdownAllScreens:', error);
      throw error;
    }
  }

  async unlockAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UNLOCK_ALL_SCREENS,
      });
      return data.unlockAllScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in unlockAllScreens:', error);
      throw error;
    }
  }

  // Individual screen operations
  async updateScreenMetrics(deviceId: string, metrics: {
    isDisplaying?: boolean;
    brightness?: number;
    volume?: number;
    adPlayCount?: number;
    maintenanceMode?: boolean;
  }): Promise<{ success: boolean; message: string; data: any }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UPDATE_SCREEN_METRICS,
        variables: { deviceId, metrics },
      });
      return data.updateScreenMetrics;
    } catch (error) {
      console.error('❌ GraphQL Error in updateScreenMetrics:', error);
      throw error;
    }
  }

  async startScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: START_SCREEN_SESSION,
        variables: { deviceId },
      });
      return data.startScreenSession;
    } catch (error) {
      console.error('❌ GraphQL Error in startScreenSession:', error);
      throw error;
    }
  }

  async endScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: END_SCREEN_SESSION,
        variables: { deviceId },
      });
      return data.endScreenSession;
    } catch (error) {
      console.error('❌ GraphQL Error in endScreenSession:', error);
      throw error;
    }
  }

  async trackAdPlayback(deviceId: string, adId: string, adTitle: string, adDuration: number, viewTime?: number): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: TRACK_AD_PLAYBACK,
        variables: { deviceId, adId, adTitle, adDuration, viewTime },
      });
      return data.trackAdPlayback;
    } catch (error) {
      console.error('❌ GraphQL Error in trackAdPlayback:', error);
      throw error;
    }
  }

  async endAdPlayback(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: END_AD_PLAYBACK,
        variables: { deviceId },
      });
      return data.endAdPlayback;
    } catch (error) {
      console.error('❌ GraphQL Error in endAdPlayback:', error);
      throw error;
    }
  }

  async updateDriverActivity(deviceId: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UPDATE_DRIVER_ACTIVITY,
        variables: { deviceId, isActive },
      });
      return data.updateDriverActivity;
    } catch (error) {
      console.error('❌ GraphQL Error in updateDriverActivity:', error);
      throw error;
    }
  }

  async resolveAlert(deviceId: string, alertIndex: number): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: RESOLVE_ALERT,
        variables: { deviceId, alertIndex },
      });
      return data.resolveAlert;
    } catch (error) {
      console.error('❌ GraphQL Error in resolveAlert:', error);
      throw error;
    }
  }

  // Additional screen control methods
  async playScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PLAY_SCREEN,
        variables: { deviceId },
      });
      return data.playScreen;
    } catch (error) {
      console.error('❌ GraphQL Error in playScreen:', error);
      throw error;
    }
  }

  async pauseScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PAUSE_SCREEN,
        variables: { deviceId },
      });
      return data.pauseScreen;
    } catch (error) {
      console.error('❌ GraphQL Error in pauseScreen:', error);
      throw error;
    }
  }

  async stopScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: STOP_SCREEN,
        variables: { deviceId },
      });
      return data.stopScreen;
    } catch (error) {
      console.error('❌ GraphQL Error in stopScreen:', error);
      throw error;
    }
  }

  async restartScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: RESTART_SCREEN,
        variables: { deviceId },
      });
      return data.restartScreen;
    } catch (error) {
      console.error('❌ GraphQL Error in restartScreen:', error);
      throw error;
    }
  }

  async skipToNextAd(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: SKIP_TO_NEXT_AD,
        variables: { deviceId },
      });
      return data.skipToNextAd;
    } catch (error) {
      console.error('❌ GraphQL Error in skipToNextAd:', error);
      throw error;
    }
  }

  async updateScreenBrightness(deviceId: string, brightness: number): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UPDATE_SCREEN_BRIGHTNESS,
        variables: { deviceId, brightness },
      });
      return data.updateScreenBrightness;
    } catch (error) {
      console.error('❌ GraphQL Error in updateScreenBrightness:', error);
      throw error;
    }
  }

  async updateScreenVolume(deviceId: string, volume: number): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UPDATE_SCREEN_VOLUME,
        variables: { deviceId, volume },
      });
      return data.updateScreenVolume;
    } catch (error) {
      console.error('❌ GraphQL Error in updateScreenVolume:', error);
      throw error;
    }
  }

  async setMaintenanceMode(deviceId: string, enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: SET_MAINTENANCE_MODE,
        variables: { deviceId, enabled },
      });
      return data.setMaintenanceMode;
    } catch (error) {
      console.error('❌ GraphQL Error in setMaintenanceMode:', error);
      throw error;
    }
  }

  async deployAdToScreens(adId: string, targetScreens: string[], schedule?: ScheduleInput): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: DEPLOY_AD_TO_SCREENS,
        variables: { adId, targetScreens, schedule },
      });
      return data.deployAdToScreens;
    } catch (error) {
      console.error('❌ GraphQL Error in deployAdToScreens:', error);
      throw error;
    }
  }
}

export const adsPanelGraphQLService = new AdsPanelGraphQLService();
