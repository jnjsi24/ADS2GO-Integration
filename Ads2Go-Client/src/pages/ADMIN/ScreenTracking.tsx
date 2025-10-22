import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import { LatLngTuple, Map, Icon, DivIcon } from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import { AdminLoader } from "../../components/ProtectedRoute";
import { motion, AnimatePresence } from 'framer-motion';
import playbackWebSocketService from '../../services/playbackWebSocketService';

// Import MapView directly since we're not using Next.js
import MapView from '../../components/MapView';
import EnhancedRouteMap from '../../components/EnhancedRouteMap';
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
  ChevronDown,
  MapPin,
  X,
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

const ScreenTracking: React.FC = () => {
  const [screens, setScreens] = useState<ScreenStatus[]>([]);
  const [materialScreens, setMaterialScreens] = useState<ScreenStatus[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenStatus | null>(null);
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]); // Will be set dynamically based on real device locations
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');
  const [historicalRouteData, setHistoricalRouteData] = useState<any>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [clearMap, setClearMap] = useState(false); // Flag to clear map
  const [showMap, setShowMap] = useState(true); // Control map visibility
  const [openPopupForSelected, setOpenPopupForSelected] = useState(false); // Flag to open popup for selected screen
  
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
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [filteredScreens, setFilteredScreens] = useState<ScreenStatus[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<'device' | 'progress'>('device');
  
  // Enhanced route map controls
  const [showSpeedColors, setShowSpeedColors] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const toggleDropdown = () => setIsOpen((prev) => !prev);
  
  // Simplified route display - only road snapping enabled
  const snapToRoads = true;      // Always snap to roads for accurate route display

  const mapRef = useRef<Map | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);



  // Fetch historical route data
  const fetchHistoricalRoute = async (materialId: string, date: string) => {
    try {
      console.log('🚀 Starting historical route fetch:', { materialId, date });
      setLoadingHistorical(true);
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');
      const url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${date}`;
      console.log('📡 Fetching from URL:', url);
      
      const response = await fetch(url);
      console.log('📊 Response status:', response.status);
      
      const result = await response.json();
      console.log('📋 Response data:', result);
      
      if (result.success) {
        console.log('✅ Historical route data received:', result.data);
        console.log('🗺️ Route points count:', result.data.route?.length);
        console.log('📍 First point:', result.data.route?.[0]);
        console.log('📍 Last point:', result.data.route?.[result.data.route.length - 1]);
        console.log('📊 Full route data structure:', JSON.stringify(result.data, null, 2));
        setHistoricalRouteData(result.data);
        return result.data;
      } else {
        console.error('❌ Failed to fetch historical route:', result.message);
        setHistoricalRouteData(null);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching historical route:', error);
      setHistoricalRouteData(null);
      return null;
    } finally {
      // Set loading to false when fetch completes, regardless of success/failure
      setLoadingHistorical(false);
    }
  };

  // Auto-load historical route when screen is selected and historical tab is active
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
      return;
    }
    
    // For historical tab with selected screen, fetch device-specific route
    if (activeTab === 'historical' && selectedScreen && selectedDate) {
      console.log('📡 Fetching historical route for:', selectedScreen.materialId, 'on', selectedDate);
      // Clear previous data before fetching new data
      setHistoricalRouteData(null);
      setClearMap(true); // Flag to clear map
      fetchHistoricalRoute(selectedScreen.materialId, selectedDate);
    }
    
    // Note: For material-only selection (no screens), the RouteMapped component
    // will fetch its own data directly from the API
  }, [activeTab, selectedScreen, selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (!e.target.closest('.material-dropdown')) setIsDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);


  // Debug: Log when historicalRouteData changes
  useEffect(() => {
    if (historicalRouteData) {
      console.log('🔄 Historical route data updated:', {
        date: selectedDate,
        routeLength: historicalRouteData.route?.length,
        firstPoint: historicalRouteData.route?.[0] ? {
          lat: historicalRouteData.route[0].lat,
          lng: historicalRouteData.route[0].lng,
          timestamp: historicalRouteData.route[0].timestamp
        } : null,
        lastPoint: historicalRouteData.route?.length > 0 ? {
          lat: historicalRouteData.route[historicalRouteData.route.length - 1].lat,
          lng: historicalRouteData.route[historicalRouteData.route.length - 1].lng,
          timestamp: historicalRouteData.route[historicalRouteData.route.length - 1].timestamp
        } : null
      });
    }
  }, [historicalRouteData, selectedDate]);

  // Fetch materials list
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const materialsUrl = `${baseUrl}/material`;
      console.log('Fetching materials from:', materialsUrl);
      
      const response = await fetch(materialsUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Materials response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Materials fetched:', data);
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
      
      // Fetch compliance report (no auth required for this endpoint)
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const apiUrl = `${baseUrl}/screenTracking/compliance?date=${selectedDate}`;
      console.log('Making request to:', apiUrl);
      
      const complianceResponse = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Compliance response status:', complianceResponse.status);
      
      if (complianceResponse.ok) {
        const complianceData = await complianceResponse.json();
        console.log('Compliance data received:', complianceData);
        console.log('Screens in response:', complianceData.data?.screens);
        console.log('Number of screens:', complianceData.data?.screens?.length || 0);
        
        setComplianceReport(complianceData.data);
        const screensData = complianceData.data?.screens || [];
        console.log('🔍 [API Response] Screen data structure:', screensData.length > 0 ? {
          firstScreen: screensData[0],
          availableFields: Object.keys(screensData[0] || {}),
          hasSlot1DeviceId: 'slot1DeviceId' in (screensData[0] || {}),
          hasSlot2DeviceId: 'slot2DeviceId' in (screensData[0] || {}),
          hasDeviceId: 'deviceId' in (screensData[0] || {})
        } : 'No screens data');
        setScreens(screensData); // Individual device records for screen list
        
        // Set material screens for map display with validation
        if (complianceData.data?.materialScreens && Array.isArray(complianceData.data.materialScreens)) {
          // Filter out any undefined or invalid entries
          const validMaterialScreens = complianceData.data.materialScreens.filter((screen: any) => 
            screen && 
            typeof screen === 'object' && 
            screen.deviceId && 
            screen.materialId
          );
          setMaterialScreens(validMaterialScreens);
        } else {
          setMaterialScreens([]);
        }
        
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
   }, [selectedDate]);

  // Fetch path data for selected tablet
  const fetchPathData = useCallback(async (deviceId: string) => {
    try {
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const pathApiUrl = `${baseUrl}/screenTracking/path/${deviceId}?date=${selectedDate}`;
      console.log('Making path request to:', pathApiUrl);
      
      const response = await fetch(pathApiUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Path data response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Path data received:', data);
        
        // Validate path data structure before setting
        if (data.data && Array.isArray(data.data.locationHistory)) {
          // Filter out invalid location points
          const validLocationHistory = data.data.locationHistory.filter((point: any) => 
            point && 
            typeof point.lat === 'number' && 
            typeof point.lng === 'number' && 
            !isNaN(point.lat) && 
            !isNaN(point.lng) &&
            isValidCoordinate(point.lat, point.lng)
          );
          
          setPathData({
            ...data.data,
            locationHistory: validLocationHistory,
            totalPoints: validLocationHistory.length
          });
        } else {
          console.warn('Invalid path data structure received:', data);
          setPathData(null);
        }
      } else {
        const errorData = await response.json();
        console.error('Path data API Error:', errorData);
      }
    } catch (error) {
      console.error('Error fetching path data:', error);
    }
  }, [selectedDate]);

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


  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchData();
    fetchMaterials();
    
    // Temporarily disable auto-refresh to test map markers
    // const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds for faster updates
    // return () => clearInterval(interval);
  }, [selectedDate, fetchData]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    console.log('🔌 [ScreenTracking] Setting up WebSocket connection');
    
    // Check initial WebSocket connection status
    if (playbackWebSocketService.isWebSocketConnected()) {
      setConnectionStatus('connected');
      console.log('🔌 [ScreenTracking] WebSocket already connected');
    } else {
      setConnectionStatus('connecting');
      console.log('🔌 [ScreenTracking] WebSocket connecting...');
    }
    
    // Subscribe to real-time device updates
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      console.log('🔌 [ScreenTracking] Received WebSocket update:', update);
      console.log('🔌 [ScreenTracking] Update type:', update.type);
      console.log('🔌 [ScreenTracking] Update data:', JSON.stringify(update, null, 2));
      
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
      console.log('🔌 [ScreenTracking] Cleaning up WebSocket subscription');
      clearInterval(statusCheckInterval);
      unsubscribe();
    };
  }, [connectionStatus]);

  // Helper function to update device status in real-time
  const updateDeviceStatus = useCallback((deviceId: string, isOnline: boolean, lastSeen?: string) => {
    console.log(`🔄 [ScreenTracking] Updating device ${deviceId}:`, { isOnline, lastSeen });
    
    setScreens(prevScreens => {
      console.log(`🔄 [ScreenTracking] Current screens before update:`, prevScreens.length);
      console.log(`🔍 [WebSocket Debug] Looking for deviceId: ${deviceId}`);
      console.log(`🔍 [WebSocket Debug] Available screen deviceIds:`, prevScreens.map(s => ({
        materialId: s.materialId,
        deviceId: s.deviceId,
        slot1DeviceId: s.slot1DeviceId,
        slot2DeviceId: s.slot2DeviceId
      })));
      
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
    console.log('🔄 [ScreenTracking] Updating all devices from WebSocket:', devices);
    
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

  // Helper function to update device location in real-time
  const updateDeviceLocation = useCallback((deviceId: string, locationData: any) => {
    console.log('📍 [ScreenTracking] Updating device location:', { deviceId, locationData });
    
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
          console.log(`📍 [ScreenTracking] Updating location for screen ${screen.materialId} (device: ${deviceId})`);
          
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
  }, []);

  // Fetch path when screen is selected
  useEffect(() => {
    if (selectedScreen) {
      fetchPathData(selectedScreen.deviceId);
    }
  }, [selectedScreen, selectedDate, fetchPathData]);

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

  const getStatusColor = (isOnline: boolean, isCompliant: boolean) => {
    if (!isOnline) return 'text-red-500';
    if (isCompliant) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getStatusIcon = (isOnline: boolean, isCompliant: boolean) => {
    if (!isOnline) return <XCircle className="w-4 h-4" />;
    if (isCompliant) return <CheckCircle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
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


  const getActiveSlotDeviceId = (screen: ScreenStatus) => {
    // Determine which slot is currently active/online
    // Slot 1 is the master by default, only switch to Slot 2 if Slot 1 is offline
    const slot1Online = screen.slot1Status?.toLowerCase() === 'online';
    const slot2Online = screen.slot2Status?.toLowerCase() === 'online';
    
    if (slot1Online) {
      // Slot 1 is online - it's the master, use it
      return screen.slot1DeviceId;
    } else if (slot2Online) {
      // Slot 1 is offline but Slot 2 is online - use Slot 2 as fallback
      return screen.slot2DeviceId;
    } else {
      // Both slots are offline
      return null;
    }
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

  // Group markers by coordinates to handle overlapping (currently unused - using individual markers with offsets)
  const groupMarkersByLocation = (screens: ScreenStatus[]): { [key: string]: ScreenStatus[] } => {
    const locationGroups: { [key: string]: ScreenStatus[] } = {};
    
    screens.forEach((screen) => {
      if (screen.currentLocation && isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)) {
        // Use 4 decimal places for grouping (about 11m precision) to group nearby devices
        const key = `${screen.currentLocation.lat.toFixed(4)},${screen.currentLocation.lng.toFixed(4)}`;
        
        if (!locationGroups[key]) {
          locationGroups[key] = [];
        }
        locationGroups[key].push(screen);
      }
    });
    
    return locationGroups;
  };

  if (loading || materialsLoading) {
    return <AdminLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 ml-60">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Device Tracking Dashboard</h1>
              <p className="text-gray-600">Real-time monitoring of all screens (HEADDRESS, LCD, Billboards) and compliance</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Real-Time Connected' : 
                   connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              {activeTab === 'historical' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
              )}
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between py-4">
          {/* Left: Tabs */}

          {/* Right: Connection Status + Refresh */}
          
        </div>
      </div>

      {/* Compliance Summary */}
      {complianceReport && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Screens</p>
                  <p className="text-2xl font-bold text-gray-900">{screens?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Online</p>
                  <p className="text-2xl font-bold text-gray-900">{screens?.filter(s => s.isOnline).length || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Compliant (8h)</p>
                  <p className="text-2xl font-bold text-gray-900">{screens?.filter(s => s.isCompliant).length || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Hours</p>
                  <p className="text-2xl font-bold text-gray-900">
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
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Screen List */}
          <div className="lg:col-span-1">
            <div>
              <div>
                <div className="max-w-7xl p-3 space-y-3">
                  {/* Row 1: Title + Connection Status */}
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Device Tracking</h1>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          connectionStatus === 'connected'
                            ? 'bg-green-500'
                            : connectionStatus === 'connecting'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                      ></div>
                      <span className="text-sm text-gray-600">
                        {connectionStatus === 'connected'
                          ? 'Connected'
                          : connectionStatus === 'connecting'
                          ? 'Connecting...'
                          : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Filters and Actions */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Left Side: Materials Dropdown */}
                    <div className="relative w-72 material-dropdown">
                      <div
                        className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2 cursor-pointer"
                        onClick={() => setIsDropdownOpen((prev) => !prev)}
                      >
                        <span className="text-gray-700 text-sm">
                          {materialsLoading
                            ? 'Loading Materials...'
                            : selectedMaterial === 'all'
                            ? `All Materials (${materials?.length || 0})`
                            : (() => {
                                const mat = materials?.find((m) => m.materialId === selectedMaterial);
                                return mat ? `${mat.materialId}` : 'Select Material';
                              })()}
                        </span>

                        <motion.div
                          animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-2"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        </motion.div>
                      </div>

                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.ul
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                          >
                            <li
                              onClick={() => {
                                setSelectedMaterial('all');
                                setIsDropdownOpen(false);
                              }}
                              className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                            >
                              All Materials ({materials?.length || 0})
                            </li>
                            {materials?.map((material) => (
                              <li
                                key={material._id}
                                onClick={() => {
                                  setSelectedMaterial(material.materialId);
                                  setIsDropdownOpen(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                              >
                                {material.materialId}
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Right Side: Conditional Buttons */}
                    <div className="flex items-center gap-2">
                      {activeTab === 'historical' ? (
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="flex items-center justify-between w-auto text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white"
                        />
                      ) : (
                        activeTab === 'live' && (
                          <button
                            onClick={fetchData}
                            disabled={refreshing}
                            className="px-4 py-2 bg-[#3674B5] text-white rounded-md shadow-lg hover:bg-[#3674B5]/80 disabled:opacity-50 flex items-center gap-2"
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Screen List */}
              <div className="h-[610px] bg-white overflow-y-auto">
                {filteredScreens?.map((screen) => (
                  <div
                    key={screen.deviceId}
                    onClick={() => handleScreenSelect(screen)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedScreen?.deviceId === screen.deviceId ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{screen.displayId || screen.materialId}</span>
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
                    
                    <div className="space-y-1 text-sm text-gray-600">
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
                          {activeTab === 'historical' && historicalRouteData && historicalRouteData.metrics 
                            ? `${historicalRouteData.metrics.totalDistance} km`
                            : formatDistance(screen.totalDistanceToday)
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Seen:</span>
                        <span className="font-medium">
                          {screen.lastSeen ? new Date(screen.lastSeen).toLocaleTimeString() : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center justify-end space-x-1 pt-2 ${getStatusColor(screen.isOnline, screen.isCompliant)}`}>
                        {getStatusIcon(screen.isOnline, screen.isCompliant)}
                        <span className="text-xs">
                          {screen.statusText || screen.displayStatus}
                        </span>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setActiveTab('live')}
                      className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
                        activeTab === 'live' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      <span>Live Tracking</span>
                      <span
                        className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                          ${activeTab === 'live' ? 'w-full' : 'w-0 group-hover:w-full'}
                        `}
                      />
                    </button>

                    <button
                      onClick={() => setActiveTab('historical')}
                      className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
                        activeTab === 'historical' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Historical Routes</span>
                      <span
                        className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                          ${activeTab === 'historical' ? 'w-full' : 'w-0 group-hover:w-full'}
                        `}
                      />
                    </button>
                  </div>
                  {activeTab === 'historical' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          if (selectedScreen) {
                            console.log('🔄 Manual load route clicked');
                            fetchHistoricalRoute(selectedScreen.materialId, selectedDate);
                          } else {
                            console.log('⚠️ No screen selected for historical route');
                          }
                        }}
                        disabled={loadingHistorical || !selectedScreen}
                        className="flex items-center space-x-2 px-3 py-2 bg-[#3674B5] text-white rounded-md shadow-lg hover:bg-[#3674B5]/80 disabled:opacity-50 text-sm"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingHistorical ? 'animate-spin' : ''}`} />
                        <span>{loadingHistorical ? 'Loading...' : 'Load Route'}</span>
                      </button>
                      
                      {/* Enhanced Route Controls */}
                      <div className="relative w-36 inline-block text-sm z-[9999]">
                        {/* Dropdown Button */}
                        <div
                          onClick={toggleDropdown}
                          className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
                        >
                          <span className="text-gray-700">Map Settings</span>
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          </motion.div>
                        </div>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.15 }}
                              className="absolute mt-1 w-36 bg-white px-2 py-2 text-xs border border-gray-200 rounded-md shadow-lg z-10"
                            >
                              <div className="p-2 space-y-2">
                                <label className="flex items-center justify-between cursor-pointer group">
                                  <span className="text-gray-700">Speed Colors</span>
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={showSpeedColors}
                                      onChange={(e) => setShowSpeedColors(e.target.checked)}
                                      className="sr-only" // Hide the native checkbox
                                    />
                                    <motion.div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                                        showSpeedColors
                                          ? "border-[#3674B5] bg-[#3674B5]"
                                          : "border-gray-300 bg-white group-hover:border-[#3674B5]/70"
                                      }`}
                                      animate={{
                                        scale: showSpeedColors ? [1, 1.1, 1] : 1,
                                      }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <AnimatePresence>
                                        {showSpeedColors && (
                                          <motion.svg
                                            initial={{ opacity: 0, scale: 0 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="w-3 h-3 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </motion.svg>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  </div>
                                </label>

                                <label className="flex items-center justify-between cursor-pointer group">
                                  <span className="text-gray-700">Waypoints</span>
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={showWaypoints}
                                      onChange={(e) => setShowWaypoints(e.target.checked)}
                                      className="sr-only"
                                    />
                                    <motion.div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                                        showWaypoints
                                          ? "border-[#3674B5] bg-[#3674B5]"
                                          : "border-gray-300 bg-white group-hover:border-[#3674B5]/70"
                                      }`}
                                      animate={{
                                        scale: showWaypoints ? [1, 1.1, 1] : 1,
                                      }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <AnimatePresence>
                                        {showWaypoints && (
                                          <motion.svg
                                            initial={{ opacity: 0, scale: 0 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="w-3 h-3 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </motion.svg>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  </div>
                                </label>

                                <label className="flex items-center justify-between cursor-pointer group">
                                  <span className="text-gray-700">Metrics</span>
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={showMetrics}
                                      onChange={(e) => setShowMetrics(e.target.checked)}
                                      className="sr-only"
                                    />
                                    <motion.div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
                                        showMetrics
                                          ? "border-[#3674B5] bg-[#3674B5]"
                                          : "border-gray-300 bg-white group-hover:border-[#3674B5]/70"
                                      }`}
                                      animate={{
                                        scale: showMetrics ? [1, 1.1, 1] : 1,
                                      }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <AnimatePresence>
                                        {showMetrics && (
                                          <motion.svg
                                            initial={{ opacity: 0, scale: 0 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="w-3 h-3 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </motion.svg>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  </div>
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {selectedScreen ? `Device: ${selectedScreen.deviceId}` : 'No device selected'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-[630px] relative">
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
                        onRouteLoad={(data) => {
                          console.log('Route loaded:', data);
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
                      </div>
                    </div>
                  ) : (
                    <MapView 
                      key={`map-${selectedDate}`}
                      center={mapCenter}
                      zoom={zoom}
                      onMapLoad={(map: Map) => {
                        // Only log map load in verbose mode
                        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_MAP === 'true') {
                          console.log(`🗺️ [Map Load] Map loaded with center:`, mapCenter, 'zoom:', zoom);
                        }
                        if (mapRef) {
                          (mapRef as React.MutableRefObject<Map | null>).current = map;
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
                  
                  {/* Path for selected tablet */}
                  {pathData && pathData.locationHistory?.length > 1 && (() => {
                    const validPositions = pathData.locationHistory
                      .filter(point => point && typeof point.lat === 'number' && typeof point.lng === 'number' && 
                             !isNaN(point.lat) && !isNaN(point.lng) &&
                             isValidCoordinate(point.lat, point.lng))
                      .map(point => [point.lat, point.lng] as LatLngTuple);
                    
                    return validPositions.length > 1 ? (
                      <Polyline
                        positions={validPositions}
                        color="#3b82f6"
                        weight={3}
                        opacity={0.7}
                      />
                    ) : null;
                  })()}
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
                {/* Selected Screen Details with Tabs */}
                {selectedScreen && (
                  <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-3xl mx-auto">
                      {/* Tabs Header */}
                      <div className="flex border-b gap-2 border-gray-200">
                        <button
                          onClick={() => setActiveDetailTab('device')}
                          className={`relative flex-1 py-3 px-4 text-sm font-medium text-center transition-colors group ${
                            activeDetailTab === 'device'
                              ? 'text-blue-600'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Device Information
                          <span
                            className={`absolute bottom-0 left-0 h-[2px] bg-blue-600 transition-all duration-300
                              ${activeDetailTab === 'device' ? 'w-full' : 'w-0 group-hover:w-full'}
                            `}
                          />
                        </button>
                        <button
                          onClick={() => setActiveDetailTab('progress')}
                          className={`relative flex-1 py-3 px-4 text-sm font-medium text-center transition-colors group ${
                            activeDetailTab === 'progress'
                              ? 'text-blue-600'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Today's Progress
                          <span
                            className={`absolute bottom-0 left-0 h-[2px] bg-blue-600 transition-all duration-300
                              ${activeDetailTab === 'progress' ? 'w-full' : 'w-0 group-hover:w-full'}
                            `}
                          />
                        </button>
                      </div>
                      {/* Tab Content - Fixed Height */}
                      <div className="h-36 overflow-y-auto"> {/* Fixed height */}
                        {activeDetailTab === 'device' && (
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="space-y-3 pr-4 col-span-2">
                                {/* Left column - Device ID, Material, Screen Type */}
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Device ID</label>
                                  <p className="font-medium text-gray-900 text-sm break-all">{selectedScreen.deviceId}</p>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Material</label>
                                  <p className="font-medium text-gray-900 text-sm">{selectedScreen.materialId}</p>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Screen Type</label>
                                  <p className="font-medium text-gray-900 text-sm">{selectedScreen.screenType}</p>
                                </div>
                                {selectedScreen.currentLocation && (
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Current Address</label>
                                    <p className="font-medium text-gray-900 text-sm break-words">
                                      {selectedScreen.currentLocation.address}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3 pl-4 col-span-1">
                                {/* Right column - Car Group, Slot, Status */}
                                {selectedScreen.carGroupId && (
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Car Group</label>
                                    <p className="font-medium text-gray-900 text-sm">{selectedScreen.carGroupId}</p>
                                  </div>
                                )}
                                {selectedScreen.slotNumber && (
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Slot</label>
                                    <p className="font-medium text-gray-900 text-sm">{selectedScreen.slotNumber}</p>
                                  </div>
                                )}
                                {selectedScreen.statusText && (
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                                    <p className="font-medium text-gray-900 text-sm">{selectedScreen.statusText}</p>
                                  </div>
                                )}
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Date:</label>
                                  <p className="font-medium text-gray-900 text-sm">{selectedDate}</p>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Filtered Screens:</label>
                                  <p className="font-medium text-gray-900 text-sm">{filteredScreens?.length || 0}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeDetailTab === 'progress' && (
                          <div className="p-4 h-full flex items-center justify-center"> {/* Added h-full and centering */}
                            <div className="grid grid-cols-2 gap-6 text-sm w-full">
                              <div className="space-y-4">
                                <div className="text-center">
                                  <label className="text-xs text-gray-500 block mb-1">Hours Online</label>
                                  <p className="text-2xl font-bold">{formatTime(selectedScreen.currentHours)}</p>
                                </div>
                                <div className="text-center">
                                  <label className="text-xs text-gray-500 block mb-1">Hours Remaining</label>
                                  <p className="text-2xl font-bold">{formatTime(selectedScreen.hoursRemaining)}</p>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="text-center">
                                  <label className="text-xs text-gray-500 block mb-1">Distance Traveled</label>
                                  <p className="text-2xl font-bold">
                                    {activeTab === 'historical' && historicalRouteData && historicalRouteData.metrics 
                                      ? `${historicalRouteData.metrics.totalDistance} km`
                                      : formatDistance(selectedScreen.totalDistanceToday)
                                    }
                                  </p>
                                </div>
                                <div className="text-center">
                                  <label className="text-xs text-gray-500 block mb-1">Compliance Rate</label>
                                  <p className="text-2xl font-bold">{selectedScreen.complianceRate}%</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenTracking;
