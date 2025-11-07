import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  isSegmentBreak?: boolean; // ✅ Flag to indicate this point starts a new segment (after offline period)
  isSegmentStart?: boolean; // ✅ Alternative flag name for segment breaks
}

interface RouteBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  center: [number, number];
}

interface RouteMappedProps {
  materialId: string;
  date?: string;
  className?: string;
  style?: React.CSSProperties;
  snapToRoads?: boolean;
  refreshTrigger?: number; // Optional trigger to force refresh even with same props
  onRouteLoad?: (data: any) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

// Component to fit map bounds to route
const FitBounds: React.FC<{ bounds: RouteBounds | null }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds && map) {
      try {
        // Wait for map to be ready before fitting bounds
        map.whenReady(() => {
          const leafletBounds = L.latLngBounds(
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
          );
          map.fitBounds(leafletBounds, { padding: [20, 20], animate: false });
        });
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [bounds, map]);

  return null;
};

// Function to smooth GPS points using an improved algorithm (no API required)
// ✅ FIX: Keep ALL points but apply smoothing for visual quality
const smoothRoute = (points: [number, number][]): [number, number][] => {
  if (points.length < 3) return points;
  
  // Smoothing route silently - keeping all points for complete route visualization
  
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
    
    // ✅ FIX: REMOVED - No longer skipping points that are close together
    // This ensures all route segments are drawn, even during slow movement or tight turns
    // All points are kept to maintain complete route visualization
    
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
      // Apply light smoothing to all points (including close ones) for visual quality
      const totalDist = dist1Meters + dist2Meters;
      
      // For very close points (< 5m), apply minimal smoothing to preserve accuracy
      // For normal points, apply standard smoothing
      if (dist1Meters < 5 && dist2Meters < 5) {
        // Minimal smoothing for close points - mostly keep original position
        const smoothingFactor = 0.1; // Only 10% smoothing for very close points
        const smoothedLat = current[0] * (1 - smoothingFactor) + 
                           ((prev[0] + current[0] + next[0]) / 3) * smoothingFactor;
        const smoothedLng = current[1] * (1 - smoothingFactor) + 
                           ((prev[1] + current[1] + next[1]) / 3) * smoothingFactor;
        smoothed.push([smoothedLat, smoothedLng]);
      } else {
        // Standard smoothing for normal distance points
        const weight1 = dist2Meters / totalDist; // More weight to closer neighbor
        const weight2 = dist1Meters / totalDist;
        
        const smoothedLat = (weight1 * prev[0] + current[0] + weight2 * next[0]) / (weight1 + 1 + weight2);
        const smoothedLng = (weight1 * prev[1] + current[1] + weight2 * next[1]) / (weight1 + 1 + weight2);
        
        smoothed.push([smoothedLat, smoothedLng]);
      }
    }
  }
  
  smoothed.push(points[points.length - 1]); // Keep last point
  
  // Second pass smoothing for better accuracy
  const doubleSmoothed: [number, number][] = [];
  doubleSmoothed.push(smoothed[0]); // Keep first point
  
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1];
    const current = smoothed[i];
    const next = smoothed[i + 1];
    
    // Light smoothing on second pass
    const smoothedLat = (prev[0] + current[0] + next[0]) / 3;
    const smoothedLng = (prev[1] + current[1] + next[1]) / 3;
    
    doubleSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  doubleSmoothed.push(smoothed[smoothed.length - 1]); // Keep last point
  
  // Third pass for extremely noisy data (very light smoothing)
  const tripleSmoothed: [number, number][] = [];
  tripleSmoothed.push(doubleSmoothed[0]); // Keep first point
  
  for (let i = 1; i < doubleSmoothed.length - 1; i++) {
    const prev = doubleSmoothed[i - 1];
    const current = doubleSmoothed[i];
    const next = doubleSmoothed[i + 1];
    
    // Very light smoothing on third pass (90% original, 10% smoothed)
    const smoothedLat = (current[0] * 0.9) + ((prev[0] + next[0]) / 2 * 0.1);
    const smoothedLng = (current[1] * 0.9) + ((prev[1] + next[1]) / 2 * 0.1);
    
    tripleSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  tripleSmoothed.push(doubleSmoothed[doubleSmoothed.length - 1]); // Keep last point
  
  // Fourth pass for ultra-dense data (minimal smoothing)
  const quadSmoothed: [number, number][] = [];
  quadSmoothed.push(tripleSmoothed[0]); // Keep first point
  
  for (let i = 1; i < tripleSmoothed.length - 1; i++) {
    const prev = tripleSmoothed[i - 1];
    const current = tripleSmoothed[i];
    const next = tripleSmoothed[i + 1];
    
    // Ultra-light smoothing on fourth pass (95% original, 5% smoothed)
    const smoothedLat = (current[0] * 0.95) + ((prev[0] + next[0]) / 2 * 0.05);
    const smoothedLng = (current[1] * 0.95) + ((prev[1] + next[1]) / 2 * 0.05);
    
    quadSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  quadSmoothed.push(tripleSmoothed[tripleSmoothed.length - 1]); // Keep last point
  // Quad-smoothed route completed
  return quadSmoothed;
};

// Function to calculate total route distance
const calculateRouteDistance = (points: [number, number][]): number => {
  if (points.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[i + 1];
    
    // Haversine formula for accurate distance calculation
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
};

// Function to add intermediate points for better road following
const addIntermediatePoints = (points: [number, number][]): [number, number][] => {
  if (points.length < 2) return points;
  
  const enhanced: [number, number][] = [];
  enhanced.push(points[0]); // Keep first point
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Calculate distance between points in meters
    const distance = Math.sqrt(
      Math.pow(next[0] - current[0], 2) + Math.pow(next[1] - current[1], 2)
    ) * 111000; // Convert to meters
    
    // If distance is greater than 20 meters, add intermediate points
    if (distance > 20) {
      const numIntermediate = Math.min(Math.floor(distance / 8), 20); // Max 20 intermediate points, every 8m
      
      for (let j = 1; j <= numIntermediate; j++) {
        const ratio = j / (numIntermediate + 1);
        const lat = current[0] + (next[0] - current[0]) * ratio;
        const lng = current[1] + (next[1] - current[1]) * ratio;
        enhanced.push([lat, lng]);
      }
    } else if (distance > 10) {
      // Add 1-2 intermediate points for medium gaps (10-20m)
      const numIntermediate = Math.min(Math.floor(distance / 10), 2);
      
      for (let j = 1; j <= numIntermediate; j++) {
        const ratio = j / (numIntermediate + 1);
        const lat = current[0] + (next[0] - current[0]) * ratio;
        const lng = current[1] + (next[1] - current[1]) * ratio;
        enhanced.push([lat, lng]);
      }
    }
    
    enhanced.push(next); // Add the next point
  }
  
  // Enhanced route with intermediate points completed
  
  // If we still have less than 200 points, add even more density
  if (enhanced.length < 200 && points.length > 10) {
    const ultraDense: [number, number][] = [];
    ultraDense.push(enhanced[0]); // Keep first point
    
    for (let i = 0; i < enhanced.length - 1; i++) {
      const current = enhanced[i];
      const next = enhanced[i + 1];
      
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(next[0] - current[0], 2) + Math.pow(next[1] - current[1], 2)
      ) * 111000;
      
      // Add 2-3 more points for any gap > 5m
      if (distance > 5) {
        const numExtra = Math.min(Math.floor(distance / 5), 3);
        for (let j = 1; j <= numExtra; j++) {
          const ratio = j / (numExtra + 1);
          const lat = current[0] + (next[0] - current[0]) * ratio;
          const lng = current[1] + (next[1] - current[1]) * ratio;
          ultraDense.push([lat, lng]);
        }
      }
      
      ultraDense.push(next);
    }
    
    // Ultra-dense route completed
    return ultraDense;
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
  
  console.log('🔍 [DEBUG] API Key Check:', {
    googleApiKey: googleApiKey ? `${googleApiKey.substring(0, 8)}...` : 'NOT FOUND',
    openRouteApiKey: openRouteApiKey ? `${openRouteApiKey.substring(0, 8)}...` : 'NOT FOUND',
    pointsToSnap: enhancedPoints.length,
    enhancedPointsLength: enhancedPoints.length,
    smoothedPointsLength: smoothedPoints.length
  });
  
  // Prefer Google Roads API if available
  if (googleApiKey && googleApiKey !== 'your-google-api-key-here') {
    console.log('🗺️ Using Google Roads API for road snapping');
    console.log('📍 Points to snap:', enhancedPoints.length, 'points');
    return await snapWithGoogleRoads(enhancedPoints, googleApiKey);
  }
  
  // Fallback to OpenRouteService
  if (openRouteApiKey && openRouteApiKey !== 'your-api-key-here') {
    console.log('🗺️ Using OpenRouteService API for road snapping');
    return await snapWithOpenRoute(enhancedPoints, openRouteApiKey);
  }
  
  console.log('⚠️ No road snapping API key, using smoothed route only');
  console.log('🔧 To enable road snapping, add either:');
  console.log('   - REACT_APP_GOOGLE_ROADS_API_KEY (recommended)');
  console.log('   - REACT_APP_OPENROUTE_API_KEY (fallback)');
  return smoothedPoints;
};

// Google Roads API implementation with batching for better accuracy
// ✅ FIX: Overlap batches to ensure smooth connections between batches
const snapWithGoogleRoads = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    // Google Roads API has a limit of 100 points per request
    const maxPointsPerBatch = 100;
    const batches: [number, number][][] = [];
    
    // ✅ FIX: Split points into overlapping batches to ensure smooth connections
    // Include the last point of previous batch as the first point of next batch
    // This ensures that when batches are snapped, they connect smoothly at the overlap point
    let batchIndex = 0;
    let startIndex = 0;
    
    while (startIndex < points.length) {
      // Calculate end index for this batch
      const endIndex = Math.min(startIndex + maxPointsPerBatch, points.length);
      
      // Create batch with overlap (except for first batch)
      if (batchIndex === 0) {
        // First batch: no overlap, start from 0
        batches.push(points.slice(0, Math.min(maxPointsPerBatch, points.length)));
        startIndex = maxPointsPerBatch - 1; // Next batch starts at point 99 (overlap with point 99)
      } else {
        // Subsequent batches: include last point of previous batch (overlap)
        batches.push(points.slice(startIndex, endIndex));
        startIndex = startIndex + maxPointsPerBatch - 1; // Next batch overlaps at last point of current batch
      }
      
      batchIndex++;
      
      // Safety check to prevent infinite loop
      if (batches.length > 1000) {
        console.error('⚠️ Too many batches created, breaking loop');
        break;
      }
    }
    
    console.log(`📍 Processing ${points.length} points in ${batches.length} overlapping batches`);
  
    // Warn if we have a lot of points (might hit API limits)
    if (points.length > 1000) {
      console.warn(`⚠️ Large route detected: ${points.length} points. This may take a while and could hit API rate limits.`);
    }
    
    const allSnappedPoints: [number, number][] = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const path = batch.map(([lat, lng]) => `${lat},${lng}`).join('|');
      
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} points`);
      
      const apiUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&key=${apiKey}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ Google Roads API batch ${batchIndex + 1} failed:`, response.status, errorText);
        // If a batch fails, use original points for that batch
        // ✅ FIX: Skip first point if it's a duplicate (overlap from previous batch)
        const pointsToAdd = batchIndex > 0 ? batch.slice(1) : batch;
        allSnappedPoints.push(...pointsToAdd);
        continue;
      }
      
      const data = await response.json();
      console.log(`📊 Batch ${batchIndex + 1} API Response:`, data);
      
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        const snappedPoints = data.snappedPoints.map((point: any) => [
          point.location.latitude,
          point.location.longitude
        ]);
        console.log(`✅ Batch ${batchIndex + 1} snapped successfully:`, snappedPoints.length, 'points');
        console.log(`📍 Batch ${batchIndex + 1} first snapped point:`, snappedPoints[0]);
        console.log(`📍 Batch ${batchIndex + 1} last snapped point:`, snappedPoints[snappedPoints.length - 1]);
        
        // ✅ FIX: Skip first point if it's a duplicate (overlap from previous batch)
        // This ensures smooth connection between batches
        if (batchIndex > 0 && allSnappedPoints.length > 0) {
          // Check if first point of this batch matches last point of previous batch
          const lastPoint = allSnappedPoints[allSnappedPoints.length - 1];
          const firstPoint = snappedPoints[0];
          const distanceThreshold = 0.0001; // ~11 meters - very close points are duplicates
          
          const latDiff = Math.abs(lastPoint[0] - firstPoint[0]);
          const lngDiff = Math.abs(lastPoint[1] - firstPoint[1]);
          
          if (latDiff < distanceThreshold && lngDiff < distanceThreshold) {
            // Points are duplicates (overlap) - skip first point
            console.log(`🔄 Batch ${batchIndex + 1}: Skipping duplicate first point (overlap from previous batch)`);
            allSnappedPoints.push(...snappedPoints.slice(1));
          } else {
            // Points don't match - keep first point (might be slight variation due to snapping)
            // But still add all points to maintain route continuity
            allSnappedPoints.push(...snappedPoints);
          }
        } else {
          // First batch - include all points
          allSnappedPoints.push(...snappedPoints);
        }
      } else {
        console.warn(`⚠️ No snapped points in batch ${batchIndex + 1}, using original points`);
        console.log(`📍 Batch ${batchIndex + 1} original points:`, batch.slice(0, 2));
        // ✅ FIX: Skip first point if it's a duplicate (overlap from previous batch)
        const pointsToAdd = batchIndex > 0 ? batch.slice(1) : batch;
        allSnappedPoints.push(...pointsToAdd);
      }
      
      // Add small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Google Roads snapping completed:', allSnappedPoints.length, 'total snapped points (with overlapping batches for smooth connections)');
    return allSnappedPoints;
  } catch (error) {
    console.warn('❌ Google Roads API error:', error);
    return points;
  }
};

// OpenRouteService API implementation (fallback)
const snapWithOpenRoute = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    const coordinates = points.map(([lat, lng]) => [lng, lat]).join('|');
    
    console.log('📍 Sending coordinates to OpenRouteService:', points.length, 'points');
    
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&coordinates=${coordinates}&format=geojson&options={"continue_straight":false}`
    );
    
    console.log('📡 OpenRouteService API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('❌ OpenRouteService API failed:', response.status, errorText);
      return points;
    }
    
    const data = await response.json();
    console.log('📊 OpenRouteService API Response data:', data);
    
    if (data.features && data.features[0] && data.features[0].geometry) {
      const snappedCoordinates = data.features[0].geometry.coordinates;
      console.log('✅ OpenRouteService snapping successful:', snappedCoordinates.length, 'snapped points');
      return snappedCoordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
    }
    
    console.warn('⚠️ No valid route geometry in OpenRouteService response');
    return points;
  } catch (error) {
    console.warn('❌ OpenRouteService API error:', error);
    return points;
  }
};


const RouteMapped: React.FC<RouteMappedProps> = ({
  materialId,
  date,
  className = '',
  style = { height: '100%', width: '100%' },
  snapToRoads = true,
  refreshTrigger,
  onRouteLoad,
  onLoadingChange
}) => {
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snappedSegmentCoords, setSnappedSegmentCoords] = useState<[number, number][][]>([]);
  const [lastProcessedRoute, setLastProcessedRoute] = useState<string>('');
  const [isSnappingInProgress, setIsSnappingInProgress] = useState(false);
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between fetches to avoid spam
  const isInitialLoadRef = useRef(true); // Track if this is the first load
  
  // ✅ IMPROVED: Track processed point counts per segment for incremental updates
  const lastProcessedPointCountsRef = useRef<number[]>([]); // Track how many points were processed in each segment
  
  // Validate materialId
  const isValidMaterialId = materialId && materialId !== 'all' && typeof materialId === 'string';

  // Reset fetching state and initial load flag when materialId or date changes
  useEffect(() => {
    fetchingRef.current = false;
    isInitialLoadRef.current = true; // Reset to initial load for new material/date
    // ✅ FIX: Reset loading to true when materialId or date changes to prevent showing "no route data" before fetch starts
    setLoading(true);
    setError(null);
    setRouteData(null);
    // ✅ FIX: Clear the route key ref immediately when props change
    currentRouteKeyRef.current = '';
    // ✅ IMPROVED: Reset processed point counts when material/date changes
    lastProcessedPointCountsRef.current = [];
    setSnappedSegmentCoords([]);
    setLastProcessedRoute('');
  }, [materialId, date]);

  // Extract route data (only if available)
  const route = routeData?.route || [];
  const bounds = routeData?.bounds || null;
  
  // ✅ FIX: Track current props to determine if we should be loading
  const currentRouteKeyRef = useRef<string>('');
  const currentRouteKey = `${materialId}-${date}`;
  
  // ✅ FIX: Check if routeData matches current props
  // If routeData exists but doesn't match current props, we should be loading
  const hasDataForCurrentProps = routeData && currentRouteKeyRef.current === currentRouteKey;
  
  // Debug logging
  useEffect(() => {
    if (routeData) {
      console.log('🗺️ [RouteMapped] Route data received:', {
        hasRoute: !!routeData.route,
        routeLength: routeData.route?.length || 0,
        hasBounds: !!routeData.bounds,
        hasMetrics: !!routeData.metrics,
        materialId,
        date
      });
      // Update the ref when we get data for current props
      currentRouteKeyRef.current = currentRouteKey;
    } else {
      console.log('🗺️ [RouteMapped] No route data yet');
      // Clear the ref when routeData is cleared
      currentRouteKeyRef.current = '';
    }
  }, [routeData, materialId, date, currentRouteKey]);

  // Convert route points to polyline coordinates with safety checks (memoized)
  // ✅ FIX: Split route into segments based on isSegmentBreak flag
  const routeSegments: [number, number][][] = useMemo(() => {
    console.log('🗺️ [RouteMapped] Processing route segments, route length:', route.length);
    
    const validPoints = route.filter((point: RoutePoint) => 
      point && typeof point.lat === 'number' && typeof point.lng === 'number'
    );
    
    console.log('🗺️ [RouteMapped] Valid points after filtering:', validPoints.length);
    
    if (validPoints.length === 0) {
      console.warn('⚠️ [RouteMapped] No valid route points found!');
      return [];
    }
    
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
    
    console.log('🗺️ [RouteMapped] Created', segments.length, 'route segment(s) with', 
                segments.reduce((sum, seg) => sum + seg.length, 0), 'total points');
    
    if (segments.length > 1) {
      console.log('📍 [RouteMapped] Route split into', segments.length, 'segment(s) (offline periods detected)');
    }
    
    return segments;
  }, [route]);

  const rawPolylineCoords: [number, number][] = useMemo(() => {
    // Flatten segments for backward compatibility (used by road snapping)
    return routeSegments.flat();
  }, [routeSegments]);

  // ✅ IMPROVED: Compute loading state after routeSegments is defined
  // Check if we have valid route segments ready to display
  const hasValidSegments = routeSegments.length > 0 && routeSegments.some(seg => seg.length > 0);
  // ✅ IMPROVED: Has snapped segments if we have any snapped segments (even if snapping in progress)
  // This allows showing existing route while processing new points
  const hasSnappedSegments = snapToRoads 
    ? (snappedSegmentCoords.length > 0 && snappedSegmentCoords.some(seg => seg.length > 0))
    : true; // If snapToRoads is disabled, we use routeSegments (checked above)
  
  // Check if route data exists but is actually empty (no points) - this means "no route data", not loading
  const routeIsEmpty = hasDataForCurrentProps && route.length === 0;
  
  // ✅ FIX: Compute if we should show loading
  // Show loading if: explicit loading state OR we don't have data for current props OR segments are being processed
  // Don't show loading if route is confirmed empty (will show "no route data" instead)
  // ✅ FIX: Only show loading during initial load, not during silent refreshes
  const shouldShowLoading = !routeIsEmpty && isInitialLoadRef.current && (
    loading || 
    (!hasDataForCurrentProps && !error && isValidMaterialId && materialId && date) ||
    (hasDataForCurrentProps && !error && (!hasValidSegments || (snapToRoads && !hasSnappedSegments)))
  );

  // ✅ IMPROVED: Apply incremental road snapping - only process new points
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    const applyRoadSnapping = async () => {
      if (routeSegments.length === 0) {
        if (isMounted) {
          setSnappedSegmentCoords([]);
          lastProcessedPointCountsRef.current = [];
          setIsSnappingInProgress(false);
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
        return;
      }

      // If snapToRoads is disabled, use raw segment coordinates immediately
      if (!snapToRoads) {
        if (isMounted) {
          setSnappedSegmentCoords(routeSegments);
          lastProcessedPointCountsRef.current = routeSegments.map(seg => seg.length);
          setIsSnappingInProgress(false);
          
          // Mark initial load as complete
          if (isInitialLoad) {
            isInitialLoadRef.current = false;
            setLoading(false);
            if (onLoadingChange) {
              onLoadingChange(false);
            }
          }
        }
        return;
      }

      const isInitialLoad = isInitialLoadRef.current;
      const lastProcessedCounts = lastProcessedPointCountsRef.current;
      const currentSegmentCounts = routeSegments.map(seg => seg.length);
      
      // ✅ FIX: Validate segment structure - check if segments match by validating continuity
      // If segment structure changed (segments don't match), reset and re-snap all segments
      let segmentStructureChanged = false;
      if (lastProcessedCounts.length !== routeSegments.length) {
        // Segment count changed - structure definitely changed
        segmentStructureChanged = true;
        console.log(`🔄 [RouteMapped] Segment count changed: ${lastProcessedCounts.length} → ${routeSegments.length} - resetting incremental snapping`);
      } else if (lastProcessedCounts.length > 0 && snappedSegmentCoords.length > 0) {
        // Validate that existing segments still match current segments (by checking first/last points)
        for (let i = 0; i < routeSegments.length && i < snappedSegmentCoords.length; i++) {
          const currentSegment = routeSegments[i];
          const existingSnappedSegment = snappedSegmentCoords[i];
          
          // Check if first point of current segment matches first point of existing segment
          // (within reasonable GPS accuracy threshold of ~50 meters)
          if (currentSegment.length > 0 && existingSnappedSegment.length > 0) {
            const currentFirstPoint = currentSegment[0];
            const existingFirstPoint = existingSnappedSegment[0];
            const distanceThreshold = 0.0005; // ~50 meters in degrees (rough approximation)
            
            const latDiff = Math.abs(currentFirstPoint[0] - existingFirstPoint[0]);
            const lngDiff = Math.abs(currentFirstPoint[1] - existingFirstPoint[1]);
            
            // If first points don't match, this is a different segment
            if (latDiff > distanceThreshold || lngDiff > distanceThreshold) {
              segmentStructureChanged = true;
              console.log(`🔄 [RouteMapped] Segment ${i + 1} structure changed - first points don't match (reset incremental snapping)`);
              break;
            }
            
            // Also check if segment length decreased significantly (might indicate segment was replaced)
            const existingProcessedCount = lastProcessedCounts[i] || 0;
            if (currentSegment.length < existingProcessedCount * 0.5) {
              // Segment length decreased by more than 50% - likely a different segment
              segmentStructureChanged = true;
              console.log(`🔄 [RouteMapped] Segment ${i + 1} length decreased significantly (${existingProcessedCount} → ${currentSegment.length}) - resetting incremental snapping`);
              break;
            }
          }
        }
      }
      
      // If segment structure changed, reset incremental snapping state
      if (segmentStructureChanged) {
        console.log('🔄 [RouteMapped] Segment structure changed - resetting incremental snapping state');
        lastProcessedPointCountsRef.current = [];
        // Continue to re-snap all segments below
      }
      
      // Check if we have new points to process
      let hasNewPoints = false;
      if (segmentStructureChanged) {
        // Structure changed - need to re-snap all segments
        hasNewPoints = true;
      } else if (lastProcessedCounts.length !== routeSegments.length) {
        // Segment count changed - new segments added
        hasNewPoints = true;
      } else {
        // Check if any segment has more points than before
        for (let i = 0; i < routeSegments.length; i++) {
          if (currentSegmentCounts[i] > (lastProcessedCounts[i] || 0)) {
            hasNewPoints = true;
            break;
          }
        }
      }
      
      // Skip if no new points to process (route hasn't changed)
      if (!hasNewPoints && lastProcessedCounts.length === routeSegments.length && !segmentStructureChanged) {
        console.log('🔄 [RouteMapped] No new points to process, skipping road snapping');
        return;
      }

      // ✅ IMPROVED: Only set snapping in progress on initial load
      // During silent refreshes, keep existing route visible while processing new points
      if (isMounted && isInitialLoad) {
        setIsSnappingInProgress(true);
      } else {
        // Silent refresh - process in background, keep existing route visible
        console.log('🔄 [RouteMapped] Incremental update - processing new points while keeping existing route visible');
      }

      // Store currentSegmentCounts for error handler
      const segmentCountsForError = currentSegmentCounts;

      try {
        // ✅ IMPROVED: Get existing snapped segments to preserve them
        const existingSnappedSegments = [...snappedSegmentCoords];
        const newSnappedSegments: [number, number][][] = [];
        
        // Process each segment with incremental logic
        for (let i = 0; i < routeSegments.length; i++) {
          const segment = routeSegments[i];
          const lastProcessedCount = segmentStructureChanged ? 0 : (lastProcessedCounts[i] || 0);
          const currentCount = segment.length;
          
          // ✅ FIX: If segment structure changed, always re-snap all segments
          if (segmentStructureChanged) {
            // Structure changed - re-snap entire segment
            console.log(`🔄 [RouteMapped] Segment ${i + 1}: Re-snapping due to structure change - ${segment.length} points`);
            const snappedSegment = await snapPointsToRoads(segment);
            newSnappedSegments.push(snappedSegment);
            console.log(`✅ [RouteMapped] Segment ${i + 1}: Re-snapped ${segment.length} → ${snappedSegment.length} points`);
            continue;
          }
          
          // If this segment has new points, only snap the new portion
          if (currentCount > lastProcessedCount) {
            if (lastProcessedCount > 0 && existingSnappedSegments[i]) {
              // ✅ INCREMENTAL: Segment already exists - validate continuity before merging
              const existingSnappedSegment = existingSnappedSegments[i];
              
              // ✅ FIX: Validate segment continuity before merging
              // Check if the first point of current segment matches the processed portion of existing segment
              const existingProcessedPortion = existingSnappedSegment.slice(0, Math.min(lastProcessedCount, existingSnappedSegment.length));
              const currentFirstPoint = segment[0];
              
              // Get the first point of existing processed portion (or last point if we're continuing)
              let existingReferencePoint: [number, number] | null = null;
              if (existingProcessedPortion.length > 0) {
                // Use first point of existing segment to validate continuity
                existingReferencePoint = existingProcessedPortion[0];
              }
              
              // Validate continuity: first point of current segment should match first point of existing segment
              const distanceThreshold = 0.0005; // ~50 meters
              let segmentsMatch = true;
              if (existingReferencePoint) {
                const latDiff = Math.abs(currentFirstPoint[0] - existingReferencePoint[0]);
                const lngDiff = Math.abs(currentFirstPoint[1] - existingReferencePoint[1]);
                segmentsMatch = latDiff <= distanceThreshold && lngDiff <= distanceThreshold;
              }
              
              if (!segmentsMatch) {
                // Segments don't match - this is a different segment, re-snap entirely
                console.log(`⚠️ [RouteMapped] Segment ${i + 1}: Segments don't match - re-snapping entire segment (structure changed)`);
                const snappedSegment = await snapPointsToRoads(segment);
                newSnappedSegments.push(snappedSegment);
                console.log(`✅ [RouteMapped] Segment ${i + 1}: Re-snapped ${segment.length} → ${snappedSegment.length} points`);
                continue;
              }
              
              // Segments match - proceed with incremental update
              const newPoints = segment.slice(lastProcessedCount);
              
              console.log(`🔄 [RouteMapped] Segment ${i + 1}: Incremental update - ${lastProcessedCount} existing + ${newPoints.length} new points`);
              
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
                console.log(`✅ [RouteMapped] Segment ${i + 1}: Merged ${existingSnappedSegment.length} existing + ${snappedNewPortion.length - startIndex} new = ${mergedSegment.length} total points`);
              } else {
                // No new points, keep existing
                newSnappedSegments.push(existingSnappedSegment);
              }
            } else {
              // ✅ INITIAL: First time processing this segment - snap entire segment
              console.log(`🔄 [RouteMapped] Segment ${i + 1}: Initial snap - ${segment.length} points`);
              const snappedSegment = await snapPointsToRoads(segment);
              newSnappedSegments.push(snappedSegment);
              console.log(`✅ [RouteMapped] Segment ${i + 1}: Snapped ${segment.length} → ${snappedSegment.length} points`);
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
        
        // Update processed counts
        lastProcessedPointCountsRef.current = currentSegmentCounts;
        
        const totalOriginalPoints = routeSegments.reduce((sum, seg) => sum + seg.length, 0);
        const totalSnappedPoints = newSnappedSegments.reduce((sum, seg) => sum + seg.length, 0);
        
        console.log('✅ [RouteMapped] Incremental road snapping completed:', {
          segments: routeSegments.length,
          originalPoints: totalOriginalPoints,
          snappedPoints: totalSnappedPoints,
          isIncremental: !isInitialLoad
        });
        
        if (isMounted) {
          // ✅ IMPROVED: Always update snapped segments (keeps route visible during updates)
          setSnappedSegmentCoords(newSnappedSegments);
          setIsSnappingInProgress(false);
          
          // Mark initial load as complete after first successful snap
          if (isInitialLoad) {
            isInitialLoadRef.current = false;
            setLoading(false);
            if (onLoadingChange) {
              onLoadingChange(false);
            }
          }
        }
      } catch (error) {
        console.error('❌ [Road Snapping] Error:', error);
        console.warn('⚠️ [RouteMapped] Falling back to raw segment coordinates');
        
        // On error, fallback to raw coordinates but preserve existing snapped segments where possible
        if (isMounted) {
          // If we have existing snapped segments, try to preserve them
          if (snappedSegmentCoords.length > 0 && !isInitialLoad) {
            // Keep existing snapped segments, only replace if segment count changed
            console.log('⚠️ [RouteMapped] Error during incremental update - preserving existing snapped segments');
            // Don't update, keep existing
          } else {
            // Initial load failed - use raw coordinates
            setSnappedSegmentCoords(routeSegments);
            lastProcessedPointCountsRef.current = segmentCountsForError;
          }
          
          setIsSnappingInProgress(false);
          
          if (isInitialLoad) {
            setLoading(false);
            if (onLoadingChange) {
              onLoadingChange(false);
            }
          }
        }
      }
    };

    applyRoadSnapping();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [routeSegments, snapToRoads, onLoadingChange]);


  // ✅ IMPROVED: Use snapped segment coordinates - keep existing route visible during updates
  // Show existing snapped segments even while processing new points (smooth updates)
  const finalSegmentCoords = snapToRoads 
    ? (snappedSegmentCoords.length > 0 ? snappedSegmentCoords : routeSegments) // Show existing snapped route, fallback to raw if none
    : routeSegments;

  // Fetch route data
  useEffect(() => {
    if (!isValidMaterialId) {
        console.log('🚫 [RouteMapped] Skipping fetch - invalid materialId:', materialId);
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingRef.current) {
      console.log('🔄 [RouteMapped] Request already in progress, skipping...');
      return;
    }

    // Skip if we don't have valid parameters
    if (!materialId || !date) {
      console.log('🚫 [RouteMapped] Skipping fetch - invalid conditions:', { materialId, date });
      // ✅ FIX: Set loading to false and show error if parameters are invalid
      setLoading(false);
      setError('Invalid material ID or date');
      return;
    }

    const fetchRouteData = async () => {
      try {
        // Check if we're already fetching
        if (fetchingRef.current) {
          console.log('🚫 [RouteMapped] Request already in progress, skipping...');
          return;
        }

        // Check if enough time has passed since last fetch (throttle to prevent spam)
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTime.current;
        if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
          console.log(`🚫 [RouteMapped] Throttling: Only ${timeSinceLastFetch}ms since last fetch`);
          return;
        }

        fetchingRef.current = true;
        lastFetchTime.current = now;
        
        // Only show loading state on initial load, do silent refresh for subsequent loads
        const isInitialLoad = isInitialLoadRef.current;
        if (isInitialLoad) {
          setLoading(true);
          if (onLoadingChange) {
            onLoadingChange(true);
          }
          console.log('🗺️ [RouteMapped] Initial load - showing loading state');
        } else {
          console.log('🗺️ [RouteMapped] Silent refresh - no loading state');
        }
        
        setError(null);
        console.log('🗺️ [RouteMapped] Fetching route data:', { materialId, date, isInitialLoad });

        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
        let url = `${baseUrl}/api/enhancedRoute/route/${materialId}`;
        
        if (date) {
          url += `?date=${date}`;
        }

        console.log('🗺️ [RouteMapped] Fetching from:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ [RouteMapped] Route data received:', result.data);
          setRouteData(result.data);
          
          // Mark initial load as complete after first successful fetch
          isInitialLoadRef.current = false;
          
          // ✅ FIX: Only set loading to false if snapToRoads is disabled
          // If snapToRoads is enabled, keep loading true until snapping completes
          if (isInitialLoad) {
            if (!snapToRoads) {
              setLoading(false);
              if (onLoadingChange) {
                onLoadingChange(false);
              }
            }
            // If snapToRoads is enabled, loading will be set to false after snapping completes
          }
          
          if (onRouteLoad) {
            onRouteLoad(result.data);
          }
        } else {
          console.log('❌ [RouteMapped] API returned error:', result.message);
          setError('No route data available for this date');
          
          if (isInitialLoad) {
            setLoading(false);
            if (onLoadingChange) {
              onLoadingChange(false);
            }
          }
        }
      } catch (err) {
        setError('Unable to load route data');
        console.error('❌ [RouteMapped] Error:', err);
        
        if (isInitialLoad) {
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchRouteData();
  }, [materialId, date, isValidMaterialId, refreshTrigger]);

  // Cleanup effect - reset loading state when component unmounts or materialId/date changes
  useEffect(() => {
    return () => {
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    };
  }, [materialId, date, onLoadingChange]);

  // Early returns after all hooks
  if (!isValidMaterialId) {
    console.warn('⚠️ [RouteMapped] Invalid materialId:', materialId);
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">Invalid Material ID</p>
          <p className="text-sm">Please select a valid material to view the route</p>
        </div>
      </div>
    );
  }



  // ✅ FIX: Single loading state - covers both API fetch and road snapping
  // If snapToRoads is enabled, loading stays true until snapping completes
  // Also show loading if we don't have data for current props (prevents "no route data" flash)
  if (shouldShowLoading) {
    return (
      <div style={style} className={className} key={`wrapper-${materialId}-${date}`}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Route</h3>
            <p className="text-sm text-gray-600">
              {snapToRoads 
                ? `Preparing route for ${date}...`
                : `Fetching route data for ${date}...`
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div style={style} className={className} key={`wrapper-${materialId}-${date}`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <div className="text-gray-400 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Route Available</h3>
            <p className="text-sm text-gray-500">
              No tracking data available for this date. The vehicle may not have been active on this day.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className={className} key={`wrapper-${materialId}-${date}`}>
      <MapContainer
        center={bounds?.center || [14.5995, 120.9842]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        key={`map-${materialId}-${date}`} // Force re-render when props change
        whenReady={() => {
          console.log('🗺️ [RouteMapped] Map ready for', materialId);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Route polylines with segment breaks - only show if we have valid data */}
        {finalSegmentCoords.length > 0 ? (
          <>
            {finalSegmentCoords.map((segmentCoords, index) => {
              // ✅ IMPROVED: Use stable key based only on segment index
              // React Leaflet will smoothly update positions when the positions prop changes
              // This prevents re-rendering the entire polyline and allows smooth incremental updates
              const segmentKey = `segment-${index}`;
              
              // Only log on first render or when segment count changes
              if (index === 0 || (index === finalSegmentCoords.length - 1 && process.env.NODE_ENV === 'development')) {
                console.log(`🗺️ [RouteMapped] Rendering ${finalSegmentCoords.length} segment(s):`, {
                  segmentIndex: index,
                  points: segmentCoords.length,
                  usingSnapped: snapToRoads && snappedSegmentCoords.length > 0,
                  isSnappingInProgress
                });
              }
              
              return (
                <Polyline
                  key={segmentKey}
                  positions={segmentCoords}
                  color="#3674B5"
                  weight={4}
                  opacity={0.8}
                  // ✅ IMPROVED: React Leaflet will smoothly update positions when segmentCoords changes
                  // Using stable key ensures React updates the existing polyline instead of replacing it
                />
              );
            })}
            
            {/* Start marker - show at the first point of the first segment */}
            {route.length > 0 && finalSegmentCoords.length > 0 && finalSegmentCoords[0].length > 0 && (() => {
              const firstPoint = route[0];
              const firstSegmentFirstCoord = finalSegmentCoords[0][0];
              
              // Use route point coordinates (more accurate) if available, otherwise use segment coord
              const startPosition: [number, number] = firstPoint && typeof firstPoint.lat === 'number' && typeof firstPoint.lng === 'number'
                ? [firstPoint.lat, firstPoint.lng]
                : [firstSegmentFirstCoord[0], firstSegmentFirstCoord[1]];
              
              return (
                <Marker
                  position={startPosition}
                  icon={L.divIcon({
                    html: `
                      <div style="
                        width: 30px;
                        height: 30px;
                        background-color: #22c55e;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        font-weight: bold;
                        color: white;
                      ">
                        🚀
                      </div>
                    `,
                    className: 'custom-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15]
                  })}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-sm mb-1 text-green-600">
                        🚀 Route Start
                      </h3>
                      {firstPoint.timestamp && (
                        <p className="text-xs text-gray-600">
                          Time: {new Date(firstPoint.timestamp).toLocaleString()}
                        </p>
                      )}
                      {firstPoint.speed !== undefined && (
                        <p className="text-xs text-gray-600">
                          Speed: {firstPoint.speed.toFixed(1)} km/h
                        </p>
                      )}
                      {firstPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">
                          {firstPoint.address}
                        </p>
                      )}
                      {!firstPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">
                          Location: {startPosition[0].toFixed(6)}, {startPosition[1].toFixed(6)}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })()}
            
            {/* End marker - show at the last point of the last segment */}
            {route.length > 1 && finalSegmentCoords.length > 0 && (() => {
              const lastSegment = finalSegmentCoords[finalSegmentCoords.length - 1];
              if (lastSegment.length === 0) return null;
              
              const lastPoint = route[route.length - 1];
              const lastSegmentLastCoord = lastSegment[lastSegment.length - 1];
              
              // Use route point coordinates (more accurate) if available, otherwise use segment coord
              const endPosition: [number, number] = lastPoint && typeof lastPoint.lat === 'number' && typeof lastPoint.lng === 'number'
                ? [lastPoint.lat, lastPoint.lng]
                : [lastSegmentLastCoord[0], lastSegmentLastCoord[1]];
              
              return (
                <Marker
                  position={endPosition}
                  icon={L.divIcon({
                    html: `
                      <div style="
                        width: 30px;
                        height: 30px;
                        background-color: #ef4444;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        font-weight: bold;
                        color: white;
                      ">
                        🏁
                      </div>
                    `,
                    className: 'custom-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15]
                  })}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-sm mb-1 text-red-600">
                        🏁 Route End
                      </h3>
                      {lastPoint.timestamp && (
                        <p className="text-xs text-gray-600">
                          Time: {new Date(lastPoint.timestamp).toLocaleString()}
                        </p>
                      )}
                      {lastPoint.speed !== undefined && (
                        <p className="text-xs text-gray-600">
                          Speed: {lastPoint.speed.toFixed(1)} km/h
                        </p>
                      )}
                      {lastPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">
                          {lastPoint.address}
                        </p>
                      )}
                      {!lastPoint.address && (
                        <p className="text-xs text-gray-500 mt-1">
                          Location: {endPosition[0].toFixed(6)}, {endPosition[1].toFixed(6)}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })()}
          </>
        ) : (
          // ✅ FIX: Don't show "No route data available" if we're still loading
          !shouldShowLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-[1000]">
              <div className="text-center p-4 bg-white rounded shadow">
                <p className="text-gray-600">No route data available</p>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              </div>
            </div>
          )
        )}
        
        {/* Fit bounds to route - only if we have bounds */}
        {bounds && <FitBounds bounds={bounds} />}
      </MapContainer>
    </div>
  );
};

export default RouteMapped;
