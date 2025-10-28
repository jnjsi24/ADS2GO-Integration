/**
 * Date utilities for consistent date handling across the system
 * ✅ STANDARDIZED: All dates stored as UTC midnight Date objects
 */

/**
 * Get UTC midnight for a given date (or today if not provided)
 * This ensures dates are stored consistently without timezone confusion
 * ✅ THIS IS THE STANDARD FORMAT FOR ALL DEVICE TRACKING DATES
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
 * Get today's date in Philippines timezone as UTC midnight
 * Useful for display purposes, but still returns UTC midnight Date
 * 
 * @returns {Date} UTC midnight Date object (representing today in PH timezone)
 */
function getTodayUTCMidnight() {
  return getUTCMidnight();
}

/**
 * Check if two dates are the same day (ignoring time)
 * Works with UTC midnight dates or any Date objects
 * 
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @param {string} timezone - Optional timezone (defaults to UTC comparison)
 * @returns {boolean} True if same day
 */
function isSameDay(date1, date2, timezone = 'UTC') {
  if (!date1 || !date2) return false;
  
  // Convert to UTC midnight for consistent comparison
  const d1 = getUTCMidnight(new Date(date1));
  const d2 = getUTCMidnight(new Date(date2));
  
  return d1.getTime() === d2.getTime();
}

/**
 * Normalize a date to UTC midnight format
 * Handles both Date objects and date strings
 * 
 * @param {Date|string} date - Date to normalize
 * @returns {Date} UTC midnight Date object
 */
function normalizeToUTCMidnight(date) {
  if (!date) return getUTCMidnight();
  return getUTCMidnight(new Date(date));
}

/**
 * Check if a date is today (in UTC)
 * 
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
function isToday(date) {
  if (!date) return false;
  return isSameDay(new Date(date), new Date());
}

/**
 * Format date for display (YYYY-MM-DD string)
 * Note: This is for display only. Storage should use UTC midnight Date objects.
 * 
 * @param {Date} date - Date to format
 * @returns {string} YYYY-MM-DD format
 */
function formatDateString(date) {
  if (!date) date = new Date();
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  getUTCMidnight,
  getTodayUTCMidnight,
  isSameDay,
  normalizeToUTCMidnight,
  isToday,
  formatDateString
};

