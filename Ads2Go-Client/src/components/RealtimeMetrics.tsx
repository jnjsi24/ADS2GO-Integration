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
  // ✅ Exclude archived and rejected ads from the count
  const userAds = (adsData?.getMyAds || []).filter((ad: any) => 
    !ad.isArchived && ad.status !== 'REJECTED' && ad.status !== 'ARCHIVED'
  );
  const totalAds = userAds.length; // Total ad campaigns created by user (excluding archived/rejected)
  
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
    <div className={`${className}`}>
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Total Ads */}
        <div className="flex flex-col bg-white p-4">
          {/* Row 1: Icon + Label */}
          <div className="flex items-center">
            <div
              className="p-2 mr-2 rounded-full bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
              border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
            >
              <Monitor className="w-5 h-5 text-green-700 drop-shadow-sm" />
            </div>
            <p className="text-sm text-black/70 font-medium ml-1">Total Ads</p>
          </div>

          {/* Row 2: Value + Subtitle */}
          <div className="mt-1 ml-12">
            <p className="text-3xl font-semibold text-gray-900">
              {adsLoading ? '...' : totalAds}
            </p>
          </div>
        </div>

        {/* Deployed Devices (Devices with Ads Assigned) */}
        <div className="flex flex-col bg-white p-4">
          {/* Row 1: Icon + Label */}
          <div className="flex items-center">
            <div
              className="p-2 mr-2 rounded-full bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 
              border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
            >
              <Monitor className="w-5 h-5 text-blue-700 drop-shadow-sm" />
            </div>
            <p className="text-sm text-black/70 font-medium ml-1">Deployed Devices</p>
          </div>

          {/* Row 2: Value + Subtitle */}
          <div className="mt-1 ml-12">
            <p className="text-3xl font-semibold text-gray-900">
              {adsLoading ? '...' : devicesWithAds}
            </p>
          </div>
        </div>

        {/* Online Devices */}
        <div className="flex flex-col bg-white p-4">
          {/* Row 1: Icon + Label */}
          <div className="flex items-center">
            <div
              className={`p-2 mr-2 rounded-full bg-gradient-to-br ${
                onlineDevices > 0
                  ? 'from-emerald-300/60 via-emerald-300/40 to-white/40'
                  : 'from-orange-300/60 via-orange-300/40 to-white/40'
              } border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center`}
            >
              <Monitor
                className={`w-5 h-5 drop-shadow-sm ${
                  onlineDevices > 0 ? 'text-emerald-700' : 'text-orange-700'
                }`}
              />
            </div>
            <p className="text-sm font-medium ml-1 text-black/70">Online Devices</p>
          </div>

          {/* Row 2: Value + Subtitle (side by side) */}
          <div className="mt-1 ml-12 flex items-baseline space-x-2">
            <p className="text-3xl font-semibold text-gray-900">{onlineDevices}</p>
            <span className="text-xl">/ {totalDevices}</span>
          </div>

          {/* Optional Subtitle */}
          <p
            className={`ml-12 text-xs mt-1 ${
              onlineDevices > 0 ? 'text-emerald-500' : 'text-orange-500'
            }`}
          >
          </p>
        </div>
      </div>
    </div>
  );
};

export default RealtimeMetrics;
