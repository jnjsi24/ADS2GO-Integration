/**
 * Date utilities for consistent date handling across the system
 */

/**
 * Get UTC midnight for a given date (or today if not provided)
 * This ensures dates are stored consistently without timezone confusion
 * 
 * @param {Date} date - Optional date, defaults to today
 * @returns {Date} Date object set to UTC midnight
 * 
 * @example
 * const today = getUTCMidnight();
 * // Returns: 2025-10-12T00:00:00.000Z (not 2025-10-11T16:00:00.000Z)
 */
function getUTCMidnight(date = new Date()) {
  return new Date(Date.UTC(
    date.getFullYear(), 
    date.getMonth(), 
    date.getDate(), 
    0, 0, 0, 0
  ));
}

/**
 * Check if two dates are the same day (ignoring time)
 * 
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
function isSameDay(date1, date2) {
  return date1.toDateString() === date2.toDateString();
}

module.exports = {
  getUTCMidnight,
  isSameDay
};

