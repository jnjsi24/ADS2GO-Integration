import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

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
}

const RouteMapView: React.FC<RouteMapViewProps> = ({ route, style }) => {
  // Always show the map, even with no data
  const routeData = route || [];
  console.log('🗺️ RouteMapView received route data:', routeData.length, 'points');

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
        // Initialize map
        function initMap() {
          const routePoints = ${JSON.stringify(routeData)};
          console.log('🗺️ Initializing Leaflet map with', routePoints.length, 'points');
          
          // Default center point (San Francisco) if no route data
          let centerLat, centerLng;
          if (routePoints.length === 0) {
            console.log('🗺️ No route points - using default center');
            centerLat = 37.7749;
            centerLng = -122.4194;
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
          
          // Create route polyline only if we have route points
          if (routePoints.length > 0) {
            console.log('🗺️ Creating route polyline with', routePoints.length, 'points');
            const routePath = routePoints.map(point => [point.lat, point.lng]);
            
            const routePolyline = L.polyline(routePath, {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              smoothFactor: 1
            }).addTo(map);
          } else {
            console.log('🗺️ No route points - showing empty map');
          }
          
          // Add markers and fit bounds only if we have route points
          if (routePoints.length > 0) {
            // Add start marker
            const startMarker = L.marker([routePoints[0].lat, routePoints[0].lng], {
              icon: L.divIcon({
                className: 'route-start',
                html: '🚀',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map);
            
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
              
              // Fit map to show the route
              const group = new L.featureGroup([routePolyline]);
              map.fitBounds(group.getBounds().pad(0.1));
            }
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
  },
  webview: {
    flex: 1,
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
