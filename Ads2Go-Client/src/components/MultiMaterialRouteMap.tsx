import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
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
  timestamp?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
  address?: string;
}

interface MaterialRoute {
  materialId: string;
  route: RoutePoint[];
  color: string;
  totalDistance?: number;
  duration?: number;
  avgSpeed?: number;
}

interface MultiMaterialRouteMapProps {
  materialIds: string[];
  date: string;
  className?: string;
  style?: React.CSSProperties;
}

// Predefined colors for different routes
const ROUTE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const MultiMaterialRouteMap: React.FC<MultiMaterialRouteMapProps> = ({
  materialIds,
  date,
  className = '',
  style = {}
}) => {
  const [materialRoutes, setMaterialRoutes] = useState<MaterialRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);
  const [zoom, setZoom] = useState(12);
  
  // 🔄 Track if this is the initial load (for silent refresh)
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const fetchAllRoutes = async (silentRefresh = false) => {
      // Only show loading state on initial load, not on silent refreshes
      if (!silentRefresh) {
        setLoading(true);
      }
      
      const logPrefix = silentRefresh ? '🔄 [Silent Refresh]' : '📍 [MultiMaterialRouteMap]';
      console.log(`${logPrefix} Fetching routes for ${materialIds.length} materials on ${date}`);

      const routes: MaterialRoute[] = [];
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');

      // Fetch all routes in parallel for faster loading
      const fetchPromises = materialIds.map(async (materialId, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        try {
          const url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${date}`;
          console.log(`📡 [MultiMaterialRouteMap] Fetching route ${i + 1}/${materialIds.length}: ${materialId}`);
          
          const response = await fetch(url);
          
          // Handle server errors
          if (!response.ok) {
            console.error(`❌ [MultiMaterialRouteMap] Server error ${response.status} for ${materialId}`);
            return null;
          }
          
          const result = await response.json();

          // Check if the API returned success: false (no route data)
          if (!result.success || !result.data) {
            console.log(`⚠️ [MultiMaterialRouteMap] No route found for ${materialId} on ${date}`);
            return null;
          }

          // Check if route has valid data
          if (result.data?.route && result.data.route.length > 0) {
            console.log(`✅ [MultiMaterialRouteMap] Found route for ${materialId}: ${result.data.route.length} points`);
            return {
              materialId,
              route: result.data.route,
              color,
              totalDistance: result.data.totalDistance,
              duration: result.data.duration,
              avgSpeed: result.data.avgSpeed,
            };
          } else {
            console.log(`⚠️ [MultiMaterialRouteMap] No valid route data for ${materialId}`);
            return null;
          }
        } catch (error) {
          console.error(`❌ [MultiMaterialRouteMap] Error fetching route for ${materialId}:`, error);
          return null;
        }
      });

      // Wait for all fetches to complete in parallel
      const fetchedRoutes = await Promise.all(fetchPromises);
      
      // Filter out null results (failed or empty routes)
      routes.push(...fetchedRoutes.filter((route): route is MaterialRoute => route !== null));

      console.log(`${logPrefix} Total routes found: ${routes.length}/${materialIds.length}`);
      setMaterialRoutes(routes);

      // Calculate map center from all routes (only on initial load, not silent refresh)
      if (!silentRefresh && routes.length > 0) {
        const allPoints = routes.flatMap(r => r.route);
        const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
        const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
        setMapCenter([avgLat, avgLng]);

        // Adjust zoom based on route spread
        if (routes.length === 1 && routes[0].route.length < 10) {
          setZoom(15);
        } else {
          setZoom(13);
        }
      }

      // Mark initial load as complete
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }

      // Only update loading state if this wasn't a silent refresh
      if (!silentRefresh) {
        setLoading(false);
      }
    };

    // Reset initial load flag when materialIds or date changes
    isInitialLoadRef.current = true;
    
    if (materialIds.length > 0) {
      fetchAllRoutes(false); // Initial load with loading state
    } else {
      setLoading(false);
    }
  }, [materialIds, date]);

  // 🔄 NEW: Auto-refresh routes every 2 seconds for smooth real-time updates (matches Admin Client)
  useEffect(() => {
    // Only auto-refresh if we have materials to track
    if (materialIds.length === 0) {
      return;
    }

    console.log('🔄 [MultiMaterialRouteMap] Starting 2-second auto-refresh for smooth route updates');

    const refreshInterval = setInterval(async () => {
      console.log('🔄 [Auto-Refresh] Refreshing routes silently');
      
      // Silent refresh - don't show loading state
      const routes: MaterialRoute[] = [];
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');

      // Fetch all routes in parallel
      const fetchPromises = materialIds.map(async (materialId, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        try {
          const url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${date}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            return null;
          }
          
          const result = await response.json();

          if (!result.success || !result.data || !result.data?.route || result.data.route.length === 0) {
            return null;
          }

          return {
            materialId,
            route: result.data.route,
            color,
            totalDistance: result.data.totalDistance,
            duration: result.data.duration,
            avgSpeed: result.data.avgSpeed,
          };
        } catch (error) {
          return null;
        }
      });

      const fetchedRoutes = await Promise.all(fetchPromises);
      routes.push(...fetchedRoutes.filter((route): route is MaterialRoute => route !== null));

      // Update routes silently (no loading state, no map center change)
      setMaterialRoutes(routes);
      console.log(`✅ [Auto-Refresh] Routes updated: ${routes.length}/${materialIds.length}`);
    }, 2000); // Refresh every 2 seconds

    return () => {
      console.log('🔄 [MultiMaterialRouteMap] Stopping auto-refresh');
      clearInterval(refreshInterval);
    };
  }, [materialIds, date]);

  // Create custom markers for start/end points
  const createMarkerIcon = (type: 'start' | 'end', color: string) => {
    const iconHtml = `
      <div style="
        width: 30px;
        height: 30px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: white;
      ">
        ${type === 'start' ? '🏁' : '🏁'}
      </div>
    `;
    
    return new L.DivIcon({
      html: iconHtml,
      className: 'custom-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
  };

  if (loading) {
    return (
      <div style={style} className={className}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1b5087] mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading routes for {materialIds.length} material{materialIds.length > 1 ? 's' : ''}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (materialRoutes.length === 0) {
    return (
      <div style={style} className={className}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center p-6">
            <div className="text-gray-400 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Route Available</h3>
            <p className="text-sm text-gray-500">
              No tracking data available for this date. None of the {materialIds.length} material{materialIds.length > 1 ? 's were' : ' was'} active on this day.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className={className}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Render all routes */}
        {materialRoutes.map((materialRoute, index) => (
          <React.Fragment key={materialRoute.materialId}>
            {/* Route polyline */}
            <Polyline
              positions={materialRoute.route.map(point => [point.lat, point.lng])}
              color={materialRoute.color}
              weight={4}
              opacity={0.8}
            />

            {/* Start marker */}
            {materialRoute.route.length > 0 && (
              <Marker
                position={[materialRoute.route[0].lat, materialRoute.route[0].lng]}
                icon={createMarkerIcon('start', materialRoute.color)}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-sm mb-1" style={{ color: materialRoute.color }}>
                      {materialRoute.materialId}
                    </h3>
                    <p className="text-xs text-gray-600">Start Point</p>
                    {materialRoute.route[0].address && (
                      <p className="text-xs text-gray-500 mt-1">{materialRoute.route[0].address}</p>
                    )}
                    {materialRoute.route[0].timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(materialRoute.route[0].timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* End marker */}
            {materialRoute.route.length > 1 && (
              <Marker
                position={[
                  materialRoute.route[materialRoute.route.length - 1].lat,
                  materialRoute.route[materialRoute.route.length - 1].lng
                ]}
                icon={createMarkerIcon('end', materialRoute.color)}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-sm mb-1" style={{ color: materialRoute.color }}>
                      {materialRoute.materialId}
                    </h3>
                    <p className="text-xs text-gray-600">End Point</p>
                    {materialRoute.route[materialRoute.route.length - 1].address && (
                      <p className="text-xs text-gray-500 mt-1">
                        {materialRoute.route[materialRoute.route.length - 1].address}
                      </p>
                    )}
                    {materialRoute.route[materialRoute.route.length - 1].timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(materialRoute.route[materialRoute.route.length - 1].timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        ))}
      </MapContainer>

      {/* Route Legend */}
      <div className="absolute bottom-4 left-4 bg-white px-4 py-3 shadow-lg rounded-md z-[1000] max-w-xs">
        <h4 className="text-xs font-bold text-gray-700 mb-2">
          Routes ({materialRoutes.length}/{materialIds.length} materials active)
        </h4>
        <div className="space-y-1">
          {materialRoutes.map((materialRoute) => (
            <div key={materialRoute.materialId} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: materialRoute.color }}
              />
              <span className="font-medium text-gray-700">{materialRoute.materialId}</span>
              {materialRoute.totalDistance && (
                <span className="text-gray-500">
                  {(materialRoute.totalDistance / 1000).toFixed(1)} km
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MultiMaterialRouteMap;

