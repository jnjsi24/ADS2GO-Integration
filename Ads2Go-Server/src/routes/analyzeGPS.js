/**
 * API endpoint to deeply analyze GPS data and identify distance inflation sources
 * GET /api/analyzeGPS/:materialId
 */

const express = require('express');
const router = express.Router();
const DeviceTracking = require('../models/deviceTracking');
const GPSValidation = require('../utils/gpsValidation');

router.get('/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { date } = req.query;
    
    console.log(`\n🔍 [GPS Analysis] Analyzing GPS data for: ${materialId}`);
    
    // Get device tracking data
    const device = await DeviceTracking.findByMaterialId(materialId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: `No tracking data found for ${materialId}`
      });
    }
    
    if (!device.locationHistory || device.locationHistory.length < 2) {
      return res.status(404).json({
        success: false,
        message: 'Not enough GPS data to analyze'
      });
    }
    
    // Filter for today's data only
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPoints = device.locationHistory.filter(p => new Date(p.timestamp) >= todayMidnight);
    
    if (todayPoints.length < 2) {
      return res.status(404).json({
        success: false,
        message: 'Not enough GPS data for today'
      });
    }
    
    console.log(`📊 Analyzing ${todayPoints.length} GPS points from today`);
    
    // Analysis results
    const analysis = {
      summary: {
        totalPoints: todayPoints.length,
        timeRange: {
          start: todayPoints[0].timestamp,
          end: todayPoints[todayPoints.length - 1].timestamp,
          durationMinutes: ((new Date(todayPoints[todayPoints.length - 1].timestamp) - new Date(todayPoints[0].timestamp)) / (1000 * 60))
        },
        databaseDistance: device.totalDistanceTraveled
      },
      distanceBreakdown: {
        total: 0,
        bySegmentType: {
          normal: { distance: 0, count: 0 },
          suspicious: { distance: 0, count: 0 }, // 100m-500m jumps
          veryLarge: { distance: 0, count: 0 }, // >500m jumps
          stationary: { distance: 0, count: 0 } // <10m
        }
      },
      suspiciousSegments: [],
      firstLastPoints: {
        first10: [],
        last10: []
      },
      stationaryDrift: {
        totalStationaryPoints: 0,
        totalDriftDistance: 0,
        maxDrift: 0
      },
      recommendations: []
    };
    
    // Analyze each segment
    for (let i = 1; i < todayPoints.length; i++) {
      const prev = todayPoints[i - 1];
      const curr = todayPoints[i];
      
      if (!prev.coordinates || !curr.coordinates) continue;
      
      const distance = GPSValidation.calculateDistance(
        prev.coordinates[1], prev.coordinates[0],
        curr.coordinates[1], curr.coordinates[0]
      );
      
      const distanceMeters = distance * 1000;
      const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000; // seconds
      const speed = timeDiff > 0 ? (distance / timeDiff) * 3600 : 0; // km/h
      
      analysis.distanceBreakdown.total += distance;
      
      // Categorize segment
      if (distanceMeters < 10) {
        // Stationary drift
        analysis.distanceBreakdown.bySegmentType.stationary.distance += distance;
        analysis.distanceBreakdown.bySegmentType.stationary.count++;
        analysis.stationaryDrift.totalStationaryPoints++;
        analysis.stationaryDrift.totalDriftDistance += distance;
        if (distanceMeters > analysis.stationaryDrift.maxDrift) {
          analysis.stationaryDrift.maxDrift = distanceMeters;
        }
      } else if (distanceMeters > 500) {
        // Very large jump - likely GPS error
        analysis.distanceBreakdown.bySegmentType.veryLarge.distance += distance;
        analysis.distanceBreakdown.bySegmentType.veryLarge.count++;
        
        analysis.suspiciousSegments.push({
          index: i,
          type: 'VERY_LARGE_JUMP',
          distanceMeters: parseFloat(distanceMeters.toFixed(1)),
          timeDiffSeconds: parseFloat(timeDiff.toFixed(1)),
          speed: parseFloat(speed.toFixed(1)),
          from: {
            lat: prev.coordinates[1],
            lng: prev.coordinates[0],
            accuracy: prev.accuracy,
            timestamp: prev.timestamp
          },
          to: {
            lat: curr.coordinates[1],
            lng: curr.coordinates[0],
            accuracy: curr.accuracy,
            timestamp: curr.timestamp
          }
        });
      } else if (distanceMeters > 100) {
        // Suspicious jump
        analysis.distanceBreakdown.bySegmentType.suspicious.distance += distance;
        analysis.distanceBreakdown.bySegmentType.suspicious.count++;
        
        if (speed > 120) { // Impossible speed
          analysis.suspiciousSegments.push({
            index: i,
            type: 'IMPOSSIBLE_SPEED',
            distanceMeters: parseFloat(distanceMeters.toFixed(1)),
            timeDiffSeconds: parseFloat(timeDiff.toFixed(1)),
            speed: parseFloat(speed.toFixed(1)),
            from: {
              lat: prev.coordinates[1],
              lng: prev.coordinates[0],
              accuracy: prev.accuracy,
              timestamp: prev.timestamp
            },
            to: {
              lat: curr.coordinates[1],
              lng: curr.coordinates[0],
              accuracy: curr.accuracy,
              timestamp: curr.timestamp
            }
          });
        }
      } else {
        // Normal movement
        analysis.distanceBreakdown.bySegmentType.normal.distance += distance;
        analysis.distanceBreakdown.bySegmentType.normal.count++;
      }
    }
    
    // Get first and last 10 points for startup/shutdown analysis
    analysis.firstLastPoints.first10 = todayPoints.slice(0, 10).map((p, idx) => ({
      index: idx,
      timestamp: p.timestamp,
      lat: p.coordinates[1],
      lng: p.coordinates[0],
      accuracy: p.accuracy,
      speed: p.speed
    }));
    
    analysis.firstLastPoints.last10 = todayPoints.slice(-10).map((p, idx) => ({
      index: todayPoints.length - 10 + idx,
      timestamp: p.timestamp,
      lat: p.coordinates[1],
      lng: p.coordinates[0],
      accuracy: p.accuracy,
      speed: p.speed
    }));
    
    // Calculate distance for first 10 and last 10 points
    let first10Distance = 0;
    for (let i = 1; i < Math.min(10, todayPoints.length); i++) {
      const prev = todayPoints[i - 1];
      const curr = todayPoints[i];
      if (prev.coordinates && curr.coordinates) {
        first10Distance += GPSValidation.calculateDistance(
          prev.coordinates[1], prev.coordinates[0],
          curr.coordinates[1], curr.coordinates[0]
        );
      }
    }
    
    let last10Distance = 0;
    const lastStartIdx = Math.max(0, todayPoints.length - 10);
    for (let i = lastStartIdx + 1; i < todayPoints.length; i++) {
      const prev = todayPoints[i - 1];
      const curr = todayPoints[i];
      if (prev.coordinates && curr.coordinates) {
        last10Distance += GPSValidation.calculateDistance(
          prev.coordinates[1], prev.coordinates[0],
          curr.coordinates[1], curr.coordinates[0]
        );
      }
    }
    
    analysis.firstLastPoints.first10Distance = parseFloat((first10Distance * 1000).toFixed(1));
    analysis.firstLastPoints.last10Distance = parseFloat((last10Distance * 1000).toFixed(1));
    
    // Round all distances
    analysis.distanceBreakdown.total = parseFloat(analysis.distanceBreakdown.total.toFixed(3));
    analysis.distanceBreakdown.bySegmentType.normal.distance = parseFloat(analysis.distanceBreakdown.bySegmentType.normal.distance.toFixed(3));
    analysis.distanceBreakdown.bySegmentType.suspicious.distance = parseFloat(analysis.distanceBreakdown.bySegmentType.suspicious.distance.toFixed(3));
    analysis.distanceBreakdown.bySegmentType.veryLarge.distance = parseFloat(analysis.distanceBreakdown.bySegmentType.veryLarge.distance.toFixed(3));
    analysis.distanceBreakdown.bySegmentType.stationary.distance = parseFloat(analysis.distanceBreakdown.bySegmentType.stationary.distance.toFixed(3));
    analysis.stationaryDrift.totalDriftDistance = parseFloat(analysis.stationaryDrift.totalDriftDistance.toFixed(3));
    
    // Generate recommendations
    const inflationAmount = analysis.distanceBreakdown.total - 2.75; // Assuming 2.75 km is accurate
    
    if (analysis.distanceBreakdown.bySegmentType.veryLarge.distance > 0.5) {
      analysis.recommendations.push({
        issue: 'Large GPS jumps detected',
        impact: `${analysis.distanceBreakdown.bySegmentType.veryLarge.distance.toFixed(2)} km from ${analysis.distanceBreakdown.bySegmentType.veryLarge.count} large jumps`,
        fix: 'Implement maximum segment distance filter (e.g., reject segments > 500m)'
      });
    }
    
    if (analysis.distanceBreakdown.bySegmentType.suspicious.distance > 0.3) {
      analysis.recommendations.push({
        issue: 'Suspicious medium jumps detected',
        impact: `${analysis.distanceBreakdown.bySegmentType.suspicious.distance.toFixed(2)} km from ${analysis.distanceBreakdown.bySegmentType.suspicious.count} jumps`,
        fix: 'Implement speed-based filtering (reject impossible speeds > 120 km/h)'
      });
    }
    
    if (first10Distance > 0.2) {
      analysis.recommendations.push({
        issue: 'GPS instability at startup',
        impact: `${(first10Distance * 1000).toFixed(0)}m distance in first 10 points`,
        fix: 'Discard first 5-10 GPS points after device startup'
      });
    }
    
    if (last10Distance > 0.2) {
      analysis.recommendations.push({
        issue: 'GPS instability at shutdown',
        impact: `${(last10Distance * 1000).toFixed(0)}m distance in last 10 points`,
        fix: 'Discard last 5 GPS points before device shutdown'
      });
    }
    
    if (analysis.stationaryDrift.totalDriftDistance > 0.1) {
      analysis.recommendations.push({
        issue: 'Stationary GPS drift',
        impact: `${(analysis.stationaryDrift.totalDriftDistance * 1000).toFixed(0)}m from ${analysis.stationaryDrift.totalStationaryPoints} stationary points`,
        fix: 'Increase minimum movement threshold from 10m to 20-30m'
      });
    }
    
    res.json({
      success: true,
      data: analysis
    });
    
  } catch (error) {
    console.error('❌ Error analyzing GPS data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze GPS data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

