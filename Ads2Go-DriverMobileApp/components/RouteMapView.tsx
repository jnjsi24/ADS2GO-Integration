import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  accuracy: number;
  address: string;
}

interface RouteMapViewProps {
  route: RoutePoint[];
  style?: any;
  showSpeedColors?: boolean;
  showWaypoints?: boolean;
}

const RouteMapView: React.FC<RouteMapViewProps> = ({ 
  route, 
  style, 
  showSpeedColors = false,
  showWaypoints = false 
}) => {
  // Get Google Roads API key from environment
  const googleRoadsApiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_ROADS_API_KEY || '';
  
  // Always show the map, even with no data
  const routeData = route || [];
  
  // ✅ OPTIMIZED: Reduce logging frequency to improve performance
  const routeLength = routeData.length;
  if (routeLength > 0 && routeLength % 10 === 0) {
    // Only log every 10th point to reduce console spam during real-time updates
    console.log('🗺️ RouteMapView route data:', routeLength, 'points');
  }

  // Create the HTML for the map using Leaflet (OpenStreetMap)
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #map {
          height: 100%;
          width: 100%;
        }
        .leaflet-popup-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .route-start {
          background: #22c55e;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
        }
        .route-end {
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Speed color calculation (Strava-style)
        function getSpeedColor(speed) {
          // Speed ranges in km/h
          if (speed < 10) return '#22c55e';      // Green - slow
          if (speed < 30) return '#84cc16';      // Light green
          if (speed < 50) return '#eab308';      // Yellow
          if (speed < 70) return '#f97316';      // Orange
          if (speed < 90) return '#ef4444';      // Red
          return '#dc2626';                       // Dark red - very fast
        }

        // ✅ Smooth GPS route using quad-pass (4-pass) algorithm (100% identical to Admin Client)
        function smoothRoute(points) {
          if (points.length < 3) return points;
          
          const smoothed = [points[0]]; // Keep first point
          
          // First pass: Weighted average smoothing based on distance
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
          const doubleSmoothed = [];
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
          const tripleSmoothed = [];
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
          const quadSmoothed = [];
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
          
          console.log('🎨 Quad-pass smoothing applied (matches Admin Client 100%):', {
            originalPoints: points.length,
            smoothedPoints: quadSmoothed.length,
            reduction: points.length - quadSmoothed.length
          });
          
          return quadSmoothed;
        }

        // Function to add intermediate points for better road following (matches Admin Client)
        function addIntermediatePoints(points) {
          if (points.length < 2) return points;
          
          const enhanced = [];
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
          
          console.log('🔄 Enhanced points:', {
            original: points.length,
            enhanced: enhanced.length,
            added: enhanced.length - points.length
          });
          
          return enhanced;
        }

        // Function to snap GPS points to roads using Google Roads API (matches Admin Client)
        async function snapPointsToRoads(points, apiKey) {
          if (points.length < 2 || !apiKey || apiKey === 'your-google-api-key-here') {
            console.log('⚠️ Road snapping skipped - no API key or insufficient points');
            return points;
          }
          
          console.log('🗺️ Starting Google Roads API snapping for', points.length, 'points');
          
          try {
            // First apply smoothing and add intermediate points
            const smoothedPoints = smoothRoute(points);
            const enhancedPoints = addIntermediatePoints(smoothedPoints);
            
            console.log('📍 Enhanced points for snapping:', enhancedPoints.length);
            
            // Google Roads API has a limit of 100 points per request
            const maxPointsPerBatch = 100;
            const batches = [];
            
            // Split points into batches
            for (let i = 0; i < enhancedPoints.length; i += maxPointsPerBatch) {
              batches.push(enhancedPoints.slice(i, i + maxPointsPerBatch));
            }
            
            console.log('📦 Split into', batches.length, 'batches');
            
            const allSnappedPoints = [];
            
            // Process each batch
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const batch = batches[batchIndex];
              
              // Create path string for API (lat,lng|lat,lng|...)
              const path = batch.map(([lat, lng]) => lat + ',' + lng).join('|');
              
              console.log('🔄 Processing batch', batchIndex + 1, '/', batches.length, 'with', batch.length, 'points');
              
              const apiUrl = 'https://roads.googleapis.com/v1/snapToRoads?path=' + encodeURIComponent(path) + '&key=' + apiKey;
              
              try {
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                  console.warn('❌ Google Roads API batch', batchIndex + 1, 'failed:', response.status);
                  // If a batch fails, use original points for that batch
                  allSnappedPoints.push(...batch);
                  continue;
                }
                
                const data = await response.json();
                
                if (data.snappedPoints && data.snappedPoints.length > 0) {
                  const snappedCoords = data.snappedPoints.map(point => [
                    point.location.latitude,
                    point.location.longitude
                  ]);
                  allSnappedPoints.push(...snappedCoords);
                  console.log('✅ Batch', batchIndex + 1, 'snapped:', snappedCoords.length, 'points');
                } else {
                  console.warn('⚠️ No snapped points in batch', batchIndex + 1, 'response');
                  allSnappedPoints.push(...batch);
                }
              } catch (batchError) {
                console.warn('❌ Batch', batchIndex + 1, 'error:', batchError);
                allSnappedPoints.push(...batch);
              }
              
              // Add small delay between batches to avoid rate limiting
              if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            console.log('✅ Google Roads snapping completed:', allSnappedPoints.length, 'total snapped points');
            return allSnappedPoints;
          } catch (error) {
            console.warn('❌ Google Roads API error:', error);
            return points;
          }
        }

        // Initialize map
        async function initMap() {
          try {
            const routePoints = ${JSON.stringify(routeData)};
            const showSpeedColors = ${showSpeedColors};
            const showWaypoints = ${showWaypoints};
            const googleApiKey = '${googleRoadsApiKey}';
            
            console.log('🗺️ Initializing Leaflet map with', routePoints.length, 'points');
            console.log('🎨 Speed colors:', showSpeedColors, 'Waypoints:', showWaypoints);
            console.log('🔑 Google Roads API Key:', googleApiKey ? 'Available ✅' : 'Not found ❌');
          
          // Default center point (Manila, Philippines) if no route data
          let centerLat, centerLng;
          if (routePoints.length === 0) {
            console.log('🗺️ No route points - using Manila as default center');
            centerLat = 14.5995;
            centerLng = 120.9842;
          } else {
            // Calculate center point from route data
            centerLat = routePoints.reduce((sum, point) => sum + point.lat, 0) / routePoints.length;
            centerLng = routePoints.reduce((sum, point) => sum + point.lng, 0) / routePoints.length;
          }
          console.log('🗺️ Center point:', centerLat, centerLng);
          
          // Create map
          console.log('🗺️ Creating Leaflet map...');
          const map = L.map('map').setView([centerLat, centerLng], 13);
          console.log('🗺️ Map created successfully');
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);
          
          // Create route polyline(s) only if we have route points
          if (routePoints.length > 0) {
            console.log('🗺️ Creating route with', routePoints.length, 'points');
            
            // ✅ FIX: Split route into segments based on isSegmentBreak flag
            const segments = [];
            let currentSegment = [];
            
            for (let i = 0; i < routePoints.length; i++) {
              const point = routePoints[i];
              
              // If this point starts a new segment (after offline period), save current segment
              if (i > 0 && (point.isSegmentBreak || point.isSegmentStart)) {
                if (currentSegment.length > 1) {
                  segments.push([...currentSegment]);
                }
                currentSegment = [point];
              } else {
                currentSegment.push(point);
              }
            }
            
            // Add final segment
            if (currentSegment.length > 1) {
              segments.push(currentSegment);
            }
            
            console.log('📍 Route split into', segments.length, 'segment(s) (offline periods detected)');
            
            if (showSpeedColors && routePoints.length > 1) {
              // Create speed-colored segments (Strava-style) with road snapping
              console.log('🎨 Creating speed-colored segments with road snapping');
              
              // Process each segment separately
              for (let segIndex = 0; segIndex < segments.length; segIndex++) {
                const segment = segments[segIndex];
                const routePath = segment.map(point => [point.lat, point.lng]);
                const snappedPath = await snapPointsToRoads(routePath, googleApiKey);
                
                // Create segments from snapped path
                for (let i = 0; i < snappedPath.length - 1; i++) {
                  // Find closest original points to get speed data
                  const origIndex = Math.min(Math.floor(i * segment.length / snappedPath.length), segment.length - 1);
                  const nextOrigIndex = Math.min(origIndex + 1, segment.length - 1);
                  
                  const avgSpeed = (segment[origIndex].speed + segment[nextOrigIndex].speed) / 2;
                  const color = getSpeedColor(avgSpeed);
                  
                  L.polyline(
                    [snappedPath[i], snappedPath[i + 1]], 
                    {
                      color: color,
                      weight: 4,
                      opacity: 0.8,
                      smoothFactor: 1
                    }
                  ).addTo(map);
                }
              }
            } else {
              // Single blue polyline with road snapping - draw each segment separately
              console.log('🗺️ Creating segmented polylines with road snapping to follow actual roads');
              
              for (let segIndex = 0; segIndex < segments.length; segIndex++) {
                const segment = segments[segIndex];
                
                try {
                  const routePath = segment.map(point => [point.lat, point.lng]);
                  
                  // Apply road snapping (which includes smoothing + intermediate points)
                  const snappedPath = await snapPointsToRoads(routePath, googleApiKey);
                  
                  L.polyline(snappedPath, {
                    color: '#3674B5',  // ✅ Exact same color as Admin Client
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1
                  }).addTo(map);
                  
                  if (segIndex === 0) {
                    console.log('✅ Road-snapped polyline added to map successfully (following actual roads)');
                  }
                } catch (error) {
                  console.error('❌ Error creating polyline segment:', error);
                  // Fallback: draw without smoothing
                  const routePath = segment.map(point => [point.lat, point.lng]);
                  L.polyline(routePath, {
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1
                  }).addTo(map);
                }
              }
            }
          } else {
            console.log('🗺️ No route points - showing empty map');
          }
          
          // Add markers and fit bounds only if we have route points
          if (routePoints.length > 0) {
            const allMarkers = [];
            
            // Add start marker
            const startMarker = L.marker([routePoints[0].lat, routePoints[0].lng], {
              icon: L.divIcon({
                className: 'route-start',
                html: '🚀',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map);
            allMarkers.push(startMarker);
            
            const startPopup = L.popup({
              maxWidth: 250,
              className: 'custom-popup'
            }).setContent(\`
              <div style="padding: 8px;">
                <strong>🚀 Route Start</strong><br>
                <small>\${new Date(routePoints[0].timestamp).toLocaleString()}</small><br>
                <small>Speed: \${routePoints[0].speed.toFixed(1)} km/h</small><br>
                <small>\${routePoints[0].address || 'Location: ' + routePoints[0].lat.toFixed(6) + ', ' + routePoints[0].lng.toFixed(6)}</small>
              </div>
            \`);
            
            startMarker.bindPopup(startPopup);
            
            // Add waypoint markers (every 10th point)
            if (showWaypoints && routePoints.length > 10) {
              console.log('📍 Adding waypoint markers');
              for (let i = 10; i < routePoints.length - 1; i += 10) {
                const point = routePoints[i];
                const marker = L.circleMarker([point.lat, point.lng], {
                  radius: 4,
                  fillColor: getSpeedColor(point.speed),
                  color: '#ffffff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.9
                }).addTo(map);
                
                marker.bindPopup(\`
                  <div style="padding: 8px;">
                    <strong>Waypoint #\${Math.floor(i / 10)}</strong><br>
                    <small>\${new Date(point.timestamp).toLocaleString()}</small><br>
                    <small>Speed: \${point.speed.toFixed(1)} km/h</small><br>
                    <small>\${point.address || point.lat.toFixed(6) + ', ' + point.lng.toFixed(6)}</small>
                  </div>
                \`);
                
                allMarkers.push(marker);
              }
            }
            
            // Add end marker if there are multiple points
            if (routePoints.length > 1) {
              const endMarker = L.marker([routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng], {
                icon: L.divIcon({
                  className: 'route-end',
                  html: '🏁',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).addTo(map);
              allMarkers.push(endMarker);
              
              const endPopup = L.popup({
                maxWidth: 250,
                className: 'custom-popup'
              }).setContent(\`
                <div style="padding: 8px;">
                  <strong>🏁 Route End</strong><br>
                  <small>\${new Date(routePoints[routePoints.length - 1].timestamp).toLocaleString()}</small><br>
                  <small>Speed: \${routePoints[routePoints.length - 1].speed.toFixed(1)} km/h</small><br>
                  <small>\${routePoints[routePoints.length - 1].address || 'Location: ' + routePoints[routePoints.length - 1].lat.toFixed(6) + ', ' + routePoints[routePoints.length - 1].lng.toFixed(6)}</small>
                </div>
              \`);
              
              endMarker.bindPopup(endPopup);
              
              // Fit map to show the entire route
              const group = new L.featureGroup(allMarkers);
              map.fitBounds(group.getBounds().pad(0.1));
            }
          }
          } catch (error) {
            console.error('❌ Critical error in initMap:', error);
            console.error('Error stack:', error.stack);
          }
        }
        
        // Initialize map when page loads
        document.addEventListener('DOMContentLoaded', initMap);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('🗺️ WebView error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('🗺️ WebView HTTP error:', nativeEvent);
        }}
        onLoadEnd={() => {
          console.log('🗺️ WebView loaded successfully');
        }}
        onLoadStart={() => {
          console.log('🗺️ WebView started loading');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 40,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RouteMapView;
