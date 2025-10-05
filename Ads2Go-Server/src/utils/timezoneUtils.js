/**
 * Timezone utilities for consistent time handling across the system
 */

class TimezoneUtils {
  /**
   * Get device timezone from location or default to server timezone
   * @param {Object} location - GPS location with coordinates
   * @returns {string} Timezone identifier (e.g., 'Asia/Manila')
   */
  static getDeviceTimezone(location) {
    if (!location || !location.coordinates) {
      return 'Asia/Manila'; // Default to Philippines timezone
    }
    
    // Simple timezone mapping based on coordinates
    const { coordinates } = location;
    const [lng, lat] = coordinates;
    
    // Philippines timezone
    if (lat >= 4.0 && lat <= 21.0 && lng >= 116.0 && lng <= 127.0) {
      return 'Asia/Manila';
    }
    
    // Add more timezone mappings as needed
    return 'Asia/Manila'; // Default fallback
  }
  
  /**
   * Get start of day in device timezone
   * @param {Date} date - Date to get start of day for
   * @param {string} timezone - Device timezone
   * @returns {Date} Start of day in device timezone
   */
  static getStartOfDayInTimezone(date, timezone = 'Asia/Manila') {
    // For Philippines timezone, we can use simple UTC+8 calculation
    // In production, use a library like moment-timezone or date-fns-tz
    const utcDate = new Date(date);
    const philippinesOffset = 8 * 60; // UTC+8 in minutes
    const localOffset = utcDate.getTimezoneOffset(); // Server timezone offset
    const totalOffset = philippinesOffset + localOffset;
    
    const philippinesDate = new Date(utcDate.getTime() + (totalOffset * 60 * 1000));
    philippinesDate.setHours(0, 0, 0, 0);
    return philippinesDate;
  }
  
  /**
   * Check if it's a new day in device timezone
   * @param {Date} lastDate - Last recorded date
   * @param {Date} currentDate - Current date
   * @param {string} timezone - Device timezone
   * @returns {boolean} True if it's a new day
   */
  static isNewDayInTimezone(lastDate, currentDate, timezone = 'Asia/Manila') {
    const lastDay = this.getStartOfDayInTimezone(lastDate, timezone);
    const currentDay = this.getStartOfDayInTimezone(currentDate, timezone);
    return lastDay.getTime() !== currentDay.getTime();
  }
  
  /**
   * Calculate hours between two dates in device timezone
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} timezone - Device timezone
   * @returns {number} Hours difference
   */
  static calculateHoursInTimezone(startDate, endDate, timezone = 'Asia/Manila') {
    // Simple calculation for Philippines timezone
    // In production, use proper timezone library
    return (endDate - startDate) / (1000 * 60 * 60);
  }
  
  /**
   * Get current time in device timezone
   * @param {string} timezone - Device timezone
   * @returns {Date} Current time in device timezone
   */
  static getCurrentTimeInTimezone(timezone = 'Asia/Manila') {
    const now = new Date();
    const utcDate = new Date(now);
    const philippinesOffset = 8 * 60; // UTC+8 in minutes
    const localOffset = utcDate.getTimezoneOffset(); // Server timezone offset
    const totalOffset = philippinesOffset + localOffset;
    
    return new Date(utcDate.getTime() + (totalOffset * 60 * 1000));
  }
}

module.exports = TimezoneUtils;
