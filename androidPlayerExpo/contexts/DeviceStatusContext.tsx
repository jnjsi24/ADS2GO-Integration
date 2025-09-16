import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import deviceStatusService from '../services/deviceStatusService';

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
        const savedMaterialId = await SecureStore.getItemAsync('device_material_id');
        if (savedMaterialId) {
          setMaterialIdState(savedMaterialId);
        }
      } catch (error) {
        console.error('Failed to load material ID:', error);
      }
    };

    loadMaterialId();
  }, []);

  // Initialize WebSocket when materialId changes
  useEffect(() => {
    if (!materialId) {
      console.log('No materialId set, skipping WebSocket initialization');
      setStatus({ isOnline: false, error: 'No material ID set' });
      return;
    }

    console.log('Initializing WebSocket with materialId:', materialId);
    
    const handleStatusChange = (newStatus: DeviceStatus) => {
      console.log('Device status changed:', newStatus);
      setStatus(prev => ({
        ...prev,
        ...newStatus,
        lastSeen: new Date(),
      }));
    };

    try {
      // Initialize WebSocket connection
      deviceStatusService.initialize({
        materialId,
        onStatusChange: handleStatusChange
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setStatus({
        isOnline: false,
        error: error instanceof Error ? error.message : 'Failed to connect'
      });
    }

    // Clean up on unmount or when materialId changes
    return () => {
      console.log('Cleaning up WebSocket connection');
      deviceStatusService.cleanup();
    };
  }, [materialId]);

  const setMaterialId = async (id: string) => {
    try {
      console.log('Setting material ID:', id);
      await SecureStore.setItemAsync('device_material_id', id);
      
      // Only update state if the ID has changed
      if (id !== materialId) {
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
      }
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
