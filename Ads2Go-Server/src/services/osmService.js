const NodeGeocoder = require('node-geocoder');

// Configure geocoder for OpenStreetMap
const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  formatter: null
});

class OSMService {
  /**
   * Reverse geocode coordinates to get address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>} - Formatted address
   */
  static async reverseGeocode(lat, lng) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Geocoding timeout')), 5000);
      });

      const geocodingPromise = geocoder.reverse({ lat, lon: lng });
      
      const results = await Promise.race([geocodingPromise, timeoutPromise]);
      
      if (results && results.length > 0) {
        const result = results[0];
        const addressParts = [];
        
        if (result.streetNumber) addressParts.push(result.streetNumber);
        if (result.streetName) addressParts.push(result.streetName);
        if (result.city) addressParts.push(result.city);
        if (result.state) addressParts.push(result.state);
        if (result.country) addressParts.push(result.country);
        
        return addressParts.join(', ') || 'Unknown location';
      }
      
      return 'Unknown location';
    } catch (error) {
      console.warn('Geocoding failed:', error.message);
      return `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lng1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lng2 - Second longitude
   * @returns {number} - Distance in kilometers
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return Math.round(distance * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} - Radians
   */
  static deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Calculate estimated travel time based on distance and average speed
   * @param {number} distance - Distance in kilometers
   * @param {number} averageSpeed - Average speed in km/h (default: 30)
   * @returns {number} - Estimated time in minutes
   */
  static calculateTravelTime(distance, averageSpeed = 30) {
    const timeInHours = distance / averageSpeed;
    return Math.round(timeInHours * 60); // Convert to minutes
  }

  /**
   * Check if a location is within a certain radius of another location
   * @param {number} lat1 - First latitude
   * @param {number} lng1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lng2 - Second longitude
   * @param {number} radiusKm - Radius in kilometers
   * @returns {boolean} - True if within radius
   */
  static isWithinRadius(lat1, lng1, lat2, lng2, radiusKm) {
    const distance = this.calculateDistance(lat1, lng1, lat2, lng2);
    return distance <= radiusKm;
  }

  /**
   * Get bounding box for a center point and radius
   * @param {number} lat - Center latitude
   * @param {number} lng - Center longitude
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Object} - Bounding box coordinates
   */
  static getBoundingBox(lat, lng, radiusKm) {
    const latDelta = radiusKm / 111.32; // Approximate degrees per km at equator
    const lngDelta = radiusKm / (111.32 * Math.cos(this.deg2rad(lat)));
    
    return {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lng + lngDelta,
      west: lng - lngDelta
    };
  }
}

module.exports = OSMService;
