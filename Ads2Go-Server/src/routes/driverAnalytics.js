const express = require('express');
const router = express.Router();
const DriverAnalyticsService = require('../services/driverAnalyticsService');
const DriverAnalytics = require('../models/driverAnalytics');
const { checkDriver } = require('../middleware/driverAuth');

// GET /driver-analytics/:driverId - Get comprehensive driver analytics
router.get('/:driverId', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate driver access (driver can only access their own data)
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own analytics.'
      });
    }
    
    const analytics = await DriverAnalyticsService.getDriverAnalytics(
      driverId, 
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'Driver analytics not found'
      });
    }
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting driver analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching driver analytics',
      error: error.message
    });
  }
});

// GET /driver-analytics/:driverId/daily - Get daily performance data
router.get('/:driverId/daily', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { days = 7 } = req.query;
    
    // Validate driver access
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own analytics.'
      });
    }
    
    const driverAnalytics = await DriverAnalytics.findOne({ driverId });
    
    if (!driverAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Driver analytics not found'
      });
    }
    
    // Get last N days of performance data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    const dailyData = driverAnalytics.dailyPerformance
      .filter(day => day.date >= startDate && day.date <= endDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => ({
        date: day.date,
        totalDistance: day.totalDistance,
        totalHours: day.totalHours,
        averageSpeed: day.averageSpeed,
        maxSpeed: day.maxSpeed,
        totalAdImpressions: day.totalAdImpressions,
        totalQRScans: day.totalQRScans,
        earnings: day.earnings,
        complianceScore: day.complianceScore,
        safetyScore: day.safetyScore,
        routes: day.routes.length
      }));
    
    res.json({
      success: true,
      data: {
        dailyPerformance: dailyData,
        summary: {
          totalDays: dailyData.length,
          averageDistance: dailyData.reduce((sum, day) => sum + day.totalDistance, 0) / dailyData.length || 0,
          averageHours: dailyData.reduce((sum, day) => sum + day.totalHours, 0) / dailyData.length || 0,
          averageCompliance: dailyData.reduce((sum, day) => sum + day.complianceScore, 0) / dailyData.length || 0,
          averageSafety: dailyData.reduce((sum, day) => sum + day.safetyScore, 0) / dailyData.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting daily analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily analytics',
      error: error.message
    });
  }
});

// GET /driver-analytics/:driverId/monthly - Get monthly performance data
router.get('/:driverId/monthly', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { months = 6 } = req.query;
    
    // Validate driver access
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own analytics.'
      });
    }
    
    const driverAnalytics = await DriverAnalytics.findOne({ driverId });
    
    if (!driverAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Driver analytics not found'
      });
    }
    
    // Get monthly trends
    const monthlyData = driverAnalytics.monthlyTrends
      .slice(-parseInt(months))
      .map(month => ({
        month: month.month,
        distance: month.distance,
        hours: month.hours,
        earnings: month.earnings,
        compliance: month.compliance
      }));
    
    res.json({
      success: true,
      data: {
        monthlyTrends: monthlyData,
        summary: {
          totalMonths: monthlyData.length,
          averageDistance: monthlyData.reduce((sum, month) => sum + month.distance, 0) / monthlyData.length || 0,
          averageHours: monthlyData.reduce((sum, month) => sum + month.hours, 0) / monthlyData.length || 0,
          averageEarnings: monthlyData.reduce((sum, month) => sum + month.earnings, 0) / monthlyData.length || 0,
          averageCompliance: monthlyData.reduce((sum, month) => sum + month.compliance, 0) / monthlyData.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting monthly analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly analytics',
      error: error.message
    });
  }
});

// GET /driver-analytics/leaderboard - Get driver leaderboard
router.get('/leaderboard', checkDriver, async (req, res) => {
  try {
    const { metric = 'distance', limit = 10 } = req.query;
    
    // Drivers can view leaderboard (for now, can be restricted later)
    // if (req.driver.role !== 'ADMIN') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied. Only admins can view leaderboard.'
    //   });
    // }
    
    const leaderboard = await DriverAnalyticsService.getDriverLeaderboard(metric, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        leaderboard: leaderboard.map(driver => ({
          driverId: driver.driverId._id,
          driverName: `${driver.driverId.firstName} ${driver.driverId.lastName}`,
          vehiclePlateNumber: driver.driverId.vehiclePlateNumber,
          vehicleType: driver.driverId.vehicleType,
          totalDistance: driver.totalDistanceTraveled,
          totalHours: driver.totalHoursWorked,
          complianceRate: driver.complianceRate,
          safetyScore: driver.safetyScore,
          totalAdImpressions: driver.totalAdImpressions,
          totalQRScans: driver.totalQRScans,
          isOnline: driver.isOnline
        })),
        metric: metric,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard',
      error: error.message
    });
  }
});

// GET /driver-analytics/:driverId/current-status - Get current driver status
router.get('/:driverId/current-status', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // Validate driver access
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own analytics.'
      });
    }
    
    const driverAnalytics = await DriverAnalytics.findOne({ driverId });
    
    if (!driverAnalytics) {
      return res.status(404).json({
        success: false,
        message: 'Driver analytics not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        isOnline: driverAnalytics.isOnline,
        currentLocation: driverAnalytics.currentLocation,
        todayPerformance: driverAnalytics.todayPerformance,
        totalDistance: driverAnalytics.totalDistanceTraveled,
        totalHours: driverAnalytics.totalHoursWorked,
        complianceRate: driverAnalytics.complianceRate,
        safetyScore: driverAnalytics.safetyScore,
        speedViolations: driverAnalytics.speedViolations.length,
        lastUpdated: driverAnalytics.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error getting current status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current status',
      error: error.message
    });
  }
});

// POST /driver-analytics/:driverId/sync - Manually sync driver analytics
router.post('/:driverId/sync', checkDriver, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // Drivers can sync their own data
    if (req.driver.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only sync your own data.'
      });
    }
    
    await DriverAnalyticsService.syncWithDeviceAnalytics(driverId);
    
    res.json({
      success: true,
      message: 'Driver analytics synced successfully'
    });
  } catch (error) {
    console.error('Error syncing driver analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing driver analytics',
      error: error.message
    });
  }
});

module.exports = router;
