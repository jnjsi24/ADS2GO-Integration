import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup, Polyline, CircleMarker, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import { LatLngTuple, Map, Icon } from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import { motion, AnimatePresence } from "framer-motion";


// Import MapView directly since we're not using Next.js
import MapView from '../../components/MapView';
import { 
  Clock, Car, AlertTriangle, CheckCircle, XCircle, RefreshCw, Users, ChevronDown, Activity
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
  currentHours: number;
  hoursRemaining: number;
  isCompliant: boolean;
  totalDistanceToday: number;
  averageDailyHours: number;
  complianceRate: number;
  totalHoursOnline: number;
  totalDistanceTraveled: number;
  displayStatus: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'DISPLAY_OFF';
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
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);


  const mapRef = useRef<Map | null>(null);

  // Fetch materials list
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const materialsUrl = `${window.location.protocol}//${window.location.hostname}:5000/material`;
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
      const apiUrl = `${window.location.protocol}//${window.location.hostname}:5000/screenTracking/compliance?date=${selectedDate}`;
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
          const validMaterialScreens = complianceData.data.materialScreens.filter(screen => 
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
      const pathApiUrl = `${window.location.protocol}//${window.location.hostname}:5000/screenTracking/path/${deviceId}?date=${selectedDate}`;
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
      return;
    }
    
    if (selectedMaterial === 'all') {
      console.log('Showing all screens:', screens.length);
      setFilteredScreens(screens);
    } else {
      const filtered = screens.filter(screen => screen.materialId === selectedMaterial);
      console.log(`Filtering for material ${selectedMaterial}:`, filtered.length, 'screens found');
      setFilteredScreens(filtered);
    }
  }, [screens, selectedMaterial]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchData();
    fetchMaterials();
    
    const interval = setInterval(fetchData, 30000);
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

  const formatTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const formatDistance = (distance: number) => {
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 ml-60">
      {/* Header */}
      <div>
        <div className="max-w-7xl p-5 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Screen Tracking Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500"
                      : connectionStatus === "connecting"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm text-gray-600">
                  {connectionStatus === "connected"
                    ? "Connected"
                    : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Disconnected"}
                </span>
              </div>

              {/* ▼ Animated Dropdown for Materials */}
              <div className="relative w-56 z-50">
                <button
                  onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                  disabled={materialsLoading}
                >
                  {materialsLoading
                    ? "Loading Materials..."
                    : selectedMaterial === "all"
                    ? `All Materials (${materials?.length || 0})`
                    : (() => {
                        const m = materials?.find(
                          (m) => m.materialId === selectedMaterial
                        );
                        return m
                          ? `${m.title} - ${m.materialId} (${m.materialType})`
                          : "Select Material";
                      })()}
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${
                      showMaterialDropdown ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {showMaterialDropdown && !materialsLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      <button
                        key="all"
                        onClick={() => {
                          setSelectedMaterial("all");
                          setShowMaterialDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        All Materials ({materials?.length || 0})
                      </button>

                      {materials?.map((material) => (
                        <button
                          key={material._id}
                          onClick={() => {
                            setSelectedMaterial(material.materialId);
                            setShowMaterialDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {material.materialId}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date Picker */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              />

              {/* Refresh Button */}
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 h-[calc(150vh-5rem)]">

          {/* Map Container */}
          <div className="absolute inset-0 z-0">
            <div className="bg-white rounded-lg shadow h-full">
              <div className="h-full relative">
                <MapView
                  center={mapCenter}
                  zoom={zoom}
                  onMapLoad={(map: Map) => {
                    if (mapRef) {
                      (mapRef as React.MutableRefObject<Map | null>).current = map;
                    }
                    // Any map initialization code can go here
                  }}
                >
                  
                  {/* Material markers - show one marker per material (not per slot) */}
                  {(() => {
                    try {
                      if (!materialScreens || !Array.isArray(materialScreens)) {
                        console.warn('materialScreens is not a valid array:', materialScreens);
                        return null;
                      }
                      
                      const validScreens = materialScreens.filter(screen => {
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
                      
                      console.log(`Rendering ${validScreens.length} valid markers out of ${materialScreens.length} total screens`);
                      
                      return validScreens.map((screen) => {
                        try {
                          return (
                            <Marker
                              key={screen.deviceId}
                              position={[screen.currentLocation.lat, screen.currentLocation.lng] as LatLngTuple}
                              icon={createPinIcon(getMarkerColor(screen))}
                              eventHandlers={{
                                click: () => handleScreenSelect(screen),
                              }}
                            >
                              <Popup>
                                <div className="p-2">
                                  <h3 className="font-semibold">{screen.materialId || 'Unknown Material'}</h3>
                                  <p className="text-sm">Type: {screen.screenType || 'Unknown'}</p>
                                  <p className="text-sm">Devices: {screen.onlineDevices || 0}/{screen.totalDevices || 1} online</p>
                                  <p className="text-sm">Total Hours: {formatTime(screen.totalHours || 0)}</p>
                                  <p className="text-sm">Total Distance: {formatDistance(screen.totalDistance || 0)}</p>
                                  <p className="text-sm">Status: {screen.displayStatus || 'Unknown'}</p>
                                  <p className="text-sm">Address: {screen.currentLocation.address || 'No address available'}</p>
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
                      console.error('Error processing material screens for map:', error);
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
                </MapView>
                
                {/* Show message when no tablets have valid location data */}
                {materialScreens && materialScreens.filter(screen => 
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
              </div>
            </div>
          </div>
          
          {/* Screen List & Details - Overlaid */}
          <div className="relative z-10 flex justify-end h-full pointer-events-none">    
            <div className="w-full sm:w-96 bg-white/90 backdrop-blur-md rounded-xl shadow-xl overflow-y-auto **pointer-events-auto**">

            {/* Compliance Summary – moved inside panel */}
            {complianceReport && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-white/70">

              {/* Total Screens */}
              <div className="bg-white rounded-lg shadow p-3 flex items-center">
                <div className="p-2 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Total Screens</p>
                  <p className="text-xl font-bold text-gray-900">
                    {filteredScreens?.length || 0}
                  </p>
                </div>
              </div>

              {/* Online */}
              <div className="bg-white rounded-lg shadow p-3 flex items-center">
                <div className="p-2 rounded-lg">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Online</p>
                  <p className="text-xl font-bold text-gray-900">
                    {filteredScreens?.filter(s => s.isOnline).length || 0}
                  </p>
                </div>
              </div>

              {/* Compliant (8h) */}
              <div className="bg-white rounded-lg shadow p-3 flex items-center">
                <div className="p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Compliant (8h)</p>
                  <p className="text-xl font-bold text-gray-900">
                    {filteredScreens?.filter(s => s.isCompliant).length || 0}
                  </p>
                </div>
              </div>

              {/* Avg Hours */}
              <div className="bg-white rounded-lg shadow p-3 flex items-center">
                <div className="p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Avg Hours</p>
                  <p className="text-xl font-bold text-gray-900">
                    {filteredScreens && filteredScreens.length > 0
                      ? (
                          filteredScreens.reduce((sum, s) => sum + s.currentHours, 0) /
                          filteredScreens.length
                        ).toFixed(1)
                      : '0.0'
                    }h
                  </p>
                </div>
              </div>
            </div>
          )}

            {/* Screen List */}
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900">Screens</h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
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
                      <div className={`flex items-center space-x-1 ${getStatusColor(screen.isOnline, screen.isCompliant)}`}>
                        {getStatusIcon(screen.isOnline, screen.isCompliant)}
                        <span className="text-xs">
                          {screen.displayStatus}
                        </span>
                      </div>
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
                        <span className="font-medium">{formatDistance(screen.totalDistanceToday)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Seen:</span>
                        <span className="font-medium">
                          {new Date(screen.lastSeen).toLocaleTimeString()}
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
              <div className="mt-6 bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Screen Details</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Device Info</h4>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Device ID: {selectedScreen.deviceId}</p>
                      <p>Material: {selectedScreen.materialId}</p>
                      <p>Screen Type: {selectedScreen.screenType}</p>
                      {selectedScreen.carGroupId && <p>Car Group: {selectedScreen.carGroupId}</p>}
                      {selectedScreen.slotNumber && <p>Slot: {selectedScreen.slotNumber}</p>}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Today's Progress</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Hours Online:</span>
                        <span className="font-medium">{formatTime(selectedScreen.currentHours)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Hours Remaining:</span>
                        <span className="font-medium">{formatTime(selectedScreen.hoursRemaining)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Distance Traveled:</span>
                        <span className="font-medium">{formatDistance(selectedScreen.totalDistanceToday)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Compliance Rate:</span>
                        <span className="font-medium">{selectedScreen.complianceRate}%</span>
                      </div>
                    </div>
                  </div>

                  {selectedScreen.currentLocation && (
                    <div>
                      <h4 className="font-medium text-gray-900">Current Location</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Address: {selectedScreen.currentLocation.address}</p>
                        <p>Speed: {selectedScreen.currentLocation.speed} km/h</p>
                        <p>Heading: {selectedScreen.currentLocation.heading}°</p>
                        <p>Accuracy: {selectedScreen.currentLocation.accuracy}m</p>
                      </div>
                    </div>
                  )}

                  {pathData && (
                    <div>
                      <h4 className="font-medium text-gray-900">Path Information</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Total Points: {pathData.totalPoints}</p>
                        <p>Total Distance: {formatDistance(pathData.totalDistance)}</p>
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
