/**
 * API endpoint to verify device tracking metrics (distance and hours)
 * GET /api/verifyMetrics/:materialId
 */

const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');
const GPSValidation = require('../utils/gpsValidation');

router.get('/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    
    console.log(`\n🔍 [Verification] Analyzing metrics for device: ${materialId}`);
    
    // Get today's device tracking data
    const device = await DeviceTracking.findByMaterialId(materialId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: `No tracking data found for ${materialId}`
      });
    }
    
    const report = {
      materialId,
      reportedMetrics: {
        distance: device.totalDistanceTraveled,
        hours: device.totalHoursOnline || 0,
        sessionHours: device.currentSession?.totalHoursOnline || 0,
        sessionStartTime: device.currentSession?.startTime,
        locationPoints: device.locationHistory?.length || 0,
        isOnline: device.isOnline
      },
      timestampAnalysis: null,
      gpsAnalysis: null,
      distanceVerification: null,
      hoursVerification: null
    };
    
    // Analyze GPS timestamps to split yesterday vs today
    if (device.locationHistory && device.locationHistory.length > 0) {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const firstPoint = device.locationHistory[0];
      const lastPoint = device.locationHistory[device.locationHistory.length - 1];
      
      const yesterdayPoints = device.locationHistory.filter(p => new Date(p.timestamp) < todayMidnight);
      const todayPoints = device.locationHistory.filter(p => new Date(p.timestamp) >= todayMidnight);
      
      report.timestampAnalysis = {
        firstPointTime: firstPoint.timestamp,
        lastPointTime: lastPoint.timestamp,
        totalDurationHours: parseFloat(((new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)) / (1000 * 60 * 60)).toFixed(2)),
        todayMidnight: todayMidnight.toISOString(),
        yesterdayPoints: yesterdayPoints.length,
        todayPoints: todayPoints.length,
        todayFirstPoint: todayPoints.length > 0 ? todayPoints[0].timestamp : null,
        todayLastPoint: todayPoints.length > 0 ? todayPoints[todayPoints.length - 1].timestamp : null,
        todayDurationHours: todayPoints.length > 1 ? parseFloat(((new Date(todayPoints[todayPoints.length - 1].timestamp) - new Date(todayPoints[0].timestamp)) / (1000 * 60 * 60)).toFixed(2)) : 0
      };
    }
    
    // Verify distance by recalculating from GPS points
    if (device.locationHistory && device.locationHistory.length > 1) {
      let totalDistance = 0;
      let acceptedSegments = 0;
      let rejectedSegments = 0;
      let rejectionReasons = {
        tooSmall: 0,
        poorAccuracy: 0
      };
      let largeJumps = [];
      
      const MAX_ACCURACY_THRESHOLD = 30; // Same as in model
      const MIN_MOVEMENT = 0.01; // 10 meters in km
      
      // Analyze GPS accuracy distribution
      const accuracies = device.locationHistory
        .map(p => p.accuracy || 0)
        .filter(a => a > 0);
      
      if (accuracies.length > 0) {
        const avgAccuracy = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
        const maxAccuracy = Math.max(...accuracies);
        const minAccuracy = Math.min(...accuracies);
        const poorAccuracyCount = accuracies.filter(a => a >= MAX_ACCURACY_THRESHOLD).length;
        
        report.gpsAnalysis = {
          averageAccuracy: parseFloat(avgAccuracy.toFixed(1)),
          minAccuracy: parseFloat(minAccuracy.toFixed(1)),
          maxAccuracy: parseFloat(maxAccuracy.toFixed(1)),
          poorAccuracyPoints: poorAccuracyCount,
          totalPoints: accuracies.length,
          poorAccuracyPercentage: parseFloat(((poorAccuracyCount/accuracies.length)*100).toFixed(1))
        };
      }
      
      // Calculate distance segment by segment
      for (let i = 1; i < device.locationHistory.length; i++) {
        const prev = device.locationHistory[i - 1];
        const curr = device.locationHistory[i];
        
        if (!prev.coordinates || !curr.coordinates) continue;
        
        const distance = GPSValidation.calculateDistance(
          prev.coordinates[1], prev.coordinates[0],
          curr.coordinates[1], curr.coordinates[0]
        );
        
        const prevAccuracy = prev.accuracy || 0;
        const currAccuracy = curr.accuracy || 0;
        
        // Apply same filtering as the model
        if (distance > MIN_MOVEMENT) {
          if (currAccuracy < MAX_ACCURACY_THRESHOLD && prevAccuracy < MAX_ACCURACY_THRESHOLD) {
            totalDistance += distance;
            acceptedSegments++;
            
            // Flag suspiciously long jumps
            if (distance > 0.5) { // > 500m is suspicious
              largeJumps.push({
                index: i,
                distance: parseFloat((distance * 1000).toFixed(0)),
                currentAccuracy: parseFloat(currAccuracy.toFixed(1)),
                previousAccuracy: parseFloat(prevAccuracy.toFixed(1)),
                timestamp: curr.timestamp
              });
            }
          } else {
            rejectedSegments++;
            rejectionReasons.poorAccuracy++;
          }
        } else {
          rejectedSegments++;
          rejectionReasons.tooSmall++;
        }
      }
      
      // Calculate today's distance separately
      let todayDistance = 0;
      let todayAcceptedSegments = 0;
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      for (let i = 1; i < device.locationHistory.length; i++) {
        const prev = device.locationHistory[i - 1];
        const curr = device.locationHistory[i];
        
        // Only count movements from today
        const currTime = new Date(curr.timestamp);
        if (currTime < todayMidnight) continue;
        
        if (!prev.coordinates || !curr.coordinates) continue;
        
        const distance = GPSValidation.calculateDistance(
          prev.coordinates[1], prev.coordinates[0],
          curr.coordinates[1], curr.coordinates[0]
        );
        
        const prevAccuracy = prev.accuracy || 0;
        const currAccuracy = curr.accuracy || 0;
        
        if (distance > MIN_MOVEMENT) {
          if (currAccuracy < MAX_ACCURACY_THRESHOLD && prevAccuracy < MAX_ACCURACY_THRESHOLD) {
            todayDistance += distance;
            todayAcceptedSegments++;
          }
        }
      }
      
      report.distanceVerification = {
        recalculatedDistance: parseFloat(totalDistance.toFixed(3)),
        databaseDistance: parseFloat(device.totalDistanceTraveled.toFixed(3)),
        difference: parseFloat(Math.abs(totalDistance - device.totalDistanceTraveled).toFixed(3)),
        todayOnly: {
          recalculatedDistance: parseFloat(todayDistance.toFixed(3)),
          acceptedSegments: todayAcceptedSegments
        },
        acceptedSegments,
        rejectedSegments,
        rejectionReasons,
        largeJumps: largeJumps.slice(0, 10), // Show first 10 large jumps
        hasSignificantDifference: Math.abs(totalDistance - device.totalDistanceTraveled) > 0.1
      };
    }
    
    // Verify hours calculation
    if (device.currentSession?.startTime) {
      const now = new Date();
      const startTime = new Date(device.currentSession.startTime);
      const hoursDiff = (now - startTime) / (1000 * 60 * 60);
      
      const sessionHours = device.currentSession.totalHoursOnline || 0;
      const hoursDiffFromReported = Math.abs(hoursDiff - sessionHours);
      
      report.hoursVerification = {
        sessionStart: startTime.toISOString(),
        currentTime: now.toISOString(),
        calculatedHours: parseFloat(hoursDiff.toFixed(2)),
        reportedSessionHours: parseFloat(sessionHours.toFixed(2)),
        reportedTotalHours: parseFloat((device.totalHoursOnline || 0).toFixed(2)),
        difference: parseFloat(hoursDiffFromReported.toFixed(2)),
        hasSignificantDifference: hoursDiffFromReported > 0.5,
        possibleIssues: hoursDiffFromReported > 0.5 ? [
          'Session start time may be incorrect',
          'Device went offline and hours weren\'t updated',
          'Multiple session resets occurred'
        ] : []
      };
    }
    
    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('❌ Error verifying device metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify device metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

