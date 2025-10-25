import React, { useState, useEffect, useCallback } from 'react';
import { Monitor } from 'lucide-react';
import playbackWebSocketService from '../services/playbackWebSocketService';
import { useMyAds } from '../hooks/useMyAds';
import { screenComplianceService } from '../services/screenComplianceService';

interface ScreenStatus {
  deviceId: string;
  displayId?: string;
  materialId: string;
  screenType: 'HEADDRESS' | 'LCD' | 'BILLBOARD' | 'DIGITAL_DISPLAY';
  carGroupId?: string;
  slotNumber?: number;
  isOnline: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
  };
  lastSeen: string;
  currentHours?: number;
  hoursRemaining?: number;
  isCompliant: boolean;
  totalDistanceToday?: number;
  averageDailyHours?: number;
  complianceRate?: number;
  totalHoursOnline?: number;
  totalDistanceTraveled?: number;
  displayStatus: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'DISPLAY_OFF';
  statusText?: string;
  slot1Status?: string;
  slot2Status?: string;
  slot1DeviceId?: string;
  slot2DeviceId?: string;
  masterDeviceId?: string;
  slot1LastSeen?: string;
  slot2LastSeen?: string;
  screenMetrics?: {
    displayHours: number;
    adPlayCount: number;
    lastAdPlayed: string;
    brightness: number;
    volume: number;
    isDisplaying: boolean;
    maintenanceMode: boolean;
    currentAd?: {
      adId: string;
      adTitle: string;
      adDuration: number;
      startTime: string;
      currentTime?: number;
      state?: string;
      progress?: number;
    };
  };
  alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
    isResolved: boolean;
    severity: string;
  }>;
  totalDevices?: number;
  onlineDevices?: number;
  totalHours?: number;
  totalDistance?: number;
}

interface RealtimeMetricsProps {
  className?: string;
}

const RealtimeMetrics: React.FC<RealtimeMetricsProps> = ({ className = '' }) => {
  const [screens, setScreens] = useState<ScreenStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // ✅ OPTIMIZATION: Use shared hook (reduces queries by 75%)
  // Now uses cache and shares data with other components
  const { data: adsData, loading: adsLoading, refetch: refetchAds } = useMyAds();

  // ✅ OPTIMIZATION: Use shared compliance service with caching
  // Fetch initial screen data
  const fetchScreenData = useCallback(async () => {
    try {
      const complianceData = await screenComplianceService.getCompliance(null, false);
      
      if (complianceData.success && complianceData.data?.screens) {
        setScreens(complianceData.data.screens);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching screen data:', error);
    }
  }, []);

  // WebSocket integration for real-time updates
  useEffect(() => {
    // Check initial WebSocket connection status
    if (playbackWebSocketService.isWebSocketConnected()) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('connecting');
    }
    
    // Subscribe to real-time device updates
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      
      // Update connection status to connected when we receive any update
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
      }
      
      if (update.type === 'deviceUpdate') {
        // Update specific device status in real-time
        updateDeviceStatus(update.deviceId, update.isOnline ?? false, update.lastSeen);
      } else if (update.type === 'deviceList') {
        // Update all devices at once
        updateAllDevices(update.devices ?? []);
      } else if (update.type === 'locationUpdate') {
        // Handle real-time location updates
        updateDeviceLocation(update.deviceId, update.location);
      }
    });

    // Set up periodic connection status check
    const statusCheckInterval = setInterval(() => {
      const isConnected = playbackWebSocketService.isWebSocketConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 5000); // Check every 5 seconds

    // Initial data fetch
    fetchScreenData();
    
    // Also refetch ads data when component mounts
    refetchAds();

    // Cleanup subscription on unmount
    return () => {
      clearInterval(statusCheckInterval);
      unsubscribe();
    };
  }, [connectionStatus, fetchScreenData, refetchAds]);

  // Helper function to update device status in real-time
  const updateDeviceStatus = useCallback((deviceId: string, isOnline: boolean, lastSeen?: string) => {
    setScreens(prevScreens => {
      const updatedScreens = prevScreens.map(screen => {
        // Check if this device matches either slot or the main device ID
        const isSlot1Device = screen.slot1DeviceId === deviceId;
        const isSlot2Device = screen.slot2DeviceId === deviceId;
        const isMainDevice = screen.deviceId === deviceId;
        
        if (isSlot1Device || isSlot2Device || isMainDevice) {
          const updatedScreen = { ...screen };
          
          if (isSlot1Device) {
            updatedScreen.slot1Status = isOnline ? 'ONLINE' : 'OFFLINE';
            if (lastSeen) {
              updatedScreen.slot1LastSeen = lastSeen;
            }
          }
          
          if (isSlot2Device) {
            updatedScreen.slot2Status = isOnline ? 'ONLINE' : 'OFFLINE';
            if (lastSeen) {
              updatedScreen.slot2LastSeen = lastSeen;
            }
          }
          
          // If it's the main device ID, update the overall online status directly
          if (isMainDevice) {
            updatedScreen.isOnline = isOnline;
            updatedScreen.lastSeen = lastSeen || updatedScreen.lastSeen;
          }
          
          // Update overall online status based on master/slave logic
          const slot1Online = updatedScreen.slot1Status?.toLowerCase() === 'online';
          const slot2Online = updatedScreen.slot2Status?.toLowerCase() === 'online';
          updatedScreen.isOnline = slot1Online || slot2Online;
          
          return updatedScreen;
        }
        
        return screen;
      });
      
      setLastUpdate(new Date());
      return updatedScreens;
    });
  }, []);

  // Helper function to update all devices at once
  const updateAllDevices = useCallback((devices: any[]) => {
    if (!devices || devices.length === 0) return;
    
    setScreens(prevScreens => {
      return prevScreens.map(screen => {
        const updatedScreen = { ...screen };
        
        // Find matching devices for this screen
        const slot1Device = devices.find(device => device.deviceId === screen.slot1DeviceId);
        const slot2Device = devices.find(device => device.deviceId === screen.slot2DeviceId);
        const mainDevice = devices.find(device => device.deviceId === screen.deviceId);
        
        if (slot1Device) {
          updatedScreen.slot1Status = slot1Device.isOnline ? 'ONLINE' : 'OFFLINE';
          updatedScreen.slot1LastSeen = slot1Device.lastSeen;
        }
        
        if (slot2Device) {
          updatedScreen.slot2Status = slot2Device.isOnline ? 'ONLINE' : 'OFFLINE';
          updatedScreen.slot2LastSeen = slot2Device.lastSeen;
        }
        
        // If it's the main device, update overall status directly
        if (mainDevice) {
          updatedScreen.isOnline = mainDevice.isOnline;
          updatedScreen.lastSeen = mainDevice.lastSeen || updatedScreen.lastSeen;
        }
        
        // Update overall online status based on slot status
        const slot1Online = updatedScreen.slot1Status?.toLowerCase() === 'online';
        const slot2Online = updatedScreen.slot2Status?.toLowerCase() === 'online';
        updatedScreen.isOnline = slot1Online || slot2Online;
        
        return updatedScreen;
      });
    });
    setLastUpdate(new Date());
  }, []);

  // Helper function to update device location in real-time
  const updateDeviceLocation = useCallback((deviceId: string, locationData: any) => {
    if (!locationData || !locationData.lat || !locationData.lng) {
      return;
    }
    
    setScreens(prevScreens => {
      return prevScreens.map(screen => {
        // Check if this device matches any of the screen's device IDs
        const isMatchingDevice = screen.deviceId === deviceId || 
                                screen.slot1DeviceId === deviceId || 
                                screen.slot2DeviceId === deviceId;
        
        if (isMatchingDevice) {
          const updatedScreen = {
            ...screen,
            currentLocation: {
              lat: locationData.lat,
              lng: locationData.lng,
              speed: locationData.speed || 0,
              heading: locationData.heading || 0,
              accuracy: locationData.accuracy || 0,
              address: locationData.address || screen.currentLocation?.address || 'Location not available',
              timestamp: locationData.timestamp || new Date().toISOString()
            },
            // Update online status if provided
            isOnline: locationData.isOnline !== undefined ? locationData.isOnline : screen.isOnline,
            lastSeen: locationData.timestamp || screen.lastSeen
          };
          
          return updatedScreen;
        }
        
        return screen;
      });
    });
    setLastUpdate(new Date());
  }, []);

  // Calculate metrics from user's actual ads
  const userAds = adsData?.getMyAds || [];
  const totalAds = userAds.length; // Total ad campaigns created by user
  
  // Calculate total unique devices with ads assigned (from running/approved ads)
  const runningAdsData = userAds.filter((ad: any) => 
    ad.status === 'RUNNING' || ad.status === 'APPROVED'
  );
  
  // Get all unique device IDs from all running ads
  const uniqueDevicesWithAds = new Set<string>();
  runningAdsData.forEach((ad: any) => {
    if (ad.materialId && Array.isArray(ad.materialId)) {
      ad.materialId.forEach((material: any) => {
        if (material.materialId) {
          uniqueDevicesWithAds.add(material.materialId);
        }
      });
    }
  });
  
  const devicesWithAds = uniqueDevicesWithAds.size; // Total devices with ads deployed
  
  // Calculate device metrics - only count devices that have ads assigned
  // Filter screens to only include devices that have the user's ads
  const userDeviceScreens = screens.filter(s => uniqueDevicesWithAds.has(s.materialId));
  const onlineDevices = userDeviceScreens.filter(s => s.isOnline).length;
  const totalDevices = devicesWithAds; // Total should match devices with ads assigned

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Real-Time Ad Metrics</h3>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            {connectionStatus === 'connected' ? 'Live' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Ads */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Ads</p>
              <p className="text-2xl font-bold text-blue-900">{adsLoading ? '...' : totalAds}</p>
              <p className="text-xs text-blue-500">All ad campaigns</p>
            </div>
            <Monitor className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Deployed Devices (Devices with Ads Assigned) */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Deployed Devices</p>
              <p className="text-2xl font-bold text-blue-900">{adsLoading ? '...' : devicesWithAds}</p>
              <p className="text-xs text-blue-500">Devices with ads deployed</p>
            </div>
            <Monitor className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Online Devices */}
        <div className={`rounded-lg p-4 ${onlineDevices > 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${onlineDevices > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                Online Devices
              </p>
              <p className={`text-2xl font-bold ${onlineDevices > 0 ? 'text-emerald-900' : 'text-orange-900'}`}>
                {onlineDevices}/{totalDevices}
              </p>
              <p className={`text-xs ${onlineDevices > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {onlineDevices > 0 ? 'Ready to play ads' : 'No devices online'}
              </p>
            </div>
            <Monitor className={`w-8 h-8 ${onlineDevices > 0 ? 'text-emerald-500' : 'text-orange-500'}`} />
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Data updates automatically via WebSocket connection
      </div>
    </div>
  );
};

export default RealtimeMetrics;
