const NodeGeocoder = require('node-geocoder');
const OSRM = require('osrm');

// Initialize OSRM (you'll need to download OSM data or use a tile server)
// For development, you can use a public OSRM server
const osrm = new OSRM({
  algorithm: 'MLD',
  path: './data/philippines-latest.osm.pbf', // You'll need to download this file
  max_locations_trip: 100,
  max_radius: 10000
});

// Initialize geocoder
const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  timeout: 5000,
  maxRetries: 3
});

class OSMService {
  /**
   * Convert coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>} Formatted address
   */
  static async reverseGeocode(lat, lng) {
    try {
      const res = await geocoder.reverse({ lat, lon: lng });
      return res[0]?.formattedAddress || 'Unknown location';
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Unknown location';
    }
  }

  /**
   * Get route between two points
   * @param {Object} origin - {latitude, longitude}
   * @param {Object} destination - {latitude, longitude}
   * @returns {Promise<Object>} Route information
   */
  static async getRoute(origin, destination) {
    return new Promise((resolve, reject) => {
      const coordinates = [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ];

      osrm.trip({
        coordinates: coordinates,
        geometries: 'geojson',
        overview: 'full',
        source: 'first',
        destination: 'last',
        steps: true
      }, (err, result) => {
        if (err) {
          console.error('Routing error:', err);
          return reject(err);
        }
        resolve(result);
      });
    });
  }

  /**
   * Get distance matrix between multiple points
   * @param {Array} points - Array of {latitude, longitude}
   * @returns {Promise<Object>} Distance matrix
   */
  static async getDistanceMatrix(points) {
    const coordinates = points.map(p => [p.longitude, p.latitude]);
    
    return new Promise((resolve, reject) => {
      osrm.table({
        sources: [0],
        destinations: Array.from({length: coordinates.length - 1}, (_, i) => i + 1),
        coordinates: coordinates,
        annotations: ['distance', 'duration']
      }, (err, result) => {
        if (err) {
          console.error('Distance matrix error:', err);
          return reject(err);
        }
        resolve(result);
      });
    });
  }
}

module.exports = OSMService;
