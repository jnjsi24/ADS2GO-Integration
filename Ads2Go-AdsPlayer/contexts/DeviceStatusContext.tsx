import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import deviceStatusService from '../services/deviceStatusService';
import tabletRegistrationService from '../services/tabletRegistration';

type DeviceStatus = {
  isOnline: boolean;
  lastSeen?: Date;
  error?: string;
};

type DeviceStatusContextType = {
  status: DeviceStatus;
  materialId: string | null;
  setMaterialId: (id: string) => Promise<void>;
  clearMaterialId: () => Promise<void>;
};

const DeviceStatusContext = createContext<DeviceStatusContextType | undefined>(undefined);

export const DeviceStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<DeviceStatus>({ isOnline: false });
  const [materialId, setMaterialIdState] = useState<string | null>(null);

  // Load saved material ID on mount
  useEffect(() => {
    const loadMaterialId = async () => {
      try {
        // First try to load from SecureStore
        const savedMaterialId = await SecureStore.getItemAsync('device_material_id');
        if (savedMaterialId) {
          console.log('Using material ID from SecureStore:', savedMaterialId);
          setMaterialIdState(savedMaterialId);
          return;
        }
        
        // If not found in SecureStore, try environment variable
        const envMaterialId = process.env.EXPO_PUBLIC_MATERIAL_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_MATERIAL_ID;
        console.log('🔍 Environment variables check:', {
          EXPO_PUBLIC_MATERIAL_ID: process.env.EXPO_PUBLIC_MATERIAL_ID,
          EXPO_PUBLIC_TABLET_ID: process.env.EXPO_PUBLIC_TABLET_ID,
          EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
          ConstantsExtra: Constants.expoConfig?.extra,
          allEnvKeys: Object.keys(process.env).filter(key => key.includes('EXPO')),
          finalMaterialId: envMaterialId
        });
        
        if (envMaterialId) {
          console.log('Using material ID from environment:', envMaterialId);
          setMaterialIdState(envMaterialId);
          // Save to SecureStore for future use
          await SecureStore.setItemAsync('device_material_id', envMaterialId);
        } else {
          // Use a default fallback material ID if none found
          const fallbackMaterialId = 'DGL-HEADDRESS-CAR-001';
          console.log('No material ID found in SecureStore or environment variables, using fallback:', fallbackMaterialId);
          setMaterialIdState(fallbackMaterialId);
          // Save fallback to SecureStore
          await SecureStore.setItemAsync('device_material_id', fallbackMaterialId);
        }
      } catch (error) {
        console.error('Failed to load material ID:', error);
        // Even if there's an error, set a fallback material ID
        const fallbackMaterialId = 'DGL-HEADDRESS-CAR-001';
        console.log('Error loading material ID, using fallback:', fallbackMaterialId);
        setMaterialIdState(fallbackMaterialId);
      }
    };

    loadMaterialId();
    
    // Set up periodic check to sync material ID with registration data
    const syncInterval = setInterval(async () => {
      try {
        const currentMaterialId = await SecureStore.getItemAsync('device_material_id');
        if (currentMaterialId && currentMaterialId !== materialId) {
          console.log('Material ID changed, updating context:', currentMaterialId);
          setMaterialIdState(currentMaterialId);
        }
      } catch (error) {
        console.error('Error syncing material ID:', error);
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(syncInterval);
  }, [materialId]);

  // Initialize WebSocket when materialId changes
  useEffect(() => {
    if (!materialId) {
      console.log('No materialId set, checking if registration can provide one...');
      
      // Try to get material ID from registration data if not available
      const checkForMaterialId = async () => {
        try {
          const registration = await tabletRegistrationService.getRegistrationData();
          if (registration && registration.materialId) {
            console.log('Found material ID from registration, updating:', registration.materialId);
            setMaterialIdState(registration.materialId);
            return;
          }
        } catch (error) {
          console.error('Error getting registration data:', error);
        }
        
        // If still no material ID, show error
        setStatus({ isOnline: false, error: 'Please register the tablet to set a material ID' });
      };
      
      checkForMaterialId();
      return;
    }

    const handleStatusChange = (newStatus: DeviceStatus) => {
      console.log('Device status changed:', newStatus);
      setStatus(prev => {
        const updatedStatus = {
          ...prev,
          ...newStatus,
          lastSeen: new Date(),
        };
        console.log('Status update:', { prev, newStatus, updatedStatus });
        return updatedStatus;
      });
    };

    // Set a timeout to handle connection failures
    const connectionTimeout = setTimeout(() => {
      console.log('WebSocket connection timeout, checking status...');
      setStatus(prev => {
        if (prev.error === 'Connecting...') {
          return {
            ...prev,
            error: 'Connection timeout - WebSocket server may be unavailable'
          };
        }
        return prev;
      });
    }, 10000); // 10 second timeout

    const initializeWebSocket = async () => {
      try {
        // Reset status to connecting state
        setStatus({ isOnline: false, error: 'Connecting...' });
        
        // Initialize WebSocket connection
        await deviceStatusService.initialize({
          materialId,
          onStatusChange: (newStatus) => {
            // Clear timeout if connection succeeds
            clearTimeout(connectionTimeout);
            console.log('WebSocket status change received:', newStatus);
            handleStatusChange(newStatus);
          }
        });
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        clearTimeout(connectionTimeout);
        setStatus({
          isOnline: false,
          error: error instanceof Error ? error.message : 'Failed to connect'
        });
      }
    };

    // Check if device is registered before initializing WebSocket
    const checkRegistrationAndInitialize = async () => {
      try {
        const isRegistered = await tabletRegistrationService.checkRegistrationStatus();
        if (!isRegistered) {
          console.log('Device not registered, skipping WebSocket initialization');
          setStatus({ isOnline: false, error: 'Device not registered. Please register the tablet first.' });
          return;
        }
        
        // Get the updated material ID in case it was restored from database
        const updatedMaterialId = await SecureStore.getItemAsync('device_material_id');
        if (updatedMaterialId && updatedMaterialId !== materialId) {
          console.log('Material ID updated from database:', updatedMaterialId);
          setMaterialIdState(updatedMaterialId);
          return; // This will trigger the effect again with the correct material ID
        }
        
        console.log('Device is registered, initializing WebSocket with materialId:', materialId);
        initializeWebSocket();
      } catch (error) {
        console.error('Error checking registration status:', error);
        setStatus({ isOnline: false, error: 'Failed to verify registration status' });
      }
    };

    checkRegistrationAndInitialize();

    // Clean up on unmount or when materialId changes
    return () => {
      console.log('Cleaning up WebSocket connection');
      clearTimeout(connectionTimeout);
      deviceStatusService.cleanup();
    };
  }, [materialId]);

  const setMaterialId = async (id: string) => {
    try {
      console.log('Setting material ID:', id);
      await SecureStore.setItemAsync('device_material_id', id);
      console.log('Material ID saved to SecureStore:', id);
      
      // Always update state, even if the ID is the same, to ensure proper initialization
      console.log('Updating material ID state from', materialId, 'to', id);
      
      // Clean up existing connection before updating the ID
      deviceStatusService.cleanup();
      
      // Update the state which will trigger the effect to reconnect
      setMaterialIdState(id);
      
      // Force a status update
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        error: 'Connecting...'
      }));
      
      console.log('Material ID state updated successfully');
    } catch (error) {
      console.error('Failed to save material ID:', error);
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        error: 'Failed to save material ID'
      }));
      throw error;
    }
  };

  const clearMaterialId = async () => {
    try {
      await SecureStore.deleteItemAsync('device_material_id');
      setMaterialIdState(null);
      setStatus({ isOnline: false });
    } catch (error) {
      console.error('Failed to clear material ID:', error);
      throw error;
    }
  };

  return (
    <DeviceStatusContext.Provider value={{ status, materialId, setMaterialId, clearMaterialId }}>
      {children}
    </DeviceStatusContext.Provider>
  );
};

export const useDeviceStatus = (): DeviceStatusContextType => {
  const context = useContext(DeviceStatusContext);
  if (context === undefined) {
    throw new Error('useDeviceStatus must be used within a DeviceStatusProvider');
  }
  return context;
};
