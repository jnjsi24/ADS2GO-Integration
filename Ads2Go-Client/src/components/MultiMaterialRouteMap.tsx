import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
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
  isSegmentBreak?: boolean;
  isSegmentStart?: boolean;
}

interface MaterialRoute {
  materialId: string;
  route: RoutePoint[];
  color: string;
  totalDistance?: number;
  duration?: number;
  avgSpeed?: number;
  snappedRoute?: [number, number][][]; // Snapped route segments
}

interface RouteBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  center: [number, number];
}

interface MultiMaterialRouteMapProps {
  materialIds: string[];
  date: string;
  className?: string;
  style?: React.CSSProperties;
  snapToRoads?: boolean;
  disableAutoRefresh?: boolean; // ✅ Disable auto-refresh (e.g., for history tab)
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

// Component to fit map bounds to route
const FitBounds: React.FC<{ bounds: RouteBounds | null }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds || !map) return;

    const fitBoundsSafely = () => {
      try {
        // ✅ FIX: Wait for map to be fully initialized before fitting bounds
        // Check if map container and panes are ready
        const container = map.getContainer();
        if (!container) {
          setTimeout(fitBoundsSafely, 100);
          return;
        }

        // Additional check: ensure map has valid size
        const containerSize = container.getBoundingClientRect();
        if (containerSize.width === 0 || containerSize.height === 0) {
          // Container has no size yet, wait a bit more
          setTimeout(fitBoundsSafely, 100);
          return;
        }

        // Check if map pane exists
        const mapPane = map.getPane('mapPane');
        if (!mapPane) {
          setTimeout(fitBoundsSafely, 100);
          return;
        }

        // Map is ready, fit bounds
        const leafletBounds = L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        );
        
        // Use whenReady as additional safety check
        if (map.whenReady) {
          map.whenReady(() => {
            try {
              // Double-check map is still valid before fitting
              if (map.getContainer() && map.getPane('mapPane')) {
                map.fitBounds(leafletBounds, { padding: [20, 20], animate: false, maxZoom: 18 });
              }
            } catch (error) {
              console.warn('Error fitting bounds in whenReady:', error);
            }
          });
        } else {
          // Fallback: try to fit bounds directly with error handling
          try {
            map.fitBounds(leafletBounds, { padding: [20, 20], animate: false, maxZoom: 18 });
          } catch (error) {
            console.warn('Error fitting bounds:', error);
          }
        }
      } catch (error) {
        console.warn('Error in fitBoundsSafely:', error);
      }
    };

    // Wait for map to be ready before attempting to fit bounds
    if (map.whenReady) {
      map.whenReady(() => {
        // Small delay to ensure map is fully rendered
        setTimeout(fitBoundsSafely, 50);
      });
    } else {
      // Fallback if whenReady is not available
      setTimeout(fitBoundsSafely, 100);
    }
  }, [bounds, map]);

  return null;
};

// Function to smooth GPS points using an improved algorithm (no API required)
const smoothRoute = (points: [number, number][]): [number, number][] => {
  if (points.length < 3) return points;
  
  const smoothed: [number, number][] = [points[0]]; // Keep first point
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    
    // Calculate distance between consecutive points (in degrees)
    const dist1 = Math.sqrt(
      Math.pow(current[0] - prev[0], 2) + Math.pow(current[1] - prev[1], 2)
    );
    const dist2 = Math.sqrt(
      Math.pow(next[0] - current[0], 2) + Math.pow(next[1] - current[1], 2)
    );
    
    // Convert to approximate meters (1 degree ≈ 111,000 meters)
    const dist1Meters = dist1 * 111000;
    const dist2Meters = dist2 * 111000;
    
    // If distance is too large (> 1000 meters), it might be GPS error - use weighted average
    if (dist1Meters > 1000 || dist2Meters > 1000) {
      // Use weighted average favoring the closer neighbor
      const weight1 = 1 / (dist1 + 0.001);
      const weight2 = 1 / (dist2 + 0.001);
      const totalWeight = weight1 + weight2;
      
      const smoothedLat = (weight1 * prev[0] + weight2 * next[0]) / totalWeight;
      const smoothedLng = (weight1 * prev[1] + weight2 * next[1]) / totalWeight;
      
      smoothed.push([smoothedLat, smoothedLng]);
    } else {
      // Enhanced smoothing with weighted average based on distance
      const totalDist = dist1Meters + dist2Meters;
      
      // For very close points (< 5m), apply minimal smoothing to preserve accuracy
      if (dist1Meters < 5 && dist2Meters < 5) {
        const smoothingFactor = 0.1;
        const smoothedLat = current[0] * (1 - smoothingFactor) + 
                           ((prev[0] + current[0] + next[0]) / 3) * smoothingFactor;
        const smoothedLng = current[1] * (1 - smoothingFactor) + 
                           ((prev[1] + current[1] + next[1]) / 3) * smoothingFactor;
        smoothed.push([smoothedLat, smoothedLng]);
      } else {
        // Standard smoothing for normal distance points
        const weight1 = dist2Meters / totalDist;
        const weight2 = dist1Meters / totalDist;
        
        const smoothedLat = (weight1 * prev[0] + current[0] + weight2 * next[0]) / (weight1 + 1 + weight2);
        const smoothedLng = (weight1 * prev[1] + current[1] + weight2 * next[1]) / (weight1 + 1 + weight2);
        
        smoothed.push([smoothedLat, smoothedLng]);
      }
    }
  }
  
  smoothed.push(points[points.length - 1]); // Keep last point
  
  // Second pass smoothing
  const doubleSmoothed: [number, number][] = [];
  doubleSmoothed.push(smoothed[0]);
  
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1];
    const current = smoothed[i];
    const next = smoothed[i + 1];
    
    const smoothedLat = (prev[0] + current[0] + next[0]) / 3;
    const smoothedLng = (prev[1] + current[1] + next[1]) / 3;
    
    doubleSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  doubleSmoothed.push(smoothed[smoothed.length - 1]);
  return doubleSmoothed;
};

// Function to add intermediate points for better road following
const addIntermediatePoints = (points: [number, number][]): [number, number][] => {
  if (points.length < 2) return points;
  
  const enhanced: [number, number][] = [];
  enhanced.push(points[0]);
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Calculate distance between points in meters
    const distance = Math.sqrt(
      Math.pow(next[0] - current[0], 2) + Math.pow(next[1] - current[1], 2)
    ) * 111000;
    
    // If distance is greater than 20 meters, add intermediate points
    if (distance > 20) {
      const numIntermediate = Math.min(Math.floor(distance / 8), 20);
      
      for (let j = 1; j <= numIntermediate; j++) {
        const ratio = j / (numIntermediate + 1);
        const lat = current[0] + (next[0] - current[0]) * ratio;
        const lng = current[1] + (next[1] - current[1]) * ratio;
        enhanced.push([lat, lng]);
      }
    } else if (distance > 10) {
      const numIntermediate = Math.min(Math.floor(distance / 10), 2);
      
      for (let j = 1; j <= numIntermediate; j++) {
        const ratio = j / (numIntermediate + 1);
        const lat = current[0] + (next[0] - current[0]) * ratio;
        const lng = current[1] + (next[1] - current[1]) * ratio;
        enhanced.push([lat, lng]);
      }
    }
    
    enhanced.push(next);
  }
  
  return enhanced;
};

// Function to snap GPS points to roads using Google Roads API
const snapPointsToRoads = async (points: [number, number][]): Promise<[number, number][]> => {
  if (points.length < 2) return points;
  
  // First apply smoothing and add intermediate points
  const smoothedPoints = smoothRoute(points);
  const enhancedPoints = addIntermediatePoints(smoothedPoints);
  
  // Check if we have a Google Roads API key
  const googleApiKey = process.env.REACT_APP_GOOGLE_ROADS_API_KEY;
  const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY;
  
  // Prefer Google Roads API if available
  if (googleApiKey && googleApiKey !== 'your-google-api-key-here') {
    return await snapWithGoogleRoads(enhancedPoints, googleApiKey);
  }
  
  // Fallback to OpenRouteService
  if (openRouteApiKey && openRouteApiKey !== 'your-api-key-here') {
    return await snapWithOpenRoute(enhancedPoints, openRouteApiKey);
  }
  
  // If no API key, return smoothed route
  return smoothedPoints;
};

// Google Roads API implementation
const snapWithGoogleRoads = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    const maxPointsPerBatch = 100;
    const batches: [number, number][][] = [];
    
    // Split points into batches
    for (let i = 0; i < points.length; i += maxPointsPerBatch) {
      batches.push(points.slice(i, i + maxPointsPerBatch));
    }
    
    const allSnappedPoints: [number, number][] = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const path = batch.map(([lat, lng]) => `${lat},${lng}`).join('|');
      
      const apiUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&key=${apiKey}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.warn(`Google Roads API batch ${batchIndex + 1} failed:`, response.status);
        allSnappedPoints.push(...batch);
        continue;
      }
      
      const data = await response.json();
      
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        const snappedPoints = data.snappedPoints.map((point: any) => [
          point.location.latitude,
          point.location.longitude
        ]);
        allSnappedPoints.push(...snappedPoints);
      } else {
        allSnappedPoints.push(...batch);
      }
      
      // Add small delay between batches
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return allSnappedPoints;
  } catch (error) {
    console.warn('Google Roads API error:', error);
    return points;
  }
};

// OpenRouteService API implementation
const snapWithOpenRoute = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    const coordinates = points.map(([lat, lng]) => [lng, lat]).join('|');
    
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&coordinates=${coordinates}&format=geojson&options={"continue_straight":false}`
    );
    
    if (!response.ok) {
      console.warn('OpenRouteService API failed:', response.status);
      return points;
    }
    
    const data = await response.json();
    
    if (data.features && data.features[0] && data.features[0].geometry) {
      const snappedCoordinates = data.features[0].geometry.coordinates;
      return snappedCoordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
    }
    
    return points;
  } catch (error) {
    console.warn('OpenRouteService API error:', error);
    return points;
  }
};

const MultiMaterialRouteMap: React.FC<MultiMaterialRouteMapProps> = ({
  materialIds,
  date,
  className = '',
  style = {},
  snapToRoads = true,
  disableAutoRefresh = false
}) => {
  const [materialRoutes, setMaterialRoutes] = useState<MaterialRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);
  const [zoom, setZoom] = useState(12);
  const [bounds, setBounds] = useState<RouteBounds | null>(null);
  const [isSnappingInProgress, setIsSnappingInProgress] = useState(false);
  
  // 🔄 Track if this is the initial load (for silent refresh)
  const isInitialLoadRef = useRef(true);
  const lastProcessedRoutesRef = useRef<Map<string, string>>(new Map());

  // Convert route points to segments (handle offline periods)
  const processRouteSegments = (route: RoutePoint[]): [number, number][][] => {
    const validPoints = route.filter((point: RoutePoint) => 
      point && typeof point.lat === 'number' && typeof point.lng === 'number'
    );
    
    if (validPoints.length === 0) return [];
    
    const segments: [number, number][][] = [];
    let currentSegment: [number, number][] = [];
    
    for (let i = 0; i < validPoints.length; i++) {
      const point = validPoints[i];
      
      // If this point starts a new segment (after offline period), save current segment
      if (i > 0 && (point.isSegmentBreak || point.isSegmentStart)) {
        if (currentSegment.length > 1) {
          segments.push([...currentSegment]);
        }
        currentSegment = [[point.lat, point.lng]];
      } else {
        currentSegment.push([point.lat, point.lng]);
      }
    }
    
    // Add final segment
    if (currentSegment.length > 1) {
      segments.push(currentSegment);
    }
    
    // If no segments were created (no breaks), return single segment
    if (segments.length === 0 && currentSegment.length > 1) {
      segments.push(currentSegment);
    }
    
    return segments;
  };

  // Track route data changes for snapping trigger
  const routesDataKey = useMemo(() => {
    return materialRoutes.map(r => `${r.materialId}-${r.route.length}`).join('|');
  }, [materialRoutes]);

  // Apply road snapping to routes
  useEffect(() => {
    if (materialRoutes.length === 0) {
      setIsSnappingInProgress(false);
      return;
    }

    if (!snapToRoads) {
      // If snapping is disabled, clear any existing snapped routes
      setMaterialRoutes(routes => routes.map(r => ({ ...r, snappedRoute: undefined })));
      setIsSnappingInProgress(false);
      return;
    }

    const applyRoadSnapping = async () => {
      setIsSnappingInProgress(true);
      
      const updatedRoutes = await Promise.all(
        materialRoutes.map(async (materialRoute) => {
          // Check if we've already processed this route
          const routeKey = JSON.stringify(materialRoute.route);
          const lastProcessed = lastProcessedRoutesRef.current.get(materialRoute.materialId);
          
          if (lastProcessed === routeKey && materialRoute.snappedRoute) {
            // Return existing snapped route
            return materialRoute;
          }
          
          // Process route into segments
          const segments = processRouteSegments(materialRoute.route);
          
          if (segments.length === 0) {
            return materialRoute;
          }
          
          // Apply road snapping to each segment
          const snappedSegments: [number, number][][] = [];
          
          for (const segment of segments) {
            const snappedSegment = await snapPointsToRoads(segment);
            snappedSegments.push(snappedSegment);
          }
          
          // Mark as processed
          lastProcessedRoutesRef.current.set(materialRoute.materialId, routeKey);
          
          return {
            ...materialRoute,
            snappedRoute: snappedSegments
          };
        })
      );
      
      setMaterialRoutes(updatedRoutes);
      setIsSnappingInProgress(false);
    };

    applyRoadSnapping();
  }, [routesDataKey, snapToRoads]);

  // ✅ Memoize materialIds to prevent unnecessary re-fetches
  const stableMaterialIds = useMemo(() => materialIds, [materialIds.join(',')]);
  const stableDate = useMemo(() => date, [date]);

  useEffect(() => {
    const fetchAllRoutes = async (silentRefresh = false) => {
      // Only show loading state on initial load, not on silent refreshes
      if (!silentRefresh) {
        setLoading(true);
      }
      
      const logPrefix = silentRefresh ? '🔄 [Silent Refresh]' : '📍 [MultiMaterialRouteMap]';
      console.log(`${logPrefix} Fetching routes for ${stableMaterialIds.length} materials on ${stableDate}`);

      const routes: MaterialRoute[] = [];
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');

      // Fetch all routes in parallel for faster loading
      const fetchPromises = stableMaterialIds.map(async (materialId, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        try {
          const url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${stableDate}`;
          console.log(`📡 [MultiMaterialRouteMap] Fetching route ${i + 1}/${stableMaterialIds.length}: ${materialId}`);
          
          const response = await fetch(url);
          
          // Handle server errors
          if (!response.ok) {
            console.error(`❌ [MultiMaterialRouteMap] Server error ${response.status} for ${materialId}`);
            return null;
          }
          
          const result = await response.json();

          // Check if the API returned success: false (no route data)
          if (!result.success || !result.data) {
            console.log(`⚠️ [MultiMaterialRouteMap] No route found for ${materialId} on ${stableDate}`);
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

      console.log(`${logPrefix} Total routes found: ${routes.length}/${stableMaterialIds.length}`);
      setMaterialRoutes(routes);

      // Calculate map center and bounds from all routes (only on initial load, not silent refresh)
      if (!silentRefresh && routes.length > 0) {
        const allPoints = routes.flatMap(r => r.route);
        const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
        const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
        setMapCenter([avgLat, avgLng]);

        // Calculate bounds
        const lats = allPoints.map(p => p.lat);
        const lngs = allPoints.map(p => p.lng);
        setBounds({
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs),
          center: [avgLat, avgLng]
        });

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
    lastProcessedRoutesRef.current.clear();
    
    if (stableMaterialIds.length > 0) {
      fetchAllRoutes(false); // Initial load with loading state
    } else {
      setLoading(false);
    }
  }, [stableMaterialIds, stableDate]);

  // 🔄 Auto-refresh routes every 2 seconds for smooth real-time updates (SILENT/BACKGROUND ONLY)
  useEffect(() => {
    // ✅ Disable auto-refresh if explicitly disabled (e.g., for history tab)
    if (disableAutoRefresh) {
      return;
    }

    // Only auto-refresh if we have materials to track
    if (stableMaterialIds.length === 0) {
      return;
    }

    // ✅ Don't auto-refresh for historical dates (only refresh for today's date)
    const today = new Date().toISOString().split('T')[0];
    const isToday = stableDate === today;
    
    if (!isToday) {
      // For historical dates, no auto-refresh needed
      return;
    }

    // ✅ Silent background auto-refresh - no console logs, no visual updates unless data changed
    const refreshInterval = setInterval(async () => {
      const routes: MaterialRoute[] = [];
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');

      // Fetch all routes in parallel
      const fetchPromises = stableMaterialIds.map(async (materialId, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        try {
          const url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${stableDate}`;
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

      // ✅ Silent background update - only update if route data actually changed
      // This prevents unnecessary re-renders, re-snapping, and visual flickering
      setMaterialRoutes(currentRoutes => {
        // Quick check: compare route counts first
        if (currentRoutes.length !== routes.length) {
          // Route count changed, update silently
          return routes.map(newRoute => {
            const existingRoute = currentRoutes.find(r => r.materialId === newRoute.materialId);
            // Preserve snapped route if route data is identical
            if (existingRoute && JSON.stringify(existingRoute.route) === JSON.stringify(newRoute.route)) {
              return existingRoute;
            }
            return newRoute;
          });
        }
        
        // Check if any route data has changed (only check last point for new data)
        let hasChanges = false;
        const updatedRoutes = routes.map(newRoute => {
          const existingRoute = currentRoutes.find(r => r.materialId === newRoute.materialId);
          
          if (!existingRoute) {
            hasChanges = true;
            return newRoute;
          }
          
          // For auto-refresh, only check if new points were added (last point changed)
          // This avoids re-snapping for minor GPS updates
          const currentRoute = existingRoute.route;
          const newRoutePoints = newRoute.route;
          
          if (currentRoute.length !== newRoutePoints.length) {
            hasChanges = true;
            // Route length changed, preserve snapped route if possible
            // Only clear if route is significantly different
            if (Math.abs(currentRoute.length - newRoutePoints.length) > 5) {
              return newRoute; // Significant change, will re-snap
            }
            // Minor change, try to preserve snapped route by keeping existing route structure
            return {
              ...newRoute,
              snappedRoute: existingRoute.snappedRoute // Preserve snapped route
            };
          }
          
          // Check if last point changed (new data added)
          if (currentRoute.length > 0 && newRoutePoints.length > 0) {
            const currentLast = currentRoute[currentRoute.length - 1];
            const newLast = newRoutePoints[newRoutePoints.length - 1];
            
            if (currentLast.lat !== newLast.lat || currentLast.lng !== newLast.lng) {
              hasChanges = true;
              // New point added, update route but preserve existing snapped segments
              // Only append new segment if significant distance
              const distance = Math.sqrt(
                Math.pow(newLast.lat - currentLast.lat, 2) + 
                Math.pow(newLast.lng - currentLast.lng, 2)
              ) * 111000; // Convert to meters
              
              if (distance > 50) {
                // Significant new data, update route (will trigger smart re-snapping)
                return newRoute;
              } else {
                // Minor update, preserve snapped route
                return {
                  ...newRoute,
                  snappedRoute: existingRoute.snappedRoute
                };
              }
            }
          }
          
          // No changes to this route, keep existing
          return existingRoute;
        });
        
        // Only update state if there were actual changes
        return hasChanges ? updatedRoutes : currentRoutes;
      });
    }, 2000); // Refresh every 2 seconds

    return () => {
      clearInterval(refreshInterval);
    };
  }, [stableMaterialIds, stableDate, disableAutoRefresh]);

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

  // Get final route coordinates (snapped if enabled, otherwise raw segments)
  const getFinalRouteCoords = (materialRoute: MaterialRoute): [number, number][][] => {
    if (snapToRoads && materialRoute.snappedRoute && materialRoute.snappedRoute.length > 0) {
      return materialRoute.snappedRoute;
    }
    
    // If no snapping or snapping not complete, use raw segments
    return processRouteSegments(materialRoute.route);
  };

  // ✅ Only show loading if initial load OR if snapping is enabled and in progress
  if (loading || (snapToRoads && isSnappingInProgress)) {
    return (
      <div style={style} className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1b5087] mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">
              {isSnappingInProgress ? 'Snapping routes to roads...' : `Loading routes for ${materialIds.length} material${materialIds.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (materialRoutes.length === 0) {
    return (
      <div style={style} className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <div className="text-black/70 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-black/90 mb-2">No Route Available</h3>
            <p className="text-sm text-black/70">
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
        key={`map-${materialIds.join('-')}-${date}`}
        whenReady={() => {
          console.log('🗺️ [MultiMaterialRouteMap] Map ready');
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Fit bounds to route */}
        {bounds && <FitBounds bounds={bounds} />}

        {/* Render all routes */}
        {materialRoutes.map((materialRoute, index) => {
          const routeSegments = getFinalRouteCoords(materialRoute);
          const firstPoint = materialRoute.route[0];
          const lastPoint = materialRoute.route[materialRoute.route.length - 1];
          
          return (
            <React.Fragment key={materialRoute.materialId}>
              {/* Render route segments */}
              {routeSegments.map((segment, segmentIndex) => (
                <Polyline
                  key={`${materialRoute.materialId}-segment-${segmentIndex}`}
                  positions={segment}
                  color={materialRoute.color}
                  weight={4}
                  opacity={0.8}
                />
              ))}

              {/* Start marker */}
              {firstPoint && (
                <Marker
                  position={[firstPoint.lat, firstPoint.lng]}
                  icon={createMarkerIcon('start', materialRoute.color)}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-sm mb-1" style={{ color: materialRoute.color }}>
                        {materialRoute.materialId}
                      </h3>
                      <p className="text-xs text-gray-600">Start Point</p>
                      {firstPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">{firstPoint.address}</p>
                      )}
                      {firstPoint.timestamp && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(firstPoint.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* End marker */}
              {lastPoint && materialRoute.route.length > 1 && (
                <Marker
                  position={[lastPoint.lat, lastPoint.lng]}
                  icon={createMarkerIcon('end', materialRoute.color)}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-sm mb-1" style={{ color: materialRoute.color }}>
                        {materialRoute.materialId}
                      </h3>
                      <p className="text-xs text-gray-600">End Point</p>
                      {lastPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">
                          {lastPoint.address}
                        </p>
                      )}
                      {lastPoint.timestamp && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(lastPoint.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
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
