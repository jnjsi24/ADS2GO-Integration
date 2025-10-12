/**
 * Comprehensive GPS Validation and Data Cleaning Utility
 * Combines real-time validation with advanced data analysis and cleaning
 */

const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ============================================================================
// REAL-TIME GPS VALIDATION (Fast, lightweight)
// ============================================================================

/**
 * Basic GPS coordinate validation for real-time updates
 */
const validateCoordinates = (lat, lng) => {
  const errors = [];
  const warnings = [];
  let isValid = true;

  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    errors.push('Coordinates must be valid numbers');
    isValid = false;
  }

  if (lat === 0 && lng === 0) {
    errors.push('Coordinates cannot be [0,0] (GPS initialization issue)');
    isValid = false;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push('Coordinates out of valid GPS range (-90 to 90 lat, -180 to 180 lng)');
    isValid = false;
  }

  // Philippines region check (approximate bounds)
  const PHILIPPINES_LAT_MIN = 4.5;
  const PHILIPPINES_LAT_MAX = 21.1;
  const PHILIPPINES_LNG_MIN = 116.9;
  const PHILIPPINES_LNG_MAX = 126.6;

  if (isValid && (lat < PHILIPPINES_LAT_MIN || lat > PHILIPPINES_LAT_MAX || lng < PHILIPPINES_LNG_MIN || lng > PHILIPPINES_LNG_MAX)) {
    warnings.push(`Coordinates [${lat}, ${lng}] outside typical Philippines region`);
  }

  return { isValid, errors, warnings };
};

/**
 * Basic GPS accuracy validation for real-time updates
 */
const validateAccuracy = (accuracy) => {
  if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0) {
    return { isValid: false, message: 'Accuracy must be a non-negative number' };
  }
  if (accuracy > 100) {
    return { isValid: false, message: `Accuracy (${accuracy}m) is too poor (>100m)` };
  }
  return { isValid: true, message: 'Accuracy is acceptable' };
};

/**
 * Basic speed validation for real-time updates
 */
const validateSpeed = (speed) => {
  if (typeof speed !== 'number' || isNaN(speed) || speed < 0) {
    return { isValid: false, message: 'Speed must be a non-negative number' };
  }
  if (speed > 200) { // Example max speed for a car
    return { isValid: false, message: `Speed (${speed} km/h) is unrealistically high (>200 km/h)` };
  }
  return { isValid: true, message: 'Speed is acceptable' };
};

/**
 * Determine if location update should be accepted (real-time)
 */
const shouldAcceptLocationUpdate = (currentLocation, newLocation) => {
  // Always accept if no current location
  if (!currentLocation) {
    return { accept: true, reason: 'No current location' };
  }

  // Update if this is a more accurate reading (lower accuracy number = better)
  if (newLocation.accuracy < (currentLocation.accuracy || Infinity)) {
    return { accept: true, reason: `More accurate reading (${newLocation.accuracy}m vs ${currentLocation.accuracy}m)` };
  }

  // Update if this is a significantly newer timestamp (e.g., > 30 seconds)
  const timeDiff = (new Date(newLocation.timestamp).getTime() - new Date(currentLocation.timestamp).getTime()) / 1000; // seconds
  if (timeDiff > 30) {
    return { accept: true, reason: `Significantly newer timestamp (${timeDiff}s difference)` };
  }

  // Update if location has moved significantly (e.g., > 10 meters)
  const distance = calculateDistance(
    currentLocation.coordinates[1], currentLocation.coordinates[0],
    newLocation.coordinates[1], newLocation.coordinates[0]
  );
  if (distance * 1000 > 10) { // Convert km to meters
    return { accept: true, reason: `Significant movement detected (${(distance * 1000).toFixed(1)}m)` };
  }

  return { accept: false, reason: 'Movement too small, accuracy not improved, and not significantly newer' };
};

// ============================================================================
// ADVANCED GPS VALIDATION (Comprehensive analysis and cleaning)
// ============================================================================

/**
 * Advanced GPS coordinate validation with multiple accuracy levels
 */
const validateCoordinatesAdvanced = (lat, lng, options = {}) => {
  const {
    strictMode = false,
    maxAccuracy = 50, // meters
    minAccuracy = 1,  // meters
    requirePhilippinesBounds = true
  } = options;

  const errors = [];
  const warnings = [];
  let isValid = true;
  let accuracyScore = 100; // 0-100, higher is better

  // Basic validation
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    errors.push('Coordinates must be valid numbers');
    isValid = false;
    accuracyScore = 0;
  }

  // Check for [0,0] coordinates
  if (lat === 0 && lng === 0) {
    errors.push('Coordinates cannot be [0,0] (GPS initialization issue)');
    isValid = false;
    accuracyScore = 0;
  }

  // Check coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push('Coordinates out of valid GPS range (-90 to 90 lat, -180 to 180 lng)');
    isValid = false;
    accuracyScore = 0;
  }

  // Philippines region validation
  if (isValid && requirePhilippinesBounds) {
    const PHILIPPINES_LAT_MIN = 4.5;
    const PHILIPPINES_LAT_MAX = 21.1;
    const PHILIPPINES_LNG_MIN = 116.9;
    const PHILIPPINES_LNG_MAX = 126.6;

    if (lat < PHILIPPINES_LAT_MIN || lat > PHILIPPINES_LAT_MAX || 
        lng < PHILIPPINES_LNG_MIN || lng > PHILIPPINES_LNG_MAX) {
      if (strictMode) {
        errors.push(`Coordinates [${lat}, ${lng}] outside Philippines region`);
        isValid = false;
        accuracyScore = 0;
      } else {
        warnings.push(`Coordinates [${lat}, ${lng}] outside typical Philippines region`);
        accuracyScore = Math.max(0, accuracyScore - 30);
      }
    }
  }

  return { isValid, errors, warnings, accuracyScore };
};

/**
 * Advanced GPS accuracy validation with multiple thresholds
 */
const validateAccuracyAdvanced = (accuracy, options = {}) => {
  const {
    maxAccuracy = 50,    // meters
    minAccuracy = 1,     // meters
    strictMode = false
  } = options;

  if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0) {
    return { 
      isValid: false, 
      message: 'Accuracy must be a non-negative number',
      accuracyScore: 0
    };
  }

  let accuracyScore = 100;
  let isValid = true;
  let message = 'Accuracy is acceptable';

  if (accuracy > maxAccuracy) {
    if (strictMode) {
      isValid = false;
      message = `Accuracy (${accuracy}m) exceeds maximum allowed (${maxAccuracy}m)`;
      accuracyScore = 0;
    } else {
      message = `Accuracy (${accuracy}m) is poor but acceptable`;
      accuracyScore = Math.max(0, 100 - (accuracy - maxAccuracy) * 2);
    }
  } else if (accuracy < minAccuracy) {
    message = `Accuracy (${accuracy}m) is suspiciously good`;
    accuracyScore = 80; // Still good but worth noting
  } else if (accuracy <= 10) {
    message = `Accuracy (${accuracy}m) is excellent`;
    accuracyScore = 100;
  } else if (accuracy <= 25) {
    message = `Accuracy (${accuracy}m) is very good`;
    accuracyScore = 90;
  } else {
    message = `Accuracy (${accuracy}m) is good`;
    accuracyScore = 75;
  }

  return { isValid, message, accuracyScore };
};

/**
 * Detect GPS drift and impossible movements
 */
const detectGPSDrift = (currentPoint, previousPoint, options = {}) => {
  const {
    maxSpeed = 200,        // km/h
    maxAcceleration = 50,  // m/s²
    minTimeInterval = 1    // seconds
  } = options;

  if (!previousPoint) {
    return { isDrift: false, reason: 'No previous point' };
  }

  const distance = calculateDistance(
    previousPoint.coordinates[1], previousPoint.coordinates[0],
    currentPoint.coordinates[1], currentPoint.coordinates[0]
  );

  const timeDiff = (new Date(currentPoint.timestamp) - new Date(previousPoint.timestamp)) / 1000; // seconds

  if (timeDiff < minTimeInterval) {
    return { isDrift: true, reason: 'Time interval too short' };
  }

  const speed = (distance / timeDiff) * 3600; // km/h
  const acceleration = Math.abs(currentPoint.speed - previousPoint.speed) / timeDiff; // m/s²

  if (speed > maxSpeed) {
    return { isDrift: true, reason: `Impossible speed: ${speed.toFixed(1)} km/h` };
  }

  if (acceleration > maxAcceleration) {
    return { isDrift: true, reason: `Impossible acceleration: ${acceleration.toFixed(1)} m/s²` };
  }

  return { isDrift: false, reason: 'Movement is valid', speed, acceleration };
};

/**
 * Clean GPS data by removing invalid and inaccurate points
 */
const cleanGPSData = (locationHistory, options = {}) => {
  const {
    strictMode = false,
    maxAccuracy = 50,
    minAccuracy = 1,
    requirePhilippinesBounds = true,
    removeDrift = true,
    maxSpeed = 200
  } = options;

  console.log(`🧹 [GPS Cleaner] Starting data cleaning with ${locationHistory.length} points`);

  const cleanedData = [];
  let removedCount = 0;
  let driftCount = 0;

  for (let i = 0; i < locationHistory.length; i++) {
    const point = locationHistory[i];
    const lat = point.coordinates[1];
    const lng = point.coordinates[0];

    // Validate coordinates
    const coordValidation = validateCoordinatesAdvanced(lat, lng, {
      strictMode,
      requirePhilippinesBounds
    });

    if (!coordValidation.isValid) {
      console.log(`❌ [GPS Cleaner] Removing invalid coordinates: [${lat}, ${lng}] - ${coordValidation.errors.join(', ')}`);
      removedCount++;
      continue;
    }

    // Validate accuracy
    const accuracyValidation = validateAccuracyAdvanced(point.accuracy, {
      maxAccuracy,
      minAccuracy,
      strictMode
    });

    if (!accuracyValidation.isValid) {
      console.log(`❌ [GPS Cleaner] Removing poor accuracy: ${point.accuracy}m - ${accuracyValidation.message}`);
      removedCount++;
      continue;
    }

    // Check for GPS drift
    if (removeDrift && i > 0) {
      const driftCheck = detectGPSDrift(point, locationHistory[i - 1], { maxSpeed });
      if (driftCheck.isDrift) {
        console.log(`❌ [GPS Cleaner] Removing GPS drift: ${driftCheck.reason}`);
        driftCount++;
        continue;
      }
    }

    // Point passed all validations
    cleanedData.push(point);
  }

  console.log(`✅ [GPS Cleaner] Cleaning complete:`);
  console.log(`  - Original points: ${locationHistory.length}`);
  console.log(`  - Cleaned points: ${cleanedData.length}`);
  console.log(`  - Removed invalid: ${removedCount}`);
  console.log(`  - Removed drift: ${driftCount}`);
  console.log(`  - Data quality: ${((cleanedData.length / locationHistory.length) * 100).toFixed(1)}%`);

  return cleanedData;
};

/**
 * Calculate overall GPS data quality score
 */
const calculateDataQuality = (locationHistory) => {
  if (!locationHistory || locationHistory.length === 0) {
    return { score: 0, message: 'No data available' };
  }

  let totalScore = 0;
  let validPoints = 0;

  for (let i = 0; i < locationHistory.length; i++) {
    const point = locationHistory[i];
    const lat = point.coordinates[1];
    const lng = point.coordinates[0];

    // Coordinate validation
    const coordValidation = validateCoordinatesAdvanced(lat, lng);
    if (!coordValidation.isValid) continue;

    // Accuracy validation
    const accuracyValidation = validateAccuracyAdvanced(point.accuracy);
    if (!accuracyValidation.isValid) continue;

    // Calculate point score
    const pointScore = (coordValidation.accuracyScore + accuracyValidation.accuracyScore) / 2;
    totalScore += pointScore;
    validPoints++;
  }

  const averageScore = validPoints > 0 ? totalScore / validPoints : 0;
  const dataQuality = (validPoints / locationHistory.length) * 100;

  let message = 'Excellent GPS data quality';
  if (averageScore < 50) message = 'Poor GPS data quality';
  else if (averageScore < 70) message = 'Fair GPS data quality';
  else if (averageScore < 85) message = 'Good GPS data quality';

  return {
    score: Math.round(averageScore),
    dataQuality: Math.round(dataQuality),
    validPoints,
    totalPoints: locationHistory.length,
    message
  };
};

/**
 * Smooth GPS data using moving average filter
 * This reduces GPS noise and creates smoother route lines
 */
const smoothGPSData = (locationHistory, options = {}) => {
  const {
    windowSize = 5,           // Number of points to average (must be odd)
    smoothSpeed = true,       // Whether to smooth speed values
    smoothHeading = true,     // Whether to smooth heading values
    preserveTimestamps = true // Keep original timestamps
  } = options;

  if (!locationHistory || locationHistory.length < 3) {
    return locationHistory; // Not enough points to smooth
  }

  // Ensure window size is odd
  const window = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const halfWindow = Math.floor(window / 2);

  console.log(`🎨 [GPS Smoother] Smoothing ${locationHistory.length} points with window size ${window}`);

  const smoothedData = [];

  for (let i = 0; i < locationHistory.length; i++) {
    const point = locationHistory[i];
    
    // For points near the edges, use smaller window
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(locationHistory.length - 1, i + halfWindow);
    const pointsToAverage = locationHistory.slice(start, end + 1);
    
    // Calculate weighted moving average for coordinates
    // Points closer to center get higher weight
    let sumLat = 0;
    let sumLng = 0;
    let sumSpeed = 0;
    let sumHeading = 0;
    let totalWeight = 0;
    
    pointsToAverage.forEach((p, idx) => {
      // Gaussian-like weight: higher in center, lower at edges
      const distance = Math.abs(idx - (pointsToAverage.length - 1) / 2);
      const weight = Math.exp(-distance * distance / (halfWindow * halfWindow));
      
      sumLat += p.coordinates[1] * weight;
      sumLng += p.coordinates[0] * weight;
      sumSpeed += (p.speed || 0) * weight;
      sumHeading += (p.heading || 0) * weight;
      totalWeight += weight;
    });
    
    const avgLat = sumLat / totalWeight;
    const avgLng = sumLng / totalWeight;
    const avgSpeed = smoothSpeed ? sumSpeed / totalWeight : point.speed;
    const avgHeading = smoothHeading ? sumHeading / totalWeight : point.heading;
    
    // Create smoothed point
    smoothedData.push({
      type: point.type || 'Point',
      coordinates: [avgLng, avgLat],
      accuracy: point.accuracy,
      altitude: point.altitude,
      speed: avgSpeed,
      heading: avgHeading,
      timestamp: point.timestamp,
      address: point.address || ''
    });
  }

  console.log(`✅ [GPS Smoother] Smoothing complete - ${smoothedData.length} points processed`);
  
  return smoothedData;
};

/**
 * Apply Kalman-like filter for more advanced smoothing
 * This is particularly good for removing GPS jitter while maintaining route shape
 */
const kalmanFilterGPS = (locationHistory, options = {}) => {
  const {
    processNoise = 0.001,     // How much we expect the position to change
    measurementNoise = 0.01,  // GPS measurement uncertainty
    estimationError = 1       // Initial estimation error
  } = options;

  if (!locationHistory || locationHistory.length < 2) {
    return locationHistory;
  }

  console.log(`🔬 [Kalman Filter] Filtering ${locationHistory.length} points`);

  const filteredData = [];
  
  // Initialize state for latitude and longitude
  let latEstimate = locationHistory[0].coordinates[1];
  let lngEstimate = locationHistory[0].coordinates[0];
  let latError = estimationError;
  let lngError = estimationError;
  
  for (let i = 0; i < locationHistory.length; i++) {
    const point = locationHistory[i];
    const measuredLat = point.coordinates[1];
    const measuredLng = point.coordinates[0];
    
    // Kalman gain calculation
    const latKalmanGain = latError / (latError + measurementNoise);
    const lngKalmanGain = lngError / (lngError + measurementNoise);
    
    // Update estimate
    latEstimate = latEstimate + latKalmanGain * (measuredLat - latEstimate);
    lngEstimate = lngEstimate + lngKalmanGain * (measuredLng - lngEstimate);
    
    // Update error
    latError = (1 - latKalmanGain) * latError + processNoise;
    lngError = (1 - lngKalmanGain) * lngError + processNoise;
    
    // Create filtered point
    filteredData.push({
      type: point.type || 'Point',
      coordinates: [lngEstimate, latEstimate],
      accuracy: point.accuracy,
      altitude: point.altitude,
      speed: point.speed,
      heading: point.heading,
      timestamp: point.timestamp,
      address: point.address || ''
    });
  }

  console.log(`✅ [Kalman Filter] Filtering complete - ${filteredData.length} points processed`);
  
  return filteredData;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Real-time validation (fast)
  calculateDistance,
  validateCoordinates,
  validateAccuracy,
  validateSpeed,
  shouldAcceptLocationUpdate,
  
  // Advanced validation (comprehensive)
  validateCoordinatesAdvanced,
  validateAccuracyAdvanced,
  detectGPSDrift,
  cleanGPSData,
  calculateDataQuality,
  
  // GPS smoothing and filtering
  smoothGPSData,
  kalmanFilterGPS
};