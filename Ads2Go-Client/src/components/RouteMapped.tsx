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
const snapWithGoogleRoads = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    // Google Roads API has a limit of 100 points per request
    const maxPointsPerBatch = 100;
    const batches: [number, number][][] = [];
    
    // Split points into batches
    for (let i = 0; i < points.length; i += maxPointsPerBatch) {
      batches.push(points.slice(i, i + maxPointsPerBatch));
    }
    
    console.log(`📍 Processing ${points.length} points in ${batches.length} batches`);
  
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
        allSnappedPoints.push(...batch);
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
        allSnappedPoints.push(...snappedPoints);
      } else {
        console.warn(`⚠️ No snapped points in batch ${batchIndex + 1}, using original points`);
        console.log(`📍 Batch ${batchIndex + 1} original points:`, batch.slice(0, 2));
        allSnappedPoints.push(...batch);
      }
      
      // Add small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Google Roads snapping completed:', allSnappedPoints.length, 'total snapped points');
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

  // ✅ FIX: Compute loading state after routeSegments is defined
  // Check if we have valid route segments ready to display
  const hasValidSegments = routeSegments.length > 0 && routeSegments.some(seg => seg.length > 0);
  const hasSnappedSegments = snapToRoads 
    ? (snappedSegmentCoords.length > 0 && !isSnappingInProgress && snappedSegmentCoords.some(seg => seg.length > 0))
    : true; // If snapToRoads is disabled, we use routeSegments (checked above)
  
  // Check if route data exists but is actually empty (no points) - this means "no route data", not loading
  const routeIsEmpty = hasDataForCurrentProps && route.length === 0;
  
  // ✅ FIX: Compute if we should show loading
  // Show loading if: explicit loading state OR we don't have data for current props OR segments are being processed
  // Don't show loading if route is confirmed empty (will show "no route data" instead)
  const shouldShowLoading = !routeIsEmpty && (
    loading || 
    (!hasDataForCurrentProps && !error && isValidMaterialId && materialId && date) ||
    (hasDataForCurrentProps && !error && (!hasValidSegments || (snapToRoads && !hasSnappedSegments)))
  );

  // Apply road snapping to each segment separately to maintain segment structure
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    // Create a stable key for this route
    const routeKey = JSON.stringify(routeSegments);
    
    // Skip if we've already processed this exact route
    if (routeKey === lastProcessedRoute) {
      return;
    }
    
    const applyRoadSnapping = async () => {
      if (routeSegments.length === 0) {
        if (isMounted) {
          setSnappedSegmentCoords([]);
          setLastProcessedRoute(routeKey);
          setIsSnappingInProgress(false);
          // ✅ FIX: If no route segments, set loading to false (completes loading state)
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
          setLastProcessedRoute(routeKey);
          setIsSnappingInProgress(false);
          // Loading was already set to false after API fetch (since snapToRoads is disabled)
        }
        return;
      }

      // ✅ FIX: Set snapping in progress to prevent showing raw coordinates
      if (isMounted) {
        setIsSnappingInProgress(true);
      }

      // Apply road snapping to each segment separately
      console.log('🗺️ [RouteMapped] Applying road snapping to', routeSegments.length, 'segments, snapToRoads:', snapToRoads);
      
      try {
        const snappedSegments: [number, number][][] = [];
        
        // Process each segment individually
        for (let i = 0; i < routeSegments.length; i++) {
          const segment = routeSegments[i];
          console.log(`🗺️ [RouteMapped] Snapping segment ${i + 1}/${routeSegments.length} with ${segment.length} points`);
          
          const snappedSegment = await snapPointsToRoads(segment);
          snappedSegments.push(snappedSegment);
          
          console.log(`✅ [RouteMapped] Segment ${i + 1} snapped: ${segment.length} → ${snappedSegment.length} points`);
        }
        
        const totalOriginalPoints = routeSegments.reduce((sum, seg) => sum + seg.length, 0);
        const totalSnappedPoints = snappedSegments.reduce((sum, seg) => sum + seg.length, 0);
        
        console.log('✅ [RouteMapped] Road snapping completed:', {
          segments: routeSegments.length,
          originalPoints: totalOriginalPoints,
          snappedPoints: totalSnappedPoints,
          snapToRoads
        });
        
        if (isMounted) {
          setSnappedSegmentCoords(snappedSegments);
          setLastProcessedRoute(routeKey);
          setIsSnappingInProgress(false);
          
          // ✅ FIX: Set loading to false after snapping completes (completes the combined loading state)
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
      } catch (error) {
        console.error('❌ [Road Snapping] Error:', error);
        console.warn('⚠️ [RouteMapped] Falling back to raw segment coordinates');
        if (isMounted) {
          setSnappedSegmentCoords(routeSegments);
          setLastProcessedRoute(routeKey);
          setIsSnappingInProgress(false);
          
          // ✅ FIX: Set loading to false even if snapping fails (fallback to raw coordinates)
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
      }
    };

    applyRoadSnapping();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [routeSegments, snapToRoads, lastProcessedRoute]);


  // Use snapped segment coordinates (one array per segment)
  // ✅ FIX: If snapToRoads is enabled, only show route after snapping is complete
  // This prevents showing raw GPS points before snapping completes
  const finalSegmentCoords = snapToRoads 
    ? (snappedSegmentCoords.length > 0 && !isSnappingInProgress ? snappedSegmentCoords : [])
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
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
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
              // Each segment is already snapped (if snapToRoads is enabled) or raw
              // Only log on first render or when segment count changes
              if (index === 0 || (index === finalSegmentCoords.length - 1 && process.env.NODE_ENV === 'development')) {
                console.log(`🗺️ [RouteMapped] Rendering ${finalSegmentCoords.length} segment(s):`, {
                  segmentIndex: index,
                  points: segmentCoords.length,
                  usingSnapped: snapToRoads && snappedSegmentCoords.length > 0
                });
              }
              
              return (
                <Polyline
                  key={`segment-${index}`}
                  positions={segmentCoords}
                  color="#3674B5"
                  weight={4}
                  opacity={0.8}
                />
              );
            })}
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
