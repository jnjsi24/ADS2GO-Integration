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
  altitude: number;
  segmentDistance: number;
  cumulativeDistance: number;
  index: number;
}

interface SpeedSegment {
  start: [number, number];
  end: [number, number];
  color: string;
  speed: number;
  speedCategory: string;
  distance: number;
}

interface Waypoint {
  type: 'start' | 'end' | 'speed_change' | 'high_accuracy';
  position: [number, number];
  timestamp: string;
  speed?: number;
  speedChange?: number;
  accuracy?: number;
  address: string;
}

interface RouteBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  center: [number, number];
}

interface RouteMetrics {
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
  maxSpeed: number;
  totalAdPlays: number;
  totalQRScans: number;
  totalHoursOnline: number;
  pointCount: number;
  startTime: string;
  endTime: string;
  gpsQuality?: {
    score: number;
    dataQuality: number;
    validPoints: number;
    totalPoints: number;
    message: string;
  };
}

interface StravaStyleRouteMapProps {
  materialId: string;
  date?: string;
  className?: string;
  style?: React.CSSProperties;
  showSpeedColors?: boolean;
  showWaypoints?: boolean;
  showMetrics?: boolean;
  onRouteLoad?: (data: any) => void;
}

// Component to fit map bounds to route
const FitBounds: React.FC<{ bounds: RouteBounds | null }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      const leafletBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
      );
      map.fitBounds(leafletBounds, { padding: [20, 20] });
    }
  }, [bounds, map]);

  return null;
};

// Component to render speed segments
const SpeedSegments: React.FC<{ segments: SpeedSegment[] }> = ({ segments }) => {
  return (
    <>
      {segments.map((segment, index) => (
        <Polyline
          key={index}
          positions={[segment.start, segment.end]}
          color={segment.color}
          weight={4}
          opacity={0.8}
        />
      ))}
    </>
  );
};

// Component to render waypoints
const Waypoints: React.FC<{ waypoints: Waypoint[] }> = ({ waypoints }) => {
  const getWaypointIcon = (type: string) => {
    const iconConfig = {
      start: { color: '#4CAF50', symbol: '🚀' },
      end: { color: '#F44336', symbol: '🏁' },
      speed_change: { color: '#FF9800', symbol: '⚡' },
      high_accuracy: { color: '#2196F3', symbol: '📍' }
    };

    const config = iconConfig[type as keyof typeof iconConfig] || iconConfig.high_accuracy;

    return L.divIcon({
      html: `<div style="
        background-color: ${config.color};
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${config.symbol}</div>`,
      className: 'custom-waypoint-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };

  return (
    <>
      {waypoints.map((waypoint, index) => (
        <Marker
          key={index}
          position={waypoint.position}
          icon={getWaypointIcon(waypoint.type)}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-gray-800">
                {waypoint.type === 'start' && '🚀 Start Point'}
                {waypoint.type === 'end' && '🏁 End Point'}
                {waypoint.type === 'speed_change' && '⚡ Speed Change'}
                {waypoint.type === 'high_accuracy' && '📍 High Accuracy'}
              </div>
              <div>Time: {new Date(waypoint.timestamp).toLocaleTimeString()}</div>
              {waypoint.speed !== undefined && (
                <div>Speed: {waypoint.speed.toFixed(1)} km/h</div>
              )}
              {waypoint.speedChange !== undefined && (
                <div>Speed Change: {waypoint.speedChange.toFixed(1)} km/h</div>
              )}
              {waypoint.accuracy !== undefined && (
                <div>Accuracy: {waypoint.accuracy.toFixed(1)}m</div>
              )}
              {waypoint.address && <div>Address: {waypoint.address}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

const StravaStyleRouteMap: React.FC<StravaStyleRouteMapProps> = ({
  materialId,
  date,
  className = '',
  style = { height: '100%', width: '100%' },
  showSpeedColors = true,
  showWaypoints = true,
  showMetrics = true,
  onRouteLoad
}) => {
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const fetchingRef = useRef(false);

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset fetching state when materialId or date changes
  useEffect(() => {
    fetchingRef.current = false;
  }, [materialId, date]);

  // Fetch route data
  useEffect(() => {
    if (!materialId || !isClient) return;

    // Prevent multiple simultaneous requests
    if (fetchingRef.current) {
      console.log('🔄 [StravaStyleRouteMap] Request already in progress, skipping...');
      return;
    }

    const fetchRouteData = async () => {
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        console.log('🗺️ [StravaStyleRouteMap] Props:', { materialId, date, showSpeedColors, showMetrics });

        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
        let url = `${baseUrl}/api/enhancedRoute/route/${materialId}`;
        
        if (date) {
          url += `?date=${date}&includeSpeedSegments=${showSpeedColors}&includeMetrics=${showMetrics}`;
        }

        console.log('🗺️ [StravaStyleRouteMap] Fetching from:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ [StravaStyleRouteMap] Route data received:', result.data);
          setRouteData(result.data);
          setLoading(false);
          if (onRouteLoad) {
            onRouteLoad(result.data);
          }
        } else {
          console.log('❌ [StravaStyleRouteMap] API returned error:', result.message);
          setError(result.message || 'Failed to fetch route data');
          setLoading(false);
        }
      } catch (err) {
        setError('Network error: Unable to fetch route data');
        console.error('❌ [StravaStyleRouteMap] Error:', err);
        setLoading(false);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchRouteData();
  }, [materialId, date, isClient, showSpeedColors, showMetrics]);

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
    return <div className="flex items-center justify-center h-full">Loading map...</div>;
  }

  // Don't render map if no route data and not loading
  if (!loading && !routeData) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">No route data available</p>
          <p className="text-sm">No GPS tracking data found for the selected date</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading route data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 rounded-lg">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading route</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!routeData || !routeData.route || routeData.route.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">No route data available</p>
          <p className="text-sm">No GPS tracking data found for the selected date</p>
        </div>
      </div>
    );
  }

  const { route, speedSegments, waypoints, bounds, metrics } = routeData;

  // Safety check for route data
  if (!route || !Array.isArray(route) || route.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">Invalid route data</p>
          <p className="text-sm">Route data is not in the expected format</p>
        </div>
      </div>
    );
  }

  // Convert route points to polyline coordinates with safety checks
  const polylineCoords: [number, number][] = route
    .filter((point: RoutePoint) => point && typeof point.lat === 'number' && typeof point.lng === 'number')
    .map((point: RoutePoint) => [point.lat, point.lng] as [number, number]);

  // Safety check for valid coordinates
  if (polylineCoords.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">No valid coordinates</p>
          <p className="text-sm">All GPS points have invalid coordinates</p>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className={className}>
      <MapContainer
        center={bounds?.center || [14.5995, 120.9842]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        key={`map-${materialId}-${date}`} // Force re-render when props change
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Route polyline with speed-based color coding */}
        {showSpeedColors && speedSegments && speedSegments.length > 0 ? (
          <SpeedSegments segments={speedSegments} />
        ) : (
          <Polyline
            positions={polylineCoords}
            color="#3674B5"
            weight={4}
            opacity={0.8}
          />
        )}
        
        {/* Waypoints */}
        {showWaypoints && waypoints && waypoints.length > 0 && (
          <Waypoints waypoints={waypoints} />
        )}
        
        {/* Fit bounds to route */}
        <FitBounds bounds={bounds} />
      </MapContainer>
      
      {/* Route metrics */}
      {showMetrics && metrics && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="font-semibold text-gray-800 mb-3">Route Metrics</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Distance:</span>
              <span className="font-medium">{metrics.totalDistance.toFixed(2)} km</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{formatDuration(metrics.totalDuration)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Speed:</span>
              <span className="font-medium">{metrics.averageSpeed.toFixed(1)} km/h</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Max Speed:</span>
              <span className="font-medium">{metrics.maxSpeed.toFixed(1)} km/h</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Points:</span>
              <span className="font-medium">{metrics.pointCount.toLocaleString()}</span>
            </div>
            
            {metrics.totalAdPlays > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Ad Plays:</span>
                <span className="font-medium">{metrics.totalAdPlays}</span>
              </div>
            )}
            
            {metrics.totalQRScans > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">QR Scans:</span>
                <span className="font-medium">{metrics.totalQRScans}</span>
              </div>
            )}
            
            {metrics.gpsQuality && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">GPS Quality:</span>
                  <span className={`font-medium ${
                    metrics.gpsQuality.score >= 85 ? 'text-green-600' :
                    metrics.gpsQuality.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.gpsQuality.score}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Quality:</span>
                  <span className="font-medium">{metrics.gpsQuality.dataQuality}%</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {metrics.gpsQuality.message}
                </div>
              </>
            )}
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div>Start: {formatTimestamp(metrics.startTime)}</div>
              <div>End: {formatTimestamp(metrics.endTime)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StravaStyleRouteMap;
