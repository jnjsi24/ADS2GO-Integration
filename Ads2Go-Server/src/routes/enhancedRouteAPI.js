const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const GPSValidation = require('../utils/gpsValidation');

/**
 * Enhanced Route API for Strava-style GPS tracking visualization
 * Provides comprehensive route data with speed-based color coding
 */

// GET /enhancedRoute/route/:materialId - Get enhanced route data for Strava-style mapping
router.get('/route/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { date, startDate, endDate, includeMetrics = true, includeSpeedSegments = true } = req.query;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: materialId'
      });
    }

    console.log(`🗺️ [Enhanced Route API] Fetching route for material: ${materialId}, date: ${date}`);

    // Build query for DeviceDataHistoryV2
    let query = { materialId };
    
    // Filter by date range
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query['dailyData.date'] = {
        $gte: targetDate,
        $lt: nextDay
      };
    } else if (startDate && endDate) {
      query['dailyData.date'] = {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      };
    }

    // Find device data
    const deviceData = await DeviceDataHistoryV2.findOne(query);
    
    if (!deviceData) {
      return res.status(404).json({
        success: false,
        message: 'No device data found for the specified material and date range'
      });
    }

    // Extract and process location history
    let allLocationPoints = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalAdPlays = 0;
    let totalQRScans = 0;
    let totalHoursOnline = 0;

    // Process daily data
    deviceData.dailyData.forEach(dailyRecord => {
      if (dailyRecord.locationHistory && dailyRecord.locationHistory.length > 0) {
        // Use advanced GPS cleaning for better accuracy
        const cleanedPoints = GPSValidation.cleanGPSData(dailyRecord.locationHistory, {
          strictMode: false,
          maxAccuracy: 100, // Allow up to 100m accuracy
          minAccuracy: 1,
          requirePhilippinesBounds: true,
          removeDrift: true,
          maxSpeed: 200
        });

        allLocationPoints = allLocationPoints.concat(cleanedPoints);
        totalDistance += dailyRecord.totalDistanceTraveled || 0;
        totalAdPlays += dailyRecord.totalAdPlays || 0;
        totalQRScans += dailyRecord.totalQRScans || 0;
        totalHoursOnline += dailyRecord.totalHoursOnline || 0;
      }
    });

    if (allLocationPoints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid location data found for the specified date range'
      });
    }

    // Sort points by timestamp
    allLocationPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate duration
    if (allLocationPoints.length > 1) {
      const startTime = new Date(allLocationPoints[0].timestamp);
      const endTime = new Date(allLocationPoints[allLocationPoints.length - 1].timestamp);
      totalDuration = (endTime - startTime) / 1000; // seconds
    }

    // Create route points with enhanced data
    const routePoints = [];
    let cumulativeDistance = 0;

    allLocationPoints.forEach((point, index) => {
      const lat = point.coordinates[1];
      const lng = point.coordinates[0];
      
      // Calculate distance from previous point
      let segmentDistance = 0;
      if (index > 0) {
        const prevPoint = allLocationPoints[index - 1];
        segmentDistance = GPSValidation.calculateDistance(
          prevPoint.coordinates[1], prevPoint.coordinates[0],
          lat, lng
        );
        cumulativeDistance += segmentDistance;
      }

      routePoints.push({
        lat,
        lng,
        timestamp: point.timestamp,
        speed: point.speed || 0,
        heading: point.heading || 0,
        accuracy: point.accuracy || 0,
        address: point.address || '',
        altitude: point.altitude || 0,
        segmentDistance,
        cumulativeDistance,
        index
      });
    });

    // Calculate metrics
    const metrics = {
      totalDistance: totalDistance,
      totalDuration: totalDuration,
      averageSpeed: totalDuration > 0 ? (totalDistance / totalDuration) * 3600 : 0, // km/h
      maxSpeed: Math.max(...routePoints.map(p => p.speed)),
      totalAdPlays,
      totalQRScans,
      totalHoursOnline,
      pointCount: routePoints.length,
      startTime: routePoints[0]?.timestamp,
      endTime: routePoints[routePoints.length - 1]?.timestamp
    };

    // Create speed segments for color coding
    let speedSegments = [];
    if (includeSpeedSegments === 'true') {
      speedSegments = createSpeedSegments(routePoints);
    }

    // Create waypoints (significant points)
    const waypoints = createWaypoints(routePoints);

    // Calculate route bounds
    const bounds = calculateRouteBounds(routePoints);

    const responseData = {
      success: true,
      data: {
        materialId: deviceData.materialId,
        carGroupId: deviceData.carGroupId,
        deviceInfo: deviceData.deviceInfo,
        route: routePoints,
        speedSegments,
        waypoints,
        bounds,
        metrics: includeMetrics === 'true' ? metrics : undefined,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataSource: 'DeviceDataHistoryV2',
          totalDays: deviceData.dailyData.length,
          dateRange: {
            start: deviceData.dailyData[0]?.date,
            end: deviceData.dailyData[deviceData.dailyData.length - 1]?.date
          }
        }
      }
    };

    console.log(`✅ [Enhanced Route API] Generated route with ${routePoints.length} points, ${totalDistance.toFixed(2)}km distance`);

    res.json(responseData);

  } catch (error) {
    console.error('❌ [Enhanced Route API] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /enhancedRoute/materials - Get list of materials with route data
router.get('/materials', async (req, res) => {
  try {
    const materials = await DeviceDataHistoryV2.find({})
      .select('materialId carGroupId deviceInfo dailyData.date dailyData.totalDistanceTraveled dailyData.locationHistory')
      .lean();

    const materialsWithRouteData = materials.map(material => {
      const totalPoints = material.dailyData.reduce((sum, day) => 
        sum + (day.locationHistory ? day.locationHistory.length : 0), 0
      );
      
      const totalDistance = material.dailyData.reduce((sum, day) => 
        sum + (day.totalDistanceTraveled || 0), 0
      );

      const lastActivity = material.dailyData
        .filter(day => day.locationHistory && day.locationHistory.length > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        materialId: material.materialId,
        carGroupId: material.carGroupId,
        deviceInfo: material.deviceInfo,
        totalPoints,
        totalDistance,
        lastActivity: lastActivity?.date,
        hasRouteData: totalPoints > 0
      };
    }).filter(material => material.hasRouteData);

    res.json({
      success: true,
      data: materialsWithRouteData,
      count: materialsWithRouteData.length
    });

  } catch (error) {
    console.error('❌ [Enhanced Route API] Error fetching materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch materials',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to create speed segments for color coding
function createSpeedSegments(routePoints) {
  const segments = [];
  const speedThresholds = {
    stationary: 1,    // < 1 km/h
    slow: 5,          // 1-5 km/h
    moderate: 20,     // 5-20 km/h
    fast: 60,         // 20-60 km/h
    veryFast: 200     // > 60 km/h
  };

  for (let i = 0; i < routePoints.length - 1; i++) {
    const current = routePoints[i];
    const next = routePoints[i + 1];
    
    const avgSpeed = (current.speed + next.speed) / 2;
    let color = '#4CAF50'; // Default green
    let speedCategory = 'stationary';

    if (avgSpeed < speedThresholds.stationary) {
      color = '#9E9E9E'; // Gray
      speedCategory = 'stationary';
    } else if (avgSpeed < speedThresholds.slow) {
      color = '#4CAF50'; // Green
      speedCategory = 'slow';
    } else if (avgSpeed < speedThresholds.moderate) {
      color = '#FFC107'; // Yellow
      speedCategory = 'moderate';
    } else if (avgSpeed < speedThresholds.fast) {
      color = '#FF9800'; // Orange
      speedCategory = 'fast';
    } else {
      color = '#F44336'; // Red
      speedCategory = 'veryFast';
    }

    segments.push({
      start: [current.lat, current.lng],
      end: [next.lat, next.lng],
      color,
      speed: avgSpeed,
      speedCategory,
      distance: current.segmentDistance
    });
  }

  return segments;
}

// Helper function to create waypoints (significant points)
function createWaypoints(routePoints) {
  const waypoints = [];
  
  // Start point
  if (routePoints.length > 0) {
    waypoints.push({
      type: 'start',
      position: [routePoints[0].lat, routePoints[0].lng],
      timestamp: routePoints[0].timestamp,
      speed: routePoints[0].speed,
      address: routePoints[0].address
    });
  }

  // Speed change points (significant speed changes)
  for (let i = 1; i < routePoints.length - 1; i++) {
    const prev = routePoints[i - 1];
    const current = routePoints[i];
    const next = routePoints[i + 1];

    const speedChange = Math.abs(current.speed - prev.speed);
    if (speedChange > 10) { // Significant speed change
      waypoints.push({
        type: 'speed_change',
        position: [current.lat, current.lng],
        timestamp: current.timestamp,
        speed: current.speed,
        speedChange,
        address: current.address
      });
    }
  }

  // High accuracy points (good GPS readings)
  const highAccuracyPoints = routePoints
    .filter(point => point.accuracy < 10)
    .slice(0, 5); // Limit to 5 high accuracy points

  highAccuracyPoints.forEach(point => {
    waypoints.push({
      type: 'high_accuracy',
      position: [point.lat, point.lng],
      timestamp: point.timestamp,
      accuracy: point.accuracy,
      address: point.address
    });
  });

  // End point
  if (routePoints.length > 1) {
    const lastPoint = routePoints[routePoints.length - 1];
    waypoints.push({
      type: 'end',
      position: [lastPoint.lat, lastPoint.lng],
      timestamp: lastPoint.timestamp,
      speed: lastPoint.speed,
      address: lastPoint.address
    });
  }

  return waypoints;
}

// Helper function to calculate route bounds
function calculateRouteBounds(routePoints) {
  if (routePoints.length === 0) return null;

  const lats = routePoints.map(p => p.lat);
  const lngs = routePoints.map(p => p.lng);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
    center: [
      (Math.max(...lats) + Math.min(...lats)) / 2,
      (Math.max(...lngs) + Math.min(...lngs)) / 2
    ]
  };
}

module.exports = router;
