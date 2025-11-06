import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import playbackWebSocketService from './playbackWebSocketService';
import offlineQueueService from './offlineQueueService';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { log } from '../utils/logger';
import requestManager from './requestManager';

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
    log.deviceTracking('Using environment API URL', { url: envUrl });
    return envUrl;
  }

  // Use environment variables for IP and port
  const serverIp = process.env.EXPO_PUBLIC_SERVER_IP;
  const serverPort = process.env.EXPO_PUBLIC_SERVER_PORT;
  
  if (serverIp && serverPort) {
    const serverUrl = `http://${serverIp}:${serverPort}`;
    log.deviceTracking('Using constructed server URL', { url: serverUrl });
    return serverUrl;
  }

  // Fallback to local server
  const fallbackUrl = 'http://192.168.1.7:5000';
  log.deviceTracking('Using fallback local server URL', { url: fallbackUrl });
  return fallbackUrl;
};

const API_BASE_URL = getAPIBaseURL();

export class TabletRegistrationService {
  private static instance: TabletRegistrationService;
  private registration: TabletRegistration | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private isTracking = false;
  private isSimulatingOffline = false;
  private appStateListener: any = null;
  private isReregistering = false; // Prevent concurrent re-registration attempts
  private lastServerVerification: number = 0; // Track last server verification time
  private serverVerificationInterval: number = 60000; // Verify with server only once per minute
  private lastLocationUpdate: number = 0; // Track last location update time
  private locationUpdateThrottle: number = 2000; // Minimum 2 seconds between location updates to server (matches check interval)
  
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
        log.deviceTracking('Converted ObjectId to materialId', { 
          objectId, 
          materialId: result.material.materialId 
        });
        return result.material.materialId;
      }
      }
    } catch (error) {
      log.error('Error converting ObjectId to materialId', { error, objectId });
    }

    // If conversion fails, return the original ObjectId but log a warning
    log.warning('Could not convert ObjectId to materialId format. Using ObjectId as fallback.', { objectId });
    return objectId;
  }

  async generateDeviceId(): Promise<string> {
    // ✅ PERSISTENT DEVICE ID: Store and reuse the same device ID for this device
    // This allows the same device to re-register even if local storage was cleared
    const STORAGE_KEY = 'persistent_device_id';
    
    try {
      // First, try to load existing persistent device ID
      const existingDeviceId = await AsyncStorage.getItem(STORAGE_KEY);
      if (existingDeviceId) {
        console.log('✅ Using persistent device ID:', existingDeviceId);
        return existingDeviceId;
      }
      
      // No existing device ID found - generate a new one
      console.log('🆕 Generating new persistent device ID...');
      
      // Create a more unique device identifier using multiple device properties
      const deviceInfo = {
        osInternalBuildId: Device.osInternalBuildId || 'unknown',
        deviceName: Device.deviceName || 'unknown',
        brand: Device.brand || 'unknown',
        modelName: Device.modelName || 'unknown',
        osName: Device.osName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        platform: Platform.OS || 'unknown'
      };
      
      // Create a unique base identifier by combining multiple device properties
      const baseDeviceId = `${deviceInfo.brand}-${deviceInfo.modelName}-${deviceInfo.osName}-${deviceInfo.osVersion}`.replace(/[^a-zA-Z0-9-]/g, '-');
      
      // Add a random component to ensure uniqueness even if device properties are similar
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const timestamp = Date.now();
      
      // Remove any existing TABLET prefix to avoid duplication
      const cleanDeviceId = baseDeviceId.replace(/^TABLET-/, '');
      
      const newDeviceId = `TABLET-${cleanDeviceId}-${randomSuffix}-${timestamp}`;
      
      // Store the new device ID for future use
      await AsyncStorage.setItem(STORAGE_KEY, newDeviceId);
      console.log('✅ Stored new persistent device ID:', newDeviceId);
      
      return newDeviceId;
    } catch (error) {
      console.error('❌ Error generating/storing device ID:', error);
      // Fallback to generating a temporary device ID if storage fails
      const deviceInfo = {
        brand: Device.brand || 'unknown',
        modelName: Device.modelName || 'unknown',
        osName: Device.osName || 'unknown',
        osVersion: Device.osVersion || 'unknown'
      };
      const baseDeviceId = `${deviceInfo.brand}-${deviceInfo.modelName}-${deviceInfo.osName}-${deviceInfo.osVersion}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const timestamp = Date.now();
      return `TABLET-${baseDeviceId.replace(/^TABLET-/, '')}-${randomSuffix}-${timestamp}`;
    }
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
      log.deviceTracking('Checking registration cleared flag', { wasCleared });
      
      // If registration was cleared, don't check anything - respect the cleared state
      if (wasCleared) {
        log.deviceTracking('Registration was explicitly cleared, returning false');
        return false;
      }
      
      // Check if we have existing registration data
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (!registrationData) {
        log.deviceTracking('No registration data found, returning false');
        return false;
      }

      this.registration = JSON.parse(registrationData);
      log.deviceTracking('Found local registration data', {
        deviceId: this.registration?.deviceId,
        materialId: this.registration?.materialId,
        slotNumber: this.registration?.slotNumber,
        isRegistered: this.registration?.isRegistered
      });

      // If no device ID or material ID, it's not a valid registration
      if (!this.registration?.deviceId || !this.registration?.materialId) {
        log.error('Invalid registration data - missing deviceId or materialId');
        return false;
      }

      // ⚡ OPTIMIZATION: Only verify with server once per minute to avoid blocking ad player
      // This prevents the ad player from waiting for server response on every mount
      const now = Date.now();
      const timeSinceLastVerification = now - this.lastServerVerification;
      const shouldVerifyWithServer = timeSinceLastVerification > this.serverVerificationInterval;
      
      if (!shouldVerifyWithServer) {
        log.deviceTracking(`Skipping server verification (last checked ${(timeSinceLastVerification / 1000).toFixed(0)}s ago), using cached registration`);
        return this.registration?.isRegistered || false;
      }

      // IMPORTANT: Verify with server that this tablet is still registered
      // This handles the case where admin unregistered the tablet from the dashboard
      try {
        log.deviceTracking('Verifying registration with server (cached verification expired)');
        this.lastServerVerification = now; // Update timestamp before making request
        
        // Create abort controller with timeout (React Native compatible)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/tablet/configuration/${this.registration.materialId}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const config = await response.json();
          
          if (config.success && config.tablet && config.tablet.tablets) {
            // Find the slot for this tablet
            const slotIndex = this.registration.slotNumber - 1;
            const serverTablet = config.tablet.tablets[slotIndex];
            
            if (serverTablet) {
              // Check if the server still has a deviceId for this slot
              if (!serverTablet.deviceId) {
                console.log('❌ Server shows deviceId is null - tablet was unregistered by admin');
                // Clear local registration since it's no longer valid on the server
                await this.clearRegistration();
                return false;
              }
              
              // Check if the deviceId matches
              if (serverTablet.deviceId !== this.registration.deviceId) {
                console.log('⚠️ DeviceId mismatch - another device may have taken this slot');
                console.log('   Local:', this.registration.deviceId);
                console.log('   Server:', serverTablet.deviceId);
                // Clear local registration since it's no longer valid
                await this.clearRegistration();
                return false;
              }
              
              log.deviceTracking('✅ Server confirmed registration is still valid');
              return this.registration.isRegistered || false;
            } else {
              console.log('❌ Slot not found on server');
              await this.clearRegistration();
              return false;
            }
          } else {
            console.log('❌ No tablet configuration found on server');
            await this.clearRegistration();
            return false;
          }
        } else {
          console.log('⚠️ Could not reach server to verify registration, using local data');
          // If we can't reach the server, trust local data for now
          return this.registration?.isRegistered || false;
        }
      } catch (error) {
        // Check for abort/timeout error (when controller.abort() is called)
        if ((error as Error).name === 'AbortError') {
          console.log('⏱️ Server verification timed out (5s), using cached local registration');
        } else {
          // Only log error if app is active and it's not a network failure
          if (AppState.currentState === 'active') {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('Network request failed') && 
                !errorMessage.includes('Request cancelled') &&
                !errorMessage.includes('app in background')) {
              console.error('❌ Error verifying registration with server:', error);
            }
          }
        }
        // If server check fails, trust local data for now
        return this.registration?.isRegistered || false;
      }
    } catch (error) {
      // Only log error if app is active
      if (AppState.currentState === 'active') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Network request failed') && 
            !errorMessage.includes('Request cancelled') &&
            !errorMessage.includes('app in background')) {
          console.error('Error checking registration status:', error);
        }
      }
      return false;
    }
  }

  async getRegistrationData(): Promise<TabletRegistration | null> {
    try {
      // Return cached registration if available (avoids AsyncStorage reads every 7 seconds)
      if (this.registration) {
        return this.registration;
      }

      // Check if we have a "cleared" flag FIRST to prevent fallback after unregistration
      const wasCleared = await AsyncStorage.getItem('registration_cleared');
      if (wasCleared) {
        console.log('🔍 Registration was explicitly cleared, returning null');
        return null;
      }

      // First, migrate device ID if needed
      await this.migrateDeviceIdIfNeeded();
      
      const registrationData = await AsyncStorage.getItem('tabletRegistration');
      if (registrationData) {
        this.registration = JSON.parse(registrationData);
        log.deviceTracking('Loaded registration data from storage (cached for future use)');
        return this.registration;
      }
      
      // If no registration data found, DO NOT try to create from environment variables
      // This prevents auto-registration after explicit unregistration
      console.log('ℹ️ No registration data found');
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

      console.log(`📡 [Registration] Server response status: ${response.status} ${response.statusText}`);

      const result: RegistrationResponse = await response.json();
      console.log(`📡 [Registration] Server response data:`, JSON.stringify(result, null, 2));

      if (!response.ok) {
        console.error(`❌ [Registration] Server returned error status: ${response.status}`);
        console.error(`❌ [Registration] Error message:`, result.message || 'No error message provided');
      }

      if (result.success && result.tabletInfo) {
        console.log('✅ [Registration] Registration successful! Saving to local storage...');
        
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
        console.log('✅ [Registration] Registration data saved to AsyncStorage:', registration);
        this.registration = registration;
        
        // Clear the "cleared" flag since we now have a valid registration
        await AsyncStorage.removeItem('registration_cleared');
        
        // Reset server verification cache to force immediate verification on next check
        this.lastServerVerification = Date.now();
        
        // Update WebSocket service with new device info
        await playbackWebSocketService.updateDeviceInfo(registration.deviceId, registration.materialId, registration.slotNumber);
        console.log('✅ [Registration] WebSocket service updated with device info');
      } else {
        console.error('❌ [Registration] Registration failed:', result.message || 'Unknown error');
        console.error('❌ [Registration] Response details:', result);
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
        // Silently skip - this is normal during app startup
        return false;
      }

      // If re-registration is in progress, skip this update
      if (this.isReregistering) {
        return false;
      }

      // Check if registration was explicitly cleared (prevents infinite loops after unregistration)
      try {
        const registrationCleared = await AsyncStorage.getItem('registration_cleared');
        if (registrationCleared === 'true') {
          // Registration was cleared - don't try to update status
          console.log('⏸️ [UpdateStatus] Registration was cleared - skipping status update');
          return false;
        }
      } catch (error) {
        // If we can't check, continue anyway
      }

      // First, try to sync device ID from database
      const synced = await this.syncDeviceIdFromDatabase();
      if (synced) {
        console.log('Device ID synced, retrying status update...');
      }

      // Check registration again after sync (syncDeviceIdFromDatabase might have cleared it)
      if (!this.registration) {
        console.log('⏸️ [UpdateStatus] Registration was cleared during sync - skipping status update');
        return false;
      }

      // Double-check the flag after sync
      try {
        const registrationCleared = await AsyncStorage.getItem('registration_cleared');
        if (registrationCleared === 'true') {
          console.log('⏸️ [UpdateStatus] Registration was cleared - skipping status update');
          return false;
        }
      } catch (error) {
        // If we can't check, continue anyway
      }

      // Skip GPS data if coordinates are [0,0] (GPS still initializing)
      const validGps = gps && !(gps.lat === 0 && gps.lng === 0) ? gps : undefined;
      // Only log GPS skip occasionally (not every update) to reduce log noise
      if (gps && !validGps && Math.random() < 0.05) {
        console.log('⏳ Skipping GPS data in status update - coordinates are [0,0]');
      }

      // Final check before accessing deviceId
      if (!this.registration || !this.registration.deviceId) {
        console.log('⏸️ [UpdateStatus] No registration or deviceId available - skipping status update');
        return false;
      }

      const requestBody = {
        deviceId: this.registration.deviceId,
        isOnline,
        gps: validGps,
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
        
        // If valid GPS data is provided, also update location tracking
        // Check registration again before calling updateLocationTracking
        if (validGps && this.registration) {
          await this.updateLocationTracking(validGps.lat, validGps.lng);
        }
        
        return true;
      } else {
        // Handle "Tablet not found" error (expected when device is unregistered by admin)
        if (result.message === 'Tablet not found') {
          console.log('❌ [UpdateStatus] Device not found - tablet was unregistered by admin');
          console.log('🧹 [UpdateStatus] Clearing registration data and navigating to registration page...');
          
          // Set flag immediately to prevent any other updateTabletStatus calls
          try {
            await AsyncStorage.setItem('registration_cleared', 'true');
          } catch (error) {
            // Ignore error, continue with clearing
          }
          
          // Clear registration data (don't try to auto re-register with old data)
          await this.clearRegistration();
          
          // Navigate to registration page
          // Using setTimeout to ensure state updates are processed first
          setTimeout(() => {
            try {
              const { router } = require('expo-router');
              router.replace('/registration?force=true');
              console.log('✅ [UpdateStatus] Navigated to registration page');
            } catch (navError) {
              console.error('❌ [UpdateStatus] Error navigating to registration page:', navError);
            }
          }, 500);
          
          return false;
        }
        
        // For other errors, log as error
        console.error('Failed to update tablet status:', result.message);
        return false;
      }
    } catch (error) {
      // Only log error if app is active and it's not a network failure
      if (AppState.currentState === 'active') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Network request failed') && 
            !errorMessage.includes('Request cancelled') &&
            !errorMessage.includes('app in background') &&
            error instanceof Error && error.name !== 'AbortError') {
          console.error('Error updating tablet status:', error);
        }
      }
      return false;
    }
  }

  async updateLocationTracking(lat: number, lng: number, speed: number = 0, heading: number = 0, accuracy: number = 0): Promise<boolean> {
    try {
      if (!this.registration) {
        log.deviceTracking('Device not registered - skipping location tracking');
        return false;
      }

      // Skip if GPS is still initializing (coordinates are [0,0])
      if (lat === 0 && lng === 0) {
        log.deviceTracking('GPS still initializing - skipping location update (coordinates are [0,0])');
        return false;
      }

      // Log GPS data for debugging (occasionally)
      if (Math.random() < 0.05) { // 5% of updates
        console.log(`📍 [GPS] Slot ${this.registration.slotNumber} Location:`, {
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          speed: speed ? `${(speed * 3.6).toFixed(1)} km/h` : '0 km/h',
          accuracy: `${accuracy.toFixed(0)}m`
        });
      }

      // Validate speed value - ensure it's non-negative
      const validSpeed = speed && speed >= 0 ? speed : 0;

      // Validate that we have proper registration data
      if (!this.registration.materialId || this.registration.materialId.startsWith('TABLET-')) {
        log.deviceTracking('Invalid registration data - materialId is missing or looks like deviceId. Skipping location tracking.');
        return false;
      }

      // Detect speed limit for current location
      this.currentSpeedLimit = await this.detectSpeedLimit(lat, lng);
      
      // Check for speed violations
      const violation = this.checkForSpeedViolation(validSpeed, lat, lng, accuracy);

      const locationUpdate: LocationUpdate = {
        deviceId: this.registration.deviceId,
        lat,
        lng,
        speed: validSpeed,
        heading,
        accuracy,
        speedLimit: this.currentSpeedLimit,
        violation: violation || undefined
      };

      // Only log location updates occasionally to reduce noise
      if (Math.random() < 0.1) { // Log ~10% of location updates
        log.deviceTracking('Updating location tracking', locationUpdate);
      }

      // Queue location data (will send immediately if online, queue if offline)
      await offlineQueueService.queueLocationData({
        lat: lat,
        lng: lng,
        speed: validSpeed,
        heading: heading,
        accuracy: accuracy
      });

      // If simulating offline, don't send to server
      if (this.simulatingOffline) {
        log.deviceTracking('Queued location data (offline mode)');
        return true;
      }

      // Only log API URL occasionally to reduce noise
      if (Math.random() < 0.05) { // Log ~5% of API calls
        log.deviceTracking('API URL', { url: `${API_BASE_URL}/deviceTracking/location-update` });
      }

      // Send to device tracking endpoint (unified location tracking)
      // Use requestManager for cancellation, deduplication, and queuing
      try {
        const deviceTrackingResponse = await requestManager.fetch(`${API_BASE_URL}/deviceTracking/location-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: locationUpdate.deviceId,
            materialId: this.registration.materialId, // Track by car/material, not individual device
            deviceSlot: this.registration.slotNumber, // Keep slot info for reference
            carGroupId: this.registration.carGroupId, // Add carGroupId for dashboard
            lat: locationUpdate.lat,
            lng: locationUpdate.lng,
            speed: validSpeed,
            heading: locationUpdate.heading,
            accuracy: locationUpdate.accuracy
          }),
          timeout: 10000, // 10 second timeout
          priority: 1, // Lower priority (can be queued)
          allowDuplicate: true, // Allow duplicate location updates since location changes frequently
          allowInBackground: true, // Allow location updates even when app is in background
        });

        if (!deviceTrackingResponse.ok) {
          const errorText = await deviceTrackingResponse.text();
          console.error('❌ Failed to update location in device tracking');
          console.error('Status:', deviceTrackingResponse.status);
          console.error('Response:', errorText);
          return false;
        }

        const result = await deviceTrackingResponse.json();
        
        if (result.success) {
          log.deviceTracking('Location tracking updated successfully');
          return true;
        } else {
          console.error('❌ Location tracking failed:', result.message);
          return false;
        }
      } catch (error) {
        if (error instanceof Error) {
          // If app is in background and request was cancelled, silently handle it
          if (error.name === 'AbortError' || error.message.includes('app in background') || error.message.includes('Request cancelled')) {
            // Silently handle - this is expected when app goes to background
            // The location update is already queued above, so we can safely return false
            return false;
          }
          if (error.name === 'AbortError') {
            console.warn('⏱️ Location tracking request timed out - will retry via offline queue');
            // The location update is already queued above, so we can safely return false
            return false;
          }
        }
        console.error('❌ Error sending to device tracking:', error);
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
        console.log('Device not registered - no tracking status available');
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
      log.deviceTracking('Location tracking already started');
      return;
    }

    // Setup app state change listener if not already set
    if (!this.appStateListener) {
      this.appStateListener = AppState.addEventListener('change', async (nextAppState) => {
        console.log('App state changed to:', nextAppState);
        
        // Check if registration was cleared before doing anything
        try {
          const registrationCleared = await AsyncStorage.getItem('registration_cleared');
          if (registrationCleared === 'true') {
            // Registration was cleared - don't do anything
            return;
          }
        } catch (error) {
          // If we can't check, continue anyway
        }
        
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          console.log('App is going to background, stopping location tracking');
          await this.stopLocationTracking();
          
          // Cancel all pending requests when going to background
          requestManager.cancelAllRequests();
          
          // Update server that we're going offline (with priority)
          if (this.registration) {
            await this.updateTabletStatus(false);
          }
        } else if (nextAppState === 'active') {
          console.log('App is active, restarting location tracking if needed');
          if (this.registration) {
            // Small delay to let app stabilize
            setTimeout(async () => {
              await this.updateTabletStatus(true);
              await this.startLocationTracking();
            }, 500);
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
      if (serverAccessible === 'skipped') {
        // Server check was skipped because app is in background - this is fine, just return
        return;
      }
      if (!serverAccessible) {
        console.error('Backend server is not accessible. Please check server status.');
        return;
      }

      this.isTracking = true;

      // Start periodic location updates (every 2 seconds)
      this.locationUpdateInterval = setInterval(async () => {
        try {
          // Skip location updates if registration was cleared
          try {
            const registrationCleared = await AsyncStorage.getItem('registration_cleared');
            if (registrationCleared === 'true') {
              // Registration was cleared - stop tracking
              await this.stopLocationTracking();
              return;
            }
          } catch (error) {
            // If we can't check, continue anyway
          }

          // Skip location updates if simulating offline
          if (this.isSimulatingOffline) {
            console.log('Skipping location update - simulating offline');
            return;
          }

          // Skip if no registration
          if (!this.registration) {
            return;
          }

          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5, // Update every 5 meters
          });

          const { latitude, longitude, speed, heading, accuracy } = location.coords;

          // Throttle location updates to prevent too many requests
          const now = Date.now();
          if (now - this.lastLocationUpdate < this.locationUpdateThrottle) {
            // Skip this update - too soon since last one
            return;
          }

          // Only use updateLocationTracking (includes all GPS data: speed, heading, accuracy)
          // Don't call updateTabletStatus here to avoid duplicate location sends
          await this.updateLocationTracking(
            latitude, 
            longitude, 
            speed && speed >= 0 ? speed : 0, 
            heading || 0, 
            accuracy || 0
          );

          this.lastLocationUpdate = now;

          // Only log location updates occasionally to reduce noise
          if (Math.random() < 0.1) { // Log ~10% of location updates
            log.deviceTracking('Location updated', { latitude, longitude, speed, heading, accuracy });
          }
        } catch (error) {
          // Only log error if app is active and it's not a network failure
          if (AppState.currentState === 'active') {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('Network request failed') && 
                !errorMessage.includes('Request cancelled') &&
                !errorMessage.includes('app in background') &&
                error instanceof Error && error.name !== 'AbortError') {
              console.error('Error updating location:', error);
            }
          }
        }
      }, 2000); // Update every 2 seconds

      log.deviceTracking('Location tracking started');
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
    log.deviceTracking('Location tracking stopped');
    
    // Update server that we're no longer tracking
    // Check both registration and the cleared flag before attempting update
    if (this.registration) {
      try {
        // Check if registration was cleared before trying to update
        const registrationCleared = await AsyncStorage.getItem('registration_cleared');
        if (registrationCleared === 'true') {
          // Registration was cleared - don't try to update status
          return;
        }
        
        // Double-check registration still exists (might have been cleared)
        if (!this.registration) {
          return;
        }
        
        await this.updateTabletStatus(false);
      } catch (error) {
        // Only log error if app is active and it's not a network failure
        if (AppState.currentState === 'active') {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('Network request failed') && 
              !errorMessage.includes('Request cancelled') &&
              !errorMessage.includes('app in background') &&
              error instanceof Error && error.name !== 'AbortError') {
            console.error('Error updating tablet status to offline:', error);
          }
        }
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
              // Only log speed limits occasionally to reduce noise
              if (Math.random() < 0.1) { // Log ~10% of speed limit detections
                log.deviceTracking(`Speed limit: ${zone.speedLimit} km/h (${zone.name})`);
              }
              return zone.speedLimit;
            }
          }
          
          // Only log speed limits occasionally to reduce noise
          if (Math.random() < 0.1) { // Log ~10% of speed limit detections
            log.deviceTracking(`Speed limit: ${zone.speedLimit} km/h (${zone.name})`);
          }
          return zone.speedLimit;
        }
      }
      
      // Default speed limit based on location
      const defaultLimit = this.getDefaultSpeedLimit(lat, lng);
      log.deviceTracking(`Default speed limit: ${defaultLimit} km/h`);
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
        console.log('Device not registered - skipping ScreenTracking record creation');
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

  async checkServerAccessibility(): Promise<boolean | 'skipped'> {
    // Check if app is in background first - skip silently if so
    if (AppState.currentState !== 'active') {
      return 'skipped'; // Return special value to indicate it was skipped
    }

    try {
      // Use requestManager for better handling
      const response = await requestManager.fetch(`${API_BASE_URL}/tablet/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 second timeout
        priority: 2, // Medium priority
        allowDuplicate: false, // Prevent duplicate health checks
        allowInBackground: false, // Don't allow in background
      });

      if (response.ok) {
        return true;
      } else {
        // Only log error if app is still active
        if (AppState.currentState === 'active') {
          console.error('Server responded with status:', response.status);
        }
        return false;
      }
    } catch (error) {
      // If app went to background during the request, skip silently
      if (AppState.currentState !== 'active') {
        return 'skipped';
      }

      // Handle AbortError and background-related errors silently
      if (error instanceof Error) {
        if (error.name === 'AbortError' || 
            error.message.includes('background') || 
            error.message.includes('Request cancelled') ||
            error.message.includes('Network request failed')) {
          // Silently handle - these are expected when app is in background or network is unavailable
          return 'skipped';
        }
      }

      // Only log other errors if app is active
      if (AppState.currentState === 'active') {
        console.error('Server accessibility check failed:', error);
        console.error('Please ensure:');
        console.error('1. Backend server is running (npm start in Ads2Go-Server)');
        console.error('2. Server URL is correct:', API_BASE_URL);
        console.error('3. Network connectivity is available');
      }
      return false;
    }
  }

  async clearRegistration(): Promise<void> {
    console.log('🧹 Clearing registration data...');
    
    // Set flag FIRST to prevent any new updateTabletStatus calls
    try {
      await AsyncStorage.setItem('registration_cleared', 'true');
      console.log('✅ Set registration_cleared flag to true');
    } catch (error) {
      console.error('❌ Error setting registration_cleared flag:', error);
    }
    
    // Clear registration data IMMEDIATELY to prevent stopLocationTracking from calling updateTabletStatus
    this.registration = null;
    this.lastServerVerification = 0; // Force server verification on next check
    
    // NOW stop tracking (it won't call updateTabletStatus because this.registration is null)
    await this.stopLocationTracking();
    
    // Remove app state listener
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    
    try {
      // Clear all registration-related data from AsyncStorage (including the cleared flag)
      await AsyncStorage.multiRemove([
        'tabletRegistration', 
        'device_material_id',
        'cachedAds',
        'lastAdUpdate',
        'deviceStatus',
        'registration_cleared' // Clear the flag too
      ]);
      
      console.log('✅ All registration-related data cleared from AsyncStorage');
    } catch (error) {
      console.error('❌ Error clearing registration data from AsyncStorage:', error);
    }
    
    // Also clear SecureStore data
    try {
      await SecureStore.deleteItemAsync('device_material_id');
      console.log('✅ Material ID cleared from SecureStore');
    } catch (error) {
      console.error('❌ Error clearing material ID from SecureStore:', error);
    }

    console.log('✅ Registration clearing complete');
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
      // Only log error if app is active and it's not a network failure
      if (AppState.currentState === 'active') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Network request failed') && 
            !errorMessage.includes('Request cancelled') &&
            !errorMessage.includes('app in background') &&
            error instanceof Error && error.name !== 'AbortError') {
          console.error('Error syncing device ID from database:', error);
        }
      }
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

      // Use requestManager for better error handling
      const response = await requestManager.fetch(`${API_BASE_URL}/ads/${finalMaterialId}/${slotNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout for ad fetching (can be slower)
        priority: 2, // Medium priority (ads are important but not critical)
        allowDuplicate: false, // Prevent duplicate ad fetches
      });

      const result: AdsResponse = await response.json();
      
      if (result.success) {
        console.log('Fetched ads:', result.ads.length);
      } else {
        console.error('Failed to fetch ads:', result.message);
      }

      return result;
    } catch (error) {
      // If app is in background and request was cancelled, silently handle it
      if (error instanceof Error) {
        if (error.name === 'AbortError' || 
            error.message.includes('app in background') || 
            error.message.includes('Request cancelled') ||
            error.message.includes('Network request failed')) {
          // Silently handle - this is expected when app goes to background or network is unavailable
          return {
            success: false,
            ads: [],
            message: 'Request cancelled - app in background'
          };
        }
      }
      
      // Only log errors if app is active
      if (AppState.currentState === 'active') {
        console.error('Error fetching ads:', error);
      }
      
      return {
        success: false,
        ads: [],
        message: 'Network error: Unable to fetch ads'
      };
    }
  }

  // ❌ REMOVED: trackAdPlayback() - was causing duplicate tracking
  // Ad tracking now handled directly in AdPlayer via /deviceTracking/ad-playback endpoint

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
        log.adAnalytics('Ad playback ended successfully', result);
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
        log.adAnalytics('Driver activity updated successfully', result);
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
