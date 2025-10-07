import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in development
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/marker-icon-2x.png',
    iconUrl: '/images/marker-icon.png',
    shadowUrl: '/images/marker-shadow.png',
  });
}

interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  accuracy: number;
  address: string;
}

interface RouteMetrics {
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
  totalAdPlays: number;
  totalQRScans: number;
}

interface RouteData {
  route: RoutePoint[];
  metrics: RouteMetrics;
}

interface EnhancedRouteMapProps {
  deviceId: string;
  className?: string;
  style?: React.CSSProperties;
  showMetrics?: boolean;
  showSpeedColors?: boolean;
  showWaypoints?: boolean;
  onRouteLoad?: (data: RouteData) => void;
}

// Component to fit map bounds to route
const FitBounds: React.FC<{ route: RoutePoint[] }> = ({ route }) => {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      const bounds = L.latLngBounds(
        route.map(point => [point.lat, point.lng])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [route, map]);

  return null;
};

// Speed-based color function (like Strava)
const getSpeedColor = (speed: number): string => {
  if (speed < 5) return '#ff4444';      // Red - stopped/slow
  if (speed < 15) return '#ff8800';     // Orange - slow
  if (speed < 30) return '#ffdd00';     // Yellow - medium
  if (speed < 50) return '#88ff00';     // Light green - fast
  return '#00ff88';                     // Green - very fast
};

// Create speed-colored polyline segments
const createSpeedSegments = (route: RoutePoint[]) => {
  const segments: Array<{
    positions: [number, number][];
    color: string;
    weight: number;
    opacity: number;
  }> = [];
  
  for (let i = 0; i < route.length - 1; i++) {
    const current = route[i];
    const next = route[i + 1];
    
    segments.push({
      positions: [[current.lat, current.lng], [next.lat, next.lng]] as [number, number][],
      color: getSpeedColor(current.speed),
      weight: 4,
      opacity: 0.8
    });
  }
  
  return segments;
};

const EnhancedRouteMap: React.FC<EnhancedRouteMapProps> = ({
  deviceId,
  className = '',
  style = { height: '100%', width: '100%' },
  showMetrics = true,
  showSpeedColors = true,
  showWaypoints = false,
  onRouteLoad
}) => {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch route data
  useEffect(() => {
    if (!deviceId || !isClient) return;

    const fetchRouteData = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
        const response = await fetch(
          `${baseUrl}/screenTracking/route/${deviceId}`
        );
        
        const result = await response.json();
        
        if (result.success) {
          setRouteData(result.data);
          if (onRouteLoad) {
            onRouteLoad(result.data);
          }
        } else {
          setError(result.message || 'Failed to fetch route data');
        }
      } catch (err) {
        setError('Network error: Unable to fetch route data');
        console.error('Error fetching route data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [deviceId, isClient, onRouteLoad]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isClient) {
    return <div>Loading map...</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading route data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
        <div className="text-center">
          <div className="text-red-600 text-2xl mb-2">⚠️</div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!routeData || !routeData.route || routeData.route.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-2xl mb-2">📍</div>
          <p className="text-gray-600">No route data available</p>
        </div>
      </div>
    );
  }

  const { route, metrics } = routeData;
  const polylineCoords = route.map(point => [point.lat, point.lng] as [number, number]);
  const speedSegments = createSpeedSegments(route);

  // Calculate center for map
  const centerLat = route.reduce((sum, point) => sum + point.lat, 0) / route.length;
  const centerLng = route.reduce((sum, point) => sum + point.lng, 0) / route.length;

  return (
    <div style={style} className={className}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Speed-colored route segments (like Strava) */}
        {showSpeedColors ? (
          speedSegments.map((segment, index) => (
            <Polyline
              key={`speed-segment-${index}`}
              positions={segment.positions as [number, number][]}
              color={segment.color}
              weight={segment.weight}
              opacity={segment.opacity}
            />
          ))
        ) : (
          /* Single color route */
          <Polyline
            positions={polylineCoords}
            color="#3674B5"
            weight={4}
            opacity={0.8}
          />
        )}
        
        {/* Waypoints (every 10th point) */}
        {showWaypoints && route.map((point, index) => {
          if (index % 10 === 0) {
            return (
              <CircleMarker
                key={`waypoint-${index}`}
                center={[point.lat, point.lng]}
                radius={3}
                color="#ffffff"
                weight={2}
                fillColor={getSpeedColor(point.speed)}
                fillOpacity={0.8}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">📍 Waypoint {Math.floor(index / 10) + 1}</div>
                    <div>Time: {formatTimestamp(point.timestamp)}</div>
                    <div>Speed: {point.speed.toFixed(1)} km/h</div>
                    {point.address && <div>Address: {point.address}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          }
          return null;
        })}
        
        {/* Start marker */}
        {route.length > 0 && (
          <Marker position={[route[0].lat, route[0].lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-green-600">🚀 Start Point</div>
                <div>Time: {formatTimestamp(route[0].timestamp)}</div>
                <div>Speed: {route[0].speed.toFixed(1)} km/h</div>
                {route[0].address && <div>Address: {route[0].address}</div>}
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* End marker */}
        {route.length > 1 && (
          <Marker position={[route[route.length - 1].lat, route[route.length - 1].lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-red-600">🏁 End Point</div>
                <div>Time: {formatTimestamp(route[route.length - 1].timestamp)}</div>
                <div>Speed: {route[route.length - 1].speed.toFixed(1)} km/h</div>
                {route[route.length - 1].address && <div>Address: {route[route.length - 1].address}</div>}
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Fit bounds to route */}
        <FitBounds route={route} />
      </MapContainer>
      
      {/* Enhanced route metrics (like Strava) */}
      {showMetrics && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <div className="text-lg font-bold text-gray-800 mb-3">Route Stats</div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Distance</div>
              <div className="font-semibold">{metrics.totalDistance.toFixed(2)} km</div>
            </div>
            
            <div>
              <div className="text-gray-500">Duration</div>
              <div className="font-semibold">{formatDuration(metrics.totalDuration)}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Avg Speed</div>
              <div className="font-semibold">{metrics.averageSpeed.toFixed(1)} km/h</div>
            </div>
            
            <div>
              <div className="text-gray-500">Ad Plays</div>
              <div className="font-semibold">{metrics.totalAdPlays}</div>
            </div>
            
            <div>
              <div className="text-gray-500">QR Scans</div>
              <div className="font-semibold">{metrics.totalQRScans}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Points</div>
              <div className="font-semibold">{route.length}</div>
            </div>
          </div>
          
          {/* Speed legend */}
          {showSpeedColors && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Speed Colors:</div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>&lt;5 km/h</span>
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>5-15</span>
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>15-30</span>
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>&gt;30</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedRouteMap;
