import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import { LatLngTuple, Map as LeafletMap, Icon } from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import { AdminLoader } from "../../components/ProtectedRoute";
import playbackWebSocketService from '../../services/playbackWebSocketService';
import { screenComplianceService } from '../../services/screenComplianceService';
import MapView from '../../components/MapView';
import RouteMapped from '../../components/RouteMapped';
import { 
  Clock, 
  Car, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Users,
  Activity, 
  BarChart3
} from 'lucide-react';


interface ScreenStatus {
  deviceId: string;
  displayId?: string; // Unique display identifier (e.g., "DGL-HEADDRESS-CAR-001-SLOT-1")
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
  statusText?: string; // Explicit slot statuses (e.g., "SLOT 1: OFFLINE | SLOT 2: OFFLINE")
  slot1Status?: string; // Individual slot 1 status
  slot2Status?: string; // Individual slot 2 status
  slot1DeviceId?: string; // Actual device ID for slot 1
  slot2DeviceId?: string; // Actual device ID for slot 2
  masterDeviceId?: string; // Device ID that handles analytics tracking
  slot1LastSeen?: string; // Last seen timestamp for slot 1
  slot2LastSeen?: string; // Last seen timestamp for slot 2
  screenMetrics?: {
    displayHours: number;
    adPlayCount: number;
    lastAdPlayed: string;
    brightness: number;
    volume: number;
    isDisplaying: boolean;
    maintenanceMode: boolean;
  };
  alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
    isResolved: boolean;
    severity: string;
  }>;
  // Additional fields for material-level screens (used in map)
  totalDevices?: number;
  onlineDevices?: number;
  totalHours?: number;
  totalDistance?: number;
}

interface ComplianceReport {
  date: string;
  totalScreens: number;
  onlineScreens: number;
  compliantScreens: number;
  nonCompliantScreens: number;
  averageHours: number;
  averageDistance: number;
  screens: ScreenStatus[];
}

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  accuracy: number;
  address: string;
}

interface PathData {
  deviceId: string;
  materialId: string;
  locationHistory: LocationPoint[];
  totalPoints: number;
  totalDistance: number;
}

interface Material {
  _id: string;
  materialId: string;
  materialType: 'HEADDRESS' | 'LCD' | 'BILLBOARD' | 'DIGITAL_DISPLAY';
  title: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✨ Client-side reverse geocoding helper with caching
const geocodingCache = new Map<string, string>();
const reverseGeocodeClient = async (lat: number, lng: number): Promise<string> => {
  // Round coordinates to 4 decimal places for caching (about 11m accuracy)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  if (geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey)!;
  }
  
  try {
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Ads2Go-AdminClient/1.0' // Required by Nominatim
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      const addressParts = [];
      
      // Build address from most specific to least specific
      if (addr.house_number) addressParts.push(addr.house_number);
      if (addr.road) addressParts.push(addr.road);
      if (addr.neighbourhood || addr.suburb) addressParts.push(addr.neighbourhood || addr.suburb);
      if (addr.city || addr.town || addr.village) addressParts.push(addr.city || addr.town || addr.village);
      if (addr.state) addressParts.push(addr.state);
      if (addr.country) addressParts.push(addr.country);
      
      const address = addressParts.join(', ') || `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      geocodingCache.set(cacheKey, address); // Cache the result
      return address;
    }
    
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  } catch (error) {
    console.warn('Client-side geocoding failed:', error);
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  }
};

const ScreenTracking: React.FC = () => {
  const [screens, setScreens] = useState<ScreenStatus[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]); // Will be set dynamically based on real device locations
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');
  const [historicalRouteData, setHistoricalRouteData] = useState<any>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [clearMap, setClearMap] = useState(false); // Flag to clear map
  const [showMap, ] = useState(true); // Control map visibility
  const [openPopupForSelected, setOpenPopupForSelected] = useState(false); // Flag to open popup for selected screen
  const [currentTime, setCurrentTime] = useState(new Date()); // Current time for display
  const [routeRefreshTrigger, setRouteRefreshTrigger] = useState(0); // Trigger to force RouteMapped refresh
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Helper function to validate coordinates
  const isValidCoordinate = (lat: number, lng: number): boolean => {
    return typeof lat === 'number' && typeof lng === 'number' &&
           !isNaN(lat) && !isNaN(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180 &&
           lat !== 0 && lng !== 0;
  };

  // Helper function to calculate map center from real device locations
  const calculateMapCenter = (screens: ScreenStatus[]): [number, number] => {
    const validLocations = screens
      .filter(screen => screen.currentLocation && 
        isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng))
      .map(screen => screen.currentLocation!);
    
    // Only log map center calculations in verbose mode
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
      console.log(`🗺️ [Map Center] Valid locations: ${validLocations.length}`, validLocations);
    }
    
    if (validLocations.length === 0) {
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
        console.log(`🗺️ [Map Center] No valid locations, using Manila fallback`);
      }
      return [14.5995, 120.9842]; // Manila fallback only when no real data
    }
    
    if (validLocations.length === 1) {
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
        console.log(`🗺️ [Map Center] Single location:`, [validLocations[0].lat, validLocations[0].lng]);
      }
      return [validLocations[0].lat, validLocations[0].lng];
    }
    
    // Calculate center point from all real device locations
    const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
    const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length;
    
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
      console.log(`🗺️ [Map Center] Multiple locations, calculated center:`, [avgLat, avgLng]);
    }
    return [avgLat, avgLng];
  };
  const [zoom, setZoom] = useState(12);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  
  // Simplified route display - only road snapping enabled
  const snapToRoads = true;      // Always snap to roads for accurate route display

  const mapRef = useRef<Map | null>(null);

  // Clear historical route data when switching tabs or screens
  // RouteMapped component will handle all fetching via its own useEffect
  useEffect(() => {
    // Only log tab changes in verbose mode
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
      console.log('🔄 Tab/Selection changed:', { activeTab, selectedScreen: selectedScreen?.deviceId, selectedDate });
    }
    
    // Clear historical route data when switching to live tab or when no screen is selected
    if (activeTab === 'live' || !selectedScreen) {
      // Only log clearing in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
        console.log('🧹 Clearing historical route data');
      }
      setHistoricalRouteData(null);
      setClearMap(true); // Flag to clear map
      return;
    }
    
    // For historical tab with selected screen, clear previous data
    // RouteMapped will fetch the data when it mounts/updates
    if (activeTab === 'historical' && selectedScreen && selectedDate) {
      console.log('🔄 [ScreenTracking] Historical tab active - RouteMapped will handle fetching');
      // Clear previous data before RouteMapped fetches new data
      setHistoricalRouteData(null);
      setClearMap(true); // Flag to clear map
    }
  }, [activeTab, selectedScreen, selectedDate]);

  // 🔄 AUTO-REFRESH: Update route map every 2 seconds when viewing Route Map tab
  // ✅ FIX: Only refresh if trip is still active (today's date and not completed)
  useEffect(() => {
    // Only auto-refresh when on historical tab with a selected screen
    if (activeTab !== 'historical' || !selectedScreen || !selectedDate) {
      return;
    }

    // Check if the requested date is today (Philippines timezone)
    const now = new Date();
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const todayDate = philippinesTime.toISOString().split('T')[0];
    const isToday = selectedDate === todayDate;

    // If not today, trip is completed - don't auto-refresh
    if (!isToday) {
      console.log('🛑 [Auto-Refresh] Trip is from past date - auto-refresh disabled');
      return;
    }

    console.log('🔄 [Auto-Refresh] Starting route map auto-refresh every 2 seconds (trip is active)');
    
    // Set up interval to refresh route data every 2 seconds
    const refreshInterval = setInterval(() => {
      // Check if trip has ended by checking the last route data's endTime
      // If historicalRouteData exists and has an endTime, check if it's more than 5 minutes ago
      if (historicalRouteData?.metrics?.endTime) {
        const endTime = new Date(historicalRouteData.metrics.endTime);
        const timeSinceEnd = now.getTime() - endTime.getTime();
        const fiveMinutesInMs = 5 * 60 * 1000;
        
        if (timeSinceEnd > fiveMinutesInMs) {
          console.log('🛑 [Auto-Refresh] Trip ended more than 5 minutes ago - stopping auto-refresh');
          clearInterval(refreshInterval);
          return;
        }
      }
      
      console.log('🔄 [Auto-Refresh] Triggering route refresh for:', selectedScreen.materialId);
      // Increment trigger to force RouteMapped component to re-fetch
      setRouteRefreshTrigger(prev => prev + 1);
    }, 2000); // Refresh every 2 seconds

    // Cleanup interval when conditions change or component unmounts
    return () => {
      console.log('🔄 [Auto-Refresh] Stopping route map auto-refresh');
      clearInterval(refreshInterval);
    };
  }, [activeTab, selectedScreen, selectedDate, historicalRouteData]);


  // Fetch materials list
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const materialsUrl = `${baseUrl}/material`;
      
      const response = await fetch(materialsUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch materials:', response.status, response.statusText);
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setMaterialsLoading(false);
    }
  };

    // Fetch compliance report and tablet data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setConnectionStatus('connecting');
      
      // ✅ PHASE 2 OPTIMIZATION: Use shared compliance service with caching
      // For live tab: Use null as date (always get today's real-time data)
      // For historical tab: Use selectedDate (get specific date's archived data)
      const dateParam = activeTab === 'live' ? null : selectedDate;
      
      const complianceData = await screenComplianceService.getCompliance(dateParam, false);
      
      if (complianceData.success) {
        setComplianceReport(complianceData.data);
        const screensData = complianceData.data?.screens || [];
        setScreens(screensData); // Individual device records for screen list
        
        // Note: materialScreens are now handled via the screens state
        // The screens array already contains all the necessary data for map display
        
        setConnectionStatus('connected');

        // Auto-center map on real device locations
        if (complianceData.data?.screens?.length > 0) {
          const newCenter = calculateMapCenter(complianceData.data.screens);
          // Only log map center updates in verbose mode
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
            // Only log map center updates in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
        console.log(`🗺️ [Map Center Update] Setting map center to:`, newCenter);
      }
          }
          setMapCenter(newCenter);
        }
      } else {
        const errorData = await complianceResponse.json();
        console.error('API Error:', errorData);
        setConnectionStatus('disconnected');
      }

     } catch (error) {
       console.error('Error fetching data:', error);
       setConnectionStatus('disconnected');
     } finally {
       setLoading(false);
       setRefreshing(false);
     }
   }, [selectedDate, activeTab]); // Re-fetch when date OR tab changes

  // 🔄 AUTO-REFRESH: Update device positions every 2 seconds when viewing Live Tracking tab
  useEffect(() => {
    // Only auto-refresh when on live tab
    if (activeTab !== 'live') {
      return;
    }

    console.log('🔄 [Auto-Refresh Live] Starting device position auto-refresh every 2 seconds');
    
    // Fetch device data immediately when starting
    fetchData();
    
    // Set up interval to refresh device positions every 2 seconds
    const liveRefreshInterval = setInterval(() => {
      console.log('🔄 [Auto-Refresh Live] Refreshing device positions');
      fetchData();
    }, 2000); // Refresh every 2 seconds

    // Cleanup interval when conditions change or component unmounts
    return () => {
      console.log('🔄 [Auto-Refresh Live] Stopping device position auto-refresh');
      clearInterval(liveRefreshInterval);
    };
  }, [activeTab, fetchData]);

  // Update map center when screens change
  useEffect(() => {
    if (screens && screens.length > 0) {
      const newCenter = calculateMapCenter(screens);
      // Only log map center updates in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
        console.log(`🗺️ [Map Center Update] Setting map center to:`, newCenter);
      }
      setMapCenter(newCenter);
    }
  }, [screens]);


  // Auto-refresh data every 30 seconds (but not on Live Tracking tab - it has its own 2s refresh)
  useEffect(() => {
    fetchData();
    fetchMaterials();
    
    // Only set up 30-second interval if NOT on Live Tracking tab
    if (activeTab !== 'live') {
      // Auto-refresh enabled - refresh every 30 seconds for data consistency
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedDate, fetchData, activeTab]);

  // Auto-update selectedDate when day changes (for live tab)
  useEffect(() => {
    if (activeTab === 'live') {
      // Check every minute if the day has changed
      const dayCheckInterval = setInterval(() => {
        const currentDate = new Date().toISOString().split('T')[0];
        if (currentDate !== selectedDate) {
          console.log(`📅 [Day Change] Updating from ${selectedDate} to ${currentDate}`);
          setSelectedDate(currentDate);
        }
      }, 60000); // Check every minute
      
      return () => clearInterval(dayCheckInterval);
    }
  }, [activeTab, selectedDate]);

  // Auto-update current time display every 30 seconds
  useEffect(() => {
    const timeUpdateInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(timeUpdateInterval);
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
        // Handle real-time location updates for live map
        console.log('📍 [ScreenTracking] Received location update:', update);
        updateDeviceLocation(update.deviceId, update.location);
      } else if (update.type === 'adPlaybackUpdate') {
        // Handle ad playback updates that might affect device status
        console.log('🎬 [ScreenTracking] Received playback update:', update);
        // You can add logic here if needed for ad-related updates
      }
    });

    // Set up periodic connection status check
    const statusCheckInterval = setInterval(() => {
      const isConnected = playbackWebSocketService.isWebSocketConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 5000); // Check every 5 seconds

    // Cleanup subscription on unmount
    return () => {
      clearInterval(statusCheckInterval);
      unsubscribe();
    };
  }, [connectionStatus]);

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
          
          console.log(`🔄 [ScreenTracking] Updated screen ${screen.materialId}:`, {
            slot1Status: updatedScreen.slot1Status,
            slot2Status: updatedScreen.slot2Status,
            isOnline: updatedScreen.isOnline,
            deviceId: screen.deviceId,
            slot1DeviceId: screen.slot1DeviceId,
            slot2DeviceId: screen.slot2DeviceId
          });
          
          return updatedScreen;
        }
        
        return screen;
      });
      
      console.log(`🔄 [ScreenTracking] Updated screens after update:`, updatedScreens.length);
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
  }, []);

  // ✅ FIX: Helper function to update device location with timestamp validation
  const updateDeviceLocation = useCallback((deviceId: string, locationData: any, source: 'websocket' | 'polling' | 'legacy' = 'websocket') => {
    if (!locationData || !locationData.lat || !locationData.lng) {
      console.warn('Invalid location data received:', locationData);
      return;
    }
    
    setScreens(prevScreens => {
      return prevScreens.map(screen => {
        // Check if this device matches any of the screen's device IDs
        const isMatchingDevice = screen.deviceId === deviceId || 
                                screen.slot1DeviceId === deviceId || 
                                screen.slot2DeviceId === deviceId;
        
        if (isMatchingDevice) {
          // ✅ TIMESTAMP VALIDATION: Only accept newer locations
          const newTimestamp = new Date(locationData.timestamp || new Date()).getTime();
          const currentTimestamp = screen.currentLocation?.timestamp 
            ? new Date(screen.currentLocation.timestamp).getTime() 
            : 0;
          
          if (newTimestamp <= currentTimestamp) {
            console.log(`📍 [ScreenTracking] Ignoring stale location for ${deviceId}:`, {
              newTimestamp: new Date(newTimestamp).toISOString(),
              currentTimestamp: new Date(currentTimestamp).toISOString(),
              diff: ((newTimestamp - currentTimestamp) / 1000) + 's'
            });
            return screen; // Keep existing location
          }
          
          // ✅ PREFER WEBSOCKET: If current is from WebSocket and new is from polling, require newer
          const isCurrentFromWebSocket = screen.currentLocation?.source === 'websocket';
          const isNewFromPolling = source === 'polling';
          
          if (isCurrentFromWebSocket && isNewFromPolling) {
            const timeDiff = newTimestamp - currentTimestamp;
            if (timeDiff < 5000) {
              console.log(`📍 [ScreenTracking] Ignoring polling update, WebSocket is more recent`);
              return screen;
            }
          }
          
          console.log(`📍 [ScreenTracking] Accepting newer location for ${screen.materialId}:`, {
            source,
            lat: locationData.lat.toFixed(6),
            lng: locationData.lng.toFixed(6),
            timestamp: new Date(newTimestamp).toISOString()
          });
          
          // ✨ Preserve existing geocoded address if new one is just coordinates
          let addressToUse = locationData.address || screen.currentLocation?.address;
          if (addressToUse && addressToUse.startsWith('Location:')) {
            // Server sent coordinates, preserve existing geocoded address if available
            addressToUse = screen.currentLocation?.address && !screen.currentLocation.address.startsWith('Location:') 
              ? screen.currentLocation.address 
              : addressToUse;
          }
          
          const updatedScreen = {
            ...screen,
            currentLocation: {
              lat: locationData.lat,
              lng: locationData.lng,
              speed: locationData.speed || 0,
              heading: locationData.heading || 0,
              accuracy: locationData.accuracy || 0,
              address: addressToUse || 'Location not available',
              timestamp: new Date(newTimestamp).toISOString(),
              source: source // Track source
            },
            isOnline: locationData.isOnline !== undefined ? locationData.isOnline : screen.isOnline,
            lastSeen: new Date(newTimestamp).toISOString()
          };
          
          // ✨ Geocode address if it's missing or just coordinates (async, update after geocoding)
          if (updatedScreen.currentLocation.address.startsWith('Location:') || !updatedScreen.currentLocation.address) {
            reverseGeocodeClient(updatedScreen.currentLocation.lat, updatedScreen.currentLocation.lng)
              .then(address => {
                setScreens(prevScreens => prevScreens.map(s => 
                  s.materialId === screen.materialId 
                    ? { ...s, currentLocation: { ...s.currentLocation, address } }
                    : s
                ));
              })
              .catch(err => console.warn('Failed to geocode location update:', err));
          }
          
          return updatedScreen;
        }
        
        return screen;
      });
    });
  }, []);

  // Note: Path data is now fetched by auto-refresh effects above
  // This ensures smooth updates every 2 seconds for both Live and Route Map tabs

  // Handle popup opening for selected screen
  useEffect(() => {
    if (openPopupForSelected && selectedScreen) {
      // Reset the flag after a short delay to allow the marker to render
      const timer = setTimeout(() => {
        setOpenPopupForSelected(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [openPopupForSelected, selectedScreen]);

  const handleScreenSelect = (screen: ScreenStatus) => {
    setSelectedScreen(screen);
    if (screen.currentLocation && isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)) {
      setMapCenter([screen.currentLocation.lat, screen.currentLocation.lng]);
      setZoom(15);
    } else {
      // If no valid coordinates, center on a default location or keep current center
      // You can set a default location for Manila/Philippines if needed
      console.log(`📍 [ScreenSelection] No valid coordinates for ${screen.materialId}, keeping current map center`);
    }
    
    // Trigger popup opening for the selected screen
    setOpenPopupForSelected(true);
  };

  const getStatusColor = (isOnline: boolean) => {
    if (!isOnline) return 'text-red-500';    // Offline = Red
    return 'text-green-500';                  // Online = Green
  };

  const getStatusIcon = (isOnline: boolean) => {
    if (!isOnline) return <XCircle className="w-4 h-4" />;        // Offline = ✕
    return <CheckCircle className="w-4 h-4" />;                   // Online = ✓
  };

  const formatTime = (hours: number | undefined | null) => {
    if (hours === undefined || hours === null || isNaN(hours)) {
      return '0h 0m';
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const formatDistance = (distance: number | undefined | null) => {
    if (distance === undefined || distance === null || isNaN(distance)) {
      return '0.00 km';
    }
    return `${distance.toFixed(2)} km`;
  };

  const shortenDeviceId = (deviceId: string | undefined | null) => {
    if (!deviceId) return 'Not connected';
    
    // If it's a TABLET device ID, extract the key parts
    if (deviceId.startsWith('TABLET-')) {
      const parts = deviceId.split('-');
      if (parts.length >= 3) {
        // Extract manufacturer, model, and last part (timestamp)
        const manufacturer = parts[1];
        const model = parts[2];
        const timestamp = parts[parts.length - 1];
        return `${manufacturer}-${model}-${timestamp.slice(-8)}`; // Last 8 chars of timestamp
      }
    }
    
    // If it's too long, truncate it
    if (deviceId.length > 30) {
      return `${deviceId.substring(0, 20)}...${deviceId.slice(-8)}`;
    }
    
    return deviceId;
  };

  const shouldShowAnalyticsBadge = (screen: ScreenStatus, deviceId: string | undefined | null) => {
    if (!deviceId) return false;
    
    // Use the masterDeviceId from backend - this is the centralized master device determination
    return screen.masterDeviceId === deviceId;
  };



  // Inject CSS to ensure custom vehicle icons render properly
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-vehicle-icon {
        background: transparent !important;
        border: none !important;
      }
      .custom-vehicle-icon div {
        background-color: inherit !important;
      }
      .custom-pin-icon {
        background: transparent !important;
        border: none !important;
      }
      .custom-pin-icon div {
        background-color: inherit !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Create vehicle icon based on screen type and online status
  const createVehicleIcon = (screenType: string, isOnline: boolean, offsetIndex: number = 0) => {
    const baseColor = isOnline ? '#22c55e' : '#ef4444';
    const borderColor = isOnline ? '#16a34a' : '#dc2626';
    
    // Offset positions for overlapping markers (in pixels) - larger offsets for better separation
    const offsets = [
      { x: 0, y: 0 },      // First marker - no offset
      { x: 30, y: -25 },   // Second marker - larger offset right and up
      { x: -30, y: 25 },   // Third marker - larger offset left and down
      { x: 35, y: 30 },    // Fourth marker - larger offset right and down
      { x: -35, y: -30 },  // Fifth marker - larger offset left and up
    ];
    
    const offset = offsets[offsetIndex % offsets.length];
    
    // Choose vehicle emoji based on screen type
    let vehicleEmoji = '🚗'; // Default car
    switch (screenType) {
      case 'HEADDRESS':
        vehicleEmoji = '🏍️'; // Motorcycle for headdress
        break;
      case 'LCD':
        vehicleEmoji = '🚐'; // Van for LCD screens
        break;
      case 'BILLBOARD':
        vehicleEmoji = '🚛'; // Truck for billboards
        break;
      case 'DIGITAL_DISPLAY':
        vehicleEmoji = '🚌'; // Bus for digital displays
        break;
      default:
        vehicleEmoji = '🚗'; // Default car
    }
    
    const iconHtml = `
      <div style="
        width: 40px !important; 
        height: 40px !important; 
        background-color: ${baseColor} !important; 
        border: 3px solid ${borderColor} !important; 
        border-radius: 50% !important; 
        box-shadow: 0 4px 8px rgba(0,0,0,0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: relative !important;
        z-index: ${1000 + offsetIndex} !important;
        transform: translate(${offset.x}px, ${offset.y}px) !important;
        font-size: 20px !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: all 0.2s ease !important;
      " onmouseover="this.style.transform='translate(${offset.x}px, ${offset.y}px) scale(1.1)'" onmouseout="this.style.transform='translate(${offset.x}px, ${offset.y}px) scale(1)'">
        <span style="
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)) !important;
        ">${vehicleEmoji}</span>
      </div>
    `;
    
    return new L.DivIcon({
      html: iconHtml,
      className: 'custom-vehicle-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  };

  if (loading || materialsLoading) {
    return <AdminLoader />;
  }

  return (
    <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-5' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 transition-all duration-300`}>
      {/* Header */}
      <div className="bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className={`flex ${isMobile ? 'flex-col gap-4' : 'justify-between items-center'} py-4`}>
            <div>
              <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-gray-900`}>Device Tracking Dashboard</h1>
            </div>
            <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'items-center space-x-2'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              {activeTab === 'historical' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={(() => {
                    // Get the material creation date for validation
                    if (selectedScreen && selectedScreen.materialId && materials.length > 0) {
                      const material = materials.find(m => m.materialId === selectedScreen.materialId);
                      if (material && material.createdAt) {
                        // Return the creation date as min date
                        return new Date(material.createdAt).toISOString().split('T')[0];
                      }
                    }
                    // Default: Allow dates from 30 days ago
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return thirtyDaysAgo.toISOString().split('T')[0];
                  })()}
                  max={new Date().toISOString().split('T')[0]}
                  className={`shadow-md rounded px-3 py-2 ${isMobile ? 'w-full' : ''}`}
                  title={(() => {
                    if (selectedScreen && selectedScreen.materialId && materials.length > 0) {
                      const material = materials.find(m => m.materialId === selectedScreen.materialId);
                      if (material && material.createdAt) {
                        const createdDate = new Date(material.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                        return `Material created on ${createdDate}. Only dates from this date onwards are available.`;
                      }
                    }
                    return 'Select a date to view historical route';
                  })()}
                />
              )}
              <button
                onClick={fetchData}
                disabled={refreshing}
                className={`flex items-center ${isMobile ? 'justify-center w-full' : 'space-x-2'} bg-[#3674B5] text-white px-4 py-2 rounded hover:shadow-md disabled:opacity-50`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {!isMobile && <span>Refresh</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl bg-gray-100 mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex ${isMobile ? 'space-x-2 overflow-x-auto' : 'space-x-3'}`}>
          <button
            onClick={() => setActiveTab('live')}
            className={`relative py-4 px-1 font-medium text-sm transition-colors group ${
              activeTab === 'live'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Live Tracking</span>
            </div>
            <span
              className={`absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-300 ${
                activeTab === 'live' ? 'w-full' : 'w-0 group-hover:w-full'
              }`}
            />
          </button>
          <button
            onClick={() => setActiveTab('historical')}
            className={`relative py-4 px-1 font-medium text-sm transition-colors group ${
              activeTab === 'historical'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Route Map</span>
            </div>
            <span
              className={`absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-300 ${
                activeTab === 'historical' ? 'w-full' : 'w-0 group-hover:w-full'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Compliance Summary */}
      {complianceReport && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-2`}>
            <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-blue-100 rounded-lg`}>
                  <Users className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600`} />
                </div>
                <div className={`${isMobile ? 'ml-3' : 'ml-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Total Screens</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>{screens?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-green-100 rounded-lg`}>
                  <Activity className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-green-600`} />
                </div>
                <div className={`${isMobile ? 'ml-3' : 'ml-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Online</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>{screens?.filter(s => s.isOnline).length || 0}</p>
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-green-100 rounded-lg`}>
                  <CheckCircle className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-green-600`} />
                </div>
                <div className={`${isMobile ? 'ml-3' : 'ml-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Compliant (8h)</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>{screens?.filter(s => s.isCompliant).length || 0}</p>
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-yellow-100 rounded-lg`}>
                  <Clock className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-yellow-600`} />
                </div>
                <div className={`${isMobile ? 'ml-3' : 'ml-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Avg Hours</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
                    {screens && screens.length > 0 
                      ? (screens.reduce((sum, s) => sum + (s.currentHours || 0), 0) / screens.length).toFixed(1)
                      : '0.0'
                    }h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-3`}>
          {/* Map */}
          <div className={`${isMobile ? '' : 'lg:col-span-2'}`}>
            <div className="bg-white rounded-lg shadow">
              <div className={`${isMobile ? 'p-3' : 'p-4'} border-b`}>
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
                  <div>
                    <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>
                      {activeTab === 'historical' ? 'Historical Routes' : 'Live Map'}
                    </h2>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                      {activeTab === 'historical' 
                        ? `Historical routes for ${selectedDate}` 
                        : 'Real-time tablet locations and routes'
                      }
                    </p>
                  </div>
                  {activeTab === 'historical' && (
                    <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'items-center space-x-4'}`}>
                      <button
                        onClick={() => {
                          if (selectedScreen) {
                            console.log('🔄 Manual load route clicked - triggering RouteMapped refresh');
                            // RouteMapped component handles fetching - just trigger a refresh
                            setRouteRefreshTrigger(prev => prev + 1);
                          } else {
                            console.log('⚠️ No screen selected for historical route');
                          }
                        }}
                        disabled={loadingHistorical || !selectedScreen}
                        className={`flex items-center ${isMobile ? 'justify-center w-full' : 'space-x-2'} px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 ${isMobile ? 'text-xs' : 'text-sm'}`}
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingHistorical ? 'animate-spin' : ''}`} />
                        <span>{loadingHistorical ? 'Loading...' : 'Load Route'}</span>
                      </button>
                      
                      <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500`}>
                        {selectedScreen ? `Device: ${selectedScreen.deviceId}` : 'No device selected'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={`${isMobile ? 'h-64' : 'h-96'} relative`}>
                {!showMap && (
                  <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Updating map...</p>
                    </div>
                  </div>
                )}
                {showMap && (() => {
                  // Determine if we should show the Strava-style map for historical data
                  const shouldShowStravaMap = activeTab === 'historical' && selectedScreen && selectedScreen.materialId;
                  
                  // Get the material ID to use
                  const mapMaterialId = selectedScreen?.materialId;
                  
                  return shouldShowStravaMap && mapMaterialId ? (
                    // Strava-style route visualization for historical data
                    <div key={`strava-container-${mapMaterialId}-${selectedDate}`} className="h-full w-full">
                      <RouteMapped
                        key={`route-map-${mapMaterialId}-${selectedDate}`}
                        materialId={mapMaterialId}
                        date={selectedDate}
                        snapToRoads={snapToRoads}
                        refreshTrigger={routeRefreshTrigger}
                        onRouteLoad={(data) => {
                          setHistoricalRouteData(data);
                        }}
                        onLoadingChange={(isLoading) => {
                          setLoadingHistorical(isLoading);
                        }}
                      />
                      
                      {/* Debug info */}
                      <div className="absolute top-4 left-4 bg-white p-2 rounded shadow text-xs z-[1000]">
                        <div>Selected Screen: {selectedScreen?.deviceId || 'N/A'}</div>
                        <div>Material ID: {mapMaterialId}</div>
                        <div>Date: {selectedDate}</div>
                        <div>Filtered Screens: {screens?.length || 0}</div>
                        <div className="flex items-center gap-1 mt-1 text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Auto-refresh active (2s)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <MapView 
                      key={`map-${selectedDate}`}
                      center={mapCenter}
                      zoom={zoom}
                      onMapLoad={(map: LeafletMap) => {
                        // Only log map load in verbose mode
                        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
                          console.log(`🗺️ [Map Load] Map loaded with center:`, mapCenter, 'zoom:', zoom);
                        }
                        if (mapRef) {
                          (mapRef as React.MutableRefObject<LeafletMap | null>).current = map;
                        }
                        // Any map initialization code can go here
                      }}
                    >
                      {activeTab === 'live' ? (
                    // Live tracking markers - Real-time updates from WebSocket
                    <>
                      {/* Real-time device markers with vehicle icons and overlap handling */}
                      {(() => {
                        const validScreens = screens?.filter(screen => 
                          screen?.currentLocation && 
                          isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)
                        ) || [];
                        
                        // Only log marker debug in verbose mode
                        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
                          console.log(`🎯 [Marker Debug] Rendering ${validScreens.length} markers for screens:`, 
                            validScreens.map(s => ({ 
                              materialId: s.materialId, 
                              deviceId: s.deviceId, 
                              lat: s.currentLocation?.lat, 
                              lng: s.currentLocation?.lng,
                              isOnline: s.isOnline,
                              slot1Status: s.slot1Status,
                              slot2Status: s.slot2Status
                            })));
                        }
                        
                        return validScreens.map((screen, index) => {
                          // Use the main isOnline field directly for now to debug
                          const isOnline = screen.isOnline;
                          
                          // Add small coordinate offset to prevent exact overlap
                          const baseLat = screen.currentLocation?.lat!;
                          const baseLng = screen.currentLocation?.lng!;
                          const latOffset = index * 0.00001; // ~1 meter offset
                          const lngOffset = index * 0.00001; // ~1 meter offset
                          
                          const position = [baseLat + latOffset, baseLng + lngOffset] as LatLngTuple;
                          
                          // Only log individual marker debug in verbose mode
                          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
                            console.log(`🎯 [Marker Debug] Creating marker ${index} for ${screen.materialId}:`, {
                              materialId: screen.materialId,
                              deviceId: screen.deviceId,
                              isOnline: screen.isOnline,
                              slot1Status: screen.slot1Status,
                              slot2Status: screen.slot2Status,
                              calculatedIsOnline: isOnline,
                            originalPosition: [baseLat, baseLng],
                            offsetPosition: position,
                            offsetIndex: index
                          });
                          }
                          
                          return (
                            <Marker
                              key={`${screen.materialId}-${screen.deviceId}-${index}`}
                              position={position}
                              icon={createVehicleIcon(screen.screenType, isOnline, index)}
                              eventHandlers={{
                                click: (e) => {
                                  console.log(`🎯 [Click Debug] Marker clicked for ${screen.materialId} (${screen.deviceId}) - Online: ${isOnline}`);
                                  handleScreenSelect(screen);
                                },
                              }}
                              ref={(ref) => {
                                // Auto-open popup if this is the selected screen
                                if (ref && selectedScreen && selectedScreen.deviceId === screen.deviceId && openPopupForSelected) {
                                  setTimeout(() => {
                                    ref.openPopup();
                                  }, 50);
                                }
                              }}
                            >
                              <Popup maxWidth={300} maxHeight={400}>
                                <div className="p-3 space-y-3 max-w-xs">
                                  <div className="border-b pb-2">
                                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                      <span className="text-lg">
                                        {screen.screenType === 'HEADDRESS' ? '🏍️' : 
                                         screen.screenType === 'LCD' ? '🚐' : 
                                         screen.screenType === 'BILLBOARD' ? '🚛' : 
                                         screen.screenType === 'DIGITAL_DISPLAY' ? '🚌' : '🚗'}
                                      </span>
                                      Screen Details
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        #{index + 1}
                                      </span>
                                    </h3>
                                  </div>

                                  <div>
                                    <h4 className="font-medium text-gray-900 text-sm">Device Info</h4>
                                    <div className="mt-1 space-y-1 text-xs text-gray-600">
                                      <p>Device ID: {screen.deviceId}</p>
                                      <p>Material: {screen.materialId}</p>
                                      <p>Screen Type: {screen.screenType}</p>
                                      <p className="text-sm text-gray-600">
                                        Status: {isOnline ? 'ONLINE' : 'OFFLINE'} (calculated: {isOnline}, main: {screen.isOnline}, slot1: {screen.slot1Status}, slot2: {screen.slot2Status})
                                      </p>
                                      {screen.currentLocation?.address && (
                                        <p>Location: {screen.currentLocation.address}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="font-medium text-gray-900 text-sm">Today's Progress</h4>
                                    <div className="mt-1 space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-xs text-gray-600">Hours Online:</span>
                                        <span className="font-medium text-xs">{formatTime(screen.currentHours)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-gray-600">Hours Remaining:</span>
                                        <span className="font-medium text-xs">{formatTime(screen.hoursRemaining)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-gray-600">Distance Traveled:</span>
                                        <span className="font-medium text-xs">
                                          {formatDistance(screen.totalDistanceToday)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        });
                      })()}
                  
                  {/* Selected screen marker - always show popup for selected screen */}
                  {selectedScreen && (
                    (() => {
                      // Check if selected screen already has a marker (has valid coordinates)
                      const hasValidCoordinates = selectedScreen.currentLocation && 
                        isValidCoordinate(selectedScreen.currentLocation.lat, selectedScreen.currentLocation.lng);
                      
                      // If it has valid coordinates, it's already rendered above, so don't duplicate
                      if (hasValidCoordinates) {
                        return null;
                      }
                      
                      // If no valid coordinates, show a special marker at a default location
                      // Use Manila coordinates as default location for devices without GPS
                      const defaultPosition: LatLngTuple = [14.5995, 120.9842]; // Manila, Philippines
                      const isOnline = selectedScreen.slot1Status?.toLowerCase() === 'online' || 
                                     selectedScreen.slot2Status?.toLowerCase() === 'online';
                      
                      return (
                        <Marker
                          key={`selected-${selectedScreen.deviceId}`}
                          position={defaultPosition}
                          icon={createVehicleIcon(selectedScreen.screenType, isOnline, 0)}
                          eventHandlers={{
                            click: () => handleScreenSelect(selectedScreen),
                          }}
                          ref={(ref) => {
                            // Auto-open popup when this marker is created
                            if (ref && openPopupForSelected) {
                              setTimeout(() => {
                                ref.openPopup();
                              }, 50);
                            }
                          }}
                        >
                          <Popup maxWidth={300} maxHeight={400}>
                            <div className="p-3 space-y-3 max-w-xs">
                              <div className="border-b pb-2">
                                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                  <span className="text-lg">
                                    {selectedScreen.screenType === 'HEADDRESS' ? '🏍️' : 
                                     selectedScreen.screenType === 'LCD' ? '🚐' : 
                                     selectedScreen.screenType === 'BILLBOARD' ? '🚛' : 
                                     selectedScreen.screenType === 'DIGITAL_DISPLAY' ? '🚌' : '🚗'}
                                  </span>
                                  Screen Details
                                </h3>
                                <div className="text-xs text-yellow-600 mt-1">
                                  ⚠️ No GPS location available
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">Device Info</h4>
                                <div className="mt-1 space-y-1 text-xs text-gray-600">
                                  <p>Device ID: {selectedScreen.deviceId}</p>
                                  <p>Material: {selectedScreen.materialId}</p>
                                  <p>Screen Type: {selectedScreen.screenType}</p>
                                  <p className="text-sm text-gray-600">
                                    Status: {isOnline ? 'ONLINE' : 'OFFLINE'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Location: GPS data not available
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">Today's Progress</h4>
                                <div className="mt-1 space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600">Hours Online:</span>
                                    <span className="font-medium text-xs">{formatTime(selectedScreen.currentHours)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600">Hours Remaining:</span>
                                    <span className="font-medium text-xs">{formatTime(selectedScreen.hoursRemaining)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600">Distance Traveled:</span>
                                    <span className="font-medium text-xs">
                                      {formatDistance(selectedScreen.totalDistanceToday)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })()
                  )}
                    </>
                  ) : (
                    // Historical route markers and polylines
                    <>
                      {/* Historical route polyline */}
                      {(() => {
                        console.log('🔍 Checking historical route data:', { 
                          hasData: !!historicalRouteData, 
                          hasRoute: !!historicalRouteData?.route, 
                          routeLength: historicalRouteData?.route?.length,
                          activeTab 
                        });
                        return historicalRouteData && historicalRouteData.route && historicalRouteData.route.length > 0;
                      })() && !clearMap && (
                        <>
                          <Polyline
                            key={`historical-route-${selectedDate}`}
                            positions={historicalRouteData.route.map((point: any) => [point.lat, point.lng])}
                            color="red"
                            weight={4}
                            opacity={0.8}
                          />
                          {/* Start marker */}
                          {historicalRouteData.route[0] && (
                            <Marker
                              key={`start-marker-${selectedDate}`}
                              position={[historicalRouteData.route[0].lat, historicalRouteData.route[0].lng]}
                              icon={new Icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                              })}
                            >
                              <Popup>
                                <div className="p-2">
                                  <h3 className="font-semibold text-green-600">Route Start</h3>
                                  <p className="text-sm text-gray-600">
                                    {new Date(historicalRouteData.route[0].timestamp).toLocaleString()}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Distance: {historicalRouteData.metrics.totalDistance} km
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Duration: {Math.floor(historicalRouteData.metrics.totalDuration / 60)} minutes
                                  </p>
                                </div>
                              </Popup>
                            </Marker>
                          )}
                          {/* End marker */}
                          {historicalRouteData.route.length > 1 && (
                            <Marker
                              key={`end-marker-${selectedDate}`}
                              position={[
                                historicalRouteData.route[historicalRouteData.route.length - 1].lat, 
                                historicalRouteData.route[historicalRouteData.route.length - 1].lng
                              ]}
                              icon={new Icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                              })}
                            >
                              <Popup>
                                <div className="p-2">
                                  <h3 className="font-semibold text-red-600">Route End</h3>
                                  <p className="text-sm text-gray-600">
                                    {new Date(historicalRouteData.route[historicalRouteData.route.length - 1].timestamp).toLocaleString()}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Total Points: {historicalRouteData.metrics.pointCount}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Ad Plays: {historicalRouteData.metrics.totalAdPlays}
                                  </p>
                                </div>
                              </Popup>
                            </Marker>
                          )}
                        </>
                      )}
                    </>
                  )}
                    </MapView>
                  );
                })()}
                
                {/* Historical Route Information - Only show for non-enhanced map */}
                {activeTab === 'historical' && historicalRouteData && !(selectedScreen && historicalRouteData) && (
                  <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg max-w-sm">
                    <h4 className="font-semibold text-gray-900 mb-2">Historical Route Info</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Device:</span> {historicalRouteData.deviceId}</p>
                      <p><span className="font-medium">Date:</span> {selectedDate}</p>
                      <p><span className="font-medium">Distance:</span> {historicalRouteData.metrics.totalDistance} km</p>
                      <p><span className="font-medium">Duration:</span> {Math.floor(historicalRouteData.metrics.totalDuration / 60)} minutes</p>
                      <p><span className="font-medium">Points:</span> {historicalRouteData.metrics.pointCount}</p>
                      <p><span className="font-medium">Ad Plays:</span> {historicalRouteData.metrics.totalAdPlays}</p>
                      <p><span className="font-medium">Hours Online:</span> {historicalRouteData.metrics.totalHoursOnline}h</p>
                    </div>
                  </div>
                )}
                
                {/* Show message when no tablets have valid location data (Live tab) */}
                {activeTab === 'live' && screens && screens.filter((screen: ScreenStatus) => 
                  screen && 
                  screen.currentLocation && 
                  isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)
                ).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
                    <div className="text-center p-6">
                      <div className="text-gray-500 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Location Data Available</h3>
                      <p className="text-sm text-gray-600">
                        No tablets currently have valid GPS location data to display on the map.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Make sure tablets are online and have GPS permissions enabled.
                      </p>
                    </div>
                  </div>
                )}

                {/* Show message when no historical data is available (Historical tab) */}
                {activeTab === 'historical' && !loadingHistorical && !historicalRouteData && !selectedScreen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
                    <div className="text-center p-6">
                      <div className="text-gray-500 mb-2">
                        <Clock className="w-12 h-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Data</h3>
                      <p className="text-sm text-gray-600">
                        Select a material and date to view historical routes.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Choose a material from the dropdown above to see route data for that date.
                      </p>
                    </div>
                  </div>
                )}

                {/* Show loading message for historical data */}
                {activeTab === 'historical' && loadingHistorical && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
                    <div className="text-center p-6">
                      <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-2" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Historical Route</h3>
                      <p className="text-sm text-gray-600">
                        Fetching route data for {selectedDate}...
                      </p>
                    </div>
                  </div>
                )}

                {/* Show message when historical data exists but has no route */}
                {activeTab === 'historical' && historicalRouteData && (!historicalRouteData.route || historicalRouteData.route.length === 0) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
                    <div className="text-center p-6">
                      <div className="text-gray-500 mb-2">
                        <Clock className="w-12 h-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Route Data Available</h3>
                      <p className="text-sm text-gray-600">
                        Historical data exists for this device and date, but no route points were recorded.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        The device may not have been moving or GPS data was not available.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
                       {/* Screen List */}
             <div className={`${isMobile ? '' : 'lg:col-span-1'}`}>
               <div className="bg-white rounded-lg shadow">
                 <div className={`${isMobile ? 'p-3' : 'p-4'} border-b`}>
                   <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-start justify-between'}`}>
                     <div>
                       <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>Screens</h2>
                       <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Click to view details</p>
                     </div>
                     <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                       <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-900`}>
                         {currentTime.toLocaleDateString('en-US', { 
                           month: 'short', 
                           day: 'numeric', 
                           year: 'numeric' 
                         })}
                       </p>
                       <p className="text-xs text-gray-500">
                         {currentTime.toLocaleTimeString('en-US', { 
                           hour: '2-digit', 
                           minute: '2-digit',
                           hour12: true 
                         })}
                       </p>
                     </div>
                   </div>
                 </div>
                 <div className={`${isMobile ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
                   {screens?.map((screen) => (
                     <div
                       key={screen.deviceId}
                       onClick={() => handleScreenSelect(screen)}
                       className={`${isMobile ? 'p-3' : 'p-4'} border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                         selectedScreen?.deviceId === screen.deviceId ? 'bg-blue-50 border-blue-200' : ''
                       }`}
                     >
                       <div className={`flex items-center ${isMobile ? 'flex-col gap-2' : 'justify-between'} mb-2`}>
                         <div className="flex items-center space-x-2">
                           <Car className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-gray-500`} />
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium truncate`}>{screen.displayId || screen.materialId}</span>
                         </div>
                        <div className={`flex items-center space-x-1 ${getStatusColor(screen.isOnline)}`}>
                          {getStatusIcon(screen.isOnline)}
                          <span className="text-xs">
                            {screen.slot1Status?.toLowerCase() === 'online' || screen.slot2Status?.toLowerCase() === 'online' ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                       </div>
                       
                       <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                         <div className="flex justify-between">
                           <span>Hours Today:</span>
                           <span className="font-medium">{formatTime(screen.currentHours)}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Remaining:</span>
                           <span className="font-medium">{formatTime(screen.hoursRemaining)}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Distance:</span>
                           <span className="font-medium">
                             {formatDistance(screen.totalDistanceToday)}
                           </span>
                         </div>
                         <div className="flex justify-between">
                           <span>Last Seen:</span>
                           <span className="font-medium">
                             {screen.lastSeen ? new Date(screen.lastSeen).toLocaleTimeString() : 'Unknown'}
                           </span>
                         </div>
                       </div>

                       {/* Alerts */}
                       {screen.alerts?.length > 0 && (
                         <div className="mt-2">
                           <div className="flex items-center space-x-1 text-red-600">
                             <AlertTriangle className="w-3 h-3" />
                             <span className="text-xs">{screen.alerts?.length || 0} alert(s)</span>
                           </div>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>

               {/* Selected Screen Details */}
               {selectedScreen && (
                 <div className={`${isMobile ? 'mt-3' : 'mt-6'} bg-white rounded-lg shadow`}>
                   <div className={`${isMobile ? 'p-3' : 'p-4'} border-b`}>
                     <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>Screen Details</h3>
                   </div>
                   <div className={`${isMobile ? 'p-3' : 'p-4'} space-y-4`}>
                     <div>
                       <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium text-gray-900`}>Device Info</h4>
                       <div className={`mt-2 space-y-1 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                         <p>Device ID: {selectedScreen.materialId}</p>
                         {selectedScreen.carGroupId && <p>Car Group: {selectedScreen.carGroupId}</p>}
                         
                         {/* Slot Information */}
                         <div className="mt-3 space-y-2">
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <label className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Slot 1 Material ID</label>
                               {shouldShowAnalyticsBadge(selectedScreen, selectedScreen.slot1DeviceId) && (
                                 <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                   <BarChart3 className="w-3 h-3" />
                                   <span>Analytics</span>
                                 </div>
                               )}
                             </div>
                             <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-900`}>{shortenDeviceId(selectedScreen.slot1DeviceId)}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <div className={`w-2 h-2 rounded-full ${(selectedScreen.slot1Status || '').toLowerCase() === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                               <p className="text-xs font-medium" style={{ color: (selectedScreen.slot1Status || '').toLowerCase() === 'online' ? '#10b981' : '#ef4444' }}>
                                 {selectedScreen.slot1Status || 'Unknown'}
                               </p>
                             </div>
                           </div>
                           
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <label className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600`}>Slot 2 Material ID</label>
                               {shouldShowAnalyticsBadge(selectedScreen, selectedScreen.slot2DeviceId) && (
                                 <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                   <BarChart3 className="w-3 h-3" />
                                   <span>Analytics</span>
                                 </div>
                               )}
                             </div>
                             <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-900`}>{shortenDeviceId(selectedScreen.slot2DeviceId)}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <div className={`w-2 h-2 rounded-full ${(selectedScreen.slot2Status || '').toLowerCase() === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                               <p className="text-xs font-medium" style={{ color: (selectedScreen.slot2Status || '').toLowerCase() === 'online' ? '#10b981' : '#ef4444' }}>
                                 {selectedScreen.slot2Status || 'Unknown'}
                               </p>
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>

                     <div>
                       <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium text-gray-900`}>Today's Progress</h4>
                       <div className="mt-2 space-y-2">
                         <div className="flex justify-between">
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Hours Online:</span>
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{formatTime(selectedScreen.currentHours)}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Hours Remaining:</span>
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{formatTime(selectedScreen.hoursRemaining)}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Distance Traveled:</span>
                           <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
                             {formatDistance(selectedScreen.totalDistanceToday)}
                           </span>
                         </div>
                       </div>
                     </div>


                     {selectedScreen.currentLocation && (
                       <div>
                         <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium text-gray-900`}>Current Location</h4>
                         <div className={`mt-2 space-y-1 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                           <p>Address: {selectedScreen.currentLocation.address}</p>
                           <p>Speed: {selectedScreen.currentLocation.speed} km/h</p>
                           <p>Heading: {selectedScreen.currentLocation.heading}°</p>
                           <p>Accuracy: {selectedScreen.currentLocation.accuracy}m</p>
                         </div>
                      </div>
                    )}
                  </div>
                 </div>
               )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenTracking;
