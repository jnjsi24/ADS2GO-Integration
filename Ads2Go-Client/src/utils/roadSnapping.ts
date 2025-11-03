// Utility functions for snapping GPS points to roads
// This ensures consistent road snapping behavior across all route map components

/**
 * Smooth GPS route using quad-pass (4-pass) algorithm
 */
export const smoothRoute = (points: [number, number][]): [number, number][] => {
  if (points.length < 3) return points;
  
  const smoothed: [number, number][] = [];
  smoothed.push(points[0]); // Keep first point
  
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
  
  // Second pass: Light smoothing
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
  
  // Third pass: Very light smoothing (90% original, 10% smoothed)
  const tripleSmoothed: [number, number][] = [];
  tripleSmoothed.push(doubleSmoothed[0]);
  
  for (let i = 1; i < doubleSmoothed.length - 1; i++) {
    const prev = doubleSmoothed[i - 1];
    const current = doubleSmoothed[i];
    const next = doubleSmoothed[i + 1];
    
    const smoothedLat = (current[0] * 0.9) + ((prev[0] + next[0]) / 2 * 0.1);
    const smoothedLng = (current[1] * 0.9) + ((prev[1] + next[1]) / 2 * 0.1);
    
    tripleSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  tripleSmoothed.push(doubleSmoothed[doubleSmoothed.length - 1]);
  
  // Fourth pass: Ultra-light smoothing for ultra-dense data (95% original, 5% smoothed)
  const quadSmoothed: [number, number][] = [];
  quadSmoothed.push(tripleSmoothed[0]);
  
  for (let i = 1; i < tripleSmoothed.length - 1; i++) {
    const prev = tripleSmoothed[i - 1];
    const current = tripleSmoothed[i];
    const next = tripleSmoothed[i + 1];
    
    const smoothedLat = (current[0] * 0.95) + ((prev[0] + next[0]) / 2 * 0.05);
    const smoothedLng = (current[1] * 0.95) + ((prev[1] + next[1]) / 2 * 0.05);
    
    quadSmoothed.push([smoothedLat, smoothedLng]);
  }
  
  quadSmoothed.push(tripleSmoothed[tripleSmoothed.length - 1]);
  
  return quadSmoothed;
};

/**
 * Add intermediate points for better road following
 */
export const addIntermediatePoints = (points: [number, number][]): [number, number][] => {
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
  
  return enhanced;
};

/**
 * Snap GPS points to roads using Google Roads API
 */
const snapWithGoogleRoads = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    // Google Roads API has a limit of 100 points per request
    const maxPointsPerBatch = 100;
    const batches: [number, number][][] = [];
    
    // Split points into batches
    for (let i = 0; i < points.length; i += maxPointsPerBatch) {
      batches.push(points.slice(i, i + maxPointsPerBatch));
    }
    
    // Warn if we have a lot of points (might hit API limits)
    if (points.length > 1000) {
      console.warn(`⚠️ Large route detected: ${points.length} points. This may take a while.`);
    }
    
    const allSnappedPoints: [number, number][] = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const path = batch.map(([lat, lng]) => `${lat},${lng}`).join('|');
      
      const apiUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&key=${apiKey}`;
      
      try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.warn(`❌ Google Roads API batch ${batchIndex + 1} failed:`, response.status);
          // If a batch fails, use original points for that batch
          allSnappedPoints.push(...batch);
          continue;
        }
        
        const data = await response.json();
        
        if (data.snappedPoints && data.snappedPoints.length > 0) {
          const snappedPoints = data.snappedPoints.map((point: any) => [
            point.location.latitude,
            point.location.longitude
          ] as [number, number]);
          allSnappedPoints.push(...snappedPoints);
        } else {
          // No snapped points - use original points
          allSnappedPoints.push(...batch);
        }
      } catch (batchError) {
        console.warn(`❌ Batch ${batchIndex + 1} error:`, batchError);
        allSnappedPoints.push(...batch);
      }
      
      // Add small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return allSnappedPoints;
  } catch (error) {
    console.warn('❌ Google Roads API error:', error);
    return points; // Fallback to original points
  }
};

/**
 * Snap GPS points to roads using OpenRouteService API (fallback)
 */
const snapWithOpenRoute = async (points: [number, number][], apiKey: string): Promise<[number, number][]> => {
  try {
    const coordinates = points.map(([lat, lng]) => [lng, lat]).join('|');
    
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&coordinates=${coordinates}&format=geojson&options={"continue_straight":false}`
    );
    
    if (!response.ok) {
      throw new Error(`OpenRouteService API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.geometry && data.geometry.coordinates && data.geometry.coordinates.length > 0) {
      // Convert from [lng, lat] to [lat, lng]
      return data.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
    }
    
    return points;
  } catch (error) {
    console.warn('❌ OpenRouteService API error:', error);
    return points; // Fallback to original points
  }
};

/**
 * Main function to snap GPS points to roads
 * Returns smoothed points if API is unavailable (safe fallback)
 */
export const snapPointsToRoads = async (points: [number, number][]): Promise<[number, number][]> => {
  if (points.length < 2) return points;
  
  // First apply smoothing and add intermediate points
  const smoothedPoints = smoothRoute(points);
  const enhancedPoints = addIntermediatePoints(smoothedPoints);
  
  // Check if we have a Google Roads API key
  const googleApiKey = process.env.REACT_APP_GOOGLE_ROADS_API_KEY;
  const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY;
  
  // Prefer Google Roads API if available
  if (googleApiKey && googleApiKey !== 'your-google-api-key-here' && googleApiKey.trim() !== '') {
    try {
      return await snapWithGoogleRoads(enhancedPoints, googleApiKey);
    } catch (error) {
      console.warn('❌ Google Roads API failed, using smoothed route:', error);
      return smoothedPoints; // Safe fallback
    }
  }
  
  // Fallback to OpenRouteService
  if (openRouteApiKey && openRouteApiKey !== 'your-api-key-here' && openRouteApiKey.trim() !== '') {
    try {
      return await snapWithOpenRoute(enhancedPoints, openRouteApiKey);
    } catch (error) {
      console.warn('❌ OpenRouteService API failed, using smoothed route:', error);
      return smoothedPoints; // Safe fallback
    }
  }
  
  // No API key - return smoothed points (still better than raw GPS points)
  return smoothedPoints;
};


