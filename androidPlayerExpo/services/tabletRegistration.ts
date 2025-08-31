import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

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

// For device/emulator testing, use your computer's IP address
const API_BASE_URL = 'http://192.168.100.22:5000'; // Update with your server URL

export class TabletRegistrationService {
  private static instance: TabletRegistrationService;
  private registration: TabletRegistration | null = null;

  static getInstance(): TabletRegistrationService {
    if (!TabletRegistrationService.instance) {
      TabletRegistrationService.instance = new TabletRegistrationService();
    }
    return TabletRegistrationService.instance;
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

      const response = await fetch(`${API_BASE_URL}/registerTablet`, {
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
        console.error('Tablet not registered');
        return false;
      }

      const requestBody = {
        deviceId: this.registration.deviceId,
        isOnline,
        gps,
        lastReportedAt: new Date().toISOString()
      };

      const response = await fetch(`${API_BASE_URL}/updateTabletStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error updating tablet status:', error);
      return false;
    }
  }

  async clearRegistration(): Promise<void> {
    try {
      await AsyncStorage.removeItem('tabletRegistration');
      this.registration = null;
    } catch (error) {
      console.error('Error clearing registration:', error);
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

      const response = await fetch(`${API_BASE_URL}/unregisterTablet`, {
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

      const response = await fetch(`${API_BASE_URL}/checkExistingConnection`, {
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
}

export default TabletRegistrationService.getInstance();
