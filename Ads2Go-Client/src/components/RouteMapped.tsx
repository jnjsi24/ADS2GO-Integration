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
const smoothRoute = (points: [number, number][]): [number, number][] => {
  if (points.length < 3) return points;
  
  // Smoothing route silently
  
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
    
    // If points are very close together (< 3 meters), skip intermediate points
    if (dist1Meters < 3 && dist2Meters < 3) {
      continue;
    }
    
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
      const weight1 = dist2Meters / totalDist; // More weight to closer neighbor
      const weight2 = dist1Meters / totalDist;
      
      const smoothedLat = (weight1 * prev[0] + current[0] + weight2 * next[0]) / (weight1 + 1 + weight2);
      const smoothedLng = (weight1 * prev[1] + current[1] + weight2 * next[1]) / (weight1 + 1 + weight2);
      
      smoothed.push([smoothedLat, smoothedLng]);
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
  onRouteLoad,
  onLoadingChange
}) => {
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchParams = useRef<string>('');
  
  // Validate materialId
  const isValidMaterialId = materialId && materialId !== 'all' && typeof materialId === 'string';

  // Reset fetching state when materialId or date changes
  useEffect(() => {
    fetchingRef.current = false;
  }, [materialId, date]);

  // Extract route data (only if available)
  const route = routeData?.route || [];
  const bounds = routeData?.bounds || null;

  // Convert route points to polyline coordinates with safety checks (memoized)
  const rawPolylineCoords: [number, number][] = useMemo(() => {
    return route
      .filter((point: RoutePoint) => point && typeof point.lat === 'number' && typeof point.lng === 'number')
      .map((point: RoutePoint) => [point.lat, point.lng] as [number, number]);
  }, [route]);

  // Initialize snapped coordinates when route changes - using useMemo for stability
  const [snappedPolylineCoords, setSnappedPolylineCoords] = useState<[number, number][]>([]);
  const [lastProcessedRoute, setLastProcessedRoute] = useState<string>('');

  // Apply road snapping when route data changes
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    // Create a stable key for this route
    const routeKey = JSON.stringify(rawPolylineCoords);
    
    // Skip if we've already processed this exact route
    if (routeKey === lastProcessedRoute) {
      return;
    }
    
    const applyRoadSnapping = async () => {
      if (rawPolylineCoords.length === 0) {
        if (isMounted) {
          setSnappedPolylineCoords([]);
          setLastProcessedRoute(routeKey);
        }
        return;
      }

      // If snapToRoads is disabled, use raw coordinates
      if (!snapToRoads) {
        if (isMounted) {
          setSnappedPolylineCoords(rawPolylineCoords);
          setLastProcessedRoute(routeKey);
        }
        return;
      }

      // Apply road snapping
        // Road snapping happens silently in background
      
      try {
        // Road snapping happens silently in background
        const snappedCoords = await snapPointsToRoads(rawPolylineCoords);
        
        if (isMounted) {
          setSnappedPolylineCoords(snappedCoords);
          setLastProcessedRoute(routeKey);
        }
      } catch (error) {
        console.error('❌ [Road Snapping] Error:', error);
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
  }, [rawPolylineCoords, snapToRoads, lastProcessedRoute]);


  // Use snapped coordinates for the polyline
  const polylineCoords = snappedPolylineCoords;

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
      return;
    }

    const fetchRouteData = async () => {
      try {
        // Create a unique key for this request
        const requestKey = `${materialId}-${date}`;
        
        // Skip if we're already fetching the same data
        if (fetchingRef.current || lastFetchParams.current === requestKey) {
          console.log('🚫 [RouteMapped] Skipping duplicate request:', requestKey);
          return;
        }

        fetchingRef.current = true;
        lastFetchParams.current = requestKey;
        setLoading(true);
        setError(null);
        if (onLoadingChange) {
          onLoadingChange(true);
        }

        console.log('🗺️ [RouteMapped] Props:', { materialId, date });

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
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
          if (onRouteLoad) {
            onRouteLoad(result.data);
          }
        } else {
          console.log('❌ [RouteMapped] API returned error:', result.message);
          setError('No route data available for this date');
          setLoading(false);
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
      } catch (err) {
        setError('Unable to load route data');
        console.error('❌ [RouteMapped] Error:', err);
        setLoading(false);
        if (onLoadingChange) {
          onLoadingChange(false);
        }
      } finally {
        fetchingRef.current = false;
        lastFetchParams.current = ''; // Reset to allow future requests
      }
    };

    fetchRouteData();
  }, [materialId, date, isValidMaterialId]);

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



  // Show loading state while fetching data
  if (loading) {
    return (
      <div style={style} className={className} key={`wrapper-${materialId}-${date}`}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Route Data</h3>
            <p className="text-sm text-gray-600">
              Fetching route data for {date}...
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
        
        {/* Route polyline with road snapping - only show if we have valid data */}
        {polylineCoords.length > 0 && (
          <Polyline
            positions={polylineCoords}
            color="#3674B5"
            weight={4}
            opacity={0.8}
          />
        )}
        
        {/* Fit bounds to route - only if we have bounds */}
        {bounds && <FitBounds bounds={bounds} />}
      </MapContainer>
    </div>
  );
};

export default RouteMapped;
