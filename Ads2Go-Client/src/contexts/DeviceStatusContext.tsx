import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface DeviceStatus {
  deviceId: string;
  materialId?: string;
  isOnline: boolean;
  lastSeen?: string;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
  };
  lastSeenLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
  };
  currentHours?: number;
  hoursRemaining?: number;
  isCompliant?: boolean;
  totalDistanceToday?: number;
  displayStatus?: string;
  screenMetrics?: any;
  alerts?: any[];
  [key: string]: any;
}

interface DeviceStatusContextType {
  devices: DeviceStatus[];
  getDeviceStatus: (deviceId: string) => DeviceStatus | undefined;
  isConnected: boolean;
}

const DeviceStatusContext = createContext<DeviceStatusContextType | undefined>(undefined);

export const DeviceStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const { isConnected, subscribe } = useWebSocket();

  // Handle device list updates
  useEffect(() => {
    const unsubscribe = subscribe('deviceList', (data: { devices: DeviceStatus[] }) => {
      setDevices(prevDevices => {
        // Merge with existing devices to preserve additional data
        const updatedDevices = [...prevDevices];
        
        data.devices.forEach(device => {
          const existingIndex = updatedDevices.findIndex(d => d.deviceId === device.deviceId);
          if (existingIndex >= 0) {
            // Update existing device
            updatedDevices[existingIndex] = {
              ...updatedDevices[existingIndex],
              ...device
            };
          } else {
            // Add new device
            updatedDevices.push(device);
          }
        });
        
        return updatedDevices;
      });
    });

    // Handle individual device updates
    const unsubscribeUpdate = subscribe('deviceUpdate', (data: { device: DeviceStatus }) => {
      setDevices(prevDevices => {
        const deviceIndex = prevDevices.findIndex(d => d.deviceId === data.device.deviceId);
        
        if (deviceIndex >= 0) {
          // Update existing device
          const updatedDevices = [...prevDevices];
          updatedDevices[deviceIndex] = {
            ...updatedDevices[deviceIndex],
            ...data.device,
            isOnline: data.device.isOnline !== undefined ? data.device.isOnline : updatedDevices[deviceIndex].isOnline,
            lastSeen: data.device.lastSeen || updatedDevices[deviceIndex].lastSeen
          };
          return updatedDevices;
        }
        
        // Add new device if not found
        return [...prevDevices, data.device];
      });
    });

    return () => {
      unsubscribe();
      unsubscribeUpdate();
    };
  }, [subscribe]);

  // Helper function to get device status by ID
  const getDeviceStatus = useCallback((deviceId: string) => {
    return devices.find(device => device.deviceId === deviceId);
  }, [devices]);

  return (
    <DeviceStatusContext.Provider value={{
      devices,
      getDeviceStatus,
      isConnected
    }}>
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
