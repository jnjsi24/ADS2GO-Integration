import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import playbackWebSocketService from './playbackWebSocketService';
import offlineQueueService from './offlineQueueService';
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
  website?: string; // Optional advertiser website
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
  speedLimit?: number;
  violation?: SpeedViolation;
}

export interface SpeedViolation {
  type: 'SPEED_VIOLATION';
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  penalty: number;
  currentSpeed: number;
  speedLimit: number;
  speedOverLimit: number;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
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

// Get API base URL with environment variable support and platform detection
const getAPIBaseURL = () => {
  // Check environment variables first
  const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Use environment variables for IP and port
  const serverIp = process.env.EXPO_PUBLIC_SERVER_IP;
  const serverPort = process.env.EXPO_PUBLIC_SERVER_PORT;
  
  if (!envUrl && (!serverIp || !serverPort)) {
    console.error('❌ Missing required environment variables:');
    console.error('   EXPO_PUBLIC_API_URL:', envUrl);
    console.error('   EXPO_PUBLIC_SERVER_IP:', serverIp);
    console.error('   EXPO_PUBLIC_SERVER_PORT:', serverPort);
    console.error('   Please check your .env file');
    throw new Error('Missing required environment variables for API configuration');
  }
  
  const serverUrl = serverIp && serverPort ? `http://${serverIp}:${serverPort}` : null;

  // Platform-specific defaults
  if (typeof navigator !== 'undefined') {
    // Browser environment
    return serverUrl;
  }

  // Default fallback
  return serverUrl;
};

const API_BASE_URL = getAPIBaseURL();

export class TabletRegistrationService {
  private static instance: TabletRegistrationService;
  private registration: TabletRegistration | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private isTracking = false;
  private isSimulatingOffline = false;
  private appStateListener: any = null;
  
  // Speed violation tracking
  private currentSpeedLimit: number = 50; // Default urban speed limit
  private violationThresholds = {
    grace: 5,      // 5 km/h tolerance
    low: 10,      // 6-10 km/h over
    medium: 20,    // 11-20 km/h over
    high: 30,      // 21-30 km/h over
    extreme: 50   // 31+ km/h over
  };

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
    // Use a consistent device identifier that doesn't change between app restarts
    const baseDeviceId = Device.osInternalBuildId || Device.deviceName || 'unknown';
    // Remove any existing TABLET prefix to avoid duplication
    const cleanDeviceId = baseDeviceId.replace(/^TABLET-/, '');
    return `TABLET-${cleanDeviceId}-${Date.now()}`;
  }

  async migrateDeviceIdIfNeeded(): Promise<void> {
    try {
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        const registration = JSON.parse(registrationData);
        
        // Check if device ID is in old short format
        if (registration.deviceId && !registration.deviceId.startsWith('TABLET-')) {
          console.log('Migrating device ID from old format:', registration.deviceId);
          
          // Convert to new format
          const newDeviceId = `TABLET-${registration.deviceId}-${Date.now()}`;
          registration.deviceId = newDeviceId;
          
          // Save updated registration
          await AsyncStorage.setItem('tabletRegistration', JSON.stringify(registration));
          this.registration = registration;
          
          console.log('Device ID migrated to new format:', newDeviceId);
        }
      }
    } catch (error) {
      console.error('Error migrating device ID:', error);
    }
  }

  async checkRegistrationStatus(): Promise<boolean> {
    try {
      // First check if registration was explicitly cleared
      const wasCleared = await AsyncStorage.getItem('registration_cleared');
      console.log('🔍 Checking registration cleared flag in checkRegistrationStatus:', wasCleared);
      
      // Get current material ID
      let materialId = await SecureStore.getItemAsync('device_material_id') || 
                      process.env.EXPO_PUBLIC_MATERIAL_ID || 
                      Constants.expoConfig?.extra?.EXPO_PUBLIC_MATERIAL_ID;
      
      // Check for material ID mismatch and correct it
      if (materialId === 'DGL-HEADDRESS-CAR-001') {
        console.log('⚠️  Material ID mismatch detected, trying correct material ID from database');
        materialId = 'DGL-HEADDRESS-CAR-005';
        
        // Update SecureStore with correct material ID
        await SecureStore.setItemAsync('device_material_id', materialId);
        console.log('✅ Updated material ID in SecureStore to:', materialId);
      }
      
      // If registration was cleared, try to verify if tablet is actually registered in database
      if (wasCleared) {
        console.log('Registration was explicitly cleared, checking database for existing registration...');
        
        if (materialId) {
          console.log('Found material ID, checking database for existing registration:', materialId);
          
          try {
            // Check if tablet is registered in database
            const response = await fetch(`${API_BASE_URL}/tablet/configuration/${materialId}`);
            if (response.ok) {
              const config = await response.json();
              if (config.success && config.tablet && config.tablet.tablets && config.tablet.tablets.length > 0) {
                console.log('✅ Found existing registration in database, clearing cleared flag');
                
                // Clear the cleared flag since we found a valid registration
                await AsyncStorage.removeItem('registration_cleared');
                
                // Create registration data from database
                const tabletUnit = config.tablet.tablets[0]; // Use first tablet
                console.log('Database tablet unit:', tabletUnit);
                
                // Try to find the correct tablet unit by matching device ID or use the first one
                let selectedTablet = tabletUnit;
                if (config.tablet.tablets.length > 1) {
                  // Look for a tablet with a valid device ID
                  const tabletWithDeviceId = config.tablet.tablets.find(t => t.deviceId && t.deviceId !== 'undefined');
                  if (tabletWithDeviceId) {
                    selectedTablet = tabletWithDeviceId;
                    console.log('Found tablet with device ID:', selectedTablet);
                  }
                }
                
                const registration: TabletRegistration = {
                  deviceId: selectedTablet.deviceId || `TABLET-${selectedTablet.tabletNumber || 1}-${Date.now()}`,
                  materialId: config.tablet.materialId,
                  slotNumber: selectedTablet.tabletNumber || 1,
                  carGroupId: config.tablet.carGroupId,
                  isRegistered: true,
                  lastReportedAt: selectedTablet.gps?.lastSeen || new Date().toISOString()
                };
                
                // Save the registration data
                await AsyncStorage.setItem('tabletRegistration', JSON.stringify(registration));
                this.registration = registration;
                
                console.log('✅ Restored registration from database:', registration);
                return true;
              }
            }
          } catch (error) {
            console.error('Error checking database for existing registration:', error);
          }
        }
        
        console.log('Registration was explicitly cleared and no valid database registration found, returning false');
        return false;
      }
      
      // Check if we have existing registration data but need to sync with database
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        this.registration = JSON.parse(registrationData);
        console.log('🔍 Found registration data, isRegistered:', this.registration?.isRegistered);
        
        // If we have registration data but device ID is undefined, try to sync from database
        if (this.registration?.isRegistered && (!this.registration.deviceId || this.registration.deviceId === 'undefined')) {
          console.log('🔄 Registration data found but device ID is missing, syncing from database...');
          
          if (materialId) {
            try {
              const response = await fetch(`${API_BASE_URL}/tablet/configuration/${materialId}`);
              if (response.ok) {
                const config = await response.json();
                if (config.success && config.tablet && config.tablet.tablets && config.tablet.tablets.length > 0) {
                  console.log('✅ Found tablet configuration in database, updating registration...');
                  
                  // Find the correct tablet unit
                  let selectedTablet = config.tablet.tablets[0];
                  if (config.tablet.tablets.length > 1) {
                    const tabletWithDeviceId = config.tablet.tablets.find(t => t.deviceId && t.deviceId !== 'undefined');
                    if (tabletWithDeviceId) {
                      selectedTablet = tabletWithDeviceId;
                    }
                  }
                  
                  // Update the registration with correct data
                  const updatedRegistration = {
                    ...this.registration,
                    deviceId: selectedTablet.deviceId || `TABLET-${selectedTablet.tabletNumber || 1}-${Date.now()}`,
                    materialId: config.tablet.materialId,
                    carGroupId: config.tablet.carGroupId,
                    slotNumber: selectedTablet.tabletNumber || 1,
                    lastReportedAt: selectedTablet.gps?.lastSeen || new Date().toISOString()
                  };
                  
                  // Save updated registration
                  await AsyncStorage.setItem('tabletRegistration', JSON.stringify(updatedRegistration));
                  this.registration = updatedRegistration;
                  
                  console.log('✅ Updated registration with database data:', updatedRegistration);
                }
              }
            } catch (error) {
              console.error('Error syncing registration from database:', error);
            }
          }
        }
        
        return this.registration?.isRegistered || false;
      }
      console.log('🔍 No registration data found, returning false');
      return false;
    } catch (error) {
      console.error('Error checking registration status:', error);
      return false;
    }
  }

  async getRegistrationData(): Promise<TabletRegistration | null> {
    try {
      // First, migrate device ID if needed
      await this.migrateDeviceIdIfNeeded();
      
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        this.registration = JSON.parse(registrationData);
        return this.registration;
      }
      
      // Check if we have a "cleared" flag to prevent fallback after unregistration
      const wasCleared = await AsyncStorage.getItem('registration_cleared');
      console.log('🔍 Checking registration cleared flag:', wasCleared);
      if (wasCleared) {
        console.log('Registration was explicitly cleared, checking database for existing registration...');
        
        // Try to restore from database if available
        let materialId = await SecureStore.getItemAsync('device_material_id') || 
                        process.env.EXPO_PUBLIC_MATERIAL_ID || 
                        Constants.expoConfig?.extra?.EXPO_PUBLIC_MATERIAL_ID;
        
        // If we have a material ID but it doesn't match the database, try the correct one
        if (materialId === 'DGL-HEADDRESS-CAR-001') {
          console.log('⚠️  Material ID mismatch detected, trying correct material ID from database');
          materialId = 'DGL-HEADDRESS-CAR-005';
        }
        
        if (materialId) {
          try {
            const response = await fetch(`${API_BASE_URL}/tablet/configuration/${materialId}`);
            if (response.ok) {
              const config = await response.json();
              if (config.success && config.tablet && config.tablet.tablets && config.tablet.tablets.length > 0) {
                console.log('✅ Found existing registration in database, restoring...');
                
                // Clear the cleared flag
                await AsyncStorage.removeItem('registration_cleared');
                
                // Create registration data from database
                const tabletUnit = config.tablet.tablets[0];
                console.log('Database tablet unit:', tabletUnit);
                
                // Try to find the correct tablet unit by matching device ID or use the first one
                let selectedTablet = tabletUnit;
                if (config.tablet.tablets.length > 1) {
                  // Look for a tablet with a valid device ID
                  const tabletWithDeviceId = config.tablet.tablets.find(t => t.deviceId && t.deviceId !== 'undefined');
                  if (tabletWithDeviceId) {
                    selectedTablet = tabletWithDeviceId;
                    console.log('Found tablet with device ID:', selectedTablet);
                  }
                }
                
                const registration: TabletRegistration = {
                  deviceId: selectedTablet.deviceId || `TABLET-${selectedTablet.tabletNumber || 1}-${Date.now()}`,
                  materialId: config.tablet.materialId,
                  slotNumber: selectedTablet.tabletNumber || 1,
                  carGroupId: config.tablet.carGroupId,
                  isRegistered: true,
                  lastReportedAt: selectedTablet.gps?.lastSeen || new Date().toISOString()
                };
                
                // Save the registration data
                await AsyncStorage.setItem('tabletRegistration', JSON.stringify(registration));
                this.registration = registration;
                
                // Update material ID in SecureStore
                await SecureStore.setItemAsync('device_material_id', config.tablet.materialId);
                
                return registration;
              }
            }
          } catch (error) {
            console.error('Error checking database for existing registration:', error);
          }
        }
        
        console.log('Registration was explicitly cleared and no valid database registration found');
        return null;
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
                isRegistered: false, // Don't auto-register from environment variables
                lastReportedAt: new Date().toISOString()
              };
              
              // Save the fallback registration
              await AsyncStorage.setItem('tabletRegistration', JSON.stringify(fallbackRegistration));
              this.registration = fallbackRegistration;
              
              // Update WebSocket service with new device info
              await playbackWebSocketService.updateDeviceInfo(fallbackRegistration.deviceId, fallbackRegistration.materialId);
              
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
        
        // Clear the "cleared" flag since we now have a valid registration
        await AsyncStorage.removeItem('registration_cleared');
        
        // Update WebSocket service with new device info
        await playbackWebSocketService.updateDeviceInfo(registration.deviceId, registration.materialId);
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

      // First, try to sync device ID from database
      const synced = await this.syncDeviceIdFromDatabase();
      if (synced) {
        console.log('Device ID synced, retrying status update...');
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

      // Detect speed limit for current location
      this.currentSpeedLimit = await this.detectSpeedLimit(lat, lng);
      
      // Check for speed violations
      const violation = this.checkForSpeedViolation(speed, lat, lng, accuracy);

      const locationUpdate: LocationUpdate = {
        deviceId: this.registration.deviceId,
        lat,
        lng,
        speed,
        heading,
        accuracy,
        speedLimit: this.currentSpeedLimit,
        violation: violation || undefined
      };

      // Only log location updates occasionally to reduce noise
      if (Math.random() < 0.1) { // Log ~10% of location updates
        console.log('Updating location tracking:', locationUpdate);
      }

      // Queue location data (will send immediately if online, queue if offline)
      await offlineQueueService.queueLocationData({
        lat: lat,
        lng: lng,
        speed: speed,
        heading: heading,
        accuracy: accuracy
      });

      // If simulating offline, don't send to server
      if (this.simulatingOffline) {
        console.log('📦 [Location] Queued location data (offline mode)');
        return true;
      }

      console.log('API URL:', `${API_BASE_URL}/deviceTracking/location-update`);

      // Send to new device tracking endpoint (daily staging system)
      try {
        const deviceTrackingResponse = await fetch(`${API_BASE_URL}/deviceTracking/location-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: locationUpdate.deviceId,
            deviceSlot: 1, // Default slot for now
            lat: locationUpdate.lat,
            lng: locationUpdate.lng,
            speed: locationUpdate.speed,
            heading: locationUpdate.heading,
            accuracy: locationUpdate.accuracy
          }),
        });

        if (deviceTrackingResponse.ok) {
          console.log('✅ Location updated in device tracking');
        } else {
          console.log('❌ Failed to update location in device tracking');
        }
      } catch (error) {
        console.error('❌ Error sending to device tracking:', error);
      }

      // Also send to existing screen tracking for backward compatibility
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

  // Speed limit detection based on location
  private async detectSpeedLimit(lat: number, lng: number): Promise<number> {
    try {
      // Define speed limit zones based on coordinates (Manila area)
      const speedLimitZones = [
        {
          name: 'School Zone',
          bounds: { north: 14.57, south: 14.55, east: 121.01, west: 120.99 },
          speedLimit: 30,
          timeRestrictions: { start: 7, end: 17 } // School hours (7 AM - 5 PM)
        },
        {
          name: 'Urban Area',
          bounds: { north: 14.6, south: 14.5, east: 121.1, west: 120.9 },
          speedLimit: 50
        },
        {
          name: 'Highway',
          bounds: { north: 14.7, south: 14.4, east: 121.2, west: 120.8 },
          speedLimit: 80
        },
        {
          name: 'Construction Zone',
          bounds: { north: 14.56, south: 14.54, east: 121.0, west: 120.98 },
          speedLimit: 30,
          active: true // Currently active
        }
      ];
      
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      
      for (const zone of speedLimitZones) {
        if (this.isPointInBounds(lat, lng, zone.bounds)) {
          // Check time restrictions
          if (zone.timeRestrictions) {
            if (currentHour >= zone.timeRestrictions.start && currentHour <= zone.timeRestrictions.end) {
              console.log(`🚦 Speed limit detected: ${zone.speedLimit} km/h (${zone.name} - School hours)`);
              return zone.speedLimit;
            }
          }
          
          console.log(`🚦 Speed limit detected: ${zone.speedLimit} km/h (${zone.name})`);
          return zone.speedLimit;
        }
      }
      
      // Default speed limit based on location
      const defaultLimit = this.getDefaultSpeedLimit(lat, lng);
      console.log(`🚦 Default speed limit: ${defaultLimit} km/h`);
      return defaultLimit;
      
    } catch (error) {
      console.error('Error detecting speed limit:', error);
      return 50; // Default urban speed limit
    }
  }

  // Check if point is within bounds
  private isPointInBounds(lat: number, lng: number, bounds: { north: number; south: number; east: number; west: number }): boolean {
    return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
  }

  // Get default speed limit based on location
  private getDefaultSpeedLimit(lat: number, lng: number): number {
    // Simple heuristic based on location
    if (this.isInCityCenter(lat, lng)) {
      return 40; // City center
    } else if (this.isInResidentialArea(lat, lng)) {
      return 30; // Residential
    } else if (this.isOnHighway(lat, lng)) {
      return 80; // Highway
    } else {
      return 50; // General urban
    }
  }

  // Simple location type detection
  private isInCityCenter(lat: number, lng: number): boolean {
    // Manila city center bounds
    return lat >= 14.55 && lat <= 14.6 && lng >= 120.98 && lng <= 121.02;
  }

  private isInResidentialArea(lat: number, lng: number): boolean {
    // Residential areas in Manila
    return lat >= 14.5 && lat <= 14.65 && lng >= 120.9 && lng <= 121.1;
  }

  private isOnHighway(lat: number, lng: number): boolean {
    // Major highways in Manila
    return lat >= 14.4 && lat <= 14.7 && lng >= 120.8 && lng <= 121.2;
  }

  // Check for speed violations
  private checkForSpeedViolation(currentSpeed: number, lat: number, lng: number, accuracy: number): SpeedViolation | null {
    const speedOverLimit = currentSpeed - this.currentSpeedLimit;
    
    // No violation if within grace tolerance
    if (speedOverLimit <= this.violationThresholds.grace) {
      return null;
    }
    
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    let penalty: number;
    
    if (speedOverLimit <= this.violationThresholds.low) {
      level = 'LOW';
      penalty = 2;
    } else if (speedOverLimit <= this.violationThresholds.medium) {
      level = 'MEDIUM';
      penalty = 5;
    } else if (speedOverLimit <= this.violationThresholds.high) {
      level = 'HIGH';
      penalty = 10;
    } else {
      level = 'EXTREME';
      penalty = 20;
    }
    
    const violation: SpeedViolation = {
      type: 'SPEED_VIOLATION',
      level,
      penalty,
      currentSpeed,
      speedLimit: this.currentSpeedLimit,
      speedOverLimit,
      timestamp: new Date(),
      location: {
        lat,
        lng,
        accuracy
      }
    };
    
    console.log(`🚨 SPEED VIOLATION DETECTED:`, {
      level,
      currentSpeed: `${currentSpeed} km/h`,
      speedLimit: `${this.currentSpeedLimit} km/h`,
      overLimit: `${speedOverLimit} km/h`,
      penalty: `${penalty} points`
    });
    
    return violation;
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
      // Clear all registration-related data from AsyncStorage
      await AsyncStorage.multiRemove([
        'tabletRegistration', 
        'device_material_id',
        'cachedAds',
        'lastAdUpdate',
        'deviceStatus'
      ]);
      
      // Set a flag to indicate registration was explicitly cleared
      await AsyncStorage.setItem('registration_cleared', 'true');
      console.log('✅ Set registration_cleared flag to true');
      
      console.log('All registration-related data cleared from AsyncStorage');
    } catch (error) {
      console.error('Error clearing registration data from AsyncStorage:', error);
    }
    
    // Also clear SecureStore data
    try {
      const { SecureStore } = require('expo-secure-store');
      await SecureStore.deleteItemAsync('device_material_id');
      console.log('Material ID cleared from SecureStore');
    } catch (error) {
      console.error('Error clearing material ID from SecureStore:', error);
    }
  }

  async clearAllCachedAds(): Promise<void> {
    try {
      console.log('Clearing all cached ads...');
      
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys that match the ad cache pattern: ads_${materialId}_${slotNumber}
      const adCacheKeys = allKeys.filter(key => key.startsWith('ads_'));
      
      if (adCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(adCacheKeys);
        console.log(`Cleared ${adCacheKeys.length} cached ad entries:`, adCacheKeys);
      } else {
        console.log('No cached ads found to clear');
      }
    } catch (error) {
      console.error('Error clearing cached ads:', error);
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

  // Method to force clear all registration data (for testing)
  async forceClearAllRegistrationData(): Promise<void> {
    try {
      console.log('🧹 Force clearing ALL registration data...');
      
      // Clear all registration-related data
      await AsyncStorage.multiRemove([
        'tabletRegistration', 
        'device_material_id',
        'cachedAds',
        'lastAdUpdate',
        'deviceStatus',
        'registration_cleared' // Clear the cleared flag too
      ]);
      
      // Set the cleared flag
      await AsyncStorage.setItem('registration_cleared', 'true');
      
      // Clear SecureStore data
      const { SecureStore } = require('expo-secure-store');
      await SecureStore.deleteItemAsync('device_material_id');
      
      // Clear in-memory registration
      this.registration = null;
      
      console.log('✅ All registration data force cleared');
    } catch (error) {
      console.error('Error force clearing registration data:', error);
    }
  }

  // Method to sync device ID from database
  async syncDeviceIdFromDatabase(): Promise<boolean> {
    try {
      console.log('🔄 Syncing device ID from database...');
      
      if (!this.registration) {
        console.log('No local registration found, cannot sync');
        return false;
      }

      const { materialId, slotNumber } = this.registration;
      
      // Get tablet configuration from server
      const response = await fetch(`${API_BASE_URL}/tablet/configuration/${materialId}`);
      if (!response.ok) {
        console.log('Failed to get tablet configuration from server');
        return false;
      }

      const config = await response.json();
      if (!config.success || !config.tablet) {
        console.log('No tablet configuration found on server');
        return false;
      }

      const tabletUnit = config.tablet.tablets[slotNumber - 1];
      if (!tabletUnit || !tabletUnit.deviceId) {
        console.log('No device ID found in database for slot', slotNumber);
        return false;
      }

      const databaseDeviceId = tabletUnit.deviceId;
      const localDeviceId = this.registration.deviceId;

      console.log('Device ID comparison:', {
        local: localDeviceId,
        database: databaseDeviceId,
        match: localDeviceId === databaseDeviceId
      });

      if (localDeviceId !== databaseDeviceId) {
        console.log('🔄 Device ID mismatch, updating local registration...');
        
        // Update local registration with correct device ID
        const updatedRegistration = {
          ...this.registration,
          deviceId: databaseDeviceId
        };

        await AsyncStorage.setItem('tabletRegistration', JSON.stringify(updatedRegistration));
        this.registration = updatedRegistration;

        console.log('✅ Device ID synced from database:', databaseDeviceId);
        return true;
      } else {
        console.log('✅ Device ID already in sync');
        return true;
      }

    } catch (error) {
      console.error('Error syncing device ID from database:', error);
      return false;
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
        // Set a flag to indicate registration was explicitly cleared
        await AsyncStorage.setItem('registration_cleared', 'true');
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
