const DriverAnalytics = require('../models/driverAnalytics');
const Analytics = require('../models/analytics');
const ScreenTracking = require('../models/screenTracking');
const Driver = require('../models/Driver');
const Material = require('../models/Material');

class DriverAnalyticsService {
  
  // Create or update driver analytics
  static async updateDriverAnalytics(driverId, locationData) {
    try {
      let driverAnalytics = await DriverAnalytics.findOne({ driverId });
      
      if (!driverAnalytics) {
        // Get driver info by driverId string
        const driver = await Driver.findOne({ driverId: driverId });
        
        if (!driver) {
          throw new Error('Driver not found');
        }
        
        // Create new driver analytics
        driverAnalytics = new DriverAnalytics({
          driverId: driver.driverId, // Use the driver's driverId string
          materialId: driver.materialId,
          vehiclePlateNumber: driver.vehiclePlateNumber,
          vehicleType: driver.vehicleType,
          isOnline: true,
          currentLocation: {
            type: 'Point',
            coordinates: [locationData.lng, locationData.lat],
            accuracy: locationData.accuracy,
            speed: locationData.speed,
            heading: locationData.heading,
            timestamp: new Date()
          }
        });
        
        await driverAnalytics.save();
        console.log(`✅ Created new driver analytics for driver ${driverId}`);
      } else {
        // Update existing analytics
        await driverAnalytics.updateLocation(
          locationData.lat,
          locationData.lng,
          locationData.speed,
          locationData.heading,
          locationData.accuracy
        );
      }
      
      // Sync with device analytics
      await this.syncWithDeviceAnalytics(driverId);
      
      return driverAnalytics;
    } catch (error) {
      console.error('Error updating driver analytics:', error);
      throw error;
    }
  }
  
  // Sync driver analytics with device analytics
  static async syncWithDeviceAnalytics(driverId) {
    try {
      // Get all device analytics for this driver
      const deviceAnalytics = await Analytics.find({ driverId });
      
      if (deviceAnalytics.length === 0) return;
      
      // Aggregate data from all devices
      const aggregatedData = {
        totalAdImpressions: deviceAnalytics.reduce((sum, device) => sum + device.totalAdImpressions, 0),
        totalQRScans: deviceAnalytics.reduce((sum, device) => sum + device.totalQRScans, 0),
        totalAdPlayTime: deviceAnalytics.reduce((sum, device) => sum + device.totalAdPlayTime, 0),
        averageUptime: deviceAnalytics.reduce((sum, device) => sum + device.uptimePercentage, 0) / deviceAnalytics.length,
        averageCompliance: deviceAnalytics.reduce((sum, device) => sum + device.complianceRate, 0) / deviceAnalytics.length
      };
      
      // Update driver analytics
      await DriverAnalytics.findOneAndUpdate(
        { driverId },
        {
          totalAdImpressions: aggregatedData.totalAdImpressions,
          totalQRScans: aggregatedData.totalQRScans,
          uptimePercentage: aggregatedData.averageUptime,
          complianceRate: aggregatedData.averageCompliance
        }
      );
      
      console.log(`✅ Synced driver analytics for driver ${driverId}`);
    } catch (error) {
      console.error('Error syncing driver analytics:', error);
    }
  }
  
  // Get comprehensive driver analytics
  static async getDriverAnalytics(driverId, startDate, endDate) {
    try {
      const driverAnalytics = await DriverAnalytics.findOne({ driverId });
      
      if (!driverAnalytics) {
        return null;
      }
      
      // Get device analytics for additional data
      const deviceAnalytics = await Analytics.find({ driverId });
      
      // Calculate performance metrics
      const performance = {
        totalDistance: driverAnalytics.totalDistanceTraveled,
        totalHours: driverAnalytics.totalHoursWorked,
        averageSpeed: driverAnalytics.averageSpeed,
        maxSpeed: driverAnalytics.maxSpeed,
        totalAdImpressions: driverAnalytics.totalAdImpressions,
        totalQRScans: driverAnalytics.totalQRScans,
        complianceRate: driverAnalytics.complianceRate,
        safetyScore: driverAnalytics.safetyScore,
        uptimePercentage: driverAnalytics.uptimePercentage,
        speedViolations: driverAnalytics.speedViolations.length,
        totalRoutes: driverAnalytics.totalRoutes
      };
      
      return {
        driverAnalytics,
        deviceAnalytics,
        performance,
        todayPerformance: driverAnalytics.todayPerformance
      };
    } catch (error) {
      console.error('Error getting driver analytics:', error);
      throw error;
    }
  }
  
  // Get driver leaderboard
  static async getDriverLeaderboard(metric = 'distance', limit = 10) {
    try {
      const sortField = metric === 'distance' ? 'totalDistanceTraveled' : 
                      metric === 'compliance' ? 'complianceRate' :
                      metric === 'earnings' ? 'totalEarnings' : 'totalAdImpressions';
      
      return await DriverAnalytics.find({ isActive: true })
        .sort({ [sortField]: -1 })
        .limit(limit)
        .populate('driverId', 'firstName lastName vehiclePlateNumber vehicleType');
    } catch (error) {
      console.error('Error getting driver leaderboard:', error);
      throw error;
    }
  }
  
  // Sync driver analytics from screen tracking data
  static async syncFromScreenTracking(deviceId, materialId) {
    try {
      // Find the screen tracking record
      const screenTracking = await ScreenTracking.findOne({ 
        $or: [
          { deviceId: deviceId },
          { 'devices.deviceId': deviceId }
        ]
      });
      
      if (!screenTracking) {
        console.log(`No screen tracking found for device ${deviceId}`);
        return;
      }
      
      // Get driver from material
      const material = await Material.findOne({ materialId: materialId });
      
      if (!material || !material.driverId) {
        console.log(`No driver found for material ${materialId}`);
        return;
      }
      
      const driverId = material.driverId;
      
      // Update driver analytics with screen tracking data
      let driverAnalytics = await DriverAnalytics.findOne({ driverId });
      
      if (!driverAnalytics) {
        // Create new driver analytics record if it doesn't exist
        const driver = await Driver.findOne({ driverId: driverId });
        if (!driver) {
          console.error(`Driver not found for ID: ${driverId}`);
          return null;
        }
        
        driverAnalytics = new DriverAnalytics({
          driverId: driverId,
          materialId: materialId,
          vehiclePlateNumber: driver.vehiclePlateNumber,
          vehicleType: driver.vehicleType,
          isOnline: screenTracking.isOnline,
          lastSeen: screenTracking.lastSeen,
          currentLocation: screenTracking.currentLocation,
          totalDistanceTraveled: screenTracking.totalDistanceTraveled || 0,
          totalHoursOnline: screenTracking.totalHoursOnline || 0,
        });
      }
      
      if (driverAnalytics) {
        // Update with screen tracking data
        driverAnalytics.isOnline = screenTracking.isOnline;
        driverAnalytics.currentLocation = screenTracking.currentLocation;
        driverAnalytics.totalDistanceTraveled = screenTracking.totalDistanceTraveled || 0;
        driverAnalytics.totalHoursWorked = screenTracking.totalHoursOnline || 0;
        driverAnalytics.complianceRate = screenTracking.complianceRate || 0;
        driverAnalytics.uptimePercentage = screenTracking.uptimePercentage || 0;
        
        // Update today's performance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let todayPerformance = driverAnalytics.dailyPerformance.find(day => 
          day.date && day.date.toDateString() === today.toDateString()
        );
        
        if (!todayPerformance) {
          todayPerformance = {
            date: today,
            totalDistance: 0,
            totalHours: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            totalAdImpressions: 0,
            totalQRScans: 0,
            earnings: 0,
            complianceScore: 100,
            safetyScore: 100,
            routes: []
          };
          driverAnalytics.dailyPerformance.push(todayPerformance);
        }
        
        // Update today's data from screen tracking
        todayPerformance.totalDistance = screenTracking.currentSession?.totalDistanceTraveled || 0;
        todayPerformance.totalHours = screenTracking.currentHoursToday || 0;
        todayPerformance.complianceScore = screenTracking.isCompliantToday ? 100 : 0;
        
        await driverAnalytics.save();
        console.log(`✅ Synced driver analytics from screen tracking for driver ${driverId}`);
        return driverAnalytics;
      } else {
        console.log(`No driver analytics found for driver ${driverId}`);
        return null;
      }
      
    } catch (error) {
      console.error('Error syncing driver analytics from screen tracking:', error);
      throw error;
    }
  }
}

module.exports = DriverAnalyticsService;
