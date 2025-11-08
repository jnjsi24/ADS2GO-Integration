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
    const { date, startDate, endDate, includeMetrics = true, includeSpeedSegments = true, adStartTime, adId } = req.query;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: materialId'
      });
    }

    console.log(`🗺️ [Enhanced Route API] Fetching route for material: ${materialId}, date: ${date}${adStartTime ? `, filtered after ad deployment: ${adStartTime}` : ''}${adId ? `, adId: ${adId}` : ''}`);

    // ✅ Get actual deployment time from AdsDeployment or DeviceTracking if adId is provided
    let actualDeploymentTime = adStartTime ? new Date(adStartTime) : null;
    if (adId && materialId) {
      try {
        const AdsDeployment = require('../models/adsDeployment');
        const DeviceTracking = require('../models/deviceTracking');
        
        // Try to find deployment in AdsDeployment
        const deployment = await AdsDeployment.findOne({
          materialId: materialId,
          $or: [
            { adId: adId },
            { 'lcdSlots.adId': adId }
          ]
        }).sort({ createdAt: -1 }); // Get most recent deployment
        
        if (deployment) {
          // For LCD materials, check lcdSlots for the specific ad
          if (deployment.lcdSlots && deployment.lcdSlots.length > 0) {
            const matchingSlot = deployment.lcdSlots.find(slot => 
              slot.adId && slot.adId.toString() === adId.toString()
            );
            if (matchingSlot && matchingSlot.deployedAt) {
              actualDeploymentTime = new Date(matchingSlot.deployedAt);
              console.log(`✅ [Enhanced Route API] Found actual deployment time from AdsDeployment.lcdSlots: ${actualDeploymentTime.toISOString()}`);
            } else if (deployment.deployedAt) {
              actualDeploymentTime = new Date(deployment.deployedAt);
              console.log(`✅ [Enhanced Route API] Found actual deployment time from AdsDeployment: ${actualDeploymentTime.toISOString()}`);
            }
          } else if (deployment.deployedAt) {
            // For non-LCD materials
            actualDeploymentTime = new Date(deployment.deployedAt);
            console.log(`✅ [Enhanced Route API] Found actual deployment time from AdsDeployment: ${actualDeploymentTime.toISOString()}`);
          }
        } else {
          // Fallback: Check DeviceTracking.deployedAds
          const deviceTracking = await DeviceTracking.findOne({ materialId: materialId });
          if (deviceTracking && deviceTracking.deployedAds && deviceTracking.deployedAds.length > 0) {
            const deployedAd = deviceTracking.deployedAds.find(ad => 
              ad.adId && ad.adId.toString() === adId.toString()
            );
            if (deployedAd && deployedAd.deployedAt) {
              actualDeploymentTime = new Date(deployedAd.deployedAt);
              console.log(`✅ [Enhanced Route API] Found actual deployment time from DeviceTracking.deployedAds: ${actualDeploymentTime.toISOString()}`);
            }
          }
        }
        
        if (!actualDeploymentTime && adStartTime) {
          console.log(`⚠️ [Enhanced Route API] Could not find deployment time, using provided adStartTime: ${adStartTime}`);
          actualDeploymentTime = new Date(adStartTime);
        }
      } catch (deploymentError) {
        console.error(`⚠️ [Enhanced Route API] Error looking up deployment time:`, deploymentError.message);
        // Fallback to adStartTime if provided
        if (adStartTime) {
          actualDeploymentTime = new Date(adStartTime);
        }
      }
    }

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
      console.log(`📍 [Enhanced Route API] MaterialId: ${materialId}, Date: ${date}`);
      
      try {
        const DeviceTracking = require('../models/deviceTracking');
        
        // ✅ DEBUG: Try multiple lookup methods to find the device
        console.log(`🔍 [Enhanced Route API] Looking up DeviceTracking for materialId: ${materialId}`);
        
        let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
        
        // If not found, try direct query with today's date
        if (!deviceTracking) {
          console.log(`⚠️ [Enhanced Route API] findByMaterialId returned null, trying direct query...`);
          const now = new Date();
          const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
          deviceTracking = await DeviceTracking.findOne({ materialId, date: today });
        }
        
        // If still not found, try finding any record for this materialId
        if (!deviceTracking) {
          console.log(`⚠️ [Enhanced Route API] Direct query returned null, trying latest record...`);
          deviceTracking = await DeviceTracking.findOne({ materialId }).sort({ date: -1 });
        }
        
        console.log(`🔍 [Enhanced Route API] DeviceTracking lookup result:`, {
          found: !!deviceTracking,
          materialId: deviceTracking?.materialId,
          date: deviceTracking?.date,
          _id: deviceTracking?._id,
          hasLocationHistory: deviceTracking?.locationHistory?.length > 0,
          locationCount: deviceTracking?.locationHistory?.length || 0,
          hasCurrentLocation: !!deviceTracking?.currentLocation,
          currentLocation: deviceTracking?.currentLocation ? {
            lat: deviceTracking.currentLocation.coordinates?.[1],
            lng: deviceTracking.currentLocation.coordinates?.[0],
            timestamp: deviceTracking.currentLocation.timestamp,
            accuracy: deviceTracking.currentLocation.accuracy
          } : null
        });
        
        if (deviceTracking && deviceTracking.locationHistory && deviceTracking.locationHistory.length > 0) {
          // Use real-time location data
          console.log(`✅ [Enhanced Route API] Found ${deviceTracking.locationHistory.length} real-time location points`);
          console.log(`📍 [Enhanced Route API] First point:`, deviceTracking.locationHistory[0]);
          console.log(`📍 [Enhanced Route API] Last point:`, deviceTracking.locationHistory[deviceTracking.locationHistory.length - 1]);
          
          // Clean the GPS data
          const cleanedPoints = GPSValidation.cleanGPSData(deviceTracking.locationHistory, {
            strictMode: false,
            maxAccuracy: 100,
            minAccuracy: 1,
            requirePhilippinesBounds: true,
            removeDrift: true,
            maxSpeed: 200
          });
          
          console.log(`🧹 [Enhanced Route API] After cleaning: ${cleanedPoints.length} points (removed ${deviceTracking.locationHistory.length - cleanedPoints.length} invalid points)`);
          
          allLocationPoints = cleanedPoints;
          totalDistance = deviceTracking.totalDistanceTraveled || 0;
          totalAdPlays = deviceTracking.totalAdPlays || 0;
          totalQRScans = deviceTracking.totalQRScans || 0;
          totalHoursOnline = (deviceTracking.currentSession && deviceTracking.currentSession.totalHoursOnline) ? deviceTracking.currentSession.totalHoursOnline : 0;
          
          console.log(`✅ [Enhanced Route API] Processed ${allLocationPoints.length} real-time points for today`);
        } else if (deviceTracking && deviceTracking.currentLocation) {
          // ✅ FALLBACK: If locationHistory is empty but currentLocation exists, use it as a route point
          console.log(`⚠️ [Enhanced Route API] locationHistory is empty but currentLocation exists - using currentLocation as route point`);
          console.log(`📍 [Enhanced Route API] Current location:`, deviceTracking.currentLocation);
          
          if (deviceTracking.currentLocation.coordinates && deviceTracking.currentLocation.coordinates.length >= 2) {
            allLocationPoints = [deviceTracking.currentLocation];
            totalDistance = deviceTracking.totalDistanceTraveled || 0;
            totalAdPlays = deviceTracking.totalAdPlays || 0;
            totalQRScans = deviceTracking.totalQRScans || 0;
            totalHoursOnline = (deviceTracking.currentSession && deviceTracking.currentSession.totalHoursOnline) ? deviceTracking.currentSession.totalHoursOnline : 0;
            
            console.log(`✅ [Enhanced Route API] Using currentLocation as single route point`);
          }
        } else {
          // Fallback: Check if today's data was already archived
          console.log(`⚠️ [Enhanced Route API] No real-time data, checking historical archive for today...`);
          console.log(`🔍 [Enhanced Route API] DeviceTracking exists: ${!!deviceTracking}, has locationHistory: ${deviceTracking?.locationHistory?.length > 0}, has currentLocation: ${!!deviceTracking?.currentLocation}`);
          
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
        console.error(`❌ [Enhanced Route API] Error fetching today's data:`, todayError.message);
        console.error(`❌ [Enhanced Route API] Error stack:`, todayError.stack);
        
        // If it's a validation error from DeviceTracking, log it but continue
        if (todayError.name === 'ValidationError') {
          console.error(`❌ [Enhanced Route API] Validation error - this should be fixed in the model`);
          // Try to continue with empty data - the route map will show no data
        }
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

    // ✅ FILTER: If actualDeploymentTime is found, filter location points to only include those after ad deployment
    let filteredLocationPoints = allLocationPoints;
    if (actualDeploymentTime) {
      // ✅ Check if ad deployment time is on the same date as the requested date
      const deploymentDateStr = actualDeploymentTime.toISOString().split('T')[0];
      const requestedDateStr = date;
      
      if (deploymentDateStr === requestedDateStr) {
        // Ad was deployed on the requested date - filter points after deployment time
        console.log(`🔍 [Enhanced Route API] Filtering route to only show locations after ad deployment: ${actualDeploymentTime.toISOString()} (on same date)`);
        
        const beforeFilter = allLocationPoints.length;
        filteredLocationPoints = allLocationPoints.filter(point => {
          if (!point || !point.timestamp) return false;
          const pointTimestamp = new Date(point.timestamp);
          return pointTimestamp >= actualDeploymentTime;
        });
        
        const afterFilter = filteredLocationPoints.length;
        console.log(`✅ [Enhanced Route API] Filtered ${beforeFilter} points to ${afterFilter} points (removed ${beforeFilter - afterFilter} points before ad deployment)`);
        
        // ✅ If no points remain after filtering, return empty route (ad was just deployed, no movement yet)
        if (filteredLocationPoints.length === 0) {
          console.log(`ℹ️ [Enhanced Route API] No location data after ad deployment time - ad was just deployed, no route yet`);
        }
        
        // Update totalDistance to only count distance after ad deployment
        if (filteredLocationPoints.length > 0) {
          // Recalculate distance from filtered points only
          totalDistance = 0;
          for (let i = 1; i < filteredLocationPoints.length; i++) {
            const prevPoint = filteredLocationPoints[i - 1];
            const currentPoint = filteredLocationPoints[i];
            if (prevPoint && currentPoint && prevPoint.coordinates && currentPoint.coordinates) {
              const segmentDist = GPSValidation.calculateDistance(
                prevPoint.coordinates[1], prevPoint.coordinates[0],
                currentPoint.coordinates[1], currentPoint.coordinates[0]
              );
              totalDistance += segmentDist;
            }
          }
        } else {
          // No route data after deployment
          totalDistance = 0;
        }
      } else if (deploymentDateStr > requestedDateStr) {
        // Ad was deployed AFTER the requested date - return empty route (ad wasn't active yet)
        console.log(`⚠️ [Enhanced Route API] Ad deployment (${deploymentDateStr}) is after requested date (${requestedDateStr}) - returning empty route`);
        filteredLocationPoints = [];
        totalDistance = 0;
      } else {
        // Ad was deployed BEFORE the requested date - show all points (ad was already active)
        console.log(`ℹ️ [Enhanced Route API] Ad deployment (${deploymentDateStr}) is before requested date (${requestedDateStr}) - showing all route points`);
      }
    }

    // Create route points with enhanced data
    const routePoints = [];
    let cumulativeDistance = 0;

    filteredLocationPoints.forEach((point, index) => {
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
        const prevPoint = filteredLocationPoints[index - 1];
        if (prevPoint && prevPoint.coordinates && prevPoint.coordinates.length >= 2) {
          // ✅ FIX: Check time gap to detect offline periods (improved logic)
          const prevTimestamp = new Date(prevPoint.timestamp);
          const currentTimestamp = new Date(point.timestamp);
          const timeGapSeconds = (currentTimestamp - prevTimestamp) / 1000;
          const MAX_TIME_GAP = 300; // 300 seconds = 5 minutes (increased from 60s to reduce false breaks)
          
          // Calculate distance first to check both time and distance gaps
          segmentDistance = GPSValidation.calculateDistance(
            prevPoint.coordinates[1], prevPoint.coordinates[0],
            lat, lng
          );
          
          // ✅ IMPROVED: Only create segment break if BOTH conditions are met:
          // 1. Time gap is large (likely offline period) AND
          // 2. Distance jump is also large (device actually moved far, not just GPS drift)
          // This prevents breaking route lines for normal GPS updates with small delays
          const MAX_DISTANCE_JUMP = 0.5; // 0.5 km = 500 meters - large distance jump indicates real offline/teleport
          
          if (timeGapSeconds > MAX_TIME_GAP && segmentDistance > MAX_DISTANCE_JUMP) {
            // Large time gap AND large distance = device was offline and moved (real segment break)
            isSegmentBreak = true;
            console.log(`⏸️ [Enhanced Route API] Segment break detected at point ${index}: time gap ${timeGapSeconds.toFixed(1)}s, distance jump ${(segmentDistance * 1000).toFixed(1)}m - marking as segment break`);
          } else if (timeGapSeconds > MAX_TIME_GAP) {
            // Large time gap but small distance = GPS signal loss but device stationary (don't break)
            console.log(`📍 [Enhanced Route API] Large time gap (${timeGapSeconds.toFixed(1)}s) but small movement (${(segmentDistance * 1000).toFixed(1)}m) - likely GPS signal loss while stationary, not breaking route`);
            // Continue normally - don't break route for stationary GPS signal loss
          }
          
          // ✅ FIX: Validate speed is realistic before adding distance
          // Only check speed if we haven't already marked this as a segment break
          if (!isSegmentBreak) {
            const calculatedSpeed = timeGapSeconds > 0 ? (segmentDistance / timeGapSeconds) * 3600 : 0; // km/h
            const MAX_REALISTIC_SPEED = 200; // km/h (increased from 150 to allow highway speeds)
            
            if (calculatedSpeed <= MAX_REALISTIC_SPEED) {
              // Speed is realistic - count the distance
              cumulativeDistance += segmentDistance;
            } else {
              // Speed is unrealistic - likely GPS jump, but don't break route if distance is small
              const distanceInMeters = segmentDistance * 1000;
              if (distanceInMeters > (MAX_DISTANCE_JUMP * 1000)) {
                // Large distance jump with unrealistic speed = real GPS jump, break route
                isSegmentBreak = true;
                segmentDistance = 0; // Don't count this distance
                console.log(`⏸️ [Enhanced Route API] Unrealistic speed (${calculatedSpeed.toFixed(1)} km/h) with large distance jump (${distanceInMeters.toFixed(1)}m) - marking as segment break`);
              } else {
                // Unrealistic speed but small distance = GPS drift, ignore it but don't break route
                segmentDistance = 0;
                console.log(`⚠️ [Enhanced Route API] Unrealistic speed (${calculatedSpeed.toFixed(1)} km/h) but small distance (${distanceInMeters.toFixed(1)}m) - likely GPS drift, ignoring but not breaking route`);
              }
            }
          } else {
            // Segment break already detected - don't count distance
            segmentDistance = 0;
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

