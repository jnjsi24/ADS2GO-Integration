import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { LatLngTuple, Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

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
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenStatus | null>(null);
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]); // Manila coordinates
  const [zoom, setZoom] = useState(12);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [filteredScreens, setFilteredScreens] = useState<ScreenStatus[]>([]);

  const mapRef = useRef<Map | null>(null);

  // Fetch materials list
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const response = await fetch('/material');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Materials fetched:', data);
        setMaterials(data.materials || []);
      } else {
        console.error('Failed to fetch materials:', response.status, response.statusText);
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
      
      // Fetch compliance report
      const complianceResponse = await fetch(`/screenTracking/compliance?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
             if (complianceResponse.ok) {
         const complianceData = await complianceResponse.json();
         setComplianceReport(complianceData.data);
         setScreens(complianceData.data?.screens || []);
         setConnectionStatus('connected');

         // Auto-center map on first screen if available
         if (complianceData.data?.screens?.length > 0 && complianceData.data.screens[0].currentLocation) {
           setMapCenter([complianceData.data.screens[0].currentLocation.lat, complianceData.data.screens[0].currentLocation.lng]);
         }
       } else {
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
      const response = await fetch(`/screenTracking/path/${deviceId}?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPathData(data.data);
      }
    } catch (error) {
      console.error('Error fetching path data:', error);
    }
  }, [selectedDate]);

  // Filter screens based on selected material
  useEffect(() => {
    if (!screens) {
      setFilteredScreens([]);
      return;
    }
    
    if (selectedMaterial === 'all') {
      setFilteredScreens(screens);
    } else {
      setFilteredScreens(screens.filter(screen => screen.materialId === selectedMaterial));
    }
  }, [screens, selectedMaterial]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchData();
    fetchMaterials();
    
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Fetch path when screen is selected
  useEffect(() => {
    if (selectedScreen) {
      fetchPathData(selectedScreen.deviceId);
    }
  }, [selectedScreen, selectedDate]);

  const handleScreenSelect = (screen: ScreenStatus) => {
    setSelectedScreen(screen);
    if (screen.currentLocation) {
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
    if (!screen.isOnline) return '#ef4444'; // red
    if (screen.isCompliant) return '#22c55e'; // green
    return '#eab308'; // yellow
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
                   <option key={material._id} value={material.materialId}>
                     {material.title} - {material.materialId} ({material.materialType})
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

             {/* Debug Info */}
       {process.env.NODE_ENV === 'development' && (
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
           <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                            <p className="text-xs text-yellow-800">
                 Debug: Materials loaded: {materials?.length || 0} | Selected: {selectedMaterial}
               </p>
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
                   Material: {materials?.find(m => m.materialId === selectedMaterial)?.title || selectedMaterial}
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
              <div className="h-96">
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
                  
                  {/* Screen markers */}
                  {filteredScreens?.map((screen) => (
                    <Marker
                      key={screen.deviceId}
                      position={[screen.currentLocation?.lat || 0, screen.currentLocation?.lng || 0] as LatLngTuple}
                      eventHandlers={{
                        click: () => handleScreenSelect(screen),
                      }}
                    >
                      <CircleMarker
                        center={[screen.currentLocation?.lat || 0, screen.currentLocation?.lng || 0] as LatLngTuple}
                        radius={8}
                        pathOptions={{
                          color: getMarkerColor(screen),
                          fillColor: getMarkerColor(screen),
                          fillOpacity: 0.7,
                          weight: 2
                        }}
                      />
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">{screen.screenType} {screen.slotNumber || ''}</h3>
                          <p className="text-sm">Material: {screen.materialId}</p>
                          <p className="text-sm">Hours: {formatTime(screen.currentHours)}</p>
                          <p className="text-sm">Distance: {formatDistance(screen.totalDistanceToday)}</p>
                          <p className="text-sm">Status: {screen.displayStatus}</p>
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
                           <span className="font-medium">{screen.screenType} {screen.slotNumber || ''}</span>
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
