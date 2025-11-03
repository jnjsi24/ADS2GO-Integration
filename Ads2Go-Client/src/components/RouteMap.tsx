import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { snapPointsToRoads } from '../utils/roadSnapping';

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
  pointCount: number;
  startTime: string | null;
  endTime: string | null;
}

interface RouteData {
  deviceId: string;
  materialId: string;
  route: RoutePoint[];
  metrics: RouteMetrics;
}

interface RouteMapProps {
  deviceId: string;
  className?: string;
  style?: React.CSSProperties;
  showMetrics?: boolean;
  onRouteLoad?: (data: RouteData) => void;
}

// Component to fit map bounds to route
const FitBounds: React.FC<{ route: RoutePoint[] }> = ({ route }) => {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0 && map) {
      try {
        // Wait for map to be ready before fitting bounds
        map.whenReady(() => {
          const bounds = L.latLngBounds(
            route.map(point => [point.lat, point.lng])
          );
          map.fitBounds(bounds, { padding: [20, 20], animate: false });
        });
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [map, route]);

  return null;
};

const RouteMap: React.FC<RouteMapProps> = ({
  deviceId,
  className = '',
  style = { height: '100%', width: '100%' },
  showMetrics = true,
  onRouteLoad
}) => {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
    setMapKey(prev => prev + 1);
  }, []);

  // Fetch route data
  useEffect(() => {
    if (!deviceId || !isClient) return;

    const fetchRouteData = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
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
    return new Date(timestamp).toLocaleString();
  };

  if (!isClient) {
    return <div style={style} className={className} />;
  }

  if (loading) {
    return (
      <div style={style} className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading route...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style} className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!routeData || routeData.route.length === 0) {
    return (
      <div style={style} className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="text-gray-400 mb-2">📍</div>
          <p className="text-sm text-gray-600">No route data available</p>
        </div>
      </div>
    );
  }

  const route = routeData.route;
  const metrics = routeData.metrics;

  // Create raw polyline coordinates
  const rawPolylineCoords = useMemo(() => {
    return route.map(point => [point.lat, point.lng] as [number, number]);
  }, [route]);

  // State for snapped coordinates (with safe fallback)
  const [snappedPolylineCoords, setSnappedPolylineCoords] = useState<[number, number][]>(rawPolylineCoords);
  const [lastProcessedRoute, setLastProcessedRoute] = useState<string>('');

  // Apply road snapping when route changes (safe fallback to raw coordinates if fails)
  useEffect(() => {
    let isMounted = true;
    
    // Create a stable key for this route
    const routeKey = JSON.stringify(rawPolylineCoords);
    
    // Skip if we've already processed this exact route
    if (routeKey === lastProcessedRoute) {
      return;
    }
    
    // Initialize with raw coordinates (immediate fallback)
    if (isMounted) {
      setSnappedPolylineCoords(rawPolylineCoords);
    }
    
    const applyRoadSnapping = async () => {
      if (rawPolylineCoords.length === 0) {
        if (isMounted) {
          setSnappedPolylineCoords([]);
          setLastProcessedRoute(routeKey);
        }
        return;
      }

      try {
        // Apply road snapping (with automatic fallback if API unavailable)
        const snappedCoords = await snapPointsToRoads(rawPolylineCoords);
        
        if (isMounted) {
          setSnappedPolylineCoords(snappedCoords);
          setLastProcessedRoute(routeKey);
        }
      } catch (error) {
        console.error('❌ [Road Snapping] Error:', error);
        // Safe fallback: use raw coordinates if snapping fails
        if (isMounted) {
          setSnappedPolylineCoords(rawPolylineCoords);
          setLastProcessedRoute(routeKey);
        }
      }
    };

    applyRoadSnapping();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [rawPolylineCoords, lastProcessedRoute]);

  // Use snapped coordinates (or raw if snapping failed/not available)
  const polylineCoords = snappedPolylineCoords.length > 0 ? snappedPolylineCoords : rawPolylineCoords;

  // Get center point for map
  const centerLat = route.reduce((sum, point) => sum + point.lat, 0) / route.length;
  const centerLng = route.reduce((sum, point) => sum + point.lng, 0) / route.length;

  return (
    <div style={style} className={className}>
      <MapContainer
        key={mapKey}
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Route polyline */}
        <Polyline
          positions={polylineCoords}
          color="#3674B5"
          weight={4}
          opacity={0.8}
        />
        
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
      
      {/* Route metrics */}
      {showMetrics && (
        <div className="mt-3 p-3 bg-white rounded-lg shadow-sm border">
          <h4 className="font-semibold text-gray-800 mb-2">Route Statistics</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Distance:</span>
              <span className="ml-1 font-medium">{metrics.totalDistance.toFixed(2)} km</span>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <span className="ml-1 font-medium">{formatDuration(metrics.totalDuration)}</span>
            </div>
            <div>
              <span className="text-gray-600">Avg Speed:</span>
              <span className="ml-1 font-medium">{metrics.averageSpeed.toFixed(1)} km/h</span>
            </div>
            <div>
              <span className="text-gray-600">Points:</span>
              <span className="ml-1 font-medium">{metrics.pointCount}</span>
            </div>
          </div>
          {metrics.startTime && metrics.endTime && (
            <div className="mt-2 pt-2 border-t text-xs text-gray-500">
              <div>Start: {formatTimestamp(metrics.startTime)}</div>
              <div>End: {formatTimestamp(metrics.endTime)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteMap;
