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
 * @deprecated For business "today" use getPhilippinesMidnight() instead.
 * @returns {Date} UTC midnight Date object (server-local; for PH use getPhilippinesMidnight())
 */
function getTodayUTCMidnight() {
  return getUTCMidnight();
}

/**
 * Get midnight in Philippines timezone (Asia/Manila, UTC+8) for a given date.
 * ✅ USE THIS FOR ALL BUSINESS "TODAY" - DeviceTracking, archive, analytics, ads.
 *
 * @param {Date} date - Optional date, defaults to now
 * @returns {Date} Date object at midnight Philippines (as UTC instant)
 */
function getPhilippinesMidnight(date = new Date()) {
  const phOffsetMs = 8 * 60 * 60 * 1000; // UTC+8 in ms
  const phTime = new Date(date.getTime() + phOffsetMs);
  phTime.setUTCHours(0, 0, 0, 0);
  return new Date(phTime.getTime() - phOffsetMs);
}

/**
 * Get today's date string (YYYY-MM-DD) in Philippines timezone.
 * Use for storage and display - always returns the PH calendar date (e.g. "2026-01-29").
 *
 * @param {Date} date - Optional date, defaults to now
 * @returns {string} YYYY-MM-DD (Philippines calendar date)
 */
function getPhilippinesDateString(date = new Date()) {
  const phCal = new Date(date.getTime() + 8 * 60 * 60 * 1000); // +8h so UTC components = PH date
  return formatDateString(phCal);
}

/**
 * Normalize any value (Date or YYYY-MM-DD string) to Philippines date string.
 * Use when reading DeviceTracking.date which may be legacy Date or new string.
 *
 * @param {Date|string} val - Date object or "YYYY-MM-DD" string
 * @returns {string} YYYY-MM-DD (Philippines)
 */
function toPhilippinesDateString(val) {
  if (!val) return getPhilippinesDateString();
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return getPhilippinesDateString(new Date(val));
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
  getPhilippinesMidnight,
  getPhilippinesDateString,
  toPhilippinesDateString,
  isSameDay,
  normalizeToUTCMidnight,
  isToday,
  formatDateString
};

