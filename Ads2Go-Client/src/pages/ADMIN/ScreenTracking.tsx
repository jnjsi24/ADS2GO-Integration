import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import { LatLngTuple, Map, Icon } from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import { AdminLoader } from "../../components/ProtectedRoute";
import { motion, AnimatePresence } from 'framer-motion';

// Import MapView directly since we're not using Next.js
import MapView from '../../components/MapView';
import EnhancedRouteMap from '../../components/EnhancedRouteMap';
import StravaStyleRouteMap from '../../components/StravaStyleRouteMap';
import { 
  Clock, 
  Car, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Users,
  Activity, ChevronDown,
  MapPin,
  X
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
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]); // Manila coordinates
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');
  const [historicalRouteData, setHistoricalRouteData] = useState<any>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [clearMap, setClearMap] = useState(false); // Flag to clear map
  const [showMap, setShowMap] = useState(true); // Control map visibility
  
  // Helper function to validate coordinates
  const isValidCoordinate = (lat: number, lng: number): boolean => {
    return typeof lat === 'number' && typeof lng === 'number' &&
           !isNaN(lat) && !isNaN(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180 &&
           lat !== 0 && lng !== 0;
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

  const mapRef = useRef<Map | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);



  // Fetch historical route data
  const fetchHistoricalRoute = async (deviceId: string, date: string) => {
    try {
      console.log('🚀 Starting historical route fetch:', { deviceId, date });
      setLoadingHistorical(true);
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');
      const url = `${baseUrl}/deviceTracking/route/${deviceId}?date=${date}`;
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
      setLoadingHistorical(false);
    }
  };

  // Auto-load historical route when screen is selected and historical tab is active
  useEffect(() => {
    console.log('🔄 Tab/Selection changed:', { activeTab, selectedScreen: selectedScreen?.deviceId, selectedMaterial, selectedDate });
    
    // Clear historical route data when switching to live tab or when no screen or material is selected
    if (activeTab === 'live' || (!selectedScreen && selectedMaterial === 'all')) {
      console.log('🧹 Clearing historical route data');
      setHistoricalRouteData(null);
      return;
    }
    
    // For historical tab with selected screen, fetch device-specific route
    if (activeTab === 'historical' && selectedScreen && selectedDate) {
      console.log('📡 Fetching historical route for:', selectedScreen.deviceId, 'on', selectedDate);
      // Clear previous data before fetching new data
      setHistoricalRouteData(null);
      setClearMap(true); // Flag to clear map
      fetchHistoricalRoute(selectedScreen.deviceId, selectedDate);
    }
    
    // Note: For material-only selection (no screens), the StravaStyleRouteMap component
    // will fetch its own data directly from the API
  }, [activeTab, selectedScreen, selectedMaterial, selectedDate]);

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
        setScreens(complianceData.data?.screens || []); // Individual device records for screen list
        
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

        // Auto-center map on first screen if available
        if (complianceData.data?.screens?.length > 0 && 
            complianceData.data.screens[0].currentLocation &&
            isValidCoordinate(complianceData.data.screens[0].currentLocation.lat, complianceData.data.screens[0].currentLocation.lng)) {
          setMapCenter([complianceData.data.screens[0].currentLocation.lat, complianceData.data.screens[0].currentLocation.lng]);
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

  // Filter screens based on selected material
  useEffect(() => {
    console.log('Filtering screens - screens:', screens, 'selectedMaterial:', selectedMaterial);
    
    if (!screens) {
      console.log('No screens data available');
      setFilteredScreens([]);
      // Don't clear selection if a material is selected - we may still want to show route data
      if (selectedMaterial === 'all') {
        setSelectedScreen(null);
      }
      return;
    }
    
    let filtered: ScreenStatus[] = [];
    if (selectedMaterial === 'all') {
      console.log('Showing all screens:', screens.length);
      filtered = screens;
    } else {
      filtered = screens.filter((screen: ScreenStatus) => screen.materialId === selectedMaterial);
      console.log(`Filtering for material ${selectedMaterial}:`, filtered.length, 'screens found');
    }
    
    setFilteredScreens(filtered);
    
    // Auto-select first screen if none selected or current selection is not in filtered results
    if (filtered.length > 0) {
      if (!selectedScreen || !filtered.find(screen => screen.deviceId === selectedScreen.deviceId)) {
        console.log('Auto-selecting first screen from filtered results:', filtered[0].deviceId);
        setSelectedScreen(filtered[0]);
      }
    } else {
      console.log('No screens available after filtering');
      // Don't clear selection if a material is selected - we may still want to show route data
      // Only clear if viewing all materials
      if (selectedMaterial === 'all') {
        setSelectedScreen(null);
      }
    }
  }, [screens, selectedMaterial, selectedScreen]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchData();
    fetchMaterials();
    
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds for faster updates
    return () => clearInterval(interval);
  }, [selectedDate, fetchData]);

  // Fetch path when screen is selected
  useEffect(() => {
    if (selectedScreen) {
      fetchPathData(selectedScreen.deviceId);
    }
  }, [selectedScreen, selectedDate, fetchPathData]);

  const handleScreenSelect = (screen: ScreenStatus) => {
    setSelectedScreen(screen);
    if (screen.currentLocation && isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)) {
      setMapCenter([screen.currentLocation.lat, screen.currentLocation.lng]);
      setZoom(15);
    }
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


  const getMarkerColor = (screen: ScreenStatus) => {
    if (!screen || typeof screen !== 'object') return '#6b7280'; // gray for invalid data
    if (!screen.isOnline) return '#ef4444'; // red
    if (screen.isCompliant) return '#22c55e'; // green
    return '#eab308'; // yellow
  };

  // Create custom PIN icon
  const createPinIcon = (color: string) => {
    // Validate color input
    const validColor = color && typeof color === 'string' ? color : '#6b7280';
    
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 7.5 12 20 12 20s12-12.5 12-20c0-6.627-5.373-12-12-12z" fill="${validColor}" stroke="#ffffff" stroke-width="2"/>
          <circle cx="12" cy="12" r="6" fill="#ffffff"/>
        </svg>
      `)}`,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
      popupAnchor: [0, -32],
      className: 'custom-pin-icon'
    });
  };

  if (loading || materialsLoading) {
    return <AdminLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 ml-60">
      {/* Header */}
      <div>
        
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between py-4">
          {/* Left: Tabs */}

          {/* Right: Connection Status + Refresh */}
          
        </div>
      </div>

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
                            fetchHistoricalRoute(selectedScreen.deviceId, selectedDate);
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
                  const shouldShowStravaMap = activeTab === 'historical' && (
                    (selectedScreen && selectedScreen.materialId) || 
                    (selectedMaterial !== 'all' && selectedMaterial)
                  );
                  
                  // Get the material ID to use
                  const mapMaterialId = selectedScreen?.materialId || selectedMaterial;
                  
                  return shouldShowStravaMap && mapMaterialId && mapMaterialId !== 'all' ? (
                    // Strava-style route visualization for historical data
                    <div key={`strava-container-${mapMaterialId}-${selectedDate}`} className="h-full w-full">
                      <StravaStyleRouteMap
                        key={`strava-map-${mapMaterialId}-${selectedDate}`}
                        materialId={mapMaterialId}
                        date={selectedDate}
                        showSpeedColors={showSpeedColors}
                        showWaypoints={showWaypoints}
                        showMetrics={showMetrics}
                        onRouteLoad={(data) => {
                          console.log('Strava-style route loaded:', data);
                          setHistoricalRouteData(data);
                        }}
                      />
                    </div>
                  ) : (
                    <MapView 
                      key={`map-${selectedDate}`}
                      center={mapCenter}
                      zoom={zoom}
                      onMapLoad={(map: Map) => {
                        if (mapRef) {
                          (mapRef as React.MutableRefObject<Map | null>).current = map;
                        }
                        // Any map initialization code can go here
                      }}
                    >
                      {activeTab === 'live' ? (
                    // Live tracking markers and routes
                    <>
                      {/* Individual device markers - show one marker per device */}
                      {(() => {
                    try {
                      if (!filteredScreens || !Array.isArray(filteredScreens)) {
                        console.warn('filteredScreens is not a valid array:', filteredScreens);
                        return null;
                      }
                      
                      const validScreens = filteredScreens.filter(screen => {
                        if (!screen || typeof screen !== 'object') {
                          console.warn('Invalid screen object:', screen);
                          return false;
                        }
                        if (!screen.currentLocation) {
                          console.warn('Screen missing currentLocation:', screen.deviceId);
                          return false;
                        }
                        if (screen.currentLocation.lat === undefined || screen.currentLocation.lng === undefined) {
                          console.warn('Screen missing coordinates:', screen.deviceId, screen.currentLocation);
                          return false;
                        }
                        if (!isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)) {
                          console.warn('Screen has invalid coordinates:', screen.deviceId, screen.currentLocation);
                          return false;
                        }
                        return true;
                      });
                      
                      console.log(`Rendering ${validScreens.length} valid markers out of ${filteredScreens.length} total screens`);
                      
                      return validScreens.map((screen) => {
                        try {
                          return (
                            <Marker
                              key={screen.deviceId}
                              position={[screen.currentLocation!.lat, screen.currentLocation!.lng] as LatLngTuple}
                              icon={createPinIcon(getMarkerColor(screen))}
                              eventHandlers={{
                                click: () => handleScreenSelect(screen),
                              }}
                            >
                              <Popup maxWidth={290} maxHeight={400}>
                                <div className="space-y-4 max-w-xs">
                                  {/* Header */}
                                  <div className="pb-2">
                                    <h3 className="text-base font-semibold text-gray-900">{screen.deviceId}</h3>
                                  </div>

                                  {/* Address */}
                                  <div className="flex items-center text-xs text-gray-600">
                                      <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                    <span>{selectedScreen?.currentLocation?.address || 'N/A'}</span>
                                  </div>

                                  {/* Group ID and Status */}
                                  <div className="flex flex-col items-start space-y-2">
                                    <span className="px-3 py-1 bg-gray-100 text-xs text-gray-700 rounded-full border border-gray-200">
                                      {screen.carGroupId || 'N/A'}
                                    </span>
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                        screen.statusText === 'ONLINE'
                                          ? 'text-green-700 bg-green-100 border-green-200'
                                          : 'text-red-700 bg-red-100 border-red-200'
                                      }`}
                                    >
                                      {screen.slotNumber ? `Slot ${screen.slotNumber}` : screen.statusText || 'OFFLINE'}
                                    </span>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        } catch (error) {
                          console.error('Error rendering marker for screen:', screen.deviceId, error);
                          return null;
                        }
                      });
                    } catch (error) {
                      console.error('Error processing filtered screens for map:', error);
                      return null;
                    }
                  })()}
                  
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
                {activeTab === 'live' && filteredScreens && filteredScreens.filter((screen: ScreenStatus) => 
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
                {activeTab === 'historical' && !loadingHistorical && !historicalRouteData && !selectedScreen && selectedMaterial === 'all' && (
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
