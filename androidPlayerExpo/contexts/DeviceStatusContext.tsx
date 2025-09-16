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
    if (!materialId) return;

    const handleStatusChange = (newStatus: DeviceStatus) => {
      console.log('Device status changed:', newStatus);
      setStatus(prev => ({
        ...prev,
        ...newStatus,
        lastSeen: new Date(),
      }));
    };

    // Initialize WebSocket connection
    deviceStatusService.initialize({
      materialId,
      onStatusChange: handleStatusChange
    });

    // Clean up on unmount
    return () => {
      deviceStatusService.cleanup();
    };
  }, [materialId]);

  const setMaterialId = async (id: string) => {
    try {
      await SecureStore.setItemAsync('device_material_id', id);
      setMaterialIdState(id);
    } catch (error) {
      console.error('Failed to save material ID:', error);
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
