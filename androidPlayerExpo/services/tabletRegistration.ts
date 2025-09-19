import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

export interface ConnectionDetails {
  materialId: string;
  slotNumber: number;
  carGroupId: string;
}

export interface TabletRegistration {
  deviceId: string;
  materialId: string;
  slotNumber: number;
  carGroupId: string;
  isRegistered: boolean;
  lastReportedAt: string;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  tabletInfo?: {
    deviceId: string;
    materialId: string;
    slotNumber: number;
    carGroupId: string;
    status: string;
    lastReportedAt: string;
  };
  adsList?: any[];
}

export interface ConnectionCheckResponse {
  success: boolean;
  message: string;
  isConnected: boolean;
  connectedDevice?: {
    deviceId: string;
    materialId: string;
    slotNumber: number;
    carGroupId: string;
    status: string;
    lastReportedAt: string;
  };
}

export interface Ad {
  adId: string;
  adDeploymentId: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  status: string;
  mediaFile: string;
  adTitle: string;
  adDescription: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdsResponse {
  success: boolean;
  ads: Ad[];
  message: string;
}

export interface LocationUpdate {
  deviceId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export interface TrackingStatus {
  deviceId: string;
  materialId: string;
  currentHours: number;
  hoursRemaining: number;
  isCompliant: boolean;
  totalDistanceToday: number;
  lastSeen: string;
}

// For device/emulator testing, use your computer's IP address
const API_BASE_URL = 'http://192.168.100.22:5000'; // Updated to match your local IP

export class TabletRegistrationService {
  private static instance: TabletRegistrationService;
  private registration: TabletRegistration | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private isTracking = false;
  private isSimulatingOffline = false;
  private appStateListener: any = null;

  static getInstance(): TabletRegistrationService {
    if (!TabletRegistrationService.instance) {
      TabletRegistrationService.instance = new TabletRegistrationService();
    }
    return TabletRegistrationService.instance;
  }

  // Helper method to convert ObjectId to expected materialId format
  private async convertObjectIdToMaterialId(objectId: string): Promise<string> {
    try {
      // Try to fetch the material details from the server to get the actual materialId
      const response = await fetch(`${API_BASE_URL}/material/${objectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.material && result.material.materialId) {
          console.log('Converted ObjectId to materialId:', objectId, '→', result.material.materialId);
          return result.material.materialId;
        }
      }
    } catch (error) {
      console.error('Error converting ObjectId to materialId:', error);
    }

    // If conversion fails, return the original ObjectId but log a warning
    console.warn('⚠️  Could not convert ObjectId to materialId format. Using ObjectId as fallback.');
    return objectId;
  }

  async generateDeviceId(): Promise<string> {
    const deviceId = Device.osInternalBuildId || Device.deviceName || 'unknown';
    return `TABLET-${deviceId}-${Date.now()}`;
  }

  async checkRegistrationStatus(): Promise<boolean> {
    try {
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        this.registration = JSON.parse(registrationData);
        return this.registration?.isRegistered || false;
      }
      return false;
    } catch (error) {
      console.error('Error checking registration status:', error);
      return false;
    }
  }

  async getRegistrationData(): Promise<TabletRegistration | null> {
    try {
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        this.registration = JSON.parse(registrationData);
        return this.registration;
      }
      
      // If no registration data found, try to create from environment variables
      const envMaterialId = process.env.EXPO_PUBLIC_MATERIAL_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_MATERIAL_ID || 'DGL-HEADDRESS-CAR-001';
      const envTabletId = process.env.EXPO_PUBLIC_TABLET_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_TABLET_ID || 'HEY2-W09';
      
      console.log('🔍 Environment variables in tabletRegistration:', {
        EXPO_PUBLIC_MATERIAL_ID: process.env.EXPO_PUBLIC_MATERIAL_ID,
        EXPO_PUBLIC_TABLET_ID: process.env.EXPO_PUBLIC_TABLET_ID,
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        ConstantsExtra: Constants.expoConfig?.extra,
        finalMaterialId: envMaterialId,
        finalTabletId: envTabletId
      });
      
      if (envMaterialId && envTabletId) {
        console.log('No registration data found, attempting to get tablet configuration from server');
        
        try {
          // Try to get the tablet configuration from the server first
          const response = await fetch(`${API_BASE_URL}/tablet/configuration/${envMaterialId}`);
          if (response.ok) {
            const config = await response.json();
            if (config.success && config.tablet) {
              console.log('Found tablet configuration on server:', config.tablet);
              const fallbackRegistration: TabletRegistration = {
                deviceId: envTabletId,
                materialId: envMaterialId,
                slotNumber: 1, // Default slot number
                carGroupId: config.tablet.carGroupId,
                isRegistered: true,
                lastReportedAt: new Date().toISOString()
              };
              
              // Save the fallback registration
              await AsyncStorage.setItem('tabletRegistration', JSON.stringify(fallbackRegistration));
              this.registration = fallbackRegistration;
              return fallbackRegistration;
            }
          }
        } catch (error) {
          console.error('Error getting tablet configuration from server:', error);
        }
        
        console.warn('Could not get tablet configuration from server, skipping fallback registration');
      } else {
        console.warn('Environment variables not available:', { envMaterialId, envTabletId });
      }
      
      return null;
    } catch (error) {
      console.error('Error getting registration data:', error);
      return null;
    }
  }

  async registerTablet(connectionDetails: ConnectionDetails): Promise<RegistrationResponse> {
    try {
      const deviceId = await this.generateDeviceId();
      
      const requestBody = {
        deviceId,
        materialId: connectionDetails.materialId,
        slotNumber: connectionDetails.slotNumber,
        carGroupId: connectionDetails.carGroupId
      };

      console.log('Registering tablet with:', requestBody);

      const response = await fetch(`${API_BASE_URL}/tablet/registerTablet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: RegistrationResponse = await response.json();

      if (result.success && result.tabletInfo) {
        // Save registration data locally
        const registration: TabletRegistration = {
          deviceId: result.tabletInfo.deviceId,
          materialId: result.tabletInfo.materialId,
          slotNumber: result.tabletInfo.slotNumber,
          carGroupId: result.tabletInfo.carGroupId,
          isRegistered: true,
          lastReportedAt: result.tabletInfo.lastReportedAt || new Date().toISOString()
        };

        await AsyncStorage.setItem('tabletRegistration', JSON.stringify(registration));
        this.registration = registration;
      }

      return result;
    } catch (error) {
      console.error('Error registering tablet:', error);
      return {
        success: false,
        message: 'Network error: Unable to connect to server'
      };
    }
  }

  async updateTabletStatus(isOnline: boolean, gps?: { lat: number; lng: number }): Promise<boolean> {
    try {
      if (!this.registration) {
        console.error('No registration data available');
        return false;
      }

      const requestBody = {
        deviceId: this.registration.deviceId,
        isOnline,
        gps,
        lastReportedAt: new Date().toISOString()
      };

      console.log('Updating tablet status:', requestBody);

      const response = await fetch(`${API_BASE_URL}/tablet/updateTabletStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Tablet status updated successfully');
        
        // If GPS data is provided, also update location tracking
        if (gps) {
          await this.updateLocationTracking(gps.lat, gps.lng);
        }
        
        return true;
      } else {
        console.error('Failed to update tablet status:', result.message);
        
        // If tablet not found, try to re-register
        if (result.message === 'Tablet not found') {
          console.log('Tablet not found, attempting to re-register...');
          const reRegisterResult = await this.registerTablet({
            materialId: this.registration.materialId,
            slotNumber: this.registration.slotNumber,
            carGroupId: this.registration.carGroupId
          });
          
          if (reRegisterResult.success) {
            console.log('Tablet re-registered successfully, retrying status update...');
            // Retry the status update
            return await this.updateTabletStatus(isOnline, gps);
          } else {
            console.error('Failed to re-register tablet:', reRegisterResult.message);
          }
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error updating tablet status:', error);
      return false;
    }
  }

  async updateLocationTracking(lat: number, lng: number, speed: number = 0, heading: number = 0, accuracy: number = 0): Promise<boolean> {
    try {
      if (!this.registration) {
        console.error('No registration data available for location tracking');
        return false;
      }

      const locationUpdate: LocationUpdate = {
        deviceId: this.registration.deviceId,
        lat,
        lng,
        speed,
        heading,
        accuracy
      };

      console.log('Updating location tracking:', locationUpdate);
      console.log('API URL:', `${API_BASE_URL}/screenTracking/updateLocation`);

      const response = await fetch(`${API_BASE_URL}/screenTracking/updateLocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationUpdate),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error:', response.status, errorText);
        return false;
      }

      const result = await response.json();
      console.log('Response result:', result);

      if (result.success) {
        console.log('Location tracking updated successfully');
        return true;
      } else {
        console.error('Failed to update location tracking:', result.message);
        
        // If ScreenTracking record not found, try to create it
        if (result.message && result.message.includes('Screen tracking record not found')) {
          console.log('ScreenTracking record not found, attempting to create one...');
          return await this.createScreenTrackingRecord();
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error updating location tracking:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      return false;
    }
  }

  async getTrackingStatus(): Promise<TrackingStatus | null> {
    try {
      if (!this.registration) {
        console.error('No registration data available');
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/screenTracking/status/${this.registration.deviceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        console.error('Failed to get tracking status:', result.message);
        return null;
      }
    } catch (error) {
      console.error('Error getting tracking status:', error);
      return null;
    }
  }

  async startLocationTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('Location tracking already started');
      return;
    }

    // Setup app state change listener if not already set
    if (!this.appStateListener) {
      this.appStateListener = AppState.addEventListener('change', async (nextAppState) => {
        console.log('App state changed to:', nextAppState);
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          console.log('App is going to background, stopping location tracking');
          await this.stopLocationTracking();
          
          // Update server that we're going offline
          if (this.registration) {
            await this.updateTabletStatus(false);
          }
        } else if (nextAppState === 'active') {
          console.log('App is active, restarting location tracking if needed');
          if (this.registration) {
            await this.updateTabletStatus(true);
            await this.startLocationTracking();
          }
        }
      });
    }

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return;
      }

      // Check if backend server is accessible
      const serverAccessible = await this.checkServerAccessibility();
      if (!serverAccessible) {
        console.error('Backend server is not accessible. Please check server status.');
        return;
      }

      this.isTracking = true;

      // Start periodic location updates (every 30 seconds)
      this.locationUpdateInterval = setInterval(async () => {
        try {
          // Skip location updates if simulating offline
          if (this.isSimulatingOffline) {
            console.log('Skipping location update - simulating offline');
            return;
          }

          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 30000,
            distanceInterval: 10, // Update every 10 meters
          });

          const { latitude, longitude, speed, heading, accuracy } = location.coords;

          // Update both tablet status and location tracking
          await this.updateTabletStatus(true, { lat: latitude, lng: longitude });
          await this.updateLocationTracking(
            latitude, 
            longitude, 
            speed || 0, 
            heading || 0, 
            accuracy || 0
          );

          console.log('Location updated:', { latitude, longitude, speed, heading, accuracy });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }, 30000); // Update every 30 seconds

      console.log('Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.isTracking = false;
    }
  }

  async stopLocationTracking(): Promise<void> {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }
    
    this.isTracking = false;
    console.log('Location tracking stopped');
    
    // Update server that we're no longer tracking
    if (this.registration) {
      try {
        await this.updateTabletStatus(false);
      } catch (error) {
        console.error('Error updating tablet status to offline:', error);
      }
    }
  }

  setSimulatingOffline(isOffline: boolean): void {
    this.isSimulatingOffline = isOffline;
    console.log(`Simulating offline: ${isOffline}`);
  }

  isSimulatingOfflineMode(): boolean {
    return this.isSimulatingOffline;
  }

  isLocationTrackingActive(): boolean {
    return this.isTracking;
  }

  getLocalTrackingStatus(): { isActive: boolean; interval: number | null } {
    return {
      isActive: this.isTracking,
      interval: this.locationUpdateInterval
    };
  }

  async createScreenTrackingRecord(): Promise<boolean> {
    try {
      if (!this.registration) {
        console.error('No registration data available to create ScreenTracking record');
        return false;
      }

      console.log('Creating ScreenTracking record for device:', this.registration.deviceId);

      // First, try to update tablet status which should create the ScreenTracking record
      const success = await this.updateTabletStatus(true, {
        lat: 0, // Will be updated with actual location
        lng: 0
      });

      if (success) {
        console.log('ScreenTracking record created successfully via tablet status update');
        return true;
      } else {
        console.error('Failed to create ScreenTracking record via tablet status update');
        return false;
      }
    } catch (error) {
      console.error('Error creating ScreenTracking record:', error);
      return false;
    }
  }

  async checkServerAccessibility(): Promise<boolean> {
    try {
      console.log('Checking server accessibility at:', API_BASE_URL);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${API_BASE_URL}/tablet/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('Server is accessible');
        return true;
      } else {
        console.error('Server responded with status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Server accessibility check failed:', error);
      console.error('Please ensure:');
      console.error('1. Backend server is running (npm start in Ads2Go-Server)');
      console.error('2. Server URL is correct:', API_BASE_URL);
      console.error('3. Network connectivity is available');
      return false;
    }
  }

  async clearRegistration(): Promise<void> {
    console.log('Clearing registration data...');
    
    // Stop any active tracking
    await this.stopLocationTracking();
    
    // Remove app state listener
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    
    // Clear registration data
    this.registration = null;
    
    try {
      await AsyncStorage.removeItem('tabletRegistration');
      console.log('Registration data cleared from AsyncStorage');
    } catch (error) {
      console.error('Error clearing registration from AsyncStorage:', error);
    }
    
    // Also clear any cached data
    try {
      await AsyncStorage.multiRemove(['tabletRegistration', 'device_material_id']);
      console.log('All registration-related data cleared');
    } catch (error) {
      console.error('Error clearing all registration data:', error);
    }
  }

  async clearMaterialId(): Promise<void> {
    try {
      // Clear material ID from SecureStore
      await SecureStore.deleteItemAsync('device_material_id');
      console.log('Material ID cleared from SecureStore');
    } catch (error) {
      console.error('Error clearing material ID from SecureStore:', error);
    }
  }

  async unregisterTablet(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.registration) {
        return {
          success: false,
          message: 'No registration found to unregister'
        };
      }

      const requestBody = {
        deviceId: this.registration.deviceId,
        materialId: this.registration.materialId,
        slotNumber: this.registration.slotNumber,
        carGroupId: this.registration.carGroupId
      };

      console.log('Unregistering tablet with:', requestBody);

      const response = await fetch(`${API_BASE_URL}/tablet/unregisterTablet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        // Clear local registration data
        await AsyncStorage.removeItem('tabletRegistration');
        this.registration = null;
      }

      return result;
    } catch (error) {
      console.error('Error unregistering tablet:', error);
      return {
        success: false,
        message: 'Network error: Unable to connect to server'
      };
    }
  }

  async forceUnregisterTablet(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.registration) {
        return {
          success: false,
          message: 'No registration found to unregister'
        };
      }

      // Clear local registration data even if server is not available
      await AsyncStorage.removeItem('tabletRegistration');
      this.registration = null;

      return {
        success: true,
        message: 'Tablet unregistered locally (server may not be updated)'
      };
    } catch (error) {
      console.error('Error force unregistering tablet:', error);
      return {
        success: false,
        message: 'Failed to unregister tablet locally'
      };
    }
  }

  async checkExistingConnection(materialId: string, slotNumber: number): Promise<ConnectionCheckResponse> {
    try {
      const requestBody = {
        materialId,
        slotNumber
      };

      console.log('Checking existing connection for:', requestBody);

      const response = await fetch(`${API_BASE_URL}/tablet/checkExistingConnection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: ConnectionCheckResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking existing connection:', error);
      return {
        success: false,
        message: 'Network error: Unable to connect to server',
        isConnected: false
      };
    }
  }

  async fetchAds(materialId: string, slotNumber: number): Promise<AdsResponse> {
    try {
      console.log('Fetching ads for:', { materialId, slotNumber });

      // Check if materialId looks like an ObjectId (24 character hex string)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(materialId);
      
      let finalMaterialId = materialId;
      
      if (isObjectId) {
        console.log('⚠️  Warning: materialId appears to be an ObjectId format, attempting conversion');
        console.log('   Expected format: "DGL-HEADDRESS-CAR-001"');
        console.log('   Current format: "' + materialId + '"');
        
        // Try to convert ObjectId to proper materialId format
        finalMaterialId = await this.convertObjectIdToMaterialId(materialId);
      }

      const response = await fetch(`${API_BASE_URL}/ads/${finalMaterialId}/${slotNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: AdsResponse = await response.json();
      
      if (result.success) {
        console.log('Fetched ads:', result.ads.length);
      } else {
        console.error('Failed to fetch ads:', result.message);
      }

      return result;
    } catch (error) {
      console.error('Error fetching ads:', error);
      return {
        success: false,
        ads: [],
        message: 'Network error: Unable to fetch ads'
      };
    }
  }

  // Track ad playback
  async trackAdPlayback(adId: string, adTitle: string, adDuration: number, viewTime: number = 0): Promise<boolean> {
    try {
      const registrationData = await this.getRegistrationData();
      if (!registrationData) {
        console.error('No registration data found');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/screenTracking/trackAd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: registrationData.deviceId,
          adId,
          adTitle,
          adDuration,
          viewTime
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Ad playback tracked successfully:', result);
        return true;
      } else {
        console.error('Failed to track ad playback:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error tracking ad playback:', error);
      return false;
    }
  }

  // End ad playback
  async endAdPlayback(): Promise<boolean> {
    try {
      const registrationData = await this.getRegistrationData();
      if (!registrationData) {
        console.error('No registration data found');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/screenTracking/endAd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: registrationData.deviceId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Ad playback ended successfully:', result);
        return true;
      } else {
        console.error('Failed to end ad playback:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error ending ad playback:', error);
      return false;
    }
  }

  // Update driver activity
  async updateDriverActivity(isActive: boolean = true): Promise<boolean> {
    try {
      const registrationData = await this.getRegistrationData();
      if (!registrationData) {
        console.error('No registration data found');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/screenTracking/updateDriverActivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: registrationData.deviceId,
          isActive
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Driver activity updated successfully:', result);
        return true;
      } else {
        console.error('Failed to update driver activity:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error updating driver activity:', error);
      return false;
    }
  }
}

export default TabletRegistrationService.getInstance();
