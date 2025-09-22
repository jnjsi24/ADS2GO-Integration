import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup, Polyline, CircleMarker, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import { LatLngTuple, Map, Icon } from 'leaflet';
import 'leaflet-defaulticon-compatibility';

// Import MapView directly since we're not using Next.js
import MapView from '../../components/MapView';
import { 
  Clock, 
  Car, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Users,
  Activity
} from 'lucide-react';

// GraphQL imports
import { useQuery } from '@apollo/client';
import { GET_ALL_SCREENS } from '../../graphql/admin/queries/screenTracking';
import { useDeviceStatus } from '../../contexts/DeviceStatusContext';

interface ScreenStatus {
  deviceId: string;
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
  alertCount?: number;
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
  id: string;
  materialId: string;
  materialType: 'HEADDRESS' | 'LCD' | 'POSTER' | 'STICKER' | 'BANNER';
  description?: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  driverId?: string;
  mountedAt?: string;
  dismountedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ScreenTracking: React.FC = () => {
  const [screens, setScreens] = useState<ScreenStatus[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenStatus | null>(null);
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);

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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mapRef = useRef<Map | null>(null);

  // GraphQL query for screen data (initial load)
  const { data: screensData, loading: screensLoading, error: screensError, refetch: refetchScreens } = useQuery(GET_ALL_SCREENS, {
    variables: {
      filters: selectedMaterial !== 'all' ? { materialId: selectedMaterial } : null
    },
    fetchPolicy: 'cache-first'
  });

  // WebSocket real-time status
  const { devices: wsDevices, isConnected: wsConnected } = useDeviceStatus();

  // Auto-refresh function that silently updates data
  const autoRefreshData = useCallback(async () => {
    try {
      console.log('🔄 Auto-refresh - fetching screen data silently...');
      
      // Refetch screens data using GraphQL
      const result = await refetchScreens();
      if (result.data?.getAllScreens) {
        const screensFromGraphQL = result.data.getAllScreens.screens || [];
        
        // Enhance with WebSocket real-time status
        const enhancedScreens = screensFromGraphQL.map((screen: any) => {
          const wsDevice = wsDevices.find(ws => ws.deviceId === screen.deviceId || ws.deviceId === screen.materialId);

          return {
            ...screen,
            isOnline: wsDevice ? wsDevice.isOnline : screen.isOnline,
            alertCount: screen.alerts?.length || 0
          };
        });

        setScreens(prevScreens => {
          const hasChanged = JSON.stringify(prevScreens) !== JSON.stringify(enhancedScreens);
          if (hasChanged) {
            console.log('📊 Screen data updated via auto-refresh');
          }
          return enhancedScreens;
        });
        
        setConnectionStatus('connected');
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error during auto-refresh:', err);
      setConnectionStatus('disconnected');
    }
  }, [refetchScreens, wsDevices]);

  // Update screens when GraphQL data changes (initial load)
  useEffect(() => {
    if (screensData?.getAllScreens) {
      const screensFromGraphQL = screensData.getAllScreens.screens || [];

      // Enhance with WebSocket real-time status
      const enhancedScreens = screensFromGraphQL.map((screen: any) => {
        const wsDevice = wsDevices.find(ws => ws.deviceId === screen.deviceId || ws.deviceId === screen.materialId);

        return {
          ...screen,
          isOnline: wsDevice ? wsDevice.isOnline : screen.isOnline,
          alertCount: screen.alerts?.length || 0
        };
      });

      setScreens(enhancedScreens);
      setConnectionStatus('connected');
    } else if (screensError) {
      // If there's an error, set connection status to disconnected
      setConnectionStatus('disconnected');
    }
  }, [screensData, wsDevices, screensError]);

  // Set up auto-refresh interval (every 30 seconds like ads panel)
  useEffect(() => {
    // Initial auto-refresh after component mounts
    const initialTimeout = setTimeout(() => {
      autoRefreshData();
    }, 5000); // Start auto-refresh after 5 seconds

    // Set up interval for continuous auto-refresh
    const interval = setInterval(autoRefreshData, 30000); // Every 30 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [autoRefreshData]);

  // Fetch materials list using GraphQL
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);

      const materialsResponse = await fetch('https://ads2go-integration-production.up.railway.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetAllMaterials {
              getAllMaterials {
                id
                materialId
                materialType
                description
                category
                vehicleType
                driverId
                mountedAt
                dismountedAt
                createdAt
                updatedAt
              }
            }
          `
        })
      });

      const materialsResult = await materialsResponse.json();

      if (materialsResult.data?.getAllMaterials) {
        setMaterials(materialsResult.data.getAllMaterials);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setMaterialsLoading(false);
    }
  };

  // Legacy functions - replaced by GraphQL polling
  const fetchData = useCallback(async () => {
    console.log('fetchData called - using GraphQL polling instead');
  }, []);

  const fetchPathData = useCallback(async (deviceId: string) => {
    console.log('fetchPathData called - using GraphQL polling instead');
  }, []);

  // Filter screens based on selected material
  useEffect(() => {
    if (!screens) {
      setFilteredScreens([]);
      return;
    }

    if (selectedMaterial === 'all') {
      setFilteredScreens(screens);
    } else {
      const filtered = screens.filter(screen => screen.materialId === selectedMaterial);
      setFilteredScreens(filtered);
    }
  }, [screens, selectedMaterial]);

  // Initialize data on component mount
  useEffect(() => {
    fetchMaterials();
  }, []);


  const handleScreenSelect = (screen: ScreenStatus) => {
    setSelectedScreen(screen);
    if (screen.currentLocation?.lat && screen.currentLocation?.lng &&
        isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)) {
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
    if (!screen.isOnline) return '#ef4444';
    if (screen.isCompliant) return '#22c55e';
    return '#eab308';
  };

  const createPinIcon = (color: string) => {
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 7.5 12 20 12 20s12-12.5 12-20c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
          <circle cx="12" cy="12" r="6" fill="#ffffff"/>
        </svg>
      `)}`,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
      popupAnchor: [0, -32],
      className: 'custom-pin-icon'
    });
  };

  if (screensLoading || materialsLoading) {
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Screen Tracking Dashboard</h1>
              <p className="text-gray-600">Real-time monitoring of all screens (HEADDRESS, LCD, Billboards) and compliance</p>
            </div>
            <div className="flex items-center space-x-4">
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
              <div className="text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 bg-white"
                disabled={materialsLoading}
              >
                <option value="all">
                  {materialsLoading ? 'Loading Materials...' : `All Materials (${materials?.length || 0})`}
                </option>
                {materials?.map((material) => (
                  <option key={material.id} value={material.materialId}>
                    {material.materialType} - {material.materialId} ({material.vehicleType})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                onClick={() => {
                  setIsRefreshing(true);
                  autoRefreshData().finally(() => setIsRefreshing(false));
                }}
                disabled={isRefreshing}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-xs text-yellow-800">
              Debug: Materials loaded: {materials?.length || 0} | Selected: {selectedMaterial} | Screens: {filteredScreens?.length || 0}
            </p>
            <p className="text-xs text-yellow-800">
              Screens with location: {filteredScreens?.filter(s => s.currentLocation && isValidCoordinate(s.currentLocation.lat, s.currentLocation.lng)).length || 0}
            </p>
            {filteredScreens && filteredScreens.length > 0 && (
              <p className="text-xs text-yellow-800">
                First screen: {filteredScreens[0].materialId} | Location: {filteredScreens[0].currentLocation ? `${filteredScreens[0].currentLocation.lat}, ${filteredScreens[0].currentLocation.lng}` : 'No location'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Material Summary */}
      {selectedMaterial !== 'all' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  Material: {materials?.find(m => m.materialId === selectedMaterial)?.materialType || selectedMaterial}
                </h3>
                <p className="text-sm text-blue-700">
                  {filteredScreens?.length || 0} screen(s) found for this material
                </p>
              </div>
              <button
                onClick={() => setSelectedMaterial('all')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All Materials
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-2xl font-bold text-gray-900">{filteredScreens?.length || 0}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{filteredScreens?.filter(s => s.isOnline).length || 0}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{filteredScreens?.filter(s => s.isCompliant).length || 0}</p>
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
                    {filteredScreens && filteredScreens.length > 0 
                      ? (filteredScreens.reduce((sum, s) => sum + s.currentHours, 0) / filteredScreens.length).toFixed(1)
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Live Map</h2>
                <p className="text-sm text-gray-600">Real-time tablet locations and routes</p>
              </div>
              <div className="h-96 relative">
                <MapView 
                  center={mapCenter}
                  zoom={zoom}
                  onMapLoad={(map: Map) => {
                    if (mapRef) {
                      (mapRef as React.MutableRefObject<Map | null>).current = map;
                    }
                  }}
                >
                  {/* Screen markers - only show markers for screens with valid location data */}
                  {filteredScreens?.filter(screen => 
                    screen && 
                    screen.currentLocation && 
                    isValidCoordinate(screen.currentLocation.lat, screen.currentLocation.lng)
                  ).map((screen) => (
                    <Marker
                      key={screen.deviceId}
                      position={[screen.currentLocation!.lat, screen.currentLocation!.lng] as LatLngTuple}
                      icon={createPinIcon(getMarkerColor(screen))}
                      eventHandlers={{
                        click: () => handleScreenSelect(screen),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">{screen.materialId}</h3>
                          <p className="text-sm">Type: {screen.screenType}</p>
                          <p className="text-sm">Hours: {formatTime(screen.currentHours)}</p>
                          <p className="text-sm">Distance: {formatDistance(screen.totalDistanceToday)}</p>
                          <p className="text-sm">Status: {screen.displayStatus}</p>
                          <p className="text-sm">Address: {screen.currentLocation?.address || 'Unknown'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  
                  {/* Path for selected tablet */}
                  {pathData && pathData.locationHistory?.length > 1 && (
                    <Polyline
                      positions={pathData.locationHistory.map(point => [point.lat, point.lng] as LatLngTuple)}
                      color="#3b82f6"
                      weight={3}
                      opacity={0.7}
                    />
                  )}
                </MapView>
                
                {/* Show message when no tablets have valid location data */}
                {filteredScreens && filteredScreens.filter(screen => 
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

          {/* Screen List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Screens</h2>
                <p className="text-sm text-gray-600">Click to view details</p>
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
                        <Car className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{screen.materialId}</span>
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
                          {screen.lastSeen && screen.lastSeen !== 'Invalid Date' && new Date(screen.lastSeen).toString() !== 'Invalid Date' 
                            ? new Date(screen.lastSeen).toLocaleTimeString()
                            : 'Never'
                          }
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
