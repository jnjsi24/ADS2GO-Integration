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
  adStartTime?: string; // ✅ Optional: Filter route to only show locations after ad deployment time
  adId?: string; // ✅ Optional: Ad ID to look up actual deployment time from AdsDeployment
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
        // ✅ FIX: Use safer checks without accessing internal Leaflet properties
        // Check if map container has valid dimensions
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

        // ✅ FIX: Verify map is accessible by trying to get center (safer than checking _leaflet_pos)
        try {
          map.getCenter();
        } catch {
          // Map not ready yet, retry
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
              const container = map.getContainer();
              if (container) {
                try {
                  map.getCenter(); // Verify map is accessible
                  map.fitBounds(leafletBounds, { padding: [20, 20], animate: false, maxZoom: 18 });
                } catch {
                  // Map not accessible, silently skip
                }
              }
            } catch (error) {
              // Silently handle errors - don't spam console
            }
          });
        } else {
          // Fallback: try to fit bounds directly with error handling
          try {
            map.fitBounds(leafletBounds, { padding: [20, 20], animate: false, maxZoom: 18 });
          } catch (error) {
            // Silently handle errors
          }
        }
      } catch (error) {
        // Silently handle errors - don't spam console
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
  disableAutoRefresh = false,
  adStartTime,
  adId
}) => {
  const [materialRoutes, setMaterialRoutes] = useState<MaterialRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);
  const [zoom, setZoom] = useState(12);
  const [bounds, setBounds] = useState<RouteBounds | null>(null);
  const [isSnappingInProgress, setIsSnappingInProgress] = useState(false);
  
  // 🔄 Track if this is the initial load (for silent refresh)
  const isInitialLoadRef = useRef(true);
  // ✅ IMPROVED: Track processed point counts per material per segment for incremental updates
  // Map: materialId -> array of point counts per segment
  const lastProcessedPointCountsRef = useRef<Map<string, number[]>>(new Map());

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

  // ✅ IMPROVED: Apply incremental road snapping - only process new points
  useEffect(() => {
    if (materialRoutes.length === 0) {
      setIsSnappingInProgress(false);
      lastProcessedPointCountsRef.current.clear();
      return;
    }

    if (!snapToRoads) {
      // If snapping is disabled, clear any existing snapped routes
      setMaterialRoutes(routes => routes.map(r => ({ ...r, snappedRoute: undefined })));
      setIsSnappingInProgress(false);
      lastProcessedPointCountsRef.current.clear();
      return;
    }

    const applyRoadSnapping = async () => {
      const isInitialLoad = isInitialLoadRef.current;
      
      // ✅ IMPROVED: Only set snapping in progress on initial load
      // During silent refreshes, keep existing routes visible while processing new points
      if (isInitialLoad) {
        setIsSnappingInProgress(true);
      } else {
        // Silent refresh - process in background, keep existing routes visible
        console.log('🔄 [MultiMaterialRouteMap] Incremental update - processing new points while keeping existing routes visible');
      }

      try {
        const updatedRoutes = await Promise.all(
          materialRoutes.map(async (materialRoute) => {
            // Process route into segments
            const currentSegments = processRouteSegments(materialRoute.route);
            
            if (currentSegments.length === 0) {
              return materialRoute;
            }
            
            // Get last processed point counts for this material
            const lastProcessedCounts = lastProcessedPointCountsRef.current.get(materialRoute.materialId) || [];
            const currentSegmentCounts = currentSegments.map(seg => seg.length);
            
            // Get existing snapped segments (if any)
            const existingSnappedSegments = materialRoute.snappedRoute || [];
            const newSnappedSegments: [number, number][][] = [];
            
            // Check if we have new points to process
            let hasNewPoints = false;
            if (lastProcessedCounts.length !== currentSegments.length) {
              // Segment count changed - new segments added
              hasNewPoints = true;
            } else {
              // Check if any segment has more points than before
              for (let i = 0; i < currentSegments.length; i++) {
                if (currentSegmentCounts[i] > (lastProcessedCounts[i] || 0)) {
                  hasNewPoints = true;
                  break;
                }
              }
            }
            
            // Skip if no new points to process (route hasn't changed)
            if (!hasNewPoints && lastProcessedCounts.length === currentSegments.length && existingSnappedSegments.length > 0) {
              // No new points, return existing route with snapped segments
              return materialRoute;
            }
            
            // Process each segment with incremental logic
            for (let i = 0; i < currentSegments.length; i++) {
              const segment = currentSegments[i];
              const lastProcessedCount = lastProcessedCounts[i] || 0;
              const currentCount = segment.length;
              
              // If this segment has new points, only snap the new portion
              if (currentCount > lastProcessedCount) {
                if (lastProcessedCount > 0 && existingSnappedSegments[i]) {
                  // ✅ INCREMENTAL: Segment already exists - only snap new points
                  const existingSnappedSegment = existingSnappedSegments[i];
                  const newPoints = segment.slice(lastProcessedCount);
                  
                  console.log(`🔄 [MultiMaterialRouteMap] ${materialRoute.materialId} Segment ${i + 1}: Incremental update - ${lastProcessedCount} existing + ${newPoints.length} new points`);
                  
                  // Snip the new points and append to existing segment
                  if (newPoints.length > 0) {
                    // For smooth transition, include last point of existing segment with new points
                    const pointsToSnap: [number, number][] = [];
                    if (existingSnappedSegment.length > 0) {
                      // Add last point of existing snapped segment as reference
                      pointsToSnap.push(existingSnappedSegment[existingSnappedSegment.length - 1]);
                    }
                    // Add all new raw points
                    pointsToSnap.push(...newPoints);
                    
                    // Snap only the new portion (including transition point)
                    const snappedNewPortion = await snapPointsToRoads(pointsToSnap);
                    
                    // Merge: existing segment + new snapped portion (skip first point of new portion if it's duplicate)
                    const mergedSegment = [...existingSnappedSegment];
                    const startIndex = existingSnappedSegment.length > 0 && 
                                     snappedNewPortion.length > 0 &&
                                     Math.abs(existingSnappedSegment[existingSnappedSegment.length - 1][0] - snappedNewPortion[0][0]) < 0.0001 &&
                                     Math.abs(existingSnappedSegment[existingSnappedSegment.length - 1][1] - snappedNewPortion[0][1]) < 0.0001
                                     ? 1 : 0; // Skip first point if it's duplicate
                    mergedSegment.push(...snappedNewPortion.slice(startIndex));
                    
                    newSnappedSegments.push(mergedSegment);
                    console.log(`✅ [MultiMaterialRouteMap] ${materialRoute.materialId} Segment ${i + 1}: Merged ${existingSnappedSegment.length} existing + ${snappedNewPortion.length - startIndex} new = ${mergedSegment.length} total points`);
                  } else {
                    // No new points, keep existing
                    newSnappedSegments.push(existingSnappedSegment);
                  }
                } else {
                  // ✅ INITIAL: First time processing this segment - snap entire segment
                  console.log(`🔄 [MultiMaterialRouteMap] ${materialRoute.materialId} Segment ${i + 1}: Initial snap - ${segment.length} points`);
                  const snappedSegment = await snapPointsToRoads(segment);
                  newSnappedSegments.push(snappedSegment);
                  console.log(`✅ [MultiMaterialRouteMap] ${materialRoute.materialId} Segment ${i + 1}: Snapped ${segment.length} → ${snappedSegment.length} points`);
                }
              } else {
                // Segment hasn't grown - keep existing snapped segment
                if (existingSnappedSegments[i]) {
                  newSnappedSegments.push(existingSnappedSegments[i]);
                } else {
                  // Shouldn't happen, but fallback: snap entire segment
                  const snappedSegment = await snapPointsToRoads(segment);
                  newSnappedSegments.push(snappedSegment);
                }
              }
            }
            
            // Update processed counts for this material
            lastProcessedPointCountsRef.current.set(materialRoute.materialId, currentSegmentCounts);
            
            return {
              ...materialRoute,
              snappedRoute: newSnappedSegments
            };
          })
        );
        
        // ✅ IMPROVED: Always update routes (keeps routes visible during updates)
        setMaterialRoutes(updatedRoutes);
        setIsSnappingInProgress(false);
        
        // Mark initial load as complete after first successful snap
        if (isInitialLoad) {
          isInitialLoadRef.current = false;
        }
      } catch (error) {
        console.error('❌ [MultiMaterialRouteMap] Road snapping error:', error);
        console.warn('⚠️ [MultiMaterialRouteMap] Falling back to raw segment coordinates');
        
        // On error, fallback to raw coordinates but preserve existing snapped segments where possible
        setMaterialRoutes(routes => routes.map(route => {
          // If we have existing snapped segments, try to preserve them
          if (route.snappedRoute && route.snappedRoute.length > 0 && !isInitialLoad) {
            // Keep existing snapped segments
            return route;
          } else {
            // Initial load failed - use raw segments
            const rawSegments = processRouteSegments(route.route);
            const currentSegmentCounts = rawSegments.map(seg => seg.length);
            lastProcessedPointCountsRef.current.set(route.materialId, currentSegmentCounts);
            return {
              ...route,
              snappedRoute: rawSegments
            };
          }
        }));
        
        setIsSnappingInProgress(false);
        
        if (isInitialLoad) {
          isInitialLoadRef.current = false;
        }
      }
    };

    applyRoadSnapping();
  }, [materialRoutes, snapToRoads]);

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
          // ✅ Add adStartTime and adId to query if provided (filter route to only show after ad deployment)
          let url = `${baseUrl}/api/enhancedRoute/route/${materialId}?date=${stableDate}`;
          if (adStartTime) {
            url += `&adStartTime=${encodeURIComponent(adStartTime)}`;
          }
          if (adId) {
            url += `&adId=${encodeURIComponent(adId)}`;
          }
          console.log(`📡 [MultiMaterialRouteMap] Fetching route ${i + 1}/${stableMaterialIds.length}: ${materialId}${adStartTime ? ` (filtered after ${adStartTime})` : ''}${adId ? ` (adId: ${adId})` : ''}`);
          
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

    // Reset initial load flag when materialIds, date, adStartTime, or adId changes
    isInitialLoadRef.current = true;
    lastProcessedPointCountsRef.current.clear(); // ✅ IMPROVED: Clear processed point counts
    
    if (stableMaterialIds.length > 0) {
      fetchAllRoutes(false); // Initial load with loading state
    } else {
      setLoading(false);
    }
  }, [stableMaterialIds, stableDate, adStartTime, adId]);

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

      // ✅ IMPROVED: Update routes - preserve existing snapped routes, incremental snapping will handle new points
      // The incremental snapping logic will detect new points and only snap them efficiently
      setMaterialRoutes(currentRoutes => {
        // Quick check: compare route counts first
        if (currentRoutes.length !== routes.length) {
          // Route count changed, update silently
          return routes.map(newRoute => {
            const existingRoute = currentRoutes.find(r => r.materialId === newRoute.materialId);
            // Preserve snapped route only if route data is completely identical
            if (existingRoute && JSON.stringify(existingRoute.route) === JSON.stringify(newRoute.route)) {
              return existingRoute; // No change, keep everything including snapped route
            }
            // Route changed - preserve existing snapped route if available, incremental snapping will handle new points
            return {
              ...newRoute,
              snappedRoute: existingRoute?.snappedRoute // Preserve existing snapped route for incremental snapping
            };
          });
        }
        
        // Check if any route data has changed
        let hasChanges = false;
        const updatedRoutes = routes.map(newRoute => {
          const existingRoute = currentRoutes.find(r => r.materialId === newRoute.materialId);
          
          if (!existingRoute) {
            hasChanges = true;
            return newRoute;
          }
          
          // ✅ IMPROVED: Compare route data - if identical, preserve everything (including snapped route)
          // If different, update route data but preserve existing snapped route for incremental snapping
          const currentRoute = existingRoute.route;
          const newRoutePoints = newRoute.route;
          
          // Check if route data is completely identical
          if (JSON.stringify(currentRoute) === JSON.stringify(newRoutePoints)) {
            // No change - preserve existing route with snapped segments
            return existingRoute;
          }
          
          // Route data changed - update it but preserve existing snapped route
          // Incremental snapping will detect new points and only snap them efficiently
          hasChanges = true;
          return {
            ...newRoute,
            snappedRoute: existingRoute.snappedRoute // Preserve existing snapped route for incremental snapping
          };
        });
        
        // Only update state if there were actual changes
        // This prevents unnecessary re-renders while allowing incremental snapping to work
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

  // ✅ IMPROVED: Get final route coordinates - keep existing snapped routes visible during updates
  // Show existing snapped routes even while processing new points (smooth updates)
  const getFinalRouteCoords = (materialRoute: MaterialRoute): [number, number][][] => {
    if (snapToRoads && materialRoute.snappedRoute && materialRoute.snappedRoute.length > 0) {
      // Show existing snapped route, even if snapping is in progress
      return materialRoute.snappedRoute;
    }
    
    // If no snapping or snapping not complete, use raw segments
    return processRouteSegments(materialRoute.route);
  };

  // ✅ IMPROVED: Only show loading during initial load, not during silent refreshes
  // Show loading if: initial load is in progress OR (initial load AND snapping is in progress)
  // Don't show loading if we have existing snapped routes (even if snapping in progress)
  const hasExistingSnappedRoutes = materialRoutes.some(r => r.snappedRoute && r.snappedRoute.length > 0);
  const shouldShowLoading = loading || (isInitialLoadRef.current && snapToRoads && isSnappingInProgress && !hasExistingSnappedRoutes);
  
  if (shouldShowLoading) {
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
              {/* ✅ IMPROVED: Render route segments with stable keys for smooth updates */}
              {routeSegments.map((segment, segmentIndex) => {
                // ✅ IMPROVED: Use stable key based only on material ID and segment index
                // React Leaflet will smoothly update positions when the positions prop changes
                // This prevents re-rendering the entire polyline and allows smooth incremental updates
                const segmentKey = `${materialRoute.materialId}-segment-${segmentIndex}`;
                
                return (
                  <Polyline
                    key={segmentKey}
                    positions={segment}
                    color={materialRoute.color}
                    weight={4}
                    opacity={0.8}
                    // ✅ IMPROVED: React Leaflet will smoothly update positions when segment changes
                    // Using stable key ensures React updates the existing polyline instead of replacing it
                  />
                );
              })}

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
