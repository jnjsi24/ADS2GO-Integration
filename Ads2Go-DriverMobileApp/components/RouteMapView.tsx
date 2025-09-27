import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
  if (!route || route.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>🗺️</View>
          <View style={styles.placeholderText}>No Route Data</View>
          <View style={styles.placeholderSubtext}>
            GPS points will appear here when route data is available
          </View>
        </View>
      </View>
    );
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
        .map-info {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(255, 255, 255, 0.95);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          border: 1px solid rgba(0,0,0,0.1);
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
      <div class="map-info">
        📍 ${route.length} GPS Points | 🚀 Route Visualization
      </div>
      <div id="map"></div>
      
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Initialize map
        function initMap() {
          const routePoints = ${JSON.stringify(route)};
          
          if (routePoints.length === 0) return;
          
          // Calculate center point
          const centerLat = routePoints.reduce((sum, point) => sum + point.lat, 0) / routePoints.length;
          const centerLng = routePoints.reduce((sum, point) => sum + point.lng, 0) / routePoints.length;
          
          // Create map
          const map = L.map('map').setView([centerLat, centerLng], 15);
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);
          
          // Create route polyline
          const routePath = routePoints.map(point => [point.lat, point.lng]);
          
          const routePolyline = L.polyline(routePath, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1
          }).addTo(map);
          
          // Add start marker
          if (routePoints.length > 0) {
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
          }
          
          // Add end marker
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
          }
          
          // Fit map to show entire route
          if (routePoints.length > 1) {
            const group = new L.featureGroup([routePolyline]);
            map.fitBounds(group.getBounds().pad(0.1));
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
