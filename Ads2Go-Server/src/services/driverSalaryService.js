const DriverSalaryPricing = require('../models/DriverSalaryPricing');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const DeviceTracking = require('../models/deviceTracking');
const MaterialUsageHistory = require('../models/MaterialUsageHistory');
const { getPhilippinesDateString } = require('../utils/dateUtils');

class DriverSalaryService {
  
  /**
   * Calculate driver salary based on the specified formula:
   * TOTAL DISTANCE * SUPERADMIN SET PRICE = DISTANCE COMPUTATION
   * TOTAL HOURS (30 DAYS) * SUPERADMIN SET PRICE = HOURS COMPUTATION
   * HOURS COMPUTATION (30DAYS) + DISTANCE COMPUTATION = DRIVER TOTAL SALARY
   */
  static async calculateDriverSalary(driverId, startDate, endDate) {
    try {
      // Get driver information
      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        throw new Error('Driver not found');
      }

      // Get driver's assigned material
      const material = await Material.findById(driver.materialId);
      if (!material) {
        throw new Error('No material assigned to driver');
      }

      // Get pricing configuration for this driver's setup
      const pricing = await DriverSalaryPricing.findOne({
        vehicleType: driver.vehicleType,
        category: material.category,
        materialType: material.materialType,
        isActive: true
      });

      if (!pricing) {
        throw new Error(`No pricing configuration found for ${material.materialType} (${material.category}) on ${driver.vehicleType}`);
      }

      const oldRates = pricing.previousDistanceRate != null && pricing.previousHoursRate != null
        ? { distanceRate: pricing.previousDistanceRate, hoursRate: pricing.previousHoursRate }
        : null;
      const newRates = { distanceRate: pricing.distanceRate, hoursRate: pricing.hoursRate };
      const effectiveDate = pricing.previousRateEffectiveUntil
        ? (() => { const d = new Date(pricing.previousRateEffectiveUntil); d.setHours(0, 0, 0, 0); return d; })()
        : null;

      // Pro-rate by day: days before (rate change + 24h) use old rate; on/after that day use new rate
      const shouldProRate = effectiveDate && oldRates;
      let trackingData;
      let calculations;

      if (shouldProRate) {
        const withDaily = await this.getDriverTrackingDataByDay(driverId, material.materialId, startDate, endDate);
        trackingData = {
          totalDistance: withDaily.totalDistance,
          totalHours: withDaily.totalHours,
          daysWorked: withDaily.daysWorked
        };
        let distanceComputation = 0;
        let hoursComputation = 0;
        (withDaily.dailyData || []).forEach(day => {
          const dayStart = new Date(day.date);
          dayStart.setHours(0, 0, 0, 0);
          const rates = dayStart < effectiveDate ? oldRates : newRates;
          distanceComputation += (day.totalDistance || 0) * rates.distanceRate;
          hoursComputation += (day.totalHours || 0) * rates.hoursRate;
        });
        const totalSalary = distanceComputation + hoursComputation;
        calculations = {
          distanceComputation: Math.round(distanceComputation * 100) / 100,
          hoursComputation: Math.round(hoursComputation * 100) / 100,
          totalSalary: Math.round(totalSalary * 100) / 100
        };
      } else {
        trackingData = await this.getDriverTrackingData(driverId, material.materialId, startDate, endDate);
        const usePreviousRate = pricing.previousRateEffectiveUntil && new Date() < pricing.previousRateEffectiveUntil && oldRates;
        const effectiveRates = usePreviousRate ? oldRates : newRates;
        const pricingConfig = {
          vehicleType: driver.vehicleType,
          category: material.category,
          materialType: material.materialType,
          ...effectiveRates
        };
        calculations = this.performSalaryCalculation(trackingData, pricingConfig);
      }

      const pricingConfig = {
        vehicleType: driver.vehicleType,
        category: material.category,
        materialType: material.materialType,
        distanceRate: newRates.distanceRate,
        hoursRate: newRates.hoursRate
      };

      return {
        driverId,
        driverName: `${driver.firstName} ${driver.lastName}`.trim(),
        materialId: material._id,
        deviceId: material.materialId,
        calculationPeriod: {
          startDate,
          endDate,
          periodType: this.determinePeriodType(startDate, endDate)
        },
        rawData: trackingData,
        pricingConfig: {
          vehicleType: driver.vehicleType,
          category: material.category,
          materialType: material.materialType,
          distanceRate: pricingConfig.distanceRate,
          hoursRate: pricingConfig.hoursRate
        },
        calculations
      };
    } catch (error) {
      console.error('Error calculating driver salary:', error);
      throw error;
    }
  }

  /**
   * Get driver tracking data with per-day breakdown (for pro-rated salary by effective date).
   */
  static async getDriverTrackingDataByDay(driverId, materialId, startDate, endDate) {
    return this.getDriverTrackingData(driverId, materialId, startDate, endDate, { returnDaily: true });
  }

  /**
   * Get driver tracking data for a specific period from devicedatahistoryv2
   * ✅ FIXED: Now filters by driver assignment period to prevent data leakage
   * @param {Object} options - { returnDaily: true } to include dailyData for pro-rating
   */
  static async getDriverTrackingData(driverId, materialId, startDate, endDate, options = {}) {
    try {
      // Get material ObjectId to query MaterialUsageHistory
      const material = await Material.findOne({ materialId: materialId });
      if (!material) {
        console.log(`⚠️  [DriverSalaryService] Material not found for materialId ${materialId}. Returning zero values.`);
        return {
          totalDistance: 0,
          totalHours: 0,
          daysWorked: 0
        };
      }

      // ✅ NEW: Get assignment periods for this driver and material
      const assignmentPeriods = await MaterialUsageHistory.find({
        materialId: material._id,
        driverId: driverId
      }).sort({ assignedAt: 1 });

      // Helper function to check if a date falls within any assignment period
      const isDateInAssignmentPeriod = (date) => {
        // If no assignment history exists, check if material is currently assigned to this driver
        // This handles edge cases where MaterialUsageHistory wasn't created (legacy data)
        if (assignmentPeriods.length === 0) {
          // Fallback: If material is currently assigned to this driver, include all data
          // This is a safety measure for legacy data, but ideally all assignments should have history
          if (material.driverId === driverId) {
            console.log(`⚠️  [DriverSalaryService] No assignment history found, but material is currently assigned to driver ${driverId}. Including all data as fallback.`);
            return true;
          }
          // If not currently assigned, exclude all data
          return false;
        }
        
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0); // Normalize to start of day
        
        return assignmentPeriods.some(period => {
          const assignedAt = new Date(period.assignedAt);
          assignedAt.setHours(0, 0, 0, 0);
          
          // If unassignedAt is null, the assignment is still active (use endDate as upper bound)
          const unassignedAt = period.unassignedAt 
            ? new Date(period.unassignedAt)
            : new Date(endDate);
          unassignedAt.setHours(23, 59, 59, 999); // End of day
          
          return checkDate >= assignedAt && checkDate <= unassignedAt;
        });
      };

      // Get device data history for the material
      const deviceHistory = await DeviceDataHistoryV2.findOne({
        materialId: materialId
      });

      // Convert dates to Date objects for comparison
      const start = new Date(startDate);
      const end = new Date(endDate);

      // If no tracking data exists, return zero values (allows calculation creation for new drivers)
      if (!deviceHistory) {
        console.log(`⚠️  [DriverSalaryService] No tracking data found for material ${materialId}. Returning zero values.`);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const maxDaysWorked = Math.min(daysDiff, 30); // Cap at 30 days as per formula
        
        return {
          totalDistance: 0,
          totalHours: 0,
          daysWorked: 0
        };
      }

      // ✅ FIXED: Filter daily data by both date range AND assignment period
      let periodData = deviceHistory.dailyData ? deviceHistory.dailyData.filter(dailyData => {
        const dataDate = new Date(dailyData.date);
        const isInDateRange = dataDate >= start && dataDate <= end;
        
        // Only include data from dates when this driver was assigned
        const isInAssignmentPeriod = isDateInAssignmentPeriod(dataDate);
        
        return isInDateRange && isInAssignmentPeriod;
      }) : [];

      // ✅ Merge real-time DeviceTracking for "today" so salary updates during the day
      const todayStr = getPhilippinesDateString();
      const todayStart = new Date(todayStr + 'T00:00:00.000Z');
      if (todayStart >= start && todayStart <= end && isDateInAssignmentPeriod(todayStart)) {
        const deviceToday = await DeviceTracking.findOne({
          materialId: materialId,
          $or: [
            { date: todayStr },
            { date: todayStart }
          ]
        }).lean();
        if (deviceToday) {
          const todayDistance = deviceToday.totalDistanceTraveled ?? 0;
          const todayHours = deviceToday.totalHoursOnline ?? 0;
          const existingTodayIndex = periodData.findIndex(d => {
            const dStr = (d.date instanceof Date ? d.date.toISOString() : String(d.date)).slice(0, 10);
            return dStr === todayStr;
          });
          const todayEntry = { date: todayStart, totalDistanceTraveled: todayDistance, totalHoursOnline: todayHours };
          if (existingTodayIndex >= 0) {
            periodData[existingTodayIndex] = { ...periodData[existingTodayIndex], totalDistanceTraveled: todayDistance, totalHoursOnline: todayHours };
          } else {
            periodData.push(todayEntry);
          }
          console.log(`📊 [DriverSalaryService] Merged today's real-time data: ${todayDistance}km, ${todayHours}h`);
        }
      }

      console.log(`📊 [DriverSalaryService] Found ${periodData.length} days of data for period ${startDate} to ${endDate} (filtered by assignment period)`);
      if (periodData.length > 0) {
        console.log(`📊 [DriverSalaryService] Period data:`, periodData.map(d => ({
          date: d.date,
          distance: d.totalDistanceTraveled,
          hours: d.totalHoursOnline
        })));
      }

      // Calculate totals for the period with per-day flooring (billable calculation)
      let totalDistance = 0;
      let totalHours = 0;
      let daysWorked = 0;
      const dailyData = options.returnDaily ? [] : null;

      periodData.forEach(dailyDataEntry => {
        const rawDistance = dailyDataEntry.totalDistanceTraveled || 0;
        const rawHours = dailyDataEntry.totalHoursOnline || 0;
        
        // ✅ Apply billable flooring per day (1m precision for distance, complete minutes for time)
        const distanceMeters = Math.floor(rawDistance * 1000);
        const billableDistance = distanceMeters / 1000;
        const totalMinutes = Math.floor(rawHours * 60);
        const billableHours = totalMinutes / 60;
        
        totalDistance += billableDistance;
        totalHours += billableHours;
        if (rawDistance > 0 || rawHours > 0) daysWorked++;

        if (dailyData) {
          const dayDate = new Date(dailyDataEntry.date);
          dayDate.setHours(0, 0, 0, 0);
          dailyData.push({
            date: dayDate,
            totalDistance: billableDistance,
            totalHours: billableHours
          });
        }
      });

      console.log(`📊 [DriverSalaryService] Calculated totals - Distance: ${totalDistance}km, Hours: ${totalHours}h, Days: ${daysWorked}`);

      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const maxDaysWorked = Math.min(daysDiff, 30);
      daysWorked = Math.min(daysWorked, maxDaysWorked);

      const out = {
        totalDistance: Math.round(totalDistance * 1000) / 1000,
        totalHours: Math.round(totalHours * 10000) / 10000,
        daysWorked
      };
      if (dailyData) out.dailyData = dailyData;
      return out;
    } catch (error) {
      console.error('Error getting driver tracking data:', error);
      // Return zero values instead of throwing error to allow calculation creation
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      console.log(`⚠️  [DriverSalaryService] Error occurred, returning zero values for material ${materialId}`);
      return {
        totalDistance: 0,
        totalHours: 0,
        daysWorked: 0
      };
    }
  }

  /**
   * Perform the salary calculation using the specified formula
   */
  static performSalaryCalculation(trackingData, pricingConfig) {
    const { totalDistance, totalHours } = trackingData;
    const { distanceRate, hoursRate } = pricingConfig;

    // Formula: TOTAL DISTANCE * SUPERADMIN SET PRICE = DISTANCE COMPUTATION
    const distanceComputation = totalDistance * distanceRate;

    // Formula: TOTAL HOURS (30 DAYS) * SUPERADMIN SET PRICE = HOURS COMPUTATION
    const hoursComputation = totalHours * hoursRate;

    // Formula: HOURS COMPUTATION (30DAYS) + DISTANCE COMPUTATION = DRIVER TOTAL SALARY
    const totalSalary = hoursComputation + distanceComputation;

    return {
      distanceComputation: Math.round(distanceComputation * 100) / 100,
      hoursComputation: Math.round(hoursComputation * 100) / 100,
      totalSalary: Math.round(totalSalary * 100) / 100
    };
  }

  /**
   * Determine the period type based on date range
   */
  static determinePeriodType(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffInDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (diffInDays === 1) return 'DAILY';
    if (diffInDays <= 7) return 'WEEKLY';
    if (diffInDays <= 31) return 'MONTHLY';
    return 'CUSTOM';
  }

  /**
   * Generate salary calculations for all active drivers for a specific month
   */
  static async generateMonthlySalaryCalculations(month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Get all active drivers with materials
      const drivers = await Driver.find({
        accountStatus: 'ACTIVE',
        materialId: { $exists: true, $ne: null }
      }).populate('material');

      const calculations = [];

      for (const driver of drivers) {
        try {
          const calculationData = await this.calculateDriverSalary(
            driver.driverId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Create and save the calculation (driverName and deviceId required by schema)
          const calculation = await DriverSalaryCalculation.createCalculation({
            driverId: driver.driverId,
            driverName: calculationData.driverName,
            materialId: driver.material._id,
            deviceId: calculationData.deviceId,
            calculationPeriod: calculationData.calculationPeriod,
            rawData: calculationData.rawData,
            pricingConfig: calculationData.pricingConfig
          });

          calculations.push(calculation);
        } catch (error) {
          console.error(`Error generating calculation for driver ${driver.driverId}:`, error);
          // Continue with other drivers
        }
      }

      return calculations;
    } catch (error) {
      console.error('Error generating monthly salary calculations:', error);
      throw error;
    }
  }

  /**
   * Get salary summary for a driver
   */
  static async getDriverSalarySummary(driverId) {
    try {
      const calculations = await DriverSalaryCalculation.find({
        driverId,
        isActive: true
      }).sort({ 'calculationPeriod.startDate': -1 });

      const totalCalculations = calculations.length;
      const totalSalary = calculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
      const averageMonthlySalary = totalCalculations > 0 ? totalSalary / totalCalculations : 0;
      const lastCalculationDate = calculations.length > 0 ? calculations[0].calculationPeriod.startDate : null;
      const currentStatus = calculations.length > 0 ? calculations[0].status : null;

      return {
        driverId,
        totalCalculations,
        totalSalary: Math.round(totalSalary * 100) / 100,
        averageMonthlySalary: Math.round(averageMonthlySalary * 100) / 100,
        lastCalculationDate,
        currentStatus
      };
    } catch (error) {
      console.error('Error getting driver salary summary:', error);
      throw error;
    }
  }

  /**
   * Validate pricing configuration
   */
  static async validatePricingConfiguration(vehicleType, category, materialType) {
    try {
      const pricing = await DriverSalaryPricing.findOne({
        vehicleType,
        category,
        materialType,
        isActive: true
      });

      if (!pricing) {
        throw new Error(`No pricing configuration found for ${materialType} (${category}) on ${vehicleType}`);
      }

      if (pricing.distanceRate < 0 || pricing.hoursRate < 0) {
        throw new Error('Pricing rates must be non-negative');
      }

      return pricing;
    } catch (error) {
      console.error('Error validating pricing configuration:', error);
      throw error;
    }
  }

  /**
   * Get all pricing configurations with statistics
   */
  static async getPricingStatistics() {
    try {
      const pricingList = await DriverSalaryPricing.find({});
      
      const stats = {
        totalConfigurations: pricingList.length,
        activeConfigurations: pricingList.filter(p => p.isActive).length,
        inactiveConfigurations: pricingList.filter(p => !p.isActive).length,
        vehicleTypes: [...new Set(pricingList.map(p => p.vehicleType))],
        materialTypes: [...new Set(pricingList.map(p => p.materialType))],
        categories: [...new Set(pricingList.map(p => p.category))],
        averageDistanceRate: pricingList.length > 0 ? 
          pricingList.reduce((sum, p) => sum + p.distanceRate, 0) / pricingList.length : 0,
        averageHoursRate: pricingList.length > 0 ? 
          pricingList.reduce((sum, p) => sum + p.hoursRate, 0) / pricingList.length : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting pricing statistics:', error);
      throw error;
    }
  }
}

module.exports = DriverSalaryService;
