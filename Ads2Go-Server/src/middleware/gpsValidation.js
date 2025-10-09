/**
 * GPS Validation Middleware
 * Validates GPS coordinates and quality before processing location updates
 */

const GPSValidation = require('../utils/gpsValidation');

/**
 * Middleware to validate GPS coordinates in request body
 */
const validateGPSData = (req, res, next) => {
  const { lat, lng, accuracy, speed } = req.body;

  // Check if GPS data is present
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({
      success: false,
      message: 'GPS coordinates (lat, lng) are required',
      error: 'MISSING_COORDINATES'
    });
  }

  // Validate coordinates
  const coordValidation = GPSValidation.validateCoordinates(lat, lng);
  if (!coordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid GPS coordinates',
      error: 'INVALID_COORDINATES',
      details: coordValidation.errors,
      warnings: coordValidation.warnings
    });
  }

  // Validate accuracy if provided
  if (accuracy !== undefined) {
    const accuracyValidation = GPSValidation.validateAccuracy(accuracy);
    if (!accuracyValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS accuracy',
        error: 'INVALID_ACCURACY',
        details: accuracyValidation.message
      });
    }
  }

  // Validate speed if provided
  if (speed !== undefined) {
    const speedValidation = GPSValidation.validateSpeed(speed);
    if (!speedValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid speed value',
        error: 'INVALID_SPEED',
        details: speedValidation.message
      });
    }
  }

  // Add validation results to request for logging
  req.gpsValidation = {
    coordinates: coordValidation,
    accuracy: accuracy !== undefined ? GPSValidation.validateAccuracy(accuracy) : null,
    speed: speed !== undefined ? GPSValidation.validateSpeed(speed) : null
  };

  // Log warnings if any
  if (coordValidation.warnings.length > 0) {
    console.log(`📍 [GPS Middleware] Warnings for ${req.body.materialId || 'unknown'}: ${coordValidation.warnings.join(', ')}`);
  }

  next();
};

/**
 * Middleware to validate location point objects
 */
const validateLocationPoint = (req, res, next) => {
  const { location } = req.body;

  if (!location || !location.coordinates) {
    return res.status(400).json({
      success: false,
      message: 'Location point with coordinates is required',
      error: 'MISSING_LOCATION_DATA'
    });
  }

  const validation = GPSValidation.validateLocationPoint(location);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location point data',
      error: 'INVALID_LOCATION_POINT',
      details: validation.errors,
      warnings: validation.warnings
    });
  }

  // Add validation results to request
  req.locationValidation = validation;

  next();
};

/**
 * Middleware to log GPS quality metrics
 */
const logGPSQuality = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log GPS quality metrics if available
    if (req.gpsValidation) {
      const { coordinates, accuracy, speed } = req.gpsValidation;
      
      console.log(`📍 [GPS Quality] ${req.body.materialId || 'unknown'}:`, {
        coordinates: coordinates.quality,
        accuracy: accuracy ? accuracy.quality : 'not_provided',
        speed: speed ? speed.quality : 'not_provided',
        warnings: coordinates.warnings.length
      });
    }

    // Call original send
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to enforce GPS quality thresholds
 */
const enforceQualityThresholds = (thresholds = {}) => {
  const defaultThresholds = {
    minAccuracy: 100, // meters
    maxSpeed: 200,    // km/h
    requirePhilippinesBounds: true
  };

  const config = { ...defaultThresholds, ...thresholds };

  return (req, res, next) => {
    const { lat, lng, accuracy, speed } = req.body;

    // Check accuracy threshold
    if (accuracy !== undefined && accuracy > config.minAccuracy) {
      return res.status(400).json({
        success: false,
        message: `GPS accuracy ${accuracy}m exceeds maximum allowed ${config.minAccuracy}m`,
        error: 'ACCURACY_THRESHOLD_EXCEEDED'
      });
    }

    // Check speed threshold
    if (speed !== undefined && speed > config.maxSpeed) {
      return res.status(400).json({
        success: false,
        message: `Speed ${speed} km/h exceeds maximum allowed ${config.maxSpeed} km/h`,
        error: 'SPEED_THRESHOLD_EXCEEDED'
      });
    }

    // Check Philippines bounds if required
    if (config.requirePhilippinesBounds) {
      const coordValidation = GPSValidation.validateCoordinates(lat, lng);
      if (coordValidation.warnings.some(w => w.includes('outside Philippines region'))) {
        return res.status(400).json({
          success: false,
          message: 'Coordinates are outside Philippines region',
          error: 'OUTSIDE_PHILIPPINES_BOUNDS',
          warnings: coordValidation.warnings
        });
      }
    }

    next();
  };
};

/**
 * Middleware to rate limit GPS updates based on quality
 */
const rateLimitByQuality = (options = {}) => {
  const defaultOptions = {
    maxUpdatesPerMinute: 60,
    qualityMultiplier: {
      excellent: 1.0,
      good: 0.8,
      fair: 0.6,
      poor: 0.4,
      unacceptable: 0.2
    }
  };

  const config = { ...defaultOptions, ...options };
  const updateCounts = new Map();

  return (req, res, next) => {
    const deviceId = req.body.materialId || req.body.deviceId;
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);

    if (!deviceId) {
      return next();
    }

    // Get current quality
    let quality = 'good'; // default
    if (req.gpsValidation) {
      quality = req.gpsValidation.coordinates.quality;
    }

    // Calculate rate limit based on quality
    const qualityMultiplier = config.qualityMultiplier[quality] || 0.5;
    const maxUpdates = Math.floor(config.maxUpdatesPerMinute * qualityMultiplier);

    // Check current count
    const key = `${deviceId}-${minuteKey}`;
    const currentCount = updateCounts.get(key) || 0;

    if (currentCount >= maxUpdates) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for device ${deviceId} (${quality} quality: ${maxUpdates} updates/minute)`,
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      });
    }

    // Update count
    updateCounts.set(key, currentCount + 1);

    // Clean up old entries
    if (updateCounts.size > 1000) {
      const cutoff = minuteKey - 10; // Keep last 10 minutes
      for (const [key, value] of updateCounts.entries()) {
        const keyMinute = parseInt(key.split('-').pop());
        if (keyMinute < cutoff) {
          updateCounts.delete(key);
        }
      }
    }

    next();
  };
};

module.exports = {
  validateGPSData,
  validateLocationPoint,
  logGPSQuality,
  enforceQualityThresholds,
  rateLimitByQuality
};
