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

    // Determine if the requested date is today (Philippines timezone)
    const now = new Date();
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const todayDate = philippinesTime.toISOString().split('T')[0];
    const isToday = date === todayDate;
    
    let allLocationPoints = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalAdPlays = 0;
    let totalQRScans = 0;
    let totalHoursOnline = 0;
    
    // ✅ TODAY'S DATE: Use real-time data for instant, up-to-date routes
    if (isToday && date) {
      console.log(`📍 [Enhanced Route API] Requesting TODAY's route - using real-time data`);
      
      try {
        const DeviceTracking = require('../models/deviceTracking');
        const deviceTracking = await DeviceTracking.findByMaterialId(materialId);
        
        console.log(`🔍 [Enhanced Route API] DeviceTracking lookup result:`, {
          found: !!deviceTracking,
          hasLocationHistory: deviceTracking?.locationHistory?.length > 0,
          locationCount: deviceTracking?.locationHistory?.length || 0
        });
        
        if (deviceTracking && deviceTracking.locationHistory && deviceTracking.locationHistory.length > 0) {
          // Use real-time location data
          console.log(`✅ [Enhanced Route API] Found ${deviceTracking.locationHistory.length} real-time location points`);
          
          // Clean the GPS data
          const cleanedPoints = GPSValidation.cleanGPSData(deviceTracking.locationHistory, {
            strictMode: false,
            maxAccuracy: 100,
            minAccuracy: 1,
            requirePhilippinesBounds: true,
            removeDrift: true,
            maxSpeed: 200
          });
          
          allLocationPoints = cleanedPoints;
          totalDistance = deviceTracking.totalDistanceTraveled || 0;
          totalAdPlays = deviceTracking.totalAdPlays || 0;
          totalQRScans = deviceTracking.totalQRScans || 0;
          totalHoursOnline = (deviceTracking.currentSession && deviceTracking.currentSession.totalHoursOnline) ? deviceTracking.currentSession.totalHoursOnline : 0;
          
          console.log(`✅ [Enhanced Route API] Processed ${allLocationPoints.length} real-time points for today`);
        } else {
          // Fallback: Check if today's data was already archived
          console.log(`⚠️ [Enhanced Route API] No real-time data, checking historical archive for today...`);
          
          const deviceData = await DeviceDataHistoryV2.findOne({ materialId });
          
          if (deviceData && deviceData.dailyData && deviceData.dailyData.length > 0) {
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
            
            const dayData = deviceData.dailyData.find(day => {
              const dayDate = new Date(day.date);
              dayDate.setHours(0, 0, 0, 0);
              return dayDate.getTime() === targetDate.getTime();
            });
            
            if (dayData && dayData.locationHistory && dayData.locationHistory.length > 0) {
              const cleanedPoints = GPSValidation.cleanGPSData(dayData.locationHistory, {
                strictMode: false,
                maxAccuracy: 100,
                minAccuracy: 1,
                requirePhilippinesBounds: true,
                removeDrift: true,
                maxSpeed: 200
              });
              
              allLocationPoints = cleanedPoints;
              totalDistance = dayData.totalDistanceTraveled || 0;
              totalAdPlays = dayData.totalAdPlays || 0;
              totalQRScans = dayData.totalQRScans || 0;
              totalHoursOnline = dayData.totalHoursOnline || 0;
              
              console.log(`✅ [Enhanced Route API] Found ${allLocationPoints.length} archived location points for today`);
            }
          }
        }
      } catch (todayError) {
        console.error(`❌ [Enhanced Route API] Error fetching today's data:`, todayError);
        // If there's an error, we'll fall through to the empty check below
      }
    } else {
      // 📅 PAST DATE or DATE RANGE: Use historical data only
      console.log(`📅 [Enhanced Route API] Requesting ${date ? 'PAST date' : 'date range'} - using historical data only`);
      
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
        return res.status(200).json({
          success: false,
          message: 'No device data found for the specified material and date range',
          data: null
        });
      }

      // Filter dailyData to only include the selected date(s)
      let filteredDailyData = deviceData.dailyData;
      
      if (date) {
        // Single date filter
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        filteredDailyData = deviceData.dailyData.filter(dailyRecord => {
          const recordDate = new Date(dailyRecord.date);
          return recordDate >= targetDate && recordDate < nextDay;
        });
        
        console.log(`🗓️ [Enhanced Route API] Filtering for date ${date}: Found ${filteredDailyData.length} matching day(s) out of ${deviceData.dailyData.length} total days`);
      } else if (startDate && endDate) {
        // Date range filter
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        filteredDailyData = deviceData.dailyData.filter(dailyRecord => {
          const recordDate = new Date(dailyRecord.date);
          return recordDate >= start && recordDate <= end;
        });
        
        console.log(`🗓️ [Enhanced Route API] Filtering for range ${startDate} to ${endDate}: Found ${filteredDailyData.length} matching day(s) out of ${deviceData.dailyData.length} total days`);
      }

      // Process filtered daily data
      filteredDailyData.forEach(dailyRecord => {
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
    }
    
    if (allLocationPoints.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No valid location data found for the specified date range',
        data: null
      });
    }

    // Sort points by timestamp
    allLocationPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // ✅ FIXED: Use stored totalHoursOnline for duration (consistent with archived data)
    // For historical data, use actual online hours from DeviceDataHistoryV2, not GPS timestamp span
    // This prevents showing 22h duration when only 2-3h were actually online
    if (totalHoursOnline > 0) {
      totalDuration = totalHoursOnline * 3600; // Convert stored hours to seconds
      console.log(`⏱️ [Enhanced Route API] Using stored totalHoursOnline: ${totalHoursOnline}h = ${totalDuration}s`);
    } else if (allLocationPoints.length > 1) {
      // Fallback: calculate from GPS timestamps if no stored hours available
      const startTime = new Date(allLocationPoints[0].timestamp);
      const endTime = new Date(allLocationPoints[allLocationPoints.length - 1].timestamp);
      totalDuration = (endTime - startTime) / 1000; // seconds
      console.log(`⏱️ [Enhanced Route API] Fallback to GPS timestamp span: ${totalDuration}s`);
    }

    // Create route points with enhanced data
    const routePoints = [];
    let cumulativeDistance = 0;

    allLocationPoints.forEach((point, index) => {
      // Safety check: ensure point has coordinates
      if (!point || !point.coordinates || point.coordinates.length < 2) {
        console.warn(`⚠️ [Enhanced Route API] Skipping invalid point at index ${index}:`, point);
        return;
      }
      
      const lat = point.coordinates[1];
      const lng = point.coordinates[0];
      
      // Validate coordinates are numbers
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        console.warn(`⚠️ [Enhanced Route API] Skipping point with invalid coordinates at index ${index}:`, { lat, lng });
        return;
      }
      
      // Calculate distance from previous point (only if time gap is reasonable)
      let segmentDistance = 0;
      let isSegmentBreak = false; // Flag to indicate this point starts a new segment (after offline)
      
      if (index > 0 && routePoints.length > 0) {
        const prevPoint = allLocationPoints[index - 1];
        if (prevPoint && prevPoint.coordinates && prevPoint.coordinates.length >= 2) {
          // ✅ FIX: Check time gap to detect offline periods
          const prevTimestamp = new Date(prevPoint.timestamp);
          const currentTimestamp = new Date(point.timestamp);
          const timeGapSeconds = (currentTimestamp - prevTimestamp) / 1000;
          const MAX_TIME_GAP = 60; // 60 seconds = 1 minute
          
          // ✅ FIX: If time gap is too large, don't calculate distance (device was offline)
          if (timeGapSeconds > MAX_TIME_GAP) {
            isSegmentBreak = true;
            console.log(`⏸️ [Enhanced Route API] Time gap detected at point ${index}: ${timeGapSeconds.toFixed(1)}s - marking as segment break`);
          } else {
            segmentDistance = GPSValidation.calculateDistance(
              prevPoint.coordinates[1], prevPoint.coordinates[0],
              lat, lng
            );
            
            // ✅ FIX: Validate speed is realistic before adding distance
            const calculatedSpeed = timeGapSeconds > 0 ? (segmentDistance / timeGapSeconds) * 3600 : 0; // km/h
            const MAX_REALISTIC_SPEED = 150; // km/h
            
            if (calculatedSpeed <= MAX_REALISTIC_SPEED) {
              cumulativeDistance += segmentDistance;
            } else {
              // Speed is unrealistic - likely GPS jump or offline period
              isSegmentBreak = true;
              segmentDistance = 0; // Don't count this distance
              console.log(`⏸️ [Enhanced Route API] Unrealistic speed detected at point ${index}: ${calculatedSpeed.toFixed(1)} km/h - marking as segment break`);
            }
          }
        }
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
        isSegmentBreak, // Flag to break route line in visualization
        index: routePoints.length // Use routePoints.length instead of index to account for skipped points
      });
    });

    // Final safety check: ensure we have valid route points
    if (routePoints.length === 0) {
      console.warn(`⚠️ [Enhanced Route API] No valid route points after processing`);
      return res.status(200).json({
        success: false,
        message: 'No valid location data found after processing',
        data: null
      });
    }

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
    if (includeSpeedSegments === 'true' || includeSpeedSegments === true) {
      speedSegments = createSpeedSegments(routePoints);
    }

    // Create waypoints (significant points)
    const waypoints = createWaypoints(routePoints);

    // Calculate route bounds
    const bounds = calculateRouteBounds(routePoints);

    const responseData = {
      success: true,
      data: {
        materialId: materialId,
        carGroupId: null, // Will be populated if available
        deviceInfo: null, // Will be populated if available
        route: routePoints,
        speedSegments,
        waypoints,
        bounds,
        metrics: (includeMetrics === 'true' || includeMetrics === true) ? metrics : undefined,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataSource: isToday ? 'DeviceTracking (Real-time)' : 'DeviceDataHistoryV2',
          date: date || new Date().toISOString().split('T')[0]
        }
      }
    };

    console.log(`✅ [Enhanced Route API] Generated route with ${routePoints.length} points, ${totalDistance.toFixed(2)}km distance`);

    res.json(responseData);

  } catch (error) {
    console.error('❌ [Enhanced Route API] Error:', error);
    console.error('❌ [Enhanced Route API] Error Stack:', error.stack);
    console.error('❌ [Enhanced Route API] Request params:', { materialId: req.params.materialId, date: req.query.date });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

