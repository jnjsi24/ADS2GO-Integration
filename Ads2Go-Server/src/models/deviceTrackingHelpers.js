/**
 * Device Tracking Helper Functions
 * Centralized logic for device tracking operations to prevent conflicts
 */

const { getPhilippinesDateString, toPhilippinesDateString } = require('../utils/dateUtils');

/**
 * ✅ CENTRALIZED: Set startTime when device comes online
 * This is the ONLY place where startTime should be set from sentinel
 * 
 * @param {Object} device - Device tracking document
 * @returns {boolean} True if startTime was set
 */
function setStartTimeIfNeeded(device) {
  if (!device || !device.currentSession) return false;
  
  const now = new Date();
  const startTime = device.currentSession.startTime ? new Date(device.currentSession.startTime) : null;
  const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
  
  // Check if startTime is sentinel value (far future) or not set
  if (!startTime || startTime > oneYearFromNow) {
    device.currentSession.startTime = now;
    device.currentSession.lastOnlineUpdate = now;
    console.log(`⏰ [setStartTimeIfNeeded] ${device.materialId}: Starting session at ${now.toISOString()}`);
    return true;
  }
  
  return false;
}

/**
 * ✅ CENTRALIZED: Sync device.date and currentSession.date (Philippines YYYY-MM-DD only)
 * 
 * @param {Object} device - Device tracking document
 * @param {string|Date} date - Philippines date string "YYYY-MM-DD" or Date (converted to PH string)
 */
function syncDeviceDates(device, date = null) {
  const targetStr = !date
    ? getPhilippinesDateString()
    : typeof date === 'string' ? date : getPhilippinesDateString(date);
  
  device.date = targetStr;
  if (device.currentSession) {
    device.currentSession.date = targetStr;
  }
  
  console.log(`📅 [syncDeviceDates] ${device.materialId}: Synced dates to ${targetStr} (PH)`);
}

/**
 * ✅ CENTRALIZED: Check if device needs daily reset
 * Compares dates properly
 * 
 * @param {Object} device - Device tracking document
 * @returns {boolean} True if reset is needed
 */
function needsDailyReset(device) {
  if (!device || !device.currentSession || !device.currentSession.date) {
    return true;
  }
  
  const todayStr = getPhilippinesDateString();
  const sessionDateStr = toPhilippinesDateString(device.currentSession.date);
  
  return sessionDateStr !== todayStr;
}

/**
 * ✅ CENTRALIZED: Validate totalHoursOnline value
 * Ensures hours are within valid range
 * 
 * @param {number} hours - Hours to validate
 * @returns {number} Validated hours (clamped to 0-8)
 */
function validateHours(hours) {
  if (typeof hours !== 'number' || isNaN(hours)) {
    console.warn(`⚠️ [validateHours] Invalid hours value: ${hours}, defaulting to 0`);
    return 0;
  }
  
  if (hours < 0) {
    console.warn(`⚠️ [validateHours] Negative hours: ${hours}, clamping to 0`);
    return 0;
  }
  
  if (hours > 8) {
    console.warn(`⚠️ [validateHours] Hours exceed 8: ${hours}, capping at 8`);
    return 8;
  }
  
  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

/**
 * ✅ CENTRALIZED: Update totalHoursOnline from session
 * This is the ONLY way to update device-level totalHoursOnline
 * 
 * @param {Object} device - Device tracking document
 */
function syncHoursFromSession(device) {
  if (!device || !device.currentSession) return;
  
  const sessionHours = validateHours(device.currentSession.totalHoursOnline || 0);
  device.totalHoursOnline = sessionHours;
  device.averageDailyHours = sessionHours;
  
  // Update compliance rate
  device.complianceRate = sessionHours >= 8 ? 100 : 0;
}

module.exports = {
  setStartTimeIfNeeded,
  syncDeviceDates,
  needsDailyReset,
  validateHours,
  syncHoursFromSession
};

